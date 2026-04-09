/**
 * StyleProfile — data structure representing extracted typographic style parameters.
 * All values are normalized 0–1 unless otherwise noted.
 */

export function createDefaultProfile() {
  return {
    // Identity
    id: crypto.randomUUID(),
    name: 'Untitled Style',
    timestamp: Date.now(),

    // Colors
    primaryColor: [0, 0, 0],
    secondaryColor: [60, 60, 60],
    backgroundColor: [255, 255, 255],
    palette: [],
    gradient: null,

    // Weight & Stroke
    weight: 0.5,             // 0=thin, 1=black
    strokeContrast: 0.3,     // variation between thick/thin strokes
    strokeWidth: 0.5,        // overall stroke width

    // Shape characteristics
    serifness: 0.0,          // 0=sans, 1=full serif
    curvature: 0.5,          // 0=angular, 1=fully rounded
    slant: 0.0,              // -1=back-slant, 0=upright, 1=italic

    // Spacing
    letterSpacing: 0.0,      // -0.5 to 0.5 (em)
    wordSpacing: 0.0,        // -0.5 to 0.5 (em)
    lineHeight: 1.4,

    // Effects
    distortion: 0.0,         // warp/perspective 0–1
    textureStrength: 0.0,    // texture overlay 0–1
    roughness: 0.0,          // edge roughness 0–1
    noiseAmount: 0.0,        // noise grain 0–1
    glowStrength: 0.0,       // glow/neon effect 0–1

    // Texture data (extracted from source image)
    textureData: null,       // ImageData or null
    textureTile: null,       // repeatable texture tile

    // Perspective / Transform
    perspectiveX: 0.0,       // -1 to 1
    perspectiveY: 0.0,       // -1 to 1
    rotation: 0.0,           // degrees

    // Source analysis metadata
    sourceWidth: 0,
    sourceHeight: 0,
    edgeDensity: 0,
    brightness: 0.5,
    contrast: 0.5,

    // Confidence (how reliable the extraction is)
    confidence: 0.0,
  };
}

export function cloneProfile(profile) {
  const clone = { ...profile };
  clone.id = crypto.randomUUID();
  clone.palette = [...(profile.palette || [])];
  clone.primaryColor = [...profile.primaryColor];
  clone.secondaryColor = [...profile.secondaryColor];
  clone.backgroundColor = [...profile.backgroundColor];
  if (profile.gradient) clone.gradient = { ...profile.gradient };
  return clone;
}

export function interpolateProfiles(a, b, t) {
  const result = createDefaultProfile();
  const numericKeys = [
    'weight', 'strokeContrast', 'strokeWidth', 'serifness', 'curvature',
    'slant', 'letterSpacing', 'wordSpacing', 'lineHeight', 'distortion',
    'textureStrength', 'roughness', 'noiseAmount', 'glowStrength',
    'perspectiveX', 'perspectiveY', 'rotation', 'brightness', 'contrast',
  ];
  for (const key of numericKeys) {
    result[key] = a[key] * (1 - t) + b[key] * t;
  }
  for (let i = 0; i < 3; i++) {
    result.primaryColor[i] = Math.round(a.primaryColor[i] * (1 - t) + b.primaryColor[i] * t);
    result.secondaryColor[i] = Math.round(a.secondaryColor[i] * (1 - t) + b.secondaryColor[i] * t);
    result.backgroundColor[i] = Math.round(a.backgroundColor[i] * (1 - t) + b.backgroundColor[i] * t);
  }
  result.textureData = t < 0.5 ? a.textureData : b.textureData;
  result.confidence = Math.min(a.confidence, b.confidence);
  return result;
}

export function profileToCSS(profile) {
  const [r, g, b] = profile.primaryColor;
  return {
    color: `rgb(${r},${g},${b})`,
    fontWeight: Math.round(100 + profile.weight * 800),
    fontStyle: profile.slant > 0.3 ? 'italic' : 'normal',
    letterSpacing: `${profile.letterSpacing}em`,
    lineHeight: profile.lineHeight,
  };
}

export function serializeProfile(profile) {
  const serializable = { ...profile };
  serializable.textureData = null;
  serializable.textureTile = null;
  return JSON.stringify(serializable);
}

export function deserializeProfile(json) {
  return { ...createDefaultProfile(), ...JSON.parse(json) };
}
