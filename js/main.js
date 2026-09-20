import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { GALAXY_CONFIG } from "./config.js";

const $ = (s) => document.querySelector(s);

const mount = $("#stage");
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x010101);
scene.fog = new THREE.FogExp2(0x010101, 0.0125);

const camera = new THREE.PerspectiveCamera(49, innerWidth / innerHeight, 0.1, 240);
camera.position.set(0, 12.5, 24.5);

const renderer = new THREE.WebGLRenderer({
  antialias: true,
  alpha: false,
  powerPreference: "high-performance"
});
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.14;
mount.appendChild(renderer.domElement);

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(
  new THREE.Vector2(innerWidth, innerHeight),
  1.05,
  0.68,
  0.14
);
composer.addPass(bloom);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.055;
controls.enablePan = false;
controls.minDistance = 11;
controls.maxDistance = 42;
controls.minPolarAngle = 0.42;
controls.maxPolarAngle = 1.38;
controls.target.set(0, 1.2, -1.5);
controls.autoRotate = true;
controls.autoRotateSpeed = 0.32;

const root = new THREE.Group();
scene.add(root);

const clock = new THREE.Clock();
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
let pointerDown = null;
let hovered = null;
let selected = null;
let entering = true;
let focusTween = null;

/* ---------------------------------------------------------
   LIGHTS
--------------------------------------------------------- */

scene.add(new THREE.AmbientLight(0xffdca0, 0.32));

const key = new THREE.PointLight(0xffca39, 68, 85, 1.8);
key.position.set(0, 12, 2);
scene.add(key);

const rim = new THREE.PointLight(0xffe99e, 32, 75, 1.5);
rim.position.set(-15, 8, -18);
scene.add(rim);

/* ---------------------------------------------------------
   GLOW TEXTURE
--------------------------------------------------------- */

function makeGlowTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const x = c.getContext("2d");
  const g = x.createRadialGradient(64, 64, 0, 64, 64, 61);
  g.addColorStop(0, "rgba(255,255,235,1)");
  g.addColorStop(0.16, "rgba(255,239,142,.98)");
  g.addColorStop(0.42, "rgba(255,194,15,.72)");
  g.addColorStop(1, "rgba(255,194,15,0)");
  x.fillStyle = g;
  x.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}

const glowTexture = makeGlowTexture();

/* ---------------------------------------------------------
   STAR BACKGROUND
--------------------------------------------------------- */

function createStarCloud() {
  const count = 5200;
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);

  for (let i = 0; i < count; i++) {
    const r = 38 + Math.random() * 70;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(THREE.MathUtils.randFloatSpread(2));

    positions[i * 3] = Math.sin(phi) * Math.cos(theta) * r;
    positions[i * 3 + 1] = Math.cos(phi) * r * 0.62 + 11;
    positions[i * 3 + 2] = Math.sin(phi) * Math.sin(theta) * r - 8;

    const warm = Math.random();
    colors[i * 3] = 0.78 + warm * 0.22;
    colors[i * 3 + 1] = 0.74 + warm * 0.18;
    colors[i * 3 + 2] = 0.46 + warm * 0.30;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));

  const material = new THREE.PointsMaterial({
    size: 0.09,
    map: glowTexture,
    transparent: true,
    opacity: 0.42,
    depthWrite: false,
    vertexColors: true,
    blending: THREE.AdditiveBlending
  });

  const points = new THREE.Points(geometry, material);
  scene.add(points);
  return points;
}

const starCloud = createStarCloud();

/* ---------------------------------------------------------
   GALAXY FLOOR
--------------------------------------------------------- */

function createGalaxyFloor() {
  const count = 36000;
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const sizes = new Float32Array(count);

  const golden = new THREE.Color(0xffc82a);
  const pale = new THREE.Color(0xfff0a0);
  const dark = new THREE.Color(0x9b6500);

  for (let i = 0; i < count; i++) {
    const arm = i % 4;
    const normalized = Math.pow(Math.random(), 0.57);
    const radius = normalized * 24.5;
    const spin = radius * 0.44;
    const armAngle = arm * (Math.PI * 2 / 4);
    const scatter = (Math.random() - 0.5) * (0.55 + radius * 0.07);
    const angle = armAngle + spin + scatter;

    const x = Math.cos(angle) * radius + THREE.MathUtils.randFloatSpread(0.65);
    const z = Math.sin(angle) * radius * 0.78 + THREE.MathUtils.randFloatSpread(0.65);
    const y = -0.04 + Math.random() * 0.14 + Math.exp(-radius * 0.16) * 0.35;

    positions[i * 3] = x;
    positions[i * 3 + 1] = y;
    positions[i * 3 + 2] = z;

    let c;
    const chance = Math.random();
    if (chance > 0.78) c = pale;
    else if (chance > 0.2) c = golden;
    else c = dark;

    const fade = 0.40 + (1 - radius / 26) * 0.60;
    colors[i * 3] = c.r * fade;
    colors[i * 3 + 1] = c.g * fade;
    colors[i * 3 + 2] = c.b * fade;
    sizes[i] = 0.65 + Math.random() * 1.5;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));

  const material = new THREE.PointsMaterial({
    size: 0.105,
    map: glowTexture,
    transparent: true,
    opacity: 0.80,
    depthWrite: false,
    vertexColors: true,
    blending: THREE.AdditiveBlending
  });

  const galaxy = new THREE.Points(geometry, material);
  galaxy.rotation.y = -0.12;
  root.add(galaxy);
  return galaxy;
}

