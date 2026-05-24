const CDN_BASE   = "https://cdn.jzadl.xyz/tools/kexttool";
const CDN_DB     = CDN_BASE + "/kextdb.json";
const CDN_HW     = CDN_BASE + "/hwparams.json";

const MACOS_ORDER = [
  "tahoe", "sequoia", "sonoma", "ventura", "monterey",
  "bigsur", "catalina", "mojave", "highsierra",
];

let DB = null;
let HW_PARAMS = null;

// ---------------------------------------------------------------------------
// Startup — load both JSON files in parallel
// ---------------------------------------------------------------------------
async function loadDatabase() {
  const dot = document.getElementById("dbDot");
  const txt = document.getElementById("dbStatusText");
  try {
    [DB, HW_PARAMS] = await Promise.all([
      fetch(CDN_DB).then((r) => { if (!r.ok) throw new Error("kextdb HTTP " + r.status); return r.json(); }),
      fetch(CDN_HW).then((r) => { if (!r.ok) throw new Error("hwparams HTTP " + r.status); return r.json(); }),
    ]);
    dot.classList.add("ok");
    txt.textContent =
      "Database v" + DB._meta.version +
      " loaded from cdn.jzadl.xyz (" + DB._meta.updated + ")";
    if (fileContent) analyzeBtn.disabled = false;
  } catch (e) {
    dot.classList.add("err");
    txt.textContent = "Failed to load database: " + e.message;
    showError("Could not fetch database from cdn.jzadl.xyz. Make sure CORS is enabled in Cloudflare.");
  }
}

