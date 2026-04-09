import { useState, useCallback, useRef } from 'react';

export function useGlyphRenderer() {
  const [glyphData, setGlyphData] = useState([]);
  const [layout, setLayout] = useState(null);
  const canvasRef = useRef(null);

  const handleCanvasReady = useCallback((canvas) => {
    canvasRef.current = canvas;
  }, []);

  const handleGlyphDataUpdate = useCallback((data) => {
    setGlyphData(data);
  }, []);

  const handleLayoutUpdate = useCallback((layoutData) => {
    setLayout(layoutData);
  }, []);

  return {
    glyphData,
    layout,
    canvas: canvasRef.current,
    handleCanvasReady,
    handleGlyphDataUpdate,
    handleLayoutUpdate,
  };
}

export default useGlyphRenderer;
