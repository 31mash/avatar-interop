// ============================================
// IndiGo Globe — Three.js Immersive 3D Experience
// ============================================

import * as THREE from 'three';

// ---- Constants ----
const GLOBE_RADIUS = 2.5;
const ATMOSPHERE_RADIUS = 2.75;
const DOT_COUNT = 12000;
const ARC_COUNT = 18;
const STAR_COUNT = 3000;

// ---- IndiGo Destinations (lat, lon) ----
const DESTINATIONS = [
  { name: 'Delhi', lat: 28.6139, lon: 77.209 },
  { name: 'Mumbai', lat: 19.076, lon: 72.8777 },
  { name: 'Bengaluru', lat: 12.9716, lon: 77.5946 },
  { name: 'Chennai', lat: 13.0827, lon: 80.2707 },
  { name: 'Kolkata', lat: 22.5726, lon: 88.3639 },
  { name: 'Hyderabad', lat: 17.385, lon: 78.4867 },
  { name: 'Bangkok', lat: 13.7563, lon: 100.5018 },
  { name: 'Singapore', lat: 1.3521, lon: 103.8198 },
  { name: 'Dubai', lat: 25.2048, lon: 55.2708 },
  { name: 'Istanbul', lat: 41.0082, lon: 28.9784 },
  { name: 'Kathmandu', lat: 27.7172, lon: 85.324 },
  { name: 'Colombo', lat: 6.9271, lon: 79.8612 },
  { name: 'Jeddah', lat: 21.4858, lon: 39.1925 },
  { name: 'Doha', lat: 25.2854, lon: 51.531 },
  { name: 'Kuala Lumpur', lat: 3.139, lon: 101.6869 },
  { name: 'Phuket', lat: 7.8804, lon: 98.3923 },
  { name: 'Nairobi', lat: -1.2921, lon: 36.8219 },
  { name: 'London', lat: 51.5074, lon: -0.1278 },
];

// ---- Route Pairs ----
const ROUTES = [
  [0, 1], [0, 2], [0, 3], [0, 4], [0, 5],
  [0, 7], [0, 8], [0, 9], [1, 6], [1, 8],
  [2, 7], [2, 14], [0, 10], [1, 11], [0, 12],
  [0, 13], [0, 16], [0, 17],
];

// ---- Helpers ----
function latLonToVec3(lat, lon, radius) {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lon + 180) * (Math.PI / 180);
  return new THREE.Vector3(
    -radius * Math.sin(phi) * Math.cos(theta),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta)
  );
}

function getArcPoints(start, end, segments = 64) {
  const points = [];
  const startV = latLonToVec3(start.lat, start.lon, GLOBE_RADIUS);
  const endV = latLonToVec3(end.lat, end.lon, GLOBE_RADIUS);
  const mid = startV.clone().add(endV).multiplyScalar(0.5);
  const dist = startV.distanceTo(endV);
  mid.normalize().multiplyScalar(GLOBE_RADIUS + dist * 0.35);

  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const t2 = t * t;
    const mt = 1 - t;
    const mt2 = mt * mt;
    const point = new THREE.Vector3(
      mt2 * startV.x + 2 * mt * t * mid.x + t2 * endV.x,
      mt2 * startV.y + 2 * mt * t * mid.y + t2 * endV.y,
      mt2 * startV.z + 2 * mt * t * mid.z + t2 * endV.z
    );
    points.push(point);
  }
  return points;
}

// ---- Scene Setup ----
const canvas = document.getElementById('globe-canvas');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 0, 8);

// ---- Lighting ----
const ambientLight = new THREE.AmbientLight(0x4FC3F7, 0.3);
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
directionalLight.position.set(5, 3, 5);
scene.add(directionalLight);

const pointLight = new THREE.PointLight(0x4FC3F7, 1.5, 20);
pointLight.position.set(-3, 2, 4);
scene.add(pointLight);

// ---- Globe Group ----
const globeGroup = new THREE.Group();
scene.add(globeGroup);