// ---------------------------------------------------------------------------
// Parser — builds hw object from raw dxdiag text
// ---------------------------------------------------------------------------
function parseDxdiag(text) {
  const hw = {
    osName:         null,
    cpuName:        null,
    cpuVendor:      null,
    cpuGen:         0,
    ramGB:          null,
    gpuName:        null,   // first (primary/dedicated) GPU name
    gpuVendor:      null,
    gpuId:          null,
    igpuId:         null,   // Intel iGPU when a dGPU is also present
    audioChip:      null,
    wifiChip:       null,
    wifiVendor:     null,
    ethernetChip:   null,
    ethernetVendor: null,
    isLaptop:       false,
    brand:          null,
    model:          null,
    hasNVMe:        false,
  };

  const laptopRx = new RegExp(HW_PARAMS.laptop_keywords.join("|"), "i");
  const audioRx  = new RegExp(HW_PARAMS.audio_keywords.join("|"), "i");
  const nvmeRxs  = HW_PARAMS.nvme_detection.regexes.map((r) => new RegExp(r, "i"));

  // Build compiled wifi/ethernet matchers once
  const wifiMatchers = HW_PARAMS.wifi_vendors.map((v) => ({
    vendor:    v.vendor,
    vendorRx:  new RegExp(v.regex, "i"),
    lineRx:    new RegExp(v.line_match, "i"),
  }));
  const ethMatchers = HW_PARAMS.ethernet_vendors.map((v) => ({
    vendor:    v.vendor,
    vendorRx:  new RegExp(v.regex, "i"),
    lineRx:    new RegExp(v.line_match, "i"),
  }));

  // GPU rules compiled
  const gpuRules = HW_PARAMS.gpu_rules.map((r) => ({
    ...r,
    rx: new RegExp(r.regex, "i"),
  }));

  // Intel gen detection compiled
  const genRules = HW_PARAMS.intel_gen_detection.map((r) => ({
    gen: r.gen,
    rx:  new RegExp(r.regex, "i"),
  }));

  // Track how many "Card name" lines we've seen (first = primary GPU)
  let cardCount = 0;

  for (const line of text.split("\n")) {
    const l = line.trim();

    // ── System info ────────────────────────────────────────────────────
    if (!hw.osName && l.match(/^Operating System:/i))
      hw.osName = l.replace(/^Operating System:\s*/i, "").split("(")[0].trim();

    if (!hw.model && l.match(/^System Model:/i))
      hw.model = l.replace(/^System Model:\s*/i, "").trim();

    if (!hw.brand && l.match(/^System Manufacturer:/i))
      hw.brand = l.replace(/^System Manufacturer:\s*/i, "").trim();

    if (!hw.isLaptop && laptopRx.test(l)) hw.isLaptop = true;
    if (!hw.isLaptop && hw.model && laptopRx.test(hw.model)) hw.isLaptop = true;

    // ── CPU ────────────────────────────────────────────────────────────
    if (!hw.cpuName && l.match(/^Processor:/i)) {
      hw.cpuName = l.replace(/^Processor:\s*/i, "").split(",")[0].trim();
      if (hw.cpuName.match(/intel/i)) {
        hw.cpuVendor = "Intel";
        for (const { gen, rx } of genRules) {
          if (rx.test(hw.cpuName)) { hw.cpuGen = gen; break; }
        }
      } else if (hw.cpuName.match(/amd|ryzen/i)) {
        hw.cpuVendor = "AMD";
      }
    }

    // ── RAM ────────────────────────────────────────────────────────────
    if (!hw.ramGB && l.match(/^Memory:/i)) {
      const m = l.match(/(\d+)\s*MB/i);
      if (m) hw.ramGB = Math.round(parseInt(m[1]) / 1024);
    }

    // ── GPU ────────────────────────────────────────────────────────────
    if (l.match(/^Card name:/i)) {
      cardCount++;
      const name = l.replace(/^Card name:\s*/i, "").trim();

      // Classify this card
      let matchedVendor = null, matchedId = null;
      for (const rule of gpuRules) {
        if (rule.rx.test(name)) {
          matchedVendor = rule.vendor;
          matchedId     = rule.id;
          break;
        }
      }
      // Fallback vendor detection
      if (!matchedVendor) {
        if (name.match(/intel/i))               matchedVendor = "Intel";
        else if (name.match(/amd|radeon|ati/i)) matchedVendor = "AMD";
        else if (name.match(/nvidia|geforce|gtx|rtx/i)) matchedVendor = "NVIDIA";
      }

      if (cardCount === 1) {
        // First Card name = primary/dedicated GPU
        hw.gpuName   = name;
        hw.gpuVendor = matchedVendor;
        hw.gpuId     = matchedId;
      } else if (matchedVendor === "Intel" && !hw.igpuId) {
        // Subsequent Intel card = iGPU (common in systems with dGPU + Intel iGPU)
        hw.igpuId = matchedId;
      }
    }

    // ── Audio ──────────────────────────────────────────────────────────
    if (!hw.audioChip && l.match(/^.*Description:/i) && audioRx.test(l))
      hw.audioChip = l.replace(/^.*Description:\s*/i, "").trim();

    // ── Wi-Fi ──────────────────────────────────────────────────────────
    if (!hw.wifiVendor) {
      for (const m of wifiMatchers) {
        if (m.lineRx.test(l) && m.vendorRx.test(l)) {
          hw.wifiVendor = m.vendor;
          hw.wifiChip   = ac(l);
          break;
        }
      }
    }

    // ── Ethernet ───────────────────────────────────────────────────────
    if (!hw.ethernetVendor) {
      for (const m of ethMatchers) {
        if (m.lineRx.test(l) && m.vendorRx.test(l)) {
          hw.ethernetVendor = m.vendor;
          hw.ethernetChip   = ac(l);
          break;
        }
      }
    }

    // ── NVMe ───────────────────────────────────────────────────────────
    if (!hw.hasNVMe && nvmeRxs.some((rx) => rx.test(l))) hw.hasNVMe = true;
  }

  // ── Infer iGPU from CPU gen if still not set ──────────────────────────
  if (hw.cpuVendor === "Intel" && hw.cpuGen > 0) {
    const inferredIgpu = HW_PARAMS.intel_gen_igpu[String(hw.cpuGen)];
    if (inferredIgpu) {
      // If primary GPU is Intel (no dGPU), set gpuId
      if (!hw.gpuId) hw.gpuId = inferredIgpu;
      // Always store igpuId for compatibility fallback
      if (!hw.igpuId) hw.igpuId = inferredIgpu;
    }
  }

  return hw;
}

// Extract value after first colon in a line
function ac(line) {
  const i = line.indexOf(":");
  return i === -1 ? null : line.substring(i + 1).trim() || null;
}

