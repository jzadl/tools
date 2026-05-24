let state = {
  bars: 40,
  fps: 60,
  sensitivity: 100,
  autosens: true,
  gradient: true,
  fgColor: '#00ff00',
  bgColor: '#000000',
  gradientColors: ['#ff0000', '#ffff00', '#00ff00', '#00ffff', '#0000ff', '#ff00ff', '#ffffff'],
  gravity: 100,
  monstercat: false,
  waves: false,
  inputMethod: 'pulse',
  inputSource: '',
  sampleRate: 44100,
  paused: false,
};

let animId = null;
let lastFrame = 0;
let framesThisSecond = 0;
let fpsTimer = 0;
let displayFps = 60;
let barHeights = [];
let barVelocities = [];

function initBars() {
  const n = state.bars;
  barHeights = Array.from({ length: n }, () => Math.random() * 0.3);
  barVelocities = Array.from({ length: n }, () => 0);
}
initBars();

const canvas = document.getElementById('cavaCanvas');
const ctx = canvas.getContext('2d');

function resizeCanvas() {
  const rect = canvas.parentElement.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  ctx.scale(dpr, dpr);
  canvas.style.width = rect.width + 'px';
  canvas.style.height = rect.height + 'px';
}
resizeCanvas();
window.addEventListener('resize', resizeCanvas);

function rgbToHex(r, g, b) {
  return '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('');
}

function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h, s, l = (max + min) / 2;
  if (max === min) { h = s = 0; }
  else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }
  return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
}

function hslToRgb(h, s, l) {
  s /= 100; l /= 100;
  const k = n => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = n => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return { r: Math.round(f(0) * 255), g: Math.round(f(8) * 255), b: Math.round(f(4) * 255) };
}

function lerpColor(a, b, t) {
  const ah = parseInt(a.replace('#',''), 16);
  const bh = parseInt(b.replace('#',''), 16);
  const ar = (ah >> 16) & 0xff, ag = (ah >> 8) & 0xff, ab = ah & 0xff;
  const br = (bh >> 16) & 0xff, bg = (bh >> 8) & 0xff, bb = bh & 0xff;
  const rr = Math.round(ar + (br - ar) * t);
  const rg = Math.round(ag + (bg - ag) * t);
  const rb = Math.round(ab + (bb - ab) * t);
  return `rgb(${rr},${rg},${rb})`;
}

function getBarColor(index, total, height) {
  if (state.gradient && state.gradientColors.length > 0) {
    const colors = state.gradientColors;
    if (colors.length === 1) return colors[0];
    const t = index / (total - 1 || 1);
    const seg = (colors.length - 1) * t;
    const idx = Math.floor(seg);
    const frac = seg - idx;
    const i = Math.min(idx, colors.length - 2);
    return lerpColor(colors[i], colors[i + 1], frac);
  }
  return state.fgColor;
}

