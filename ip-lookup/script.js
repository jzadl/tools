const API = 'https://iplookup.felixzamoranoj.workers.dev/';
let recent = JSON.parse(localStorage.getItem('ip-lookup-recent') || '[]');

renderRecent();

async function lookup(ip) {
  const query = ip || document.getElementById('searchInput').value.trim();
  if (!query) return;

  setLoading(true, 'Looking up ' + query + '...');
  hideError();
  document.getElementById('results').classList.remove('visible');

  try {
    const res = await fetch(`${API}${encodeURIComponent(query)}`);
    if (!res.ok) throw new Error('Worker error ' + res.status);
    const data = await res.json();
    if (data.status === 'fail') throw new Error(data.message || 'Lookup failed');
    addRecent(query);
    renderResults(normalize(data));
  } catch (e) {
    showError('Could not look up "' + query + '": ' + e.message);
  }
  setLoading(false);
}

async function lookupMyIp() {
  setLoading(true, 'Detecting your IP...');
  hideError();
  document.getElementById('results').classList.remove('visible');
  try {
    const ipRes = await fetch('https://api.ipify.org?format=json');
    const { ip } = await ipRes.json();
    document.getElementById('searchInput').value = ip;
    await lookup(ip);
  } catch(e) {
    showError('Could not detect your IP: ' + e.message);
    setLoading(false);
  }
}

function renderResults(d) {
  const flag = countryFlag(d.countryCode);
  const badges = [
    d.proxy ? '<span class="ip-badge vpn">⚠ Proxy / VPN</span>' : '',
    d.hosting ? '<span class="ip-badge hosting">🖥 Hosting / Datacenter</span>' : '',
    d.mobile ? '<span class="ip-badge mobile">📱 Mobile</span>' : '',
  ].filter(Boolean).join('');

  document.getElementById('ipHeader').innerHTML = `
    <div class="ip-flag">${flag}</div>
    <div class="ip-main">
      <div class="ip-address">${d.query}</div>
      <div class="ip-location">${[d.city, d.regionName, d.country].filter(Boolean).join(', ')}</div>
      <div class="ip-badges">${badges || '<span class="ip-badge">Residential</span>'}</div>
    </div>
  `;

  rows('locationRows', [
    ['Country', `${flag} ${d.country} (${d.countryCode})`],
    ['Region', d.regionName || '—'],
    ['City', d.city || '—'],
    ['ZIP / Postal', d.zip || '—'],
    ['Coordinates', d.lat && d.lon ? `${d.lat}, ${d.lon}` : '—'],
  ]);

  rows('networkRows', [
    ['ISP', d.isp || '—'],
    ['Organization', d.org || '—'],
    ['AS Number', d.as || '—'],
    ['AS Name', d.asname || '—'],
    ['Type', d.hosting ? 'Hosting/DC' : d.proxy ? 'Proxy/VPN' : d.mobile ? 'Mobile' : 'Residential'],
  ]);

  const tz = d.timezone || '';
  let localTime = '—', utcOffset = '—';
  if (tz) {
    try {
      localTime = new Date().toLocaleString('en-US', { timeZone: tz, hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
      const offset = new Intl.DateTimeFormat('en', { timeZone: tz, timeZoneName: 'short' }).formatToParts(new Date()).find(p => p.type === 'timeZoneName')?.value || '';
      utcOffset = offset;
    } catch(e) {}
  }
  rows('timeRows', [
    ['Timezone', tz || '—'],
    ['Local Time', localTime],
    ['UTC Offset', utcOffset],
  ]);

  rows('localRows', [
    ['Country Code', d.countryCode || '—'],
    ['Mobile Network', d.mobile ? 'Yes' : 'No'],
    ['Language', getLang(d.countryCode)],
    ['IP Version', d.query && d.query.includes(':') ? 'IPv6' : 'IPv4'],
  ]);

  if (d.lat && d.lon) {
    const lat = d.lat, lon = d.lon;
    const zoom = 10;
    document.getElementById('mapFrame').src =
      `https://www.openstreetmap.org/export/embed.html?bbox=${lon-0.1},${lat-0.1},${lon+0.1},${lat+0.1}&layer=mapnik&marker=${lat},${lon}`;
    document.getElementById('mapCoords').textContent = `${lat}, ${lon}`;
    document.getElementById('openOSM').href = `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lon}&zoom=${zoom}`;
    document.getElementById('openGMaps').href = `https://www.google.com/maps?q=${lat},${lon}&z=${zoom}`;
    document.getElementById('openGDirections').href = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lon}`;
    document.getElementById('mapCard').style.display = '';
  } else {
    document.getElementById('mapCard').style.display = 'none';
  }

  document.getElementById('results').classList.add('visible');
}

function rows(id, data) {
  document.getElementById(id).innerHTML = data.map(([k, v]) =>
    `<div class="info-row"><span class="info-key">${k}</span><span class="info-val">${v}</span></div>`
  ).join('');
}

function normalize(d) {
  return {
    query:       d.query,
    country:     d.country,
    countryCode: d.countryCode,
    regionName:  d.regionName,
    region:      d.region,
    city:        d.city,
    zip:         d.zip || '—',
    lat:         d.lat,
    lon:         d.lon,
    timezone:    d.timezone || '',
    isp:         d.isp || '—',
    org:         d.org || '—',
    as:          d.as || '—',
    asname:      d.asname || '—',
    mobile:      d.mobile || false,
    proxy:       d.proxy || false,
    hosting:     d.hosting || false,
    currency:    '—',
    languages:   getLang(d.countryCode),
  };
}
function countryFlag(code) {
  if (!code || code.length !== 2) return '🌐';
  return String.fromCodePoint(...[...code.toUpperCase()].map(c => 0x1F1E6 - 65 + c.charCodeAt(0)));
}

function getLang(code) {
  const map = { 
    US:'English', GB:'English', MX:'Spanish', ES:'Spanish', FR:'French', DE:'German', 
    JP:'Japanese', CN:'Chinese', BR:'Portuguese', PT:'Portuguese', IN:'Hindi/English', RU:'Russian'
  };
  return map[code] || '—';
}

function addRecent(ip) {
  recent = [ip, ...recent.filter(x => x !== ip)].slice(0, 8);
  localStorage.setItem('ip-lookup-recent', JSON.stringify(recent));
  renderRecent();
}

function renderRecent() {
  if (!recent.length) { document.getElementById('recentWrap').style.display = 'none'; return; }
  document.getElementById('recentWrap').style.display = '';
  document.getElementById('recentRow').innerHTML = recent.map(ip =>
    `<div class="recent-chip" onclick="document.getElementById('searchInput').value='${ip}';lookup('${ip}')">${ip}</div>`
  ).join('');
}

function setLoading(on, msg) {
  document.getElementById('loading').classList.toggle('visible', on);
  if (msg) document.getElementById('loadingText').textContent = msg;
  document.getElementById('lookupBtn').disabled = on;
}
function showError(msg) { const b = document.getElementById('errorBox'); b.textContent = msg; b.classList.add('visible'); }
function hideError() { document.getElementById('errorBox').classList.remove('visible'); }