const galaxyFloor = createGalaxyFloor();

/* ---------------------------------------------------------
   WHITE + GOLD VORTEX IN THE CENTER
--------------------------------------------------------- */

function createVortex() {
  const group = new THREE.Group();

  const makeArm = (color, offset, width, pointsCount, opacity) => {
    const positions = new Float32Array(pointsCount * 3);

    for (let i = 0; i < pointsCount; i++) {
      const t = i / (pointsCount - 1);
      const radius = 0.15 + t * 7.2;
      const angle = offset + t * Math.PI * 5.4 + (Math.random() - 0.5) * width;

      positions[i * 3] = Math.cos(angle) * radius;
      positions[i * 3 + 1] = 0.18 + (1 - t) * 0.14 + Math.random() * 0.11;
      positions[i * 3 + 2] = Math.sin(angle) * radius * 0.73;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));

    const material = new THREE.PointsMaterial({
      color,
      size: 0.13,
      map: glowTexture,
      transparent: true,
      opacity,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });

    group.add(new THREE.Points(geometry, material));
  };

  makeArm(0xfffbea, 0, 0.16, 6200, 0.93);
  makeArm(0xffd02a, Math.PI, 0.19, 5200, 0.82);

  const core = new THREE.Mesh(
    new THREE.SphereGeometry(0.72, 32, 20),
    new THREE.MeshStandardMaterial({
      color: 0x111111,
      roughness: 0.84,
      metalness: 0.04,
      emissive: 0x050505
    })
  );
  core.position.y = 0.37;
  group.add(core);

  root.add(group);
  return group;
}

const vortex = createVortex();

/* ---------------------------------------------------------
   PARTICLE SUNFLOWER — BEHIND THE GALAXY
--------------------------------------------------------- */

function pointsObject(positions, color, size, opacity = 1) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));

  return new THREE.Points(
    geometry,
    new THREE.PointsMaterial({
      color,
      size,
      map: glowTexture,
      transparent: true,
      opacity,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    })
  );
}

function createParticleSunflower() {
  const flower = new THREE.Group();

  for (let petal = 0; petal < 25; petal++) {
    const angle = petal / 25 * Math.PI * 2;
    const positions = [];

    for (let i = 0; i < 210; i++) {
      const u = Math.random();
      const radial = 1.3 + Math.sin(u * Math.PI) * 3.2;
      const side = (Math.random() - 0.5) * (0.18 + Math.sin(u * Math.PI) * 0.46);
      const a = angle + side * 0.21;

      positions.push(
        Math.cos(a) * radial,
        Math.sin(a) * radial,
        (Math.random() - 0.5) * 0.62
      );
    }

    flower.add(pointsObject(
      positions,
      petal % 3 ? 0xffd426 : 0xffff8d,
      0.125,
      0.92
    ));
  }

  const centerPositions = [];
  for (let i = 0; i < 2600; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = Math.sqrt(Math.random()) * 1.58;
    centerPositions.push(
      Math.cos(a) * r,
      Math.sin(a) * r,
      (Math.random() - 0.5) * 0.52
    );
  }
  flower.add(pointsObject(centerPositions, 0x6d2d0b, 0.11, 0.94));

  // stem
  const stem = new THREE.Mesh(
    new THREE.CylinderGeometry(0.10, 0.17, 8.3, 10),
    new THREE.MeshStandardMaterial({
      color: 0x2d5f27,
      emissive: 0x10250e,
      emissiveIntensity: 0.4,
      roughness: 0.9
    })
  );
  stem.position.y = -5.5;
  flower.add(stem);

  flower.position.set(0, 7.7, -10.8);
  flower.scale.setScalar(1.22);
  root.add(flower);
  return flower;
}

const sunflower = createParticleSunflower();

/* ---------------------------------------------------------
   MEMORY NODES / SPRITES
--------------------------------------------------------- */

const textureLoader = new THREE.TextureLoader();
const memoryMeshes = [];
const memoryHalos = [];
const memoryBases = [];

