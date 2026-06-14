import './styles.css';
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';

const canvas = document.querySelector('#sdr-canvas');
const navButtons = [...document.querySelectorAll('[data-page]')];
const titleEl = document.querySelector('#page-title');
const kickerEl = document.querySelector('#page-kicker');
const copyEl = document.querySelector('#page-copy');
const prevButton = document.querySelector('#prev-page');
const nextButton = document.querySelector('#next-page');
const autoplayButton = document.querySelector('#autoplay-toggle');

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => {
      // The gallery still runs normally when opened from a plain file preview.
    });
  });
}

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x02040a);
scene.fog = new THREE.FogExp2(0x02040a, 0.018);

const camera = new THREE.PerspectiveCamera(48, window.innerWidth / window.innerHeight, 0.08, 180);
camera.position.set(9, 4, 12);

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.04;

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.82, 0.55, 0.045);
composer.addPass(bloom);

scene.add(new THREE.AmbientLight(0x87a9d9, 0.35));
const keyLight = new THREE.PointLight(0xffffff, 4.5, 80);
keyLight.position.set(3, 6, 7);
scene.add(keyLight);
const blueLight = new THREE.PointLight(0x47baff, 5.5, 90);
blueLight.position.set(-8, 1, -7);
scene.add(blueLight);
const goldLight = new THREE.PointLight(0xffd06a, 3.8, 70);
goldLight.position.set(6, 4, -2);
scene.add(goldLight);

const clock = new THREE.Clock();
const pagesRoot = new THREE.Group();
scene.add(pagesRoot);

const reusable = {
  vector: new THREE.Vector3(),
  colorA: new THREE.Color(),
  colorB: new THREE.Color(),
};

function randomUnitVector() {
  return new THREE.Vector3(
    Math.random() * 2 - 1,
    Math.random() * 2 - 1,
    Math.random() * 2 - 1,
  ).normalize();
}

