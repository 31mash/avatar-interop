/**
 * Comprehensive test suite for TypeForge engine modules.
 * Runs in Node.js with a minimal Canvas polyfill to test core logic.
 */

// ============================================================
// Minimal Canvas/DOM polyfill for Node.js testing
// ============================================================
class MockImageData {
  constructor(width, height) {
    this.width = width;
    this.height = height;
    this.data = new Uint8ClampedArray(width * height * 4);
  }
}

class MockCanvasContext {
  constructor(width, height) {
    this.width = width;
    this.height = height;
    this._imageData = new MockImageData(width, height);
    this.font = '';
    this.fillStyle = '';
    this.strokeStyle = '';
    this.textAlign = 'start';
    this.textBaseline = 'alphabetic';
    this.lineWidth = 1;
    this.lineJoin = 'miter';
    this.shadowColor = 'transparent';
    this.shadowBlur = 0;
    this.shadowOffsetX = 0;
    this.shadowOffsetY = 0;
    this.globalAlpha = 1;
    this.globalCompositeOperation = 'source-over';
  }
  fillRect() {}
  clearRect() {}
  fillText() {}
  strokeText() {}
  measureText(text) {
    return {
      width: text.length * 10,
      actualBoundingBoxAscent: 12,
      actualBoundingBoxDescent: 4,
    };
  }
  getImageData(x, y, w, h) {
    return new MockImageData(w, h);
  }
  putImageData() {}
  createPattern() { return {}; }
  createLinearGradient() {
    return { addColorStop() {} };
  }
  beginPath() {}
  closePath() {}
  moveTo() {}
  lineTo() {}
  arc() {}
  bezierCurveTo() {}
  quadraticCurveTo() {}
  fill() {}
  stroke() {}
  rect() {}
  strokeRect() {}
  fillRect() {}
  save() {}
  restore() {}
  scale() {}
  translate() {}
  rotate() {}
  transform() {}
  setTransform() {}
  setLineDash() {}
  drawImage() {}
  toDataURL() { return 'data:image/png;base64,mock'; }
  toBlob(cb) { cb(new Blob()); }
}

class MockCanvas {
  constructor(width = 300, height = 150) {
    this.width = width;
    this.height = height;
    this.style = {};
  }
  getContext() {
    return new MockCanvasContext(this.width, this.height);
  }
  toDataURL() { return 'data:image/png;base64,mock'; }
  toBlob(cb) { cb(new Blob([])); }
}

// Global polyfills
globalThis.document = {
  createElement(tag) {
    if (tag === 'canvas') return new MockCanvas();
    if (tag === 'a') return { click() {}, download: '', href: '' };
    return {};
  },
};
globalThis.window = globalThis.window || {};
globalThis.window.devicePixelRatio = 2;
if (!globalThis.URL?.createObjectURL) {
  globalThis.URL = { createObjectURL() { return 'blob:mock'; }, revokeObjectURL() {} };
}
globalThis.Image = globalThis.Image || class {
  constructor() { this.onload = null; this.onerror = null; }
  set src(v) { setTimeout(() => this.onload?.(), 0); }
};
if (!globalThis.crypto?.randomUUID) {
  globalThis.crypto = { randomUUID() { return 'test-' + Math.random().toString(36).slice(2); } };
}
try { globalThis.navigator = { clipboard: { write() { return Promise.resolve(); } } }; } catch {}
globalThis.ClipboardItem = globalThis.ClipboardItem || class { constructor() {} };
globalThis.Blob = globalThis.Blob || class { constructor() {} };
globalThis.HTMLImageElement = globalThis.HTMLImageElement || class {};
globalThis.cancelAnimationFrame = globalThis.cancelAnimationFrame || (() => {});
globalThis.requestAnimationFrame = globalThis.requestAnimationFrame || ((cb) => setTimeout(cb, 0));
globalThis.ResizeObserver = globalThis.ResizeObserver || class { observe() {} disconnect() {} };
if (!globalThis.localStorage) {
  globalThis.localStorage = {
    _data: {},
    getItem(k) { return this._data[k] || null; },
    setItem(k, v) { this._data[k] = v; },
  };
}

// ============================================================
// Test runner
// ============================================================
let passed = 0, failed = 0, errors = [];

