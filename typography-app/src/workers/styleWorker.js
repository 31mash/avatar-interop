/**
 * Web Worker for background style extraction processing.
 * Offloads heavy image analysis from the main thread.
 */

const ANALYSIS_SIZE = 256;

self.onmessage = function (e) {
  const { type, payload } = e.data;

  switch (type) {
    case 'analyze': {
      const result = analyzeImageData(payload.imageData, payload.width, payload.height);
      self.postMessage({ type: 'result', payload: result });
      break;
    }
    case 'extractTexture': {
      const texture = extractTexture(payload.imageData, payload.width, payload.height);
      self.postMessage({ type: 'texture', payload: texture });
      break;
    }
    default:
      self.postMessage({ type: 'error', payload: 'Unknown command' });
  }
};

function analyzeImageData(pixels, width, height) {
  const colorResult = analyzeColors(pixels);
  const edgeResult = analyzeEdges(pixels, width, height);
  const textureResult = analyzeTexture(pixels, width, height);

  return {
    colors: colorResult,
    edges: edgeResult,
    texture: textureResult,
  };
}

function analyzeColors(pixels) {
  let totalR = 0, totalG = 0, totalB = 0;
  let totalSat = 0;
  const pixelCount = pixels.length / 4;
  const buckets = {};

  for (let i = 0; i < pixels.length; i += 4) {
    const r = pixels[i], g = pixels[i + 1], b = pixels[i + 2];
    totalR += r; totalG += g; totalB += b;

    const max = Math.max(r, g, b) / 255;
    const min = Math.min(r, g, b) / 255;
    totalSat += max === 0 ? 0 : (max - min) / max;

    const qr = (r >> 4) << 4;
    const qg = (g >> 4) << 4;
    const qb = (b >> 4) << 4;
    const key = `${qr},${qg},${qb}`;
    buckets[key] = (buckets[key] || 0) + 1;
  }

  const sorted = Object.entries(buckets).sort((a, b) => b[1] - a[1]);
  const palette = sorted.slice(0, 6).map(([key]) => key.split(',').map(Number));

  return {
    avgBrightness: (totalR + totalG + totalB) / (pixelCount * 3 * 255),
    avgSaturation: totalSat / pixelCount,
    palette,
    dominant: palette[0] || [0, 0, 0],
  };
}

function analyzeEdges(pixels, width, height) {
  // Simplified Sobel
  const gray = new Float32Array(width * height);
  for (let i = 0; i < gray.length; i++) {
    const idx = i * 4;
    gray[i] = (pixels[idx] * 0.299 + pixels[idx + 1] * 0.587 + pixels[idx + 2] * 0.114) / 255;
  }

  let totalEdge = 0;
  let edgeCount = 0;

  for (let y = 1; y < height - 1; y += 2) {
    for (let x = 1; x < width - 1; x += 2) {
      const gx =
        -gray[(y - 1) * width + (x - 1)] + gray[(y - 1) * width + (x + 1)]
        - 2 * gray[y * width + (x - 1)] + 2 * gray[y * width + (x + 1)]
        - gray[(y + 1) * width + (x - 1)] + gray[(y + 1) * width + (x + 1)];
      const gy =
        -gray[(y - 1) * width + (x - 1)] - 2 * gray[(y - 1) * width + x] - gray[(y - 1) * width + (x + 1)]
        + gray[(y + 1) * width + (x - 1)] + 2 * gray[(y + 1) * width + x] + gray[(y + 1) * width + (x + 1)];

      const mag = Math.sqrt(gx * gx + gy * gy);
      if (mag > 0.1) edgeCount++;
      totalEdge += mag;
    }
  }

  const totalPixels = ((width - 2) / 2) * ((height - 2) / 2);
  return {
    density: edgeCount / totalPixels,
    avgStrength: totalEdge / totalPixels,
  };
}

function analyzeTexture(pixels, width, height) {
  const blockSize = 8;
  let totalVariance = 0;
  let blocks = 0;

  for (let by = 0; by < height - blockSize; by += blockSize) {
    for (let bx = 0; bx < width - blockSize; bx += blockSize) {
      let sum = 0, sumSq = 0, count = 0;
      for (let dy = 0; dy < blockSize; dy++) {
        for (let dx = 0; dx < blockSize; dx++) {
          const idx = ((by + dy) * width + (bx + dx)) * 4;
          const lum = (pixels[idx] * 0.299 + pixels[idx + 1] * 0.587 + pixels[idx + 2] * 0.114) / 255;
          sum += lum;
          sumSq += lum * lum;
          count++;
        }
      }
      const mean = sum / count;
      totalVariance += sumSq / count - mean * mean;
      blocks++;
    }
  }

  const avgVar = blocks > 0 ? totalVariance / blocks : 0;
  return {
    roughness: Math.min(1, avgVar * 10),
    textureStrength: Math.min(1, avgVar * 20),
  };
}

function extractTexture(pixels, width, height) {
  // Return a representative texture sample
  const tileSize = Math.min(64, width, height);
  const sx = Math.floor((width - tileSize) / 2);
  const sy = Math.floor((height - tileSize) / 2);
  const tile = new Uint8ClampedArray(tileSize * tileSize * 4);

  for (let y = 0; y < tileSize; y++) {
    for (let x = 0; x < tileSize; x++) {
      const srcIdx = ((sy + y) * width + (sx + x)) * 4;
      const dstIdx = (y * tileSize + x) * 4;
      tile[dstIdx] = pixels[srcIdx];
      tile[dstIdx + 1] = pixels[srcIdx + 1];
      tile[dstIdx + 2] = pixels[srcIdx + 2];
      tile[dstIdx + 3] = pixels[srcIdx + 3];
    }
  }

  return { data: tile, width: tileSize, height: tileSize };
}
