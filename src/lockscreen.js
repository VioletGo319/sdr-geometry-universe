import './lockscreen.css';
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';

const LOOP_SECONDS = 30;
const TAU = Math.PI * 2;
const canvas = document.querySelector('#lockscreen-canvas');

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x01030a);
scene.fog = new THREE.FogExp2(0x01030a, 0.032);

const camera = new THREE.PerspectiveCamera(44, window.innerWidth / window.innerHeight, 0.08, 120);
camera.position.set(0.7, 0.18, 8.2);

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.02;

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.76, 0.58, 0.04);
composer.addPass(bloom);

scene.add(new THREE.AmbientLight(0x8aa7d8, 0.24));
const blueLight = new THREE.PointLight(0x5cb8ff, 4.5, 24);
blueLight.position.set(-5.2, -1.6, 3.2);
scene.add(blueLight);
const goldLight = new THREE.PointLight(0xffce72, 3.4, 24);
goldLight.position.set(1.5, 0.35, 3.8);
scene.add(goldLight);

function seededRandom(seed) {
  let value = seed % 2147483647;
  return () => {
    value = (value * 16807) % 2147483647;
    return (value - 1) / 2147483646;
  };
}

const rand = seededRandom(20260529);

function smoothstep(edge0, edge1, value) {
  const t = THREE.MathUtils.clamp((value - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

function makeGlowTexture(colorA, colorB) {
  const size = 256;
  const textureCanvas = document.createElement('canvas');
  textureCanvas.width = size;
  textureCanvas.height = size;
  const ctx = textureCanvas.getContext('2d');
  const gradient = ctx.createRadialGradient(size / 2, size / 2, 4, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, colorA);
  gradient.addColorStop(0.35, colorB);
  gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  const texture = new THREE.CanvasTexture(textureCanvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function makeEquationSprite(text, width, height, opacity) {
  const dpr = 2;
  const textureCanvas = document.createElement('canvas');
  textureCanvas.width = Math.round(width * 220 * dpr);
  textureCanvas.height = Math.round(height * 220 * dpr);
  const ctx = textureCanvas.getContext('2d');
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, textureCanvas.width, textureCanvas.height);
  ctx.font = `${Math.round(height * 58)}px Georgia, Times New Roman, serif`;
  ctx.fillStyle = 'rgba(190, 220, 255, 0.34)';
  ctx.shadowColor = 'rgba(92, 185, 255, 0.42)';
  ctx.shadowBlur = 18;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, textureCanvas.width / (2 * dpr), textureCanvas.height / (2 * dpr));
  const texture = new THREE.CanvasTexture(textureCanvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    opacity,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(width, height, 1);
  sprite.userData.baseOpacity = opacity;
  return sprite;
}

function manifoldPoint(s, width, theta) {
  const x = THREE.MathUtils.lerp(-5.35, 5.15, s);
  const y = -0.56
    + Math.sin(s * TAU * 1.25 + 0.5) * 0.46
    + Math.sin(s * TAU * 3.2 + theta) * 0.08
    + width * 0.08;
  const z = Math.sin(s * TAU * 1.55 + theta) * 0.52
    + Math.cos(s * TAU * 3.05 - theta * 2) * 0.12
    + width * (0.32 + Math.sin(s * TAU + theta) * 0.035);
  return new THREE.Vector3(x, y, z);
}

function nuisancePoint(s, lane, theta) {
  const x = THREE.MathUtils.lerp(-5.25, 5.25, s);
  const y = -1.7 + lane * 0.16 + Math.sin(s * TAU * 1.2 + theta + lane) * 0.18;
  const z = Math.cos(s * TAU * 1.55 + theta * 2 + lane) * 0.34 + lane * 0.16;
  return new THREE.Vector3(x, y, z);
}

function makeRibbonGeometry() {
  const uSegments = 190;
  const vSegments = 12;
  const positions = new Float32Array((uSegments + 1) * (vSegments + 1) * 3);
  const indices = [];

  for (let i = 0; i < uSegments; i += 1) {
    for (let j = 0; j < vSegments; j += 1) {
      const a = i * (vSegments + 1) + j;
      const b = a + 1;
      const c = a + vSegments + 1;
      const d = c + 1;
      indices.push(a, c, b, b, c, d);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  return geometry;
}

function updateRibbonGeometry(geometry, theta) {
  const uSegments = 190;
  const vSegments = 12;
  const positions = geometry.attributes.position.array;

  for (let i = 0; i <= uSegments; i += 1) {
    const s = i / uSegments;
    for (let j = 0; j <= vSegments; j += 1) {
      const width = THREE.MathUtils.lerp(-0.5, 0.5, j / vSegments);
      const p = manifoldPoint(s, width, theta);
      const index = (i * (vSegments + 1) + j) * 3;
      positions[index] = p.x;
      positions[index + 1] = p.y;
      positions[index + 2] = p.z;
    }
  }

  geometry.attributes.position.needsUpdate = true;
}

function makeObservationParticles() {
  const count = 5200;
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const seeds = [];
  const base = [];
  const targetS = [];
  const palette = [
    new THREE.Color(0x67bcff),
    new THREE.Color(0x9b6cff),
    new THREE.Color(0xdce9ff),
    new THREE.Color(0x466aff),
  ];

  for (let i = 0; i < count; i += 1) {
    const lowerBias = Math.pow(rand(), 1.8);
    const x = -5.7 + rand() * 4.7;
    const y = -2.65 + lowerBias * 3.0 + (rand() - 0.5) * 0.36;
    const z = (rand() - 0.5) * 5.4;
    const color = palette[Math.floor(rand() * palette.length)].clone().lerp(new THREE.Color(0xffffff), rand() * 0.18);
    const idx = i * 3;
    positions[idx] = x;
    positions[idx + 1] = y;
    positions[idx + 2] = z;
    colors[idx] = color.r;
    colors[idx + 1] = color.g;
    colors[idx + 2] = color.b;
    seeds.push(rand() * TAU, 1 + Math.floor(rand() * 4), rand());
    base.push(x, y, z);
    targetS.push(rand() * 0.62);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  const points = new THREE.Points(
    geometry,
    new THREE.PointsMaterial({
      size: 0.014,
      vertexColors: true,
      transparent: true,
      opacity: 0.58,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
  );
  points.userData.base = new Float32Array(base);
  points.userData.seeds = new Float32Array(seeds);
  points.userData.targetS = new Float32Array(targetS);
  return points;
}

function makeManifoldParticles() {
  const count = 880;
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const seeds = [];

  for (let i = 0; i < count; i += 1) {
    const idx = i * 3;
    const color = new THREE.Color(0xffc85f).lerp(new THREE.Color(0xffffff), rand() * 0.28);
    colors[idx] = color.r;
    colors[idx + 1] = color.g;
    colors[idx + 2] = color.b;
    seeds.push(rand(), rand() * TAU, rand() - 0.5);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  const points = new THREE.Points(
    geometry,
    new THREE.PointsMaterial({
      size: 0.018,
      vertexColors: true,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
  );
  points.userData.seeds = new Float32Array(seeds);
  return points;
}

function makeNuisanceParticles() {
  const count = 1500;
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const seeds = [];

  for (let i = 0; i < count; i += 1) {
    const idx = i * 3;
    const color = new THREE.Color(0x42bfff).lerp(new THREE.Color(0xc5f8ff), rand() * 0.24);
    colors[idx] = color.r;
    colors[idx + 1] = color.g;
    colors[idx + 2] = color.b;
    seeds.push(rand(), rand() * 2 - 1, rand() * TAU);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  const points = new THREE.Points(
    geometry,
    new THREE.PointsMaterial({
      size: 0.014,
      vertexColors: true,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
  );
  points.userData.seeds = new Float32Array(seeds);
  return points;
}

function makeDust(count, radius, color, opacity, size) {
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const baseColor = new THREE.Color(color);

  for (let i = 0; i < count; i += 1) {
    const idx = i * 3;
    positions[idx] = (rand() - 0.5) * radius * 2;
    positions[idx + 1] = (rand() - 0.5) * radius * 1.1;
    positions[idx + 2] = (rand() - 0.5) * radius * 1.4;
    const c = baseColor.clone().lerp(new THREE.Color(0xffffff), rand() * 0.22);
    colors[idx] = c.r;
    colors[idx + 1] = c.g;
    colors[idx + 2] = c.b;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return new THREE.Points(
    geometry,
    new THREE.PointsMaterial({
      size,
      vertexColors: true,
      transparent: true,
      opacity,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
  );
}

function makeGrid() {
  const group = new THREE.Group();
  const material = new THREE.LineBasicMaterial({
    color: 0x5f8ac8,
    transparent: true,
    opacity: 0.12,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const points = [];

  for (let i = 0; i <= 20; i += 1) {
    const x = -6 + i * 0.6;
    points.push(new THREE.Vector3(x, -2.92, -3.2), new THREE.Vector3(x + 1.4, -2.62, 2.8));
  }
  for (let i = 0; i <= 12; i += 1) {
    const z = -3.2 + i * 0.5;
    points.push(new THREE.Vector3(-6.0, -2.92, z), new THREE.Vector3(6.1, -2.52, z + 0.42));
  }

  const geometry = new THREE.BufferGeometry().setFromPoints(points);
  group.add(new THREE.LineSegments(geometry, material));
  group.rotation.z = -0.035;
  return group;
}

const root = new THREE.Group();
scene.add(root);

const mist = new THREE.Group();
const mistTexture = makeGlowTexture('rgba(76, 165, 255, 0.52)', 'rgba(120, 72, 210, 0.18)');
[
  [-4.6, -1.7, -1.7, 6.4, 3.4, 0.2],
  [-2.8, -2.1, -2.4, 7.6, 3.0, 0.16],
  [2.6, -1.65, -3.0, 7.4, 2.7, 0.1],
].forEach(([x, y, z, sx, sy, opacity]) => {
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
    map: mistTexture,
    transparent: true,
    opacity,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  }));
  sprite.position.set(x, y, z);
  sprite.scale.set(sx, sy, 1);
  sprite.userData.baseOpacity = opacity;
  mist.add(sprite);
});

const grid = makeGrid();
const backgroundDust = makeDust(1800, 9.2, 0xbfd7ff, 0.18, 0.01);
const epsilonDust = makeDust(1300, 7.2, 0xffffff, 0.14, 0.007);

// X: high-dimensional observations, initially chaotic in the left and lower-left field.
const observationsX = makeObservationParticles();

// Γf(Y): warm low-dimensional signal manifold, rendered as a flowing golden ribbon.
const ribbonGeometry = makeRibbonGeometry();
const ribbonMaterial = new THREE.MeshBasicMaterial({
  color: 0xffc65f,
  transparent: true,
  opacity: 0,
  side: THREE.DoubleSide,
  depthWrite: false,
  blending: THREE.AdditiveBlending,
});
const signalRibbon = new THREE.Mesh(ribbonGeometry, ribbonMaterial);
const ribbonHalo = new THREE.Mesh(
  ribbonGeometry.clone(),
  new THREE.MeshBasicMaterial({
    color: 0xffdf99,
    transparent: true,
    opacity: 0,
    side: THREE.DoubleSide,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  }),
);
ribbonHalo.scale.set(1, 1.08, 1.08);
const manifoldParticles = makeManifoldParticles();

// Γ₀u: cooler orthogonal nuisance stream separating beneath the signal manifold.
const nuisanceStream = makeNuisanceParticles();
const nuisanceTubes = new THREE.Group();
for (let lane = -2; lane <= 2; lane += 1) {
  const path = [];
  for (let i = 0; i < 120; i += 1) {
    path.push(nuisancePoint(i / 119, lane * 0.22, 0));
  }
  const curve = new THREE.CatmullRomCurve3(path);
  const tube = new THREE.Mesh(
    new THREE.TubeGeometry(curve, 140, lane === 0 ? 0.012 : 0.007, 8, false),
    new THREE.MeshBasicMaterial({
      color: lane === 0 ? 0x64d8ff : 0x337ed8,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
  );
  tube.userData.baseOpacity = lane === 0 ? 0.4 : 0.22;
  nuisanceTubes.add(tube);
}

const glyphs = new THREE.Group();
[
  ['X = Γf(Y) + Γ₀u + ε', -2.9, 0.92, -3.2, 3.1, 0.44, 0.055],
  ['span(Γ)', 3.6, 0.15, -3.6, 1.5, 0.34, 0.035],
  ['BᵀX', 4.45, -1.1, -2.7, 1.0, 0.3, 0.03],
  ['ε', -5.2, -0.42, -2.6, 0.54, 0.54, 0.042],
].forEach(([text, x, y, z, sx, sy, opacity]) => {
  const sprite = makeEquationSprite(text, sx, sy, opacity);
  sprite.position.set(x, y, z);
  sprite.userData.basePosition = new THREE.Vector3(x, y, z);
  glyphs.add(sprite);
});

root.add(mist, grid, backgroundDust, epsilonDust, observationsX, signalRibbon, ribbonHalo, manifoldParticles, nuisanceStream, nuisanceTubes, glyphs);

const lookAt = new THREE.Vector3(0, -0.52, 0);
const clock = new THREE.Clock();

function updateObservationParticles(theta, reveal) {
  const positions = observationsX.geometry.attributes.position.array;
  const base = observationsX.userData.base;
  const seeds = observationsX.userData.seeds;
  const targetS = observationsX.userData.targetS;
  const align = smoothstep(0.22, 0.84, reveal) * 0.34;

  for (let i = 0; i < targetS.length; i += 1) {
    const idx = i * 3;
    const seedIdx = i * 3;
    const wave = seeds[seedIdx];
    const speed = seeds[seedIdx + 1];
    const selector = seeds[seedIdx + 2];
    const target = manifoldPoint(targetS[i], selector - 0.5, theta);
    const chaosX = Math.sin(theta * speed + wave) * 0.13 + Math.cos(theta * 2 + wave * 1.7) * 0.08;
    const chaosY = Math.cos(theta * (speed + 1) + wave) * 0.12;
    const chaosZ = Math.sin(theta * (speed + 2) - wave) * 0.16;
    const localAlign = align * smoothstep(0.34, 0.96, selector);

    positions[idx] = THREE.MathUtils.lerp(base[idx] + chaosX, target.x, localAlign);
    positions[idx + 1] = THREE.MathUtils.lerp(base[idx + 1] + chaosY, target.y - 0.12, localAlign);
    positions[idx + 2] = THREE.MathUtils.lerp(base[idx + 2] + chaosZ, target.z, localAlign);
  }

  observationsX.geometry.attributes.position.needsUpdate = true;
}

function updateManifoldParticles(theta, reveal) {
  const positions = manifoldParticles.geometry.attributes.position.array;
  const seeds = manifoldParticles.userData.seeds;
  for (let i = 0; i < seeds.length / 3; i += 1) {
    const idx = i * 3;
    const s = (seeds[idx] + Math.sin(theta) * 0.035 + 1) % 1;
    const jitter = seeds[idx + 2] * 0.42;
    const point = manifoldPoint(s, jitter, theta + seeds[idx + 1]);
    positions[idx] = point.x;
    positions[idx + 1] = point.y + Math.sin(theta * 2 + seeds[idx + 1]) * 0.035;
    positions[idx + 2] = point.z + Math.cos(theta + seeds[idx + 1]) * 0.035;
  }
  manifoldParticles.geometry.attributes.position.needsUpdate = true;
  manifoldParticles.material.opacity = 0.58 * reveal;
}

function updateNuisanceParticles(theta, reveal) {
  const positions = nuisanceStream.geometry.attributes.position.array;
  const seeds = nuisanceStream.userData.seeds;
  for (let i = 0; i < seeds.length / 3; i += 1) {
    const idx = i * 3;
    const s = (seeds[idx] + Math.sin(theta) * 0.045 + 1) % 1;
    const lane = seeds[idx + 1];
    const point = nuisancePoint(s, lane, theta + seeds[idx + 2]);
    positions[idx] = point.x;
    positions[idx + 1] = point.y;
    positions[idx + 2] = point.z;
  }
  nuisanceStream.geometry.attributes.position.needsUpdate = true;
  nuisanceStream.material.opacity = 0.46 * reveal;
  nuisanceTubes.children.forEach((tube) => {
    tube.material.opacity = tube.userData.baseOpacity * reveal;
  });
}

function updateGlyphs(theta, reveal) {
  glyphs.children.forEach((sprite, index) => {
    sprite.material.opacity = sprite.userData.baseOpacity * (0.42 + reveal * 0.8);
    sprite.position.copy(sprite.userData.basePosition);
    sprite.position.y += Math.sin(theta + index) * 0.018;
  });
}

function animate() {
  const elapsed = clock.getElapsedTime();
  const loopTime = elapsed % LOOP_SECONDS;
  const phase = loopTime / LOOP_SECONDS;
  const theta = phase * TAU;
  const emergence = 0.5 - 0.5 * Math.cos(theta);
  const signalReveal = smoothstep(0.08, 0.78, emergence);
  const nuisanceReveal = smoothstep(0.22, 0.82, emergence);

  updateRibbonGeometry(ribbonGeometry, theta);
  updateRibbonGeometry(ribbonHalo.geometry, theta);
  updateObservationParticles(theta, emergence);
  updateManifoldParticles(theta, signalReveal);
  updateNuisanceParticles(theta, nuisanceReveal);
  updateGlyphs(theta, signalReveal);

  signalRibbon.material.opacity = 0.38 * signalReveal;
  ribbonHalo.material.opacity = 0.16 * signalReveal;
  observationsX.material.opacity = 0.48 + Math.sin(theta) * 0.025;
  epsilonDust.material.opacity = 0.1 + Math.cos(theta * 2) * 0.02;
  backgroundDust.rotation.y = Math.sin(theta) * 0.025;
  backgroundDust.rotation.x = Math.cos(theta) * 0.01;
  epsilonDust.rotation.y = Math.sin(theta) * -0.035;
  grid.rotation.y = Math.sin(theta) * 0.018;

  mist.children.forEach((sprite, index) => {
    const base = sprite.userData.baseOpacity;
    sprite.material.opacity = base * (0.82 + Math.sin(theta + index * 0.8) * 0.12);
  });

  blueLight.intensity = 3.2 + nuisanceReveal * 1.8 + Math.sin(theta) * 0.18;
  goldLight.intensity = 1.6 + signalReveal * 3.0;
  bloom.strength = 0.68 + signalReveal * 0.14 + Math.sin(theta * 2) * 0.025;

  camera.position.x = 0.72 + Math.sin(theta) * 0.18;
  camera.position.y = 0.22 + Math.cos(theta) * 0.08;
  camera.position.z = 8.2 + Math.sin(theta) * 0.14;
  lookAt.x = -0.05 + Math.sin(theta) * 0.08;
  lookAt.y = -0.55 + Math.cos(theta) * 0.04;
  camera.lookAt(lookAt);

  composer.render();
}

function resize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  composer.setSize(window.innerWidth, window.innerHeight);
}

window.addEventListener('resize', resize);
renderer.setAnimationLoop(animate);
