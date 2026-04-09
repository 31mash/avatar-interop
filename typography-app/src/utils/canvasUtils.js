/**
 * Canvas utility functions
 */

/**
 * Create a HiDPI-aware canvas
 */
export function createHiDPICanvas(width, height, dpr = window.devicePixelRatio || 1) {
  const canvas = document.createElement('canvas');
  canvas.width = width * dpr;
  canvas.height = height * dpr;
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  return { canvas, ctx, dpr };
}

/**
 * Draw a rounded rectangle
 */
export function roundRect(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

/**
 * Draw a grid pattern (for canvas background)
 */
export function drawGrid(ctx, width, height, gridSize = 20, color = 'rgba(255,255,255,0.03)') {
  ctx.strokeStyle = color;
  ctx.lineWidth = 0.5;

  for (let x = 0; x <= width; x += gridSize) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }

  for (let y = 0; y <= height; y += gridSize) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }
}

/**
 * Apply a noise texture to a canvas region
 */
export function applyNoise(ctx, x, y, width, height, amount = 0.1) {
  const imageData = ctx.getImageData(x, y, width, height);
  const data = imageData.data;

  for (let i = 0; i < data.length; i += 4) {
    const noise = (Math.random() - 0.5) * amount * 255;
    data[i] = Math.min(255, Math.max(0, data[i] + noise));
    data[i + 1] = Math.min(255, Math.max(0, data[i + 1] + noise));
    data[i + 2] = Math.min(255, Math.max(0, data[i + 2] + noise));
  }

  ctx.putImageData(imageData, x, y);
}

/**
 * Create a gradient from style colors
 */
export function createGradient(ctx, colors, x, y, width, height, angle = 0) {
  const rad = (angle * Math.PI) / 180;
  const x1 = x + width / 2 - Math.cos(rad) * width / 2;
  const y1 = y + height / 2 - Math.sin(rad) * height / 2;
  const x2 = x + width / 2 + Math.cos(rad) * width / 2;
  const y2 = y + height / 2 + Math.sin(rad) * height / 2;

  const gradient = ctx.createLinearGradient(x1, y1, x2, y2);
  colors.forEach((color, i) => {
    const [r, g, b] = color;
    gradient.addColorStop(i / (colors.length - 1), `rgb(${r},${g},${b})`);
  });

  return gradient;
}

/**
 * Measure text with full metrics
 */
export function measureText(ctx, text, font) {
  ctx.save();
  ctx.font = font;
  const metrics = ctx.measureText(text);
  ctx.restore();

  return {
    width: metrics.width,
    ascent: metrics.actualBoundingBoxAscent || 0,
    descent: metrics.actualBoundingBoxDescent || 0,
    height: (metrics.actualBoundingBoxAscent || 0) + (metrics.actualBoundingBoxDescent || 0),
  };
}

/**
 * Convert canvas coordinates to normalized (0-1) coordinates
 */
export function canvasToNormalized(x, y, width, height) {
  return { x: x / width, y: y / height };
}

/**
 * Convert normalized coordinates back to canvas coordinates
 */
export function normalizedToCanvas(nx, ny, width, height) {
  return { x: nx * width, y: ny * height };
}
