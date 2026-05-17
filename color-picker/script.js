let currentRGB = { r: 59, g: 130, b: 246 };
let history = [];

function rgbToHex(r, g, b) {
  return '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('');
}

function hexToRgb(hex) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return { r, g, b };
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

function rgbToHsv(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  let h = 0, s = max === 0 ? 0 : d / max, v = max;
  if (max !== min) {
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }
  return { h: Math.round(h * 360), s: Math.round(s * 100), v: Math.round(v * 100) };
}

function rgbToCmyk(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const k = 1 - Math.max(r, g, b);
  if (k === 1) return { c: 0, m: 0, y: 0, k: 100 };
  return {
    c: Math.round((1 - r - k) / (1 - k) * 100),
    m: Math.round((1 - g - k) / (1 - k) * 100),
    y: Math.round((1 - b - k) / (1 - k) * 100),
    k: Math.round(k * 100)
  };
}

function rgbToDecimal(r, g, b) { return (r << 16) | (g << 8) | b; }

function update(rgb, source) {
  currentRGB = rgb;
  const { r, g, b } = rgb;
  const hex = rgbToHex(r, g, b);
  const hsl = rgbToHsl(r, g, b);
  const hsv = rgbToHsv(r, g, b);
  const cmyk = rgbToCmyk(r, g, b);
  const dec = rgbToDecimal(r, g, b);

  document.getElementById('previewSwatch').style.background = hex;
  document.getElementById('previewHex').textContent = hex.toUpperCase();

  if (source !== 'wheel') document.getElementById('colorWheel').value = hex;

  if (source !== 'rgb') {
    document.getElementById('slider-r').value = r;
    document.getElementById('slider-g').value = g;
    document.getElementById('slider-b').value = b;
  }
  document.getElementById('val-r').textContent = r;
  document.getElementById('val-g').textContent = g;
  document.getElementById('val-b').textContent = b;

  if (source !== 'hsl') {
    document.getElementById('slider-h').value = hsl.h;
    document.getElementById('slider-s').value = hsl.s;
    document.getElementById('slider-l').value = hsl.l;
  }
  document.getElementById('val-h').textContent = hsl.h + '°';
  document.getElementById('val-s').textContent = hsl.s + '%';
  document.getElementById('val-l').textContent = hsl.l + '%';

  document.getElementById('slider-s').style.background =
    `linear-gradient(to right, hsl(${hsl.h},0%,50%), hsl(${hsl.h},100%,50%))`;
  document.getElementById('slider-l').style.background =
    `linear-gradient(to right, #000, hsl(${hsl.h},${hsl.s}%,50%), #fff)`;

  const formats = [
    { label: 'HEX',     value: hex.toUpperCase() },
    { label: 'RGB',     value: `rgb(${r}, ${g}, ${b})` },
    { label: 'HSL',     value: `hsl(${hsl.h}, ${hsl.s}%, ${hsl.l}%)` },
    { label: 'HSV',     value: `hsv(${hsv.h}, ${hsv.s}%, ${hsv.v}%)` },
    { label: 'CMYK',    value: `cmyk(${cmyk.c}%, ${cmyk.m}%, ${cmyk.y}%, ${cmyk.k}%)` },
    { label: 'Decimal', value: dec.toString() },
    { label: 'CSS var', value: `--color: ${hex.toUpperCase()};` },
    { label: 'Tailwind (closest)', value: getTailwind(r, g, b) },
  ];

  document.getElementById('formatsGrid').innerHTML = formats.map(f => `
    <div class="format-card" onclick="copyFormat(this, '${f.value}')">
      <div class="format-label">${f.label}</div>
      <div class="format-value">${f.value}</div>
      <span class="copy-hint">copy</span>
    </div>
  `).join('');

  renderPalette(hsl.h, hsl.s);
}

function copyFormat(card, value) {
  navigator.clipboard.writeText(value).then(() => {
    document.querySelectorAll('.format-card').forEach(c => c.classList.remove('copied'));
    card.classList.add('copied');
    card.querySelector('.copy-hint').textContent = 'copied!';
    setTimeout(() => {
      card.classList.remove('copied');
      card.querySelector('.copy-hint').textContent = 'copy';
    }, 1500);
  });
}