function createMemoryNodes() {
  GALAXY_CONFIG.memories.forEach((memory, index) => {
    const angle = memory.angle;
    const radius = memory.radius;

    const group = new THREE.Group();
    group.userData.memoryIndex = index;

    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius * 0.78;

    group.position.set(x, 1.05, z);

    const halo = new THREE.Mesh(
      new THREE.RingGeometry(1.35, 1.49, 64),
      new THREE.MeshBasicMaterial({
        color: 0xffd63f,
        transparent: true,
        opacity: 0.42,
        side: THREE.DoubleSide,
        depthWrite: false,
        blending: THREE.AdditiveBlending
      })
    );
    halo.rotation.x = -Math.PI / 2;
    group.add(halo);

    const base = new THREE.Mesh(
      new THREE.CylinderGeometry(1.20, 1.20, 0.10, 48),
      new THREE.MeshStandardMaterial({
        color: 0x0e0b05,
        roughness: 0.48,
        metalness: 0.13,
        emissive: 0x4b3306,
        emissiveIntensity: 0.33
      })
    );
    group.add(base);
    memoryBases.push(base);

    const texture = textureLoader.load(memory.image);
    texture.colorSpace = THREE.SRGBColorSpace;

    const sprite = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: texture,
        transparent: true,
        depthWrite: false
      })
    );
    sprite.position.y = 1.12;
    sprite.scale.set(2.25, 2.25, 1);
    sprite.userData.memoryIndex = index;
    group.add(sprite);

    const light = new THREE.PointLight(0xffc82b, 7, 7, 2);
    light.position.y = 1.7;
    group.add(light);

    root.add(group);
    memoryMeshes.push(sprite);
    memoryHalos.push(halo);
  });
}

createMemoryNodes();

/* ---------------------------------------------------------
   TEXT ON THE FLOOR
--------------------------------------------------------- */

function makeTextTexture(text) {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 160;
  const ctx = canvas.getContext("2d");

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.font = "700 62px Georgia";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.shadowColor = "rgba(255,205,45,.9)";
  ctx.shadowBlur = 22;
  ctx.fillStyle = "#fff0a3";
  ctx.fillText(text, 512, 82);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
  return texture;
}

function createFloorWords() {
  const radius = 15.8;

  GALAXY_CONFIG.floorWords.forEach((word, i) => {
    const a = i / GALAXY_CONFIG.floorWords.length * Math.PI * 2 + 0.22;

    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(6.0, 0.95),
      new THREE.MeshBasicMaterial({
        map: makeTextTexture(word),
        transparent: true,
        opacity: 0.86,
        depthWrite: false,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending
      })
    );

    mesh.position.set(
      Math.cos(a) * radius,
      0.20,
      Math.sin(a) * radius * 0.78
    );

    mesh.rotation.x = -Math.PI / 2;
    mesh.rotation.z = -a + Math.PI / 2;
    root.add(mesh);
  });
}

createFloorWords();

/* ---------------------------------------------------------
   DECORATIVE GOLDEN ORBITS
--------------------------------------------------------- */

function createOrbitLines() {
  for (let r = 4.4; r <= 20.5; r += 3.2) {
    const curve = new THREE.EllipseCurve(0, 0, r, r * 0.78, 0, Math.PI * 2, false, 0);
    const pts = curve.getPoints(240);
    const positions = pts.map(p => new THREE.Vector3(p.x, 0.10, p.y));

    const geo = new THREE.BufferGeometry().setFromPoints(positions);
    const line = new THREE.LineLoop(
      geo,
      new THREE.LineBasicMaterial({
        color: r < 8 ? 0xfff1af : 0xffbd16,
        transparent: true,
        opacity: r < 8 ? 0.14 : 0.055,
        blending: THREE.AdditiveBlending
      })
    );
    root.add(line);
  }
}

createOrbitLines();

/* ---------------------------------------------------------
   FLOATING MOTES
--------------------------------------------------------- */

function createMotes() {
  const count = 650;
  const positions = new Float32Array(count * 3);

  for (let i = 0; i < count; i++) {
    positions[i * 3] = THREE.MathUtils.randFloatSpread(38);
    positions[i * 3 + 1] = 0.6 + Math.random() * 13;
    positions[i * 3 + 2] = THREE.MathUtils.randFloatSpread(35) - 3;
  }

  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(positions, 3));

  const m = new THREE.PointsMaterial({
    color: 0xffdf70,
    size: 0.10,
    map: glowTexture,
    transparent: true,
    opacity: 0.40,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  });

  const p = new THREE.Points(g, m);
  root.add(p);
  return p;
}

const motes = createMotes();


/* ---------------------------------------------------------
   HEART CONSTELLATIONS
--------------------------------------------------------- */

function makeHeartTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const ctx = c.getContext("2d");

  ctx.translate(64, 68);
  ctx.beginPath();
  ctx.moveTo(0, 26);
  ctx.bezierCurveTo(-44, -2, -40, -43, -13, -43);
  ctx.bezierCurveTo(-2, -43, 0, -35, 0, -27);
  ctx.bezierCurveTo(0, -35, 2, -43, 13, -43);
  ctx.bezierCurveTo(40, -43, 44, -2, 0, 26);
  ctx.closePath();

  const g = ctx.createLinearGradient(-32, -40, 34, 24);
  g.addColorStop(0, "rgba(255,249,198,1)");
  g.addColorStop(.42, "rgba(255,218,71,1)");
  g.addColorStop(1, "rgba(255,132,117,.9)");
  ctx.fillStyle = g;
  ctx.shadowColor = "rgba(255,205,52,.9)";
  ctx.shadowBlur = 20;
  ctx.fill();

  return new THREE.CanvasTexture(c);
}

const heartTexture = makeHeartTexture();

