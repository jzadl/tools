let state = {
  type: 'linear',
  angle: 135,
  conicAngle: 0,
  shape: 'circle',
  radialX: 50,
  radialY: 50,
  stops: [
    { id: 1, color: '#3b82f6', alpha: 1, pos: 0 },
    { id: 2, color: '#a855f7', alpha: 1, pos: 50 },
    { id: 3, color: '#ec4899', alpha: 1, pos: 100 },
  ],
  selectedStop: 1,
  nextId: 4,
};

const PRESETS = [
  [{ c:'#667eea', p:0 }, { c:'#764ba2', p:100 }],
  [{ c:'#f093fb', p:0 }, { c:'#f5576c', p:100 }],
  [{ c:'#4facfe', p:0 }, { c:'#00f2fe', p:100 }],
  [{ c:'#43e97b', p:0 }, { c:'#38f9d7', p:100 }],
  [{ c:'#fa709a', p:0 }, { c:'#fee140', p:100 }],
  [{ c:'#a18cd1', p:0 }, { c:'#fbc2eb', p:100 }],
  [{ c:'#ff9a9e', p:0 }, { c:'#fecfef', p:50 }, { c:'#fecfef', p:100 }],
  [{ c:'#0f2027', p:0 }, { c:'#203a43', p:50 }, { c:'#2c5364', p:100 }],
  [{ c:'#fc466b', p:0 }, { c:'#3f5efb', p:100 }],
  [{ c:'#11998e', p:0 }, { c:'#38ef7d', p:100 }],
  [{ c:'#f7971e', p:0 }, { c:'#ffd200', p:100 }],
  [{ c:'#ee0979', p:0 }, { c:'#ff6a00', p:100 }],
];

function buildGradientCSS() {
  const sorted = [...state.stops].sort((a, b) => a.pos - b.pos);
  const stopsStr = sorted.map(s => {
    const hex = s.color;
    const r = parseInt(hex.slice(1,3),16);
    const g = parseInt(hex.slice(3,5),16);
    const b = parseInt(hex.slice(5,7),16);
    const col = s.alpha < 1 ? `rgba(${r},${g},${b},${s.alpha.toFixed(2)})` : hex;
    return `${col} ${s.pos}%`;
  }).join(', ');

  if (state.type === 'linear') {
    return `linear-gradient(${state.angle}deg, ${stopsStr})`;
  } else if (state.type === 'radial') {
    return `radial-gradient(${state.shape} at ${state.radialX}% ${state.radialY}%, ${stopsStr})`;
  } else {
    return `conic-gradient(from ${state.conicAngle}deg at ${state.radialX}% ${state.radialY}%, ${stopsStr})`;
  }
}

function render() {
  const css = buildGradientCSS();

  document.getElementById('previewGradient').style.background = css;

  const handle = document.getElementById('radialHandle');
  if (state.type === 'radial' || state.type === 'conic') {
    handle.style.display = 'block';
    handle.style.left = state.radialX + '%';
    handle.style.top = state.radialY + '%';
  } else {
    handle.style.display = 'none';
  }

  const full = `background: ${css};`;
  document.getElementById('cssCode').textContent = full;

  const barCSS = `linear-gradient(to right, ${[...state.stops].sort((a,b)=>a.pos-b.pos).map(s=>`${s.color} ${s.pos}%`).join(', ')})`;
  document.getElementById('stopBarBg').style.background = barCSS;

  const wrap = document.getElementById('stopBarWrap');
  wrap.querySelectorAll('.stop-handle').forEach(h => h.remove());
  state.stops.forEach(stop => {
    const h = document.createElement('div');
    h.className = 'stop-handle' + (stop.id === state.selectedStop ? ' selected' : '');
    h.style.left = stop.pos + '%';
    h.style.background = stop.color;
    h.dataset.id = stop.id;
    makeDraggableStop(h, stop);
    wrap.appendChild(h);
  });

  renderStopList();
}

