const DANGER_EXTS = new Set(['.exe','.bat','.cmd','.com','.scr','.pif','.msi','.ps1','.psm1','.vbs','.vbe','.jse','.wsf','.wsh','.reg','.hta','.lnk','.jar','.app','.deb','.rpm','.dmg','.sh','.bash','.zsh','.fish','.elf']);
const WARN_EXTS   = new Set(['.docm','.xlsm','.pptm','.dotm','.xltm','.potm','.xlam','.doc','.xls','.ppt','.iso','.img','.dll','.so','.dylib','.sys','.drv']);
const IMAGE_EXTS  = new Set(['.png','.jpg','.jpeg','.gif','.webp','.svg','.bmp','.ico']);
const TEXT_EXTS   = new Set(['.txt','.md','.json','.xml','.csv','.html','.htm','.css','.js','.ts','.sh','.bash','.py','.rb','.rs','.go','.c','.cpp','.h','.java','.kt','.swift','.yaml','.yml','.toml','.ini','.cfg','.conf','.log','.env','.gitignore','.sql','.php','.lua','.ps1','.vbs','.bat','.cmd','.jsx','.tsx','.vue','.scss','.sass','.less','.fish','.zsh']);

function ext(name)  { const i = name.lastIndexOf('.'); return i >= 0 ? name.slice(i).toLowerCase() : ''; }
function formatSize(b) {
  if (!b || b === 0) return '0 B';
  if (b < 1024) return b + ' B';
  if (b < 1048576) return (b/1024).toFixed(1) + ' KB';
  return (b/1048576).toFixed(2) + ' MB';
}
function fileIcon(name, isDir) {
  if (isDir) return '📁';
  const e = ext(name);
  if (IMAGE_EXTS.has(e)) return '🖼️';
  if (TEXT_EXTS.has(e))  return '📄';
  if (e === '.pdf')       return '📕';
  if (['.zip','.tar','.gz','.rar','.7z','.bz2'].includes(e)) return '🗜️';
  if (DANGER_EXTS.has(e)) return '⚠️';
  return '📦';
}
function threatLevel(name) {
  const e = ext(name);
  if (DANGER_EXTS.has(e)) return 'danger';
  if (WARN_EXTS.has(e))   return 'warn';
  return 'ok';
}
function hasTraversal(path) { return path.includes('../') || path.includes('..\\'); }
async function sha256(data) {
  const buf = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,'0')).join('');
}

let allEntries  = [];
let selectedPath = null;
let isMobile    = () => window.innerWidth <= 700;

const dropZone     = document.getElementById('dropZone');
const fileInput    = document.getElementById('fileInput');
const warnBox      = document.getElementById('warnBox');
const warnList     = document.getElementById('warnList');
const statsRow     = document.getElementById('statsRow');
const mainLayout   = document.getElementById('mainLayout');
const mobileTabs   = document.getElementById('mobileTabs');
const noteBox      = document.getElementById('noteBox');
const fileTree     = document.getElementById('fileTree');
const treeLoader   = document.getElementById('treeLoader');
const treeCount    = document.getElementById('treeCount');
const filterInput  = document.getElementById('filterInput');
const previewPanel = document.getElementById('previewPanel');
const previewExt   = document.getElementById('previewExt');
const resetBtn     = document.getElementById('resetBtn');
const treePanel    = document.getElementById('treePanel');
const previewPanelWrapper = document.getElementById('previewPanelWrapper');

const statName       = document.getElementById('statName');
const statSize       = document.getElementById('statSize');
const statEntries    = document.getElementById('statEntries');
const statSuspicious = document.getElementById('statSuspicious');
const statEncrypted  = document.getElementById('statEncrypted');

// ── Mobile tab switching ──
function switchTab(tab) {
  document.getElementById('tabTree').classList.toggle('active', tab === 'tree');
  document.getElementById('tabPreview').classList.toggle('active', tab === 'preview');
  treePanel.classList.toggle('mobile-hidden', tab !== 'tree');
  previewPanelWrapper.classList.toggle('mobile-active', tab === 'preview');
  if (tab === 'preview') previewPanelWrapper.style.display = 'block';
  else previewPanelWrapper.style.display = '';
}