// ---- Globe Sphere (dark with wireframe feel) ----
const globeGeo = new THREE.SphereGeometry(GLOBE_RADIUS, 64, 64);
const globeMat = new THREE.MeshPhongMaterial({
  color: 0x0a0a2e,
  transparent: true,
  opacity: 0.85,
  shininess: 25,
});
const globe = new THREE.Mesh(globeGeo, globeMat);
globeGroup.add(globe);

// ---- Globe Wireframe Grid ----
const wireGeo = new THREE.SphereGeometry(GLOBE_RADIUS + 0.005, 36, 18);
const wireMat = new THREE.MeshBasicMaterial({
  color: 0x1A237E,
  wireframe: true,
  transparent: true,
  opacity: 0.12,
});
const wireframe = new THREE.Mesh(wireGeo, wireMat);
globeGroup.add(wireframe);

// ---- Dot Pattern on Globe (land approximation) ----
const dotGeo = new THREE.BufferGeometry();
const dotPositions = [];
const dotColors = [];
const dotColor = new THREE.Color(0x4FC3F7);
const dotColorDim = new THREE.Color(0x1A237E);

for (let i = 0; i < DOT_COUNT; i++) {
  const phi = Math.acos(2 * Math.random() - 1);
  const theta = Math.random() * Math.PI * 2;
  const r = GLOBE_RADIUS + 0.01;
  const x = r * Math.sin(phi) * Math.cos(theta);
  const y = r * Math.cos(phi);
  const z = r * Math.sin(phi) * Math.sin(theta);
  dotPositions.push(x, y, z);

  const col = Math.random() > 0.7 ? dotColor : dotColorDim;
  dotColors.push(col.r, col.g, col.b);
}

dotGeo.setAttribute('position', new THREE.Float32BufferAttribute(dotPositions, 3));
dotGeo.setAttribute('color', new THREE.Float32BufferAttribute(dotColors, 3));
const dotMat = new THREE.PointsMaterial({
  size: 0.015,
  vertexColors: true,
  transparent: true,
  opacity: 0.6,
  sizeAttenuation: true,
});
const dots = new THREE.Points(dotGeo, dotMat);
globeGroup.add(dots);

// ---- Atmosphere Glow ----
const atmosGeo = new THREE.SphereGeometry(ATMOSPHERE_RADIUS, 64, 64);
const atmosMat = new THREE.ShaderMaterial({
  vertexShader: `
    varying vec3 vNormal;
    varying vec3 vPosition;
    void main() {
      vNormal = normalize(normalMatrix * normal);
      vPosition = (modelViewMatrix * vec4(position, 1.0)).xyz;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    varying vec3 vNormal;
    varying vec3 vPosition;
    void main() {
      float intensity = pow(0.65 - dot(vNormal, vec3(0.0, 0.0, 1.0)), 3.0);
      vec3 color = mix(vec3(0.31, 0.76, 0.97), vec3(0.0, 0.9, 1.0), intensity);
      gl_FragColor = vec4(color, intensity * 0.6);
    }
  `,
  blending: THREE.AdditiveBlending,
  side: THREE.BackSide,
  transparent: true,
});
const atmosphere = new THREE.Mesh(atmosGeo, atmosMat);
globeGroup.add(atmosphere);

// ---- Destination Markers ----
const markerGroup = new THREE.Group();
globeGroup.add(markerGroup);

DESTINATIONS.forEach((dest) => {
  const pos = latLonToVec3(dest.lat, dest.lon, GLOBE_RADIUS + 0.02);

  // Glowing dot
  const markerGeo = new THREE.SphereGeometry(0.03, 12, 12);
  const markerMat = new THREE.MeshBasicMaterial({ color: 0x00E5FF });
  const marker = new THREE.Mesh(markerGeo, markerMat);
  marker.position.copy(pos);
  markerGroup.add(marker);

  // Pulse ring
  const ringGeo = new THREE.RingGeometry(0.04, 0.06, 24);
  const ringMat = new THREE.MeshBasicMaterial({
    color: 0x4FC3F7,
    transparent: true,
    opacity: 0.5,
    side: THREE.DoubleSide,
  });
  const ring = new THREE.Mesh(ringGeo, ringMat);
  ring.position.copy(pos);
  ring.lookAt(pos.clone().multiplyScalar(2));
  ring.userData = { baseScale: 1 };
  markerGroup.add(ring);
});

