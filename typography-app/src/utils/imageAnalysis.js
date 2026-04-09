/**
 * Image analysis utility functions for style extraction
 */

/**
 * K-means color clustering (simplified)
 */
export function kMeansColors(pixels, k = 5, iterations = 10) {
  const colors = [];
  const pixelCount = pixels.length / 4;

  // Sample pixels (every Nth pixel for performance)
  const step = Math.max(1, Math.floor(pixelCount / 1000));
  const samples = [];
  for (let i = 0; i < pixels.length; i += step * 4) {
    samples.push([pixels[i], pixels[i + 1], pixels[i + 2]]);
  }

  // Initialize centroids with k-means++ style
  const centroids = [samples[0]];
  for (let i = 1; i < k; i++) {
    let maxDist = 0, bestSample = samples[0];
    for (const sample of samples) {
      let minDist = Infinity;
      for (const c of centroids) {
        const d = colorDistance(sample, c);
        minDist = Math.min(minDist, d);
      }
      if (minDist > maxDist) {
        maxDist = minDist;
        bestSample = sample;
      }
    }
    centroids.push([...bestSample]);
  }

  // Iterate
  for (let iter = 0; iter < iterations; iter++) {
    const clusters = Array.from({ length: k }, () => []);

    // Assign samples to nearest centroid
    for (const sample of samples) {
      let minDist = Infinity, bestCluster = 0;
      for (let c = 0; c < centroids.length; c++) {
        const d = colorDistance(sample, centroids[c]);
        if (d < minDist) { minDist = d; bestCluster = c; }
      }
      clusters[bestCluster].push(sample);
    }

    // Update centroids
    for (let c = 0; c < k; c++) {
      if (clusters[c].length === 0) continue;
      centroids[c] = [
        Math.round(clusters[c].reduce((s, p) => s + p[0], 0) / clusters[c].length),
        Math.round(clusters[c].reduce((s, p) => s + p[1], 0) / clusters[c].length),
        Math.round(clusters[c].reduce((s, p) => s + p[2], 0) / clusters[c].length),
      ];
    }
  }

  return centroids;
}

function colorDistance(a, b) {
  return Math.sqrt(
    (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2
  );
}

/**
 * Gaussian blur on grayscale data
 */
export function gaussianBlur(data, width, height, radius = 1) {
  const output = new Float32Array(data.length);
  const kernel = generateGaussianKernel(radius);
  const kSize = radius * 2 + 1;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let sum = 0, wSum = 0;
      for (let ky = -radius; ky <= radius; ky++) {
        for (let kx = -radius; kx <= radius; kx++) {
          const px = Math.min(width - 1, Math.max(0, x + kx));
          const py = Math.min(height - 1, Math.max(0, y + ky));
          const w = kernel[(ky + radius) * kSize + (kx + radius)];
          sum += data[py * width + px] * w;
          wSum += w;
        }
      }
      output[y * width + x] = sum / wSum;
    }
  }
  return output;
}

function generateGaussianKernel(radius) {
  const size = radius * 2 + 1;
  const kernel = new Float32Array(size * size);
  const sigma = radius / 2;
  let sum = 0;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = x - radius, dy = y - radius;
      const val = Math.exp(-(dx * dx + dy * dy) / (2 * sigma * sigma));
      kernel[y * size + x] = val;
      sum += val;
    }
  }

  for (let i = 0; i < kernel.length; i++) kernel[i] /= sum;
  return kernel;
}

/**
 * Compute histogram of luminance values
 */
export function luminanceHistogram(pixels, bins = 256) {
  const hist = new Uint32Array(bins);
  for (let i = 0; i < pixels.length; i += 4) {
    const lum = Math.round((pixels[i] * 0.299 + pixels[i + 1] * 0.587 + pixels[i + 2] * 0.114));
    const bin = Math.min(bins - 1, Math.floor(lum * bins / 256));
    hist[bin]++;
  }
  return hist;
}

/**
 * Detect dominant orientation of edges (for slant/italic detection)
 */
export function detectOrientation(edgeMap, width, height) {
  let hCount = 0, vCount = 0, dCount = 0;
  const threshold = 0.3;

  for (let y = 1; y < height - 1; y += 2) {
    for (let x = 1; x < width - 1; x += 2) {
      if (edgeMap[y * width + x] < threshold) continue;
      const h = Math.abs(edgeMap[y * width + (x - 1)] - edgeMap[y * width + (x + 1)]);
      const v = Math.abs(edgeMap[(y - 1) * width + x] - edgeMap[(y + 1) * width + x]);
      if (h > v * 1.5) hCount++;
      else if (v > h * 1.5) vCount++;
      else dCount++;
    }
  }
  const total = hCount + vCount + dCount || 1;
  return {
    horizontal: hCount / total,
    vertical: vCount / total,
    diagonal: dCount / total,
  };
}
