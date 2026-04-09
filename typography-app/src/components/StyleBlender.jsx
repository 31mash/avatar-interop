import React, { useState, useCallback } from 'react';
import { interpolateProfiles } from '../engine/StyleProfile';

const StyleBlender = ({ styleA, styleB, onBlendResult, visible }) => {
  const [blendFactor, setBlendFactor] = useState(0.5);

  const handleBlend = useCallback((t) => {
    setBlendFactor(t);
    if (styleA && styleB) {
      const blended = interpolateProfiles(styleA, styleB, t);
      onBlendResult(blended);
    }
  }, [styleA, styleB, onBlendResult]);

  if (!visible || !styleA || !styleB) return null;

  const colorPreview = (color) => {
    if (!color) return '#333';
    return `rgb(${color[0]},${color[1]},${color[2]})`;
  };

  return (
    <div className="bg-surface-900/95 border border-surface-700 rounded-xl p-3 backdrop-blur-sm animate-fade-in">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-violet-400 mb-3">
        Style Blender
      </div>

      <div className="flex items-center gap-3 mb-3">
        {/* Style A indicator */}
        <div className="flex items-center gap-1.5">
          <div
            className="w-4 h-4 rounded-md border border-surface-600"
            style={{ backgroundColor: colorPreview(styleA.primaryColor) }}
          />
          <span className="text-[10px] text-surface-400">A</span>
        </div>

        {/* Blend slider */}
        <div className="flex-1 relative">
          <div className="h-2 bg-surface-800 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full"
              style={{
                width: '100%',
                background: `linear-gradient(to right, ${colorPreview(styleA.primaryColor)}, ${colorPreview(styleB.primaryColor)})`,
                opacity: 0.5,
              }}
            />
          </div>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={blendFactor}
            onChange={(e) => handleBlend(parseFloat(e.target.value))}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          />
          {/* Thumb indicator */}
          <div
            className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-white border-2 border-violet-500 shadow-sm pointer-events-none"
            style={{ left: `calc(${blendFactor * 100}% - 6px)` }}
          />
        </div>

        {/* Style B indicator */}
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-surface-400">B</span>
          <div
            className="w-4 h-4 rounded-md border border-surface-600"
            style={{ backgroundColor: colorPreview(styleB.primaryColor) }}
          />
        </div>
      </div>

      <div className="text-center text-[10px] text-surface-500 font-mono">
        {Math.round(blendFactor * 100)}% blend
      </div>
    </div>
  );
};

export default StyleBlender;