// ── Drag events ──
dropZone.addEventListener('dragover',  e => { e.preventDefault(); dropZone.classList.add('dragover'); });
dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
dropZone.addEventListener('drop', e => {
  e.preventDefault(); dropZone.classList.remove('dragover');
  if (e.dataTransfer.files[0]) loadFile(e.dataTransfer.files[0]);
});
dropZone.addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', e => { if (e.target.files[0]) loadFile(e.target.files[0]); });
filterInput.addEventListener('input', () => renderTree(filterInput.value.toLowerCase()));
resetBtn.addEventListener('click', reset);

function showStatsRow() {
  statsRow.style.display = 'flex';
  requestAnimationFrame(() => { statsRow.classList.add('visible'); });
}

function reset() {
  allEntries = []; selectedPath = null;
  dropZone.classList.remove('has-file');
  statsRow.classList.remove('visible');
  setTimeout(() => { statsRow.style.display = 'none'; }, 350);
  mainLayout.classList.remove('visible');
  setTimeout(() => { mainLayout.classList.add('hidden'); }, 400);
  noteBox.classList.add('hidden');
  warnBox.classList.remove('visible');
  mobileTabs.classList.add('hidden');
  fileInput.value = '';
  filterInput.value = '';
  dropZone.querySelector('.drop-title').textContent = 'Drop a .zip file here';
  dropZone.querySelector('.drop-sub').textContent = 'or click to browse';
}

// ── Skeleton loaders ──
function showSkeletons(n = 8) {
  fileTree.innerHTML = '';
  fileTree.appendChild(treeLoader);
  treeLoader.classList.add('visible');
  for (let i = 0; i < n; i++) {
    const row = document.createElement('div');
    row.className = 'skeleton-row';
    row.style.animationDelay = (i * 0.04) + 's';
    row.innerHTML = `
      <span class="skeleton skeleton-icon"></span>
      <span class="skeleton skeleton-name" style="width:${50 + Math.random()*35}%"></span>
      <span class="skeleton skeleton-size"></span>`;
    fileTree.appendChild(row);
  }
}