function createHeartField() {
  const group = new THREE.Group();

  for (let i = 0; i < 44; i++) {
    const mat = new THREE.SpriteMaterial({
      map: heartTexture,
      transparent: true,
      opacity: 0.22 + Math.random() * 0.32,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });

    const s = new THREE.Sprite(mat);
    const radius = 8 + Math.random() * 18;
    const angle = Math.random() * Math.PI * 2;

    s.position.set(
      Math.cos(angle) * radius,
      1.8 + Math.random() * 9,
      Math.sin(angle) * radius * 0.78 - 2
    );

    const size = 0.22 + Math.random() * 0.48;
    s.scale.set(size, size, 1);

    s.userData = {
      baseY: s.position.y,
      phase: Math.random() * Math.PI * 2,
      speed: 0.28 + Math.random() * 0.36,
      drift: 0.06 + Math.random() * 0.11
    };

    group.add(s);
  }

  root.add(group);
  return group;
}

const heartField = createHeartField();

/* ---------------------------------------------------------
   SHOOTING STARS
--------------------------------------------------------- */

function createShootingStars() {
  const group = new THREE.Group();

  for (let i = 0; i < 6; i++) {
    const geo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0,0,0),
      new THREE.Vector3(-2.4,0.55,0.3)
    ]);

    const mat = new THREE.LineBasicMaterial({
      color: i % 2 ? 0xfff2b0 : 0xffcf38,
      transparent: true,
      opacity: 0.0,
      blending: THREE.AdditiveBlending
    });

    const line = new THREE.Line(geo, mat);
    line.position.set(
      -25 + Math.random() * 50,
      10 + Math.random() * 18,
      -20 + Math.random() * 28
    );

    line.userData = {
      timer: Math.random() * 7,
      delay: 4 + Math.random() * 7,
      active: false,
      speed: 8 + Math.random() * 8
    };

    group.add(line);
  }

  scene.add(group);
  return group;
}

const shootingStars = createShootingStars();

/* ---------------------------------------------------------
   MEMORY PULSES
--------------------------------------------------------- */

const pulseRings = [];

function addMemoryPulse(group, index) {
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(1.55, 1.61, 64),
    new THREE.MeshBasicMaterial({
      color: index % 2 ? 0xffe169 : 0xffc92f,
      transparent: true,
      opacity: 0.18,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    })
  );

  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.03;
  ring.userData.phase = index * 0.7;
  group.add(ring);
  pulseRings.push(ring);
}

memoryMeshes.forEach((sprite, index) => addMemoryPulse(sprite.parent, index));



/* ---------------------------------------------------------
   GOLDEN HAZE / VOLUMETRIC GLOW
--------------------------------------------------------- */

function makeSoftDiscTexture(inner = "rgba(255,234,148,.9)", outer = "rgba(255,194,25,0)") {
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const ctx = c.getContext("2d");
  const g = ctx.createRadialGradient(128, 128, 0, 128, 128, 118);
  g.addColorStop(0, inner);
  g.addColorStop(0.45, "rgba(255,220,92,.28)");
  g.addColorStop(1, outer);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 256);
  return new THREE.CanvasTexture(c);
}

const softDiscTexture = makeSoftDiscTexture();

function createGoldenHaze() {
  const group = new THREE.Group();

  const makeDisc = (x, y, z, scale, opacity) => {
    const spr = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: softDiscTexture,
        transparent: true,
        opacity,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        color: 0xffcf42
      })
    );
    spr.position.set(x, y, z);
    spr.scale.set(scale, scale, 1);
    group.add(spr);
    return spr;
  };

  const discs = [
    makeDisc(0, 3.0, -2.0, 16, 0.11),
    makeDisc(0, 4.2, -8.5, 15.5, 0.10),
    makeDisc(10, 2.2, -2.0, 8.5, 0.06),
    makeDisc(-11, 2.7, -3.5, 9.0, 0.055),
    makeDisc(0, 8.2, -12.0, 9.5, 0.08)
  ];

  root.add(group);
  return { group, discs };
}

const goldenHaze = createGoldenHaze();

/* ---------------------------------------------------------
   PETAL STREAM / FIREFLY CURTAIN
--------------------------------------------------------- */

function makePetalTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 96;
  const ctx = c.getContext("2d");
  ctx.translate(48, 48);
  const g = ctx.createLinearGradient(0, -30, 0, 30);
  g.addColorStop(0, "rgba(255,248,190,1)");
  g.addColorStop(.45, "rgba(255,212,45,1)");
  g.addColorStop(1, "rgba(208,136,5,.95)");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(0, 0, 16, 34, 0, 0, Math.PI * 2);
  ctx.fill();
  return new THREE.CanvasTexture(c);
}
const petalTexture = makePetalTexture();

function createPetalStream() {
  const group = new THREE.Group();
  const petals = [];

  for (let i = 0; i < 70; i++) {
    const sprite = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: petalTexture,
        transparent: true,
        opacity: 0.48,
        depthWrite: false,
        blending: THREE.AdditiveBlending
      })
    );
    const angle = Math.random() * Math.PI * 2;
    const radius = 5 + Math.random() * 18;
    sprite.position.set(
      Math.cos(angle) * radius,
      1.0 + Math.random() * 10,
      Math.sin(angle) * radius * 0.78 - 2
    );
    const size = 0.22 + Math.random() * 0.32;
    sprite.scale.set(size, size * 1.6, 1);
    sprite.material.rotation = Math.random() * Math.PI;

    sprite.userData = {
      origin: sprite.position.clone(),
      phase: Math.random() * Math.PI * 2,
      speed: 0.18 + Math.random() * 0.25,
      sway: 0.4 + Math.random() * 1.0,
      fall: 0.05 + Math.random() * 0.06,
      baseScale: size
    };

    petals.push(sprite);
    group.add(sprite);
  }

  root.add(group);
  return { group, petals };
}
const petalStream = createPetalStream();

