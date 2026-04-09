import React, { useRef, useEffect, useCallback, useState } from 'react';

const TextInput = ({ value, onChange, fontSize, onFontSizeChange }) => {
  const textareaRef = useRef(null);
  const [isFocused, setIsFocused] = useState(false);
  const [charCount, setCharCount] = useState(0);

  useEffect(() => {
    setCharCount(value?.length || 0);
  }, [value]);

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = 'auto';
    textarea.style.height = `${Math.min(textarea.scrollHeight, 120)}px`;
  }, [value]);

  const handleKeyDown = useCallback((e) => {
    // Ctrl/Cmd + Enter to focus canvas
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      textareaRef.current?.blur();
    }
  }, []);

  return (
    <div className={`
      border-t border-surface-800 bg-surface-950
      transition-colors duration-200
      ${isFocused ? 'border-t-violet-500/50' : ''}
    `}>
      <div className="flex items-start gap-3 px-4 py-3">
        {/* Main text input */}
        <div className="flex-1 relative">
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            onKeyDown={handleKeyDown}
            placeholder="Type your text here..."
            rows={1}
            className="
              w-full bg-transparent text-white text-sm
              placeholder:text-surface-600 resize-none
              focus:outline-none leading-relaxed
              scrollbar-thin scrollbar-thumb-surface-700
            "
            style={{ maxHeight: '120px' }}
          />
          <div className="flex items-center justify-between mt-1">
            <span className="text-[10px] text-surface-600">
              {charCount > 0 ? `${charCount} characters` : 'Start typing for live preview'}
            </span>
            <span className="text-[10px] text-surface-700">
              {isFocused && 'Ctrl+Enter to unfocus'}
            </span>
          </div>
        </div>

        {/* Font size control */}
        <div className="flex items-center gap-2 pt-0.5">
          <label className="text-[10px] text-surface-500 uppercase tracking-wider whitespace-nowrap">
            Size
          </label>
          <div className="flex items-center bg-surface-900 border border-surface-700 rounded-md overflow-hidden">
            <button
              onClick={() => onFontSizeChange(Math.max(12, fontSize - 4))}
              className="px-1.5 py-1 text-surface-400 hover:text-white hover:bg-surface-800 transition-colors text-xs"
            >
              -
            </button>
            <input
              type="number"
              value={fontSize}
              onChange={(e) => onFontSizeChange(Math.max(12, Math.min(400, parseInt(e.target.value) || 72)))}
              className="w-10 text-center bg-transparent text-surface-300 text-xs py-1 focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
            <button
              onClick={() => onFontSizeChange(Math.min(400, fontSize + 4))}
              className="px-1.5 py-1 text-surface-400 hover:text-white hover:bg-surface-800 transition-colors text-xs"
            >
              +
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TextInput;