// ---------------------------------------------------------------------------
// macOS compatibility — uses igpuId as fallback when dGPU has no support
// ---------------------------------------------------------------------------
function getMacosCompatibility(hw) {
  // Determine which GPU ID to use for compatibility checks
  const noSupportIds = HW_PARAMS.warnings.nvidia_no_support_ids;
  const webdriverIds = HW_PARAMS.warnings.nvidia_webdriver_ids;

  const dGpuBlocked = noSupportIds.includes(hw.gpuId);
  const effectiveGpuId = dGpuBlocked && hw.igpuId ? hw.igpuId : hw.gpuId;

  return DB.macos_versions.map((ver) => {
    let status = "supported", reason = "";

    // ── dGPU has no macOS support ────────────────────────────────────
    if (noSupportIds.includes(hw.gpuId)) {
      if (!hw.igpuId) {
        return { ...ver, status: "unsupported", reason: HW_PARAMS.warning_messages[hw.gpuId] || "No macOS support for this GPU" };
      }
      // Has iGPU — continue evaluation using iGPU, add note
      reason = "⚠️ Using iGPU (" + hw.igpuId.replace(/_/g, " ") + ") — dGPU unsupported";
    }

    // ── NVIDIA Web Drivers (Maxwell/Pascal) ──────────────────────────
    if (webdriverIds.includes(hw.gpuId)) {
      if (!["highsierra", "mojave"].includes(ver.id))
        return { ...ver, status: "unsupported", reason: HW_PARAMS.warning_messages["nvidia_webdriver"] };
    }

    // ── Intel CPU generation limits ──────────────────────────────────
    if (hw.cpuVendor === "Intel" && hw.cpuGen > 0) {
      const g = DB.intel_generations.find((x) => x.gen === hw.cpuGen);
      if (g) {
        const minIdx = MACOS_ORDER.indexOf(g.min_macos);
        const curIdx = MACOS_ORDER.indexOf(ver.id);
        if (curIdx > minIdx)
          return { ...ver, status: "unsupported", reason: "Intel " + hw.cpuGen + "th gen not supported" };

        if (effectiveGpuId === "intel_iris_xe")
          reason = reason || "⚠️ No iGPU acceleration — use dGPU";
        else if (g.oclp_required_from) {
          const oclpIdx = MACOS_ORDER.indexOf(g.oclp_required_from);
          if (curIdx <= oclpIdx) {
            status = "oclp";
            reason = reason || "OCLP root patch required for iGPU acceleration";
          }
        }
      }
    }

    return { ...ver, status, reason };
  });
}

// ---------------------------------------------------------------------------
// Kext filtering (unchanged logic, reads from DB)
// ---------------------------------------------------------------------------
function getKexts(hw, macosId) {
  return DB.kexts.filter((k) => {
    if (!k.always_required) {
      const sup = k.supported_macos || [];
      if (!sup.includes(macosId)) return false;
    }
    if (k.id === "applealc"     && macosId === "tahoe")  return false;
    if (k.id === "oclp_mod_audio" && macosId !== "tahoe") return false;
    if (k.match_macos_min) {
      const minIdx = MACOS_ORDER.indexOf(k.match_macos_min);
      const curIdx = MACOS_ORDER.indexOf(macosId);
      if (curIdx > minIdx) return false;
    }
    if (k.always_required) return true;
    if (k.match_gpu_vendor   && k.match_gpu_vendor.includes(hw.gpuVendor))
      if (!(k.exclude_gpu_ids || []).includes(hw.gpuId)) return true;
    if (k.match_gpu_ids      && hw.gpuId && k.match_gpu_ids.includes(hw.gpuId)) return true;
    if (k.match_cpu_vendor   && k.match_cpu_vendor === hw.cpuVendor) return true;
    if (k.match_intel_gen_min && hw.cpuVendor === "Intel" && hw.cpuGen >= k.match_intel_gen_min) return true;
    if (k.match_has_audio    && hw.audioChip)  return true;
    if (k.match_wifi_vendor  && k.match_wifi_vendor === hw.wifiVendor) return true;
    if (k.match_ethernet_vendor && k.match_ethernet_vendor === hw.ethernetVendor) return true;
    if (k.match_ethernet_regex && hw.ethernetChip &&
        new RegExp(k.match_ethernet_regex, "i").test(hw.ethernetChip)) return true;
    if (k.match_is_laptop    && hw.isLaptop)   return true;
    if (k.match_is_desktop   && !hw.isLaptop)  return true;
    if (k.match_has_nvme     && hw.hasNVMe)    return true;
    if (k.match_brand_regex  && hw.brand &&
        new RegExp(k.match_brand_regex, "i").test(hw.brand)) return true;
    if (k.match_macos        && k.match_macos.includes(macosId)) return true;
    return false;
  });
}