/* ---------------------------------------------------------
   MEMORY PATHS / CONSTELLATION LINKS
--------------------------------------------------------- */

function createMemoryLinks() {
  const lines = [];
  GALAXY_CONFIG.memories.forEach((memory, i) => {
    const curve = new THREE.QuadraticBezierCurve3(
      new THREE.Vector3(0, 0.16, 0),
      new THREE.Vector3(
        Math.cos(memory.angle) * memory.radius * 0.45,
        0.25 + (i % 2) * 0.05,
        Math.sin(memory.angle) * memory.radius * 0.78 * 0.45
      ),
      new THREE.Vector3(
        Math.cos(memory.angle) * memory.radius,
        0.2,
        Math.sin(memory.angle) * memory.radius * 0.78
      )
    );

    const pts = curve.getPoints(60);
    const geo = new THREE.BufferGeometry().setFromPoints(pts);
    const line = new THREE.Line(
      geo,
      new THREE.LineDashedMaterial({
        color: 0xffdb63,
        dashSize: 0.22,
        gapSize: 0.15,
        transparent: true,
        opacity: 0.22,
        blending: THREE.AdditiveBlending
      })
    );
    line.computeLineDistances();
    root.add(line);
    lines.push(line);
  });
  return lines;
}
const memoryLinks = createMemoryLinks();

/* ---------------------------------------------------------
   CENTRAL HEART ORBIT / AUTHENTIC SIGNATURE
--------------------------------------------------------- */

function createCentralHeartOrbit() {
  const group = new THREE.Group();
  for (let i = 0; i < 16; i++) {
    const spr = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: heartTexture,
        transparent: true,
        opacity: 0.18,
        depthWrite: false,
        blending: THREE.AdditiveBlending
      })
    );
    const angle = i / 16 * Math.PI * 2;
    const radius = 2.0 + (i % 2) * 0.45;
    spr.position.set(Math.cos(angle) * radius, 0.48, Math.sin(angle) * radius * 0.78);
    const scale = 0.18 + (i % 3) * 0.03;
    spr.scale.set(scale, scale, 1);
    spr.userData = { angle, radius, scale, phase: i * 0.4 };
    group.add(spr);
  }
  root.add(group);
  return group;
}
const centralHeartOrbit = createCentralHeartOrbit();

/* ---------------------------------------------------------
   HOVER CROWN
--------------------------------------------------------- */

function createHoverCrown() {
  const group = new THREE.Group();
  group.visible = false;
  for (let i = 0; i < 12; i++) {
    const spr = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: glowTexture,
        transparent: true,
        opacity: 0.65,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        color: i % 2 ? 0xfff3b5 : 0xffd03d
      })
    );
    const scale = 0.18 + (i % 3) * 0.06;
    spr.scale.set(scale, scale, 1);
    spr.userData.offset = i / 12 * Math.PI * 2;
    group.add(spr);
  }
  root.add(group);
  return group;
}
const hoverCrown = createHoverCrown();


/* ---------------------------------------------------------
   UI
--------------------------------------------------------- */

const welcome = $("#welcome");
const hud = $("#hud");
const hint = $("#hint");
const memoryCard = $("#memoryCard");
const tooltip = $("#tooltip");

const music = $("#bgMusic");
const musicBtn = $("#musicBtn");
let musicEnabled = false;

let audioCtx = null;
let analyser = null;
let sourceNode = null;
let freqData = null;
let audioReady = false;
let reactiveBass = 0;
let reactiveMid = 0;
let reactiveHigh = 0;

function setupAudioReactive() {
  if (audioReady) return;

  audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  analyser = audioCtx.createAnalyser();
  analyser.fftSize = 256;
  analyser.smoothingTimeConstant = 0.82;

  sourceNode = audioCtx.createMediaElementSource(music);
  sourceNode.connect(analyser);
  analyser.connect(audioCtx.destination);

  freqData = new Uint8Array(analyser.frequencyBinCount);
  audioReady = true;
}

function averageBins(from, to) {
  if (!freqData || !freqData.length) return 0;
  const end = Math.min(to, freqData.length);
  let sum = 0;
  for (let i = from; i < end; i++) sum += freqData[i];
  return end > from ? sum / (end - from) / 255 : 0;
}

function updateAudioReactive() {
  if (!audioReady || !analyser || music.paused) {
    reactiveBass *= 0.92;
    reactiveMid *= 0.92;
    reactiveHigh *= 0.92;
    return;
  }

  analyser.getByteFrequencyData(freqData);

  const bassNow = averageBins(1, 10);
  const midNow = averageBins(10, 34);
  const highNow = averageBins(34, 72);

  reactiveBass += (bassNow - reactiveBass) * 0.18;
  reactiveMid += (midNow - reactiveMid) * 0.15;
  reactiveHigh += (highNow - reactiveHigh) * 0.20;
}


