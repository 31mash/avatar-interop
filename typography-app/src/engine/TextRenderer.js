/**
 * TextRenderer — high-performance Canvas/WebGL text rendering pipeline.
 * Renders styled glyphs with texture, distortion, and effects.
 */

import { GlyphGenerator } from './GlyphGenerator.js';

export class TextRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.glyphGen = new GlyphGenerator();
    this.glyphCache = new Map();
    this.renderQueue = [];
    this._animFrame = null;
    this._lastRender = 0;
    this._texturePattern = null;
    this.debugMode = false;
    this.dpr = window.devicePixelRatio || 1;
  }

  /**
   * Resize canvas for HiDPI
   */
  resize(width, height) {
    this.canvas.width = width * this.dpr;
    this.canvas.height = height * this.dpr;
    this.canvas.style.width = `${width}px`;
    this.canvas.style.height = `${height}px`;
    this.ctx.scale(this.dpr, this.dpr);
    this.logicalWidth = width;
    this.logicalHeight = height;
  }

  /**
   * Main render: draw styled text on canvas
   */
  render(text, style, options = {}) {
    const ctx = this.ctx;
    const {
      x: startX = 40,
      y: startY = null,
      maxWidth = this.logicalWidth - 80,
      fontSize = 72,
      debugMode = this.debugMode,
    } = options;

    // Clear canvas
    const [br, bg, bb] = style.backgroundColor || [18, 18, 20];
    ctx.save();
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.fillStyle = `rgb(${br},${bg},${bb})`;
    ctx.fillRect(0, 0, this.logicalWidth, this.logicalHeight);

    // Setup texture pattern if available
    if (style.textureData && style.textureStrength > 0) {
      this._prepareTexturePattern(style.textureData);
    }

    // Calculate layout
    const layout = this._layoutText(text, style, fontSize, startX, maxWidth);
    const actualStartY = startY || Math.max(80, (this.logicalHeight - layout.totalHeight) / 2);

    // Render each glyph
    const glyphData = [];
    for (let lineIdx = 0; lineIdx < layout.lines.length; lineIdx++) {
      const line = layout.lines[lineIdx];
      const lineY = actualStartY + lineIdx * layout.lineHeight;

      for (const glyphLayout of line.glyphs) {
        const glyph = this._getOrGenerateGlyph(glyphLayout.char, style);
        const gx = glyphLayout.x;
        const gy = lineY;
        const gw = glyphLayout.width;
        const gh = fontSize;

        this._renderGlyph(ctx, glyph, style, gx, gy, gw, gh, fontSize);

        if (debugMode) {
          glyphData.push({ glyph, x: gx, y: gy, width: gw, height: gh });
        }
      }
    }

    // Debug overlay
    if (debugMode) {
      this._renderDebugOverlay(ctx, glyphData, layout, actualStartY, fontSize);
    }

    ctx.restore();

    return { layout, glyphData };
  }

  /**
   * Layout text into lines with kerning and spacing
   */
  _layoutText(text, style, fontSize, startX, maxWidth) {
    const ctx = this.ctx;
    const baseFont = this._getBaseFont(style, fontSize);
    ctx.font = baseFont;

    const spacingAdjust = 1 + (style.letterSpacing || 0);
    const wordSpacingAdjust = 1 + (style.wordSpacing || 0);
    const lineHeight = fontSize * (style.lineHeight || 1.4);

    const lines = [];
    let currentLine = { glyphs: [], width: 0 };
    let cursorX = startX;

    for (let i = 0; i < text.length; i++) {
      const char = text[i];

      if (char === '\n') {
        lines.push(currentLine);
        currentLine = { glyphs: [], width: 0 };
        cursorX = startX;
        continue;
      }

      const metrics = ctx.measureText(char);
      let charWidth = metrics.width * spacingAdjust;

      if (char === ' ') {
        charWidth *= wordSpacingAdjust;
      }

      // Word wrap
      if (cursorX + charWidth > startX + maxWidth && char !== ' ' && currentLine.glyphs.length > 0) {
        lines.push(currentLine);
        currentLine = { glyphs: [], width: 0 };
        cursorX = startX;
      }

      currentLine.glyphs.push({
        char,
        x: cursorX,
        width: charWidth,
        index: i,
      });

      currentLine.width = cursorX + charWidth - startX;
      cursorX += charWidth;
    }

    if (currentLine.glyphs.length > 0) {
      lines.push(currentLine);
    }

    return {
      lines,
      lineHeight,
      totalHeight: lines.length * lineHeight,
      fontSize,
    };
  }

  /**
   * Get or generate a cached glyph
   */
  _getOrGenerateGlyph(char, style) {
    const key = `${char}_${Math.round(style.weight * 10)}_${Math.round(style.serifness * 10)}`;
    if (!this.glyphCache.has(key)) {
      this.glyphCache.set(key, this.glyphGen.generateGlyph(char, style));
    }
    return this.glyphCache.get(key);
  }

  /**
   * Render a single glyph with all style effects
   */
  _renderGlyph(ctx, glyph, style, x, y, width, height, fontSize) {
    ctx.save();

    // Apply per-glyph transform
    const cx = x + width / 2;
    const cy = y + height / 2;

    ctx.translate(cx, cy);

    // Rotation
    if (style.rotation) {
      ctx.rotate((style.rotation * Math.PI) / 180);
    }

    // Perspective simulation via skew
    if (style.perspectiveX) {
      ctx.transform(1, 0, style.perspectiveX * 0.2, 1, 0, 0);
    }
    if (style.perspectiveY) {
      ctx.transform(1, style.perspectiveY * 0.2, 0, 1, 0, 0);
    }

    ctx.translate(-cx, -cy);

    // Apply distortion via path warping
    if (style.distortion > 0.01 && glyph.styledPaths) {
      this._renderGlyphFromPaths(ctx, glyph, style, x, y, width, height);
    } else {
      this._renderGlyphDirect(ctx, glyph, style, x, y, width, height, fontSize);
    }

    ctx.restore();
  }

  /**
   * Render glyph using direct canvas text (fast path)
   */
  _renderGlyphDirect(ctx, glyph, style, x, y, width, height, fontSize) {
    const font = this._getBaseFont(style, fontSize);
    ctx.font = font;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';

    const [pr, pg, pb] = style.primaryColor || [255, 255, 255];

    // Glow effect
    if (style.glowStrength > 0) {
      ctx.shadowColor = `rgba(${pr},${pg},${pb},${style.glowStrength})`;
      ctx.shadowBlur = 8 + style.glowStrength * 24;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 0;
    }

    // Stroke for weight enhancement
    if (style.strokeWidth > 0.6) {
      ctx.strokeStyle = `rgb(${pr},${pg},${pb})`;
      ctx.lineWidth = (style.strokeWidth - 0.5) * 4;
      ctx.lineJoin = 'round';
      ctx.strokeText(glyph.char, x, y);
    }

    // Fill
    ctx.fillStyle = `rgb(${pr},${pg},${pb})`;

    // Apply roughness via shadow trick
    if (style.roughness > 0.1) {
      const r = style.roughness;
      for (let i = 0; i < 3; i++) {
        ctx.save();
        ctx.translate(
          (Math.random() - 0.5) * r * 2,
          (Math.random() - 0.5) * r * 2
        );
        ctx.globalAlpha = 0.4;
        ctx.fillText(glyph.char, x, y);
        ctx.restore();
      }
      ctx.globalAlpha = 1;
    }

    ctx.fillText(glyph.char, x, y);

    // Texture overlay
    if (style.textureStrength > 0 && this._texturePattern) {
      ctx.save();
      ctx.globalCompositeOperation = 'source-atop';
      ctx.globalAlpha = style.textureStrength * 0.6;
      ctx.fillStyle = this._texturePattern;
      ctx.fillRect(x - 2, y - 2, width + 4, height + 4);
      ctx.restore();
    }

    // Reset shadow
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
  }

  /**
   * Render glyph from vector paths (high-quality path for distortion)
   */
  _renderGlyphFromPaths(ctx, glyph, style, x, y, width, height) {
    const [pr, pg, pb] = style.primaryColor || [255, 255, 255];

    ctx.save();

    // Glow
    if (style.glowStrength > 0) {
      ctx.shadowColor = `rgba(${pr},${pg},${pb},${style.glowStrength})`;
      ctx.shadowBlur = 8 + style.glowStrength * 24;
    }

    ctx.fillStyle = `rgb(${pr},${pg},${pb})`;
    ctx.strokeStyle = `rgb(${pr},${pg},${pb})`;

    for (const path of glyph.styledPaths) {
      if (!path.points || path.points.length < 2) continue;

      ctx.beginPath();

      if (path.segments && path.segments.length > 0) {
        // Draw bezier curves
        const firstPt = path.segments[0].start;
        ctx.moveTo(x + firstPt.x * width, y + firstPt.y * height);

        for (const seg of path.segments) {
          ctx.bezierCurveTo(
            x + seg.cp1.x * width, y + seg.cp1.y * height,
            x + seg.cp2.x * width, y + seg.cp2.y * height,
            x + seg.end.x * width, y + seg.end.y * height
          );
        }
      } else {
        // Draw lines
        ctx.moveTo(x + path.points[0].x * width, y + path.points[0].y * height);
        for (let i = 1; i < path.points.length; i++) {
          ctx.lineTo(x + path.points[i].x * width, y + path.points[i].y * height);
        }
      }

      if (path.closed) ctx.closePath();
      ctx.fill();

      if (style.strokeWidth > 0.3) {
        ctx.lineWidth = style.strokeContrast * 2;
        ctx.stroke();
      }
    }

    ctx.shadowColor = 'transparent';
    ctx.restore();
  }

  /**
   * Render debug overlay showing glyph info
   */
  _renderDebugOverlay(ctx, glyphData, layout, startY, fontSize) {
    ctx.save();

    for (const { glyph, x, y, width, height } of glyphData) {
      // Bounding box
      ctx.strokeStyle = 'rgba(139, 92, 246, 0.5)';
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);
      ctx.strokeRect(x, y, width, height);
      ctx.setLineDash([]);

      // Baseline
      ctx.strokeStyle = 'rgba(236, 72, 153, 0.4)';
      ctx.beginPath();
      ctx.moveTo(x, y + height * 0.75);
      ctx.lineTo(x + width, y + height * 0.75);
      ctx.stroke();

      // Anchor points
      if (glyph.anchors) {
        for (const anchor of glyph.anchors) {
          const ax = x + anchor.x * width;
          const ay = y + anchor.y * height;

          ctx.fillStyle = anchor.type === 'smooth'
            ? 'rgba(52, 211, 153, 0.8)'
            : 'rgba(251, 191, 36, 0.8)';

          ctx.beginPath();
          ctx.arc(ax, ay, 2.5, 0, Math.PI * 2);
          ctx.fill();

          // Handle lines
          if (anchor.handleIn) {
            ctx.strokeStyle = 'rgba(52, 211, 153, 0.3)';
            ctx.beginPath();
            ctx.moveTo(ax, ay);
            ctx.lineTo(x + anchor.handleIn.x * width, y + anchor.handleIn.y * height);
            ctx.stroke();
          }
        }
      }

      // Char label
      ctx.fillStyle = 'rgba(139, 92, 246, 0.7)';
      ctx.font = '9px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillText(glyph.char, x + width / 2, y - 2);
    }

    // Line guides
    for (let i = 0; i < layout.lines.length; i++) {
      const lineY = startY + i * layout.lineHeight;
      ctx.strokeStyle = 'rgba(96, 165, 250, 0.2)';
      ctx.setLineDash([6, 4]);
      ctx.beginPath();
      ctx.moveTo(0, lineY);
      ctx.lineTo(this.logicalWidth, lineY);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    ctx.restore();
  }

  /**
   * Prepare texture pattern for overlay
   */
  _prepareTexturePattern(textureData) {
    if (this._texturePatternData === textureData) return;
    this._texturePatternData = textureData;

    const tmpCanvas = document.createElement('canvas');
    tmpCanvas.width = textureData.width;
    tmpCanvas.height = textureData.height;
    const tmpCtx = tmpCanvas.getContext('2d');
    tmpCtx.putImageData(textureData, 0, 0);
    this._texturePattern = this.ctx.createPattern(tmpCanvas, 'repeat');
  }

  /**
   * Build CSS font string from style
   */
  _getBaseFont(style, fontSize) {
    const weight = Math.round(100 + (style.weight || 0.5) * 800);
    const italic = (style.slant || 0) > 0.3 ? 'italic ' : '';
    let family;

    if ((style.serifness || 0) > 0.6) {
      family = 'Georgia, "Times New Roman", serif';
    } else if ((style.serifness || 0) > 0.3) {
      family = '"Palatino Linotype", "Book Antiqua", serif';
    } else {
      family = '"Helvetica Neue", Arial, sans-serif';
    }

    return `${italic}${weight} ${fontSize}px ${family}`;
  }

  /**
   * Clear glyph cache (call when style changes significantly)
   */
  invalidateCache() {
    this.glyphCache.clear();
    this.glyphGen.clearCache();
  }

  /**
   * Get rendered image data
   */
  getImageData() {
    return this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
  }

  /**
   * Export current canvas as data URL
   */
  toDataURL(format = 'image/png', quality = 0.95) {
    return this.canvas.toDataURL(format, quality);
  }

  dispose() {
    if (this._animFrame) cancelAnimationFrame(this._animFrame);
    this.glyphCache.clear();
  }
}

export default TextRenderer;
