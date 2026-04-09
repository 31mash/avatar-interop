import React, { useRef, useEffect, useCallback, useState } from 'react';
import { TextRenderer } from '../engine/TextRenderer';
import { drawGrid } from '../utils/canvasUtils';

const PreviewCanvas = ({
  text,
  style,
  fontSize,
  debugMode,
  onGlyphDataUpdate,
  onLayoutUpdate,
  onCanvasReady,
}) => {
  const containerRef = useRef(null);
  const canvasRef = useRef(null);
  const rendererRef = useRef(null);
  const rafRef = useRef(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const lastMouseRef = useRef({ x: 0, y: 0 });

  // Initialize renderer
  useEffect(() => {
    if (!canvasRef.current) return;

    const renderer = new TextRenderer(canvasRef.current);
    rendererRef.current = renderer;

    if (onCanvasReady) onCanvasReady(canvasRef.current);

    const handleResize = () => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      renderer.resize(rect.width, rect.height);
      requestRender();
    };

    const observer = new ResizeObserver(handleResize);
    observer.observe(containerRef.current);
    handleResize();

    return () => {
      observer.disconnect();
      renderer.dispose();
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  // Render function
  const requestRender = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      if (!rendererRef.current || !style) return;

      const renderer = rendererRef.current;
      const ctx = renderer.ctx;

      ctx.save();
      ctx.setTransform(renderer.dpr * zoom, 0, 0, renderer.dpr * zoom, pan.x * renderer.dpr, pan.y * renderer.dpr);

      const result = renderer.render(text || 'Type something...', style, {
        fontSize: fontSize || 72,
        debugMode,
      });

      ctx.restore();

      if (onGlyphDataUpdate && result.glyphData) {
        onGlyphDataUpdate(result.glyphData);
      }
      if (onLayoutUpdate && result.layout) {
        onLayoutUpdate(result.layout);
      }
    });
  }, [text, style, fontSize, debugMode, zoom, pan, onGlyphDataUpdate, onLayoutUpdate]);

  // Re-render when inputs change
  useEffect(() => {
    // Invalidate glyph cache on style change
    if (rendererRef.current) {
      rendererRef.current.invalidateCache();
    }
    requestRender();
  }, [text, style, fontSize, debugMode, zoom, pan]);

  // Zoom with scroll wheel
  const handleWheel = useCallback((e) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.95 : 1.05;
    setZoom(z => Math.max(0.25, Math.min(4, z * delta)));
  }, []);

  // Pan with middle click or space+drag
  const handleMouseDown = useCallback((e) => {
    if (e.button === 1 || e.altKey) {
      e.preventDefault();
      setIsPanning(true);
      lastMouseRef.current = { x: e.clientX, y: e.clientY };
    }
  }, []);

  const handleMouseMove = useCallback((e) => {
    if (!isPanning) return;
    const dx = e.clientX - lastMouseRef.current.x;
    const dy = e.clientY - lastMouseRef.current.y;
    lastMouseRef.current = { x: e.clientX, y: e.clientY };
    setPan(p => ({ x: p.x + dx, y: p.y + dy }));
  }, [isPanning]);

  const handleMouseUp = useCallback(() => {
    setIsPanning(false);
  }, []);

  // Reset view
  const resetView = useCallback(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, []);

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full overflow-hidden bg-surface-950"
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full"
        style={{ cursor: isPanning ? 'grabbing' : 'default' }}
      />

      {/* Zoom indicator */}
      <div className="absolute bottom-3 left-3 flex items-center gap-2">
        <button
          onClick={() => setZoom(z => Math.max(0.25, z - 0.25))}
          className="w-7 h-7 flex items-center justify-center bg-surface-900/80 hover:bg-surface-800 border border-surface-700 rounded-md text-surface-400 text-sm transition-colors"
        >
          -
        </button>
        <button
          onClick={resetView}
          className="px-2 h-7 flex items-center justify-center bg-surface-900/80 hover:bg-surface-800 border border-surface-700 rounded-md text-surface-400 text-[11px] font-mono transition-colors min-w-[48px]"
        >
          {Math.round(zoom * 100)}%
        </button>
        <button
          onClick={() => setZoom(z => Math.min(4, z + 0.25))}
          className="w-7 h-7 flex items-center justify-center bg-surface-900/80 hover:bg-surface-800 border border-surface-700 rounded-md text-surface-400 text-sm transition-colors"
        >
          +
        </button>
      </div>

      {/* Canvas hint when no text */}
      {!text && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="text-surface-600 text-sm font-light tracking-wide">
            Type something below to begin
          </div>
        </div>
      )}
    </div>
  );
};

export default PreviewCanvas;