musicBtn.addEventListener("click", async () => {
  try {
    setupAudioReactive();
    if (audioCtx && audioCtx.state === "suspended") await audioCtx.resume();

    if (!musicEnabled) {
      await music.play();
      musicEnabled = true;
      musicBtn.classList.add("on");
      musicBtn.textContent = "♫ SONANDO";
    } else {
      music.pause();
      musicEnabled = false;
      musicBtn.classList.remove("on");
      musicBtn.textContent = "♫ MÚSICA";
    }
  } catch (err) {
    musicBtn.textContent = "♫ ERROR";
    setTimeout(() => musicBtn.textContent = "♫ MÚSICA", 1600);
  }
});

function spawnHeartPop(x, y) {
  const h = document.createElement("div");
  h.className = "heart-pop";
  h.textContent = Math.random() > .5 ? "💛" : "♡";
  h.style.left = x + "px";
  h.style.top = y + "px";
  h.style.fontSize = (14 + Math.random() * 13) + "px";
  document.body.appendChild(h);
  setTimeout(() => h.remove(), 1500);

  const ring = document.createElement("div");
  ring.className = "spark-ring";
  ring.style.left = x + "px";
  ring.style.top = y + "px";
  document.body.appendChild(ring);
  setTimeout(() => ring.remove(), 900);
}


function showGalaxyUI() {
  welcome.classList.add("hide");
  hud.classList.remove("hidden");
  hint.classList.remove("hidden");

  setTimeout(() => hint.classList.add("hidden"), 7000);

  camera.position.set(0, 18, 38);
  controls.target.set(0, 1.4, -2.2);

  focusTween = {
    start: performance.now(),
    duration: 1800,
    fromPos: camera.position.clone(),
    toPos: new THREE.Vector3(0, 12.5, 24.5),
    fromTarget: controls.target.clone(),
    toTarget: new THREE.Vector3(0, 1.2, -1.5),
    onDone: () => { entering = false; }
  };
}

$("#enterGalaxy").addEventListener("click", async () => {
  showGalaxyUI();

  try {
    setupAudioReactive();
    if (audioCtx && audioCtx.state === "suspended") await audioCtx.resume();
    music.volume = 0.72;
    await music.play();
    musicEnabled = true;
    musicBtn.classList.add("on");
    musicBtn.textContent = "♫ SONANDO";
  } catch (err) {
    // If a browser blocks playback, the music button remains available.
    musicEnabled = false;
    musicBtn.classList.remove("on");
    musicBtn.textContent = "♫ MÚSICA";
  }
});

function openMemory(index) {
  const memory = GALAXY_CONFIG.memories[index];
  const sprite = memoryMeshes[index];
  const worldPos = new THREE.Vector3();
  sprite.getWorldPosition(worldPos);

  selected = index;
  controls.autoRotate = false;
  $("#toggleSpin").classList.remove("on");

  $("#memoryImage").src = memory.image;
  $("#memoryImage").alt = memory.title;
  $("#memoryKicker").textContent = memory.kicker;
  $("#memoryTitle").textContent = memory.title;
  $("#memoryText").textContent = memory.text;

  const outward = worldPos.clone();
  outward.y = 0;
  if (outward.lengthSq() < 0.1) outward.set(0,0,1);
  outward.normalize();

  const side = new THREE.Vector3(-outward.z, 0, outward.x);

  const target = worldPos.clone().add(new THREE.Vector3(0, 0.75, 0));
  const cameraPos = worldPos.clone()
    .add(outward.multiplyScalar(5.2))
    .add(side.multiplyScalar(2.2))
    .add(new THREE.Vector3(0, 3.2, 0));

  focusTween = {
    start: performance.now(),
    duration: 1150,
    fromPos: camera.position.clone(),
    toPos: cameraPos,
    fromTarget: controls.target.clone(),
    toTarget: target,
    onDone: () => memoryCard.classList.add("open")
  };
}

function goCenter() {
  selected = null;
  memoryCard.classList.remove("open");

  focusTween = {
    start: performance.now(),
    duration: 1000,
    fromPos: camera.position.clone(),
    toPos: new THREE.Vector3(0, 12.5, 24.5),
    fromTarget: controls.target.clone(),
    toTarget: new THREE.Vector3(0, 1.2, -1.5)
  };
}

$("#centerGalaxy").addEventListener("click", goCenter);
$("#backGalaxy").addEventListener("click", goCenter);
$("#closeMemory").addEventListener("click", goCenter);

$("#toggleSpin").addEventListener("click", () => {
  controls.autoRotate = !controls.autoRotate;
  $("#toggleSpin").classList.toggle("on", controls.autoRotate);
});

/* ---------------------------------------------------------
   RAYCASTING / HOVER
--------------------------------------------------------- */

function setPointer(event) {
  pointer.x = (event.clientX / innerWidth) * 2 - 1;
  pointer.y = -(event.clientY / innerHeight) * 2 + 1;
}

