import { AutoModel, AutoProcessor, RawImage } from 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.5.1/dist/transformers.min.js';

let model = null;
let processor = null;

async function loadModel(onProgress) {
  if (model && processor) return;
  onProgress('Downloading model...', 0);
  model = await AutoModel.from_pretrained('briaai/RMBG-1.4', {
    config: { model_type: 'custom' },
  });
  onProgress('Loading processor...', 60);
  processor = await AutoProcessor.from_pretrained('briaai/RMBG-1.4', {
    config: {
      do_normalize: true,
      do_pad: false,
      do_rescale: true,
      do_resize: true,
      image_mean: [0.5, 0.5, 0.5],
      image_std:  [1.0, 1.0, 1.0],
      resample: 2,
      rescale_factor: 0.00392156862745098,
      size: { width: 1024, height: 1024 },
    },
  });
  onProgress('Model ready', 100);
}

async function removeBg(file, onProgress) {
  await loadModel(onProgress);
  onProgress('Processing image...', 0);

  const img     = await RawImage.fromURL(URL.createObjectURL(file));
  const inputs  = await processor(img);
  const { output } = await model({ input: inputs.pixel_values });

  const mask    = await RawImage.fromTensor(output[0].mul(255).to('uint8')).resize(img.width, img.height);

  const canvas  = document.createElement('canvas');
  canvas.width  = img.width;
  canvas.height = img.height;
  const ctx     = canvas.getContext('2d');
  const imgData = ctx.createImageData(img.width, img.height);

  for (let i = 0; i < img.width * img.height; i++) {
    imgData.data[i * 4]     = img.data[i * 3];
    imgData.data[i * 4 + 1] = img.data[i * 3 + 1];
    imgData.data[i * 4 + 2] = img.data[i * 3 + 2];
    imgData.data[i * 4 + 3] = mask.data[i];
  }

  ctx.putImageData(imgData, 0, 0);
  onProgress('Done', 100);

  return new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
}

const dropZone          = document.getElementById('dropZone');
const fileInput         = document.getElementById('fileInput');
const dropTitle         = document.getElementById('dropTitle');
const dropSub           = document.getElementById('dropSub');
const processingBar     = document.getElementById('processingBar');
const processingStatus  = document.getElementById('processingStatus');
const processingDetail  = document.getElementById('processingDetail');
const progressFill      = document.getElementById('progressFill');
const resultSection     = document.getElementById('resultSection');
const originalImg       = document.getElementById('originalImg');
const resultImg         = document.getElementById('resultImg');
const resultImgWrap     = document.getElementById('resultImgWrap');
const downloadBtn       = document.getElementById('downloadBtn');
const newImageBtn       = document.getElementById('newImageBtn');
const bgTransparent     = document.getElementById('bgTransparent');
const bgCustom          = document.getElementById('bgCustom');

let resultBlob = null;
let currentBg  = 'transparent';

dropZone.addEventListener('click', () => fileInput.click());
dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.classList.add('dragover'); });
dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
dropZone.addEventListener('drop', (e) => {
  e.preventDefault();
  dropZone.classList.remove('dragover');
  if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]);
});
fileInput.addEventListener('change', () => { if (fileInput.files[0]) handleFile(fileInput.files[0]); });

async function handleFile(file) {
  if (!file.type.match(/image\/(png|jpeg|webp)/)) {
    alert('Please upload a PNG, JPG, or WebP image.');
    return;
  }

  originalImg.src = URL.createObjectURL(file);
  dropTitle.textContent = '\u2713 ' + file.name;
  dropSub.textContent   = (file.size / 1024).toFixed(1) + ' KB';
  dropZone.classList.add('has-file');

  resultSection.classList.remove('visible');
  processingBar.classList.add('visible');
  processingStatus.textContent = 'Loading model...';
  processingDetail.textContent = 'First run downloads the AI model, cached after that.';
  progressFill.style.width = '0%';

  try {
    const blob = await removeBg(file, (status, pct) => {
      processingStatus.textContent = status;
      progressFill.style.width = pct + '%';
      if (status === 'Downloading model...')
        processingDetail.textContent = 'Cached after first use';
      else if (status === 'Processing image...')
        processingDetail.textContent = 'Running AI segmentation...';
    });

    resultBlob = blob;
    resultImg.src = URL.createObjectURL(blob);
    processingBar.classList.remove('visible');
    resultSection.classList.add('visible');
    setBg('transparent');

  } catch (err) {
    processingBar.classList.remove('visible');
    alert('Something went wrong: ' + err.message);
    console.error(err);
  }
}

function setBg(bg) {
  currentBg = bg;
  document.querySelectorAll('.bg-btn').forEach(b => b.classList.remove('active'));
  if (bg === 'transparent') {
    bgTransparent.classList.add('active');
    resultImgWrap.className = 'checker-bg';
    resultImgWrap.style.cssText = 'padding:16px';
  } else {
    document.querySelectorAll('.bg-btn[data-color]').forEach(b => {
      if (b.dataset.color === bg) b.classList.add('active');
    });
    resultImgWrap.className = '';
    resultImgWrap.style.cssText = 'padding:16px;background:' + bg;
  }
}

bgTransparent.addEventListener('click', () => setBg('transparent'));

document.querySelectorAll('.bg-btn[data-color]').forEach(btn => {
  btn.addEventListener('click', () => setBg(btn.dataset.color));
});

bgCustom.addEventListener('input', () => {
  document.querySelectorAll('.bg-btn').forEach(b => b.classList.remove('active'));
  currentBg = bgCustom.value;
  resultImgWrap.className = '';
  resultImgWrap.style.cssText = 'padding:16px;background:' + bgCustom.value;
});

downloadBtn.addEventListener('click', () => {
  if (!resultBlob) return;
  if (currentBg === 'transparent') {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(resultBlob);
    a.download = 'bg-removed.png';
    a.click();
  } else {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width  = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = currentBg;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);
      const a = document.createElement('a');
      a.href = canvas.toDataURL('image/png');
      a.download = 'bg-removed.png';
      a.click();
    };
    img.src = URL.createObjectURL(resultBlob);
  }
});

newImageBtn.addEventListener('click', () => {
  resultBlob = null;
  fileInput.value = '';
  originalImg.src = '';
  resultImg.src = '';
  dropZone.classList.remove('has-file');
  dropTitle.textContent = 'Drop your image here';
  dropSub.textContent   = 'or click to browse \u2014 PNG, JPG, WebP supported';
  resultSection.classList.remove('visible');
  processingBar.classList.remove('visible');
  progressFill.style.width = '0%';
  currentBg = 'transparent';
});