// ---- Flight Arcs ----
const arcGroup = new THREE.Group();
globeGroup.add(arcGroup);
const arcData = [];

ROUTES.forEach(([fromIdx, toIdx]) => {
  const from = DESTINATIONS[fromIdx];
  const to = DESTINATIONS[toIdx];
  const points = getArcPoints(from, to);
  const curve = new THREE.CatmullRomCurve3(points);
  const tubeGeo = new THREE.TubeGeometry(curve, 64, 0.008, 6, false);

  const tubeMat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uColor1: { value: new THREE.Color(0x4FC3F7) },
      uColor2: { value: new THREE.Color(0x00E5FF) },
      uProgress: { value: 0 },
    },
    vertexShader: `
      attribute float arcLength;
      varying float vArc;
      varying vec3 vPos;
      void main() {
        vPos = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform vec3 uColor1;
      uniform vec3 uColor2;
      uniform float uProgress;
      varying vec3 vPos;
      void main() {
        float pulse = sin(uTime * 3.0 + length(vPos) * 10.0) * 0.5 + 0.5;
        vec3 color = mix(uColor1, uColor2, pulse);
        float alpha = 0.4 + pulse * 0.3;
        gl_FragColor = vec4(color, alpha * uProgress);
      }
    `,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });

  const tube = new THREE.Mesh(tubeGeo, tubeMat);
  arcGroup.add(tube);
  arcData.push({ mesh: tube, delay: Math.random() * 2 });
});

// ---- Moving Airplane Dots on Arcs ----
const planeDots = [];
ROUTES.forEach(([fromIdx, toIdx], i) => {
  const from = DESTINATIONS[fromIdx];
  const to = DESTINATIONS[toIdx];
  const points = getArcPoints(from, to);
  const curve = new THREE.CatmullRomCurve3(points);

  const dotGeo2 = new THREE.SphereGeometry(0.025, 8, 8);
  const dotMat2 = new THREE.MeshBasicMaterial({ color: 0x00E5FF });
  const dot = new THREE.Mesh(dotGeo2, dotMat2);
  globeGroup.add(dot);

  planeDots.push({
    mesh: dot,
    curve,
    speed: 0.08 + Math.random() * 0.06,
    offset: Math.random(),
  });
});

// ---- Starfield Background ----
const starsGeo = new THREE.BufferGeometry();
const starPositions = [];
const starSizes = [];

for (let i = 0; i < STAR_COUNT; i++) {
  const r = 40 + Math.random() * 60;
  const theta = Math.random() * Math.PI * 2;
  const phi = Math.acos(2 * Math.random() - 1);
  starPositions.push(
    r * Math.sin(phi) * Math.cos(theta),
    r * Math.cos(phi),
    r * Math.sin(phi) * Math.sin(theta)
  );
  starSizes.push(0.3 + Math.random() * 1.2);
}

starsGeo.setAttribute('position', new THREE.Float32BufferAttribute(starPositions, 3));
starsGeo.setAttribute('size', new THREE.Float32BufferAttribute(starSizes, 1));

const starsMat = new THREE.ShaderMaterial({
  uniforms: { uTime: { value: 0 } },
  vertexShader: `
    attribute float size;
    varying float vSize;
    uniform float uTime;
    void main() {
      vSize = size;
      vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
      gl_PointSize = size * (200.0 / -mvPos.z);
      gl_Position = projectionMatrix * mvPos;
    }
  `,
  fragmentShader: `
    varying float vSize;
    uniform float uTime;
    void main() {
      float d = length(gl_PointCoord - vec2(0.5));
      if (d > 0.5) discard;
      float alpha = (1.0 - d * 2.0) * 0.8;
      float twinkle = sin(uTime * 2.0 + vSize * 10.0) * 0.3 + 0.7;
      gl_FragColor = vec4(0.8, 0.9, 1.0, alpha * twinkle);
    }
  `,
  transparent: true,
  depthWrite: false,
  blending: THREE.AdditiveBlending,
});

const stars = new THREE.Points(starsGeo, starsMat);
scene.add(stars);