renderer.domElement.addEventListener("pointerdown", (event) => {
  pointerDown = { x: event.clientX, y: event.clientY };
});

renderer.domElement.addEventListener("pointerup", (event) => {
  if (!pointerDown) return;

  const dx = event.clientX - pointerDown.x;
  const dy = event.clientY - pointerDown.y;
  pointerDown = null;

  if (Math.hypot(dx, dy) > 8) return;

  setPointer(event);
  raycaster.setFromCamera(pointer, camera);
  const hits = raycaster.intersectObjects(memoryMeshes, false);

  if (hits.length) {
    spawnHeartPop(event.clientX, event.clientY);
    openMemory(hits[0].object.userData.memoryIndex);
  }
});

renderer.domElement.addEventListener("pointermove", (event) => {
  if (welcome && !welcome.classList.contains("hide")) return;

  setPointer(event);
  raycaster.setFromCamera(pointer, camera);
  const hits = raycaster.intersectObjects(memoryMeshes, false);

  if (hovered !== null) {
    memoryMeshes[hovered].scale.set(2.25, 2.25, 1);
    memoryHalos[hovered].material.opacity = 0.42;
  }

  if (hits.length) {
    hovered = hits[0].object.userData.memoryIndex;
    memoryMeshes[hovered].scale.set(2.55, 2.55, 1);
    memoryHalos[hovered].material.opacity = 0.92;
    renderer.domElement.style.cursor = "pointer";

    tooltip.textContent = GALAXY_CONFIG.memories[hovered].title.toUpperCase();
    tooltip.style.left = event.clientX + "px";
    tooltip.style.top = event.clientY + "px";
    tooltip.classList.add("show");
  } else {
    hovered = null;
    hoverCrown.visible = false;
    renderer.domElement.style.cursor = "grab";
    tooltip.classList.remove("show");
  }
});

/* ---------------------------------------------------------
   CAMERA TWEEN
--------------------------------------------------------- */

function smoothstep(t) {
  return t * t * (3 - 2 * t);
}

function updateTween(now) {
  if (!focusTween) return;

  let t = (now - focusTween.start) / focusTween.duration;
  t = THREE.MathUtils.clamp(t, 0, 1);
  const e = smoothstep(t);

  camera.position.lerpVectors(focusTween.fromPos, focusTween.toPos, e);
  controls.target.lerpVectors(focusTween.fromTarget, focusTween.toTarget, e);

  if (t >= 1) {
    const done = focusTween.onDone;
    focusTween = null;
    if (done) done();
  }
}

/* ---------------------------------------------------------
   RESIZE
--------------------------------------------------------- */

addEventListener("resize", () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  composer.setSize(innerWidth, innerHeight);
});

/* ---------------------------------------------------------
   ANIMATION LOOP
--------------------------------------------------------- */