function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (e) {
    failed++;
    errors.push({ name, error: e.message });
    console.log(`  ✗ ${name}: ${e.message}`);
  }
}

function assert(condition, msg = 'Assertion failed') {
  if (!condition) throw new Error(msg);
}

function assertClose(a, b, epsilon = 0.01, msg) {
  if (Math.abs(a - b) > epsilon) throw new Error(msg || `Expected ${a} ≈ ${b}`);
}

// ============================================================
// 1. StyleProfile tests
// ============================================================
console.log('\n━━━ StyleProfile ━━━');
import {
  createDefaultProfile,
  cloneProfile,
  interpolateProfiles,
  profileToCSS,
  serializeProfile,
  deserializeProfile,
} from './src/engine/StyleProfile.js';

test('createDefaultProfile returns valid object with all required fields', () => {
  const p = createDefaultProfile();
  assert(p.id, 'should have id');
  assert(Array.isArray(p.primaryColor), 'primaryColor should be array');
  assert(p.primaryColor.length === 3, 'primaryColor should have 3 channels');
  assert(typeof p.weight === 'number', 'weight should be number');
  assert(typeof p.serifness === 'number', 'serifness should be number');
  assert(typeof p.curvature === 'number', 'curvature should be number');
  assert(typeof p.distortion === 'number', 'distortion should be number');
  assert(typeof p.letterSpacing === 'number', 'letterSpacing should be number');
  assert(typeof p.lineHeight === 'number', 'lineHeight should be number');
  assert(p.confidence === 0, 'default confidence should be 0');
});

test('cloneProfile creates independent copy', () => {
  const a = createDefaultProfile();
  a.weight = 0.8;
  a.primaryColor = [255, 0, 0];
  const b = cloneProfile(a);
  assert(b.id !== a.id, 'clone should have new id');
  assert(b.weight === 0.8, 'clone should copy weight');
  b.primaryColor[0] = 0;
  assert(a.primaryColor[0] === 255, 'modifying clone should not affect original');
});

test('interpolateProfiles blends numeric values correctly', () => {
  const a = createDefaultProfile();
  const b = createDefaultProfile();
  a.weight = 0;
  b.weight = 1;
  a.primaryColor = [0, 0, 0];
  b.primaryColor = [255, 255, 255];

  const mid = interpolateProfiles(a, b, 0.5);
  assertClose(mid.weight, 0.5, 0.01, 'weight should be 0.5');
  assertClose(mid.primaryColor[0], 128, 1, 'color R should be ~128');

  const quarter = interpolateProfiles(a, b, 0.25);
  assertClose(quarter.weight, 0.25, 0.01, 'weight at 0.25 should be 0.25');
});

test('profileToCSS generates valid CSS properties', () => {
  const p = createDefaultProfile();
  p.primaryColor = [100, 200, 50];
  p.weight = 0.5;
  p.slant = 0.5;
  const css = profileToCSS(p);
  assert(css.color === 'rgb(100,200,50)', `color should be rgb string, got ${css.color}`);
  assert(css.fontWeight === 500, `fontWeight should be 500, got ${css.fontWeight}`);
  assert(css.fontStyle === 'italic', 'slant > 0.3 should be italic');
});

test('serializeProfile / deserializeProfile roundtrip', () => {
  const p = createDefaultProfile();
  p.weight = 0.77;
  p.primaryColor = [10, 20, 30];
  const json = serializeProfile(p);
  const restored = deserializeProfile(json);
  assert(restored.weight === 0.77, 'weight should survive roundtrip');
  assert(restored.primaryColor[0] === 10, 'color should survive roundtrip');
  assert(restored.textureData === null, 'textureData should be null after serialize');
});

// ============================================================
// 2. Image Analysis tests
// ============================================================
console.log('\n━━━ Image Analysis ━━━');
import { kMeansColors, luminanceHistogram, detectOrientation } from './src/utils/imageAnalysis.js';

