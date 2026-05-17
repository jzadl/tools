const CDN_URL = "https://cdn.jzadl.xyz/tools/kexttool/kextdb.json";
const MACOS_ORDER = [
  "tahoe",
  "sequoia",
  "sonoma",
  "ventura",
  "monterey",
  "bigsur",
  "catalina",
  "mojave",
  "highsierra",
];
let DB = null;

async function loadDatabase() {
  const dot = document.getElementById("dbDot");
  const txt = document.getElementById("dbStatusText");
  try {
    const res = await fetch(CDN_URL);
    if (!res.ok) throw new Error("HTTP " + res.status);
    DB = await res.json();
    dot.classList.add("ok");
    txt.textContent =
      "Database v" +
      DB._meta.version +
      " loaded from cdn.jzadl.xyz (" +
      DB._meta.updated +
      ")";
    if (fileContent) analyzeBtn.disabled = false;
  } catch (e) {
    dot.classList.add("err");
    txt.textContent = "Failed to load database: " + e.message;
    showError(
      "Could not fetch kext database from " +
        CDN_URL +
        ". Make sure the file is uploaded and CORS is enabled in Cloudflare.",
    );
  }
}

function parseDxdiag(text) {
  const hw = {
    osName: null,
    cpuName: null,
    cpuVendor: null,
    cpuGen: 0,
    ramGB: null,
    gpuName: null,
    gpuVendor: null,
    gpuId: null,
    audioChip: null,
    wifiChip: null,
    wifiVendor: null,
    ethernetChip: null,
    ethernetVendor: null,
    isLaptop: false,
    brand: null,
    model: null,
    hasNVMe: false,
  };

  for (const line of text.split("\n")) {
    const l = line.trim();
    if (!hw.osName && l.match(/^Operating System:/i))
      hw.osName = l
        .replace(/^Operating System:\s*/i, "")
        .split("(")[0]
        .trim();
    if (!hw.model && l.match(/^System Model:/i))
      hw.model = l.replace(/^System Model:\s*/i, "").trim();
    if (!hw.brand && l.match(/^System Manufacturer:/i))
      hw.brand = l.replace(/^System Manufacturer:\s*/i, "").trim();
    if (
      l.match(
        /laptop|notebook|thinkpad|ideapad|inspiron|latitude|elitebook|probook|pavilion|envy|spectre|xps|yoga|zenbook|vivobook|matebook/i,
      )
    )
      hw.isLaptop = true;
    if (
      hw.model &&
      hw.model.match(
        /laptop|notebook|thinkpad|ideapad|inspiron|latitude|elitebook|probook|pavilion|yoga|zenbook/i,
      )
    )
      hw.isLaptop = true;

    if (!hw.cpuName && l.match(/^Processor:/i)) {
      hw.cpuName = l
        .replace(/^Processor:\s*/i, "")
        .split(",")[0]
        .trim();
      if (hw.cpuName.match(/intel/i)) {
        hw.cpuVendor = "Intel";
        const n = hw.cpuName;
        if (n.match(/14[0-9]{3}/i)) hw.cpuGen = 14;
        else if (n.match(/13[0-9]{3}/i)) hw.cpuGen = 13;
        else if (n.match(/12[0-9]{3}/i)) hw.cpuGen = 12;
        else if (n.match(/11[0-9]{3}|1[12][0-9]{2}G/i)) hw.cpuGen = 11;
        else if (n.match(/10[0-9]{3}|10[0-9]{2}G/i)) hw.cpuGen = 10;
        else if (n.match(/9[0-9]{3}/i)) hw.cpuGen = 9;
        else if (n.match(/8[0-9]{3}/i)) hw.cpuGen = 8;
        else if (n.match(/7[0-9]{3}/i)) hw.cpuGen = 7;
        else if (n.match(/6[0-9]{3}/i)) hw.cpuGen = 6;
        else if (n.match(/5[0-9]{3}/i)) hw.cpuGen = 5;
        else if (n.match(/4[0-9]{3}/i)) hw.cpuGen = 4;
        else if (n.match(/3[0-9]{3}/i)) hw.cpuGen = 3;
        else if (n.match(/2[0-9]{3}/i)) hw.cpuGen = 2;
      } else if (hw.cpuName.match(/amd|ryzen/i)) hw.cpuVendor = "AMD";
    }

    if (!hw.ramGB && l.match(/^Memory:/i)) {
      const m = l.match(/(\d+)\s*MB/i);
      if (m) hw.ramGB = Math.round(parseInt(m[1]) / 1024);
    }

    if (!hw.gpuName && l.match(/^Card name:/i)) {
      hw.gpuName = l.replace(/^Card name:\s*/i, "").trim();
      if (hw.gpuName.match(/intel/i)) {
        hw.gpuVendor = "Intel";
        if (hw.gpuName.match(/Iris Xe|UHD 7[0-9]{2}/i))
          hw.gpuId = "intel_iris_xe";
        else if (hw.gpuName.match(/UHD 6[0-9]{2}/i)) hw.gpuId = "intel_uhd_630";
        else if (hw.gpuName.match(/HD 6[0-9]{2}/i)) hw.gpuId = "intel_hd_630";
        else if (hw.gpuName.match(/HD 5[0-9]{2}/i)) hw.gpuId = "intel_hd_530";
        else if (hw.gpuName.match(/HD 4[0-9]{3}|Iris 5[0-9]{3}/i))
          hw.gpuId = "intel_hd_4000";
      } else if (hw.gpuName.match(/amd|radeon|ati/i)) {
        hw.gpuVendor = "AMD";
        if (hw.gpuName.match(/RX\s*6[0-9]{3}/i)) hw.gpuId = "amd_rdna2";
        else if (hw.gpuName.match(/RX\s*5[0-9]{3}/i)) hw.gpuId = "amd_rdna1";
        else if (hw.gpuName.match(/RX\s*[45][0-9]{2}/i))
          hw.gpuId = "amd_polaris";
        else if (hw.gpuName.match(/Vega/i)) hw.gpuId = "amd_vega";
        else if (hw.gpuName.match(/Radeon\s+\d{3}[Mm]/i)) hw.gpuId = "amd_igpu";
      } else if (hw.gpuName.match(/nvidia|geforce|gtx|rtx/i)) {
        hw.gpuVendor = "NVIDIA";
        if (hw.gpuName.match(/RTX|GTX 16/i)) hw.gpuId = "nvidia_turing_plus";
        else if (hw.gpuName.match(/GTX\s*9[0-9]{2}|GTX\s*10[0-9]{2}/i))
          hw.gpuId = "nvidia_maxwell_pascal";
        else if (hw.gpuName.match(/GTX\s*[67][0-9]{2}/i))
          hw.gpuId = "nvidia_kepler";
      }
    }

    if (
      !hw.audioChip &&
      l.match(/Description:/i) &&
      l.match(/realtek|conexant|idt|cirrus|audio/i)
    )
      hw.audioChip = l.replace(/^.*Description:\s*/i, "").trim();

    if (l.match(/wi-fi|wireless|802\.11/i)) {
      if (l.match(/intel/i)) {
        hw.wifiVendor = "Intel";
        hw.wifiChip = hw.wifiChip || ac(l);
      } else if (l.match(/broadcom|bcm/i)) {
        hw.wifiVendor = "Broadcom";
        hw.wifiChip = hw.wifiChip || ac(l);
      } else if (l.match(/qualcomm|atheros|killer/i)) {
        hw.wifiVendor = "Qualcomm";
        hw.wifiChip = hw.wifiChip || ac(l);
      }
    }

    if (l.match(/ethernet|lan\b/i)) {
      if (l.match(/realtek/i)) {
        hw.ethernetVendor = "Realtek";
        hw.ethernetChip = hw.ethernetChip || ac(l);
      } else if (l.match(/intel/i)) {
        hw.ethernetVendor = "Intel";
        hw.ethernetChip = hw.ethernetChip || ac(l);
      } else if (l.match(/atheros|killer/i)) {
        hw.ethernetVendor = "Atheros";
        hw.ethernetChip = hw.ethernetChip || ac(l);
      }
    }

    if (l.match(/nvme|nvm express/i)) hw.hasNVMe = true;
  }

  // Infer iGPU from Intel gen if no GPU detected
  if (hw.cpuVendor === "Intel" && !hw.gpuId && hw.cpuGen > 0) {
    if (hw.cpuGen >= 11) hw.gpuId = "intel_iris_xe";
    else if (hw.cpuGen >= 8) hw.gpuId = "intel_uhd_630";
    else if (hw.cpuGen === 7) hw.gpuId = "intel_hd_630";
    else if (hw.cpuGen === 6) hw.gpuId = "intel_hd_530";
    else if (hw.cpuGen >= 3) hw.gpuId = "intel_hd_4000";
  }
  return hw;
}