function smoothstep(edge0, edge1, value) {
  const t = THREE.MathUtils.clamp((value - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

function forEachMaterial(object, callback) {
  object.traverse((child) => {
    if (!child.material) return;
    const materials = Array.isArray(child.material) ? child.material : [child.material];
    materials.forEach(callback);
  });
}

function rememberOpacity(object) {
  forEachMaterial(object, (material) => {
    material.transparent = true;
    material.userData.baseOpacity = material.opacity ?? 1;
  });
}

function setGroupOpacity(group, opacity) {
  group.visible = opacity > 0.015;
  forEachMaterial(group, (material) => {
    const base = material.userData.baseOpacity ?? material.opacity ?? 1;
    material.opacity = THREE.MathUtils.clamp(base * opacity, 0, 1);
    material.needsUpdate = true;
  });
}

function makePoints({ count, radius, color, size, opacity, mode = 'sphere', stretch = [1, 1, 1] }) {
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const base = new THREE.Color(color);

  for (let i = 0; i < count; i += 1) {
    const idx = i * 3;
    const dir = randomUnitVector();
    const r = radius * Math.pow(Math.random(), mode === 'shell' ? 0.06 : 0.42);
    let x = dir.x;
    let y = dir.y;
    let z = dir.z;

    if (mode === 'disk') y *= 0.22;
    if (mode === 'vortex') {
      const angle = Math.atan2(z, x) + r * 0.22;
      x = Math.cos(angle);
      z = Math.sin(angle);
      y *= 0.34;
    }
    if (mode === 'market') {
      x = (Math.random() - 0.5) * 2;
      y = Math.sin(x * 6 + Math.random()) * 0.32 + (Math.random() - 0.5) * 0.2;
      z = (Math.random() - 0.5) * 2;
    }

    positions[idx] = x * r * stretch[0];
    positions[idx + 1] = y * r * stretch[1];
    positions[idx + 2] = z * r * stretch[2];

    const shift = Math.random() * 0.32;
    colors[idx] = Math.min(1, base.r + shift * 0.12);
    colors[idx + 1] = Math.min(1, base.g + shift * 0.28);
    colors[idx + 2] = Math.min(1, base.b + shift * 0.5);
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

function makeTube(points, color, radius, opacity, closed = false) {
  const curve = new THREE.CatmullRomCurve3(points, closed, 'catmullrom', 0.58);
  const geometry = new THREE.TubeGeometry(curve, 180, radius, 12, closed);
  const material = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.userData.curve = curve;
  return mesh;
}

function makeTorus(radius, tube, color, opacity) {
  return new THREE.Mesh(
    new THREE.TorusGeometry(radius, tube, 12, 170),
    new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
  );
}

function ribbonPoint(t, w, phase) {
  return new THREE.Vector3(
    Math.sin(t * 0.78 + phase) * 2.15 + Math.sin(t * 1.9) * 0.35 + Math.cos(t + phase) * w * 0.46,
    Math.cos(t * 0.56 + phase) * 1.05 + t * 0.14 + Math.sin(t * 1.2) * w * 0.36,
    t * 0.9 + Math.cos(t * 1.1 + phase) * 0.72 + Math.sin(t * 1.5 + phase) * w * 0.4,
  );
}

function makeRibbonManifold(phase = 0) {
  const uSegments = 96;
  const vSegments = 12;
  const vertices = [];
  const indices = [];

  for (let i = 0; i <= uSegments; i += 1) {
    const t = THREE.MathUtils.lerp(-4, 4, i / uSegments);
    for (let j = 0; j <= vSegments; j += 1) {
      const w = THREE.MathUtils.lerp(-0.68, 0.68, j / vSegments);
      const p = ribbonPoint(t, w, phase);
      vertices.push(p.x, p.y, p.z);
    }
  }

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
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();

  const group = new THREE.Group();
  group.add(new THREE.Mesh(
    geometry,
    new THREE.MeshPhysicalMaterial({
      color: 0xf8c75e,
      emissive: 0xa86a12,
      emissiveIntensity: 0.7,
      roughness: 0.45,
      transparent: true,
      opacity: 0.32,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
  ));
  group.add(new THREE.Mesh(
    geometry.clone(),
    new THREE.MeshBasicMaterial({
      color: 0xffdf8b,
      wireframe: true,
      transparent: true,
      opacity: 0.1,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
  ));

  [-0.48, -0.15, 0.18, 0.5].forEach((offset) => {
    const points = [];
    for (let i = 0; i < 82; i += 1) {
      const t = THREE.MathUtils.lerp(-4, 4, i / 81);
      points.push(ribbonPoint(t, offset + Math.sin(t * 1.3 + phase) * 0.1, phase));
    }
    group.add(makeTube(points, 0xffdc80, 0.011, 0.42));
  });

  return group;
}

function makeCrystalWorld(radius = 2.2) {
  const group = new THREE.Group();
  group.add(new THREE.Mesh(
    new THREE.IcosahedronGeometry(radius, 5),
    new THREE.MeshPhysicalMaterial({
      color: 0xbaffec,
      emissive: 0x1b7180,
      emissiveIntensity: 0.35,
      roughness: 0.05,
      transmission: 0.58,
      transparent: true,
      opacity: 0.28,
      thickness: 2.3,
      clearcoat: 1,
      clearcoatRoughness: 0.04,
      side: THREE.DoubleSide,
    }),
  ));
  group.add(new THREE.Mesh(
    new THREE.IcosahedronGeometry(radius * 1.02, 2),
    new THREE.MeshBasicMaterial({
      color: 0xcaffef,
      wireframe: true,
      transparent: true,
      opacity: 0.18,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
  ));
  group.add(makePoints({
    count: 850,
    radius: radius * 0.95,
    color: 0x9dffe5,
    size: 0.021,
    opacity: 0.38,
    mode: 'shell',
  }));

  for (let i = 0; i < 34; i += 1) {
    const shard = new THREE.Mesh(
      new THREE.TetrahedronGeometry(0.08 + Math.random() * 0.11, 0),
      new THREE.MeshPhysicalMaterial({
        color: 0xc9fff1,
        emissive: 0x286d82,
        emissiveIntensity: 0.42,
        transmission: 0.45,
        transparent: true,
        opacity: 0.46,
        depthWrite: false,
      }),
    );
    shard.position.copy(randomUnitVector().multiplyScalar(radius * (0.82 + Math.random() * 0.34)));
    shard.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
    shard.userData.spin = Math.random() * 0.01 + 0.004;
    group.add(shard);
  }

  return group;
}

function makeCore(color = 0xdff8ff, scale = 1) {
  const group = new THREE.Group();
  group.add(new THREE.Mesh(
    new THREE.IcosahedronGeometry(0.38 * scale, 3),
    new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      emissive: color,
      emissiveIntensity: 3.2,
      roughness: 0.08,
      transparent: true,
      opacity: 0.95,
      clearcoat: 1,
    }),
  ));
  group.add(makePoints({
    count: 500,
    radius: 0.92 * scale,
    color,
    size: 0.02 * scale,
    opacity: 0.76,
    mode: 'shell',
  }));
  for (let i = 0; i < 3; i += 1) {
    const ring = makeTorus((0.72 + i * 0.22) * scale, 0.01 * scale, i % 2 ? 0x7edaff : 0xffffff, 0.58);
    ring.rotation.set(0.55 + i * 0.44, 0.25 + i * 0.18, i * 0.7);
    group.add(ring);
  }
  return group;
}

function makeGridPlane(width, depth, step, color, opacity) {
  const group = new THREE.Group();
  const material = new THREE.LineBasicMaterial({
    color,
    transparent: true,
    opacity,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });

  for (let x = -width / 2; x <= width / 2 + 0.001; x += step) {
    const geometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(x, 0, -depth / 2),
      new THREE.Vector3(x, 0, depth / 2),
    ]);
    group.add(new THREE.Line(geometry, material));
  }

  for (let z = -depth / 2; z <= depth / 2 + 0.001; z += step) {
    const geometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(-width / 2, 0, z),
      new THREE.Vector3(width / 2, 0, z),
    ]);
    group.add(new THREE.Line(geometry, material));
  }

  return group;
}

function makeScatterNodes(count, radius, color, opacity, scale = new THREE.Vector3(1, 1, 1)) {
  const group = new THREE.Group();
  const nodeMaterial = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity,
    blending: THREE.AdditiveBlending,
  });

  for (let i = 0; i < count; i += 1) {
    const node = new THREE.Mesh(new THREE.SphereGeometry(0.035 + Math.random() * 0.035, 10, 10), nodeMaterial);
    node.position.copy(randomUnitVector().multiplyScalar(radius * Math.pow(Math.random(), 0.5)));
    node.position.multiply(scale);
    node.userData.spin = 0.001 + Math.random() * 0.002;
    group.add(node);
  }

  return group;
}

function makeLowDimensionalPanel(width, height, color, opacity) {
  const group = new THREE.Group();
  const panel = new THREE.Mesh(
    new THREE.PlaneGeometry(width, height, 18, 18),
    new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity,
      wireframe: true,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
  );
  group.add(panel);
  return group;
}

function makeLatentFlowParticles({ count, radius, color, size, opacity, coherence = 1 }) {
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const base = new THREE.Color(color);

  for (let i = 0; i < count; i += 1) {
    const idx = i * 3;
    const band = Math.floor(Math.random() * 7);
    const t = Math.random() * Math.PI * 2;
    const lane = (band - 3) * 0.42;
    const r = radius * (0.22 + Math.random() * 0.78);
    const fieldPhase = t * (1.2 + band * 0.035) + lane;
    const randomDrift = (1 - coherence) * (Math.random() - 0.5) * radius;

    positions[idx] = Math.cos(fieldPhase) * r * (1.15 + lane * 0.05) + randomDrift;
    positions[idx + 1] = Math.sin(t * 1.7 + lane) * 1.4 + lane * 0.7 + randomDrift * 0.16;
    positions[idx + 2] = Math.sin(fieldPhase) * r * 0.74 + Math.cos(t * 0.8 + band) * 1.1 + randomDrift;

    const shift = Math.random() * 0.26;
    colors[idx] = Math.min(1, base.r + shift * 0.08);
    colors[idx + 1] = Math.min(1, base.g + shift * 0.24);
    colors[idx + 2] = Math.min(1, base.b + shift * 0.5);
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

function makeLatentCurrent(phase, radius, color, opacity, thickness = 0.012) {
  const points = [];

  for (let i = 0; i < 130; i += 1) {
    const t = i / 129;
    const a = phase + t * Math.PI * (1.7 + Math.sin(phase) * 0.22);
    const taper = 1 - t * 0.24;
    points.push(new THREE.Vector3(
      Math.cos(a) * radius * taper,
      Math.sin(t * Math.PI * 1.8 + phase) * 1.45 + (t - 0.5) * 2.6,
      Math.sin(a) * radius * (0.68 + t * 0.14),
    ));
  }

  const current = makeTube(points, color, thickness, opacity);
  current.rotation.set(0.46 + Math.sin(phase) * 0.1, -0.35 + Math.cos(phase) * 0.08, phase * 0.12);
  return current;
}

function makeCrystalMaterial(color, opacity, emissive = 0x175f73) {
  return new THREE.MeshPhysicalMaterial({
    color,
    emissive,
    emissiveIntensity: 0.3,
    roughness: 0.08,
    metalness: 0,
    transmission: 0.55,
    transparent: true,
    opacity,
    thickness: 2.2,
    clearcoat: 1,
    clearcoatRoughness: 0.05,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
}

function makeCrystallizingWorld(radius = 2.75) {
  const group = new THREE.Group();
  const shellMaterial = makeCrystalMaterial(0xbffff0, 0.22);
  const innerMaterial = makeCrystalMaterial(0x95ffe5, 0.16, 0x1b7f8f);

  // X: layered translucent geometry, intentionally not a simple wireframe sphere.
  const outer = new THREE.Mesh(new THREE.IcosahedronGeometry(radius, 4), shellMaterial);
  outer.scale.set(1.05, 0.92, 1.0);
  group.add(outer);

  const middle = new THREE.Mesh(new THREE.DodecahedronGeometry(radius * 0.78, 2), innerMaterial);
  middle.rotation.set(0.3, 0.2, -0.18);
  middle.scale.set(0.92, 1.08, 0.86);
  group.add(middle);

  const coreLattice = new THREE.Mesh(
    new THREE.OctahedronGeometry(radius * 0.48, 3),
    makeCrystalMaterial(0xe8fff8, 0.2, 0x4cb4c8),
  );
  coreLattice.rotation.set(-0.2, 0.48, 0.16);
  group.add(coreLattice);

  for (let i = 0; i < 56; i += 1) {
    const shard = new THREE.Mesh(
      new THREE.TetrahedronGeometry(0.08 + Math.random() * 0.18, 0),
      makeCrystalMaterial(i % 5 === 0 ? 0xffffff : 0xb6ffee, 0.34 + Math.random() * 0.18),
    );
    const dir = randomUnitVector();
    shard.position.copy(dir.multiplyScalar(radius * (0.38 + Math.random() * 0.72)));
    shard.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
    shard.scale.setScalar(0.2 + Math.random() * 0.8);
    shard.userData.baseScale = 0.6 + Math.random() * 1.6;
    shard.userData.spin = 0.002 + Math.random() * 0.005;
    group.add(shard);
  }

  // Internal light pathways: observation has structure inside, not just a boundary.
  for (let i = 0; i < 12; i += 1) {
    const points = [];
    const phase = i * 0.54;
    for (let j = 0; j < 86; j += 1) {
      const t = j / 85;
      const a = phase + t * Math.PI * 2.35;
      const r = radius * (0.12 + t * 0.62);
      points.push(new THREE.Vector3(
        Math.cos(a) * r * (0.82 + Math.sin(phase) * 0.08),
        Math.sin(t * Math.PI * 1.6 + phase) * radius * 0.26,
        Math.sin(a) * r * 0.72,
      ));
    }
    group.add(makeTube(points, i % 4 === 0 ? 0xffffff : 0x98ffe5, 0.008, i % 4 === 0 ? 0.34 : 0.22));
  }

  return group;
}

function makeCosmicCrystalWorld(radius = 2.45) {
  const group = makeCrystalWorld(radius);

  // X: internal light structures make observation feel emergent, not just outlined.
  for (let i = 0; i < 9; i += 1) {
    const points = [];
    const phase = i * 0.7;
    for (let j = 0; j < 78; j += 1) {
      const t = j / 77;
      const a = phase + t * Math.PI * 2.2;
      const r = radius * (0.18 + t * 0.62);
      points.push(new THREE.Vector3(
        Math.cos(a) * r,
        Math.sin(t * Math.PI * 1.4 + phase) * radius * 0.28,
        Math.sin(a) * r * 0.72,
      ));
    }
    group.add(makeTube(points, i % 3 === 0 ? 0xffffff : 0x9effe5, 0.009, i % 3 === 0 ? 0.36 : 0.24));
  }

  const innerFacet = new THREE.Mesh(
    new THREE.IcosahedronGeometry(radius * 0.62, 2),
    new THREE.MeshBasicMaterial({
      color: 0xe8fff8,
      transparent: true,
      opacity: 0.16,
      wireframe: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
  );
  innerFacet.userData.spin = 0.005;
  group.add(innerFacet);

  return group;
}

function makeCosmicPage() {
  const group = new THREE.Group();
  const noise = new THREE.Group();
  const latent = new THREE.Group();
  const signal = new THREE.Group();
  const crystal = new THREE.Group();
  const core = new THREE.Group();

  // ε: stochastic dust and quantum fluctuations fill all space and never disappear.
  noise.add(makePoints({ count: 3400, radius: 24, color: 0xf1f6ff, size: 0.012, opacity: 0.32, stretch: [1.2, 1, 1.2] }));
  noise.add(makePoints({ count: 1800, radius: 9.5, color: 0xffffff, size: 0.01, opacity: 0.28, stretch: [1.1, 0.9, 1] }));
  noise.add(makePoints({ count: 900, radius: 34, color: 0x6e7e9f, size: 0.018, opacity: 0.22, stretch: [1.35, 1, 1.25] }));

  // Γ₀Φ(u): the transformed latent component is the dominant universe.
  // Blue nebula oceans, gravitational currents, dark-matter rivers, and giant vortex
  // structures occupy most of the scene before the signal manifold is visible.
  latent.add(makePoints({ count: 9800, radius: 13.5, color: 0x2e9cff, size: 0.036, opacity: 0.66, mode: 'vortex', stretch: [1.42, 0.72, 1.2] }));
  latent.add(makePoints({ count: 4200, radius: 8.2, color: 0x7de8ff, size: 0.025, opacity: 0.52, mode: 'vortex', stretch: [1.12, 0.58, 0.94] }));

  for (let i = 0; i < 22; i += 1) {
    const points = [];
    const phase = i * 0.54;
    const radius = 4.6 + (i % 7) * 0.58;
    for (let j = 0; j < 98; j += 1) {
      const t = j / 97;
      const a = phase + t * Math.PI * (1.7 + (i % 5) * 0.12);
      points.push(new THREE.Vector3(
        Math.cos(a) * radius * (1.08 - t * 0.22),
        Math.sin(a * 0.74 + phase) * 1.45 + (t - 0.5) * 2.8,
        Math.sin(a) * radius * (0.75 + t * 0.16),
      ));
    }
    const river = makeTube(points, i % 4 === 0 ? 0x102a59 : 0x54c5ff, 0.012 + (i % 3) * 0.004, i % 4 === 0 ? 0.42 : 0.46);
    river.rotation.set(0.56, -0.32 + i * 0.015, 0.18 + i * 0.05);
    latent.add(river);
  }

  for (let i = 0; i < 6; i += 1) {
    const vortex = makeTorus(3.2 + i * 0.7, 0.014, i % 2 === 0 ? 0x66d7ff : 0x12376c, i % 2 === 0 ? 0.28 : 0.34);
    vortex.rotation.set(0.82 + i * 0.18, -0.42, i * 0.44);
    latent.add(vortex);
  }

  // Γf(Y): golden organized geometry emerges from the blue latent universe.
  // These are low-dimensional manifolds and celestial architecture, not beams.
  for (let i = 0; i < 4; i += 1) {
    const ribbon = makeRibbonManifold(i * 1.7);
    ribbon.rotation.set(0.2 + i * 0.05, -0.48 + i * 0.1, 0.24 + i * 0.16);
    ribbon.scale.setScalar(0.78 + i * 0.08);
    signal.add(ribbon);
  }

  for (let i = 0; i < 5; i += 1) {
    const orbit = makeTorus(1.55 + i * 0.36, 0.01, 0xffd56f, 0.24);
    orbit.rotation.set(0.68 + i * 0.24, 0.3 + i * 0.18, i * 0.52);
    signal.add(orbit);
  }

  const knot = new THREE.Mesh(
    new THREE.TorusKnotGeometry(1.5, 0.026, 220, 12, 3, 5),
    new THREE.MeshBasicMaterial({
      color: 0xffe29b,
      transparent: true,
      opacity: 0.46,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
  );
  knot.userData.spin = 0.0025;
  signal.add(knot);

  // X: living observation world formed from signal, latent structure, and noise.
  crystal.add(makeCosmicCrystalWorld(2.45));

  // u = BᵀX: the compact intelligence nucleus inside X.
  const singularity = makeCore(0xe7fbff, 1.18);
  singularity.add(new THREE.PointLight(0xdff8ff, 7.5, 18));
  core.add(singularity);

  for (let i = 0; i < 7; i += 1) {
    const points = [];
    const phase = i * 0.8;
    for (let j = 0; j < 96; j += 1) {
      const t = j / 95;
      const radius = THREE.MathUtils.lerp(5.8 + (i % 3) * 0.45, 0.58, t);
      const a = phase + t * Math.PI * (2.2 + i * 0.16);
      points.push(new THREE.Vector3(
        Math.cos(a) * radius,
        Math.sin(t * Math.PI * 1.35 + phase) * (1.4 * (1 - t)),
        Math.sin(a) * radius * 0.78,
      ));
    }
    core.add(makeTube(points, i % 3 === 0 ? 0xffffff : 0x9feaff, 0.011, i % 3 === 0 ? 0.48 : 0.34));
  }

  group.add(noise, latent, signal, crystal, core);
  group.userData.cosmicParts = { noise, latent, signal, crystal, core };
  return group;
}

function makeHiddenStructurePage() {
  const group = new THREE.Group();
  const chaos = new THREE.Group();
  const subtleCurrents = new THREE.Group();
  const alignedParticles = new THREE.Group();
  const largeStructures = new THREE.Group();
  const latentOcean = new THREE.Group();

  // Page 2 is only Γ₀Φ(u): hidden latent organization before X and before u = BᵀX.
  chaos.add(makePoints({ count: 2600, radius: 13.5, color: 0xeaf6ff, size: 0.012, opacity: 0.32, stretch: [1.22, 0.9, 1.16] }));
  chaos.add(makePoints({ count: 1700, radius: 18, color: 0x6f83a4, size: 0.014, opacity: 0.2, stretch: [1.3, 1, 1.2] }));

  for (let i = 0; i < 14; i += 1) {
    subtleCurrents.add(makeLatentCurrent(i * 0.58, 3.6 + (i % 6) * 0.45, i % 4 === 0 ? 0x132d63 : 0x4abfff, i % 4 === 0 ? 0.3 : 0.36, 0.009));
  }

  alignedParticles.add(makeLatentFlowParticles({
    count: 4200,
    radius: 8.8,
    color: 0x62d6ff,
    size: 0.026,
    opacity: 0.48,
    coherence: 0.82,
  }));
  alignedParticles.add(makeLatentFlowParticles({
    count: 2300,
    radius: 6.4,
    color: 0xa0f0ff,
    size: 0.017,
    opacity: 0.34,
    coherence: 0.93,
  }));

  for (let i = 0; i < 9; i += 1) {
    const vortex = makeTorus(2.7 + i * 0.42, 0.012, i % 3 === 0 ? 0x10285a : 0x55cfff, i % 3 === 0 ? 0.32 : 0.25);
    vortex.rotation.set(0.82 + i * 0.13, -0.4 + i * 0.035, i * 0.42);
    largeStructures.add(vortex);
  }

  for (let i = 0; i < 18; i += 1) {
    largeStructures.add(makeLatentCurrent(i * 0.37 + 0.9, 5.6 + (i % 4) * 0.6, i % 5 === 0 ? 0x0b1f4b : 0x2faeff, i % 5 === 0 ? 0.42 : 0.46, 0.014));
  }

  latentOcean.add(makePoints({
    count: 8800,
    radius: 15.5,
    color: 0x248fff,
    size: 0.035,
    opacity: 0.58,
    mode: 'vortex',
    stretch: [1.5, 0.72, 1.26],
  }));
  latentOcean.add(makePoints({
    count: 4600,
    radius: 10.4,
    color: 0x7de6ff,
    size: 0.022,
    opacity: 0.38,
    mode: 'vortex',
    stretch: [1.24, 0.62, 1.02],
  }));

  group.add(chaos, subtleCurrents, alignedParticles, largeStructures, latentOcean);
  group.userData.hiddenParts = { chaos, subtleCurrents, alignedParticles, largeStructures, latentOcean };
  return group;
}

function makeCrystallizationPage() {
  const group = new THREE.Group();
  const latent = new THREE.Group();
  const clustering = new THREE.Group();
  const crystal = new THREE.Group();
  const signal = new THREE.Group();
  const completedWorld = new THREE.Group();
  const noise = new THREE.Group();

  // ε: persistent faint noise remains part of the observation equation.
  noise.add(makePoints({ count: 1900, radius: 13, color: 0xf4f8ff, size: 0.011, opacity: 0.26, stretch: [1.25, 0.95, 1.12] }));

  // Γ₀Φ(u): Page 2's blue latent ocean continues to shape reality.
  latent.add(makeLatentFlowParticles({
    count: 5200,
    radius: 9.6,
    color: 0x2f9cff,
    size: 0.03,
    opacity: 0.5,
    coherence: 0.9,
  }));
  latent.add(makeLatentFlowParticles({
    count: 2700,
    radius: 6.8,
    color: 0x7ee7ff,
    size: 0.02,
    opacity: 0.35,
    coherence: 0.96,
  }));
  for (let i = 0; i < 16; i += 1) {
    latent.add(makeLatentCurrent(i * 0.5, 4.6 + (i % 5) * 0.48, i % 5 === 0 ? 0x10275a : 0x48bdff, i % 5 === 0 ? 0.34 : 0.38, 0.011));
  }

  // Stage 2: matter begins to cluster before a world is visible.
  clustering.add(makeLatentFlowParticles({
    count: 2400,
    radius: 3.9,
    color: 0xc8fff0,
    size: 0.025,
    opacity: 0.42,
    coherence: 0.7,
  }));
  for (let i = 0; i < 24; i += 1) {
    const seed = new THREE.Mesh(
      new THREE.TetrahedronGeometry(0.06 + Math.random() * 0.12, 0),
      makeCrystalMaterial(0xd8fff5, 0.26),
    );
    seed.position.copy(randomUnitVector().multiplyScalar(1.2 + Math.random() * 2.0));
    seed.userData.spin = 0.004 + Math.random() * 0.004;
    seed.userData.baseScale = 0.5 + Math.random();
    clustering.add(seed);
  }

  // X: the observation world assembles as living crystalline matter.
  crystal.add(makeCrystallizingWorld(2.75));

  // Γf(Y): golden blueprint stabilizes reality through organized manifolds.
  for (let i = 0; i < 3; i += 1) {
    const ribbon = makeRibbonManifold(i * 1.6 + 0.4);
    ribbon.rotation.set(0.28 + i * 0.04, -0.44 + i * 0.1, 0.22 + i * 0.14);
    ribbon.scale.setScalar(0.58 + i * 0.07);
    signal.add(ribbon);
  }
  for (let i = 0; i < 8; i += 1) {
    const orbit = makeTorus(1.25 + i * 0.22, 0.008, 0xffd66f, 0.24);
    orbit.rotation.set(0.55 + i * 0.2, 0.28 + i * 0.15, i * 0.48);
    signal.add(orbit);
  }

  // Stage 6: visible reality as an emergent measured world, without SDR core.
  completedWorld.add(makePoints({ count: 900, radius: 2.95, color: 0xeafff8, size: 0.017, opacity: 0.28, mode: 'shell' }));
  completedWorld.add(makePoints({ count: 700, radius: 3.35, color: 0x8dffe1, size: 0.012, opacity: 0.2, mode: 'shell' }));

  group.add(noise, latent, clustering, crystal, signal, completedWorld);
  group.userData.crystalParts = { noise, latent, clustering, crystal, signal, completedWorld };
  return group;
}

function makeRepresentationPage() {
  const group = new THREE.Group();
  const observation = new THREE.Group();
  const interior = new THREE.Group();
  const particles = new THREE.Group();
  const trajectories = new THREE.Group();
  const streams = new THREE.Group();
  const core = new THREE.Group();

  // X remains visible from Page 3: a transparent observation world to enter.
  observation.add(makeCrystallizingWorld(2.85));
  observation.add(makePoints({ count: 900, radius: 3.05, color: 0xeafff8, size: 0.014, opacity: 0.2, mode: 'shell' }));

  // Transparent internal layers reveal that observation is not the final meaning.
  for (let i = 0; i < 5; i += 1) {
    const layer = makeTorus(0.86 + i * 0.34, 0.008, i % 2 === 0 ? 0x8beaff : 0xffffff, i % 2 === 0 ? 0.22 : 0.16);
    layer.rotation.set(0.72 + i * 0.28, 0.22 + i * 0.16, i * 0.55);
    interior.add(layer);
  }
  interior.add(makePoints({ count: 820, radius: 1.85, color: 0xbdf6ff, size: 0.014, opacity: 0.28, mode: 'shell' }));

  // Information collapse: high-dimensional particles surround X before compression.
  particles.add(makePoints({ count: 5400, radius: 7.6, color: 0xf3f8ff, size: 0.011, opacity: 0.28, stretch: [1.22, 0.92, 1.12] }));
  particles.add(makePoints({ count: 2300, radius: 5.2, color: 0x7fdcff, size: 0.016, opacity: 0.28, mode: 'vortex', stretch: [1.1, 0.7, 0.95] }));

  // Thousands of trajectories become hundreds of streams, then one coherent core.
  for (let i = 0; i < 38; i += 1) {
    const path = [];
    const phase = i * 0.48;
    for (let j = 0; j < 92; j += 1) {
      const t = j / 91;
      const radius = THREE.MathUtils.lerp(5.8 + (i % 5) * 0.22, 0.38, t);
      const angle = phase + t * Math.PI * (1.6 + (i % 4) * 0.18);
      path.push(new THREE.Vector3(
        Math.cos(angle) * radius,
        Math.sin(t * Math.PI * 1.6 + phase) * (1.4 * (1 - t)),
        Math.sin(angle) * radius * 0.72,
      ));
    }
    trajectories.add(makeTube(path, i % 6 === 0 ? 0xffffff : 0x9eeaff, 0.007 + (i % 3) * 0.002, i % 6 === 0 ? 0.46 : 0.28));
  }

  for (let i = 0; i < 12; i += 1) {
    const path = [];
    const phase = i * 0.82;
    for (let j = 0; j < 86; j += 1) {
      const t = j / 85;
      const radius = THREE.MathUtils.lerp(3.6 + (i % 4) * 0.18, 0.24, t);
      const angle = phase + t * Math.PI * 2.4;
      path.push(new THREE.Vector3(
        Math.cos(angle) * radius,
        Math.sin(t * Math.PI * 1.2 + phase) * (0.8 * (1 - t)),
        Math.sin(angle) * radius * 0.7,
      ));
    }
    streams.add(makeTube(path, i % 3 === 0 ? 0xffffff : 0x63d7ff, 0.013, 0.48));
  }

  // u = BᵀX: a compact white-blue information singularity.
  const nucleus = makeCore(0xf1fcff, 1.08);
  nucleus.add(new THREE.PointLight(0xe7fbff, 8.5, 20));
  core.add(nucleus);
  for (let i = 0; i < 5; i += 1) {
    const ring = makeTorus(0.38 + i * 0.16, 0.008, i % 2 === 0 ? 0xffffff : 0x73d7ff, 0.72);
    ring.rotation.set(0.4 + i * 0.44, 0.22 + i * 0.17, i * 0.72);
    core.add(ring);
  }

  group.add(observation, interior, particles, trajectories, streams, core);
  group.userData.representationParts = { observation, interior, particles, trajectories, streams, core };
  return group;
}

function makeLatentDynamicsPage() {
  const group = new THREE.Group();
  const latentSpace = new THREE.Group();
  const currentState = new THREE.Group();
  const trajectory = new THREE.Group();
  const memories = new THREE.Group();
  const branches = new THREE.Group();

  // Hidden latent universe: a quiet field in which representation evolves.
  latentSpace.add(makeLatentFlowParticles({
    count: 3600,
    radius: 9.4,
    color: 0x2f9cff,
    size: 0.022,
    opacity: 0.3,
    coherence: 0.88,
  }));
  latentSpace.add(makePoints({ count: 1300, radius: 10.8, color: 0xf4f8ff, size: 0.01, opacity: 0.2, stretch: [1.18, 0.86, 1.05] }));

  const statePath = [];
  for (let i = 0; i < 13; i += 1) {
    const t = i / 12;
    const angle = t * Math.PI * 3.2;
    const radius = 4.3 - t * 1.2 + Math.sin(i * 1.3) * 0.26;
    statePath.push(new THREE.Vector3(
      Math.cos(angle) * radius,
      Math.sin(t * Math.PI * 2.2) * 1.5 + Math.sin(i) * 0.12,
      Math.sin(angle) * radius * 0.72,
    ));
  }

  // u₁ → u₂ → ...: smooth latent geodesic / memory trace.
  const mainPath = makeTube(statePath, 0x9cecff, 0.018, 0.62);
  trajectory.add(mainPath);

  for (let i = 0; i < statePath.length; i += 1) {
    const memory = new THREE.Group();
    const marker = new THREE.Mesh(
      new THREE.SphereGeometry(0.055 + i * 0.002, 16, 16),
      new THREE.MeshBasicMaterial({
        color: i % 3 === 0 ? 0xffffff : 0x8ce8ff,
        transparent: true,
        opacity: 0.72 - i * 0.025,
        blending: THREE.AdditiveBlending,
      }),
    );
    marker.position.copy(statePath[i]);
    memory.add(marker);

    const halo = makeTorus(0.12 + i * 0.01, 0.004, i % 3 === 0 ? 0xffffff : 0x73d7ff, 0.28);
    halo.position.copy(statePath[i]);
    halo.rotation.set(i * 0.4, i * 0.23, i * 0.31);
    memory.add(halo);
    memories.add(memory);
  }

  // Branching possibilities: nearby possible futures, not yet chosen.
  for (let i = 2; i < statePath.length - 2; i += 3) {
    for (let b = 0; b < 2; b += 1) {
      const branch = [];
      const start = statePath[i].clone();
      const direction = randomUnitVector().multiply(new THREE.Vector3(1.3, 0.7, 1.1));
      for (let j = 0; j < 42; j += 1) {
        const t = j / 41;
        branch.push(start.clone()
          .lerp(start.clone().add(direction.clone().multiplyScalar(1.2 + b * 0.45)), t)
          .add(new THREE.Vector3(0, Math.sin(t * Math.PI) * 0.4, 0)));
      }
      branches.add(makeTube(branch, 0x4fc1ff, 0.006, 0.22));
    }
  }

  const movingCore = makeCore(0xf0fcff, 0.86);
  movingCore.add(new THREE.PointLight(0xe8fbff, 6.5, 16));
  currentState.add(movingCore);

  group.add(latentSpace, trajectory, memories, branches, currentState);
  group.userData.dynamicsParts = {
    latentSpace,
    trajectory,
    memories,
    branches,
    currentState,
    statePath,
  };
  return group;
}

function makeCosmicPlanningPage() {
  const group = new THREE.Group();
  const possibilityField = new THREE.Group();
  const branches = new THREE.Group();
  const goals = new THREE.Group();
  const actions = new THREE.Group();
  const selectedPath = new THREE.Group();
  const currentState = new THREE.Group();

  // Latent landscape of possible futures.
  possibilityField.add(makeLatentFlowParticles({
    count: 4200,
    radius: 10.8,
    color: 0x2d94ff,
    size: 0.024,
    opacity: 0.34,
    coherence: 0.82,
  }));
  possibilityField.add(makePoints({ count: 1500, radius: 12.2, color: 0xf6fbff, size: 0.01, opacity: 0.22, stretch: [1.18, 0.86, 1.1] }));

  const origin = new THREE.Vector3(-3.4, -0.2, 0);
  const futures = [
    new THREE.Vector3(3.2, 2.0, -2.4),
    new THREE.Vector3(4.0, 0.7, -0.2),
    new THREE.Vector3(3.4, -1.1, 2.2),
    new THREE.Vector3(2.2, 2.8, 1.6),
    new THREE.Vector3(4.8, -2.2, -1.4),
  ];
  const selectedIndex = 1;

  futures.forEach((future, index) => {
    const control = new THREE.Vector3(
      (origin.x + future.x) * 0.45,
      Math.sin(index * 1.3) * 1.4,
      (origin.z + future.z) * 0.45,
    );
    const path = [];
    for (let i = 0; i < 86; i += 1) {
      const t = i / 85;
      const a = origin.clone().lerp(control, t);
      const b = control.clone().lerp(future, t);
      path.push(a.lerp(b, t));
    }
    branches.add(makeTube(path, index === selectedIndex ? 0xffd66f : 0x58c8ff, index === selectedIndex ? 0.018 : 0.009, index === selectedIndex ? 0.66 : 0.28));
  });

  // Destination stars / attractor goals.
  futures.forEach((future, index) => {
    const goal = new THREE.Group();
    const star = new THREE.Mesh(
      new THREE.IcosahedronGeometry(index === selectedIndex ? 0.18 : 0.12, 2),
      new THREE.MeshBasicMaterial({
        color: index === selectedIndex ? 0xfff2b2 : 0x9feaff,
        transparent: true,
        opacity: index === selectedIndex ? 0.95 : 0.6,
        blending: THREE.AdditiveBlending,
      }),
    );
    star.position.copy(future);
    goal.add(star);
    const halo = makeTorus(index === selectedIndex ? 0.42 : 0.28, 0.006, index === selectedIndex ? 0xffd66f : 0x73d7ff, index === selectedIndex ? 0.56 : 0.28);
    halo.position.copy(future);
    halo.rotation.set(index * 0.4, index * 0.22, index * 0.31);
    goal.add(halo);
    goals.add(goal);
  });

  // Actions as course corrections / steering forces along the selected trajectory.
  const selectedFuture = futures[selectedIndex];
  for (let i = 0; i < 5; i += 1) {
    const t = 0.18 + i * 0.15;
    const position = origin.clone().lerp(selectedFuture, t);
    const steering = makeTorus(0.18 + i * 0.025, 0.004, 0xffffff, 0.42);
    steering.position.copy(position);
    steering.rotation.set(0.55 + i * 0.26, 0.2 + i * 0.18, i * 0.62);
    actions.add(steering);
  }

  const optimal = [];
  for (let i = 0; i < 120; i += 1) {
    const t = i / 119;
    const bend = new THREE.Vector3(-0.2, Math.sin(t * Math.PI) * 0.95, Math.cos(t * Math.PI * 1.2) * 0.4);
    optimal.push(origin.clone().lerp(selectedFuture, t).add(bend));
  }
  selectedPath.add(makeTube(optimal, 0xffdf8c, 0.026, 0.76));
  selectedPath.add(makeTube(optimal, 0xffffff, 0.008, 0.54));

  const stateCore = makeCore(0xf1fcff, 0.78);
  stateCore.position.copy(origin);
  currentState.add(stateCore);

  group.add(possibilityField, branches, goals, actions, selectedPath, currentState);
  group.userData.planningParts = {
    possibilityField,
    branches,
    goals,
    actions,
    selectedPath,
    currentState,
    origin,
    selectedFuture,
    optimal,
  };
  return group;
}

function makeChaosToIntelligencePage() {
  const group = new THREE.Group();
  const noise = new THREE.Group();
  const latent = new THREE.Group();
  const observation = new THREE.Group();
  const representation = new THREE.Group();
  const dynamics = new THREE.Group();
  const planning = new THREE.Group();
  const connectors = new THREE.Group();

  // Layer 1: ε remains everywhere as faint possibility.
  noise.add(makePoints({ count: 4600, radius: 24, color: 0xf3f8ff, size: 0.011, opacity: 0.26, stretch: [1.25, 1, 1.18] }));
  noise.add(makePoints({ count: 2200, radius: 36, color: 0x7081a1, size: 0.016, opacity: 0.18, stretch: [1.4, 1.1, 1.28] }));

  // Layer 2: Γ₀Φ(u), the hidden substrate.
  latent.add(makeLatentFlowParticles({
    count: 7600,
    radius: 13.5,
    color: 0x2d9cff,
    size: 0.03,
    opacity: 0.52,
    coherence: 0.9,
  }));
  latent.add(makeLatentFlowParticles({
    count: 3600,
    radius: 8.6,
    color: 0x7ee8ff,
    size: 0.02,
    opacity: 0.34,
    coherence: 0.96,
  }));
  for (let i = 0; i < 18; i += 1) {
    latent.add(makeLatentCurrent(i * 0.46, 5.2 + (i % 5) * 0.5, i % 5 === 0 ? 0x10275a : 0x4cc4ff, i % 5 === 0 ? 0.34 : 0.4, 0.011));
  }

  // Layer 3: X, a crystal observation world surrounding representation.
  const world = makeCrystallizingWorld(2.72);
  observation.add(world);
  observation.add(makePoints({ count: 900, radius: 3.15, color: 0xeafff8, size: 0.014, opacity: 0.22, mode: 'shell' }));

  // Layer 4: u = BᵀX, small but meaning-giving.
  const core = makeCore(0xf4fdff, 1.08);
  core.add(new THREE.PointLight(0xeafaff, 9.5, 22));
  representation.add(core);

  // Layer 5: dynamics / historical memory.
  const memoryPath = [];
  for (let i = 0; i < 13; i += 1) {
    const t = i / 12;
    const angle = t * Math.PI * 3.15;
    const radius = 4.8 - t * 1.7;
    memoryPath.push(new THREE.Vector3(
      Math.cos(angle) * radius,
      Math.sin(t * Math.PI * 2.1) * 1.4,
      Math.sin(angle) * radius * 0.74,
    ));
  }
  dynamics.add(makeTube(memoryPath, 0x9cecff, 0.014, 0.48));
  memoryPath.forEach((point, index) => {
    const marker = new THREE.Mesh(
      new THREE.SphereGeometry(0.05 + index * 0.003, 14, 14),
      new THREE.MeshBasicMaterial({
        color: index % 3 === 0 ? 0xffffff : 0x8ee8ff,
        transparent: true,
        opacity: 0.5,
        blending: THREE.AdditiveBlending,
      }),
    );
    marker.position.copy(point);
    dynamics.add(marker);
  });

  // Layer 6: planning / possible futures and selected purpose.
  const goalPoints = [
    new THREE.Vector3(5.4, 1.9, -2.8),
    new THREE.Vector3(6.2, 0.6, 0.4),
    new THREE.Vector3(4.8, -1.8, 2.7),
    new THREE.Vector3(3.7, 2.8, 2.0),
  ];
  goalPoints.forEach((goal, index) => {
    const star = new THREE.Mesh(
      new THREE.IcosahedronGeometry(index === 1 ? 0.17 : 0.11, 2),
      new THREE.MeshBasicMaterial({
        color: index === 1 ? 0xfff0a8 : 0x9eeaff,
        transparent: true,
        opacity: index === 1 ? 0.92 : 0.58,
        blending: THREE.AdditiveBlending,
      }),
    );
    star.position.copy(goal);
    planning.add(star);
    const branch = [];
    for (let i = 0; i < 88; i += 1) {
      const t = i / 87;
      const bend = new THREE.Vector3(0, Math.sin(t * Math.PI) * (index === 1 ? 0.9 : 0.45), Math.cos(t * Math.PI + index) * 0.28);
      branch.push(new THREE.Vector3(0, 0, 0).lerp(goal, t).add(bend));
    }
    planning.add(makeTube(branch, index === 1 ? 0xffd66f : 0x56c8ff, index === 1 ? 0.018 : 0.008, index === 1 ? 0.58 : 0.22));
  });

  // Unification: quiet connective arcs from every layer toward representation.
  const layerAnchors = [
    new THREE.Vector3(-6.2, 0.8, -2.5),
    new THREE.Vector3(-4.8, -1.5, 3.1),
    new THREE.Vector3(0, 2.4, 0),
    new THREE.Vector3(3.6, -1.5, -2.2),
    new THREE.Vector3(5.2, 1.6, 1.8),
  ];
  layerAnchors.forEach((anchor, index) => {
    connectors.add(makeTube([
      anchor,
      anchor.clone().multiplyScalar(0.55).add(new THREE.Vector3(0, Math.sin(index) * 0.7, 0)),
      new THREE.Vector3(0, 0, 0),
    ], index === 2 ? 0xffffff : 0x8ee8ff, index === 2 ? 0.014 : 0.008, index === 2 ? 0.36 : 0.22));
  });

  group.add(noise, latent, observation, representation, dynamics, planning, connectors);
  group.userData.finalParts = { noise, latent, observation, representation, dynamics, planning, connectors };
  return group;
}

function makeFutureWorld(index, position, scale, dominant = false) {
  const group = new THREE.Group();
  group.position.copy(position);
  group.scale.setScalar(scale);

  // Future observation X': a small simulated world generated by the SDR core.
  const shell = new THREE.Mesh(
    new THREE.IcosahedronGeometry(0.62, 3),
    makeCrystalMaterial(dominant ? 0xeaffff : 0xa9e8ff, dominant ? 0.32 : 0.2, dominant ? 0x69dfff : 0x1c6c92),
  );
  shell.scale.set(1.06 + index * 0.015, 0.9 + (index % 3) * 0.04, 1.0);
  group.add(shell);

  const inner = new THREE.Mesh(
    new THREE.DodecahedronGeometry(0.38, 1),
    new THREE.MeshBasicMaterial({
      color: dominant ? 0xfff0a8 : 0x82ddff,
      transparent: true,
      opacity: dominant ? 0.28 : 0.18,
      wireframe: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
  );
  inner.userData.spin = 0.004 + index * 0.0004;
  group.add(inner);

  group.add(makePoints({
    count: dominant ? 420 : 260,
    radius: dominant ? 0.98 : 0.82,
    color: dominant ? 0xffe8a8 : 0x7edcff,
    size: dominant ? 0.018 : 0.014,
    opacity: dominant ? 0.48 : 0.28,
    mode: 'shell',
  }));

  for (let i = 0; i < 3; i += 1) {
    const orbit = makeTorus(0.72 + i * 0.16, 0.004, dominant && i === 1 ? 0xffd66f : 0x8ce8ff, dominant ? 0.36 : 0.22);
    orbit.rotation.set(0.45 + i * 0.34, index * 0.22, i * 0.72 + index);
    group.add(orbit);
  }

  return group;
}

function makeWorldModelsPage() {
  const group = new THREE.Group();
  const latentField = new THREE.Group();
  const core = new THREE.Group();
  const seedWorlds = new THREE.Group();
  const worldTree = new THREE.Group();
  const futureWorlds = new THREE.Group();
  const timelines = new THREE.Group();
  const reconnect = new THREE.Group();
  const vanishingBranches = new THREE.Group();

  // World models begin with the same compact representation: u = BᵀX.
  const generator = makeCore(0xf4fdff, 1.02);
  generator.add(new THREE.PointLight(0xeafaff, 9.0, 24));
  core.add(generator);

  // The model imagines inside latent space, not outside it.
  latentField.add(makeLatentFlowParticles({
    count: 4700,
    radius: 12.5,
    color: 0x2f9cff,
    size: 0.024,
    opacity: 0.34,
    coherence: 0.86,
  }));
  latentField.add(makePoints({ count: 2200, radius: 18, color: 0xf3f8ff, size: 0.01, opacity: 0.18, stretch: [1.2, 0.96, 1.16] }));

  const futures = [
    new THREE.Vector3(3.6, 1.9, -2.4),
    new THREE.Vector3(4.8, -0.3, 0.3),
    new THREE.Vector3(3.2, -2.0, 2.6),
    new THREE.Vector3(-3.7, 1.3, 2.8),
    new THREE.Vector3(-4.9, -1.1, -0.2),
    new THREE.Vector3(-2.1, 2.9, -3.1),
    new THREE.Vector3(1.0, -2.8, -3.6),
  ];
  const dominantIndex = 1;

  // Early predictions: small future observations form before they are real.
  futures.slice(0, 5).forEach((future, index) => {
    const seed = makeFutureWorld(index, future.clone().multiplyScalar(0.22), 0.24 + index * 0.025, index === dominantIndex);
    seedWorlds.add(seed);
  });

  futures.forEach((future, index) => {
    const dominant = index === dominantIndex;
    const world = makeFutureWorld(index, future, dominant ? 0.82 : 0.56, dominant);
    world.userData.basePosition = future.clone();
    world.userData.dreamPhase = index * 0.84;
    futureWorlds.add(world);

    // World tree: one compact state branches into many predicted observations.
    const branch = [];
    for (let i = 0; i < 96; i += 1) {
      const t = i / 95;
      const bend = new THREE.Vector3(
        Math.sin(t * Math.PI + index) * (dominant ? 0.28 : 0.48),
        Math.sin(t * Math.PI) * (dominant ? 1.0 : 0.66),
        Math.cos(t * Math.PI * 1.3 + index) * 0.38,
      );
      branch.push(new THREE.Vector3(0, 0, 0).lerp(future, t).add(bend));
    }
    worldTree.add(makeTube(branch, dominant ? 0xffd66f : 0x62d4ff, dominant ? 0.02 : 0.009, dominant ? 0.68 : 0.28));

    // Some alternatives fade: possible worlds that the model considers, then discards.
    if (!dominant && index % 2 === 0) {
      const disappearing = branch.map((point) => point.clone().multiplyScalar(1.08));
      vanishingBranches.add(makeTube(disappearing, 0x365f9e, 0.006, 0.16));
    }
  });

  // Alternate timelines connect imagined worlds into a predictive manifold.
  for (let i = 0; i < futures.length; i += 1) {
    const a = futures[i];
    const b = futures[(i + 2) % futures.length];
    const path = [];
    for (let j = 0; j < 92; j += 1) {
      const t = j / 91;
      const middle = a.clone().lerp(b, t);
      path.push(middle.add(new THREE.Vector3(
        Math.sin(t * Math.PI * 2 + i) * 0.35,
        Math.sin(t * Math.PI) * (0.78 + i * 0.02),
        Math.cos(t * Math.PI + i) * 0.26,
      )));
    }
    timelines.add(makeTube(path, i === dominantIndex ? 0xffe49c : 0x6bd7ff, i === dominantIndex ? 0.012 : 0.006, i === dominantIndex ? 0.34 : 0.18));
  }

  // Final synthesis: all imagined worlds remain anchored to the compact representation.
  futures.forEach((future, index) => {
    const path = [];
    for (let i = 0; i < 72; i += 1) {
      const t = i / 71;
      const point = future.clone().lerp(new THREE.Vector3(0, 0, 0), t);
      point.y += Math.sin(t * Math.PI) * (0.5 + index * 0.04);
      path.push(point);
    }
    reconnect.add(makeTube(path, index === dominantIndex ? 0xffffff : 0x9eeaff, index === dominantIndex ? 0.012 : 0.006, index === dominantIndex ? 0.42 : 0.22));
  });

  group.add(latentField, core, seedWorlds, worldTree, futureWorlds, timelines, vanishingBranches, reconnect);
  group.userData.worldModelParts = {
    latentField,
    core,
    seedWorlds,
    worldTree,
    futureWorlds,
    timelines,
    vanishingBranches,
    reconnect,
  };
  return group;
}

const pageDefinitions = [
  {
    name: 'Cosmic Universe',
    title: 'Drift Through Noise',
    copy: 'Before structure appears, ε fills the universe as stochastic dust and quantum fluctuation.',
    camera: [9, 3.8, 12],
    target: [0, 0, 0],
    color: 0x02040a,
    builder: makeCosmicPage,
  },
  {
    name: 'Hidden Structure',
    title: 'Hidden Structure',
    copy: 'Order exists before observation.',
    camera: [12.5, -2.1, 17],
    target: [0, 0, 0],
    color: 0x020713,
    builder: makeHiddenStructurePage,
  },
  {
    name: 'Crystallization of Reality',
    title: 'Crystallization of Reality',
    copy: 'Observation emerges from structure.',
    camera: [10.2, 3.6, 12.8],
    target: [0, 0, 0],
    color: 0x020712,
    builder: makeCrystallizationPage,
  },
  {
    name: 'Representation',
    title: 'Representation',
    copy: 'The hidden state beneath observation.',
    camera: [8.8, 4.6, 10.8],
    target: [0, 0, 0],
    color: 0x02050d,
    builder: makeRepresentationPage,
  },
  {
    name: 'Latent Dynamics',
    title: 'Latent Dynamics',
    copy: 'How representation evolves through time.',
    camera: [6.2, 2.6, 7.8],
    target: [0, 0, 0],
    color: 0x020713,
    builder: makeLatentDynamicsPage,
  },
  {
    name: 'Cosmic Planning',
    title: 'Cosmic Planning',
    copy: 'Choosing a future in latent space.',
    camera: [9.8, 4.2, 11.8],
    target: [0, 0, 0],
    color: 0x020713,
    builder: makeCosmicPlanningPage,
  },
  {
    name: 'From Chaos to Intelligence',
    title: 'From Chaos to Intelligence',
    copy: 'The geometry of meaning.',
    camera: [0.42, 0.34, 1.28],
    target: [0, 0, 0],
    color: 0x03050b,
    builder: makeChaosToIntelligencePage,
  },
  {
    name: 'World Models',
    title: 'World Models',
    copy: 'The universe imagines itself.',
    camera: [0.36, 0.32, 1.2],
    target: [0, 0, 0],
    color: 0x03050b,
    builder: makeWorldModelsPage,
  },
];

const cosmicStages = [
  {
    title: 'Drift Through Noise',
    copy: 'Before structure appears, ε fills the universe as stochastic dust and quantum fluctuation.',
    camera: [13, -2.7, 18],
    target: [1.4, 0.2, 0],
    duration: 7,
  },
  {
    title: 'Latent Nebula Structures',
    copy: 'The transformed latent term Γ₀Φ(u) becomes a vast blue ocean of gravitational currents.',
    camera: [8.6, 2.8, 11.2],
    target: [0, 0.2, 0],
    duration: 8,
  },
  {
    title: 'Signal Manifolds Emerge',
    copy: 'Γf(Y) appears as golden low-dimensional geometry organizing itself inside the latent universe.',
    camera: [6.4, 3.4, 8.1],
    target: [0, 0.1, 0],
    duration: 8,
  },
  {
    title: 'Observation Crystallizes',
    copy: 'X forms as a living crystal world shaped by signal, latent structure, and irreducible noise.',
    camera: [4.6, 2.4, 5.8],
    target: [0, 0, 0],
    duration: 7,
  },
  {
    title: 'Inside the Observation',
    copy: 'The camera crosses the transparent shell into the high-dimensional observation itself.',
    camera: [1.25, 0.62, 2.1],
    target: [0, 0, 0],
    duration: 6,
  },
  {
    title: 'SDR Core',
    copy: 'At the center, u = BᵀX becomes a compact intelligence nucleus: representation extracted from observation.',
    camera: [0.15, 0.46, 1.42],
    target: [0, 0, 0],
    duration: 8,
  },
];
const cosmicTotalDuration = cosmicStages.reduce((sum, stage) => sum + stage.duration, 0);
let currentCosmicStage = -1;

const hiddenStages = [
  {
    title: 'Hidden Structure',
    copy: 'At first, the field appears random: noise-like particles without visible cause.',
    camera: [12.5, -2.1, 17],
    target: [0.8, 0.1, 0],
    duration: 7,
  },
  {
    title: 'Subtle Currents',
    copy: 'Faint blue flows reveal Γ₀Φ(u): invisible geometry begins to govern motion.',
    camera: [9.6, 2.4, 12.2],
    target: [0, 0.2, 0],
    duration: 7,
  },
  {
    title: 'Alignment',
    copy: 'Particles stop behaving independently; local interactions begin to follow shared fields.',
    camera: [7.4, 3.2, 9.2],
    target: [0, 0.1, 0],
    duration: 7,
  },
  {
    title: 'Large-Scale Order',
    copy: 'Dark matter rivers and giant vortices connect the local alignments into global structure.',
    camera: [9.2, 5.2, 10.8],
    target: [0, 0, 0],
    duration: 8,
  },
  {
    title: 'Latent Structure',
    copy: 'Γ₀Φ(u): the hidden geometry beneath observation.',
    camera: [11.5, 4.8, 14.5],
    target: [0, 0, 0],
    duration: 9,
  },
];
const hiddenTotalDuration = hiddenStages.reduce((sum, stage) => sum + stage.duration, 0);
let currentHiddenStage = -1;

const crystallizationStages = [
  {
    title: 'Crystallization of Reality',
    copy: 'Observation emerges from structure.',
    camera: [10.2, 3.6, 12.8],
    target: [0, 0, 0],
    duration: 7,
  },
  {
    title: 'Clustering',
    copy: 'Particles begin clustering as latent currents concentrate matter into visible density.',
    camera: [8.4, 3.2, 10.4],
    target: [0, 0, 0],
    duration: 7,
  },
  {
    title: 'Crystalline Geometry',
    copy: 'Translucent geometric matter begins to assemble: observation X is taking form.',
    camera: [6.2, 2.7, 7.6],
    target: [0, 0, 0],
    duration: 8,
  },
  {
    title: 'Signal Blueprint',
    copy: 'Γf(Y) appears as golden manifold architecture, stabilizing the emerging world.',
    camera: [5.8, 3.7, 7.1],
    target: [0, 0, 0],
    duration: 8,
  },
  {
    title: 'Assembly',
    copy: 'The interaction X = Γf(Y) + Γ₀Φ(u) + ε becomes visible as layered crystalline reality.',
    camera: [6.8, 4.5, 8.2],
    target: [0, 0, 0],
    duration: 8,
  },
  {
    title: 'Observation',
    copy: 'X = Γf(Y) + Γ₀Φ(u) + ε. Reality emerges from signal, structure, and noise.',
    camera: [8.8, 5.6, 10.4],
    target: [0, 0, 0],
    duration: 9,
  },
];
const crystallizationTotalDuration = crystallizationStages.reduce((sum, stage) => sum + stage.duration, 0);
let currentCrystallizationStage = -1;

const representationStages = [
  {
    title: 'Representation',
    copy: 'The hidden state beneath observation.',
    camera: [8.8, 4.6, 10.8],
    target: [0, 0, 0],
    duration: 7,
  },
  {
    title: 'Approaching X',
    copy: 'The observation world is vast, translucent, and compelling, but it is not yet understanding.',
    camera: [5.2, 2.8, 6.1],
    target: [0, 0, 0],
    duration: 7,
  },
  {
    title: 'Through Transparent Layers',
    copy: 'The camera passes through X, revealing internal structure beneath the surface of observation.',
    camera: [2.0, 0.9, 2.7],
    target: [0, 0, 0],
    duration: 7,
  },
  {
    title: 'Information Flow',
    copy: 'Millions of particles become trajectories; trajectories become streams.',
    camera: [1.25, 0.62, 2.05],
    target: [0, 0, 0],
    duration: 8,
  },
  {
    title: 'SDR Core',
    copy: 'At the center of X, a compact hidden state appears: u = BᵀX.',
    camera: [0.34, 0.32, 1.34],
    target: [0, 0, 0],
    duration: 8,
  },
  {
    title: 'u = BᵀX',
    copy: 'A sufficient representation of reality. The universe is vast. Meaning is compact.',
    camera: [0.0, 0.5, 1.08],
    target: [0, 0, 0],
    duration: 9,
  },
];
const representationTotalDuration = representationStages.reduce((sum, stage) => sum + stage.duration, 0);
let currentRepresentationStage = -1;

const dynamicsStages = [
  {
    title: 'Latent Dynamics',
    copy: 'How representation evolves through time.',
    camera: [6.2, 2.6, 7.8],
    target: [0, 0, 0],
    duration: 7,
  },
  {
    title: 'The Core Moves',
    copy: 'The sufficient state is not stationary. uₜ begins to drift through hidden space.',
    camera: [5.2, 2.2, 6.4],
    target: [0.2, 0, 0],
    duration: 7,
  },
  {
    title: 'Trajectory',
    copy: 'u₁ → u₂ → u₃ → u₄ appears as a smooth latent geodesic.',
    camera: [6.8, 4.0, 8.2],
    target: [0, 0, 0],
    duration: 8,
  },
  {
    title: 'Memory Constellations',
    copy: 'Past states remain as glowing footprints; representation remembers its path.',
    camera: [8.2, 5.1, 9.6],
    target: [0, 0, 0],
    duration: 8,
  },
  {
    title: 'uₜ → uₜ₊₁',
    copy: 'Representation is not a point. Representation is a trajectory.',
    camera: [9.2, 5.2, 11.2],
    target: [0, 0, 0],
    duration: 9,
  },
];
const dynamicsTotalDuration = dynamicsStages.reduce((sum, stage) => sum + stage.duration, 0);
let currentDynamicsStage = -1;

const planningStages = [
  {
    title: 'Cosmic Planning',
    copy: 'Choosing a future in latent space.',
    camera: [9.8, 4.2, 11.8],
    target: [0.3, 0, 0],
    duration: 7,
  },
  {
    title: 'Branching Futures',
    copy: 'The current state uₜ sees many possible uₜ₊₁ futures.',
    camera: [8.4, 4.8, 9.8],
    target: [0.5, 0, 0],
    duration: 7,
  },
  {
    title: 'Goal States',
    copy: 'Bright destination stars exert influence across the latent landscape.',
    camera: [7.6, 3.8, 8.6],
    target: [1.4, 0.2, -0.2],
    duration: 7,
  },
  {
    title: 'Course Correction',
    copy: 'Actions steer the representation: state plus goal plus action points toward a future.',
    camera: [6.2, 2.7, 7.2],
    target: [0.8, 0.1, 0],
    duration: 8,
  },
  {
    title: 'Planning',
    copy: 'State + Goal + Action → Future. Representation becomes decision.',
    camera: [8.8, 5.0, 10.8],
    target: [0.9, 0.2, -0.1],
    duration: 9,
  },
];
const planningTotalDuration = planningStages.reduce((sum, stage) => sum + stage.duration, 0);
let currentPlanningStage = -1;

const finalStages = [
  {
    title: 'From Chaos to Intelligence',
    copy: 'The geometry of meaning.',
    camera: [0.42, 0.34, 1.28],
    target: [0, 0, 0],
    duration: 7,
  },
  {
    title: 'Dynamics',
    copy: 'Historical trajectories reveal memory: representation carries its path through time.',
    camera: [3.8, 1.6, 4.8],
    target: [0, 0, 0],
    duration: 7,
  },
  {
    title: 'Planning',
    copy: 'Goal stars and chosen futures reveal purpose: representation becomes decision.',
    camera: [6.2, 2.8, 7.4],
    target: [0.4, 0, 0],
    duration: 7,
  },
  {
    title: 'Observation',
    copy: 'The crystal world X surrounds the core: reality is visible, but meaning is compact.',
    camera: [7.2, 3.8, 8.6],
    target: [0, 0, 0],
    duration: 7,
  },
  {
    title: 'Structure',
    copy: 'Blue latent currents and dark rivers reveal the hidden substrate organizing everything.',
    camera: [10.2, 4.8, 12.4],
    target: [0, 0, 0],
    duration: 8,
  },
  {
    title: 'Intelligence',
    copy: 'Noise → Structure → Observation → Representation → Dynamics → Planning → Intelligence. Intelligence emerges from representation.',
    camera: [15.0, 7.2, 18.0],
    target: [0, 0, 0],
    duration: 10,
  },
];
const finalTotalDuration = finalStages.reduce((sum, stage) => sum + stage.duration, 0);
let currentFinalStage = -1;

const worldModelStages = [
  {
    title: 'World Models',
    copy: 'The universe imagines itself.',
    camera: [0.36, 0.32, 1.2],
    target: [0, 0, 0],
    duration: 7,
  },
  {
    title: 'Future Observations',
    copy: 'Small possible worlds form around the SDR core before they exist as observation.',
    camera: [3.0, 1.3, 3.8],
    target: [0, 0, 0],
    duration: 7,
  },
  {
    title: 'Branching Realities',
    copy: 'One representation generates many simulated futures: alternate timelines and future X.',
    camera: [6.2, 2.7, 7.2],
    target: [0.6, 0.1, 0],
    duration: 8,
  },
  {
    title: 'Multiple Futures Coexist',
    copy: 'Some branches fade. Some become dominant. Prediction is structured imagination.',
    camera: [8.8, 4.2, 9.6],
    target: [0, 0, 0],
    duration: 8,
  },
  {
    title: 'Through Alternative Realities',
    copy: 'The camera moves through possible worlds, each a future observation generated from latent state.',
    camera: [3.7, -0.5, -4.2],
    target: [2.8, -0.6, 1.2],
    duration: 8,
  },
  {
    title: 'Intelligence Becomes Imagination',
    copy: 'Observation → Representation → Dynamics → Planning → World Model. The most powerful models create possible worlds.',
    camera: [11.8, 5.4, 13.6],
    target: [0, 0, 0],
    duration: 10,
  },
];
const worldModelTotalDuration = worldModelStages.reduce((sum, stage) => sum + stage.duration, 0);
let currentWorldModelStage = -1;

const pages = pageDefinitions.map((definition, index) => {
  const group = definition.builder();
  group.userData.opacity = index === 0 ? 1 : 0;
  group.userData.targetOpacity = index === 0 ? 1 : 0;
  group.userData.definition = definition;
  rememberOpacity(group);
  setGroupOpacity(group, group.userData.opacity);
  pagesRoot.add(group);
  return { ...definition, group };
});

let activePage = 0;
let autoplay = false;
let lastSwitchTime = 0;
const cameraTarget = new THREE.Vector3(...pages[0].target);
const desiredCamera = new THREE.Vector3(...pages[0].camera);
const desiredTarget = new THREE.Vector3(...pages[0].target);
const currentLookAt = new THREE.Vector3(...pages[0].target);
const currentBg = new THREE.Color(pages[0].color);
const targetBg = new THREE.Color(pages[0].color);

function getCosmicStageState(time) {
  const t = time % cosmicTotalDuration;
  let cursor = 0;

  for (let i = 0; i < cosmicStages.length; i += 1) {
    const next = cursor + cosmicStages[i].duration;
    if (t <= next) {
      return {
        index: i,
        local: (t - cursor) / cosmicStages[i].duration,
        global: t / cosmicTotalDuration,
      };
    }
    cursor = next;
  }

  return { index: cosmicStages.length - 1, local: 1, global: 1 };
}

function getHiddenStageState(time) {
  const t = time % hiddenTotalDuration;
  let cursor = 0;

  for (let i = 0; i < hiddenStages.length; i += 1) {
    const next = cursor + hiddenStages[i].duration;
    if (t <= next) {
      return {
        index: i,
        local: (t - cursor) / hiddenStages[i].duration,
        global: t / hiddenTotalDuration,
      };
    }
    cursor = next;
  }

  return { index: hiddenStages.length - 1, local: 1, global: 1 };
}

function getCrystallizationStageState(time) {
  const t = time % crystallizationTotalDuration;
  let cursor = 0;

  for (let i = 0; i < crystallizationStages.length; i += 1) {
    const next = cursor + crystallizationStages[i].duration;
    if (t <= next) {
      return {
        index: i,
        local: (t - cursor) / crystallizationStages[i].duration,
        global: t / crystallizationTotalDuration,
      };
    }
    cursor = next;
  }

  return { index: crystallizationStages.length - 1, local: 1, global: 1 };
}

function getRepresentationStageState(time) {
  const t = time % representationTotalDuration;
  let cursor = 0;

  for (let i = 0; i < representationStages.length; i += 1) {
    const next = cursor + representationStages[i].duration;
    if (t <= next) {
      return {
        index: i,
        local: (t - cursor) / representationStages[i].duration,
        global: t / representationTotalDuration,
      };
    }
    cursor = next;
  }

  return { index: representationStages.length - 1, local: 1, global: 1 };
}

function getDynamicsStageState(time) {
  const t = time % dynamicsTotalDuration;
  let cursor = 0;

  for (let i = 0; i < dynamicsStages.length; i += 1) {
    const next = cursor + dynamicsStages[i].duration;
    if (t <= next) {
      return {
        index: i,
        local: (t - cursor) / dynamicsStages[i].duration,
        global: t / dynamicsTotalDuration,
      };
    }
    cursor = next;
  }

  return { index: dynamicsStages.length - 1, local: 1, global: 1 };
}

function getPlanningStageState(time) {
  const t = time % planningTotalDuration;
  let cursor = 0;

  for (let i = 0; i < planningStages.length; i += 1) {
    const next = cursor + planningStages[i].duration;
    if (t <= next) {
      return {
        index: i,
        local: (t - cursor) / planningStages[i].duration,
        global: t / planningTotalDuration,
      };
    }
    cursor = next;
  }

  return { index: planningStages.length - 1, local: 1, global: 1 };
}

function getFinalStageState(time) {
  const t = time % finalTotalDuration;
  let cursor = 0;

  for (let i = 0; i < finalStages.length; i += 1) {
    const next = cursor + finalStages[i].duration;
    if (t <= next) {
      return {
        index: i,
        local: (t - cursor) / finalStages[i].duration,
        global: t / finalTotalDuration,
      };
    }
    cursor = next;
  }

  return { index: finalStages.length - 1, local: 1, global: 1 };
}

function getWorldModelStageState(time) {
  const t = time % worldModelTotalDuration;
  let cursor = 0;

  for (let i = 0; i < worldModelStages.length; i += 1) {
    const next = cursor + worldModelStages[i].duration;
    if (t <= next) {
      return {
        index: i,
        local: (t - cursor) / worldModelStages[i].duration,
        global: t / worldModelTotalDuration,
      };
    }
    cursor = next;
  }

  return { index: worldModelStages.length - 1, local: 1, global: 1 };
}

function interpolateCosmicCamera(stageState) {
  const index = stageState.index;
  const nextIndex = Math.min(index + 1, cosmicStages.length - 1);
  const t = smoothstep(0, 1, stageState.local);
  const currentStage = cosmicStages[index];
  const nextStage = cosmicStages[nextIndex];

  return {
    camera: new THREE.Vector3(...currentStage.camera).lerp(new THREE.Vector3(...nextStage.camera), t),
    target: new THREE.Vector3(...currentStage.target).lerp(new THREE.Vector3(...nextStage.target), t),
  };
}

function interpolateHiddenCamera(stageState) {
  const index = stageState.index;
  const nextIndex = Math.min(index + 1, hiddenStages.length - 1);
  const t = smoothstep(0, 1, stageState.local);
  const currentStage = hiddenStages[index];
  const nextStage = hiddenStages[nextIndex];

  return {
    camera: new THREE.Vector3(...currentStage.camera).lerp(new THREE.Vector3(...nextStage.camera), t),
    target: new THREE.Vector3(...currentStage.target).lerp(new THREE.Vector3(...nextStage.target), t),
  };
}

function interpolateCrystallizationCamera(stageState) {
  const index = stageState.index;
  const nextIndex = Math.min(index + 1, crystallizationStages.length - 1);
  const t = smoothstep(0, 1, stageState.local);
  const currentStage = crystallizationStages[index];
  const nextStage = crystallizationStages[nextIndex];

  return {
    camera: new THREE.Vector3(...currentStage.camera).lerp(new THREE.Vector3(...nextStage.camera), t),
    target: new THREE.Vector3(...currentStage.target).lerp(new THREE.Vector3(...nextStage.target), t),
  };
}

function interpolateRepresentationCamera(stageState) {
  const index = stageState.index;
  const nextIndex = Math.min(index + 1, representationStages.length - 1);
  const t = smoothstep(0, 1, stageState.local);
  const currentStage = representationStages[index];
  const nextStage = representationStages[nextIndex];

  return {
    camera: new THREE.Vector3(...currentStage.camera).lerp(new THREE.Vector3(...nextStage.camera), t),
    target: new THREE.Vector3(...currentStage.target).lerp(new THREE.Vector3(...nextStage.target), t),
  };
}

function interpolateDynamicsCamera(stageState) {
  const index = stageState.index;
  const nextIndex = Math.min(index + 1, dynamicsStages.length - 1);
  const t = smoothstep(0, 1, stageState.local);
  const currentStage = dynamicsStages[index];
  const nextStage = dynamicsStages[nextIndex];

  return {
    camera: new THREE.Vector3(...currentStage.camera).lerp(new THREE.Vector3(...nextStage.camera), t),
    target: new THREE.Vector3(...currentStage.target).lerp(new THREE.Vector3(...nextStage.target), t),
  };
}

function interpolatePlanningCamera(stageState) {
  const index = stageState.index;
  const nextIndex = Math.min(index + 1, planningStages.length - 1);
  const t = smoothstep(0, 1, stageState.local);
  const currentStage = planningStages[index];
  const nextStage = planningStages[nextIndex];

  return {
    camera: new THREE.Vector3(...currentStage.camera).lerp(new THREE.Vector3(...nextStage.camera), t),
    target: new THREE.Vector3(...currentStage.target).lerp(new THREE.Vector3(...nextStage.target), t),
  };
}

function interpolateFinalCamera(stageState) {
  const index = stageState.index;
  const nextIndex = Math.min(index + 1, finalStages.length - 1);
  const t = smoothstep(0, 1, stageState.local);
  const currentStage = finalStages[index];
  const nextStage = finalStages[nextIndex];

  return {
    camera: new THREE.Vector3(...currentStage.camera).lerp(new THREE.Vector3(...nextStage.camera), t),
    target: new THREE.Vector3(...currentStage.target).lerp(new THREE.Vector3(...nextStage.target), t),
  };
}

function interpolateWorldModelCamera(stageState) {
  const index = stageState.index;
  const nextIndex = Math.min(index + 1, worldModelStages.length - 1);
  const t = smoothstep(0, 1, stageState.local);
  const currentStage = worldModelStages[index];
  const nextStage = worldModelStages[nextIndex];

  return {
    camera: new THREE.Vector3(...currentStage.camera).lerp(new THREE.Vector3(...nextStage.camera), t),
    target: new THREE.Vector3(...currentStage.target).lerp(new THREE.Vector3(...nextStage.target), t),
  };
}

function updateCosmicDom(stageIndex) {
  const stage = cosmicStages[stageIndex];
  kickerEl.textContent = `01 / Cosmic Universe · Stage ${stageIndex + 1} of ${cosmicStages.length}`;
  titleEl.textContent = stage.title;
  copyEl.textContent = stage.copy;
}

function updateHiddenDom(stageIndex) {
  const stage = hiddenStages[stageIndex];
  kickerEl.textContent = `02 / Hidden Structure · Stage ${stageIndex + 1} of ${hiddenStages.length}`;
  titleEl.textContent = stage.title;
  copyEl.textContent = stage.copy;
}

function updateCrystallizationDom(stageIndex) {
  const stage = crystallizationStages[stageIndex];
  kickerEl.textContent = `03 / Crystallization of Reality · Stage ${stageIndex + 1} of ${crystallizationStages.length}`;
  titleEl.textContent = stage.title;
  copyEl.textContent = stage.copy;
}

function updateRepresentationDom(stageIndex) {
  const stage = representationStages[stageIndex];
  kickerEl.textContent = `04 / Representation · Stage ${stageIndex + 1} of ${representationStages.length}`;
  titleEl.textContent = stage.title;
  copyEl.textContent = stage.copy;
}

function updateDynamicsDom(stageIndex) {
  const stage = dynamicsStages[stageIndex];
  kickerEl.textContent = `05 / Latent Dynamics · Stage ${stageIndex + 1} of ${dynamicsStages.length}`;
  titleEl.textContent = stage.title;
  copyEl.textContent = stage.copy;
}

function updatePlanningDom(stageIndex) {
  const stage = planningStages[stageIndex];
  kickerEl.textContent = `06 / Cosmic Planning · Stage ${stageIndex + 1} of ${planningStages.length}`;
  titleEl.textContent = stage.title;
  copyEl.textContent = stage.copy;
}

function updateFinalDom(stageIndex) {
  const stage = finalStages[stageIndex];
  kickerEl.textContent = `07 / From Chaos to Intelligence · Stage ${stageIndex + 1} of ${finalStages.length}`;
  titleEl.textContent = stage.title;
  copyEl.textContent = stage.copy;
}

function updateWorldModelDom(stageIndex) {
  const stage = worldModelStages[stageIndex];
  kickerEl.textContent = `08 / World Models · Stage ${stageIndex + 1} of ${worldModelStages.length}`;
  titleEl.textContent = stage.title;
  copyEl.textContent = stage.copy;
}

function updateDom(index) {
  const page = pages[index];
  if (index === 0) {
    currentCosmicStage = -1;
    updateCosmicDom(0);
  } else if (index === 1) {
    currentHiddenStage = -1;
    updateHiddenDom(0);
  } else if (index === 2) {
    currentCrystallizationStage = -1;
    updateCrystallizationDom(0);
  } else if (index === 3) {
    currentRepresentationStage = -1;
    updateRepresentationDom(0);
  } else if (index === 4) {
    currentDynamicsStage = -1;
    updateDynamicsDom(0);
  } else if (index === 5) {
    currentPlanningStage = -1;
    updatePlanningDom(0);
  } else if (index === 6) {
    currentFinalStage = -1;
    updateFinalDom(0);
  } else if (index === 7) {
    currentWorldModelStage = -1;
    updateWorldModelDom(0);
  } else {
    kickerEl.textContent = `${String(index + 1).padStart(2, '0')} / ${page.name}`;
    titleEl.textContent = page.title;
    copyEl.textContent = page.copy;
  }
  navButtons.forEach((button, buttonIndex) => {
    button.classList.toggle('active', buttonIndex === index);
  });
  document.body.classList.toggle('cosmic-cinematic', index === 0);
  document.body.classList.toggle('latent-cinematic', index === 1);
  document.body.classList.toggle('crystal-cinematic', index === 2);
  document.body.classList.toggle('representation-cinematic', index === 3);
  document.body.classList.toggle('dynamics-cinematic', index === 4);
  document.body.classList.toggle('planning-cinematic', index === 5);
  document.body.classList.toggle('final-cinematic', index === 6);
  document.body.classList.toggle('worldmodel-cinematic', index === 7);
}

function goToPage(index) {
  activePage = (index + pages.length) % pages.length;
  pages.forEach((page, pageIndex) => {
    page.group.userData.targetOpacity = pageIndex === activePage ? 1 : 0;
  });
  desiredCamera.set(...pages[activePage].camera);
  desiredTarget.set(...pages[activePage].target);
  targetBg.set(pages[activePage].color);
  updateDom(activePage);
  lastSwitchTime = clock.getElapsedTime();
}

navButtons.forEach((button) => {
  button.addEventListener('click', () => {
    autoplay = false;
    autoplayButton.classList.remove('active');
    autoplayButton.setAttribute('aria-pressed', 'false');
    goToPage(Number(button.dataset.page));
  });
});

prevButton.addEventListener('click', () => {
  autoplay = false;
  autoplayButton.classList.remove('active');
  autoplayButton.setAttribute('aria-pressed', 'false');
  goToPage(activePage - 1);
});

nextButton.addEventListener('click', () => {
  autoplay = false;
  autoplayButton.classList.remove('active');
  autoplayButton.setAttribute('aria-pressed', 'false');
  goToPage(activePage + 1);
});

autoplayButton.addEventListener('click', () => {
  autoplay = !autoplay;
  autoplayButton.classList.toggle('active', autoplay);
  autoplayButton.setAttribute('aria-pressed', String(autoplay));
  lastSwitchTime = clock.getElapsedTime();
});

let touchStartX = 0;
let touchStartY = 0;
let touchStartTime = 0;

function stopAutoplay() {
  autoplay = false;
  autoplayButton.classList.remove('active');
  autoplayButton.setAttribute('aria-pressed', 'false');
}

window.addEventListener('touchstart', (event) => {
  if (event.touches.length !== 1) return;
  touchStartX = event.touches[0].clientX;
  touchStartY = event.touches[0].clientY;
  touchStartTime = performance.now();
}, { passive: true });

window.addEventListener('touchend', (event) => {
  const touch = event.changedTouches[0];
  if (!touch) return;
  const dx = touch.clientX - touchStartX;
  const dy = touch.clientY - touchStartY;
  const dt = performance.now() - touchStartTime;
  const isSwipe = Math.abs(dx) > 58 && Math.abs(dx) > Math.abs(dy) * 1.35 && dt < 650;
  if (!isSwipe) return;
  stopAutoplay();
  goToPage(activePage + (dx < 0 ? 1 : -1));
}, { passive: true });

function animatePageObjects(elapsed) {
  pages.forEach((page, index) => {
    const opacity = page.group.userData.opacity;
    if (opacity <= 0.02) return;

    page.group.rotation.y += 0.00045 * (index + 1);
    page.group.traverse((child) => {
      if (child.isPoints) {
        child.rotation.y += 0.00035 + index * 0.00005;
        child.rotation.x += 0.00008;
      }
      if (child.geometry?.type === 'IcosahedronGeometry' || child.geometry?.type === 'TorusKnotGeometry') {
        child.rotation.x += 0.002;
        child.rotation.z -= 0.0015;
      }
      if (child.userData.spin) {
        child.rotation.x += child.userData.spin;
        child.rotation.y -= child.userData.spin * 0.7;
      }
    });

    if (index === 6) {
      page.group.scale.setScalar(1 + Math.sin(elapsed * 2.3) * 0.015);
    }
    if (index === 7) {
      page.group.scale.setScalar(1 + Math.sin(elapsed * 1.8) * 0.012);
    }
  });
}

function updateCosmicPage(elapsed, opacity) {
  const cosmicPage = pages[0];
  const parts = cosmicPage.group.userData.cosmicParts;
  if (!parts) return;

  const stageState = getCosmicStageState(elapsed - lastSwitchTime);
  const reveal = stageState.global;

  if (activePage === 0 && stageState.index !== currentCosmicStage) {
    currentCosmicStage = stageState.index;
    updateCosmicDom(stageState.index);
  }

  // ε never disappears; it is the irreducible stochastic field.
  setGroupOpacity(parts.noise, opacity * (0.54 + Math.sin(elapsed * 1.1) * 0.04));
  setGroupOpacity(parts.latent, opacity * (0.18 + smoothstep(0.08, 0.32, reveal) * 0.95));
  setGroupOpacity(parts.signal, opacity * smoothstep(0.26, 0.5, reveal));
  setGroupOpacity(parts.crystal, opacity * smoothstep(0.48, 0.72, reveal));
  setGroupOpacity(parts.core, opacity * smoothstep(0.68, 0.92, reveal));

  parts.latent.rotation.y += 0.0008;
  parts.latent.rotation.z += 0.00025;
  parts.signal.rotation.y = Math.sin(elapsed * 0.12) * 0.12;
  parts.signal.rotation.z = Math.cos(elapsed * 0.1) * 0.08;
  parts.crystal.scale.setScalar(0.72 + smoothstep(0.48, 0.72, reveal) * 0.28 + Math.sin(elapsed * 1.6) * 0.012);
  parts.core.scale.setScalar(0.76 + smoothstep(0.68, 0.92, reveal) * 0.28 + Math.sin(elapsed * 3.1) * 0.04);

  if (activePage === 0) {
    const cameraState = interpolateCosmicCamera(stageState);
    desiredCamera.copy(cameraState.camera);
    desiredTarget.copy(cameraState.target);
  }
}

function updateHiddenStructurePage(elapsed, opacity) {
  const hiddenPage = pages[1];
  const parts = hiddenPage.group.userData.hiddenParts;
  if (!parts) return;

  const stageState = getHiddenStageState(elapsed - lastSwitchTime);
  const reveal = stageState.global;

  if (activePage === 1 && stageState.index !== currentHiddenStage) {
    currentHiddenStage = stageState.index;
    updateHiddenDom(stageState.index);
  }

  setGroupOpacity(parts.chaos, opacity * (0.62 - smoothstep(0.18, 0.7, reveal) * 0.34));
  setGroupOpacity(parts.subtleCurrents, opacity * smoothstep(0.12, 0.35, reveal));
  setGroupOpacity(parts.alignedParticles, opacity * smoothstep(0.28, 0.55, reveal));
  setGroupOpacity(parts.largeStructures, opacity * smoothstep(0.48, 0.76, reveal));
  setGroupOpacity(parts.latentOcean, opacity * smoothstep(0.65, 0.98, reveal));

  parts.chaos.rotation.y += 0.00028;
  parts.subtleCurrents.rotation.y += 0.0005;
  parts.subtleCurrents.rotation.z = Math.sin(elapsed * 0.08) * 0.08;
  parts.alignedParticles.rotation.y += 0.0008;
  parts.alignedParticles.rotation.x = Math.sin(elapsed * 0.07) * 0.05;
  parts.largeStructures.rotation.y += 0.00065;
  parts.largeStructures.rotation.z += 0.00024;
  parts.latentOcean.rotation.y += 0.00048;
  parts.latentOcean.rotation.x = Math.sin(elapsed * 0.055) * 0.08;

  if (activePage === 1) {
    const cameraState = interpolateHiddenCamera(stageState);
    desiredCamera.copy(cameraState.camera);
    desiredTarget.copy(cameraState.target);
  }
}

function updateCrystallizationPage(elapsed, opacity) {
  const crystalPage = pages[2];
  const parts = crystalPage.group.userData.crystalParts;
  if (!parts) return;

  const stageState = getCrystallizationStageState(elapsed - lastSwitchTime);
  const reveal = stageState.global;

  if (activePage === 2 && stageState.index !== currentCrystallizationStage) {
    currentCrystallizationStage = stageState.index;
    updateCrystallizationDom(stageState.index);
  }

  setGroupOpacity(parts.noise, opacity * (0.36 + Math.sin(elapsed * 1.2) * 0.03));
  setGroupOpacity(parts.latent, opacity * (0.34 + smoothstep(0.02, 0.24, reveal) * 0.52));
  setGroupOpacity(parts.clustering, opacity * smoothstep(0.12, 0.38, reveal));
  setGroupOpacity(parts.crystal, opacity * smoothstep(0.3, 0.62, reveal));
  setGroupOpacity(parts.signal, opacity * smoothstep(0.48, 0.76, reveal));
  setGroupOpacity(parts.completedWorld, opacity * smoothstep(0.68, 0.98, reveal));

  parts.latent.rotation.y += 0.00062;
  parts.latent.rotation.z += 0.00018;
  parts.clustering.rotation.y += 0.001;
  parts.crystal.rotation.y += 0.00072;
  parts.crystal.rotation.x = Math.sin(elapsed * 0.08) * 0.06;
  parts.signal.rotation.y = Math.sin(elapsed * 0.11) * 0.1;
  parts.completedWorld.rotation.y -= 0.0005;

  const crystalScale = 0.28 + smoothstep(0.3, 0.72, reveal) * 0.72;
  parts.crystal.scale.setScalar(crystalScale + Math.sin(elapsed * 1.5) * 0.01);
  parts.completedWorld.scale.setScalar(0.72 + smoothstep(0.68, 0.98, reveal) * 0.28);

  parts.crystal.traverse((child) => {
    if (!child.userData.baseScale) return;
    child.scale.setScalar(child.userData.baseScale * (0.45 + smoothstep(0.32, 0.78, reveal) * 0.55));
  });

  if (activePage === 2) {
    const cameraState = interpolateCrystallizationCamera(stageState);
    desiredCamera.copy(cameraState.camera);
    desiredTarget.copy(cameraState.target);
  }
}

function updateRepresentationPage(elapsed, opacity) {
  const representationPage = pages[3];
  const parts = representationPage.group.userData.representationParts;
  if (!parts) return;

  const stageState = getRepresentationStageState(elapsed - lastSwitchTime);
  const reveal = stageState.global;

  if (activePage === 3 && stageState.index !== currentRepresentationStage) {
    currentRepresentationStage = stageState.index;
    updateRepresentationDom(stageState.index);
  }

  setGroupOpacity(parts.observation, opacity * (0.36 + (1 - smoothstep(0.36, 0.78, reveal)) * 0.48));
  setGroupOpacity(parts.interior, opacity * smoothstep(0.18, 0.48, reveal));
  setGroupOpacity(parts.particles, opacity * (0.4 + smoothstep(0.28, 0.58, reveal) * 0.32));
  setGroupOpacity(parts.trajectories, opacity * smoothstep(0.38, 0.7, reveal));
  setGroupOpacity(parts.streams, opacity * smoothstep(0.52, 0.82, reveal));
  setGroupOpacity(parts.core, opacity * smoothstep(0.68, 0.96, reveal));

  parts.observation.rotation.y += 0.00055;
  parts.observation.rotation.x = Math.sin(elapsed * 0.06) * 0.04;
  parts.interior.rotation.y -= 0.0008;
  parts.particles.rotation.y += 0.00045;
  parts.trajectories.rotation.y += 0.0007;
  parts.streams.rotation.y += 0.001;
  parts.core.rotation.y += 0.004;
  parts.core.rotation.z -= 0.002;
  parts.core.scale.setScalar(0.72 + smoothstep(0.68, 0.96, reveal) * 0.34 + Math.sin(elapsed * 3.4) * 0.05);

  if (activePage === 3) {
    const cameraState = interpolateRepresentationCamera(stageState);
    desiredCamera.copy(cameraState.camera);
    desiredTarget.copy(cameraState.target);
  }
}

function updateLatentDynamicsPage(elapsed, opacity) {
  const dynamicsPage = pages[4];
  const parts = dynamicsPage.group.userData.dynamicsParts;
  if (!parts) return;

  const stageState = getDynamicsStageState(elapsed - lastSwitchTime);
  const reveal = stageState.global;

  if (activePage === 4 && stageState.index !== currentDynamicsStage) {
    currentDynamicsStage = stageState.index;
    updateDynamicsDom(stageState.index);
  }

  setGroupOpacity(parts.latentSpace, opacity * (0.36 + smoothstep(0.08, 0.32, reveal) * 0.32));
  setGroupOpacity(parts.currentState, opacity * 1.15);
  setGroupOpacity(parts.trajectory, opacity * smoothstep(0.28, 0.58, reveal));
  setGroupOpacity(parts.memories, opacity * smoothstep(0.46, 0.76, reveal));
  setGroupOpacity(parts.branches, opacity * smoothstep(0.62, 0.9, reveal));

  const path = new THREE.CatmullRomCurve3(parts.statePath);
  const movingT = THREE.MathUtils.clamp(smoothstep(0.12, 0.92, reveal) + Math.sin(elapsed * 0.18) * 0.035, 0, 1);
  const position = path.getPointAt(movingT);
  parts.currentState.position.copy(position);
  parts.currentState.rotation.y += 0.004;
  parts.currentState.rotation.z -= 0.002;
  parts.currentState.scale.setScalar(0.84 + Math.sin(elapsed * 3.0) * 0.055);

  parts.latentSpace.rotation.y += 0.00055;
  parts.trajectory.rotation.y += 0.0003;
  parts.memories.rotation.y += 0.0002;
  parts.branches.rotation.y -= 0.00028;

  parts.memories.children.forEach((memory, index) => {
    const active = smoothstep(index / parts.statePath.length - 0.08, index / parts.statePath.length + 0.18, movingT);
    setGroupOpacity(memory, opacity * active * (0.32 + index / parts.statePath.length * 0.46));
  });

  if (activePage === 4) {
    const cameraState = interpolateDynamicsCamera(stageState);
    desiredCamera.copy(cameraState.camera);
    desiredTarget.copy(cameraState.target);
  }
}

function updateCosmicPlanningPage(elapsed, opacity) {
  const planningPage = pages[5];
  const parts = planningPage.group.userData.planningParts;
  if (!parts) return;

  const stageState = getPlanningStageState(elapsed - lastSwitchTime);
  const reveal = stageState.global;

  if (activePage === 5 && stageState.index !== currentPlanningStage) {
    currentPlanningStage = stageState.index;
    updatePlanningDom(stageState.index);
  }

  setGroupOpacity(parts.possibilityField, opacity * (0.34 + smoothstep(0.02, 0.22, reveal) * 0.28));
  setGroupOpacity(parts.branches, opacity * smoothstep(0.18, 0.45, reveal));
  setGroupOpacity(parts.goals, opacity * smoothstep(0.34, 0.62, reveal));
  setGroupOpacity(parts.actions, opacity * smoothstep(0.52, 0.78, reveal));
  setGroupOpacity(parts.selectedPath, opacity * smoothstep(0.62, 0.92, reveal));
  setGroupOpacity(parts.currentState, opacity * 1.1);

  const path = new THREE.CatmullRomCurve3(parts.optimal);
  const pathT = THREE.MathUtils.clamp(smoothstep(0.58, 0.98, reveal) + Math.sin(elapsed * 0.2) * 0.02, 0, 1);
  parts.currentState.position.copy(path.getPointAt(pathT));
  parts.currentState.rotation.y += 0.004;
  parts.currentState.rotation.z -= 0.002;
  parts.currentState.scale.setScalar(0.82 + Math.sin(elapsed * 2.8) * 0.045);

  parts.possibilityField.rotation.y += 0.00042;
  parts.branches.rotation.y += 0.00018;
  parts.goals.children.forEach((goal, index) => {
    goal.rotation.y += 0.003 + index * 0.0005;
    goal.scale.setScalar(1 + Math.sin(elapsed * 1.4 + index) * 0.04);
  });
  parts.actions.rotation.y -= 0.0008;
  parts.selectedPath.rotation.y += 0.00024;

  if (activePage === 5) {
    const cameraState = interpolatePlanningCamera(stageState);
    desiredCamera.copy(cameraState.camera);
    desiredTarget.copy(cameraState.target);
  }
}

function updateFinalPage(elapsed, opacity) {
  const finalPage = pages[6];
  const parts = finalPage.group.userData.finalParts;
  if (!parts) return;

  const stageState = getFinalStageState(elapsed - lastSwitchTime);
  const reveal = stageState.global;

  if (activePage === 6 && stageState.index !== currentFinalStage) {
    currentFinalStage = stageState.index;
    updateFinalDom(stageState.index);
  }

  setGroupOpacity(parts.representation, opacity * 1.18);
  setGroupOpacity(parts.dynamics, opacity * smoothstep(0.1, 0.36, reveal));
  setGroupOpacity(parts.planning, opacity * smoothstep(0.26, 0.52, reveal));
  setGroupOpacity(parts.observation, opacity * smoothstep(0.42, 0.68, reveal));
  setGroupOpacity(parts.latent, opacity * smoothstep(0.58, 0.84, reveal));
  setGroupOpacity(parts.noise, opacity * (0.2 + smoothstep(0.72, 0.98, reveal) * 0.36));
  setGroupOpacity(parts.connectors, opacity * smoothstep(0.74, 0.98, reveal));

  parts.representation.rotation.y += 0.004;
  parts.representation.rotation.z -= 0.002;
  parts.representation.scale.setScalar(0.86 + Math.sin(elapsed * 3.2) * 0.045);
  parts.dynamics.rotation.y += 0.00055;
  parts.planning.rotation.y -= 0.00034;
  parts.observation.rotation.y += 0.00045;
  parts.latent.rotation.y += 0.00035;
  parts.latent.rotation.z += 0.00012;
  parts.noise.rotation.y += 0.00016;
  parts.connectors.rotation.y += 0.00025;

  if (activePage === 6) {
    const cameraState = interpolateFinalCamera(stageState);
    desiredCamera.copy(cameraState.camera);
    desiredTarget.copy(cameraState.target);
  }
}

function updateWorldModelsPage(elapsed, opacity) {
  const worldModelPage = pages[7];
  const parts = worldModelPage.group.userData.worldModelParts;
  if (!parts) return;

  const stageState = getWorldModelStageState(elapsed - lastSwitchTime);
  const reveal = stageState.global;

  if (activePage === 7 && stageState.index !== currentWorldModelStage) {
    currentWorldModelStage = stageState.index;
    updateWorldModelDom(stageState.index);
  }

  setGroupOpacity(parts.core, opacity * 1.18);
  setGroupOpacity(parts.latentField, opacity * (0.22 + smoothstep(0.12, 0.44, reveal) * 0.3));
  setGroupOpacity(parts.seedWorlds, opacity * smoothstep(0.1, 0.32, reveal) * (1 - smoothstep(0.46, 0.7, reveal) * 0.38));
  setGroupOpacity(parts.worldTree, opacity * smoothstep(0.26, 0.54, reveal));
  setGroupOpacity(parts.futureWorlds, opacity * smoothstep(0.34, 0.66, reveal));
  setGroupOpacity(parts.timelines, opacity * smoothstep(0.48, 0.78, reveal));
  setGroupOpacity(parts.vanishingBranches, opacity * smoothstep(0.42, 0.62, reveal) * (1 - smoothstep(0.72, 0.94, reveal) * 0.72));
  setGroupOpacity(parts.reconnect, opacity * smoothstep(0.78, 0.98, reveal));

  parts.core.rotation.y += 0.0045;
  parts.core.rotation.z -= 0.002;
  parts.core.scale.setScalar(0.82 + Math.sin(elapsed * 3.4) * 0.055);

  parts.latentField.rotation.y += 0.00038;
  parts.latentField.rotation.z = Math.sin(elapsed * 0.055) * 0.05;
  parts.seedWorlds.rotation.y += 0.0009;
  parts.worldTree.rotation.y += 0.00024;
  parts.timelines.rotation.y -= 0.00018;
  parts.vanishingBranches.rotation.y += 0.00014;
  parts.reconnect.rotation.y += 0.00035;

  parts.futureWorlds.children.forEach((world, index) => {
    const base = world.userData.basePosition;
    const phase = world.userData.dreamPhase ?? 0;
    if (base) {
      world.position.copy(base);
      world.position.y += Math.sin(elapsed * 0.62 + phase) * 0.12;
      world.position.x += Math.cos(elapsed * 0.38 + phase) * 0.05;
    }
    world.rotation.y += 0.003 + index * 0.00025;
    world.rotation.x += 0.0012;
    world.scale.setScalar((index === 1 ? 0.82 : 0.56) * (1 + Math.sin(elapsed * 1.2 + phase) * 0.035));
  });

  parts.seedWorlds.children.forEach((seed, index) => {
    seed.rotation.y += 0.004 + index * 0.0006;
    seed.scale.setScalar((0.24 + index * 0.025) * (0.78 + smoothstep(0.08, 0.34, reveal) * 0.36));
  });

  if (activePage === 7) {
    const cameraState = interpolateWorldModelCamera(stageState);
    desiredCamera.copy(cameraState.camera);
    desiredTarget.copy(cameraState.target);
  }
}

function animate() {
  const elapsed = clock.getElapsedTime();

  const autoplayInterval = activePage === 0
    ? cosmicTotalDuration
    : activePage === 1
      ? hiddenTotalDuration
      : activePage === 2
        ? crystallizationTotalDuration
        : activePage === 3
          ? representationTotalDuration
          : activePage === 4
            ? dynamicsTotalDuration
            : activePage === 5
              ? planningTotalDuration
              : activePage === 6
                ? finalTotalDuration
                : activePage === 7
                  ? worldModelTotalDuration
                  : 8.5;
  if (autoplay && elapsed - lastSwitchTime > autoplayInterval) {
    goToPage(activePage + 1);
  }

  pages.forEach((page) => {
    page.group.userData.opacity = THREE.MathUtils.lerp(
      page.group.userData.opacity,
      page.group.userData.targetOpacity,
      0.045,
    );
    setGroupOpacity(page.group, page.group.userData.opacity);
  });

  if (pages[0].group.userData.opacity > 0.02) {
    updateCosmicPage(elapsed, pages[0].group.userData.opacity);
  }
  if (pages[1].group.userData.opacity > 0.02) {
    updateHiddenStructurePage(elapsed, pages[1].group.userData.opacity);
  }
  if (pages[2].group.userData.opacity > 0.02) {
    updateCrystallizationPage(elapsed, pages[2].group.userData.opacity);
  }
  if (pages[3].group.userData.opacity > 0.02) {
    updateRepresentationPage(elapsed, pages[3].group.userData.opacity);
  }
  if (pages[4].group.userData.opacity > 0.02) {
    updateLatentDynamicsPage(elapsed, pages[4].group.userData.opacity);
  }
  if (pages[5].group.userData.opacity > 0.02) {
    updateCosmicPlanningPage(elapsed, pages[5].group.userData.opacity);
  }
  if (pages[6].group.userData.opacity > 0.02) {
    updateFinalPage(elapsed, pages[6].group.userData.opacity);
  }
  if (pages[7].group.userData.opacity > 0.02) {
    updateWorldModelsPage(elapsed, pages[7].group.userData.opacity);
  }

  camera.position.lerp(desiredCamera, 0.035);
  currentLookAt.lerp(desiredTarget, 0.04);
  camera.lookAt(currentLookAt);

  currentBg.lerp(targetBg, 0.035);
  scene.background.copy(currentBg);
  scene.fog.color.copy(currentBg);

  const activeOpacity = pages[activePage].group.userData.opacity;
  keyLight.intensity = 3.4 + activeOpacity * 1.2 + Math.sin(elapsed * 1.7) * 0.15;
  blueLight.intensity = 4.6 + Math.sin(elapsed * 0.9) * 0.35;
  goldLight.intensity = 2.8 + Math.sin(elapsed * 1.2) * 0.25;
  bloom.strength = 0.72 + activePage * 0.02 + Math.sin(elapsed * 0.8) * 0.04;

  animatePageObjects(elapsed);
  composer.render();
  requestAnimationFrame(animate);
}

function resize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  composer.setSize(window.innerWidth, window.innerHeight);
}

window.addEventListener('resize', resize);
updateDom(0);
animate();
