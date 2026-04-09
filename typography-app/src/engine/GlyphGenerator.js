/**
 * GlyphGenerator — procedural glyph system with editable vector paths.
 *
 * Each character is rendered to a temporary canvas, then its outline is
 * traced to produce editable bezier path data. Style transforms are
 * applied to the path before final rendering.
 */

const GLYPH_CACHE = new Map();
const GLYPH_SIZE = 200; // render resolution per glyph
const CONTOUR_THRESHOLD = 128;

export class GlyphGenerator {
  constructor() {
    this._tmpCanvas = document.createElement('canvas');
    this._tmpCanvas.width = GLYPH_SIZE;
    this._tmpCanvas.height = GLYPH_SIZE;
    this._tmpCtx = this._tmpCanvas.getContext('2d', { willReadFrequently: true });
  }

  /**
   * Generate a complete glyph object for a character with given style
   */
  generateGlyph(char, style) {
    const cacheKey = `${char}_${style.weight}_${style.serifness}_${style.curvature}`;
    if (GLYPH_CACHE.has(cacheKey)) {
      return this._applyStyleToGlyph(GLYPH_CACHE.get(cacheKey), style);
    }

    // Step 1: Render character with base font
    const baseFont = this._selectBaseFont(style);
    const baseFontSize = GLYPH_SIZE * 0.7;
    const ctx = this._tmpCtx;

    ctx.clearRect(0, 0, GLYPH_SIZE, GLYPH_SIZE);
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, GLYPH_SIZE, GLYPH_SIZE);
    ctx.fillStyle = 'black';
    ctx.font = `${baseFont.weight} ${baseFont.style} ${baseFontSize}px ${baseFont.family}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(char, GLYPH_SIZE / 2, GLYPH_SIZE / 2);

    // Step 2: Extract outline paths via contour tracing
    const imageData = ctx.getImageData(0, 0, GLYPH_SIZE, GLYPH_SIZE);
    const contours = this._traceContours(imageData);

    // Step 3: Simplify contours to bezier curves
    const paths = contours.map(contour => this._simplifyToBezier(contour));

    // Step 4: Compute metrics
    const bounds = this._computeBounds(contours);
    const metrics = ctx.measureText(char);

    const glyph = {
      char,
      paths,
      contours,
      bounds,
      advance: metrics.width / GLYPH_SIZE,
      ascent: metrics.actualBoundingBoxAscent / baseFontSize,
      descent: metrics.actualBoundingBoxDescent / baseFontSize,
      anchors: this._extractAnchors(paths),
      originalPaths: paths.map(p => ({ ...p, points: [...p.points] })),
    };

    GLYPH_CACHE.set(cacheKey, glyph);
    return this._applyStyleToGlyph(glyph, style);
  }

  /**
   * Select base font family based on style parameters
   */
  _selectBaseFont(style) {
    let family;
    if (style.serifness > 0.6) {
      family = 'Georgia, "Times New Roman", serif';
    } else if (style.serifness > 0.3) {
      family = '"Palatino Linotype", "Book Antiqua", serif';
    } else if (style.curvature > 0.7) {
      family = '"Trebuchet MS", "Gill Sans", sans-serif';
    } else {
      family = '"Helvetica Neue", Arial, sans-serif';
    }

    const weightMap = [100, 200, 300, 400, 500, 600, 700, 800, 900];
    const weight = weightMap[Math.min(8, Math.max(0, Math.round(style.weight * 8)))];

    return {
      family,
      weight,
      style: style.slant > 0.3 ? 'italic' : 'normal',
    };
  }

  /**
   * Contour tracing using marching squares algorithm
   */
  _traceContours(imageData) {
    const { data, width, height } = imageData;
    const visited = new Uint8Array(width * height);
    const contours = [];

    // Create binary image (black text on white background)
    const binary = new Uint8Array(width * height);
    for (let i = 0; i < binary.length; i++) {
      const idx = i * 4;
      const lum = data[idx] * 0.299 + data[idx + 1] * 0.587 + data[idx + 2] * 0.114;
      binary[i] = lum < CONTOUR_THRESHOLD ? 1 : 0;
    }

    // Find contour starting points
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const idx = y * width + x;
        if (binary[idx] === 1 && binary[idx - 1] === 0 && !visited[idx]) {
          const contour = this._traceContour(binary, visited, x, y, width, height);
          if (contour.length >= 8) {
            contours.push(contour);
          }
        }
      }
    }

    return contours;
  }

  _traceContour(binary, visited, startX, startY, width, height) {
    const contour = [];
    const dirs = [
      [0, -1], [1, -1], [1, 0], [1, 1],
      [0, 1], [-1, 1], [-1, 0], [-1, -1],
    ];

    let x = startX, y = startY;
    let dir = 0;
    let steps = 0;
    const maxSteps = width * height;

    do {
      contour.push({ x: x / GLYPH_SIZE, y: y / GLYPH_SIZE });
      visited[y * width + x] = 1;

      // Find next boundary pixel
      let found = false;
      const startDir = (dir + 5) % 8; // turn back-left
      for (let i = 0; i < 8; i++) {
        const d = (startDir + i) % 8;
        const nx = x + dirs[d][0];
        const ny = y + dirs[d][1];
        if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
          if (binary[ny * width + nx] === 1) {
            x = nx;
            y = ny;
            dir = d;
            found = true;
            break;
          }
        }
      }

      if (!found) break;
      steps++;
    } while ((x !== startX || y !== startY) && steps < maxSteps);

    // Subsample for performance
    if (contour.length > 200) {
      const step = Math.ceil(contour.length / 200);
      return contour.filter((_, i) => i % step === 0);
    }

    return contour;
  }

  /**
   * Simplify contour points into bezier curves using Ramer-Douglas-Peucker
   */
  _simplifyToBezier(contour) {
    if (contour.length < 3) {
      return { type: 'line', points: contour };
    }

    // RDP simplification
    const simplified = this._rdpSimplify(contour, 0.005);

    // Convert point pairs to cubic bezier segments
    const segments = [];
    for (let i = 0; i < simplified.length; i++) {
      const p0 = simplified[i];
      const p1 = simplified[(i + 1) % simplified.length];
      const p2 = simplified[(i + 2) % simplified.length];

      // Generate control points for smooth curve
      const cp1 = {
        x: p0.x + (p1.x - p0.x) * 0.5,
        y: p0.y + (p1.y - p0.y) * 0.5,
      };
      const cp2 = {
        x: p1.x - (p2.x - p0.x) * 0.15,
        y: p1.y - (p2.y - p0.y) * 0.15,
      };

      segments.push({
        start: p0,
        cp1,
        cp2,
        end: p1,
      });
    }

    return {
      type: 'bezier',
      points: simplified,
      segments,
      closed: true,
    };
  }

  _rdpSimplify(points, epsilon) {
    if (points.length <= 2) return points;

    let maxDist = 0, maxIdx = 0;
    const start = points[0];
    const end = points[points.length - 1];

    for (let i = 1; i < points.length - 1; i++) {
      const dist = this._pointLineDistance(points[i], start, end);
      if (dist > maxDist) {
        maxDist = dist;
        maxIdx = i;
      }
    }

    if (maxDist > epsilon) {
      const left = this._rdpSimplify(points.slice(0, maxIdx + 1), epsilon);
      const right = this._rdpSimplify(points.slice(maxIdx), epsilon);
      return [...left.slice(0, -1), ...right];
    }

    return [start, end];
  }

  _pointLineDistance(point, lineStart, lineEnd) {
    const dx = lineEnd.x - lineStart.x;
    const dy = lineEnd.y - lineStart.y;
    const lenSq = dx * dx + dy * dy;
    if (lenSq === 0) return Math.sqrt((point.x - lineStart.x) ** 2 + (point.y - lineStart.y) ** 2);

    let t = ((point.x - lineStart.x) * dx + (point.y - lineStart.y) * dy) / lenSq;
    t = Math.max(0, Math.min(1, t));

    const projX = lineStart.x + t * dx;
    const projY = lineStart.y + t * dy;
    return Math.sqrt((point.x - projX) ** 2 + (point.y - projY) ** 2);
  }

  /**
   * Compute bounding box of all contour points
   */
  _computeBounds(contours) {
    let minX = 1, minY = 1, maxX = 0, maxY = 0;
    for (const contour of contours) {
      for (const p of contour) {
        minX = Math.min(minX, p.x);
        minY = Math.min(minY, p.y);
        maxX = Math.max(maxX, p.x);
        maxY = Math.max(maxY, p.y);
      }
    }
    return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
  }

  /**
   * Extract editable anchor points from paths
   */
  _extractAnchors(paths) {
    const anchors = [];
    for (const path of paths) {
      if (path.segments) {
        for (let i = 0; i < path.segments.length; i++) {
          const seg = path.segments[i];
          anchors.push({
            id: `a_${anchors.length}`,
            x: seg.start.x,
            y: seg.start.y,
            type: 'smooth',
            handleIn: seg.cp1 ? { x: seg.cp1.x, y: seg.cp1.y } : null,
            handleOut: seg.cp2 ? { x: seg.cp2.x, y: seg.cp2.y } : null,
          });
        }
      } else {
        for (const p of path.points) {
          anchors.push({
            id: `a_${anchors.length}`,
            x: p.x,
            y: p.y,
            type: 'corner',
            handleIn: null,
            handleOut: null,
          });
        }
      }
    }
    return anchors;
  }

  /**
   * Apply style transformations to a glyph
   */
  _applyStyleToGlyph(glyph, style) {
    const styledGlyph = {
      ...glyph,
      style: { ...style },
      styledPaths: glyph.paths.map(path => this._transformPath(path, style)),
    };
    return styledGlyph;
  }

  _transformPath(path, style) {
    if (!path.points || path.points.length === 0) return path;

    const transformed = {
      ...path,
      points: path.points.map(p => {
        let { x, y } = p;

        // Apply slant/italic
        if (style.slant) {
          x += (0.5 - y) * style.slant * 0.3;
        }

        // Apply distortion
        if (style.distortion > 0) {
          const freq = 8;
          x += Math.sin(y * freq * Math.PI) * style.distortion * 0.02;
          y += Math.cos(x * freq * Math.PI) * style.distortion * 0.01;
        }

        // Apply perspective
        if (style.perspectiveX || style.perspectiveY) {
          const cx = 0.5, cy = 0.5;
          const dx = x - cx, dy = y - cy;
          const perspFactor = 1 + dy * style.perspectiveY * 0.3 + dx * style.perspectiveX * 0.3;
          x = cx + dx * perspFactor;
          y = cy + dy * perspFactor;
        }

        return { x, y };
      }),
    };

    // Recalculate bezier segments if they exist
    if (path.segments) {
      transformed.segments = [];
      for (let i = 0; i < transformed.points.length; i++) {
        const p0 = transformed.points[i];
        const p1 = transformed.points[(i + 1) % transformed.points.length];
        const p2 = transformed.points[(i + 2) % transformed.points.length];

        const smoothing = style.curvature * 0.4;
        transformed.segments.push({
          start: p0,
          cp1: {
            x: p0.x + (p1.x - p0.x) * (0.3 + smoothing),
            y: p0.y + (p1.y - p0.y) * (0.3 + smoothing),
          },
          cp2: {
            x: p1.x - (p2.x - p0.x) * (0.1 + smoothing * 0.2),
            y: p1.y - (p2.y - p0.y) * (0.1 + smoothing * 0.2),
          },
          end: p1,
        });
      }
    }

    return transformed;
  }

  /**
   * Update a specific anchor point (for interactive editing)
   */
  updateAnchor(glyph, anchorId, newX, newY) {
    const anchor = glyph.anchors.find(a => a.id === anchorId);
    if (!anchor) return glyph;

    const dx = newX - anchor.x;
    const dy = newY - anchor.y;
    anchor.x = newX;
    anchor.y = newY;
    if (anchor.handleIn) {
      anchor.handleIn.x += dx;
      anchor.handleIn.y += dy;
    }
    if (anchor.handleOut) {
      anchor.handleOut.x += dx;
      anchor.handleOut.y += dy;
    }

    // Rebuild paths from anchors
    return this._rebuildFromAnchors(glyph);
  }

  _rebuildFromAnchors(glyph) {
    let anchorIdx = 0;
    const newPaths = glyph.paths.map(path => {
      const points = [];
      const count = path.points ? path.points.length : 0;
      for (let i = 0; i < count && anchorIdx < glyph.anchors.length; i++) {
        points.push({ x: glyph.anchors[anchorIdx].x, y: glyph.anchors[anchorIdx].y });
        anchorIdx++;
      }
      return { ...path, points };
    });

    return { ...glyph, paths: newPaths };
  }

  /**
   * Clear the glyph cache
   */
  clearCache() {
    GLYPH_CACHE.clear();
  }

  /**
   * Synthesize a missing glyph by interpolating between known ones
   */
  synthesizeGlyph(char, style, knownGlyphs) {
    // Find closest known characters by shape similarity
    const charCode = char.charCodeAt(0);
    let bestMatch = null, bestDist = Infinity;

    for (const [key, glyph] of knownGlyphs) {
      const dist = Math.abs(key.charCodeAt(0) - charCode);
      if (dist < bestDist && dist > 0) {
        bestDist = dist;
        bestMatch = glyph;
      }
    }

    if (bestMatch) {
      // Use the closest glyph as a base and modify slightly
      return {
        ...bestMatch,
        char,
        synthesized: true,
      };
    }

    // Fallback: generate with default style
    return this.generateGlyph(char, style);
  }
}

export default GlyphGenerator;