function ac(line) {
  const i = line.indexOf(":");
  return i === -1 ? null : line.substring(i + 1).trim() || null;
}

function getMacosCompatibility(hw) {
  return DB.macos_versions.map((ver) => {
    let status = "supported",
      reason = "";

    if (hw.gpuId === "nvidia_turing_plus") {
      return {
        ...ver,
        status: "unsupported",
        reason: "No macOS support for RTX GPUs",
      };
    }
    if (hw.gpuId === "nvidia_maxwell_pascal") {
      if (!["highsierra", "mojave"].includes(ver.id))
        return {
          ...ver,
          status: "unsupported",
          reason: "Web Drivers: High Sierra & Mojave only",
        };
    }

    if (hw.cpuVendor === "Intel" && hw.cpuGen > 0) {
      const g = DB.intel_generations.find((x) => x.gen === hw.cpuGen);
      if (g) {
        const minIdx = MACOS_ORDER.indexOf(g.min_macos),
          curIdx = MACOS_ORDER.indexOf(ver.id);
        if (curIdx > minIdx)
          return {
            ...ver,
            status: "unsupported",
            reason: "Intel " + hw.cpuGen + "th gen not supported",
          };
        if (hw.gpuId === "intel_iris_xe")
          reason = "⚠️ No iGPU acceleration — use dGPU";
        else if (g.oclp_required_from) {
          const oclpIdx = MACOS_ORDER.indexOf(g.oclp_required_from);
          if (curIdx <= oclpIdx) {
            status = "oclp";
            reason = "OCLP root patch required for iGPU acceleration";
          }
        }
      }
    }
    return { ...ver, status, reason };
  });
}