function renderStopList() {
  const list = document.getElementById('stopList');
  const sorted = [...state.stops].sort((a,b) => a.pos - b.pos);
  list.innerHTML = '';
  sorted.forEach(stop => {
    const item = document.createElement('div');
    item.className = 'stop-item' + (stop.id === state.selectedStop ? ' selected' : '');
    item.onclick = () => { state.selectedStop = stop.id; render(); };
    item.innerHTML = `
      <div class="stop-swatch" onclick="event.stopPropagation()">
        <div class="stop-swatch-fill" style="background:${stop.color}"></div>
        <input type="color" value="${stop.color}" oninput="updateStopColor(${stop.id}, this.value)">
      </div>
      <div class="stop-info">
        <div class="stop-hex">${stop.color.toUpperCase()}</div>
        <input class="stop-pos-input" type="number" min="0" max="100" value="${stop.pos}"
          onclick="event.stopPropagation()"
          oninput="updateStopPos(${stop.id}, this.value)">%
      </div>
      <button class="stop-delete" onclick="event.stopPropagation(); deleteStop(${stop.id})" title="Remove">×</button>
    `;
    list.appendChild(item);
  });
}

function addStop() {
  const sorted = [...state.stops].sort((a,b) => a.pos - b.pos);
  let pos = 50;
  if (sorted.length >= 2) {
    const mid = sorted[Math.floor(sorted.length / 2)];
    const next = sorted[Math.floor(sorted.length / 2) + 1] || sorted[sorted.length - 1];
    pos = Math.round((mid.pos + next.pos) / 2);
  }
  const colors = ['#3b82f6','#a855f7','#ec4899','#22c55e','#f59e0b','#ef4444','#06b6d4','#8b5cf6'];
  state.stops.push({ id: state.nextId++, color: colors[Math.floor(Math.random() * colors.length)], alpha: 1, pos });
  render();
}

function deleteStop(id) {
  if (state.stops.length <= 2) return;
  state.stops = state.stops.filter(s => s.id !== id);
  if (state.selectedStop === id) state.selectedStop = state.stops[0].id;
  render();
}

function updateStopColor(id, color) {
  const s = state.stops.find(s => s.id === id);
  if (s) { s.color = color; render(); }
}

function updateStopPos(id, val) {
  const s = state.stops.find(s => s.id === id);
  if (s) { s.pos = Math.max(0, Math.min(100, parseInt(val) || 0)); render(); }
}

function makeDraggableStop(handle, stop) {
  let dragging = false;
  handle.addEventListener('mousedown', e => {
    e.preventDefault();
    state.selectedStop = stop.id;
    dragging = true;
    handle.classList.add('dragging');
    render();
  });
  handle.addEventListener('touchstart', e => {
    state.selectedStop = stop.id;
    dragging = true;
    handle.classList.add('dragging');
    render();
  }, { passive: true });

  const onMove = e => {
    if (!dragging) return;
    const wrap = document.getElementById('stopBarWrap');
    const rect = wrap.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    let pct = Math.round(((clientX - rect.left) / rect.width) * 100);
    pct = Math.max(0, Math.min(100, pct));
    const s = state.stops.find(s => s.id === stop.id);
    if (s) { s.pos = pct; render(); }
  };
  const onUp = () => { dragging = false; handle.classList.remove('dragging'); };

  document.addEventListener('mousemove', onMove);
  document.addEventListener('touchmove', onMove, { passive: true });
  document.addEventListener('mouseup', onUp);
  document.addEventListener('touchend', onUp);
}

document.getElementById('stopBarWrap').addEventListener('click', e => {
  if (e.target.classList.contains('stop-handle')) return;
  const rect = e.currentTarget.getBoundingClientRect();
  const pos = Math.round(((e.clientX - rect.left) / rect.width) * 100);
  const colors = ['#3b82f6','#a855f7','#ec4899','#22c55e','#f59e0b','#ef4444'];
  state.stops.push({ id: state.nextId++, color: colors[Math.floor(Math.random()*colors.length)], alpha: 1, pos });
  render();
});

const radialHandle = document.getElementById('radialHandle');
let radialDragging = false;

