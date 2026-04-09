import React, { useState, useCallback, useRef } from 'react';
import UploadPanel from './components/UploadPanel';
import PreviewCanvas from './components/PreviewCanvas';
import TextInput from './components/TextInput';
import ControlsPanel from './components/ControlsPanel';
import GlyphDebugView from './components/GlyphDebugView';
import ExportMenu from './components/ExportMenu';
import StyleMemory from './components/StyleMemory';
import StyleBlender from './components/StyleBlender';
import { useStyleExtraction } from './hooks/useStyleExtraction';
import { useGlyphRenderer } from './hooks/useGlyphRenderer';
import { createDefaultProfile } from './engine/StyleProfile';

function App() {
  const [text, setText] = useState('');
  const [fontSize, setFontSize] = useState(72);
  const [debugMode, setDebugMode] = useState(false);
  const [sourceImage, setSourceImage] = useState(null);
  const [blendMode, setBlendMode] = useState(false);
  const [secondaryStyle, setSecondaryStyle] = useState(null);
  const [leftPanelOpen, setLeftPanelOpen] = useState(true);
  const [rightPanelOpen, setRightPanelOpen] = useState(true);

  const {
    styleProfile,
    isProcessing,
    error: extractionError,
    extractFromImage,
    updateStyle,
    resetStyle,
    loadStyle,
  } = useStyleExtraction();

  const {
    glyphData,
    layout,
    canvas,
    handleCanvasReady,
    handleGlyphDataUpdate,
    handleLayoutUpdate,
  } = useGlyphRenderer();

  // Handle image upload
  const handleImageUpload = useCallback(async (file) => {
    setSourceImage(file);
    const profile = await extractFromImage(file);
    if (profile && blendMode && !secondaryStyle) {
      setSecondaryStyle(profile);
    }
  }, [extractFromImage, blendMode, secondaryStyle]);

  // Handle style blending
  const handleBlendResult = useCallback((blended) => {
    loadStyle(blended);
  }, [loadStyle]);

  // Toggle blend mode
  const toggleBlendMode = useCallback(() => {
    if (!blendMode && styleProfile) {
      setSecondaryStyle(null);
    }
    setBlendMode(!blendMode);
  }, [blendMode, styleProfile]);

  return (
    <div className="h-screen flex flex-col bg-surface-950 text-white overflow-hidden">
      {/* ===== Top Bar ===== */}
      <header className="h-11 flex items-center justify-between px-4 border-b border-surface-800 bg-surface-950 flex-shrink-0 z-30">
        <div className="flex items-center gap-3">
          {/* Logo */}
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-violet-600 rounded-md flex items-center justify-center text-white text-xs font-bold">
              T
            </div>
            <span className="text-sm font-semibold tracking-tight">TypeForge</span>
            <span className="text-[9px] text-surface-500 bg-surface-800 px-1.5 py-0.5 rounded-full font-medium">
              BETA
            </span>
          </div>

          <div className="h-4 w-px bg-surface-800 mx-1" />

          {/* Panel toggles */}
          <button
            onClick={() => setLeftPanelOpen(!leftPanelOpen)}
            className={`p-1.5 rounded-md transition-colors ${leftPanelOpen ? 'bg-surface-800 text-surface-200' : 'text-surface-500 hover:text-surface-300'}`}
            title="Toggle reference panel"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6z" />
            </svg>
          </button>
          <button
            onClick={() => setRightPanelOpen(!rightPanelOpen)}
            className={`p-1.5 rounded-md transition-colors ${rightPanelOpen ? 'bg-surface-800 text-surface-200' : 'text-surface-500 hover:text-surface-300'}`}
            title="Toggle controls panel"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-9.75 0h9.75" />
            </svg>
          </button>
        </div>

        <div className="flex items-center gap-2">
          {/* Blend mode toggle */}
          <button
            onClick={toggleBlendMode}
            className={`
              flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all
              ${blendMode
                ? 'bg-violet-600/20 text-violet-400 border border-violet-500/30'
                : 'text-surface-500 hover:text-surface-300 border border-transparent'
              }
            `}
          >
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
            </svg>
            Blend
          </button>

          <StyleMemory currentStyle={styleProfile} onLoadStyle={loadStyle} />
          <ExportMenu
            canvas={canvas}
            text={text}
            style={styleProfile}
            layout={layout}
            glyphData={glyphData}
          />
        </div>
      </header>

      {/* ===== Main Content ===== */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel: Upload */}
        {leftPanelOpen && (
          <aside className="w-64 flex-shrink-0 border-r border-surface-800 bg-surface-950 overflow-hidden panel-transition">
            <UploadPanel
              onImageUpload={handleImageUpload}
              sourceImage={sourceImage}
              isProcessing={isProcessing}
              styleProfile={styleProfile}
            />
          </aside>
        )}

        {/* Center: Canvas + Text Input */}
        <main className="flex-1 flex flex-col overflow-hidden relative">
          {/* Preview Canvas */}
          <div className="flex-1 relative overflow-hidden">
            <PreviewCanvas
              text={text}
              style={styleProfile}
              fontSize={fontSize}
              debugMode={debugMode}
              onGlyphDataUpdate={handleGlyphDataUpdate}
              onLayoutUpdate={handleLayoutUpdate}
              onCanvasReady={handleCanvasReady}
            />

            {/* Glyph Debug View overlay */}
            <GlyphDebugView
              glyphData={glyphData}
              style={styleProfile}
              visible={debugMode}
            />

            {/* Style Blender overlay */}
            {blendMode && (
              <div className="absolute bottom-3 left-3 right-3 z-10">
                <StyleBlender
                  styleA={styleProfile}
                  styleB={secondaryStyle || createDefaultProfile()}
                  onBlendResult={handleBlendResult}
                  visible={blendMode}
                />
              </div>
            )}

            {/* Extraction error banner */}
            {extractionError && (
              <div className="absolute top-3 left-1/2 -translate-x-1/2 px-4 py-2 bg-red-900/80 border border-red-700 rounded-lg text-xs text-red-200 animate-fade-in z-20">
                Style extraction failed: {extractionError}
              </div>
            )}
          </div>

          {/* Text Input */}
          <TextInput
            value={text}
            onChange={setText}
            fontSize={fontSize}
            onFontSizeChange={setFontSize}
          />
        </main>

        {/* Right Panel: Controls */}
        {rightPanelOpen && (
          <aside className="w-64 flex-shrink-0 border-l border-surface-800 bg-surface-950 overflow-hidden panel-transition">
            <ControlsPanel
              style={styleProfile}
              onStyleChange={(updated) => updateStyle(updated)}
              onReset={resetStyle}
              debugMode={debugMode}
              onDebugToggle={setDebugMode}
            />
          </aside>
        )}
      </div>

      {/* ===== Status Bar ===== */}
      <footer className="h-6 flex items-center justify-between px-4 border-t border-surface-800 bg-surface-950 flex-shrink-0 text-[10px] text-surface-600">
        <div className="flex items-center gap-3">
          <span>
            {text.length > 0 ? `${text.length} chars` : 'Ready'}
          </span>
          {glyphData.length > 0 && (
            <span>{glyphData.length} glyphs rendered</span>
          )}
          {styleProfile.confidence > 0 && (
            <span className="flex items-center gap-1">
              <div className={`w-1.5 h-1.5 rounded-full ${
                styleProfile.confidence > 0.6 ? 'bg-emerald-500' :
                styleProfile.confidence > 0.3 ? 'bg-amber-500' : 'bg-surface-600'
              }`} />
              Style: {Math.round(styleProfile.confidence * 100)}%
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          {debugMode && (
            <span className="text-violet-500">Debug ON</span>
          )}
          <span>TypeForge v1.0</span>
        </div>
      </footer>
    </div>
  );
}

export default App;
