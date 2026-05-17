let files = [];
let originalAspects = [];

const dropZone = document.getElementById('dropZone');
const fileInput = document.getElementById('fileInput');

dropZone.addEventListener('click', () => fileInput.click());
dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('dragover'); });
dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
dropZone.addEventListener('drop', e => {
  e.preventDefault(); dropZone.classList.remove('dragover');
  loadFiles([...e.dataTransfer.files]);
});
fileInput.addEventListener('change', () => loadFiles([...fileInput.files]));

function loadFiles(newFiles) {
  const valid = newFiles.filter(f => f.type.match(/image\/(jpeg|png|webp)/));
  if (!valid.length) return;
  files = valid.slice(0, 20);
  originalAspects = [];

  let loaded = 0;
  files.forEach((f, i) => {
    const img = new Image();
    const url = URL.createObjectURL(f);
    img.onload = () => {
      originalAspects[i] = img.width / img.height;
      URL.revokeObjectURL(url);
      loaded++;
      if (loaded === files.length) {
        document.getElementById('resizeW').value = img.width;
        document.getElementById('resizeH').value = img.height;
      }
    };
    img.src = url;
  });

  dropZone.querySelector('.drop-title').textContent = `${files.length} image${files.length > 1 ? 's' : ''} ready`;
  dropZone.querySelector('.drop-sub').textContent = files.map(f => f.name).join(', ').substring(0, 80) + (files.length > 2 ? '...' : '');
  document.getElementById('controlsCard').classList.add('visible');
  document.getElementById('results').classList.remove('visible');
  document.getElementById('results').innerHTML = '';
}

function onWidthChange() {
  if (!document.getElementById('lockAspect').checked || !originalAspects[0]) return;
  const w = parseInt(document.getElementById('resizeW').value);
  if (w) document.getElementById('resizeH').value = Math.round(w / originalAspects[0]);
}
function onHeightChange() {
  if (!document.getElementById('lockAspect').checked || !originalAspects[0]) return;
  const h = parseInt(document.getElementById('resizeH').value);
  if (h) document.getElementById('resizeW').value = Math.round(h * originalAspects[0]);
}

function compressFile(file, targetW, targetH, quality, formatOut) {
  return new Promise(resolve => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const w = targetW || img.width;
      const h = targetH || img.height;
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(url);

      const mime = formatOut === 'same'
        ? (file.type === 'image/png' ? 'image/png' : file.type === 'image/webp' ? 'image/webp' : 'image/jpeg')
        : formatOut;

      canvas.toBlob(blob => {
        resolve({ blob, mime, w, h, origW: img.width, origH: img.height });
      }, mime, quality / 100);
    };
    img.src = url;
  });
}

async function compressAll() {
  if (!files.length) return;

  const quality = parseInt(document.getElementById('qualitySlider').value);
  const formatOut = document.getElementById('formatOut').value;
  const targetW = parseInt(document.getElementById('resizeW').value) || null;
  const targetH = parseInt(document.getElementById('resizeH').value) || null;

  document.getElementById('loading').classList.add('visible');
  document.querySelector('.btn-main').disabled = true;

  const results = [];
  for (const file of files) {
    const result = await compressFile(file, targetW, targetH, quality, formatOut);
    results.push({ file, ...result });
  }

  document.getElementById('loading').classList.remove('visible');
  document.querySelector('.btn-main').disabled = false;
  renderResults(results);
}