async function loadFile(file) {
  if (!file.name.toLowerCase().endsWith('.zip')) { alert('Please select a .zip file.'); return; }

  dropZone.classList.add('has-file');
  dropZone.querySelector('.drop-title').textContent = file.name;
  dropZone.querySelector('.drop-sub').textContent = formatSize(file.size);

  statName.textContent = file.name;
  statSize.textContent = formatSize(file.size);
  statEntries.textContent = '...';
  statSuspicious.textContent = '...';
  statEncrypted.textContent = '...';
  showStatsRow();

  mainLayout.classList.remove('hidden');
  requestAnimationFrame(() => { mainLayout.classList.add('visible'); });
  noteBox.classList.remove('hidden');

  if (isMobile()) {
    mobileTabs.classList.remove('hidden');
    switchTab('tree');
  }

  showSkeletons(10);
  previewPanel.innerHTML = '<div class="preview-empty"><span class="preview-empty-icon">⏳</span>Loading...</div>';

  try {
    const buf = await file.arrayBuffer();
    const zip = await JSZip.loadAsync(buf);
    allEntries = [];
    zip.forEach((path, entry) => allEntries.push({ path, entry }));
    allEntries.sort((a, b) => {
      if (a.entry.dir && !b.entry.dir) return -1;
      if (!a.entry.dir && b.entry.dir) return 1;
      return a.path.localeCompare(b.path);
    });

    const files      = allEntries.filter(e => !e.entry.dir);
    const suspicious = files.filter(e => threatLevel(e.path) !== 'ok' || hasTraversal(e.path));
    const encrypted  = files.filter(e => e.entry._data?.flags && (e.entry._data.flags & 0x1));

    // Animate stat values in
    setTimeout(() => { statEntries.textContent = files.length; statEntries.style.animation = 'none'; requestAnimationFrame(() => { statEntries.style.animation = ''; }); }, 50);
    setTimeout(() => {
      statSuspicious.textContent = suspicious.length;
      statSuspicious.className   = 'stat-value ' + (suspicious.length > 0 ? 'danger' : 'ok');
    }, 120);
    setTimeout(() => {
      statEncrypted.textContent = encrypted.length;
      statEncrypted.className   = 'stat-value ' + (encrypted.length > 0 ? 'warn' : 'ok');
    }, 190);

    // Warnings
    const warns = [];
    const dangerFiles = suspicious.filter(e => threatLevel(e.path) === 'danger');
    if (dangerFiles.length > 0)
      warns.push('Executable or script files detected: ' + dangerFiles.map(e => e.path.split('/').pop()).slice(0,3).join(', ') + (dangerFiles.length > 3 ? '...' : ''));
    if (suspicious.filter(e => threatLevel(e.path) === 'warn').length > 0)
      warns.push('Macro-enabled Office documents detected');
    if (allEntries.some(e => hasTraversal(e.path)))
      warns.push('Path traversal patterns found (../) — potential zip-slip attack');
    if (encrypted.length > 0)
      warns.push(encrypted.length + ' encrypted file(s) cannot be inspected');

    if (warns.length > 0) {
      warnList.innerHTML = warns.map(w => `<li>${w}</li>`).join('');
      setTimeout(() => { warnBox.classList.add('visible'); }, 300);
    } else {
      warnBox.classList.remove('visible');
    }

    treeLoader.classList.remove('visible');
    renderTree('');
    previewPanel.innerHTML = '<div class="preview-empty"><span class="preview-empty-icon">👆</span>Select a file to preview</div>';
    previewExt.textContent = '';

  } catch(err) {
    treeLoader.classList.remove('visible');
    fileTree.innerHTML = `<div style="padding:14px;color:var(--red);font-size:12px;">Failed to read archive: ${err.message}</div>`;
  }
}

function renderTree(filter) {
  [...fileTree.children].forEach(c => { if (c !== treeLoader) c.remove(); });

  const shown = allEntries.filter(e => !filter || e.path.toLowerCase().includes(filter));
  treeCount.textContent = shown.filter(e => !e.entry.dir).length + ' files';

  if (shown.length === 0) {
    const el = document.createElement('div');
    el.style.cssText = 'padding:14px;color:var(--tx-dimmer);font-size:12px;text-align:center;';
    el.textContent = 'No results.';
    fileTree.appendChild(el);
    return;
  }

  shown.forEach(({ path, entry }, i) => {
    const el = document.createElement('div');
    el.className = 'tree-entry' + (entry.dir ? ' is-dir' : '');
    if (!entry.dir && path === selectedPath) el.classList.add('active');
    el.style.animationDelay = Math.min(i * 0.025, 0.4) + 's';

    const parts = path.replace(/\/$/, '').split('/');
    const depth = parts.length - 1;
    const label = parts[parts.length - 1] || path;

    const icon = document.createElement('span');
    icon.className = 'tree-icon';
    icon.textContent = fileIcon(path, entry.dir);

    const name = document.createElement('span');
    name.className = 'tree-name';
    name.style.paddingLeft = (depth * 12) + 'px';
    name.textContent = label;
    name.title = path;

    el.appendChild(icon);
    el.appendChild(name);

    if (!entry.dir) {
      const sz = document.createElement('span');
      sz.className = 'tree-size';
      sz.textContent = formatSize(entry._data?.uncompressedSize || 0);
      el.appendChild(sz);

      const lvl    = threatLevel(path);
      const isTrav = hasTraversal(path);
      const isEnc  = entry._data?.flags && (entry._data.flags & 0x1);

      if (lvl === 'danger' || isTrav) {
        const b = document.createElement('span');
        b.className = 'badge red';
        b.textContent = isTrav ? 'traversal' : 'danger';
        el.appendChild(b);
      } else if (lvl === 'warn') {
        const b = document.createElement('span');
        b.className = 'badge amber';
        b.textContent = 'macro';
        el.appendChild(b);
      }
      if (isEnc) {
        const b = document.createElement('span');
        b.className = 'badge blue';
        b.textContent = 'enc';
        el.appendChild(b);
      }

      el.addEventListener('click', () => {
        document.querySelectorAll('.tree-entry.active').forEach(x => x.classList.remove('active'));
        el.classList.add('active');
        selectedPath = path;
        showPreview(path, entry);
        if (isMobile()) switchTab('preview');
      });
    }

    fileTree.appendChild(el);
  });
}