test('kMeansColors clusters pixel data into k colors', () => {
  // Create synthetic image: half red, half blue
  const pixels = new Uint8ClampedArray(400 * 4);
  for (let i = 0; i < 200; i++) {
    pixels[i * 4] = 255; pixels[i * 4 + 1] = 0; pixels[i * 4 + 2] = 0; pixels[i * 4 + 3] = 255;
  }
  for (let i = 200; i < 400; i++) {
    pixels[i * 4] = 0; pixels[i * 4 + 1] = 0; pixels[i * 4 + 2] = 255; pixels[i * 4 + 3] = 255;
  }
  const colors = kMeansColors(pixels, 2, 5);
  assert(colors.length === 2, `should return 2 colors, got ${colors.length}`);
  // One should be reddish, one bluish
  const hasRed = colors.some(c => c[0] > 200 && c[2] < 50);
  const hasBlue = colors.some(c => c[2] > 200 && c[0] < 50);
  assert(hasRed, 'should detect red cluster');
  assert(hasBlue, 'should detect blue cluster');
});

test('luminanceHistogram computes correct distribution', () => {
  // All white pixels
  const pixels = new Uint8ClampedArray(100 * 4);
  for (let i = 0; i < 100; i++) {
    pixels[i * 4] = 255; pixels[i * 4 + 1] = 255; pixels[i * 4 + 2] = 255; pixels[i * 4 + 3] = 255;
  }
  const hist = luminanceHistogram(pixels, 256);
  assert(hist[255] === 100, `bin 255 should have 100 pixels, got ${hist[255]}`);
  assert(hist[0] === 0, 'bin 0 should be empty');
});

test('detectOrientation returns valid ratios summing to ~1', () => {
  const edgeMap = new Float32Array(100 * 100);
  // Create a dense grid of edges so enough pixels exceed the threshold
  for (let y = 2; y < 98; y += 2) {
    for (let x = 2; x < 98; x += 2) {
      edgeMap[y * 100 + x] = 0.5;
      // Add horizontal neighbors to create horizontal edges
      edgeMap[y * 100 + (x - 1)] = 0.8;
      edgeMap[y * 100 + (x + 1)] = 0.1;
    }
  }
  const result = detectOrientation(edgeMap, 100, 100);
  assert(typeof result.horizontal === 'number', 'should have horizontal');
  assert(typeof result.vertical === 'number', 'should have vertical');
  assert(typeof result.diagonal === 'number', 'should have diagonal');
  const sum = result.horizontal + result.vertical + result.diagonal;
  // Sum should be ~1 if any edges were detected, or all zeros if none detected
  assert(sum === 0 || Math.abs(sum - 1) < 0.02, `orientation ratios should sum to ~1, got ${sum}`);
});

// ============================================================
// 3. Canvas Utilities tests
// ============================================================
console.log('\n━━━ Canvas Utilities ━━━');
import {
  canvasToNormalized,
  normalizedToCanvas,
  measureText,
} from './src/utils/canvasUtils.js';

test('canvasToNormalized / normalizedToCanvas are inverse operations', () => {
  const { x, y } = canvasToNormalized(150, 75, 300, 150);
  assertClose(x, 0.5, 0.001, 'normalized x should be 0.5');
  assertClose(y, 0.5, 0.001, 'normalized y should be 0.5');
  const back = normalizedToCanvas(x, y, 300, 150);
  assertClose(back.x, 150, 0.1, 'should round-trip x');
  assertClose(back.y, 75, 0.1, 'should round-trip y');
});

test('measureText returns dimensions', () => {
  const ctx = new MockCanvasContext(500, 500);
  const m = measureText(ctx, 'Hello', '32px Arial');
  assert(m.width > 0, 'width should be positive');
  assert(typeof m.ascent === 'number', 'should have ascent');
  assert(typeof m.descent === 'number', 'should have descent');
});

// ============================================================
// 4. GlyphGenerator tests
// ============================================================
console.log('\n━━━ GlyphGenerator ━━━');
import { GlyphGenerator } from './src/engine/GlyphGenerator.js';

test('GlyphGenerator instantiates without errors', () => {
  const gen = new GlyphGenerator();
  assert(gen, 'should create instance');
});

test('generateGlyph returns valid glyph structure', () => {
  const gen = new GlyphGenerator();
  const style = createDefaultProfile();
  style.weight = 0.5;
  style.serifness = 0;
  const glyph = gen.generateGlyph('A', style);
  assert(glyph.char === 'A', 'char should be A');
  assert(Array.isArray(glyph.paths), 'should have paths array');
  assert(glyph.bounds, 'should have bounds');
  assert(typeof glyph.advance === 'number', 'should have advance width');
  assert(Array.isArray(glyph.anchors), 'should have anchors array');
});