function getKexts(hw, macosId) {
  return DB.kexts.filter((k) => {
    if (!k.always_required) {
      const sup = k.supported_macos || [];
      if (!sup.includes(macosId)) return false;
    }
    if (k.id === "applealc" && macosId === "tahoe") return false;
    if (k.id === "oclp_mod_audio" && macosId !== "tahoe") return false;
    if (k.match_macos_min) {
      const minIdx = MACOS_ORDER.indexOf(k.match_macos_min),
        curIdx = MACOS_ORDER.indexOf(macosId);
      if (curIdx > minIdx) return false;
    }
    if (k.always_required) return true;
    if (k.match_gpu_vendor && k.match_gpu_vendor.includes(hw.gpuVendor)) {
      if (!(k.exclude_gpu_ids || []).includes(hw.gpuId)) return true;
    }
    if (k.match_gpu_ids && hw.gpuId && k.match_gpu_ids.includes(hw.gpuId))
      return true;
    if (k.match_cpu_vendor && k.match_cpu_vendor === hw.cpuVendor) return true;
    if (
      k.match_intel_gen_min &&
      hw.cpuVendor === "Intel" &&
      hw.cpuGen >= k.match_intel_gen_min
    )
      return true;
    if (k.match_has_audio && hw.audioChip) return true;
    if (k.match_wifi_vendor && k.match_wifi_vendor === hw.wifiVendor)
      return true;
    if (
      k.match_ethernet_vendor &&
      k.match_ethernet_vendor === hw.ethernetVendor
    )
      return true;
    if (
      k.match_ethernet_regex &&
      hw.ethernetChip &&
      new RegExp(k.match_ethernet_regex, "i").test(hw.ethernetChip)
    )
      return true;
    if (k.match_is_laptop && hw.isLaptop) return true;
    if (k.match_is_desktop && !hw.isLaptop) return true;
    if (k.match_has_nvme && hw.hasNVMe) return true;
    if (
      k.match_brand_regex &&
      hw.brand &&
      new RegExp(k.match_brand_regex, "i").test(hw.brand)
    )
      return true;
    if (k.match_macos && k.match_macos.includes(macosId)) return true;
    return false;
  });
}

let fileContent = null;
const analyzeBtn = document.getElementById("analyzeBtn");
const clearBtn = document.getElementById("clearBtn");
const dropZone = document.getElementById("dropZone");
const fileInput = document.getElementById("fileInput");

