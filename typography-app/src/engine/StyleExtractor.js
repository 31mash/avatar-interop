/**
 * StyleExtractor — analyzes an uploaded image to extract typographic style parameters.
 * Uses Canvas-based computer vision: edge detection, color clustering, texture analysis.
 */

import { createDefaultProfile } from './StyleProfile';

const ANALYSIS_SIZE = 256; // downscale for performance

export class StyleExtractor {
  constructor() {
    this.canvas = null;
    this.ctx = null;
    this.sourceImage = null;
  }

  /**
   * Main entry: extract style profile from an image element or blob
   */
  async extract(imageSource) {
    const img = await this._loadImage(imageSource);
    this.sourceImage = img;

    // Create analysis canvas
    this.canvas = document.createElement('canvas');
    const scale = Math.min(ANALYSIS_SIZE / img.width, ANALYSIS_SIZE / img.height, 1);
    this.canvas.width = Math.round(img.width * scale);
    this.canvas.height = Math.round(img.height * scale);
    this.ctx = this.canvas.getContext('2d', { willReadFrequently: true });
    this.ctx.drawImage(img, 0, 0, this.canvas.width, this.canvas.height);

    const imageData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
    const pixels = imageData.data;

    const profile = createDefaultProfile();
    profile.sourceWidth = img.width;
    profile.sourceHeight = img.height;

    // Run all analyses
    const colorAnalysis = this._analyzeColors(pixels);
    const edgeAnalysis = this._analyzeEdges(imageData);
    const textureAnalysis = this._analyzeTexture(pixels, this.canvas.width, this.canvas.height);
    const structureAnalysis = this._analyzeStructure(edgeAnalysis.edgeMap, this.canvas.width, this.canvas.height);

    // Map results to profile
    profile.primaryColor = colorAnalysis.dominant;
    profile.secondaryColor = colorAnalysis.secondary;
    profile.backgroundColor = colorAnalysis.background;
    profile.palette = colorAnalysis.palette;
    profile.brightness = colorAnalysis.brightness;
    profile.contrast = colorAnalysis.contrast;

    profile.weight = structureAnalysis.weight;
    profile.strokeContrast = structureAnalysis.strokeContrast;
    profile.strokeWidth = structureAnalysis.strokeWidth;
    profile.serifness = structureAnalysis.serifness;

    profile.roughness = textureAnalysis.roughness;
    profile.textureStrength = textureAnalysis.textureStrength;
    profile.noiseAmount = textureAnalysis.noise;

    profile.edgeDensity = edgeAnalysis.density;

    // Extract texture tile
    profile.textureData = this._extractTextureTile(img);

    // Detect glow/neon
    if (colorAnalysis.brightness < 0.3 && colorAnalysis.saturation > 0.5) {
      profile.glowStrength = Math.min(1, colorAnalysis.saturation * 1.2);
    }

    // Estimate curvature from edge smoothness
    profile.curvature = structureAnalysis.curvature;

    profile.confidence = Math.min(1, 0.4 + edgeAnalysis.density * 2);
    profile.timestamp = Date.now();

    return profile;
  }

  _loadImage(source) {
    return new Promise((resolve, reject) => {
      if (source instanceof HTMLImageElement) {
        if (source.complete) resolve(source);
        else {
          source.onload = () => resolve(source);
          source.onerror = reject;
        }
        return;
      }

      const img = new Image();
      img.crossOrigin = 'anonymous';
      if (source instanceof Blob || source instanceof File) {
        img.src = URL.createObjectURL(source);
      } else if (typeof source === 'string') {
        img.src = source;
      }
      img.onload = () => {
        if (source instanceof Blob || source instanceof File) {
          URL.revokeObjectURL(img.src);
        }
        resolve(img);
      };
      img.onerror = reject;
    });
  }

