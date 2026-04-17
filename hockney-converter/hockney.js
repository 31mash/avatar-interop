/**
 * Hockney Joiner / Panography algorithm.
 *
 * Takes a source image and recreates it as a collage of overlapping,
 * slightly rotated, color-shifted rectangular photo fragments —
 * mimicking David Hockney's photographic joiners.
 */

/**
 * @param {HTMLImageElement} img        Source image (already loaded)
 * @param {HTMLCanvasElement} canvas    Target canvas (will be resized)
 * @param {Object} opts                 User-adjustable parameters
 */
export function generateJoiner(img, canvas, opts) {
  const {
    cols = 6,
    rows = 5,
    maxRotation = 4,      // degrees
    scatter = 8,          // px offset per tile
    overlap = 15,         // % extra size per tile
    colorShift = 10,      // max brightness/hue shift
    borderWidth = 3,      // white border around each tile
    shadowBlur = 6,       // drop-shadow blur radius
  } = opts;

  // ---- layout math ----
  const srcW = img.naturalWidth;
  const srcH = img.naturalHeight;

  // Tile dimensions on the *source* image (without overlap)
  const baseTileW = srcW / cols;
  const baseTileH = srcH / rows;

  // Overlap fraction
  const overlapFrac = overlap / 100;

  // Actual source crop size per tile (larger than base to create overlap)
  const cropW = baseTileW * (1 + overlapFrac);
  const cropH = baseTileH * (1 + overlapFrac);

  // Output canvas – add padding for scatter, rotation, and borders
  const padding = Math.max(scatter, borderWidth) * 2 + 40;
  const outW = srcW + padding * 2;
  const outH = srcH + padding * 2;
  canvas.width = outW;
  canvas.height = outH;

  const ctx = canvas.getContext('2d');

  // Background — off-white like a photo table
  ctx.fillStyle = '#f0ece4';
  ctx.fillRect(0, 0, outW, outH);

  // ---- build tile list ----
  const tiles = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      // Source crop origin (centred on the grid cell, so overlap bleeds equally)
      const sx = c * baseTileW - (cropW - baseTileW) / 2;
      const sy = r * baseTileH - (cropH - baseTileH) / 2;

      // Destination centre on the output canvas
      const dx = padding + c * baseTileW + baseTileW / 2;
      const dy = padding + r * baseTileH + baseTileH / 2;

      tiles.push({ sx, sy, dx, dy, c, r });
    }
  }

  // Shuffle draw order slightly so overlaps look natural
  shuffleArray(tiles);

  // ---- draw each tile ----
  for (const tile of tiles) {
    const angle = (Math.random() - 0.5) * 2 * maxRotation * (Math.PI / 180);
    const offsetX = (Math.random() - 0.5) * 2 * scatter;
    const offsetY = (Math.random() - 0.5) * 2 * scatter;

    // Clamp source rect to image bounds
    const csx = Math.max(0, tile.sx);
    const csy = Math.max(0, tile.sy);
    const cex = Math.min(srcW, tile.sx + cropW);
    const cey = Math.min(srcH, tile.sy + cropH);
    const cw = cex - csx;
    const ch = cey - csy;
    if (cw <= 0 || ch <= 0) continue;

    // Draw tile
    ctx.save();
    ctx.translate(tile.dx + offsetX, tile.dy + offsetY);
    ctx.rotate(angle);

    // Shadow
    if (shadowBlur > 0) {
      ctx.shadowColor = 'rgba(0,0,0,0.25)';
      ctx.shadowBlur = shadowBlur;
      ctx.shadowOffsetX = 2;
      ctx.shadowOffsetY = 2;
    }

    // White border rectangle behind the image fragment
    const drawW = cw;
    const drawH = ch;
    ctx.fillStyle = '#fff';
    ctx.fillRect(
      -drawW / 2 - borderWidth,
      -drawH / 2 - borderWidth,
      drawW + borderWidth * 2,
      drawH + borderWidth * 2,
    );

    // Turn off shadow for the image draw so it doesn't double
    ctx.shadowColor = 'transparent';

    // Draw the image fragment
    ctx.drawImage(
      img,
      csx, csy, cw, ch,         // source rect
      -drawW / 2, -drawH / 2,   // dest origin
      drawW, drawH,              // dest size
    );

    // Color / exposure shift overlay
    if (colorShift > 0) {
      const brightness = (Math.random() - 0.5) * 2 * colorShift;
      if (brightness > 0) {
        ctx.fillStyle = `rgba(255,255,255,${brightness / 100})`;
      } else {
        ctx.fillStyle = `rgba(0,0,0,${-brightness / 100})`;
      }
      ctx.fillRect(-drawW / 2, -drawH / 2, drawW, drawH);

      // Subtle warm/cool tint
      const tintR = Math.random() > 0.5 ? 1 : 0;
      const tintB = 1 - tintR;
      ctx.fillStyle = `rgba(${tintR * 180},${80},${tintB * 180},${(colorShift / 100) * 0.15})`;
      ctx.fillRect(-drawW / 2, -drawH / 2, drawW, drawH);
    }

    ctx.restore();
  }
}

/** Fisher-Yates shuffle */
function shuffleArray(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}
