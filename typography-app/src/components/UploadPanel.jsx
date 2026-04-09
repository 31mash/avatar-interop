import React, { useCallback, useRef, useState } from 'react';

const UploadPanel = ({ onImageUpload, sourceImage, isProcessing, styleProfile }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const fileInputRef = useRef(null);
  const videoRef = useRef(null);
  const streamRef = useRef(null);

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
      onImageUpload(file);
    }
  }, [onImageUpload]);

  const handleFileChange = useCallback((e) => {
    const file = e.target.files[0];
    if (file) onImageUpload(file);
  }, [onImageUpload]);

  const handleClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: 640, height: 480 },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
      setCameraActive(true);
    } catch (err) {
      console.warn('Camera access denied:', err);
    }
  }, []);

  const captureFromCamera = useCallback(() => {
    if (!videoRef.current) return;
    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(videoRef.current, 0, 0);
    canvas.toBlob((blob) => {
      if (blob) onImageUpload(blob);
    }, 'image/png');

    // Stop camera
    streamRef.current?.getTracks().forEach(t => t.stop());
    setCameraActive(false);
  }, [onImageUpload]);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    setCameraActive(false);
  }, []);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-3 border-b border-surface-800">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-surface-400">
          Reference
        </h2>
      </div>

      {/* Upload area */}
      <div className="flex-1 p-3 overflow-y-auto">
        {!sourceImage && !cameraActive && (
          <div
            className={`
              relative flex flex-col items-center justify-center
              border-2 border-dashed rounded-xl cursor-pointer
              transition-all duration-200 min-h-[200px]
              ${isDragging
                ? 'border-violet-500 bg-violet-500/10'
                : 'border-surface-700 bg-surface-900/50 hover:border-surface-500 hover:bg-surface-800/50'
              }
            `}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={handleClick}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileChange}
            />

            <div className="w-10 h-10 mb-3 rounded-xl bg-surface-800 flex items-center justify-center">
              <svg className="w-5 h-5 text-surface-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
              </svg>
            </div>

            <p className="text-sm font-medium text-surface-300 mb-1">
              Drop image here
            </p>
            <p className="text-xs text-surface-500">
              or click to browse
            </p>
            <p className="text-[10px] text-surface-600 mt-2">
              PNG, JPG, WebP — any typography source
            </p>
          </div>
        )}

        {/* Camera view */}
        {cameraActive && (
          <div className="relative rounded-xl overflow-hidden bg-black">
            <video ref={videoRef} className="w-full rounded-xl" autoPlay playsInline muted />
            <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-2">
              <button
                onClick={captureFromCamera}
                className="px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white text-xs font-medium rounded-lg transition-colors"
              >
                Capture
              </button>
              <button
                onClick={stopCamera}
                className="px-4 py-2 bg-surface-700 hover:bg-surface-600 text-white text-xs font-medium rounded-lg transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Source image preview */}
        {sourceImage && !cameraActive && (
          <div className="space-y-3">
            <div className="relative group rounded-xl overflow-hidden bg-surface-900 border border-surface-800">
              <img
                src={typeof sourceImage === 'string' ? sourceImage : URL.createObjectURL(sourceImage)}
                alt="Reference"
                className="w-full object-contain max-h-[240px]"
              />
              {isProcessing && (
                <div className="absolute inset-0 bg-surface-950/70 flex items-center justify-center">
                  <div className="flex flex-col items-center gap-2">
                    <div className="w-6 h-6 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
                    <span className="text-xs text-surface-300">Extracting style...</span>
                  </div>
                </div>
              )}
              <button
                onClick={handleClick}
                className="absolute top-2 right-2 p-1.5 bg-surface-900/80 hover:bg-surface-800 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <svg className="w-3.5 h-3.5 text-surface-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182" />
                </svg>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileChange}
              />
            </div>

            {/* Style profile summary */}
            {styleProfile && !isProcessing && (
              <div className="animate-fade-in space-y-2">
                <div className="text-[10px] uppercase tracking-wider text-surface-500 font-medium">
                  Extracted Style
                </div>

                {/* Color palette */}
                <div className="flex gap-1">
                  {styleProfile.palette?.slice(0, 6).map((color, i) => (
                    <div
                      key={i}
                      className="w-6 h-6 rounded-md border border-surface-700"
                      style={{ backgroundColor: `rgb(${color[0]},${color[1]},${color[2]})` }}
                      title={`rgb(${color.join(',')})`}
                    />
                  ))}
                </div>

                {/* Style metrics */}
                <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px]">
                  <StyleMetric label="Weight" value={styleProfile.weight} />
                  <StyleMetric label="Contrast" value={styleProfile.strokeContrast} />
                  <StyleMetric label="Serif" value={styleProfile.serifness} />
                  <StyleMetric label="Curvature" value={styleProfile.curvature} />
                  <StyleMetric label="Roughness" value={styleProfile.roughness} />
                  <StyleMetric label="Texture" value={styleProfile.textureStrength} />
                </div>

                {/* Confidence badge */}
                <div className="flex items-center gap-1.5 mt-1">
                  <div className={`w-1.5 h-1.5 rounded-full ${
                    styleProfile.confidence > 0.6 ? 'bg-emerald-500' :
                    styleProfile.confidence > 0.3 ? 'bg-amber-500' : 'bg-red-500'
                  }`} />
                  <span className="text-[10px] text-surface-500">
                    {Math.round(styleProfile.confidence * 100)}% confidence
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Camera button */}
        {!cameraActive && (
          <button
            onClick={startCamera}
            className="mt-3 w-full py-2 flex items-center justify-center gap-2 text-xs text-surface-400 hover:text-surface-300 bg-surface-900/50 hover:bg-surface-800/50 border border-surface-800 hover:border-surface-700 rounded-lg transition-all"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z" />
            </svg>
            Live Camera
          </button>
        )}
      </div>
    </div>
  );
};

const StyleMetric = ({ label, value }) => (
  <div className="flex items-center justify-between">
    <span className="text-surface-500">{label}</span>
    <div className="flex items-center gap-1.5">
      <div className="w-12 h-1 bg-surface-800 rounded-full overflow-hidden">
        <div
          className="h-full bg-violet-500 rounded-full transition-all duration-500"
          style={{ width: `${Math.round((value || 0) * 100)}%` }}
        />
      </div>
      <span className="text-surface-400 w-6 text-right tabular-nums">
        {Math.round((value || 0) * 100)}
      </span>
    </div>
  </div>
);

export default UploadPanel;
