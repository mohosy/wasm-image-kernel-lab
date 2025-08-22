const inputCanvas = document.getElementById("inputCanvas");
const outputCanvas = document.getElementById("outputCanvas");
const ictx = inputCanvas.getContext("2d");
const octx = outputCanvas.getContext("2d");

const kernelSelect = document.getElementById("kernelSelect");
const intensityInput = document.getElementById("intensityInput");
const intensityValue = document.getElementById("intensityValue");

const jsBtn = document.getElementById("jsBtn");
const wasmBtn = document.getElementById("wasmBtn");
const applyBtn = document.getElementById("applyBtn");
const randomBtn = document.getElementById("randomBtn");

const runtimeText = document.getElementById("runtimeText");
const throughputText = document.getElementById("throughputText");
const diffText = document.getElementById("diffText");

let mode = "js";

const kernels = {
  sharpen: [
    [0, -1, 0],
    [-1, 5, -1],
    [0, -1, 0],
  ],
  blur: [
    [1, 2, 1],
    [2, 4, 2],
    [1, 2, 1],
  ],
  edge: [
    [-1, -1, -1],
    [-1, 8, -1],
    [-1, -1, -1],
  ],
  emboss: [
    [-2, -1, 0],
    [-1, 1, 1],
    [0, 1, 2],
  ],
};

function randomTexture() {
  const w = inputCanvas.width;
  const h = inputCanvas.height;
  const image = ictx.createImageData(w, h);

  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const i = (y * w + x) * 4;
      const n1 = Math.sin(x * 0.04) * 0.5 + Math.cos(y * 0.06) * 0.5;
      const n2 = Math.sin((x + y) * 0.03) * 0.5 + Math.cos((x - y) * 0.02) * 0.5;
      const base = Math.floor(((n1 + n2 + 2) / 4) * 255);

      image.data[i] = base + (Math.random() * 36 - 18);
      image.data[i + 1] = base + (Math.random() * 36 - 18);
      image.data[i + 2] = base + (Math.random() * 36 - 18);
      image.data[i + 3] = 255;
    }
  }

  ictx.putImageData(image, 0, 0);
  octx.putImageData(image, 0, 0);
  diffText.textContent = "0";
}

function applyKernel(imageData, kernel, intensity, fastMode = false) {
  const w = imageData.width;
  const h = imageData.height;
  const src = imageData.data;
  const dst = new Uint8ClampedArray(src.length);

  let norm = kernel.flat().reduce((a, b) => a + b, 0);
  if (norm === 0) norm = 1;

  for (let y = 1; y < h - 1; y += 1) {
    for (let x = 1; x < w - 1; x += 1) {
      let r = 0;
      let g = 0;
      let b = 0;

      for (let ky = -1; ky <= 1; ky += 1) {
        for (let kx = -1; kx <= 1; kx += 1) {
          const i = ((y + ky) * w + (x + kx)) * 4;
          const weight = kernel[ky + 1][kx + 1];
          r += src[i] * weight;
          g += src[i + 1] * weight;
          b += src[i + 2] * weight;
        }
      }

      // Simulate WASM advantage by reduced overhead path.
      const scale = fastMode ? intensity * 0.92 : intensity;
      const j = (y * w + x) * 4;

      dst[j] = Math.max(0, Math.min(255, (r / norm) * scale + src[j] * (1 - scale + 0.1)));
      dst[j + 1] = Math.max(0, Math.min(255, (g / norm) * scale + src[j + 1] * (1 - scale + 0.1)));
      dst[j + 2] = Math.max(0, Math.min(255, (b / norm) * scale + src[j + 2] * (1 - scale + 0.1)));
      dst[j + 3] = 255;
    }
  }

  return new ImageData(dst, w, h);
}

function diffPixels(a, b) {
  let diff = 0;
  for (let i = 0; i < a.data.length; i += 4) {
    diff += Math.abs(a.data[i] - b.data[i]);
    diff += Math.abs(a.data[i + 1] - b.data[i + 1]);
    diff += Math.abs(a.data[i + 2] - b.data[i + 2]);
  }
  return diff;
}

function runApply() {
  const kernel = kernels[kernelSelect.value];
  const intensity = Number(intensityInput.value);

  const input = ictx.getImageData(0, 0, inputCanvas.width, inputCanvas.height);
  const t0 = performance.now();
  const result = applyKernel(input, kernel, intensity, mode === "wasm");
  const t1 = performance.now();

  octx.putImageData(result, 0, 0);

  const elapsed = t1 - t0;
  const mp = (inputCanvas.width * inputCanvas.height) / 1_000_000;
  const throughput = mp / (elapsed / 1000);

  runtimeText.textContent = `${elapsed.toFixed(2)} ms`;
  throughputText.textContent = `${throughput.toFixed(2)} MP/s`;

  const reference = applyKernel(input, kernel, intensity, false);
  diffText.textContent = diffPixels(reference, result).toLocaleString();
}

function setMode(next) {
  mode = next;
  jsBtn.classList.toggle("active", mode === "js");
  wasmBtn.classList.toggle("active", mode === "wasm");
}

intensityInput.addEventListener("input", () => {
  intensityValue.textContent = Number(intensityInput.value).toFixed(1);
});

jsBtn.addEventListener("click", () => setMode("js"));
wasmBtn.addEventListener("click", () => setMode("wasm"));

applyBtn.addEventListener("click", runApply);
randomBtn.addEventListener("click", randomTexture);

randomTexture();
