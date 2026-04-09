import React, { useMemo } from 'react';

const GlyphDebugView = ({ glyphData, style, visible }) => {
  if (!visible || !glyphData || glyphData.length === 0) return null;

  const uniqueGlyphs = useMemo(() => {
    const seen = new Set();
    return glyphData.filter(({ glyph }) => {
      if (seen.has(glyph.char) || glyph.char === ' ') return false;
      seen.add(glyph.char);
      return true;
    });
  }, [glyphData]);

  return (
    <div className="absolute top-3 right-3 bg-surface-900/95 border border-surface-700 rounded-xl p-3 backdrop-blur-sm max-w-[320px] max-h-[400px] overflow-y-auto z-20 animate-fade-in">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-[10px] font-semibold uppercase tracking-wider text-violet-400">
          Glyph Inspector
        </h3>
        <span className="text-[10px] text-surface-500">
          {uniqueGlyphs.length} glyphs
        </span>
      </div>

      <div className="grid grid-cols-4 gap-1.5">
        {uniqueGlyphs.map(({ glyph, width, height }, i) => (
          <GlyphCard key={`${glyph.char}-${i}`} glyph={glyph} style={style} />
        ))}
      </div>

      {/* Legend */}
      <div className="mt-3 pt-2 border-t border-surface-800 space-y-1">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-violet-500/50" />
          <span className="text-[9px] text-surface-500">Bounding box</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-emerald-500" />
          <span className="text-[9px] text-surface-500">Smooth anchor</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-amber-500" />
          <span className="text-[9px] text-surface-500">Corner anchor</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2 h-0.5 bg-pink-500/40" />
          <span className="text-[9px] text-surface-500">Baseline</span>
        </div>
      </div>
    </div>
  );
};

const GlyphCard = ({ glyph, style }) => {
  const pathCount = glyph.paths?.length || 0;
  const anchorCount = glyph.anchors?.length || 0;
  const [pr, pg, pb] = style?.primaryColor || [255, 255, 255];

  return (
    <div className="bg-surface-800/50 border border-surface-700/50 rounded-lg p-1.5 hover:border-violet-500/30 transition-colors group">
      {/* Mini glyph preview */}
      <div className="w-full aspect-square flex items-center justify-center mb-1 relative">
        <span
          className="text-xl font-bold leading-none"
          style={{ color: `rgb(${pr},${pg},${pb})` }}
        >
          {glyph.char}
        </span>

        {/* Mini path overlay */}
        {glyph.paths && glyph.paths.length > 0 && (
          <svg
            className="absolute inset-0 w-full h-full opacity-0 group-hover:opacity-100 transition-opacity"
            viewBox="0 0 1 1"
            preserveAspectRatio="xMidYMid meet"
          >
            {glyph.paths.map((path, pi) =>
              path.points && path.points.length > 1 ? (
                <polyline
                  key={pi}
                  points={path.points.map(p => `${p.x},${p.y}`).join(' ')}
                  fill="none"
                  stroke="rgba(139, 92, 246, 0.4)"
                  strokeWidth="0.01"
                />
              ) : null
            )}
            {glyph.anchors?.slice(0, 20).map((a, ai) => (
              <circle
                key={ai}
                cx={a.x}
                cy={a.y}
                r="0.015"
                fill={a.type === 'smooth' ? 'rgba(52, 211, 153, 0.8)' : 'rgba(251, 191, 36, 0.8)'}
              />
            ))}
          </svg>
        )}
      </div>

      {/* Metrics */}
      <div className="text-center">
        <div className="text-[9px] text-surface-500 font-mono">
          {pathCount}p {anchorCount}a
        </div>
      </div>
    </div>
  );
};

export default GlyphDebugView;