dropZone.addEventListener("click", () => fileInput.click());
dropZone.addEventListener("dragover", (e) => {
  e.preventDefault();
  dropZone.classList.add("dragover");
});
dropZone.addEventListener("dragleave", () =>
  dropZone.classList.remove("dragover"),
);
dropZone.addEventListener("drop", (e) => {
  e.preventDefault();
  dropZone.classList.remove("dragover");
  if (e.dataTransfer.files[0]) loadFile(e.dataTransfer.files[0]);
});
fileInput.addEventListener("change", () => {
  if (fileInput.files[0]) loadFile(fileInput.files[0]);
});

function loadFile(file) {
  if (!file.name.endsWith(".txt")) {
    showError("Please upload a .txt file from dxdiag.");
    return;
  }
  ((new FileReader().onload = (e) => {
    fileContent = e.target.result;
    dropZone.classList.add("has-file");
    document.getElementById("dropTitle").textContent = "✓ " + file.name;
    document.getElementById("dropSub").textContent =
      (file.size / 1024).toFixed(1) + " KB — ready to analyze";
    if (DB) analyzeBtn.disabled = false;
    clearBtn.style.display = "";
    hideError();
  }),
    new FileReader().readAsText(file));
  // fix: proper reader
  const reader = new FileReader();
  reader.onload = (e) => {
    fileContent = e.target.result;
    dropZone.classList.add("has-file");
    document.getElementById("dropTitle").textContent = "✓ " + file.name;
    document.getElementById("dropSub").textContent =
      (file.size / 1024).toFixed(1) + " KB — ready to analyze";
    if (DB) analyzeBtn.disabled = false;
    clearBtn.style.display = "";
    hideError();
  };
  reader.readAsText(file);
}

function analyze() {
  if (!fileContent || !DB) return;
  document.getElementById("loading").classList.add("visible");
  document.getElementById("results").classList.remove("visible");
  document.getElementById("warnBox").classList.remove("visible");
  hideError();
  setTimeout(() => {
    try {
      const hw = parseDxdiag(fileContent);
      renderResults(hw);
    } catch (e) {
      showError(
        "Could not parse the file. Make sure it is a valid dxdiag output.",
      );
      console.error(e);
    }
    document.getElementById("loading").classList.remove("visible");
  }, 500);
}