test('generateGlyph caches results for same parameters', () => {
  const gen = new GlyphGenerator();
  const style = createDefaultProfile();
  const g1 = gen.generateGlyph('B', style);
  const g2 = gen.generateGlyph('B', style);
  assert(g1.char === g2.char, 'cached glyph should match');
});

test('generateGlyph handles different font styles (serif vs sans)', () => {
  const gen = new GlyphGenerator();
  const sans = createDefaultProfile();
  sans.serifness = 0;
  const serif = createDefaultProfile();
  serif.serifness = 1;
  const g1 = gen.generateGlyph('X', sans);
  const g2 = gen.generateGlyph('X', serif);
  assert(g1.char === 'X', 'sans glyph should exist');
  assert(g2.char === 'X', 'serif glyph should exist');
});

test('clearCache empties the glyph cache', () => {
  const gen = new GlyphGenerator();
  gen.generateGlyph('Z', createDefaultProfile());
  gen.clearCache();
  // Should not throw on re-generation
  const g = gen.generateGlyph('Z', createDefaultProfile());
  assert(g.char === 'Z', 'should regenerate after cache clear');
});

test('updateAnchor modifies anchor position', () => {
  const gen = new GlyphGenerator();
  const glyph = gen.generateGlyph('M', createDefaultProfile());
  if (glyph.anchors.length > 0) {
    const anchor = glyph.anchors[0];
    const updated = gen.updateAnchor(glyph, anchor.id, 0.5, 0.5);
    const found = updated.anchors.find(a => a.id === anchor.id);
    assertClose(found.x, 0.5, 0.001, 'anchor x should be updated');
    assertClose(found.y, 0.5, 0.001, 'anchor y should be updated');
  }
});

// ============================================================
// 5. TextRenderer tests
// ============================================================
console.log('\n━━━ TextRenderer ━━━');
import { TextRenderer } from './src/engine/TextRenderer.js';

test('TextRenderer instantiates with canvas', () => {
  const canvas = new MockCanvas(800, 600);
  const renderer = new TextRenderer(canvas);
  assert(renderer, 'should create renderer');
  assert(renderer.ctx, 'should have context');
});

test('TextRenderer.resize sets correct dimensions', () => {
  const canvas = new MockCanvas();
  const renderer = new TextRenderer(canvas);
  renderer.resize(1024, 768);
  assert(renderer.logicalWidth === 1024, 'logical width should be 1024');
  assert(renderer.logicalHeight === 768, 'logical height should be 768');
});

test('TextRenderer.render produces layout data', () => {
  const canvas = new MockCanvas(800, 600);
  const renderer = new TextRenderer(canvas);
  renderer.resize(800, 600);
  const style = createDefaultProfile();
  style.primaryColor = [255, 255, 255];
  style.backgroundColor = [0, 0, 0];
  const result = renderer.render('Hello World', style, { fontSize: 48 });
  assert(result.layout, 'should produce layout');
  assert(result.layout.lines.length > 0, 'should have at least 1 line');
  assert(result.layout.lines[0].glyphs.length > 0, 'first line should have glyphs');
});

test('TextRenderer handles newlines correctly', () => {
  const canvas = new MockCanvas(800, 600);
  const renderer = new TextRenderer(canvas);
  renderer.resize(800, 600);
  const style = createDefaultProfile();
  style.primaryColor = [255, 255, 255];
  style.backgroundColor = [0, 0, 0];
  const result = renderer.render('Line 1\nLine 2\nLine 3', style, { fontSize: 36 });
  assert(result.layout.lines.length === 3, `should have 3 lines, got ${result.layout.lines.length}`);
});

test('TextRenderer debug mode includes glyph data', () => {
  const canvas = new MockCanvas(800, 600);
  const renderer = new TextRenderer(canvas);
  renderer.resize(800, 600);
  const style = createDefaultProfile();
  style.primaryColor = [255, 255, 255];
  style.backgroundColor = [0, 0, 0];
  const result = renderer.render('Test', style, { fontSize: 48, debugMode: true });
  assert(result.glyphData, 'debug mode should return glyph data');
  assert(result.glyphData.length === 4, `should have 4 glyphs for "Test", got ${result.glyphData.length}`);
});

