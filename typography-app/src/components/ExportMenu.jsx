import React, { useState, useRef, useEffect } from 'react';
import { exportPNG, exportSVG, downloadSVG, exportGlyphPaths, copyToClipboard } from '../utils/exportUtils';

const ExportMenu = ({ canvas, text, style, layout, glyphData }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [copiedFeedback, setCopiedFeedback] = useState(false);
  const menuRef = useRef(null);

  // Close on click outside
  useEffect(() => {
    const handleClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const handleExportPNG = () => {
    if (!canvas) return;
    exportPNG(canvas);
    setIsOpen(false);
  };

  const handleExportSVG = () => {
    if (!style) return;
    const svgContent = exportSVG(
      text || '',
      style,
      layout,
      glyphData,
      canvas?.width || 1200,
      canvas?.height || 800
    );
    downloadSVG(svgContent);
    setIsOpen(false);
  };

  const handleExportPaths = () => {
    if (!glyphData) return;
    exportGlyphPaths(glyphData);
    setIsOpen(false);
  };

  const handleCopy = async () => {
    if (!canvas) return;
    const success = await copyToClipboard(canvas);
    if (success) {
      setCopiedFeedback(true);
      setTimeout(() => setCopiedFeedback(false), 2000);
    }
    setIsOpen(false);
  };

  return (
    <div ref={menuRef} className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`
          flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium
          transition-all duration-200
          ${isOpen
            ? 'bg-violet-600 text-white'
            : 'bg-surface-800 text-surface-300 hover:bg-surface-700 hover:text-white border border-surface-700'
          }
        `}
      >
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
        </svg>
        {copiedFeedback ? 'Copied!' : 'Export'}
      </button>

      {isOpen && (
        <div className="absolute bottom-full right-0 mb-2 w-52 bg-surface-900 border border-surface-700 rounded-xl shadow-2xl overflow-hidden animate-slide-up z-50">
          <div className="p-1">
            <ExportOption
              icon={<PngIcon />}
              label="Export PNG"
              description="Raster image at canvas resolution"
              onClick={handleExportPNG}
              disabled={!canvas}
            />
            <ExportOption
              icon={<SvgIcon />}
              label="Export SVG"
              description="Scalable vector format"
              onClick={handleExportSVG}
              disabled={!style}
            />
            <ExportOption
              icon={<PathIcon />}
              label="Export Glyph Paths"
              description="JSON vector path data"
              onClick={handleExportPaths}
              disabled={!glyphData || glyphData.length === 0}
            />

            <div className="h-px bg-surface-800 my-1" />

            <ExportOption
              icon={<ClipboardIcon />}
              label="Copy to Clipboard"
              description="PNG to clipboard"
              onClick={handleCopy}
              disabled={!canvas}
            />
          </div>
        </div>
      )}
    </div>
  );
};

const ExportOption = ({ icon, label, description, onClick, disabled }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    className={`
      w-full flex items-start gap-3 px-3 py-2 rounded-lg text-left transition-colors
      ${disabled
        ? 'opacity-30 cursor-not-allowed'
        : 'hover:bg-surface-800 cursor-pointer'
      }
    `}
  >
    <div className="mt-0.5 text-surface-400">{icon}</div>
    <div>
      <div className="text-xs font-medium text-surface-200">{label}</div>
      <div className="text-[10px] text-surface-500">{description}</div>
    </div>
  </button>
);

// Icons
const PngIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z" />
  </svg>
);

const SvgIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5" />
  </svg>
);

const PathIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23.693L5 14.5m14.8.8l1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0112 21c-2.773 0-5.491-.235-8.135-.687-1.718-.293-2.3-2.379-1.067-3.61L5 14.5" />
  </svg>
);

const ClipboardIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9.75a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184" />
  </svg>
);

export default ExportMenu;
