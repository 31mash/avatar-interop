/**
 * Export utilities: PNG, SVG, vector paths
 */

/**
 * Export canvas as PNG file download
 */
export function exportPNG(canvas, filename = 'typeforge-export.png') {
  const link = document.createElement('a');
  link.download = filename;
  link.href = canvas.toDataURL('image/png');
  link.click();
}

/**
 * Export text as SVG with styled paths
 */
export function exportSVG(text, style, layout, glyphData, width, height) {
  const [pr, pg, pb] = style.primaryColor || [0, 0, 0];
  const [br, bg, bb] = style.backgroundColor || [255, 255, 255];
  const fillColor = `rgb(${pr},${pg},${pb})`;
  const bgColor = `rgb(${br},${bg},${bb})`;

  let svgContent = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
  <rect width="100%" height="100%" fill="${bgColor}"/>
  <g fill="${fillColor}">
`;

  // Add filter for effects
  if (style.glowStrength > 0) {
    svgContent += `  <defs>
    <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="${4 + style.glowStrength * 12}" result="blur"/>
      <feFlood flood-color="${fillColor}" flood-opacity="${style.glowStrength}"/>
      <feComposite in2="blur" operator="in"/>
      <feMerge>
        <feMergeNode/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
  </defs>
`;
  }

  // Render glyphs as SVG paths or text elements
  if (glyphData && glyphData.length > 0) {
    for (const { glyph, x, y, width: gw, height: gh } of glyphData) {
      if (glyph.styledPaths) {
        for (const path of glyph.styledPaths) {
          if (!path.points || path.points.length < 2) continue;

          let d = '';
          if (path.segments && path.segments.length > 0) {
            const first = path.segments[0].start;
            d += `M ${x + first.x * gw} ${y + first.y * gh} `;

            for (const seg of path.segments) {
              d += `C ${x + seg.cp1.x * gw} ${y + seg.cp1.y * gh} `;
              d += `${x + seg.cp2.x * gw} ${y + seg.cp2.y * gh} `;
              d += `${x + seg.end.x * gw} ${y + seg.end.y * gh} `;
            }
            if (path.closed) d += 'Z';
          }

          if (d) {
            const filterAttr = style.glowStrength > 0 ? ' filter="url(#glow)"' : '';
            svgContent += `    <path d="${d}"${filterAttr}/>\n`;
          }
        }
      } else {
        // Fallback to text element
        const weight = Math.round(100 + (style.weight || 0.5) * 800);
        const family = style.serifness > 0.5 ? 'Georgia, serif' : 'Helvetica, sans-serif';
        const filterAttr = style.glowStrength > 0 ? ' filter="url(#glow)"' : '';
        svgContent += `    <text x="${x}" y="${y + gh * 0.75}" font-family="${family}" font-weight="${weight}" font-size="${gh}"${filterAttr}>${escapeXml(glyph.char)}</text>\n`;
      }
    }
  } else {
    // Simple text fallback
    const weight = Math.round(100 + (style.weight || 0.5) * 800);
    const family = style.serifness > 0.5 ? 'Georgia, serif' : 'Helvetica, sans-serif';
    const fontSize = layout ? layout.fontSize : 72;
    const lines = text.split('\n');
    lines.forEach((line, i) => {
      svgContent += `    <text x="40" y="${80 + i * fontSize * 1.4}" font-family="${family}" font-weight="${weight}" font-size="${fontSize}">${escapeXml(line)}</text>\n`;
    });
  }

  svgContent += `  </g>\n</svg>`;

  return svgContent;
}

function escapeXml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Download SVG file
 */
export function downloadSVG(svgContent, filename = 'typeforge-export.svg') {
  const blob = new Blob([svgContent], { type: 'image/svg+xml' });
  const link = document.createElement('a');
  link.download = filename;
  link.href = URL.createObjectURL(blob);
  link.click();
  URL.revokeObjectURL(link.href);
}

/**
 * Export glyph paths as JSON (for font editors)
 */
export function exportGlyphPaths(glyphData) {
  const paths = {};

  for (const { glyph } of glyphData) {
    paths[glyph.char] = {
      char: glyph.char,
      advance: glyph.advance,
      bounds: glyph.bounds,
      paths: (glyph.styledPaths || glyph.paths).map(path => ({
        type: path.type,
        closed: path.closed,
        points: path.points,
        segments: path.segments ? path.segments.map(s => ({
          start: s.start,
          cp1: s.cp1,
          cp2: s.cp2,
          end: s.end,
        })) : null,
      })),
    };
  }

  const json = JSON.stringify(paths, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const link = document.createElement('a');
  link.download = 'typeforge-glyphs.json';
  link.href = URL.createObjectURL(blob);
  link.click();
  URL.revokeObjectURL(link.href);
}

/**
 * Copy canvas to clipboard
 */
export async function copyToClipboard(canvas) {
  try {
    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
    await navigator.clipboard.write([
      new ClipboardItem({ 'image/png': blob }),
    ]);
    return true;
  } catch {
    return false;
  }
}
