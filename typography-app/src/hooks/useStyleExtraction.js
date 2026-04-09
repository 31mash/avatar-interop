import { useState, useCallback, useRef } from 'react';
import { StyleExtractor } from '../engine/StyleExtractor';
import { createDefaultProfile } from '../engine/StyleProfile';

export function useStyleExtraction() {
  const [styleProfile, setStyleProfile] = useState(createDefaultProfile);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState(null);
  const extractorRef = useRef(null);

  // Lazy init extractor
  const getExtractor = useCallback(() => {
    if (!extractorRef.current) {
      extractorRef.current = new StyleExtractor();
    }
    return extractorRef.current;
  }, []);

  /**
   * Extract style from an image file/blob
   */
  const extractFromImage = useCallback(async (imageSource) => {
    setIsProcessing(true);
    setError(null);

    try {
      const extractor = getExtractor();
      const profile = await extractor.extract(imageSource);

      // Ensure we have valid colors — default to white-on-dark if extraction fails
      if (!profile.primaryColor || profile.primaryColor.every(c => c === 0)) {
        profile.primaryColor = [255, 255, 255];
      }
      if (!profile.backgroundColor) {
        profile.backgroundColor = [18, 18, 20];
      }

      setStyleProfile(profile);
      return profile;
    } catch (err) {
      console.error('Style extraction failed:', err);
      setError(err.message);
      return null;
    } finally {
      setIsProcessing(false);
    }
  }, [getExtractor]);

  /**
   * Manually update a style parameter
   */
  const updateStyle = useCallback((updates) => {
    setStyleProfile(prev => {
      if (typeof updates === 'function') return updates(prev);
      return { ...prev, ...updates };
    });
  }, []);

  /**
   * Reset to default profile
   */
  const resetStyle = useCallback(() => {
    setStyleProfile(createDefaultProfile());
  }, []);

  /**
   * Load a complete style profile
   */
  const loadStyle = useCallback((profile) => {
    setStyleProfile(profile);
  }, []);

  return {
    styleProfile,
    isProcessing,
    error,
    extractFromImage,
    updateStyle,
    resetStyle,
    loadStyle,
  };
}

export default useStyleExtraction;
