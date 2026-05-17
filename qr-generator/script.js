let currentTab = 'url';
let qrInstance = null;
let debounceTimer = null;

function switchTab(tab, btn) {
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('tab-' + tab).classList.add('active');
  btn.classList.add('active');
  currentTab = tab;
  autoGenerate();
}

function updateSlider(id, valId) {
  document.getElementById(valId).textContent = document.getElementById(id).value + 'px';
}

function getContent() {
  switch (currentTab) {
    case 'url': {
      const v = document.getElementById('url-input').value.trim();
      return v || null;
    }
    case 'text': {
      const v = document.getElementById('text-input').value.trim();
      return v || null;
    }
    case 'wifi': {
      const ssid = document.getElementById('wifi-ssid').value.trim();
      if (!ssid) return null;
      const sec = document.getElementById('wifi-sec').value;
      const pass = document.getElementById('wifi-pass').value;
      return `WIFI:T:${sec};S:${ssid};P:${pass};;`;
    }
    case 'contact': {
      const first = document.getElementById('vcard-first').value.trim();
      const last = document.getElementById('vcard-last').value.trim();
      if (!first && !last) return null;
      const phone = document.getElementById('vcard-phone').value.trim();
      const email = document.getElementById('vcard-email').value.trim();
      const url = document.getElementById('vcard-url').value.trim();
      return `BEGIN:VCARD\nVERSION:3.0\nN:${last};${first}\nFN:${first} ${last}\n${phone ? 'TEL:' + phone + '\n' : ''}${email ? 'EMAIL:' + email + '\n' : ''}${url ? 'URL:' + url + '\n' : ''}END:VCARD`;
    }
  }
  return null;
}

function getSize() {
  const sizeMap = { url: 'url-size', text: 'text-size', wifi: 'wifi-size', contact: 'contact-size' };
  return parseInt(document.getElementById(sizeMap[currentTab]).value);
}

function autoGenerate() {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(generate, 120);
}

function generate() {
  const content = getContent();
  const output = document.getElementById('qrOutput');
  if (!content) { output.classList.remove('visible'); return; }

  const size = getSize();
  const box = document.getElementById('qrBox');
  box.innerHTML = '';

  try {
    qrInstance = new QRCode(box, {
      text: content,
      width: size,
      height: size,
      colorDark: '#000000',
      colorLight: '#ffffff',
      correctLevel: QRCode.CorrectLevel.M
    });
  } catch(e) {
    box.innerHTML = '<div style="padding:16px;font-size:12px;color:#f87171;">Content too long for QR code.</div>';
  }

  document.getElementById('qrContent').textContent = content.length > 80 ? content.substring(0, 80) + '…' : content;
  output.classList.add('visible');
}

function downloadQR(format) {
  const content = getContent();
  if (!content) return;
  const size = getSize();

  if (format === 'png') {
    const canvas = document.querySelector('#qrBox canvas');
    if (!canvas) return;
    const link = document.createElement('a');
    link.download = 'qrcode.png';
    link.href = canvas.toDataURL('image/png');
    link.click();
  } else if (format === 'svg') {
    const canvas = document.querySelector('#qrBox canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width, h = canvas.height;
    const imageData = ctx.getImageData(0, 0, w, h);
    const cellSize = 1;
    let rects = '';
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const idx = (y * w + x) * 4;
        if (imageData.data[idx] < 128) {
          rects += `<rect x="${x}" y="${y}" width="1" height="1" fill="#000"/>`;
        }
      }
    }
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${size}" height="${size}"><rect width="${w}" height="${h}" fill="#fff"/>${rects}</svg>`;
    const blob = new Blob([svg], { type: 'image/svg+xml' });
    const link = document.createElement('a');
    link.download = 'qrcode.svg';
    link.href = URL.createObjectURL(blob);
    link.click();
  }
}