function animate() {
  const now = performance.now();
  const t = clock.getElapsedTime();

  updateTween(now);

  updateAudioReactive();

  // Slow, alive motion only — never becomes an autoplay video.
  galaxyFloor.rotation.y = Math.sin(t * 0.08) * 0.014;
  vortex.rotation.y = -t * 0.105;
  sunflower.rotation.z = Math.sin(t * 0.42) * 0.025;
  sunflower.position.y = 7.7 + Math.sin(t * 0.52) * 0.12;
  starCloud.rotation.y = t * 0.0025;
  motes.rotation.y = -t * 0.008;

  memoryMeshes.forEach((sprite, i) => {
    const parent = sprite.parent;
    parent.position.y = 1.05 + Math.sin(t * 0.72 + i * 1.4) * 0.12;
    memoryHalos[i].rotation.z = t * 0.10 * (i % 2 ? 1 : -1);
  });

  if (!focusTween) controls.update();
  else controls.update();


  // Floating heart constellation
  heartField.children.forEach((heart) => {
    const d = heart.userData;
    heart.position.y = d.baseY + Math.sin(t * d.speed + d.phase) * 0.42;
    heart.position.x += Math.sin(t * d.drift + d.phase) * 0.0009;
    heart.material.opacity = 0.14 + (Math.sin(t * 0.8 + d.phase) * 0.5 + 0.5) * 0.28;
  });
  heartField.rotation.y = Math.sin(t * 0.07) * 0.08;

  // Soft expanding rings around memories
  pulseRings.forEach((ring, i) => {
    const pulse = (Math.sin(t * 1.1 + ring.userData.phase) * 0.5 + 0.5);
    const scale = 1 + pulse * 0.18;
    ring.scale.setScalar(scale);
    ring.material.opacity = 0.06 + pulse * 0.17;
  });

  // Shooting stars appear occasionally
  shootingStars.children.forEach((line) => {
    const d = line.userData;
    d.timer += 1 / 60;

    if (!d.active && d.timer > d.delay) {
      d.active = true;
      d.timer = 0;
      line.material.opacity = 0.85;
      line.position.set(
        -22 + Math.random() * 34,
        11 + Math.random() * 17,
        -16 + Math.random() * 20
      );
    }

    if (d.active) {
      line.position.x += d.speed * 0.018;
      line.position.y -= d.speed * 0.0045;
      line.material.opacity *= 0.985;

      if (line.material.opacity < 0.03) {
        d.active = false;
        d.timer = 0;
        d.delay = 4 + Math.random() * 8;
        line.material.opacity = 0;
      }
    }
  });


  // ===== MUSIC REACTIVE LAYER =====
  // Bass: breathing of the galaxy and central vortex
  const bassPulse = 1 + reactiveBass * 0.10;
  vortex.scale.setScalar(bassPulse);

  // Keep the floor response much subtler than the vortex
  const floorPulse = 1 + reactiveBass * 0.012;
  galaxyFloor.scale.set(floorPulse, 1, floorPulse);

  // Bloom and warm key light react to low/mid frequencies
  bloom.strength = 1.02 + reactiveBass * 0.72 + reactiveHigh * 0.18;
  key.intensity = 62 + reactiveBass * 26 + reactiveMid * 9;

  // The particle sunflower "breathes" a little with the music
  const flowerPulse = 1.22 + reactiveMid * 0.045;
  sunflower.scale.setScalar(flowerPulse);

  // Hearts brighten more on mid frequencies
  heartField.children.forEach((heart) => {
    if (!heart.userData.baseScale) {
      heart.userData.baseScale = heart.scale.x;
    }
    const hs = heart.userData.baseScale * (1 + reactiveMid * 0.30);
    heart.scale.set(hs, hs, 1);
  });

  // Memory halos pulse on bass
  memoryHalos.forEach((halo, i) => {
    halo.material.opacity = Math.min(
      1,
      0.38 + reactiveBass * 0.45 + (hovered === i ? 0.42 : 0)
    );
  });

  // High frequencies slightly brighten the floating motes
  motes.material.opacity = 0.34 + reactiveHigh * 0.42;



  // Authentic extra layers
  goldenHaze.group.rotation.y = Math.sin(t * 0.05) * 0.08;
  goldenHaze.discs.forEach((disc, i) => {
    disc.material.opacity = [0.11,0.10,0.06,0.055,0.08][i] + reactiveBass * 0.035;
  });

  petalStream.petals.forEach((petal, i) => {
    const d = petal.userData;
    petal.position.x = d.origin.x + Math.sin(t * d.speed + d.phase) * d.sway;
    petal.position.y = d.origin.y + Math.sin(t * (d.speed * 0.6) + d.phase) * 0.28 - reactiveMid * 0.12;
    petal.position.z = d.origin.z + Math.cos(t * d.speed + d.phase) * d.sway * 0.55;
    petal.material.rotation += 0.004 + reactiveHigh * 0.002;
    const ps = d.baseScale * (1 + reactiveHigh * 0.15);
    petal.scale.set(ps, ps * 1.6, 1);
  });

  memoryLinks.forEach((line, i) => {
    line.material.opacity = 0.14 + reactiveBass * 0.10 + (hovered === i ? 0.24 : 0);
    line.material.dashOffset = -t * 0.15;
  });

  centralHeartOrbit.children.forEach((heart, i) => {
    const d = heart.userData;
    const ang = d.angle + t * 0.18 + Math.sin(t * 0.5 + d.phase) * 0.02;
    const radius = d.radius + reactiveMid * 0.18;
    heart.position.set(
      Math.cos(ang) * radius,
      0.44 + Math.sin(t * 1.0 + d.phase) * 0.05,
      Math.sin(ang) * radius * 0.78
    );
    const hs = d.scale * (1 + reactiveMid * 0.25);
    heart.scale.set(hs, hs, 1);
    heart.material.opacity = 0.10 + reactiveMid * 0.22;
  });

  if (hovered !== null) {
    const hoveredPos = memoryMeshes[hovered].parent.position;
    hoverCrown.visible = true;
    hoverCrown.position.set(hoveredPos.x, hoveredPos.y + 2.2, hoveredPos.z);
    hoverCrown.children.forEach((spr, i) => {
      const a = t * 1.9 + spr.userData.offset;
      const r = 0.95 + Math.sin(t * 2.1 + i) * 0.05;
      spr.position.set(Math.cos(a) * r, Math.sin(t * 2.2 + i) * 0.16, Math.sin(a) * r * 0.78);
      spr.material.opacity = 0.24 + (Math.sin(t * 4 + i) * 0.5 + 0.5) * 0.50;
    });
  } else {
    hoverCrown.visible = false;
  }

  memoryBases.forEach((base, i) => {
    base.scale.y = 1 + reactiveBass * 0.08;
    base.material.emissiveIntensity = 0.28 + reactiveBass * 0.22 + (selected === i ? 0.12 : 0);
  });

  if (selected !== null) {
    memoryCard.style.boxShadow =
      "0 35px 110px rgba(0,0,0,.85), 0 0 " + (50 + reactiveMid * 40).toFixed(1) +
      "px rgba(255,196,0,.14), 0 0 " + (85 + reactiveBass * 70).toFixed(1) +
      "px rgba(255,214,63,.08)";
  } else {
    memoryCard.style.boxShadow = "";
  }

  composer.render();
  requestAnimationFrame(animate);
}

animate();
