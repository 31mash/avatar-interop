import React, { useState, useCallback } from 'react';

const ControlsPanel = ({ style, onStyleChange, onReset, debugMode, onDebugToggle }) => {
  const [activeSection, setActiveSection] = useState('style');

  const updateStyle = useCallback((key, value) => {
    onStyleChange({ ...style, [key]: value });
  }, [style, onStyleChange]);

  const updateColor = useCallback((key, hex) => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    updateStyle(key, [r, g, b]);
  }, [updateStyle]);

  const colorToHex = (rgb) => {
    if (!rgb) return '#ffffff';
    return '#' + rgb.map(c => c.toString(16).padStart(2, '0')).join('');
  };

  if (!style) return null;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-3 border-b border-surface-800 flex items-center justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-surface-400">
          Controls
        </h2>
        <button
          onClick={onReset}
          className="text-[10px] text-surface-500 hover:text-surface-300 transition-colors"
        >
          Reset
        </button>
      </div>

      {/* Tab bar */}
      <div className="flex border-b border-surface-800">
        {['style', 'effects', 'color', 'advanced'].map(tab => (
          <button
            key={tab}
            onClick={() => setActiveSection(tab)}
            className={`
              flex-1 py-2 text-[10px] uppercase tracking-wider font-medium transition-colors
              ${activeSection === tab
                ? 'text-violet-400 border-b-2 border-violet-500'
                : 'text-surface-500 hover:text-surface-300'
              }
            `}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Controls area */}
      <div className="flex-1 overflow-y-auto p-3 space-y-4 scrollbar-thin scrollbar-thumb-surface-700">
        {/* Style Tab */}
        {activeSection === 'style' && (
          <>
            <ControlSlider
              label="Weight"
              value={style.weight}
              onChange={(v) => updateStyle('weight', v)}
              min={0} max={1} step={0.01}
            />
            <ControlSlider
              label="Stroke Contrast"
              value={style.strokeContrast}
              onChange={(v) => updateStyle('strokeContrast', v)}
              min={0} max={1} step={0.01}
            />
            <ControlSlider
              label="Serifness"
              value={style.serifness}
              onChange={(v) => updateStyle('serifness', v)}
              min={0} max={1} step={0.01}
            />
            <ControlSlider
              label="Curvature"
              value={style.curvature}
              onChange={(v) => updateStyle('curvature', v)}
              min={0} max={1} step={0.01}
            />
            <ControlSlider
              label="Slant / Italic"
              value={style.slant}
              onChange={(v) => updateStyle('slant', v)}
              min={-1} max={1} step={0.01}
              center
            />
            <ControlSlider
              label="Letter Spacing"
              value={style.letterSpacing}
              onChange={(v) => updateStyle('letterSpacing', v)}
              min={-0.3} max={0.5} step={0.01}
              center
            />
            <ControlSlider
              label="Word Spacing"
              value={style.wordSpacing}
              onChange={(v) => updateStyle('wordSpacing', v)}
              min={-0.3} max={0.5} step={0.01}
              center
            />
            <ControlSlider
              label="Line Height"
              value={style.lineHeight}
              onChange={(v) => updateStyle('lineHeight', v)}
              min={0.8} max={3} step={0.05}
              displayMultiplier={1}
              displaySuffix="x"
            />
          </>
        )}

        {/* Effects Tab */}
        {activeSection === 'effects' && (
          <>
            <ControlSlider
              label="Distortion"
              value={style.distortion}
              onChange={(v) => updateStyle('distortion', v)}
              min={0} max={1} step={0.01}
            />
            <ControlSlider
              label="Texture Strength"
              value={style.textureStrength}
              onChange={(v) => updateStyle('textureStrength', v)}
              min={0} max={1} step={0.01}
            />
            <ControlSlider
              label="Roughness"
              value={style.roughness}
              onChange={(v) => updateStyle('roughness', v)}
              min={0} max={1} step={0.01}
            />
            <ControlSlider
              label="Noise"
              value={style.noiseAmount}
              onChange={(v) => updateStyle('noiseAmount', v)}
              min={0} max={1} step={0.01}
            />
            <ControlSlider
              label="Glow"
              value={style.glowStrength}
              onChange={(v) => updateStyle('glowStrength', v)}
              min={0} max={1} step={0.01}
            />
          </>
        )}

        {/* Color Tab */}
        {activeSection === 'color' && (
          <>
            <div className="space-y-2">
              <ColorPicker
                label="Text Color"
                value={colorToHex(style.primaryColor)}
                onChange={(hex) => updateColor('primaryColor', hex)}
              />
              <ColorPicker
                label="Secondary"
                value={colorToHex(style.secondaryColor)}
                onChange={(hex) => updateColor('secondaryColor', hex)}
              />
              <ColorPicker
                label="Background"
                value={colorToHex(style.backgroundColor)}
                onChange={(hex) => updateColor('backgroundColor', hex)}
              />
            </div>

            {/* Palette */}
            {style.palette && style.palette.length > 0 && (
              <div>
                <div className="text-[10px] uppercase tracking-wider text-surface-500 font-medium mb-2">
                  Extracted Palette
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {style.palette.map((color, i) => (
                    <button
                      key={i}
                      className="w-8 h-8 rounded-lg border border-surface-700 hover:border-surface-500 transition-colors hover:scale-110 active:scale-95"
                      style={{ backgroundColor: `rgb(${color[0]},${color[1]},${color[2]})` }}
                      onClick={() => updateStyle('primaryColor', [...color])}
                      title={`Use rgb(${color.join(',')})`}
                    />
                  ))}
                </div>
              </div>
            )}

            <ControlSlider
              label="Brightness"
              value={style.brightness}
              onChange={(v) => updateStyle('brightness', v)}
              min={0} max={1} step={0.01}
            />
            <ControlSlider
              label="Contrast"
              value={style.contrast}
              onChange={(v) => updateStyle('contrast', v)}
              min={0} max={1} step={0.01}
            />
          </>
        )}

        {/* Advanced Tab */}
        {activeSection === 'advanced' && (
          <>
            <ControlSlider
              label="Perspective X"
              value={style.perspectiveX}
              onChange={(v) => updateStyle('perspectiveX', v)}
              min={-1} max={1} step={0.01}
              center
            />
            <ControlSlider
              label="Perspective Y"
              value={style.perspectiveY}
              onChange={(v) => updateStyle('perspectiveY', v)}
              min={-1} max={1} step={0.01}
              center
            />
            <ControlSlider
              label="Rotation"
              value={style.rotation}
              onChange={(v) => updateStyle('rotation', v)}
              min={-45} max={45} step={0.5}
              center
              displaySuffix="°"
            />
            <ControlSlider
              label="Stroke Width"
              value={style.strokeWidth}
              onChange={(v) => updateStyle('strokeWidth', v)}
              min={0} max={1} step={0.01}
            />

            {/* Debug mode toggle */}
            <div className="pt-2 border-t border-surface-800">
              <ToggleSwitch
                label="Glyph Debug View"
                value={debugMode}
                onChange={onDebugToggle}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
};

// --- Sub-components ---

const ControlSlider = ({
  label, value, onChange, min = 0, max = 1, step = 0.01,
  center = false, displayMultiplier, displaySuffix = '',
}) => {
  const displayVal = displayMultiplier
    ? (value * displayMultiplier).toFixed(1)
    : value >= 10 ? Math.round(value) : value.toFixed(2);

  const percentage = ((value - min) / (max - min)) * 100;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <label className="text-[11px] text-surface-400">{label}</label>
        <span className="text-[11px] text-surface-500 font-mono tabular-nums">
          {displayVal}{displaySuffix}
        </span>
      </div>
      <div className="relative">
        <div className="h-1.5 bg-surface-800 rounded-full overflow-hidden">
          {center ? (
            <div
              className="absolute h-full bg-violet-500/70 rounded-full transition-all duration-75"
              style={{
                left: `${Math.min(percentage, 50)}%`,
                width: `${Math.abs(percentage - 50)}%`,
              }}
            />
          ) : (
            <div
              className="h-full bg-violet-500/70 rounded-full transition-all duration-75"
              style={{ width: `${percentage}%` }}
            />
          )}
        </div>
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        />
      </div>
    </div>
  );
};

const ColorPicker = ({ label, value, onChange }) => (
  <div className="flex items-center justify-between">
    <label className="text-[11px] text-surface-400">{label}</label>
    <div className="flex items-center gap-2">
      <span className="text-[10px] font-mono text-surface-500 uppercase">{value}</span>
      <label className="w-7 h-7 rounded-md border border-surface-700 cursor-pointer overflow-hidden hover:border-surface-500 transition-colors">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-10 h-10 -m-1 cursor-pointer"
        />
      </label>
    </div>
  </div>
);

const ToggleSwitch = ({ label, value, onChange }) => (
  <div className="flex items-center justify-between">
    <label className="text-[11px] text-surface-400">{label}</label>
    <button
      onClick={() => onChange(!value)}
      className={`
        relative w-9 h-5 rounded-full transition-colors duration-200
        ${value ? 'bg-violet-600' : 'bg-surface-700'}
      `}
    >
      <div
        className={`
          absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm
          transition-transform duration-200
          ${value ? 'translate-x-[18px]' : 'translate-x-0.5'}
        `}
      />
    </button>
  </div>
);

export default ControlsPanel;