function drawFrame(now) {
  if (state.paused) {
    animId = requestAnimationFrame(drawFrame);
    return;
  }

  const fps = state.fps;
  const interval = 1000 / fps;
  const delta = now - lastFrame;

  if (delta < interval) {
    animId = requestAnimationFrame(drawFrame);
    return;
  }
  lastFrame = now - (delta % interval);

  framesThisSecond++;
  if (now - fpsTimer >= 1000) {
    displayFps = framesThisSecond;
    framesThisSecond = 0;
    fpsTimer = now;
  }

  const rect = canvas.parentElement.getBoundingClientRect();
  const w = rect.width;
  const h = rect.height;
  const n = state.bars;
  const gap = 2;
  const barW = (w - gap * (n + 1)) / n;
  const grav = state.gravity / 200;

  ctx.fillStyle = state.bgColor;
  ctx.fillRect(0, 0, w, h);

  // generate new audio-like targets
  const targets = barHeights.map((_, i) => {
    const freq = (i / n);
    let base = Math.sin(freq * Math.PI * 3) * 0.5 + 0.5;
    base = base * 0.6 + 0.1;
    const energy = Math.sin(now / 200) * 0.5 + 0.5;
    const noise = Math.sin(now / 50 + i * 1.7) * 0.3 + 0.5;
    const beat = Math.max(0, Math.sin(now / 150) * 0.3 + 0.7);
    return base * energy * noise * beat * (state.sensitivity / 100);
  });

  for (let i = 0; i < n; i++) {
    const target = targets[i];
    barVelocities[i] += (target - barHeights[i]) * 0.08;
    barVelocities[i] *= (1 - grav * 0.3);
    barHeights[i] += barVelocities[i];
    if (barHeights[i] < 0.01) { barHeights[i] = 0.01; barVelocities[i] = 0; }
    if (barHeights[i] > 1) barHeights[i] = 1;
  }

  // monstercat: all bars follow the highest
  if (state.monstercat) {
    const maxH = Math.max(...barHeights);
    barHeights = barHeights.map(h => maxH);
  }

  for (let i = 0; i < n; i++) {
    const barH = Math.max(4, barHeights[i] * h);
    const x = gap + i * (barW + gap);
    const y = h - barH;

    if (state.waves) {
      const waveOffset = Math.sin(now / 300 + i * 0.3) * 8;
      const wy = h - barH + waveOffset;
      ctx.fillStyle = getBarColor(i, n, barHeights[i]);
      ctx.fillRect(x, wy - 4, barW, 4);
    } else {
      ctx.fillStyle = getBarColor(i, n, barHeights[i]);
      ctx.fillRect(x, y, barW, barH);
    }
  }

  document.getElementById('previewFps').textContent = displayFps + ' FPS';

  animId = requestAnimationFrame(drawFrame);
}

function startAnimation() {
  if (animId) cancelAnimationFrame(animId);
  lastFrame = 0;
  animId = requestAnimationFrame(drawFrame);
}

function togglePause() {
  state.paused = !state.paused;
  document.getElementById('pauseBtn').textContent = state.paused ? 'Resume' : 'Pause';
}

function toggleFullscreen() {
  const el = canvas.parentElement;
  if (document.fullscreenElement) {
    document.exitFullscreen();
  } else {
    el.requestFullscreen();
  }
}

function setColorMode(mode) {
  state.gradient = mode === 'gradient';
  document.getElementById('solidTab').classList.toggle('active', !state.gradient);
  document.getElementById('gradientTab').classList.toggle('active', state.gradient);
  document.getElementById('solidColorOpts').style.display = state.gradient ? 'none' : '';
  document.getElementById('gradientOpts').style.display = state.gradient ? '' : 'none';
  buildConfig();
}

function renderFgPalette() {
  const hex = state.fgColor;
  const r = parseInt(hex.slice(1,3), 16);
  const g = parseInt(hex.slice(3,5), 16);
  const b = parseInt(hex.slice(5,7), 16);
  const hsl = rgbToHsl(r, g, b);
  const lightnesses = [10, 20, 30, 40, 50, 60, 70, 80, 85, 90, 95];
  const row = document.getElementById('fgPalette');
  row.innerHTML = lightnesses.map(l => {
    const { r: pr, g: pg, b: pb } = hslToRgb(hsl.h, hsl.s, l);
    const phex = rgbToHex(pr, pg, pb);
    return `<div class="palette-swatch" title="${phex.toUpperCase()}" style="background:${phex}" onclick="setFgColor('${phex}')"></div>`;
  }).join('');
}

function setFgColor(hex) {
  state.fgColor = hex;
  document.getElementById('fgColor').value = hex;
  document.getElementById('fgSwatch').style.background = hex;
  document.getElementById('fgColorHex').textContent = hex.toUpperCase();
  renderFgPalette();
  buildConfig();
}