// ---- Nebula Particles ----
const nebulaGeo = new THREE.BufferGeometry();
const nebulaPositions = [];
for (let i = 0; i < 500; i++) {
  const r = 15 + Math.random() * 30;
  const theta = Math.random() * Math.PI * 2;
  const phi = Math.acos(2 * Math.random() - 1);
  nebulaPositions.push(
    r * Math.sin(phi) * Math.cos(theta),
    r * Math.cos(phi),
    r * Math.sin(phi) * Math.sin(theta)
  );
}
nebulaGeo.setAttribute('position', new THREE.Float32BufferAttribute(nebulaPositions, 3));
const nebulaMat = new THREE.PointsMaterial({
  color: 0x1A237E,
  size: 0.8,
  transparent: true,
  opacity: 0.15,
  blending: THREE.AdditiveBlending,
  depthWrite: false,
});
const nebula = new THREE.Points(nebulaGeo, nebulaMat);
scene.add(nebula);

// ---- Scroll State ----
let scrollProgress = 0;
let targetScrollProgress = 0;
const scrollSections = 5;

function updateScrollProgress() {
  const scrollTop = window.scrollY;
  const docHeight = document.documentElement.scrollHeight - window.innerHeight;
  targetScrollProgress = docHeight > 0 ? scrollTop / docHeight : 0;
}

window.addEventListener('scroll', updateScrollProgress, { passive: true });

// ---- Camera & Globe positions per scroll section ----
const cameraKeyframes = [
  { pos: [0, 0, 8], lookAt: [0, 0, 0], globeX: 2.5, globeY: 0, rotY: 0 },       // Hero
  { pos: [-1, 0.5, 6], lookAt: [0, 0, 0], globeX: 3, globeY: -0.3, rotY: 1.2 },  // Routes
  { pos: [1, -0.5, 7], lookAt: [0, 0, 0], globeX: -3, globeY: 0.5, rotY: 2.8 },  // Stats
  { pos: [0, 1, 5.5], lookAt: [0, 0, 0], globeX: 2, globeY: -0.8, rotY: 4.2 },   // Experience
  { pos: [0, 0, 6], lookAt: [0, 0, 0], globeX: 0, globeY: 0, rotY: 5.8 },        // CTA
];

function lerpValue(a, b, t) {
  return a + (b - a) * t;
}

function getInterpolatedKeyframe(progress) {
  const total = cameraKeyframes.length - 1;
  const raw = progress * total;
  const idx = Math.min(Math.floor(raw), total - 1);
  const t = raw - idx;
  const smoothT = t * t * (3 - 2 * t); // smoothstep

  const a = cameraKeyframes[idx];
  const b = cameraKeyframes[idx + 1];

  return {
    posX: lerpValue(a.pos[0], b.pos[0], smoothT),
    posY: lerpValue(a.pos[1], b.pos[1], smoothT),
    posZ: lerpValue(a.pos[2], b.pos[2], smoothT),
    globeX: lerpValue(a.globeX, b.globeX, smoothT),
    globeY: lerpValue(a.globeY, b.globeY, smoothT),
    rotY: lerpValue(a.rotY, b.rotY, smoothT),
  };
}

// ---- Intersection Observer for Fade-In & Stats Counter ----
const fadeEls = document.querySelectorAll('.fade-in');
const observer = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        const delay = entry.target.dataset.delay || 0;
        setTimeout(() => {
          entry.target.classList.add('visible');
        }, parseInt(delay));
      }
    });
  },
  { threshold: 0.15 }
);
fadeEls.forEach((el) => observer.observe(el));

// ---- Stats Counter Animation ----
const statNumbers = document.querySelectorAll('.stat-number[data-target]');
let statsCounted = false;

const statsObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting && !statsCounted) {
        statsCounted = true;
        statNumbers.forEach((el) => {
          const target = parseInt(el.dataset.target);
          animateCounter(el, target);
        });
      }
    });
  },
  { threshold: 0.3 }
);
const statsSection = document.getElementById('stats');
if (statsSection) statsObserver.observe(statsSection);