function renderResults(results) {
  const container = document.getElementById('results');
  container.classList.add('visible');

  const totalOrig = results.reduce((s, r) => s + r.file.size, 0);
  const totalNew = results.reduce((s, r) => s + r.blob.size, 0);
  const savedPct = Math.round((1 - totalNew / totalOrig) * 100);
  const isBad = savedPct < 0;

  if (results.length === 1) {
    const r = results[0];
    const origUrl = URL.createObjectURL(r.file);
    const newUrl = URL.createObjectURL(r.blob);
    const ext = r.mime.split('/')[1];
    const newName = r.file.name.replace(/\.[^.]+$/, '') + '_compressed.' + ext;

    container.innerHTML = `
      <div class="section-head"><h2>Result</h2><span>before vs after</span></div>
      <div class="compare-grid">
        <div class="compare-card">
          <img src="${origUrl}" class="compare-img" alt="Original">
          <div class="compare-body">
            <div class="compare-label">Original</div>
            <div class="compare-size">${fmtSize(r.file.size)}</div>
            <div class="compare-dims">${r.origW} × ${r.origH}px · ${r.file.type.split('/')[1].toUpperCase()}</div>
          </div>
        </div>
        <div class="compare-card">
          <img src="${newUrl}" class="compare-img" alt="Compressed">
          <div class="compare-body">
            <div class="compare-label">Compressed</div>
            <div class="compare-size">${fmtSize(r.blob.size)}</div>
            <div class="compare-dims">${r.w} × ${r.h}px · ${ext.toUpperCase()}</div>
          </div>
        </div>
      </div>
      ${savingsBar(savedPct, totalOrig, totalNew)}
      <div class="btn-row" style="margin-top:16px">
        <button class="btn-dl" onclick="downloadBlob(window._blobs[0], '${newName}')">Download ${newName}</button>
      </div>
    `;
    window._blobs = [r.blob];
  } else {
    window._blobs = results.map(r => r.blob);
    const items = results.map((r, i) => {
      const ext = r.mime.split('/')[1];
      const newName = r.file.name.replace(/\.[^.]+$/, '') + '_compressed.' + ext;
      const pct = Math.round((1 - r.blob.size / r.file.size) * 100);
      return `<div class="batch-item">
        <div class="batch-name" title="${r.file.name}">${r.file.name}</div>
        <div class="batch-stats">
          <span class="batch-size-orig">${fmtSize(r.file.size)}</span>
          <span>→</span>
          <span class="batch-size-new">${fmtSize(r.blob.size)}</span>
          <span class="batch-pct" style="color:${pct<0?'#f87171':'#4ade80'}">${pct>0?'-'+pct+'%':'+'+Math.abs(pct)+'%'}</span>
          <button class="btn-dl-sm" onclick="downloadBlob(window._blobs[${i}],'${newName}')">Download</button>
        </div>
      </div>`;
    }).join('');

    container.innerHTML = `
      <div class="section-head"><h2>Results</h2><span>${results.length} files compressed</span></div>
      ${savingsBar(savedPct, totalOrig, totalNew)}
      <div class="batch-list" style="margin-top:16px">${items}</div>
      <div class="btn-row" style="margin-top:16px">
        <button class="btn-dl" onclick="downloadAll()">Download All</button>
      </div>
    `;
  }
}

function savingsBar(pct, orig, newSize) {
  const isBad = pct < 0;
  const fillW = Math.min(100, Math.abs(pct));
  const saved = Math.abs(orig - newSize);
  return `<div class="savings-card">
    <div class="savings-header">
      <span class="savings-title">${isBad ? 'Size increased' : 'Space saved'}</span>
      <span class="savings-pct ${isBad?'bad':''}">${isBad?'+':'-'}${Math.abs(pct)}%</span>
    </div>
    <div class="savings-bar-bg"><div class="savings-bar-fill ${isBad?'bad':''}" style="width:${fillW}%"></div></div>
    <div class="savings-sub">${fmtSize(orig)} → ${fmtSize(newSize)} · ${isBad?'increased':'saved'} ${fmtSize(saved)}</div>
  </div>`;
}

function downloadBlob(blob, name) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function downloadAll() {
  for (let i = 0; i < window._blobs.length; i++) {
    const r_file = files[i];
    const blob = window._blobs[i];
    const ext = blob.type.split('/')[1];
    const name = r_file.name.replace(/\.[^.]+$/, '') + '_compressed.' + ext;
    downloadBlob(blob, name);
    await new Promise(r => setTimeout(r, 300));
  }
}

function fmtSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
}

function resetAll() {
  files = []; originalAspects = [];
  fileInput.value = '';
  dropZone.querySelector('.drop-title').textContent = 'Drop images here';
  dropZone.querySelector('.drop-sub').textContent = 'or click to browse — JPEG, PNG, WebP · up to 20 files';
  document.getElementById('controlsCard').classList.remove('visible');
  document.getElementById('results').classList.remove('visible');
  document.getElementById('results').innerHTML = '';
  document.getElementById('resizeW').value = '';
  document.getElementById('resizeH').value = '';
}