function renderPalette(h, s) {
  const lightnesses = [10, 20, 30, 40, 50, 60, 70, 80, 85, 90, 95];
  document.getElementById('paletteRow').innerHTML = lightnesses.map(l => {
    const rgb = hslToRgb(h, s, l);
    const hex = rgbToHex(rgb.r, rgb.g, rgb.b);
    return `<div class="palette-swatch" title="${hex.toUpperCase()}" style="background:${hex}" onclick="setColor('${hex}')"></div>`;
  }).join('');
}

function addToHistory(hex) {
  if (history[0] === hex) return;
  history.unshift(hex);
  if (history.length > 16) history.pop();
  const row = document.getElementById('historyRow');
  row.innerHTML = history.map(h =>
    `<div class="history-swatch" title="${h.toUpperCase()}" style="background:${h}" onclick="setColor('${h}')"></div>`
  ).join('');
}

function setColor(hex) {
  const rgb = hexToRgb(hex);
  addToHistory(hex);
  update(rgb, 'set');
}

function onWheelChange(hex) {
  const rgb = hexToRgb(hex);
  addToHistory(hex);
  update(rgb, 'wheel');
}

function onRGBSlider() {
  const r = parseInt(document.getElementById('slider-r').value);
  const g = parseInt(document.getElementById('slider-g').value);
  const b = parseInt(document.getElementById('slider-b').value);
  addToHistory(rgbToHex(r, g, b));
  update({ r, g, b }, 'rgb');
}

function onHSLSlider() {
  const h = parseInt(document.getElementById('slider-h').value);
  const s = parseInt(document.getElementById('slider-s').value);
  const l = parseInt(document.getElementById('slider-l').value);
  const rgb = hslToRgb(h, s, l);
  addToHistory(rgbToHex(rgb.r, rgb.g, rgb.b));
  update(rgb, 'hsl');
}

const TAILWIND = {
  'slate':  [[248,250,252],[241,245,249],[226,232,240],[203,213,225],[148,163,184],[100,116,139],[71,85,105],[51,65,85],[30,41,59],[15,23,42],[2,6,23]],
  'blue':   [[239,246,255],[219,234,254],[191,219,254],[147,197,253],[96,165,250],[59,130,246],[37,99,235],[29,78,216],[30,64,175],[30,58,138],[23,37,84]],
  'green':  [[240,253,244],[220,252,231],[187,247,208],[134,239,172],[74,222,128],[34,197,94],[22,163,74],[21,128,61],[20,83,45],[22,101,52],[5,46,22]],
  'red':    [[255,241,242],[255,228,230],[254,205,211],[252,165,165],[248,113,113],[239,68,68],[220,38,38],[185,28,28],[153,27,27],[127,29,29],[69,10,10]],
  'yellow': [[254,252,232],[254,249,195],[253,240,138],[252,211,77],[251,191,36],[234,179,8],[202,138,4],[161,98,7],[133,77,14],[113,63,18],[66,32,6]],
  'purple': [[250,245,255],[243,232,255],[233,213,255],[216,180,254],[192,132,252],[168,85,247],[147,51,234],[126,34,206],[107,33,168],[88,28,135],[59,7,100]],
  'pink':   [[253,242,248],[252,231,243],[251,207,232],[249,168,212],[244,114,182],[236,72,153],[219,39,119],[190,24,93],[157,23,77],[131,24,67],[80,7,36]],
  'orange': [[255,247,237],[255,237,213],[254,215,170],[253,186,116],[251,146,60],[249,115,22],[234,88,12],[194,65,12],[154,52,18],[124,45,18],[67,20,7]],
};

function getTailwind(r, g, b) {
  let best = '', bestDist = Infinity, bestShade = 500;
  const shades = [50,100,200,300,400,500,600,700,800,900,950];
  for (const [name, colors] of Object.entries(TAILWIND)) {
    colors.forEach(([tr, tg, tb], i) => {
      const dist = Math.sqrt((r-tr)**2 + (g-tg)**2 + (b-tb)**2);
      if (dist < bestDist) { bestDist = dist; best = name; bestShade = shades[i]; }
    });
  }
  return bestDist < 60 ? `${best}-${bestShade}` : 'no close match';
}

update(currentRGB, 'init');
addToHistory(rgbToHex(59, 130, 246));