function updateState() {
  const newBars = parseInt(document.getElementById('barsSlider').value);
  if (newBars !== state.bars) {
    state.bars = newBars;
    initBars();
  }
  state.fps = parseInt(document.getElementById('fpsSlider').value);
  state.sensitivity = parseInt(document.getElementById('sensSlider').value);
  state.autosens = document.getElementById('autosensCheck').checked;
  state.bgColor = document.getElementById('bgColor').value;
  state.gravity = parseInt(document.getElementById('gravitySlider').value);
  state.monstercat = document.getElementById('monstercatCheck').checked;
  state.waves = document.getElementById('wavesCheck').checked;
  state.inputMethod = document.getElementById('inputMethod').value;
  state.inputSource = document.getElementById('inputSource').value;
  state.sampleRate = parseInt(document.getElementById('sampleRateSlider').value);

  document.getElementById('barsVal').textContent = state.bars;
  document.getElementById('fpsVal').textContent = state.fps;
  document.getElementById('sensVal').textContent = state.sensitivity;
  document.getElementById('gravityVal').textContent = state.gravity;
  document.getElementById('sampleRateVal').textContent = state.sampleRate;
  document.getElementById('bgColorHex').textContent = state.bgColor;

  renderGradientBar();
  buildConfig();
}

function renderGradientBar() {
  const bar = document.getElementById('gradientBar');
  const colors = state.gradientColors;
  if (colors.length === 0) {
    bar.style.background = 'var(--brd)';
    return;
  }
  if (colors.length === 1) {
    bar.style.background = colors[0];
    return;
  }
  const stops = colors.map((c, i) => `${c} ${(i / (colors.length - 1)) * 100}%`).join(', ');
  bar.style.background = `linear-gradient(to right, ${stops})`;
}

let activePopupIdx = -1;

function setActiveStop(idx) {
  document.querySelectorAll('.gstop-item').forEach((el, i) => {
    el.classList.toggle('popup-open', i === idx);
  });
}

function renderGradientStopsList() {
  const list = document.getElementById('gradientStops');
  list.innerHTML = '';
  state.gradientColors.forEach((color, idx) => {
    const item = document.createElement('div');
    item.className = 'gstop-item' + (idx === activePopupIdx ? ' popup-open' : '');
    item.innerHTML = `
      <div class="gstop-swatch" data-idx="${idx}">
        <div class="gstop-fill" style="background:${color}"></div>
      </div>
      <span class="gstop-label">${color.toUpperCase()}</span>
      ${state.gradientColors.length > 1 ? `<button class="gstop-del" data-idx="${idx}">×</button>` : ''}
    `;
    const swatch = item.querySelector('.gstop-swatch');
    swatch.addEventListener('click', e => {
      e.stopPropagation();
      openColorPopup(parseInt(swatch.dataset.idx), swatch);
    });
    const delBtn = item.querySelector('.gstop-del');
    if (delBtn) {
      delBtn.addEventListener('click', e => {
        e.stopPropagation();
        if (state.gradientColors.length <= 1) return;
        closeColorPopup();
        state.gradientColors.splice(parseInt(delBtn.dataset.idx), 1);
        renderGradientBar();
        buildConfig();
        renderGradientStopsList();
      });
    }
    list.appendChild(item);
  });
}