// ---------------------------------------------------------------------------
// Render
// ---------------------------------------------------------------------------
function renderResults(hw) {
  // Summary grid
  document.getElementById("summaryGrid").innerHTML = [
    { label: "System",      value: [hw.brand, hw.model].filter(Boolean).join(" ") || "Unknown" },
    { label: "Type",        value: hw.isLaptop ? "💻 Laptop" : "🖥️ Desktop" },
    { label: "CPU",         value: hw.cpuName || "Unknown" },
    { label: "CPU Vendor",  value: hw.cpuVendor || "Unknown" },
    { label: "RAM",         value: hw.ramGB ? hw.ramGB + " GB" : "Unknown" },
    { label: "GPU",         value: hw.gpuName || "Unknown" },
    { label: "Wi-Fi",       value: hw.wifiChip || (hw.wifiVendor ? hw.wifiVendor + " (chip unknown)" : "Not detected") },
    { label: "Ethernet",    value: hw.ethernetChip || (hw.ethernetVendor ? hw.ethernetVendor + " (chip unknown)" : "Not detected") },
    { label: "Audio",       value: hw.audioChip || "Not detected" },
    { label: "NVMe",        value: hw.hasNVMe ? "Detected" : "Not detected" },
  ]
    .map((i) =>
      '<div class="summary-card"><div class="summary-label">' + i.label +
      '</div><div class="summary-value">' + i.value + "</div></div>"
    )
    .join("");

  // Warnings — built from hwparams.json warning_messages
  const warnings = [];
  const noSupportIds = HW_PARAMS.warnings.nvidia_no_support_ids;
  const webdriverIds = HW_PARAMS.warnings.nvidia_webdriver_ids;

  if (noSupportIds.includes(hw.gpuId)) {
    const msg = HW_PARAMS.warning_messages[hw.gpuId];
    warnings.push(msg + (hw.igpuId ? " macOS will use your Intel iGPU instead." : ""));
  }
  if (webdriverIds.includes(hw.gpuId))
    warnings.push(HW_PARAMS.warning_messages["nvidia_webdriver"]);
  if (hw.gpuId === "intel_iris_xe")
    warnings.push(HW_PARAMS.warning_messages["intel_iris_xe"]);
  if (hw.cpuVendor === "AMD")
    warnings.push(HW_PARAMS.warning_messages["amd_cpu"]);
  if (!hw.wifiVendor)
    warnings.push(HW_PARAMS.warnings.no_wifi_suggestion);

  const wb = document.getElementById("warnBox");
  if (warnings.length) {
    wb.innerHTML =
      "⚠️ <strong>Important notes:</strong><ul>" +
      warnings.map((w) => "<li>" + w + "</li>").join("") +
      "</ul>";
    wb.classList.add("visible");
  } else {
    wb.classList.remove("visible");
  }

  // macOS compatibility
  const versions = getMacosCompatibility(hw);
  const firstGood = versions.find((v) => v.status === "supported" || v.status === "oclp");
  if (firstGood) firstGood.status = "recommended";
  const selectedMacosId = firstGood ? firstGood.id : "sequoia";

  document.getElementById("macosRow").innerHTML = versions
    .map((ver) => {
      let tc, tt, bc;
      if      (ver.status === "recommended") { tc = "rec";  tt = "Recommended"; bc = "recommended"; }
      else if (ver.status === "oclp")        { tc = "oclp"; tt = "Needs OCLP";  bc = "";            }
      else if (ver.status === "unsupported") { tc = "no";   tt = ver.reason || "Not supported"; bc = "unsupported"; }
      else                                   { tc = "ok";   tt = "Supported";   bc = "";            }
      const extra =
        ver.reason && ver.status !== "unsupported"
          ? '<div style="font-size:10px;color:#555;margin-top:4px">' + ver.reason + "</div>"
          : "";
      return (
        '<div class="macos-badge ' + bc + '">' +
        '<div class="macos-name">' + ver.name + '</div>' +
        '<div class="macos-version">macOS ' + ver.version + '</div>' +
        '<span class="macos-tag ' + tc + '">' + tt + '</span>' +
        extra + '</div>'
      );
    })
    .join("");

  // Kexts
  const kexts = getKexts(hw, selectedMacosId);
  const byCategory = {};
  for (const k of kexts) {
    const c = k.category || "Other";
    if (!byCategory[c]) byCategory[c] = [];
    byCategory[c].push(k);
  }
  const catOrder = ["Essential","CPU","GPU","Audio","Wi-Fi","Bluetooth","Ethernet","USB","Input","Battery","Storage","Sensors","Fixes"];
  const sorted = Object.keys(byCategory).sort((a, b) => {
    const ai = catOrder.indexOf(a), bi = catOrder.indexOf(b);
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  });

  document.getElementById("kextSections").innerHTML = sorted
    .map((cat) => {
      const cards = byCategory[cat]
        .map((k) => {
          const note =
            selectedMacosId === "tahoe" && k.tahoe_note
              ? '<div class="kext-note">⚠️ Tahoe: ' + k.tahoe_note + "</div>"
              : "";
          return (
            '<div class="kext-card">' +
            '<div class="kext-header"><span class="kext-name">' + k.name + '</span>' +
            '<span class="kext-priority ' + k.priority + '">' + k.priority + '</span></div>' +
            '<p class="kext-desc">' + k.description + "</p>" +
            note +
            '<a href="' + k.github + '" target="_blank" rel="noopener noreferrer" class="kext-link">GitHub ↗</a>' +
            '</div>'
          );
        })
        .join("");
      return (
        '<div class="kext-section"><div class="kext-section-title">' + cat +
        '</div><div class="kext-grid">' + cards + "</div></div>"
      );
    })
    .join("");

  // Force show all sections
  const resultsDiv = document.getElementById("results");
  resultsDiv.classList.add("visible");
  resultsDiv.style.display = "block";
  resultsDiv.style.opacity = "1";
  resultsDiv.style.visibility = "visible";

  // Ensure individual sections are visible
  const sections = resultsDiv.querySelectorAll("section");
  sections.forEach(section => {
    section.style.display = "block";
    section.style.opacity = "1";
    section.style.visibility = "visible";
    section.style.minHeight = "auto";
  });
}

