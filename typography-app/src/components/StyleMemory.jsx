import React, { useState, useCallback, useEffect } from 'react';
import { serializeProfile, deserializeProfile, cloneProfile } from '../engine/StyleProfile';

const STORAGE_KEY = 'typeforge-saved-styles';

const StyleMemory = ({ currentStyle, onLoadStyle }) => {
  const [savedStyles, setSavedStyles] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const [saveName, setSaveName] = useState('');

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        setSavedStyles(parsed.map(s => ({ ...s, profile: deserializeProfile(s.serialized) })));
      }
    } catch { /* ignore corrupt data */ }
  }, []);

  const saveStyle = useCallback(() => {
    if (!currentStyle) return;
    const name = saveName.trim() || `Style ${savedStyles.length + 1}`;
    const entry = {
      id: crypto.randomUUID(),
      name,
      serialized: serializeProfile(currentStyle),
      profile: currentStyle,
      timestamp: Date.now(),
    };

    const updated = [entry, ...savedStyles];
    setSavedStyles(updated);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated.map(s => ({
      id: s.id,
      name: s.name,
      serialized: s.serialized,
      timestamp: s.timestamp,
    }))));
    setSaveName('');
  }, [currentStyle, savedStyles, saveName]);

  const deleteStyle = useCallback((id) => {
    const updated = savedStyles.filter(s => s.id !== id);
    setSavedStyles(updated);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated.map(s => ({
      id: s.id,
      name: s.name,
      serialized: s.serialized,
      timestamp: s.timestamp,
    }))));
  }, [savedStyles]);

  const loadStyle = useCallback((entry) => {
    const profile = entry.profile || deserializeProfile(entry.serialized);
    onLoadStyle(cloneProfile(profile));
    setIsOpen(false);
  }, [onLoadStyle]);

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-surface-800 text-surface-300 hover:bg-surface-700 hover:text-white border border-surface-700 transition-all"
      >
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0111.186 0z" />
        </svg>
        Styles
        {savedStyles.length > 0 && (
          <span className="bg-violet-500/20 text-violet-400 px-1.5 py-0.5 rounded-full text-[9px]">
            {savedStyles.length}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute bottom-full right-0 mb-2 w-64 bg-surface-900 border border-surface-700 rounded-xl shadow-2xl z-50 animate-slide-up">
          {/* Save current */}
          <div className="p-3 border-b border-surface-800">
            <div className="text-[10px] uppercase tracking-wider text-surface-500 font-medium mb-2">
              Save Current Style
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={saveName}
                onChange={(e) => setSaveName(e.target.value)}
                placeholder="Style name..."
                className="flex-1 px-2 py-1.5 bg-surface-800 border border-surface-700 rounded-md text-xs text-surface-300 placeholder:text-surface-600 focus:outline-none focus:border-violet-500"
                onKeyDown={(e) => e.key === 'Enter' && saveStyle()}
              />
              <button
                onClick={saveStyle}
                disabled={!currentStyle}
                className="px-3 py-1.5 bg-violet-600 hover:bg-violet-500 disabled:opacity-30 text-white text-xs font-medium rounded-md transition-colors"
              >
                Save
              </button>
            </div>
          </div>

          {/* Saved list */}
          <div className="max-h-[240px] overflow-y-auto p-2">
            {savedStyles.length === 0 ? (
              <div className="text-center py-6 text-surface-600 text-xs">
                No saved styles yet
              </div>
            ) : (
              <div className="space-y-1">
                {savedStyles.map(entry => (
                  <div
                    key={entry.id}
                    className="flex items-center justify-between p-2 rounded-lg hover:bg-surface-800 group cursor-pointer transition-colors"
                    onClick={() => loadStyle(entry)}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      {/* Color preview dots */}
                      <div className="flex gap-0.5 flex-shrink-0">
                        {entry.profile?.primaryColor && (
                          <div
                            className="w-3 h-3 rounded-sm"
                            style={{ backgroundColor: `rgb(${entry.profile.primaryColor.join(',')})` }}
                          />
                        )}
                        {entry.profile?.backgroundColor && (
                          <div
                            className="w-3 h-3 rounded-sm border border-surface-700"
                            style={{ backgroundColor: `rgb(${entry.profile.backgroundColor.join(',')})` }}
                          />
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs text-surface-300 truncate">{entry.name}</div>
                        <div className="text-[9px] text-surface-600">
                          {new Date(entry.timestamp).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); deleteStyle(entry.id); }}
                      className="p-1 opacity-0 group-hover:opacity-100 text-surface-500 hover:text-red-400 transition-all"
                    >
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default StyleMemory;