function openColorPopup(idx, anchor) {
  if (activePopupIdx === idx) { closeColorPopup(); return; }

  const rect = anchor.getBoundingClientRect();
  closeColorPopup();
  activePopupIdx = idx;
  setActiveStop(idx);

  const popup = document.getElementById('colorPopup') || createColorPopup();
  const color = state.gradientColors[idx];

  popup.innerHTML = '';
  popup.style.display = '';
  popup.dataset.idx = idx;

  const cur = document.createElement('div');
  cur.className = 'cp-current';
  cur.innerHTML = `<span class="cp-swatch" style="background:${color}"></span><span class="cp-hex">${color.toUpperCase()}</span>`;
  popup.appendChild(cur);

  const r = parseInt(color.slice(1,3), 16);
  const g = parseInt(color.slice(3,5), 16);
  const b = parseInt(color.slice(5,7), 16);
  const hsl = rgbToHsl(r, g, b);

  const shades = [10, 20, 30, 40, 50, 60, 70, 80, 85, 90, 95];
  const lRow = document.createElement('div');
  lRow.className = 'cp-row-label'; lRow.textContent = 'Shades';
  popup.appendChild(lRow);
  const lGrid = document.createElement('div'); lGrid.className = 'cp-grid';
  shades.forEach(l => {
    const { r: pr, g: pg, b: pb } = hslToRgb(hsl.h, hsl.s, l);
    const phex = rgbToHex(pr, pg, pb);
    const sw = document.createElement('span');
    sw.className = 'cp-swatch' + (phex === color ? ' active' : '');
    sw.style.background = phex; sw.title = phex;
    sw.addEventListener('click', e => { e.stopPropagation(); pickPopupColor(idx, phex); });
    lGrid.appendChild(sw);
  });
  popup.appendChild(lGrid);

  const sats = [20, 40, 60, 80, 100];
  const sRow = document.createElement('div');
  sRow.className = 'cp-row-label'; sRow.textContent = 'Saturation';
  popup.appendChild(sRow);
  const sGrid = document.createElement('div'); sGrid.className = 'cp-grid';
  sats.forEach(s => {
    const { r: pr, g: pg, b: pb } = hslToRgb(hsl.h, s, hsl.l);
    const phex = rgbToHex(pr, pg, pb);
    const sw = document.createElement('span');
    sw.className = 'cp-swatch' + (phex === color ? ' active' : '');
    sw.style.background = phex; sw.title = phex;
    sw.addEventListener('click', e => { e.stopPropagation(); pickPopupColor(idx, phex); });
    sGrid.appendChild(sw);
  });
  popup.appendChild(sGrid);

  const nativeBtn = document.createElement('button');
  nativeBtn.className = 'cp-native-btn';
  nativeBtn.textContent = 'Open picker';
  nativeBtn.addEventListener('click', e => {
    e.stopPropagation();
    const input = document.createElement('input');
    input.type = 'color'; input.value = color;
    input.addEventListener('input', () => pickPopupColor(idx, input.value));
    input.click();
  });
  popup.appendChild(nativeBtn);

  popup.style.position = 'fixed';
  popup.style.left = Math.max(4, Math.min(rect.right + 8, window.innerWidth - 210)) + 'px';
  popup.style.top = Math.max(4, Math.min(rect.top, window.innerHeight - 220)) + 'px';
}

function pickPopupColor(idx, hex) {
  state.gradientColors[idx] = hex;
  renderGradientBar();
  buildConfig();
  // Update only the swatch + label in-place, don't rebuild the whole list
  const items = document.querySelectorAll('.gstop-item');
  if (items[idx]) {
    items[idx].querySelector('.gstop-fill').style.background = hex;
    items[idx].querySelector('.gstop-label').textContent = hex.toUpperCase();
  }
  const popup = document.getElementById('colorPopup');
  if (popup && popup.style.display !== 'none') {
    popup.querySelector('.cp-current .cp-swatch').style.background = hex;
    popup.querySelector('.cp-current .cp-hex').textContent = hex.toUpperCase();
    popup.querySelectorAll('.cp-grid .cp-swatch').forEach(el => {
      el.classList.toggle('active', el.title === hex.toLowerCase());
    });
  }
}

function closeColorPopup() {
  activePopupIdx = -1;
  const popup = document.getElementById('colorPopup');
  if (popup) popup.style.display = 'none';
  setActiveStop(-1);
}

function createColorPopup() {
  const popup = document.createElement('div');
  popup.id = 'colorPopup';
  popup.className = 'color-popup';
  popup.style.display = 'none';
  document.body.appendChild(popup);
  document.addEventListener('click', e => {
    if (popup.style.display !== 'none' && !popup.contains(e.target)) {
      closeColorPopup();
    }
  });
  return popup;
}