function renderResults(hw) {
  document.getElementById("summaryGrid").innerHTML = [
    {
      label: "System",
      value: [hw.brand, hw.model].filter(Boolean).join(" ") || "Unknown",
    },
    { label: "Type", value: hw.isLaptop ? "💻 Laptop" : "🖥️ Desktop" },
    { label: "CPU", value: hw.cpuName || "Unknown" },
    { label: "CPU Vendor", value: hw.cpuVendor || "Unknown" },
    { label: "RAM", value: hw.ramGB ? hw.ramGB + " GB" : "Unknown" },
    { label: "GPU", value: hw.gpuName || "Unknown" },
    {
      label: "Wi-Fi",
      value:
        hw.wifiChip ||
        (hw.wifiVendor ? hw.wifiVendor + " (chip unknown)" : "Not detected"),
    },
    {
      label: "Ethernet",
      value:
        hw.ethernetChip ||
        (hw.ethernetVendor
          ? hw.ethernetVendor + " (chip unknown)"
          : "Not detected"),
    },
    { label: "Audio", value: hw.audioChip || "Not detected" },
    { label: "NVMe", value: hw.hasNVMe ? "Detected" : "Not detected" },
  ]
    .map(
      (i) =>
        '<div class="summary-card"><div class="summary-label">' +
        i.label +
        '</div><div class="summary-value">' +
        i.value +
        "</div></div>",
    )
    .join("");

  const warnings = [];
  if (hw.gpuId === "nvidia_turing_plus")
    warnings.push(
      "RTX / GTX 16xx GPUs have zero macOS support. No drivers exist.",
    );
  if (hw.gpuId === "nvidia_maxwell_pascal")
    warnings.push(
      "GTX 900/1000 only works on High Sierra and Mojave via NVIDIA Web Drivers. Dead on Catalina+.",
    );
  if (hw.gpuId === "intel_iris_xe")
    warnings.push(
      "Intel Iris Xe / UHD 750 (11th gen+) has NO iGPU acceleration on any macOS. Must use a supported AMD dGPU.",
    );
  if (hw.cpuVendor === "AMD")
    warnings.push(
      "AMD CPUs require AMD-OSX kernel patches in config.plist. Follow the Dortania AMD guide.",
    );
  if (!hw.wifiVendor)
    warnings.push(
      "No Wi-Fi card detected. Consider an Intel AX200/AX210 or Broadcom BCM94360.",
    );
  const wb = document.getElementById("warnBox");
  if (warnings.length) {
    wb.innerHTML =
      "⚠️ <strong>Important notes:</strong><ul>" +
      warnings.map((w) => "<li>" + w + "</li>").join("") +
      "</ul>";
    wb.classList.add("visible");
  }

  const versions = getMacosCompatibility(hw);
  const firstGood = versions.find(
    (v) => v.status === "supported" || v.status === "oclp",
  );
  if (firstGood) firstGood.status = "recommended";
  const selectedMacosId = firstGood ? firstGood.id : "sequoia";

  document.getElementById("macosRow").innerHTML = versions
    .map((ver) => {
      let tc, tt, bc;
      if (ver.status === "recommended") {
        tc = "rec";
        tt = "Recommended";
        bc = "recommended";
      } else if (ver.status === "oclp") {
        tc = "oclp";
        tt = "Needs OCLP";
        bc = "";
      } else if (ver.status === "unsupported") {
        tc = "no";
        tt = ver.reason || "Not supported";
        bc = "unsupported";
      } else {
        tc = "ok";
        tt = "Supported";
        bc = "";
      }
      const extra =
        ver.reason && ver.status !== "unsupported"
          ? '<div style="font-size:10px;color:#555;margin-top:4px">' +
            ver.reason +
            "</div>"
          : "";
      return (
        '<div class="macos-badge ' +
        bc +
        '"><div class="macos-name">' +
        ver.name +
        '</div><div class="macos-version">macOS ' +
        ver.version +
        '</div><span class="macos-tag ' +
        tc +
        '">' +
        tt +
        "</span>" +
        extra +
        "</div>"
      );
    })
    .join("");

  const kexts = getKexts(hw, selectedMacosId);
  const byCategory = {};
  for (const k of kexts) {
    const c = k.category || "Other";
    if (!byCategory[c]) byCategory[c] = [];
    byCategory[c].push(k);
  }
  const catOrder = [
    "Essential",
    "CPU",
    "GPU",
    "Audio",
    "Wi-Fi",
    "Bluetooth",
    "Ethernet",
    "USB",
    "Input",
    "Battery",
    "Storage",
    "Sensors",
    "Fixes",
  ];
  const sorted = Object.keys(byCategory).sort((a, b) => {
    const ai = catOrder.indexOf(a),
      bi = catOrder.indexOf(b);
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
            '<div class="kext-card"><div class="kext-header"><span class="kext-name">' +
            k.name +
            '</span><span class="kext-priority ' +
            k.priority +
            '">' +
            k.priority +
            '</span></div><p class="kext-desc">' +
            k.description +
            "</p>" +
            note +
            '<a href="' +
            k.github +
            '" target="_blank" rel="noopener noreferrer" class="kext-link">GitHub ↗</a></div>'
          );
        })
        .join("");
      return (
        '<div class="kext-section"><div class="kext-section-title">' +
        cat +
        '</div><div class="kext-grid">' +
        cards +
        "</div></div>"
      );
    })
    .join("");

  document.getElementById("results").classList.add("visible");
}

function clearAll() {
  fileContent = null;
  fileInput.value = "";
  dropZone.classList.remove("has-file");
  document.getElementById("dropTitle").textContent =
    "Drop your dxdiag.txt here";
  document.getElementById("dropSub").textContent =
    "or click to browse — Windows only, run via Win+R → dxdiag → Save All Information";
  analyzeBtn.disabled = true;
  clearBtn.style.display = "none";
  document.getElementById("results").classList.remove("visible");
  document.getElementById("warnBox").classList.remove("visible");
  hideError();
}
function showError(msg) {
  const b = document.getElementById("errorBox");
  b.textContent = msg;
  b.classList.add("visible");
}
function hideError() {
  document.getElementById("errorBox").classList.remove("visible");
}

loadDatabase();