  /**
   * Color analysis: dominant colors, palette, brightness, contrast, saturation
   */
  _analyzeColors(pixels) {
    const colorBuckets = new Map();
    let totalR = 0, totalG = 0, totalB = 0;
    let minLum = 1, maxLum = 0;
    let totalSat = 0;
    const pixelCount = pixels.length / 4;

    for (let i = 0; i < pixels.length; i += 4) {
      const r = pixels[i], g = pixels[i + 1], b = pixels[i + 2];
      totalR += r; totalG += g; totalB += b;

      // Luminance
      const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
      minLum = Math.min(minLum, lum);
      maxLum = Math.max(maxLum, lum);

      // Saturation (HSL)
      const max = Math.max(r, g, b) / 255;
      const min = Math.min(r, g, b) / 255;
      const sat = max === 0 ? 0 : (max - min) / max;
      totalSat += sat;

      // Quantize to 32-level buckets for clustering
      const qr = (r >> 3) << 3;
      const qg = (g >> 3) << 3;
      const qb = (b >> 3) << 3;
      const key = `${qr},${qg},${qb}`;
      colorBuckets.set(key, (colorBuckets.get(key) || 0) + 1);
    }

    // Sort buckets by frequency
    const sorted = [...colorBuckets.entries()].sort((a, b) => b[1] - a[1]);

    // Get top colors
    const parseColor = (key) => key.split(',').map(Number);
    const palette = sorted.slice(0, 8).map(([key]) => parseColor(key));

    // Determine background vs foreground
    // Background is usually the most frequent or the lightest
    const avgBrightness = (totalR + totalG + totalB) / (pixelCount * 3 * 255);
    let background, dominant, secondary;

    if (palette.length >= 2) {
      const lum0 = (palette[0][0] * 0.299 + palette[0][1] * 0.587 + palette[0][2] * 0.114) / 255;
      const lum1 = (palette[1][0] * 0.299 + palette[1][1] * 0.587 + palette[1][2] * 0.114) / 255;

      if (sorted[0][1] > pixelCount * 0.3) {
        // Most frequent color is likely background
        background = palette[0];
        dominant = palette[1];
        secondary = palette[2] || palette[1];
      } else {
        background = lum0 > lum1 ? palette[0] : palette[1];
        dominant = lum0 > lum1 ? palette[1] : palette[0];
        secondary = palette[2] || dominant;
      }
    } else {
      background = [255, 255, 255];
      dominant = palette[0] || [0, 0, 0];
      secondary = dominant;
    }

    return {
      dominant,
      secondary,
      background,
      palette,
      brightness: avgBrightness,
      contrast: maxLum - minLum,
      saturation: totalSat / pixelCount,
    };
  }