function addGradientStop() {
  const colors = ['#3b82f6','#a855f7','#ec4899','#22c55e','#f59e0b','#ef4444','#06b6d4','#8b5cf6'];
  closeColorPopup();
  state.gradientColors.push(colors[Math.floor(Math.random() * colors.length)]);
  renderGradientBar();
  buildConfig();
  renderGradientStopsList();
}

document.getElementById('gradientBar').addEventListener('click', e => {
  const rect = e.currentTarget.getBoundingClientRect();
  const pct = (e.clientX - rect.left) / rect.width;
  const idx = Math.min(state.gradientColors.length - 1, Math.floor(pct * state.gradientColors.length));
  const input = document.createElement('input');
  input.type = 'color';
  input.value = state.gradientColors[idx];
  input.addEventListener('input', () => {
    state.gradientColors[idx] = input.value;
    renderGradientBar();
    buildConfig();
    renderGradientStopsList();
  });
  input.click();
});

document.querySelectorAll('.gradient-preset').forEach(el => {
  el.style.background = (() => {
    const colors = JSON.parse(el.dataset.colors);
    if (colors.length === 1) return colors[0];
    const stops = colors.map((c, i) => `${c} ${(i / (colors.length - 1)) * 100}%`).join(', ');
    return `linear-gradient(135deg, ${stops})`;
  })();
  el.addEventListener('click', () => {
    state.gradientColors = JSON.parse(el.dataset.colors);
    renderGradientBar();
    buildConfig();
    renderGradientStopsList();
  });
});

document.getElementById('fgColor').addEventListener('input', e => {
  setFgColor(e.target.value);
});

document.getElementById('bgColor').addEventListener('input', e => {
  state.bgColor = e.target.value;
  document.getElementById('bgColorHex').textContent = state.bgColor;
  buildConfig();
});

function buildConfig() {
  const lines = [];
  lines.push('# cava config — generated by tools.jzadl.xyz/cava-maker');
  lines.push('');
  lines.push('[general]');
  lines.push(`bars = ${state.bars}`);
  lines.push(`framerate = ${state.fps}`);
  lines.push(`autosens = ${state.autosens ? 1 : 0}`);
  if (!state.autosens) {
    lines.push(`sensitivity = ${state.sensitivity}`);
  }
  lines.push('');
  lines.push('[color]');
  lines.push(`background = '${state.bgColor}'`);
  if (state.gradient) {
    lines.push(`gradient = 1`);
    state.gradientColors.forEach((c, i) => {
      lines.push(`gradient_color_${i + 1} = '${c}'`);
    });
  } else {
    lines.push(`gradient = 0`);
    lines.push(`foreground = '${state.fgColor}'`);
  }
  lines.push('');
  lines.push('[smoothing]');
  lines.push(`gravity = ${state.gravity}`);
  lines.push(`monstercat = ${state.monstercat ? 1 : 0}`);
  lines.push(`waves = ${state.waves ? 1 : 0}`);
  lines.push('');
  lines.push('[input]');
  lines.push(`method = ${state.inputMethod}`);
  if (state.inputSource.trim()) {
    lines.push(`source = ${state.inputSource.trim()}`);
  }
  lines.push(`sample_rate = ${state.sampleRate}`);

  document.getElementById('configOutput').textContent = lines.join('\n');
}

function copyConfig() {
  const text = document.getElementById('configOutput').textContent;
  navigator.clipboard.writeText(text).then(() => {
    const btn = document.getElementById('copyCfgBtn');
    btn.textContent = 'Copied!';
    setTimeout(() => { btn.textContent = 'Copy config'; }, 1500);
  });
}

function downloadConfig() {
  const text = document.getElementById('configOutput').textContent;
  const blob = new Blob([text], { type: 'text/plain' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'config';
  a.click();
  URL.revokeObjectURL(a.href);
}

document.querySelectorAll('.controls input, .controls select').forEach(el => {
  el.addEventListener('input', updateState);
  el.addEventListener('change', updateState);
});

setColorMode(state.gradient ? 'gradient' : 'solid');
setFgColor(state.fgColor);
renderGradientBar();
renderGradientStopsList();
updateState();
startAnimation();