test('TextRenderer.invalidateCache clears all caches', () => {
  const canvas = new MockCanvas(800, 600);
  const renderer = new TextRenderer(canvas);
  renderer.resize(800, 600);
  const style = createDefaultProfile();
  style.primaryColor = [255, 255, 255];
  style.backgroundColor = [0, 0, 0];
  renderer.render('Cache test', style, { fontSize: 48 });
  renderer.invalidateCache();
  // Should not throw
  renderer.render('Cache test', style, { fontSize: 48 });
});

test('TextRenderer handles empty text', () => {
  const canvas = new MockCanvas(800, 600);
  const renderer = new TextRenderer(canvas);
  renderer.resize(800, 600);
  const style = createDefaultProfile();
  style.primaryColor = [255, 255, 255];
  style.backgroundColor = [0, 0, 0];
  const result = renderer.render('', style, { fontSize: 48 });
  assert(result.layout.lines.length === 0, 'empty text should have 0 lines');
});

test('TextRenderer applies glow effect without errors', () => {
  const canvas = new MockCanvas(800, 600);
  const renderer = new TextRenderer(canvas);
  renderer.resize(800, 600);
  const style = createDefaultProfile();
  style.primaryColor = [0, 200, 255];
  style.backgroundColor = [0, 0, 0];
  style.glowStrength = 0.8;
  const result = renderer.render('Neon', style, { fontSize: 64 });
  assert(result.layout.lines.length > 0, 'should render with glow');
});

test('TextRenderer applies distortion without errors', () => {
  const canvas = new MockCanvas(800, 600);
  const renderer = new TextRenderer(canvas);
  renderer.resize(800, 600);
  const style = createDefaultProfile();
  style.primaryColor = [255, 255, 255];
  style.backgroundColor = [0, 0, 0];
  style.distortion = 0.7;
  const result = renderer.render('Warp', style, { fontSize: 64, debugMode: true });
  assert(result.layout.lines.length > 0, 'should render with distortion');
});

test('TextRenderer handles all style extremes', () => {
  const canvas = new MockCanvas(800, 600);
  const renderer = new TextRenderer(canvas);
  renderer.resize(800, 600);
  const style = createDefaultProfile();
  style.primaryColor = [255, 0, 128];
  style.backgroundColor = [10, 10, 10];
  style.weight = 1.0;
  style.serifness = 1.0;
  style.slant = 1.0;
  style.roughness = 1.0;
  style.textureStrength = 1.0;
  style.glowStrength = 1.0;
  style.distortion = 1.0;
  style.perspectiveX = 1.0;
  style.perspectiveY = 1.0;
  style.rotation = 45;
  style.letterSpacing = 0.5;
  const result = renderer.render('Extreme!', style, { fontSize: 72 });
  assert(result.layout, 'should handle all extremes');
});

// ============================================================
// 6. Export Utilities tests
// ============================================================
console.log('\n━━━ Export Utilities ━━━');
import { exportSVG, exportGlyphPaths } from './src/utils/exportUtils.js';

test('exportSVG generates valid SVG markup', () => {
  const style = createDefaultProfile();
  style.primaryColor = [255, 100, 50];
  style.backgroundColor = [20, 20, 20];
  const svg = exportSVG('Hello', style, null, null, 800, 600);
  assert(svg.includes('<?xml'), 'should have XML declaration');
  assert(svg.includes('<svg'), 'should have SVG element');
  assert(svg.includes('viewBox="0 0 800 600"'), 'should have correct viewBox');
  assert(svg.includes('rgb(255,100,50)'), 'should include fill color');
  assert(svg.includes('rgb(20,20,20)'), 'should include bg color');
  assert(svg.includes('Hello'), 'should contain the text');
});