  /**
   * Edge detection using Sobel operator
   */
  _analyzeEdges(imageData) {
    const { width, height, data } = imageData;
    const gray = new Float32Array(width * height);

    // Convert to grayscale
    for (let i = 0; i < gray.length; i++) {
      const idx = i * 4;
      gray[i] = (data[idx] * 0.299 + data[idx + 1] * 0.587 + data[idx + 2] * 0.114) / 255;
    }

    // Sobel edge detection
    const edgeMap = new Float32Array(width * height);
    let totalEdge = 0;

    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const idx = y * width + x;
        // Sobel X
        const gx =
          -gray[(y - 1) * width + (x - 1)] + gray[(y - 1) * width + (x + 1)]
          - 2 * gray[y * width + (x - 1)] + 2 * gray[y * width + (x + 1)]
          - gray[(y + 1) * width + (x - 1)] + gray[(y + 1) * width + (x + 1)];
        // Sobel Y
        const gy =
          -gray[(y - 1) * width + (x - 1)] - 2 * gray[(y - 1) * width + x] - gray[(y - 1) * width + (x + 1)]
          + gray[(y + 1) * width + (x - 1)] + 2 * gray[(y + 1) * width + x] + gray[(y + 1) * width + (x + 1)];

        const magnitude = Math.sqrt(gx * gx + gy * gy);
        edgeMap[idx] = Math.min(1, magnitude);
        totalEdge += edgeMap[idx];
      }
    }

    const density = totalEdge / (width * height);

    return { edgeMap, density, width, height };
  }

  /**
   * Texture analysis: roughness, grain, pattern detection
   */
  _analyzeTexture(pixels, width, height) {
    // Compute local variance in small blocks
    const blockSize = 8;
    let totalVariance = 0;
    let blockCount = 0;
    let highFreqEnergy = 0;

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
        const variance = sumSq / count - mean * mean;
        totalVariance += variance;
        blockCount++;

        // High frequency content = rapid changes within block
        if (variance > 0.02) highFreqEnergy++;
      }
    }

    const avgVariance = blockCount > 0 ? totalVariance / blockCount : 0;
    const highFreqRatio = blockCount > 0 ? highFreqEnergy / blockCount : 0;

    return {
      roughness: Math.min(1, avgVariance * 10),
      textureStrength: Math.min(1, highFreqRatio * 2),
      noise: Math.min(1, avgVariance * 5),
    };
  }

  /**
   * Structural analysis: stroke weight, contrast, serif detection, curvature
   */
  _analyzeStructure(edgeMap, width, height) {
    // Analyze stroke width by measuring distances between edge pairs
    const strokeWidths = [];
    const edgeThreshold = 0.3;

    // Scan horizontal lines for edge-to-edge distances
    for (let y = 0; y < height; y += 4) {
      let lastEdge = -1;
      for (let x = 0; x < width; x++) {
        if (edgeMap[y * width + x] > edgeThreshold) {
          if (lastEdge >= 0) {
            const dist = x - lastEdge;
            if (dist > 1 && dist < width / 4) {
              strokeWidths.push(dist);
            }
          }
          lastEdge = x;
        }
      }
    }

    // Analyze stroke width distribution
    let avgStroke = 0, minStroke = Infinity, maxStroke = 0;
    if (strokeWidths.length > 0) {
      strokeWidths.sort((a, b) => a - b);
      const median = strokeWidths[Math.floor(strokeWidths.length / 2)];
      avgStroke = median;
      // Use interquartile range
      const q1 = strokeWidths[Math.floor(strokeWidths.length * 0.25)];
      const q3 = strokeWidths[Math.floor(strokeWidths.length * 0.75)];
      minStroke = q1;
      maxStroke = q3;
    }

    const normalizedWeight = Math.min(1, avgStroke / (width * 0.15));
    const strokeContrast = maxStroke > 0 ? Math.min(1, (maxStroke - minStroke) / maxStroke) : 0;

    // Detect serifs: look for small horizontal features at top/bottom of vertical strokes
    let serifScore = 0;
    const topRegion = Math.floor(height * 0.15);
    const bottomRegion = Math.floor(height * 0.85);

    for (let x = 0; x < width; x += 2) {
      let topEdges = 0, bottomEdges = 0, midEdges = 0;
      for (let y = 0; y < topRegion; y++) {
        if (edgeMap[y * width + x] > edgeThreshold) topEdges++;
      }
      for (let y = bottomRegion; y < height; y++) {
        if (edgeMap[y * width + x] > edgeThreshold) bottomEdges++;
      }
      for (let y = topRegion; y < bottomRegion; y++) {
        if (edgeMap[y * width + x] > edgeThreshold) midEdges++;
      }
      if (midEdges > 0 && (topEdges > midEdges * 0.3 || bottomEdges > midEdges * 0.3)) {
        serifScore++;
      }
    }
    const serifness = Math.min(1, (serifScore / (width / 2)) * 3);

    // Curvature: ratio of diagonal to axis-aligned edges
    let diagonalEdges = 0, totalEdges = 0;
    for (let y = 1; y < height - 1; y += 2) {
      for (let x = 1; x < width - 1; x += 2) {
        const e = edgeMap[y * width + x];
        if (e > edgeThreshold) {
          totalEdges++;
          // Check if this is a diagonal edge (neighbors in diagonal positions also edges)
          const diagStrength =
            edgeMap[(y - 1) * width + (x - 1)] + edgeMap[(y - 1) * width + (x + 1)] +
            edgeMap[(y + 1) * width + (x - 1)] + edgeMap[(y + 1) * width + (x + 1)];
          const axisStrength =
            edgeMap[(y - 1) * width + x] + edgeMap[y * width + (x - 1)] +
            edgeMap[(y + 1) * width + x] + edgeMap[y * width + (x + 1)];
          if (diagStrength > axisStrength) diagonalEdges++;
        }
      }
    }
    const curvature = totalEdges > 0 ? Math.min(1, (diagonalEdges / totalEdges) * 2) : 0.5;

    return {
      weight: normalizedWeight,
      strokeContrast,
      strokeWidth: normalizedWeight,
      serifness,
      curvature,
    };
  }

  /**
   * Extract a repeatable texture tile from the source image
   */
  _extractTextureTile(img) {
    const tileSize = 128;
    const tileCanvas = document.createElement('canvas');
    tileCanvas.width = tileSize;
    tileCanvas.height = tileSize;
    const tCtx = tileCanvas.getContext('2d');

    // Sample from center of image for best texture representation
    const sx = Math.max(0, (img.width - tileSize) / 2);
    const sy = Math.max(0, (img.height - tileSize) / 2);
    const sw = Math.min(tileSize, img.width);
    const sh = Math.min(tileSize, img.height);

    tCtx.drawImage(img, sx, sy, sw, sh, 0, 0, tileSize, tileSize);
    return tCtx.getImageData(0, 0, tileSize, tileSize);
  }
}

export default StyleExtractor;