async function showPreview(path, entry) {
  const e = ext(path);
  previewExt.textContent = e.replace('.','').toUpperCase() || 'FILE';
  previewPanel.innerHTML = '<div class="loading visible" style="padding:20px 14px;"><span class="spinner"></span>Computing hash...</div>';

  const uncompressed = entry._data?.uncompressedSize || 0;
  const isEnc  = entry._data?.flags && (entry._data.flags & 0x1);
  const lvl    = threatLevel(path);
  const isTrav = hasTraversal(path);
  const date   = entry.date ? entry.date.toLocaleString() : 'unknown';

  let hash = 'N/A';
  if (!isEnc) {
    try {
      const buf = await entry.async('arraybuffer');
      hash = await sha256(buf);
    } catch(_) {}
  }

  let html = `<div class="preview-body">`;
  html += `<div class="preview-path">${path}</div>`;
  html += `<div class="preview-meta">`;
  html += `<div class="meta-row"><span class="meta-k">Size</span><span class="meta-v">${formatSize(uncompressed)}</span></div>`;
  html += `<div class="meta-row"><span class="meta-k">Modified</span><span class="meta-v">${date}</span></div>`;
  html += `<div class="meta-row"><span class="meta-k">SHA-256</span><span class="meta-v hash">${hash}</span></div>`;
  html += `</div>`;

  const flags = [];
  if (lvl === 'danger') flags.push({ cls: 'danger', text: 'Dangerous file type — do not execute' });
  if (lvl === 'warn')   flags.push({ cls: '',       text: 'May contain macros or embedded scripts' });
  if (isTrav)           flags.push({ cls: 'danger', text: 'Path traversal detected (../) — zip-slip risk' });
  if (isEnc)            flags.push({ cls: '',       text: 'File is encrypted — content cannot be inspected' });

  if (flags.length) {
    html += `<div class="preview-flags">`;
    flags.forEach((f, i) => {
      html += `<div class="flag-row ${f.cls}" style="animation-delay:${i*0.07}s">&#9888; ${f.text}</div>`;
    });
    html += `</div>`;
  }

  html += `<div id="previewContent"></div></div>`;
  previewPanel.innerHTML = html;

  const contentEl = document.getElementById('previewContent');

  if (isEnc) {
    contentEl.innerHTML = `<div class="preview-na">🔒 Encrypted — content unavailable</div>`;
    return;
  }

  if (IMAGE_EXTS.has(e) && uncompressed < 5 * 1024 * 1024) {
    try {
      const blob = await entry.async('blob');
      const url  = URL.createObjectURL(blob);
      contentEl.innerHTML = `<img class="preview-img" src="${url}" alt="${path}" />`;
    } catch(_) { contentEl.innerHTML = `<div class="preview-na">Could not decode image.</div>`; }
  } else if (TEXT_EXTS.has(e) && uncompressed < 200 * 1024) {
    try {
      const text    = await entry.async('string');
      const escaped = text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
      contentEl.innerHTML = `<pre class="preview-code">${escaped}</pre>`;
    } catch(_) { contentEl.innerHTML = `<div class="preview-na">Could not decode text.</div>`; }
  } else if (TEXT_EXTS.has(e)) {
    contentEl.innerHTML = `<div class="preview-na">File too large to preview (${formatSize(uncompressed)}).</div>`;
  } else {
    contentEl.innerHTML = `<div class="preview-na">No preview available for this file type.</div>`;
  }
}