radialHandle.addEventListener('mousedown', e => { e.preventDefault(); radialDragging = true; radialHandle.classList.add('dragging'); });
radialHandle.addEventListener('touchstart', e => { radialDragging = true; radialHandle.classList.add('dragging'); }, { passive: true });

document.addEventListener('mousemove', e => {
  if (!radialDragging) return;
  moveRadial(e.clientX, e.clientY);
});
document.addEventListener('touchmove', e => {
  if (!radialDragging) return;
  moveRadial(e.touches[0].clientX, e.touches[0].clientY);
}, { passive: true });
document.addEventListener('mouseup', () => { radialDragging = false; radialHandle.classList.remove('dragging'); });
document.addEventListener('touchend', () => { radialDragging = false; radialHandle.classList.remove('dragging'); });

document.getElementById('previewArea').addEventListener('click', e => {
  if (state.type !== 'radial' && state.type !== 'conic') return;
  if (e.target === radialHandle) return;
  moveRadial(e.clientX, e.clientY);
});

function moveRadial(clientX, clientY) {
  const area = document.getElementById('previewArea');
  const rect = area.getBoundingClientRect();
  const x = Math.round(Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100)));
  const y = Math.round(Math.max(0, Math.min(100, ((clientY - rect.top) / rect.height) * 100)));
  state.radialX = x;
  state.radialY = y;
  render();
}

function setType(type, btn) {
  state.type = type;
  document.querySelectorAll('.type-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById('linearOpts').style.display = type === 'linear' ? '' : 'none';
  document.getElementById('radialOpts').classList.toggle('visible', type === 'radial');
  document.getElementById('conicOpts').style.display = type === 'conic' ? '' : 'none';
  render();
}

function setShape(shape, btn) {
  state.shape = shape;
  document.querySelectorAll('.shape-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  render();
}

function onAngle() {
  state.angle = parseInt(document.getElementById('angleSlider').value);
  document.getElementById('angleVal').textContent = state.angle + '°';
  render();
}

function onConicAngle() {
  state.conicAngle = parseInt(document.getElementById('conicSlider').value);
  document.getElementById('conicVal').textContent = state.conicAngle + '°';
  render();
}

function copyCSS() {
  navigator.clipboard.writeText(`background: ${buildGradientCSS()};`).then(() => {
    const btn = document.getElementById('copyBtn');
    btn.textContent = 'Copied!';
    btn.classList.add('copied');
    setTimeout(() => { btn.textContent = 'Copy CSS'; btn.classList.remove('copied'); }, 1500);
  });
}

function copyBg() {
  navigator.clipboard.writeText(buildGradientCSS());
}

function randomGradient() {
  const hues = [Math.random()*360, Math.random()*360, Math.random()*360];
  state.stops = hues.map((h, i) => ({
    id: state.nextId++,
    color: hslToHex(h, 70 + Math.random()*30, 50 + Math.random()*20),
    alpha: 1,
    pos: i === 0 ? 0 : i === hues.length - 1 ? 100 : Math.round(100 / (hues.length - 1) * i)
  }));
  state.angle = Math.floor(Math.random() * 360);
  document.getElementById('angleSlider').value = state.angle;
  document.getElementById('angleVal').textContent = state.angle + '°';
  render();
}

function hslToHex(h, s, l) {
  s /= 100; l /= 100;
  const k = n => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = n => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return '#' + [f(0),f(8),f(4)].map(x => Math.round(x*255).toString(16).padStart(2,'0')).join('');
}

function loadPreset(preset) {
  state.stops = preset.map((p, i) => ({ id: state.nextId++, color: p.c, alpha: 1, pos: p.p }));
  state.selectedStop = state.stops[0].id;
  render();
}

const presetsRow = document.getElementById('presetsRow');
PRESETS.forEach(preset => {
  const sw = document.createElement('div');
  sw.className = 'preset-swatch';
  sw.style.background = `linear-gradient(135deg, ${preset.map(p=>`${p.c} ${p.p}%`).join(', ')})`;
  sw.title = 'Load preset';
  sw.onclick = () => loadPreset(preset);
  presetsRow.appendChild(sw);
});

render();