function animateCounter(el, target) {
  const duration = 2000;
  const start = performance.now();
  function update(now) {
    const elapsed = now - start;
    const progress = Math.min(elapsed / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    el.textContent = Math.round(target * eased);
    if (progress < 1) requestAnimationFrame(update);
  }
  requestAnimationFrame(update);
}

// ---- Airplane Scroll Tracker ----
const airplaneTracker = document.getElementById('airplane-tracker');
let mouseX = window.innerWidth / 2;
let mouseY = window.innerHeight / 2;

window.addEventListener('mousemove', (e) => {
  mouseX = e.clientX;
  mouseY = e.clientY;
});

// ---- Resize Handler ----
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ---- Marker Pulse Animation ----
const pulseRings = [];
markerGroup.children.forEach((child) => {
  if (child.geometry.type === 'RingGeometry') {
    pulseRings.push(child);
  }
});

// ---- Animation Loop ----
const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);

  const elapsed = clock.getElapsedTime();
  const delta = clock.getDelta();

  // Smooth scroll interpolation
  scrollProgress += (targetScrollProgress - scrollProgress) * 0.05;

  // Get interpolated camera/globe state
  const kf = getInterpolatedKeyframe(Math.min(scrollProgress, 0.999));

  // Camera
  camera.position.set(kf.posX, kf.posY, kf.posZ);
  camera.lookAt(0, 0, 0);

  // Globe position & rotation
  globeGroup.position.x += (kf.globeX - globeGroup.position.x) * 0.04;
  globeGroup.position.y += (kf.globeY - globeGroup.position.y) * 0.04;
  globeGroup.rotation.y = kf.rotY + elapsed * 0.05; // auto-rotate + scroll rotation

  // Tilt globe slightly based on mouse
  const mouseTiltX = (mouseY / window.innerHeight - 0.5) * 0.15;
  const mouseTiltZ = (mouseX / window.innerWidth - 0.5) * -0.15;
  globeGroup.rotation.x += (mouseTiltX - globeGroup.rotation.x) * 0.03;
  globeGroup.rotation.z += (mouseTiltZ - globeGroup.rotation.z) * 0.03;

  // Arc animations
  arcData.forEach(({ mesh, delay }) => {
    mesh.material.uniforms.uTime.value = elapsed;
    const progress = Math.min(Math.max((scrollProgress * scrollSections - 0.5) * 2, 0), 1);
    mesh.material.uniforms.uProgress.value = progress;
  });

  // Moving airplane dots on arcs
  planeDots.forEach(({ mesh, curve, speed, offset }) => {
    const t = ((elapsed * speed + offset) % 1);
    const point = curve.getPointAt(t);
    mesh.position.copy(point);
    mesh.visible = scrollProgress > 0.05;
  });

  // Pulse rings
  pulseRings.forEach((ring, i) => {
    const pulse = Math.sin(elapsed * 2 + i * 0.5) * 0.3 + 1;
    ring.scale.setScalar(pulse);
    ring.material.opacity = 0.5 - (pulse - 1) * 0.8;
  });

  // Stars twinkle
  starsMat.uniforms.uTime.value = elapsed;

  // Nebula rotation
  nebula.rotation.y = elapsed * 0.005;
  nebula.rotation.x = elapsed * 0.003;

  // Stars slow rotation
  stars.rotation.y = elapsed * 0.002;

  // Atmosphere pulse
  atmosphere.scale.setScalar(1 + Math.sin(elapsed * 0.5) * 0.008);

  // Airplane tracker position
  if (scrollProgress > 0.02 && scrollProgress < 0.98) {
    airplaneTracker.style.opacity = '0.8';
    const pathY = scrollProgress * window.innerHeight;
    const waveX = Math.sin(scrollProgress * Math.PI * 4) * 30 + 30;
    airplaneTracker.style.transform = `translate(${waveX}px, ${mouseY}px) rotate(${Math.sin(elapsed) * 15}deg)`;
  } else {
    airplaneTracker.style.opacity = '0';
  }

  renderer.render(scene, camera);
}

animate();

// ---- Debug: Log FPS (optional) ----
// let frameCount = 0;
// setInterval(() => { console.log('FPS:', frameCount); frameCount = 0; }, 1000);
// Original loop increment: frameCount++ in animate();

console.log('IndiGo Globe Experience initialized');