// ---------------------------------------------------------------------------
// File handling + UI glue
// ---------------------------------------------------------------------------
let fileContent = null;
const analyzeBtn = document.getElementById("analyzeBtn");
const clearBtn   = document.getElementById("clearBtn");
const dropZone   = document.getElementById("dropZone");
const fileInput  = document.getElementById("fileInput");

dropZone.addEventListener("click",     () => fileInput.click());
dropZone.addEventListener("dragover",  (e) => { e.preventDefault(); dropZone.classList.add("dragover"); });
dropZone.addEventListener("dragleave", ()  => dropZone.classList.remove("dragover"));
dropZone.addEventListener("drop",      (e) => { e.preventDefault(); dropZone.classList.remove("dragover"); if (e.dataTransfer.files[0]) loadFile(e.dataTransfer.files[0]); });
fileInput.addEventListener("change",   ()  => { if (fileInput.files[0]) loadFile(fileInput.files[0]); });

function loadFile(file) {
  if (!file.name.endsWith(".txt")) { showError("Please upload a .txt file from dxdiag."); return; }
  const reader = new FileReader();
  reader.onload = (e) => {
    fileContent = e.target.result;
    dropZone.classList.add("has-file");
    document.getElementById("dropTitle").textContent = "✓ " + file.name;
    document.getElementById("dropSub").textContent   = (file.size / 1024).toFixed(1) + " KB — ready to analyze";
    if (DB && HW_PARAMS) analyzeBtn.disabled = false;
    clearBtn.style.display = "";
    hideError();
  };
  reader.readAsText(file);
}

function analyze() {
  if (!fileContent || !DB || !HW_PARAMS) return;
  document.getElementById("loading").classList.add("visible");
  document.getElementById("results").classList.remove("visible");
  document.getElementById("warnBox").classList.remove("visible");
  hideError();
  setTimeout(() => {
    try {
      renderResults(parseDxdiag(fileContent));
    } catch (e) {
      showError("Could not parse the file. Make sure it is a valid dxdiag output.");
      console.error(e);
    }
    document.getElementById("loading").classList.remove("visible");
  }, 500);
}

function clearAll() {
  fileContent = null;
  fileInput.value = "";
  dropZone.classList.remove("has-file");
  document.getElementById("dropTitle").textContent = "Drop your dxdiag.txt here";
  document.getElementById("dropSub").textContent   = "or click to browse — Windows only, run via Win+R → dxdiag → Save All Information";
  analyzeBtn.disabled = true;
  clearBtn.style.display = "none";
  document.getElementById("results").classList.remove("visible");
  document.getElementById("warnBox").classList.remove("visible");
  hideError();
}

function showError(msg) { const b = document.getElementById("errorBox"); b.textContent = msg; b.classList.add("visible"); }
function hideError()     { document.getElementById("errorBox").classList.remove("visible"); }

loadDatabase();
