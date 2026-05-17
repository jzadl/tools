const dropZone   = document.getElementById('dropZone');
const fileInput  = document.getElementById('fileInput');
const dropTitle  = document.getElementById('dropTitle');
const dropSub    = document.getElementById('dropSub');
const metaSection = document.getElementById('metaSection');
const metaTable  = document.getElementById('metaTable');
const noMeta     = document.getElementById('noMeta');
const tagCount   = document.getElementById('tagCount');
const customFields = document.getElementById('customFields');
const processBtn = document.getElementById('processBtn');
const newFileBtn = document.getElementById('newFileBtn');

let currentFile  = null;
let currentMode  = 'strip';
let currentDataURL = null;

dropZone.addEventListener('click', () => fileInput.click());
dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.classList.add('dragover'); });
dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
dropZone.addEventListener('drop', (e) => {
  e.preventDefault();
  dropZone.classList.remove('dragover');
  if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]);
});
fileInput.addEventListener('change', () => { if (fileInput.files[0]) handleFile(fileInput.files[0]); });

function handleFile(file) {
  const allowed = ['image/jpeg','image/png','image/webp','image/tiff'];
  if (!allowed.includes(file.type)) {
    alert('Please upload a JPEG, PNG, WebP, or TIFF image.');
    return;
  }
  currentFile = file;
  dropTitle.textContent = '\u2713 ' + file.name;
  dropSub.textContent   = (file.size / 1024).toFixed(1) + ' KB';
  dropZone.classList.add('has-file');

  const reader = new FileReader();
  reader.onload = (e) => {
    currentDataURL = e.target.result;
    readMetadata(currentDataURL, file.type);
    metaSection.classList.add('visible');
  };
  reader.readAsDataURL(file);
}

function readMetadata(dataURL, type) {
  metaTable.innerHTML = '';
  noMeta.style.display = 'none';

  const rows = [];

  if (type === 'image/jpeg') {
    try {
      const exifObj = piexif.load(dataURL);
      for (const ifd of ['0th','Exif','GPS','1st']) {
        if (!exifObj[ifd]) continue;
        for (const tag in exifObj[ifd]) {
          const name = piexif.TAGS[ifd] && piexif.TAGS[ifd][tag]
            ? piexif.TAGS[ifd][tag].name
            : 'Tag ' + tag;
          let val = exifObj[ifd][tag];
          if (Array.isArray(val)) val = val.join(', ');
          if (val === undefined || val === null || val === '') continue;
          rows.push([name, String(val).substring(0, 200)]);
        }
      }
    } catch(e) {}
  }

  if (rows.length === 0) {
    noMeta.style.display = 'block';
    tagCount.textContent = '0 tags found';
    tagCount.className = '';
  } else {
    tagCount.innerHTML = '<span class="badge has-data">' + rows.length + ' tags found</span>';
    metaTable.innerHTML = rows.map(([k, v]) =>
      '<tr><td>' + escHtml(k) + '</td><td>' + escHtml(v) + '</td></tr>'
    ).join('');
  }
}

function escHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function setMode(mode) {
  currentMode = mode;
  document.getElementById('modeStrip').classList.toggle('active', mode === 'strip');
  document.getElementById('modeReplace').classList.toggle('active', mode === 'replace');
  customFields.classList.toggle('visible', mode === 'replace');
  processBtn.textContent = mode === 'strip'
    ? '\u2193 Download cleaned image'
    : '\u2193 Download with custom metadata';
}

processBtn.addEventListener('click', () => {
  if (!currentFile || !currentDataURL) return;

  const img = new Image();
  img.onload = () => {
    const canvas = document.createElement('canvas');
    canvas.width  = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0);

    const isJpeg = currentFile.type === 'image/jpeg';
    const mime   = isJpeg ? 'image/jpeg' : 'image/png';
    const ext    = isJpeg ? 'jpg' : 'png';
    const quality = isJpeg ? 0.95 : undefined;

    if (currentMode === 'strip' || !isJpeg) {
      download(canvas.toDataURL(mime, quality), ext);
    } else {
      const clean = canvas.toDataURL('image/jpeg', 0.95);
      const exifObj = { '0th': {}, 'Exif': {}, 'GPS': {} };

      const make   = document.getElementById('fMake').value.trim();
      const model  = document.getElementById('fModel').value.trim();
      const artist = document.getElementById('fArtist').value.trim();
      const copy   = document.getElementById('fCopyright').value.trim();
      const date   = document.getElementById('fDate').value;
      const sw     = document.getElementById('fSoftware').value.trim();
      const desc   = document.getElementById('fDescription').value.trim();
      const lat    = parseFloat(document.getElementById('fLat').value);
      const lon    = parseFloat(document.getElementById('fLon').value);

      if (make)   exifObj['0th'][piexif.ImageIFD.Make]        = make;
      if (model)  exifObj['0th'][piexif.ImageIFD.Model]       = model;
      if (artist) exifObj['0th'][piexif.ImageIFD.Artist]      = artist;
      if (copy)   exifObj['0th'][piexif.ImageIFD.Copyright]   = copy;
      if (sw)     exifObj['0th'][piexif.ImageIFD.Software]    = sw;
      if (desc)   exifObj['0th'][piexif.ImageIFD.ImageDescription] = desc;

      if (date) {
        const d = date.replace('T', ' ').replace(/-/g, ':') + ':00';
        exifObj['Exif'][piexif.ExifIFD.DateTimeOriginal]  = d;
        exifObj['Exif'][piexif.ExifIFD.DateTimeDigitized] = d;
        exifObj['0th'][piexif.ImageIFD.DateTime]          = d;
      }

      if (!isNaN(lat) && !isNaN(lon)) {
        exifObj['GPS'][piexif.GPSIFD.GPSLatitudeRef]  = lat >= 0 ? 'N' : 'S';
        exifObj['GPS'][piexif.GPSIFD.GPSLatitude]     = degToDMS(Math.abs(lat));
        exifObj['GPS'][piexif.GPSIFD.GPSLongitudeRef] = lon >= 0 ? 'E' : 'W';
        exifObj['GPS'][piexif.GPSIFD.GPSLongitude]    = degToDMS(Math.abs(lon));
      }

      try {
        const exifStr  = piexif.dump(exifObj);
        const inserted = piexif.insert(exifStr, clean);
        download(inserted, 'jpg');
      } catch(e) {
        alert('Could not write EXIF: ' + e.message);
        console.error(e);
      }
    }
  };
  img.src = currentDataURL;
});

function degToDMS(deg) {
  const d = Math.floor(deg);
  const mFloat = (deg - d) * 60;
  const m = Math.floor(mFloat);
  const s = Math.round((mFloat - m) * 60 * 100);
  return [[d, 1], [m, 1], [s, 100]];
}

function download(dataURL, ext) {
  const base = currentFile.name.replace(/\.[^.]+$/, '');
  const suffix = currentMode === 'strip' ? '-clean' : '-custom';
  const a = document.createElement('a');
  a.href = dataURL;
  a.download = base + suffix + '.' + ext;
  a.click();
}

newFileBtn.addEventListener('click', () => {
  currentFile = null;
  currentDataURL = null;
  fileInput.value = '';
  dropZone.classList.remove('has-file');
  dropTitle.textContent = 'Drop your image here';
  dropSub.textContent   = 'or click to browse \u2014 JPEG, PNG, WebP, TIFF supported';
  metaSection.classList.remove('visible');
  metaTable.innerHTML = '';
  noMeta.style.display = 'none';
  setMode('strip');
});
