import { generateJoiner } from './hockney.js';

// ---- DOM refs ----
const uploadArea  = document.getElementById('upload-area');
const fileInput   = document.getElementById('file-input');
const controls    = document.getElementById('controls');
const previewSec  = document.getElementById('preview-section');
const loading     = document.getElementById('loading');
const outputCanvas = document.getElementById('output-canvas');

const btnGenerate  = document.getElementById('btn-generate');
const btnRandomize = document.getElementById('btn-randomize');
const btnDownload  = document.getElementById('btn-download');
const btnNew       = document.getElementById('btn-new');

// Sliders
const sliders = {
  cols:        { el: document.getElementById('grid-cols'),    valEl: document.getElementById('grid-cols-val') },
  rows:        { el: document.getElementById('grid-rows'),    valEl: document.getElementById('grid-rows-val') },
  rotation:    { el: document.getElementById('rotation'),     valEl: document.getElementById('rotation-val') },
  scatter:     { el: document.getElementById('scatter'),      valEl: document.getElementById('scatter-val') },
  overlap:     { el: document.getElementById('overlap'),      valEl: document.getElementById('overlap-val') },
  colorShift:  { el: document.getElementById('color-shift'),  valEl: document.getElementById('color-shift-val') },
  borderWidth: { el: document.getElementById('border-width'), valEl: document.getElementById('border-width-val') },
  shadowBlur:  { el: document.getElementById('shadow-blur'),  valEl: document.getElementById('shadow-blur-val') },
};

// Sync all slider readouts
for (const key of Object.keys(sliders)) {
  const s = sliders[key];
  s.el.addEventListener('input', () => { s.valEl.textContent = s.el.value; });
}

// ---- State ----
let sourceImage = null;  // HTMLImageElement

// ---- Upload handling ----
uploadArea.addEventListener('click', () => fileInput.click());

uploadArea.addEventListener('dragover', (e) => {
  e.preventDefault();
  uploadArea.classList.add('dragover');
});

uploadArea.addEventListener('dragleave', () => {
  uploadArea.classList.remove('dragover');
});

uploadArea.addEventListener('drop', (e) => {
  e.preventDefault();
  uploadArea.classList.remove('dragover');
  const file = e.dataTransfer.files[0];
  if (file && file.type.startsWith('image/')) loadFile(file);
});

fileInput.addEventListener('change', () => {
  if (fileInput.files[0]) loadFile(fileInput.files[0]);
});

function loadFile(file) {
  const reader = new FileReader();
  reader.onload = (e) => {
    const img = new Image();
    img.onload = () => {
      sourceImage = img;
      showControls();
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

function showControls() {
  uploadArea.classList.add('hidden');
  controls.classList.remove('hidden');
  previewSec.classList.add('hidden');
}

// ---- Generate ----
btnGenerate.addEventListener('click', runGenerate);

function runGenerate() {
  if (!sourceImage) return;

  loading.classList.remove('hidden');
  previewSec.classList.add('hidden');

  // Defer to let the spinner render
  requestAnimationFrame(() => {
    setTimeout(() => {
      const opts = {
        cols:        Number(sliders.cols.el.value),
        rows:        Number(sliders.rows.el.value),
        maxRotation: Number(sliders.rotation.el.value),
        scatter:     Number(sliders.scatter.el.value),
        overlap:     Number(sliders.overlap.el.value),
        colorShift:  Number(sliders.colorShift.el.value),
        borderWidth: Number(sliders.borderWidth.el.value),
        shadowBlur:  Number(sliders.shadowBlur.el.value),
      };

      generateJoiner(sourceImage, outputCanvas, opts);

      loading.classList.add('hidden');
      previewSec.classList.remove('hidden');
    }, 50);
  });
}

// ---- Randomize ----
btnRandomize.addEventListener('click', () => {
  setSlider(sliders.cols,        randInt(3, 10));
  setSlider(sliders.rows,        randInt(3, 9));
  setSlider(sliders.rotation,    randFloat(1, 10));
  setSlider(sliders.scatter,     randInt(2, 25));
  setSlider(sliders.overlap,     randInt(5, 35));
  setSlider(sliders.colorShift,  randInt(3, 25));
  setSlider(sliders.borderWidth, randInt(1, 8));
  setSlider(sliders.shadowBlur,  randInt(2, 15));
});

function setSlider(slider, val) {
  slider.el.value = val;
  slider.valEl.textContent = val;
}
function randInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function randFloat(min, max) { return Math.round((Math.random() * (max - min) + min) * 10) / 10; }

// ---- Download ----
btnDownload.addEventListener('click', () => {
  const link = document.createElement('a');
  link.download = 'hockney-joiner.png';
  link.href = outputCanvas.toDataURL('image/png');
  link.click();
});

// ---- New image ----
btnNew.addEventListener('click', () => {
  sourceImage = null;
  fileInput.value = '';
  controls.classList.add('hidden');
  previewSec.classList.add('hidden');
  uploadArea.classList.remove('hidden');
});