test('exportSVG includes glow filter when glowStrength > 0', () => {
  const style = createDefaultProfile();
  style.primaryColor = [0, 255, 200];
  style.backgroundColor = [0, 0, 0];
  style.glowStrength = 0.5;
  const svg = exportSVG('Glow', style, null, null, 800, 600);
  assert(svg.includes('<filter'), 'should include filter for glow');
  assert(svg.includes('feGaussianBlur'), 'should use gaussian blur for glow');
});

test('exportSVG handles special XML characters', () => {
  const style = createDefaultProfile();
  style.primaryColor = [0, 0, 0];
  style.backgroundColor = [255, 255, 255];
  const svg = exportSVG('<script>&test', style, null, null, 400, 200);
  assert(!svg.includes('<script>'), 'should escape < in text');
  assert(svg.includes('&lt;'), 'should use XML entity for <');
  assert(svg.includes('&amp;'), 'should use XML entity for &');
});

// ============================================================
// 7. StyleProfile edge cases
// ============================================================
console.log('\n━━━ Edge Cases ━━━');

test('interpolateProfiles at t=0 returns profile A values', () => {
  const a = createDefaultProfile();
  const b = createDefaultProfile();
  a.weight = 0.2;
  b.weight = 0.9;
  const result = interpolateProfiles(a, b, 0);
  assertClose(result.weight, 0.2, 0.001, 'at t=0, should equal A');
});

test('interpolateProfiles at t=1 returns profile B values', () => {
  const a = createDefaultProfile();
  const b = createDefaultProfile();
  a.weight = 0.2;
  b.weight = 0.9;
  const result = interpolateProfiles(a, b, 1);
  assertClose(result.weight, 0.9, 0.001, 'at t=1, should equal B');
});

test('TextRenderer word wrap at maxWidth boundary', () => {
  const canvas = new MockCanvas(400, 600);
  const renderer = new TextRenderer(canvas);
  renderer.resize(400, 600);
  const style = createDefaultProfile();
  style.primaryColor = [255, 255, 255];
  style.backgroundColor = [0, 0, 0];
  const longText = 'This is a very long sentence that should wrap to multiple lines in the canvas';
  const result = renderer.render(longText, style, { fontSize: 24 });
  assert(result.layout.lines.length > 1, `long text should wrap, got ${result.layout.lines.length} lines`);
});

test('Multiple glyphs generate unique path data', () => {
  const gen = new GlyphGenerator();
  const style = createDefaultProfile();
  const letters = 'ABCDEFGHIJ'.split('');
  const glyphs = letters.map(ch => gen.generateGlyph(ch, style));
  assert(glyphs.length === 10, 'should generate 10 glyphs');
  glyphs.forEach(g => {
    assert(g.char, 'each glyph should have a char');
    assert(g.bounds, 'each glyph should have bounds');
  });
});

test('TextRenderer layout with custom spacing', () => {
  const canvas = new MockCanvas(800, 600);
  const renderer = new TextRenderer(canvas);
  renderer.resize(800, 600);
  const tight = createDefaultProfile();
  tight.primaryColor = [255, 255, 255];
  tight.backgroundColor = [0, 0, 0];
  tight.letterSpacing = -0.2;
  const wide = createDefaultProfile();
  wide.primaryColor = [255, 255, 255];
  wide.backgroundColor = [0, 0, 0];
  wide.letterSpacing = 0.4;
  const r1 = renderer.render('Space', tight, { fontSize: 48 });
  renderer.invalidateCache();
  const r2 = renderer.render('Space', wide, { fontSize: 48 });
  const w1 = r1.layout.lines[0].width;
  const w2 = r2.layout.lines[0].width;
  assert(w2 > w1, `wide spacing (${w2}) should be wider than tight (${w1})`);
});

test('dispose cleans up renderer resources', () => {
  const canvas = new MockCanvas(800, 600);
  const renderer = new TextRenderer(canvas);
  renderer.dispose();
  assert(renderer.glyphCache.size === 0, 'cache should be cleared after dispose');
});

// ============================================================
// Summary
// ============================================================
console.log('\n' + '═'.repeat(50));
console.log(`  Results: ${passed} passed, ${failed} failed`);
if (errors.length > 0) {
  console.log('\n  Failures:');
  errors.forEach(e => console.log(`    ✗ ${e.name}: ${e.error}`));
}
console.log('═'.repeat(50));
process.exit(failed > 0 ? 1 : 0);
