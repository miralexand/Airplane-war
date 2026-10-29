import * as THREE from '../vendor/three.module.js';
import { getMap, getPlane, getSkin } from '../../shared/catalog.js';
import { audio } from './audio.js';

const TAU = Math.PI * 2;
const UP = new THREE.Vector3(0, 1, 0);
const FORWARD = new THREE.Vector3(0, 0, -1);
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const rand = (min, max) => min + Math.random() * (max - min);
const damp = (current, target, lambda, dt) => current + (target - current) * (1 - Math.exp(-lambda * dt));

const ENEMY_NAMES = ['WRAITH-1', 'WRAITH-2', 'WRAITH-3', 'WRAITH-4', 'REAPER-5', 'REAPER-6'];
const ENEMY_PALETTES = [
  { body: '#5f3b4c', body2: '#3d202e', dark: '#170a12', accent: '#ff4c68', glow: '#ff3559', trail: '#ff7a62', canopy: '#220711' },
  { body: '#5b4b62', body2: '#352b3f', dark: '#130d18', accent: '#ff7758', glow: '#ff9860', trail: '#ffb266', canopy: '#1b0a12' },
  { body: '#4c5060', body2: '#292d3a', dark: '#0f1119', accent: '#ff3d55', glow: '#ff3a6b', trail: '#ff6a6a', canopy: '#16070e' }
];

const MAP_THEMES = {
  blacksky: {
    clear: '#8cb9d5',
    fog: '#add0e6',
    fogDensity: 0.000065,
    sky: {
      top: '#071a35',
      mid: '#4f8fbe',
      bottom: '#e0c8ae',
      sun: '#fff3d4',
      sunDirection: [0.45, 0.38, -0.6]
    },
    hemisphere: ['#dff5ff', '#244158', 2.0],
    sun: ['#ffe1b3', 3.5, 600, 900, -500],
    fill: ['#77bfff', 1.1, -500, 200, 600],
    sunSprite: '#ffe9c4',
    surface: {
      colors: ['#08243b', '#0d3d5e', '#061f35'],
      line: '120,215,238',
      repeat: 80,
      tint: '#78aac2',
      roughness: 0.62,
      metalness: 0.18
    },
    island: {
      beach: '#544f3b',
      rock: ['#315044', '#3c4e3e'],
      cap: '#81968b',
      radius: [110, 340],
      height: [320, 780],
      distance: [1900, 6000]
    },
    cloud: {
      color: '#f3fbff',
      opacities: [0.3, 0.2, 0.13]
    }
  },
  redmesa: {
    clear: '#d9a86c',
    fog: '#e8c49a',
    fogDensity: 0.000058,
    sky: {
      top: '#3f568f',
      mid: '#e3a06a',
      bottom: '#f6dcbf',
      sun: '#fff0cf',
      sunDirection: [-0.4, 0.25, -0.5]
    },
    hemisphere: ['#ffe9cf', '#7a3f2a', 2.35],
    sun: ['#ffd2a0', 3.9, -700, 840, -420],
    fill: ['#ffb27a', 1.25, 520, 280, 700],
    sunSprite: '#ffe2b0',
    surface: {
      colors: ['#8a4b2b', '#c07b45', '#6e3b24'],
      line: '255,226,172',
      repeat: 70,
      tint: '#f0d6b8',
      roughness: 0.94,
      metalness: 0.04
    },
    island: {
      beach: '#8a5a34',
      rock: ['#a44f32', '#8a3f2c'],
      cap: '#d9a06d',
      radius: [160, 430],
      height: [420, 980],
      distance: [1700, 5600]
    },
    cloud: {
      color: '#ffe8c8',
      opacities: [0.22, 0.15, 0.09]
    }
  },
  megacity: {
    clear: '#8d9da5',
    fog: '#b7aa9d',
    fogDensity: 0.000082,
    sky: {
      top: '#08182e',
      mid: '#5f8299',
      bottom: '#e6ad8a',
      sun: '#ffd8a4',
      sunDirection: [0.32, 0.2, -0.72]
    },
    hemisphere: ['#d8edf4', '#3d352f', 2.45],
    sun: ['#ffc78f', 3.8, 620, 760, -480],
    fill: ['#76b6d6', 1.45, -560, 320, 640],
    sunSprite: '#ffd0a0',
    surface: {
      colors: ['#071923', '#0b2b38', '#06141e'],
      line: '103,184,198',
      repeat: 92,
      tint: '#436e7a',
      roughness: 0.4,
      metalness: 0.42
    },
    island: {
      beach: '#3e3d34',
      rock: ['#344338', '#2b3a32'],
      cap: '#61705e',
      radius: [220, 520],
      height: [420, 920],
      distance: [3200, 6400]
    },
    cloud: {
      color: '#d8e3e3',
      opacities: [0.17, 0.11, 0.07]
    },
    city: {
      ground: '#242a29',
      groundLine: '#59675f',
      road: '#393933',
      water: '#0b3340',
      maxHeight: 760,
      blockSize: 220,
      extent: 2320
    }
  }
};

function createCanvasTexture(size, draw) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  draw(ctx, size);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function makeGlowTexture(inner = 'rgba(255,255,255,0.95)', outer = 'rgba(255,255,255,0)') {
  return createCanvasTexture(128, (ctx, size) => {
    const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    gradient.addColorStop(0, inner);
    gradient.addColorStop(0.18, inner);
    gradient.addColorStop(0.45, 'rgba(255,190,110,0.32)');
    gradient.addColorStop(1, outer);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);
  });
}

function makeCloudTexture() {
  return createCanvasTexture(256, (ctx, size) => {
    ctx.clearRect(0, 0, size, size);
    for (let i = 0; i < 18; i += 1) {
      const x = rand(size * 0.18, size * 0.82);
      const y = rand(size * 0.34, size * 0.68);
      const radius = rand(size * 0.1, size * 0.26);
      const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
      gradient.addColorStop(0, `rgba(255,255,255,${rand(0.1, 0.28)})`);
      gradient.addColorStop(0.55, `rgba(226,243,255,${rand(0.045, 0.14)})`);
      gradient.addColorStop(1, 'rgba(210,235,255,0)');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, size, size);
    }
  });
}

function makeSmokeTexture() {
  return createCanvasTexture(128, (ctx, size) => {
    const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    gradient.addColorStop(0, 'rgba(255,255,255,0.65)');
    gradient.addColorStop(0.35, 'rgba(255,255,255,0.3)');
    gradient.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);
  });
}

function makeSurfaceTexture(theme = MAP_THEMES.blacksky) {
  const surface = theme.surface;
  const texture = createCanvasTexture(512, (ctx, size) => {
    const gradient = ctx.createLinearGradient(0, 0, size, size);
    gradient.addColorStop(0, surface.colors[0]);
    gradient.addColorStop(0.5, surface.colors[1]);
    gradient.addColorStop(1, surface.colors[2]);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);
    for (let i = 0; i < 160; i += 1) {
      const y = Math.random() * size;
      const width = rand(20, 160);
      const alpha = rand(0.015, 0.09);
      ctx.beginPath();
      ctx.moveTo(Math.random() * size, y);
      ctx.bezierCurveTo(
        Math.random() * size,
        y + rand(-14, 14),
        Math.random() * size,
        y + rand(-14, 14),
        Math.random() * size + width,
        y + rand(-5, 5)
      );
      ctx.strokeStyle = `rgba(${surface.line}, ${alpha})`;
      ctx.lineWidth = rand(0.4, 1.8);
      ctx.stroke();
    }
  });
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(surface.repeat, surface.repeat);
  texture.anisotropy = 4;
  return texture;
}

function makeWindowTexture(base = '#0b1118', lit = '#ffd58a', accent = '#7fe3ff') {
  const texture = createCanvasTexture(128, (ctx, size) => {
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, size, size);
    for (let y = 5; y < size - 4; y += 10) {
      for (let x = 5; x < size - 4; x += 10) {
        const roll = Math.random();
        if (roll < 0.18) {
          ctx.fillStyle = accent;
        } else if (roll < 0.46) {
          ctx.fillStyle = lit;
        } else {
          ctx.fillStyle = 'rgba(255, 255, 255, 0.035)';
        }
        ctx.globalAlpha = roll < 0.46 ? rand(0.55, 0.95) : 1;
        ctx.fillRect(x, y, 5, 6);
        ctx.globalAlpha = 1;
      }
    }
  });
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.anisotropy = 4;
  return texture;
}

function makeAirlinerWindowTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 96;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = 'rgba(224, 237, 241, 0.22)';
  ctx.fillRect(0, 68, canvas.width, 2);
  ctx.fillStyle = 'rgba(175, 65, 47, 0.78)';
  ctx.fillRect(0, 78, canvas.width, 7);

  for (let x = 58; x < 930; x += 30) {
    ctx.fillStyle = Math.random() < 0.28 ? '#ffd49b' : '#25313a';
    ctx.beginPath();
    ctx.roundRect(x, 31, 15, 13, 6);
    ctx.fill();
    ctx.strokeStyle = 'rgba(244, 249, 248, 0.55)';
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  for (const x of [130, 806]) {
    ctx.strokeStyle = 'rgba(48, 57, 61, 0.72)';
    ctx.lineWidth = 3;
    ctx.strokeRect(x, 14, 32, 56);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function buildAirliner() {
  const group = new THREE.Group();
  const bodyMaterial = new THREE.MeshStandardMaterial({
    color: '#edf1ef',
    metalness: 0.32,
    roughness: 0.35
  });
  const trimMaterial = new THREE.MeshStandardMaterial({
    color: '#9b3f32',
    metalness: 0.4,
    roughness: 0.36
  });
  const goldMaterial = new THREE.MeshStandardMaterial({
    color: '#c9a35d',
    metalness: 0.58,
    roughness: 0.3
  });
  const darkMaterial = new THREE.MeshStandardMaterial({
    color: '#20282c',
    metalness: 0.55,
    roughness: 0.3
  });
  const engineCoreMaterial = new THREE.MeshStandardMaterial({
    color: '#7c8588',
    metalness: 0.82,
    roughness: 0.28
  });
  const glassMaterial = new THREE.MeshStandardMaterial({
    color: '#10212b',
    emissive: new THREE.Color('#6ac8e6'),
    emissiveIntensity: 0.28,
    metalness: 0.82,
    roughness: 0.12
  });

  const profile = [
    [0.05, -25],
    [0.38, -24.4],
    [1.15, -23.2],
    [2.15, -21.3],
    [2.85, -18.5],
    [3.25, -14.5],
    [3.38, -9],
    [3.4, -1],
    [3.38, 8],
    [3.2, 15.5],
    [2.85, 20],
    [2.05, 23],
    [1.1, 24.4],
    [0.25, 24.7]
  ].map(([radius, length]) => new THREE.Vector2(radius, length));
  const fuselage = new THREE.Mesh(new THREE.LatheGeometry(profile, 28), bodyMaterial);
  fuselage.rotation.x = Math.PI / 2;
  group.add(fuselage);

  const belly = new THREE.Mesh(new THREE.SphereGeometry(3.18, 24, 10), bodyMaterial);
  belly.scale.set(0.88, 0.28, 5.6);
  belly.position.set(0, -1.75, 0.5);
  group.add(belly);

  const cabinTexture = makeAirlinerWindowTexture();
  const cabinMaterial = new THREE.MeshBasicMaterial({
    map: cabinTexture,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    toneMapped: false
  });
  for (const side of [-1, 1]) {
    const windows = new THREE.Mesh(new THREE.PlaneGeometry(34, 2.2), cabinMaterial);
    windows.position.set(side * 3.23, 0.28, 1.2);
    windows.rotation.y = side * Math.PI / 2;
    windows.renderOrder = 2;
    group.add(windows);
  }

  const windshield = new THREE.Mesh(new THREE.BoxGeometry(2.75, 0.72, 0.22), glassMaterial);
  windshield.position.set(0, 0.95, -18.12);
  windshield.rotation.x = -0.28;
  group.add(windshield);
  for (const side of [-1, 1]) {
    const sideWindow = new THREE.Mesh(new THREE.BoxGeometry(1.05, 0.62, 0.16), glassMaterial);
    sideWindow.position.set(side * 1.78, 0.9, -17.72);
    sideWindow.rotation.y = side * 0.48;
    sideWindow.rotation.x = -0.22;
    group.add(sideWindow);

    const cockpitFrame = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.76, 0.12), darkMaterial);
    cockpitFrame.position.set(side * 0.58, 0.95, -18.28);
    cockpitFrame.rotation.x = -0.28;
    group.add(cockpitFrame);
  }

  const makeWing = (side) => {
    const points = [
      [2.75, -2.8],
      [15.8, -2.0],
      [27.2, 6.8],
      [27.2, 10.1],
      [2.75, 4.7]
    ].map(([x, z]) => [x * side, z]);
    if (side < 0) points.reverse();
    const wing = makePrism(points, 0.58, bodyMaterial);
    wing.position.y = -0.55;
    group.add(wing);

    const leadingStripePoints = [
      [3.2 * side, -2.35],
      [15.5 * side, -1.55],
      [25.1 * side, 6.65],
      [25.1 * side, 7.55],
      [3.2 * side, -1.45]
    ];
    if (side < 0) leadingStripePoints.reverse();
    const leadingStripe = makePrism(leadingStripePoints, 0.07, goldMaterial);
    leadingStripe.position.y = -0.23;
    group.add(leadingStripe);

    const winglet = new THREE.Mesh(new THREE.BoxGeometry(0.22, 3.15, 3.55), trimMaterial);
    winglet.position.set(side * 27.12, 0.75, 8.55);
    winglet.rotation.x = -0.18;
    group.add(winglet);

    const stabilizerPoints = [
      [1.5, 15.8],
      [10.0, 20.6],
      [10.0, 22.65],
      [1.5, 21.6]
    ].map(([x, z]) => [x * side, z]);
    if (side < 0) stabilizerPoints.reverse();
    const stabilizer = makePrism(stabilizerPoints, 0.26, bodyMaterial);
    stabilizer.position.y = 0.45;
    group.add(stabilizer);
  };
  for (const side of [-1, 1]) makeWing(side);

  const tailFin = makeVerticalFin([
    [13.6, 0],
    [15.8, 10.7],
    [21.3, 10.7],
    [23.5, 0]
  ], 0.62, trimMaterial);
  tailFin.position.y = 1.75;
  group.add(tailFin);
  const tailStripe = makeVerticalFin([
    [17.0, 5.1],
    [17.65, 9.5],
    [20.0, 9.5],
    [20.7, 5.1]
  ], 0.68, goldMaterial);
  tailStripe.position.y = 1.78;
  group.add(tailStripe);

  const dorsal = new THREE.Mesh(new THREE.ConeGeometry(0.5, 7.4, 10), bodyMaterial);
  dorsal.rotation.x = Math.PI / 2;
  dorsal.position.set(0, 2.6, 13.2);
  group.add(dorsal);

  for (const side of [-1, 1]) {
    const engine = new THREE.Group();
    engine.position.set(side * 12.1, -2.15, 1.7);

    const nacelle = new THREE.Mesh(new THREE.CylinderGeometry(2.1, 1.9, 7.4, 22), bodyMaterial);
    nacelle.rotation.x = Math.PI / 2;
    engine.add(nacelle);

    const cowl = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.12, 1.15, 22), trimMaterial);
    cowl.rotation.x = Math.PI / 2;
    cowl.position.z = -3.45;
    engine.add(cowl);

    const intake = new THREE.Mesh(new THREE.CircleGeometry(1.92, 24), darkMaterial);
    intake.position.z = -4.04;
    intake.rotation.y = Math.PI;
    engine.add(intake);

    const fan = new THREE.Group();
    fan.position.z = -4.08;
    for (let blade = 0; blade < 16; blade += 1) {
      const fanBlade = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.55, 0.06), engineCoreMaterial);
      fanBlade.position.set(Math.cos(blade / 16 * TAU) * 0.78, Math.sin(blade / 16 * TAU) * 0.78, 0);
      fanBlade.rotation.z = blade / 16 * TAU;
      fan.add(fanBlade);
    }
    const spinner = new THREE.Mesh(new THREE.ConeGeometry(0.38, 1.0, 14), goldMaterial);
    spinner.rotation.x = -Math.PI / 2;
    spinner.position.set(0, 0, -0.52);
    fan.add(spinner);
    engine.add(fan);

    const nozzle = new THREE.Mesh(new THREE.CylinderGeometry(1.55, 1.84, 1.3, 20), darkMaterial);
    nozzle.rotation.x = Math.PI / 2;
    nozzle.position.z = 4.1;
    engine.add(nozzle);
    group.add(engine);

    const pylon = new THREE.Mesh(new THREE.BoxGeometry(1.45, 1.1, 5.9), bodyMaterial);
    pylon.position.set(side * 9.2, -1.0, 1.45);
    pylon.rotation.z = side * 0.09;
    group.add(pylon);

    const navLight = new THREE.Mesh(
      new THREE.SphereGeometry(0.4, 10, 10),
      new THREE.MeshBasicMaterial({ color: side < 0 ? '#ff4a5f' : '#6dffc4' })
    );
    navLight.position.set(side * 27.25, 0.42, 8.4);
    group.add(navLight);
  }

  const beacons = [];
  for (const [y, z] of [[3.6, 0], [-3.45, 0], [12.4, 20.7]]) {
    const beacon = new THREE.Mesh(
      new THREE.SphereGeometry(0.36, 9, 9),
      new THREE.MeshBasicMaterial({ color: '#ff554e', toneMapped: false })
    );
    beacon.position.set(0, y, z);
    group.add(beacon);
    beacons.push(beacon);
  }

  const tailLight = new THREE.Mesh(
    new THREE.SphereGeometry(0.28, 8, 8),
    new THREE.MeshBasicMaterial({ color: '#fff4d1', toneMapped: false })
  );
  tailLight.position.set(0, 0.15, 24.45);
  group.add(tailLight);

  group.scale.setScalar(1.72);
  return { group, beacons, tailLight };
}

function makeSky(theme = MAP_THEMES.blacksky) {
  const geometry = new THREE.SphereGeometry(9200, 32, 20);
  const material = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      topColor: { value: new THREE.Color(theme.sky.top) },
      midColor: { value: new THREE.Color(theme.sky.mid) },
      bottomColor: { value: new THREE.Color(theme.sky.bottom) },
      sunColor: { value: new THREE.Color(theme.sky.sun) },
      sunDirection: { value: new THREE.Vector3(...theme.sky.sunDirection).normalize() }
    },
    vertexShader: `
      varying vec3 vWorldPosition;
      void main() {
        vec4 worldPosition = modelMatrix * vec4(position, 1.0);
        vWorldPosition = worldPosition.xyz;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 topColor;
      uniform vec3 midColor;
      uniform vec3 bottomColor;
      uniform vec3 sunColor;
      uniform vec3 sunDirection;
      varying vec3 vWorldPosition;
      void main() {
        vec3 direction = normalize(vWorldPosition);
        float height = clamp(direction.y * 1.2, -0.15, 1.0);
        vec3 color = mix(bottomColor, midColor, smoothstep(-0.04, 0.24, height));
        color = mix(color, topColor, smoothstep(0.18, 0.92, height));
        float sun = pow(max(dot(direction, sunDirection), 0.0), 420.0);
        float halo = pow(max(dot(direction, sunDirection), 0.0), 12.0);
        color += sunColor * sun * 2.5 + sunColor * halo * 0.18;
        gl_FragColor = vec4(color, 1.0);
      }
    `
  });
  return new THREE.Mesh(geometry, material);
}

function makePrism(points, thickness, material) {
  const shape = new THREE.Shape();
  shape.moveTo(points[0][0], points[0][1]);
  for (let i = 1; i < points.length; i += 1) shape.lineTo(points[i][0], points[i][1]);
  shape.closePath();
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: thickness,
    bevelEnabled: false,
    steps: 1
  });
  geometry.rotateX(Math.PI / 2);
  geometry.translate(0, thickness / 2, 0);
  return new THREE.Mesh(geometry, material);
}

function makeVerticalFin(points, thickness, material) {
  const shape = new THREE.Shape();
  shape.moveTo(points[0][0], points[0][1]);
  for (let i = 1; i < points.length; i += 1) shape.lineTo(points[i][0], points[i][1]);
  shape.closePath();
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: thickness,
    bevelEnabled: false,
    steps: 1
  });
  geometry.rotateY(-Math.PI / 2);
  geometry.translate(thickness / 2, 0, 0);
  return new THREE.Mesh(geometry, material);
}

function makeRibbon(points, width, y) {
  const curve = new THREE.CatmullRomCurve3(
    points.map(([x, z]) => new THREE.Vector3(x, y, z)),
    false,
    'catmullrom',
    0.32
  );
  const segments = 180;
  const positions = [];
  const uvs = [];
  const indices = [];
  const side = new THREE.Vector3();
  const tangent = new THREE.Vector3();

  for (let i = 0; i <= segments; i += 1) {
    const t = i / segments;
    const point = curve.getPoint(t);
    curve.getTangent(t, tangent);
    tangent.y = 0;
    tangent.normalize();
    side.set(-tangent.z, 0, tangent.x);
    const halfWidth = width * 0.5;
    positions.push(
      point.x - side.x * halfWidth, point.y, point.z - side.z * halfWidth,
      point.x + side.x * halfWidth, point.y, point.z + side.z * halfWidth
    );
    uvs.push(0, t * 10, 1, t * 10);
    if (i < segments) {
      const current = i * 2;
      indices.push(
        current, current + 1, current + 3,
        current, current + 3, current + 2
      );
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return { curve, geometry };
}

function curveEdgeLine(curve, offset, y, color, opacity = 0.75) {
  const points = [];
  const tangent = new THREE.Vector3();
  for (let i = 0; i <= 90; i += 1) {
    const t = i / 90;
    const point = curve.getPoint(t);
    curve.getTangent(t, tangent);
    const x = -tangent.z * offset;
    const z = tangent.x * offset;
    points.push(new THREE.Vector3(point.x + x, y, point.z + z));
  }
  const material = new THREE.LineBasicMaterial({
    color,
    transparent: true,
    opacity,
    depthWrite: false
  });
  return new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), material);
}

function sampleCurve(curve, count = 120) {
  const samples = [];
  for (let i = 0; i <= count; i += 1) {
    const point = curve.getPoint(i / count);
    samples.push({ x: point.x, z: point.z });
  }
  return samples;
}

function distanceToSamples(samples, x, z) {
  let nearestSq = Infinity;
  for (const sample of samples) {
    const dx = x - sample.x;
    const dz = z - sample.z;
    nearestSq = Math.min(nearestSq, dx * dx + dz * dz);
  }
  return Math.sqrt(nearestSq);
}

const WING_SHAPES = {
  falcon: [[0.42, -1.25], [5.0, 1.0], [4.25, 1.95], [0.52, 1.62]],
  viper: [[0.38, -1.62], [5.5, -0.82], [4.7, 1.26], [0.48, 1.62]],
  titan: [[0.55, -0.92], [6.25, 0.64], [5.5, 2.25], [0.7, 1.9]],
  nova: [[0.4, -2.15], [5.9, -1.54], [6.15, 0.76], [0.6, 1.72]],
  bastion: [[0.62, -1.05], [7.1, 0.72], [6.4, 2.45], [0.8, 2.15]]
};

function buildFighter(planeId, palette, enemy = false) {
  const group = new THREE.Group();
  const plane = getPlane(planeId);
  const shapeKey = WING_SHAPES[plane.shape] ? plane.shape : 'falcon';
  const wingPoints = WING_SHAPES[shapeKey];
  const bodyMaterial = new THREE.MeshStandardMaterial({
    color: palette.body,
    metalness: 0.72,
    roughness: 0.32,
    emissive: new THREE.Color(palette.dark),
    emissiveIntensity: 0.18
  });
  const secondaryMaterial = new THREE.MeshStandardMaterial({
    color: palette.body2,
    metalness: 0.68,
    roughness: 0.36,
    emissive: new THREE.Color(palette.dark),
    emissiveIntensity: 0.22
  });
  const darkMaterial = new THREE.MeshStandardMaterial({
    color: palette.dark,
    metalness: 0.82,
    roughness: 0.28
  });
  const accentMaterial = new THREE.MeshStandardMaterial({
    color: palette.accent,
    emissive: new THREE.Color(palette.glow),
    emissiveIntensity: 2.2,
    metalness: 0.35,
    roughness: 0.22
  });
  const glassMaterial = new THREE.MeshStandardMaterial({
    color: palette.canopy,
    emissive: new THREE.Color(palette.accent),
    emissiveIntensity: 0.55,
    metalness: 0.9,
    roughness: 0.12
  });
  const flameMaterial = new THREE.MeshBasicMaterial({
    color: palette.trail,
    transparent: true,
    opacity: 0.82,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });
  const flameOuterMaterial = new THREE.MeshBasicMaterial({
    color: palette.glow,
    transparent: true,
    opacity: 0.24,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide
  });

  const lengthScale = shapeKey === 'viper' ? 1.08 : shapeKey === 'titan' ? 0.94 : shapeKey === 'bastion' ? 0.86 : 1;
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.78, 5.5 * lengthScale, 7), bodyMaterial);
  body.rotation.x = Math.PI / 2;
  body.position.z = 0.15;
  body.scale.set(1, 1, 0.8);
  group.add(body);

  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.56, 3.1 * lengthScale, 6), bodyMaterial);
  nose.rotation.x = -Math.PI / 2;
  nose.position.z = -4.2 * lengthScale;
  group.add(nose);

  const noseAccent = new THREE.Mesh(new THREE.ConeGeometry(0.2, 1.25, 5), accentMaterial);
  noseAccent.rotation.x = -Math.PI / 2;
  noseAccent.position.set(0, 0.04, -5.4 * lengthScale);
  group.add(noseAccent);

  for (const side of [-1, 1]) {
    const wingPointsSide = wingPoints.map(([x, z]) => [x * side, z]);
    if (side < 0) wingPointsSide.reverse();
    const wing = makePrism(wingPointsSide, 0.15, secondaryMaterial);
    wing.position.y = -0.02;
    group.add(wing);

    const wingShine = makePrism(
      wingPointsSide.map(([x, z]) => [x * 0.7, z * 0.92]),
      0.02,
      accentMaterial
    );
    wingShine.position.y = 0.08;
    group.add(wingShine);

    const stabilizer = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.09, 1.0), secondaryMaterial);
    stabilizer.position.set(side * 1.25, 0.04, 2.55);
    stabilizer.rotation.y = side * -0.18;
    group.add(stabilizer);

    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.09, 1.4, 1.2), secondaryMaterial);
    tail.position.set(side * 1.2, 0.66, 2.25);
    tail.rotation.z = side * 0.18;
    group.add(tail);

    const wingLight = new THREE.Mesh(new THREE.SphereGeometry(0.075, 6, 6), new THREE.MeshBasicMaterial({
      color: side < 0 ? '#ff465b' : '#6dffc4'
    }));
    wingLight.position.set(side * (shapeKey === 'bastion' ? 6.35 : shapeKey === 'titan' ? 5.55 : 4.75), 0.06, shapeKey === 'viper' ? -0.45 : 1.15);
    group.add(wingLight);

    const intake = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.38, 1.5), darkMaterial);
    intake.position.set(side * 1.05, -0.28, 0.3);
    group.add(intake);
  }

  const spine = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.22, 3.7), accentMaterial);
  spine.position.set(0, 0.62, 0.7);
  group.add(spine);

  const cockpit = new THREE.Mesh(new THREE.SphereGeometry(0.64, 14, 8), glassMaterial);
  cockpit.scale.set(0.95, 0.62, 2.15);
  cockpit.position.set(0, 0.56, -1.6);
  group.add(cockpit);

  const engines = shapeKey === 'bastion' ? [-2.3, 0, 2.3] : shapeKey === 'titan' ? [-1.55, 1.55] : [-0.38, 0.38];
  const flames = [];
  const flameOuters = [];
  for (const engineX of engines) {
    const nozzle = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.5, 1.5, 8), darkMaterial);
    nozzle.rotation.x = Math.PI / 2;
    nozzle.position.set(engineX, 0.02, 2.95);
    group.add(nozzle);

    const engineCore = new THREE.Mesh(new THREE.CircleGeometry(0.3, 8), accentMaterial);
    engineCore.position.set(engineX, 0.02, 3.71);
    engineCore.rotation.y = Math.PI;
    group.add(engineCore);

    const flame = new THREE.Mesh(new THREE.ConeGeometry(0.28, 2.8, 8), flameMaterial);
    flame.rotation.x = Math.PI / 2;
    flame.position.set(engineX, 0.02, 5.1);
    group.add(flame);
    flames.push(flame);

    const outer = new THREE.Mesh(new THREE.ConeGeometry(0.58, 4.3, 8), flameOuterMaterial);
    outer.rotation.x = Math.PI / 2;
    outer.position.set(engineX, 0.02, 5.8);
    group.add(outer);
    flameOuters.push(outer);
  }

  for (const side of [-1, 1]) {
    const canard = new THREE.Mesh(new THREE.BoxGeometry(1.55, 0.06, 0.62), secondaryMaterial);
    canard.position.set(side * 1.0, 0.14, -2.85);
    canard.rotation.y = side * 0.24;
    group.add(canard);
  }

  if (enemy) {
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.04, 2.2), accentMaterial);
    stripe.position.set(0, 0.78, 0.9);
    group.add(stripe);
  }

  group.scale.setScalar(enemy ? 1.04 : 1);
  return { group, flames, flameOuters, materials: { bodyMaterial, secondaryMaterial, darkMaterial, accentMaterial, glassMaterial } };
}

function buildMissile(team = 'player') {
  const group = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({
    color: team === 'player' ? '#cfdae2' : '#4b3942',
    metalness: 0.7,
    roughness: 0.32
  });
  const accentMat = new THREE.MeshBasicMaterial({
    color: team === 'player' ? '#ffbc63' : '#ff4f66',
    transparent: true,
    opacity: 0.9,
    blending: THREE.AdditiveBlending
  });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.2, 2.2, 6), bodyMat);
  body.rotation.x = Math.PI / 2;
  group.add(body);
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.6, 6), bodyMat);
  nose.rotation.x = -Math.PI / 2;
  nose.position.z = -1.38;
  group.add(nose);
  for (let i = 0; i < 4; i += 1) {
    const fin = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.035, 0.34), bodyMat);
    fin.rotation.z = (i / 4) * TAU;
    fin.position.z = 0.8;
    group.add(fin);
  }
  const flame = new THREE.Mesh(new THREE.ConeGeometry(0.16, 1.4, 6), accentMat);
  flame.rotation.x = Math.PI / 2;
  flame.position.z = 1.9;
  group.add(flame);
  const light = new THREE.Sprite(new THREE.SpriteMaterial({
    map: makeGlowTexture(),
    color: team === 'player' ? '#ffca70' : '#ff5a78',
    transparent: true,
    opacity: 0.8,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  }));
  light.scale.set(2.2, 2.2, 1);
  light.position.z = 1.7;
  group.add(light);
  return group;
}

function quaternionFromForward(forward, up = UP, target = new THREE.Quaternion()) {
  const zAxis = forward.clone().multiplyScalar(-1).normalize();
  let xAxis = new THREE.Vector3().crossVectors(up, zAxis);
  if (xAxis.lengthSq() < 0.00001) xAxis = new THREE.Vector3(1, 0, 0);
  xAxis.normalize();
  const yAxis = new THREE.Vector3().crossVectors(zAxis, xAxis).normalize();
  const matrix = new THREE.Matrix4().makeBasis(xAxis, yAxis, zAxis);
  return target.setFromRotationMatrix(matrix);
}

export class Mission3D {
  constructor(options) {
    this.canvas = options.canvas;
    this.callbacks = options.callbacks || {};
    this.planeId = getPlane(options.plane).id;
    this.skinId = getSkin(options.skin).id;
    this.mapId = getMap(options.map).id;
    this.mapInfo = getMap(options.map);
    this.mapTheme = MAP_THEMES[this.mapId] || MAP_THEMES.blacksky;
    this.plane = getPlane(this.planeId);
    this.skin = getSkin(this.skinId);
    const loadout = this.plane.loadout || {};
    this.maxHp = loadout.hp || 120;
    this.cannonDamage = loadout.cannonDamage ?? loadout.damage ?? 6;
    this.cannonAmmoMax = loadout.ammo || 220;
    this.cannonAmmo = this.cannonAmmoMax;
    this.cannonDelay = Math.max(0.075, loadout.fireDelay || 0.135);
    this.ultimate = this.plane.ultimate || {
      id: 'storm',
      name: '苍穹风暴',
      short: '风暴',
      cooldown: 48,
      desc: '同时锁定多个目标，齐射高伤追踪导弹。'
    };
    this.ultimateCooldownMax = Math.max(20, Number(this.ultimate.cooldown) || 48);
    this.ultimateCooldown = 0;
    this.ultimateActive = 0;
    this.ultimateShield = 0;
    this.singularity = null;
    const stats = this.plane.stats || {};
    this.agilityScale = 0.62 + (stats.handling || 3) * 0.11;
    this.flightSpeed = 136 * (0.78 + (stats.speed || 3) * 0.06);
    this.boostSpeed = 100 + (stats.speed || 3) * 4;
    this.network = options.network || null;
    this.networkRole = this.network?.role || null;
    this.networkMode = this.network?.mode || null;
    this.isNetworkHost = this.networkRole === 'host';
    this.isNetworkGuest = this.networkRole === 'guest';
    this.isPvp = this.networkMode === 'pvp';
    this.networkPlayers = Array.isArray(this.network?.players) ? this.network.players : [];
    this.selfSlot = Number.isFinite(Number(this.network?.slot))
      ? Number(this.network.slot)
      : (this.isNetworkHost ? 0 : 1);
    const otherProfiles = this.networkPlayers.filter((player) => Number(player.slot) !== this.selfSlot);
    this.opponentProfile = this.network?.opponent || otherProfiles[0] || {
      name: 'WINGMAN',
      plane: 'falcon',
      skin: 'chrome'
    };
    this.state = 'briefing';
    this.paused = false;
    this.destroyed = false;
    this.timeLimit = this.isPvp ? 300 : 180;
    this.requiredKills = this.isPvp ? 0 : 6;
    this.kills = 0;
    this.score = 0;
    this.timeLeft = this.timeLimit;
    this.elapsed = 0;
    this.reserveEnemies = 2;
    this.reserveThresholds = [2, 4];
    this.enemies = [];
    this.playerMissiles = [];
    this.enemyMissiles = [];
    this.flares = [];
    this.effects = [];
    this.tracers = [];
    this.removalQueue = [];
    this.lockTarget = null;
    this.lockProgress = 0;
    this.locked = false;
    this.lockWasInReticle = false;
    this.lockBeepAccumulator = 0;
    this.warningBeepTimer = 0;
    this.hitMarkerTime = 0;
    this.cannonTimer = 0;
    this.missileCooldown = 0;
    this.flareCooldown = 0;
    this.flaresLeft = 3;
    this.missilesLeft = 6;
    this.boost = 100;
    this.boostActive = false;
    this.shotsFired = 0;
    this.cannonHits = 0;
    this.missileHits = 0;
    this.ammoEmptyWarned = false;
    this.gForce = 1;
    this.stall = false;
    this.stallWarning = false;
    this.stallWarnTimer = 0;
    this.terrainWarned = false;
    this.mountainColliders = [];
    this.cityColliders = [];
    this.airliners = [];
    this.airlinerTimer = 0;
    this.airlinersWarned = false;
    this.nextAirlinerId = 1;
    this.nextEnemyId = 1;
    this.networkStateClock = 0;
    this.snapshotClock = 0;
    this.remotePlayers = new Map();
    this.pvpState = {
      ended: false
    };
    this.pitch = 0;
    this.yaw = 0;
    this.roll = 0;
    this.yawRate = 0;
    this.pitchRate = 0;
    this.rollRate = 0;
    this.stick = { x: 0, y: 0 };
    this.stickTarget = { x: 0, y: 0 };
    this.keys = new Set();
    this.mobileCannon = false;
    this.mobileBoost = false;
    this.dragging = false;
    this.pointerId = null;
    this.dragOrigin = { x: 0, y: 0 };
    this.cameraShake = 0;
    this.damageFlash = 0;
    this.missionEndTimer = null;
    this.hudClock = 0;
    this.lastTime = performance.now();
    this.cloudTime = 0;
    this.cloudImmersion = 0;
    this._tmpA = new THREE.Vector3();
    this._tmpB = new THREE.Vector3();
    this._tmpC = new THREE.Vector3();
    this._tmpQ = new THREE.Quaternion();
    this._cameraAimMatrix = new THREE.Matrix4();
    this._ray = new THREE.Ray();
    this._hud = {};
    this._activeMessage = null;

    this.initRenderer();
    this.initScene();
    this.initPlayer();
    this.initNetworkRemote();
    this.bindEvents();
    this.resize();
    this.lastTime = performance.now();
    this.loop = this.loop.bind(this);
    this.raf = requestAnimationFrame(this.loop);
    this.state = 'briefing';
  }

  initRenderer() {
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance'
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 3));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = this.mapId === 'redmesa' ? 1.18 : 1.12;
    this.renderer.setClearColor(this.mapTheme.clear, 1);
    this.camera = new THREE.PerspectiveCamera(60, 1, 0.4, 12000);
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(this.mapTheme.fog, this.mapTheme.fogDensity);
  }

  initScene() {
    const theme = this.mapTheme;
    this.scene.add(makeSky(theme));
    const hemisphere = new THREE.HemisphereLight(theme.hemisphere[0], theme.hemisphere[1], theme.hemisphere[2]);
    this.scene.add(hemisphere);
    const sun = new THREE.DirectionalLight(theme.sun[0], theme.sun[1]);
    sun.position.set(theme.sun[2], theme.sun[3], theme.sun[4]);
    this.scene.add(sun);
    const fill = new THREE.DirectionalLight(theme.fill[0], theme.fill[1]);
    fill.position.set(theme.fill[2], theme.fill[3], theme.fill[4]);
    this.scene.add(fill);

    const sunSprite = new THREE.Sprite(new THREE.SpriteMaterial({
      map: makeGlowTexture('rgba(255,255,255,0.95)', 'rgba(255,194,121,0)'),
      color: theme.sunSprite,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      fog: false
    }));
    sunSprite.position.set(2200, 2100, -3300);
    sunSprite.scale.set(650, 650, 1);
    this.scene.add(sunSprite);

    this.oceanTexture = makeSurfaceTexture(theme);
    this.ocean = new THREE.Mesh(
      new THREE.PlaneGeometry(22000, 22000),
      new THREE.MeshStandardMaterial({
        map: this.oceanTexture,
        color: theme.surface.tint,
        roughness: theme.surface.roughness,
        metalness: theme.surface.metalness
      })
    );
    this.ocean.rotation.x = -Math.PI / 2;
    this.ocean.position.y = -8;
    this.scene.add(this.ocean);

    this.islands = [];
    this.mountainColliders = [];
    this.cityColliders = [];
    if (this.mapId === 'megacity') {
      this.buildCity();
    } else {
      for (let i = 0; i < 14; i += 1) {
        const angle = rand(0, TAU);
        const distance = rand(theme.island.distance[0], theme.island.distance[1]);
        const radius = rand(theme.island.radius[0], theme.island.radius[1]);
        const height = rand(theme.island.height[0], theme.island.height[1]);
        const island = new THREE.Group();
        const beach = new THREE.Mesh(
          new THREE.CylinderGeometry(radius * 1.35, radius * 1.55, 8, 7),
          new THREE.MeshStandardMaterial({ color: theme.island.beach, roughness: 0.92 })
        );
        beach.position.y = 0;
        island.add(beach);
        const mountain = new THREE.Mesh(
          new THREE.ConeGeometry(radius, height, 6),
          new THREE.MeshStandardMaterial({
            color: theme.island.rock[i % theme.island.rock.length],
            roughness: 0.94,
            flatShading: true
          })
        );
        mountain.position.y = height / 2 + 4;
        island.add(mountain);
        if (this.mapId === 'redmesa' && i % 3 === 0) {
          const spire = new THREE.Mesh(
            new THREE.ConeGeometry(radius * 0.32, height * 0.55, 5),
            new THREE.MeshStandardMaterial({ color: theme.island.rock[(i + 1) % theme.island.rock.length], roughness: 0.96, flatShading: true })
          );
          spire.position.set(radius * 0.55, height * 0.52, -radius * 0.2);
          island.add(spire);
        }
        const cap = new THREE.Mesh(
          new THREE.ConeGeometry(radius * 0.25, height * 0.28, 6),
          new THREE.MeshStandardMaterial({ color: theme.island.cap, roughness: 0.8, flatShading: true })
        );
        cap.position.y = height * 0.88;
        island.add(cap);
        island.position.set(Math.cos(angle) * distance, 0, Math.sin(angle) * distance);
        island.rotation.y = rand(0, TAU);
        this.scene.add(island);
        this.islands.push(island);
        this.mountainColliders.push({
          x: island.position.x,
          z: island.position.z,
          radius,
          outerRadius: radius * 1.55,
          height: height * 1.04,
          baseY: 4
        });
      }
    }

    this.cloudTexture = makeCloudTexture();
    this.cloudMaterials = theme.cloud.opacities.map((opacity) => new THREE.SpriteMaterial({
      map: this.cloudTexture,
      color: theme.cloud.color,
      transparent: true,
      opacity,
      depthWrite: false,
      fog: true
    }));
    this.clouds = [];
    this.cloudVolumes = [];
    const addCloudVolume = (x, y, z, radius) => {
      const group = new THREE.Group();
      group.position.set(x, y, z);
      this.scene.add(group);
      const volume = { group, radius };
      const count = 3 + Math.floor(rand(0, 3));
      for (let j = 0; j < count; j += 1) {
        const sprite = new THREE.Sprite(this.cloudMaterials[Math.floor(rand(0, this.cloudMaterials.length))]);
        const angle = rand(0, TAU);
        const spread = Math.sqrt(Math.random()) * radius * 0.62;
        sprite.position.set(
          Math.cos(angle) * spread,
          rand(-radius * 0.18, radius * 0.18),
          Math.sin(angle) * spread
        );
        const scale = radius * rand(1.7, 2.7);
        sprite.scale.set(scale, scale * rand(0.32, 0.54), 1);
        group.add(sprite);
      }
      this.clouds.push(group);
      this.cloudVolumes.push(volume);
    };
    addCloudVolume(240, 360, -760, 165);
    addCloudVolume(-760, 520, -1680, 195);
    addCloudVolume(980, 300, -2450, 175);
    for (let i = 0; i < 21; i += 1) {
      const angle = rand(0, TAU);
      const distance = rand(500, 5200);
      addCloudVolume(
        Math.cos(angle) * distance,
        rand(100, 1450),
        Math.sin(angle) * distance,
        rand(110, 230)
      );
    }

    this.effectTextures = {
      glow: makeGlowTexture(),
      smoke: makeSmokeTexture(),
      spark: makeGlowTexture('rgba(255,255,255,0.95)', 'rgba(255,255,255,0)')
    };
  }

  buildCity() {
    const city = this.mapTheme.city || {};
    const groundMaterial = new THREE.MeshStandardMaterial({
      color: city.ground || '#242a29',
      roughness: 0.96,
      metalness: 0.04
    });
    const ground = new THREE.Mesh(
      new THREE.BoxGeometry(6400, 12, 6400),
      groundMaterial
    );
    ground.position.y = -2;
    this.scene.add(ground);

    const grid = new THREE.GridHelper(6200, 62, city.groundLine || '#59675f', city.groundLine || '#59675f');
    grid.position.y = 4.4;
    grid.material.transparent = true;
    grid.material.opacity = 0.11;
    this.scene.add(grid);

    const riverMaterial = new THREE.MeshStandardMaterial({
      color: city.water || '#0b3340',
      emissive: new THREE.Color('#0b3040'),
      emissiveIntensity: 0.38,
      roughness: 0.2,
      metalness: 0.62,
      transparent: true,
      opacity: 0.93
    });
    const riverPaths = [
      {
        width: 190,
        points: [
          [-3200, 1080], [-2380, 900], [-1680, 660], [-980, 520],
          [-120, 430], [760, 520], [1560, 780], [2320, 1180], [3200, 1440]
        ]
      },
      {
        width: 138,
        points: [
          [-2920, -1850], [-2260, -1450], [-1660, -1090], [-1110, -720],
          [-680, -300], [-290, 140], [-90, 425]
        ]
      }
    ];
    const riverSamples = [];
    for (const river of riverPaths) {
      const { curve, geometry } = makeRibbon(river.points, river.width, 9.5);
      const water = new THREE.Mesh(geometry, riverMaterial);
      water.receiveShadow = false;
      this.scene.add(water);
      this.scene.add(curveEdgeLine(curve, river.width * 0.49, 11, '#c2a36b', 0.86));
      this.scene.add(curveEdgeLine(curve, river.width * 0.53, 11.5, '#182325', 0.95));
      this.scene.add(curveEdgeLine(curve, -river.width * 0.49, 11, '#c2a36b', 0.86));
      this.scene.add(curveEdgeLine(curve, -river.width * 0.53, 11.5, '#182325', 0.95));
      riverSamples.push({
        width: river.width,
        samples: sampleCurve(curve, 180)
      });
    }

    const roadMaterial = new THREE.MeshStandardMaterial({
      color: city.road || '#393933',
      roughness: 0.9,
      metalness: 0.08
    });
    const roadPaths = [
      [[-2760, -420], [-2060, -230], [-1350, 0], [-650, 170], [80, 120], [930, -80], [1830, -250], [2850, -180]],
      [[-2260, 1320], [-1670, 1060], [-960, 820], [-170, 690], [760, 820], [1690, 1000], [2740, 1110]],
      [[-1830, -2120], [-1370, -1590], [-940, -1010], [-690, -410], [-620, 210], [-850, 890], [-1200, 1570]],
      [[730, -2220], [760, -1560], [770, -880], [760, -200], [860, 430], [1080, 1030], [1450, 1660]],
      Array.from({ length: 49 }, (_, index) => {
        const angle = index / 48 * TAU;
        return [Math.cos(angle) * 820, Math.sin(angle) * 820];
      })
    ];
    const roadSamples = [];
    for (const points of roadPaths) {
      const { curve, geometry } = makeRibbon(points, 34, 7);
      this.scene.add(new THREE.Mesh(geometry, roadMaterial));
      this.scene.add(curveEdgeLine(curve, 0, 8.2, '#e2b868', 0.64));
      roadSamples.push(sampleCurve(curve, 100));
    }

    const windowTextures = [
      makeWindowTexture('#171c1d', '#ffc66f', '#8bded8'),
      makeWindowTexture('#201c1a', '#ffb160', '#ffd59a'),
      makeWindowTexture('#151d23', '#e9f2e7', '#79c8ce')
    ];
    const roofMaterial = new THREE.MeshStandardMaterial({
      color: '#2b302d',
      roughness: 0.82,
      metalness: 0.14
    });
    const sideMaterials = windowTextures.map((texture, index) => new THREE.MeshStandardMaterial({
      map: texture,
      emissiveMap: texture,
      emissive: new THREE.Color(index === 1 ? '#ffad5d' : index === 2 ? '#8bd8d1' : '#ffd28a'),
      emissiveIntensity: index === 1 ? 0.58 : 0.42,
      roughness: 0.68,
      metalness: 0.24
    }));
    const residentialMaterial = new THREE.MeshStandardMaterial({
      color: '#8d877b',
      emissive: new THREE.Color('#2d2118'),
      emissiveIntensity: 0.16,
      roughness: 0.82,
      metalness: 0.08
    });
    const crownMaterial = new THREE.MeshStandardMaterial({
      color: '#2b3c3e',
      emissive: new THREE.Color('#54aeb7'),
      emissiveIntensity: 0.28,
      roughness: 0.45,
      metalness: 0.54
    });
    const warmLightMaterial = new THREE.MeshBasicMaterial({
      color: '#ffd18a',
      toneMapped: false
    });

    const blockSize = Number(city.blockSize) || 300;
    const extent = Number(city.extent) || 2350;
    const maxHeight = Number(city.maxHeight) || 720;
    const elevationAt = (x, z) => (
      6
      + Math.max(0, Math.sin(x * 0.0017 + z * 0.0011) * 13)
      + Math.max(0, Math.cos(z * 0.0022 - x * 0.0007) * 10)
      + Math.max(0, Math.sin((x + z) * 0.00085) * 8)
    );
    const cityCore = (x, z, cx, cz, radius) => Math.exp(
      -((x - cx) ** 2 + (z - cz) ** 2) / (radius * radius)
    );
    const addTower = (x, z, width, depth, height, baseY, material) => {
      const lowerHeight = height > 360 ? height * 0.76 : height;
      const lower = new THREE.Mesh(
        new THREE.BoxGeometry(width, lowerHeight, depth),
        [material, material, roofMaterial, roofMaterial, material, material]
      );
      lower.position.set(x, baseY + lowerHeight / 2, z);
      this.scene.add(lower);

      if (height > 360) {
        const crownHeight = height - lowerHeight;
        const crownWidth = width * rand(0.62, 0.8);
        const crownDepth = depth * rand(0.62, 0.8);
        const crown = new THREE.Mesh(
          new THREE.BoxGeometry(crownWidth, crownHeight, crownDepth),
          [crownMaterial, crownMaterial, roofMaterial, roofMaterial, crownMaterial, crownMaterial]
        );
        crown.position.set(x, baseY + lowerHeight + crownHeight / 2, z);
        this.scene.add(crown);

        if (height > 520) {
          const crownCap = new THREE.Mesh(
            new THREE.BoxGeometry(crownWidth * 1.12, 5, crownDepth * 1.12),
            new THREE.MeshStandardMaterial({
              color: '#b79c70',
              emissive: new THREE.Color('#b27a3e'),
              emissiveIntensity: 0.72,
              roughness: 0.34,
              metalness: 0.58
            })
          );
          crownCap.position.set(x, baseY + height + 2.5, z);
          this.scene.add(crownCap);
        }
      }

      if (height > 470) {
        const beacon = new THREE.Mesh(new THREE.SphereGeometry(2.2, 8, 8), warmLightMaterial);
        beacon.position.set(x, baseY + height + 8, z);
        this.scene.add(beacon);
      }
      if (height > 300 && Math.random() < 0.42) {
        const antenna = new THREE.Mesh(
          new THREE.CylinderGeometry(0.8, 1.15, rand(18, 44), 6),
          new THREE.MeshStandardMaterial({ color: '#9da7a5', roughness: 0.46, metalness: 0.68 })
        );
        antenna.position.set(x, baseY + height + antenna.geometry.parameters.height / 2, z);
        this.scene.add(antenna);
      }

      this.cityColliders.push({
        x,
        z,
        halfX: width / 2,
        halfZ: depth / 2,
        top: baseY + height
      });
    };

    for (let gx = -extent; gx <= extent; gx += blockSize) {
      for (let gz = -extent; gz <= extent; gz += blockSize) {
        if (Math.random() < 0.12) continue;
        const count = Math.random() < 0.52 ? 2 : 1;
        for (let k = 0; k < count; k += 1) {
          const width = rand(28, 78);
          const depth = rand(28, 78);
          const x = gx + rand(-blockSize * 0.27, blockSize * 0.27);
          const z = gz + rand(-blockSize * 0.27, blockSize * 0.27);
          const radialDistance = Math.hypot(x, z);
          if (radialDistance < 285) continue;
          if (Math.abs(radialDistance - 820) < 125) continue;
          if (Math.hypot(x, z - 1150) < 170) continue;
          if (riverSamples.some((river) => (
            distanceToSamples(river.samples, x, z) < river.width * 0.5 + 34 + Math.max(width, depth) * 0.5
          ))) continue;
          if (roadSamples.some((samples) => distanceToSamples(samples, x, z) < 30 + Math.max(width, depth) * 0.5)) continue;

          const core = Math.max(
            cityCore(x, z, 760, 220, 730),
            cityCore(x, z, -980, -520, 660) * 0.86,
            cityCore(x, z, 1280, 920, 480) * 0.65
          );
          const hillside = 0.72 + Math.abs(Math.sin(x * 0.0013 + z * 0.0008)) * 0.46;
          let height = (rand(48, 138) + core * rand(170, 520)) * hillside;
          if (Math.random() < 0.075) height *= 1.3;
          height = clamp(height, 44, maxHeight);
          const baseY = elevationAt(x, z);
          const useResidential = height < 205 && Math.random() < 0.44;
          const material = useResidential
            ? residentialMaterial
            : sideMaterials[Math.floor(Math.random() * sideMaterials.length)];
          addTower(x, z, width, depth, height, baseY, material);

          if (!useResidential && height < 250 && Math.random() < 0.28) {
            const roofUnit = new THREE.Mesh(
              new THREE.BoxGeometry(width * 0.48, rand(12, 25), depth * 0.48),
              roofMaterial
            );
            roofUnit.position.set(x + rand(-width * 0.2, width * 0.2), baseY + height + roofUnit.geometry.parameters.height / 2, z);
            this.scene.add(roofUnit);
          }
        }
      }
    }

    this.buildCityBridge(820, 500, 0, 1, 430, 34, 22);
    this.buildCityBridge(-1320, 610, 0.1, 1, 350, 28, 21);
    this.buildCityBridge(-760, -470, 1, 0.2, 330, 24, 23);
    this.buildCityMonorail();

    const ridgeColors = ['#34483a', '#3b4c3e', '#2d4037'];
    for (let i = 0; i < 16; i += 1) {
      const angle = (i / 16) * TAU + rand(-0.1, 0.1);
      const distance = rand(3150, 4450);
      this.buildMountainCluster(
        Math.cos(angle) * distance,
        Math.sin(angle) * distance,
        rand(440, 850),
        rand(390, 900),
        ridgeColors[i % ridgeColors.length],
        i
      );
    }
  }

  buildCityBridge(x, z, axisX, axisZ, length, width, deckY) {
    const group = new THREE.Group();
    group.position.set(x, deckY, z);
    const axisLength = Math.hypot(axisX, axisZ) || 1;
    group.rotation.y = Math.atan2(-axisZ / axisLength, axisX / axisLength);
    const concrete = new THREE.MeshStandardMaterial({
      color: '#4b4d48',
      roughness: 0.78,
      metalness: 0.18
    });
    const steel = new THREE.MeshStandardMaterial({
      color: '#acb1ac',
      roughness: 0.32,
      metalness: 0.76
    });
    const deck = new THREE.Mesh(new THREE.BoxGeometry(length, 3.6, width), concrete);
    group.add(deck);
    const railMaterial = new THREE.MeshBasicMaterial({
      color: '#efc374',
      transparent: true,
      opacity: 0.9,
      toneMapped: false
    });
    for (const side of [-1, 1]) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(length, 0.32, 0.35), railMaterial);
      rail.position.set(0, 2.2, side * width * 0.47);
      group.add(rail);
    }

    const towerOffset = length * 0.2;
    const cablePoints = [];
    for (const side of [-1, 1]) {
      const pylon = new THREE.Mesh(new THREE.BoxGeometry(7.5, 78, 7.5), steel);
      pylon.position.set(side * towerOffset, 38, 0);
      group.add(pylon);
      const cap = new THREE.Mesh(new THREE.BoxGeometry(12, 4, 12), concrete);
      cap.position.set(side * towerOffset, 79, 0);
      group.add(cap);

      for (const direction of [-1, 1]) {
        for (let cable = 1; cable <= 7; cable += 1) {
          const span = cable * length * 0.046;
          for (const zSide of [-1, 1]) {
            cablePoints.push(
              side * towerOffset, 73, 0,
              side * towerOffset + direction * span, 1.8, zSide * width * 0.4
            );
          }
        }
      }
    }
    const cables = new THREE.LineSegments(
      new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(cablePoints, 3)),
      new THREE.LineBasicMaterial({ color: '#d6d8d1', transparent: true, opacity: 0.72 })
    );
    group.add(cables);
    this.scene.add(group);
  }

  buildCityMonorail() {
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-2350, 68, -520),
      new THREE.Vector3(-1760, 72, -180),
      new THREE.Vector3(-1080, 76, 150),
      new THREE.Vector3(-340, 72, 225),
      new THREE.Vector3(410, 68, 330),
      new THREE.Vector3(1120, 74, 590),
      new THREE.Vector3(1880, 78, 980)
    ], false, 'catmullrom', 0.35);
    const beamMaterial = new THREE.MeshStandardMaterial({
      color: '#777b75',
      roughness: 0.66,
      metalness: 0.28
    });
    const beam = new THREE.Mesh(new THREE.TubeGeometry(curve, 150, 2.4, 6, false), beamMaterial);
    this.scene.add(beam);
    const guide = new THREE.Mesh(
      new THREE.TubeGeometry(curve, 150, 0.34, 4, false),
      new THREE.MeshBasicMaterial({ color: '#e8c47f', toneMapped: false })
    );
    guide.position.y = 2.3;
    this.scene.add(guide);

    const supportMaterial = new THREE.MeshStandardMaterial({
      color: '#555b56',
      roughness: 0.82,
      metalness: 0.16
    });
    for (let i = 1; i < 24; i += 1) {
      const point = curve.getPoint(i / 24);
      const support = new THREE.Mesh(new THREE.CylinderGeometry(3.4, 4.6, point.y - 4, 6), supportMaterial);
      support.position.set(point.x, (point.y + 4) / 2, point.z);
      this.scene.add(support);
    }

    const trainMaterial = new THREE.MeshStandardMaterial({
      color: '#d9ddd3',
      emissive: new THREE.Color('#2f6870'),
      emissiveIntensity: 0.25,
      roughness: 0.34,
      metalness: 0.52
    });
    const windowMaterial = new THREE.MeshBasicMaterial({ color: '#8ce5e2', toneMapped: false });
    for (let car = 0; car < 3; car += 1) {
      const t = 0.46 - car * 0.027;
      const point = curve.getPoint(t);
      const tangent = curve.getTangent(t);
      const train = new THREE.Group();
      const body = new THREE.Mesh(new THREE.BoxGeometry(3.4, 4.8, 17), trainMaterial);
      train.add(body);
      for (const side of [-1, 1]) {
        const windows = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.35, 13.2), windowMaterial);
        windows.position.set(side * 1.74, 0.9, 0);
        train.add(windows);
      }
      train.position.copy(point).add(new THREE.Vector3(0, 5, 0));
      train.quaternion.copy(quaternionFromForward(tangent));
      this.scene.add(train);
    }
  }

  buildMountainCluster(x, z, radius, height, color, seed) {
    const group = new THREE.Group();
    group.position.set(x, 0, z);
    const material = new THREE.MeshStandardMaterial({
      color,
      roughness: 0.96,
      metalness: 0.02,
      flatShading: true
    });
    for (let peak = 0; peak < 4; peak += 1) {
      const peakRadius = radius * (peak === 0 ? 1 : rand(0.38, 0.62));
      const peakHeight = height * (peak === 0 ? 1 : rand(0.42, 0.72));
      const geometry = new THREE.ConeGeometry(peakRadius, peakHeight, 11, 4);
      const position = geometry.attributes.position;
      for (let i = 0; i < position.count; i += 1) {
        const px = position.getX(i);
        const py = position.getY(i);
        const pz = position.getZ(i);
        const noise = Math.sin(px * 0.019 + pz * 0.013 + seed) * 0.09;
        position.setX(i, px * (1 + noise));
        position.setZ(i, pz * (1 - noise * 0.6));
        if (py < peakHeight * 0.42) position.setY(i, py + Math.sin(px * 0.012 + pz * 0.01) * 11);
      }
      geometry.computeVertexNormals();
      const peakMesh = new THREE.Mesh(geometry, material);
      const angle = peak === 0 ? 0 : rand(0, TAU);
      peakMesh.position.set(
        peak === 0 ? 0 : Math.cos(angle) * radius * 0.42,
        peakHeight / 2,
        peak === 0 ? 0 : Math.sin(angle) * radius * 0.42
      );
      group.add(peakMesh);
    }
    this.scene.add(group);
    this.mountainColliders.push({
      x,
      z,
      radius: radius * 0.53,
      outerRadius: radius * 0.92,
      height: height * 0.93,
      baseY: 4
    });
  }

  initPlayer() {
    this.playerGroup = new THREE.Group();
    const model = buildFighter(this.planeId, this.skin.palette, false);
    this.playerModel = model.group;
    this.playerFlames = model.flames;
    this.playerOuterFlames = model.flameOuters;
    this.playerGroup.add(this.playerModel);
    this.shieldMesh = new THREE.Mesh(
      new THREE.SphereGeometry(10.5, 20, 14),
      new THREE.MeshBasicMaterial({
        color: '#c6dcc0',
        transparent: true,
        opacity: 0.2,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      })
    );
    this.shieldMesh.visible = false;
    this.playerGroup.add(this.shieldMesh);
    this.scene.add(this.playerGroup);

    this.player = {
      position: new THREE.Vector3(0, 330, 0),
      velocity: new THREE.Vector3(0, 0, -120),
      quaternion: new THREE.Quaternion(),
      speed: this.flightSpeed,
      hp: this.maxHp,
      maxHp: this.maxHp,
      radius: this.plane.loadout?.radius || 8,
      alive: true,
      invuln: 0
    };
    this.playerGroup.position.copy(this.player.position);
    this.playerGroup.quaternion.copy(this.player.quaternion);
  }

  initNetworkRemote() {
    if (!this.network) return;
    const profiles = this.networkPlayers.length
      ? this.networkPlayers.filter((player) => Number(player.slot) !== this.selfSlot)
      : [{ ...this.opponentProfile, slot: this.selfSlot === 0 ? 1 : 0 }];
    for (const profile of profiles) {
      const slot = Number(profile.slot);
      if (this.remotePlayers.has(slot)) continue;
      const remotePlane = getPlane(profile.plane);
      const remoteSkin = getSkin(profile.skin);
      const model = buildFighter(remotePlane.id, remoteSkin.palette, this.isPvp);
      const group = new THREE.Group();
      group.add(model.group);
      group.visible = false;
      this.scene.add(group);
      const remote = {
        group,
        model: model.group,
        flames: model.flames,
        position: group.position,
        quaternion: group.quaternion,
        targetPosition: new THREE.Vector3(0, 330, -500),
        targetQuaternion: new THREE.Quaternion(),
        hp: Number(profile.hp) || Number(remotePlane.loadout?.hp) || 120,
        maxHp: Number(profile.maxHp) || Number(remotePlane.loadout?.hp) || 120,
        radius: remotePlane.loadout?.radius || 8,
        name: profile.name || 'PILOT',
        slot,
        planeId: remotePlane.id,
        networkTarget: this.isPvp,
        isPvpTarget: this.isPvp,
        isNetworkPlayer: true,
        alive: profile.alive !== false,
        dead: profile.alive === false,
        damageFlash: 0,
        bank: 0
      };
      this.remotePlayers.set(slot, remote);
      this.enemies.push(remote);
    }
  }

  addNetworkFx(fx) {
    if (!fx?.start || !fx?.end) return;
    const start = new THREE.Vector3(Number(fx.start[0]) || 0, Number(fx.start[1]) || 0, Number(fx.start[2]) || 0);
    const end = new THREE.Vector3(Number(fx.end[0]) || 0, Number(fx.end[1]) || 0, Number(fx.end[2]) || 0);
    this.addTracer(start, end, fx.color || '#ffbc75', 0.12, 5);
  }

  setRemotePlayerState(state) {
    const slot = Number(state?.slot);
    const remote = this.remotePlayers.get(slot);
    if (!remote || remote.dead) return;
    remote.targetPosition.set(
      Number(state.x) || 0,
      Number(state.y) || 0,
      Number(state.z) || 0
    );
    remote.targetQuaternion.set(
      Number(state.qx) || 0,
      Number(state.qy) || 0,
      Number(state.qz) || 0,
      Number.isFinite(Number(state.qw)) ? Number(state.qw) : 1
    ).normalize();
    remote.group.visible = true;
    remote.hasState = true;
    if (this.isPvp) remote.alive = true;
  }

  updateRemoteVisual(dt) {
    const smooth = 1 - Math.exp(-13 * dt);
    for (const remote of this.remotePlayers.values()) {
      if (remote.dead) {
        remote.group.visible = false;
        continue;
      }
      remote.group.position.lerp(remote.targetPosition, smooth);
      remote.group.quaternion.slerp(remote.targetQuaternion, smooth);
      for (const flame of remote.flames || []) {
        flame.scale.set(1, 0.78 + Math.sin(this.elapsed * 25 + remote.slot) * 0.1, 1);
      }
      remote.damageFlash = Math.max(0, remote.damageFlash - dt * 4);
    }
  }

  aliveRemoteCount() {
    let count = 0;
    for (const remote of this.remotePlayers.values()) {
      if (!remote.dead) count += 1;
    }
    return count;
  }

  removeNetworkPlayer(slot) {
    const remote = this.remotePlayers.get(Number(slot));
    if (!remote) return;
    remote.dead = true;
    remote.alive = false;
    remote.group.visible = false;
    this.scene.remove(remote.group);
    this.disposeGroup(remote.group);
    this.enemies = this.enemies.filter((enemy) => enemy !== remote);
    if (this.lockTarget === remote) {
      this.lockTarget = null;
      this.lockProgress = 0;
      this.locked = false;
    }
  }

  emitNetworkState() {
    if (!this.network) return;
    this.callbacks.onNetworkState?.({
      slot: this.selfSlot,
      x: this.player.position.x,
      y: this.player.position.y,
      z: this.player.position.z,
      qx: this.player.quaternion.x,
      qy: this.player.quaternion.y,
      qz: this.player.quaternion.z,
      qw: this.player.quaternion.w,
      speed: this.player.speed
    });
  }

  emitNetworkSnapshot() {
    if (!this.isNetworkHost || this.isPvp) return;
    const snapshot = {
      mode: this.networkMode,
      timeLeft: this.timeLeft,
      kills: this.kills,
      required: this.requiredKills,
      score: this.score,
      enemies: this.enemies
        .filter((enemy) => enemy.alive && !enemy.isNetworkPlayer)
        .map((enemy) => ({
          id: enemy.networkId,
          planeId: enemy.planeId || 'falcon',
          variant: enemy.variant || 0,
          name: enemy.name,
          x: enemy.position.x,
          y: enemy.position.y,
          z: enemy.position.z,
          qx: enemy.quaternion.x,
          qy: enemy.quaternion.y,
          qz: enemy.quaternion.z,
          qw: enemy.quaternion.w,
          hp: enemy.hp,
          maxHp: enemy.maxHp
        }))
    };
    this.callbacks.onNetworkSnapshot?.(snapshot);
  }

  applyNetworkSnapshot(snapshot) {
    if (!this.isNetworkGuest || !snapshot || this.isPvp) return;
    if (typeof snapshot.timeLeft === 'number') this.timeLeft = snapshot.timeLeft;
    if (typeof snapshot.kills === 'number') this.kills = snapshot.kills;
    if (typeof snapshot.score === 'number') this.score = snapshot.score;
    this.applyNetworkEnemies(snapshot.enemies || []);
    this.emitHud(true);
  }

  createNetworkEnemy(data) {
    const variant = Number(data.variant) || 0;
    const palette = ENEMY_PALETTES[variant % ENEMY_PALETTES.length];
    const model = buildFighter(data.planeId || 'falcon', palette, true);
    const group = new THREE.Group();
    group.add(model.group);
    const hitGlow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: this.effectTextures.glow,
      color: '#ff566c',
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    }));
    hitGlow.scale.set(22, 22, 1);
    group.add(hitGlow);
    group.position.set(Number(data.x) || 0, Number(data.y) || 0, Number(data.z) || 0);
    group.quaternion.set(
      Number(data.qx) || 0,
      Number(data.qy) || 0,
      Number(data.qz) || 0,
      Number.isFinite(Number(data.qw)) ? Number(data.qw) : 1
    ).normalize();
    this.scene.add(group);
    const enemy = {
      id: data.id,
      networkId: data.id,
      planeId: data.planeId || 'falcon',
      variant,
      group,
      model: model.group,
      flames: model.flames,
      hitGlow,
      position: group.position,
      quaternion: group.quaternion,
      forward: new THREE.Vector3(0, 0, -1),
      velocity: new THREE.Vector3(),
      speed: 0,
      hp: Number(data.hp) || 0,
      maxHp: Number(data.maxHp) || 36,
      radius: 8,
      name: data.name || 'UNKNOWN',
      alive: true,
      isSnapshotEnemy: true,
      netTargetPosition: new THREE.Vector3(Number(data.x) || 0, Number(data.y) || 0, Number(data.z) || 0),
      netTargetQuaternion: group.quaternion.clone(),
      damageFlash: 0,
      bank: 0,
      turnBias: 1,
      phase: rand(0, TAU),
      lockProgress: 0
    };
    this.enemies.push(enemy);
    return enemy;
  }

  applyNetworkEnemies(enemiesData) {
    const remaining = new Set(enemiesData.map((item) => item.id));
    for (const enemy of [...this.enemies]) {
      if (enemy.isNetworkPlayer || !enemy.isSnapshotEnemy) continue;
      if (remaining.has(enemy.networkId)) continue;
      this.spawnExplosion(enemy.position.clone(), 1.8);
      this.scene.remove(enemy.group);
      this.disposeGroup(enemy.group);
      this.enemies = this.enemies.filter((item) => item !== enemy);
      if (this.lockTarget === enemy) {
        this.lockTarget = null;
        this.lockProgress = 0;
        this.locked = false;
      }
      this.callbacks.onEvent?.({ type: 'kill', text: `${enemy.name} 击落`, score: 0 });
    }
    for (const data of enemiesData) {
      let enemy = this.enemies.find((item) => item.isSnapshotEnemy && item.networkId === data.id);
      if (!enemy) enemy = this.createNetworkEnemy(data);
      enemy.hp = Number(data.hp) || 0;
      enemy.maxHp = Number(data.maxHp) || enemy.maxHp;
      enemy.name = data.name || enemy.name;
      enemy.netTargetPosition.set(Number(data.x) || 0, Number(data.y) || 0, Number(data.z) || 0);
      enemy.netTargetQuaternion.set(
        Number(data.qx) || 0,
        Number(data.qy) || 0,
        Number(data.qz) || 0,
        Number.isFinite(Number(data.qw)) ? Number(data.qw) : 1
      ).normalize();
    }
  }

  updateNetworkEnemies(dt) {
    const smooth = 1 - Math.exp(-12 * dt);
    for (const enemy of this.enemies) {
      if (!enemy.isSnapshotEnemy) continue;
      enemy.position.lerp(enemy.netTargetPosition, smooth);
      enemy.quaternion.slerp(enemy.netTargetQuaternion, smooth);
      enemy.group.position.copy(enemy.position);
      enemy.group.quaternion.copy(enemy.quaternion);
      enemy.damageFlash = Math.max(0, enemy.damageFlash - dt * 4);
      if (enemy.hitGlow) enemy.hitGlow.material.opacity = enemy.damageFlash * 0.55;
      for (const flame of enemy.flames) {
        flame.scale.set(1, 0.72 + Math.sin(this.elapsed * 20 + enemy.phase) * 0.1, 1);
      }
    }
  }

  applyNetworkEnemyHit(id, damage) {
    if (!this.isNetworkHost || !this.isCoopMode) return;
    const enemy = this.enemies.find((item) => item.networkId === id);
    if (!enemy || !enemy.alive) return;
    enemy.hp = Math.max(0, enemy.hp - damage);
    enemy.damageFlash = 1;
    if (enemy.hp <= 0) this.killEnemy(enemy);
  }

  applyNetworkPvpHit(payload) {
    if (!this.isPvp || this.pvpState.ended) return;
    const targetSlot = Number(payload?.targetSlot);
    const hp = Math.max(0, Number(payload?.hp) || 0);
    if (targetSlot === this.selfSlot) {
      if (hp < this.player.hp) {
        this.player.damageFlash = 1;
        this.cameraShake = Math.max(this.cameraShake, 8);
        this.callbacks.onEvent?.({ type: 'damage', source: 'PVP' });
      }
      this.player.hp = hp;
      this.player.alive = hp > 0;
      this.emitHud(true);
      return;
    }
    const remote = this.remotePlayers.get(targetSlot);
    if (!remote || remote.dead) return;
    remote.hp = hp;
    remote.damageFlash = 1;
  }

  applyNetworkPvPDeath(payload) {
    if (!this.isPvp) return;
    const targetSlot = Number(payload?.targetSlot);
    const bySlot = Number(payload?.bySlot);
    if (targetSlot === this.selfSlot) {
      this.endPvp(false);
      return;
    }
    const remote = this.remotePlayers.get(targetSlot);
    if (!remote || remote.dead) return;
    remote.dead = true;
    remote.alive = false;
    remote.group.visible = false;
    this.spawnExplosion(remote.position.clone(), 2.2);
    this.enemies = this.enemies.filter((enemy) => enemy !== remote);
    if (this.lockTarget === remote) {
      this.lockTarget = null;
      this.lockProgress = 0;
      this.locked = false;
    }
    if (bySlot === this.selfSlot) {
      this.kills += 1;
      const gained = 1500;
      this.score += gained;
      this.callbacks.onEvent?.({ type: 'kill', text: `${remote.name} 击落`, score: gained });
    }
    if (this.aliveRemoteCount() === 0 && this.player.alive) {
      this.endPvp(true);
    }
  }

  applyLocalPvpHit(target, damage) {
    if (!this.isPvp || this.pvpState.ended || !target?.isPvpTarget) return;
    const amount = Math.max(1, Math.round(damage));
    target.hp = Math.max(0, target.hp - amount);
    target.damageFlash = 1;
    this.callbacks.onNetworkPvpHit?.({ targetSlot: target.slot, damage: amount });
  }

  endPvp(success) {
    if (this.pvpState.ended) return;
    this.pvpState.ended = true;
    this.endMission(success, 'pvp');
  }

  get isCoopMode() {
    return this.networkMode === 'coop';
  }

  bindEvents() {
    this.onPointerDown = this.onPointerDown.bind(this);
    this.onPointerMove = this.onPointerMove.bind(this);
    this.onPointerUp = this.onPointerUp.bind(this);
    this.onKeyDown = this.onKeyDown.bind(this);
    this.onKeyUp = this.onKeyUp.bind(this);
    this.onResize = this.resize.bind(this);
    this.canvas.addEventListener('pointerdown', this.onPointerDown);
    this.canvas.addEventListener('pointermove', this.onPointerMove);
    this.canvas.addEventListener('pointerup', this.onPointerUp);
    this.canvas.addEventListener('pointercancel', this.onPointerUp);
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('resize', this.onResize);
  }

  onPointerDown(event) {
    if (this.state !== 'playing' || this.paused) return;
    audio.init();
    this.dragging = true;
    this.pointerId = event.pointerId;
    this.dragOrigin.x = event.clientX;
    this.dragOrigin.y = event.clientY;
    this.stickTarget.x = 0;
    this.stickTarget.y = 0;
    this.canvas.setPointerCapture?.(event.pointerId);
    event.preventDefault();
  }

  onPointerMove(event) {
    if (!this.dragging || this.state !== 'playing' || this.paused) return;
    const radius = Math.max(110, Math.min(window.innerWidth, window.innerHeight) * 0.17);
    this.stickTarget.x = clamp((event.clientX - this.dragOrigin.x) / radius, -1, 1);
    this.stickTarget.y = clamp(-(event.clientY - this.dragOrigin.y) / radius, -1, 1);
    event.preventDefault();
  }

  onPointerUp(event) {
    if (this.pointerId != null && event.pointerId !== this.pointerId) return;
    this.dragging = false;
    this.pointerId = null;
    this.stickTarget.x = 0;
    this.stickTarget.y = 0;
  }

  onKeyDown(event) {
    if (this.state !== 'playing' || this.paused) return;
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyQ', 'KeyE', 'KeyF', 'KeyC', 'KeyR'].includes(event.code)) {
      event.preventDefault();
    }
    this.keys.add(event.code);
    if (event.code === 'Escape') {
      this.callbacks.onPauseRequest?.();
      return;
    }
    if (event.repeat) return;
    if (event.code === 'KeyF') this.launchPlayerMissile();
    if (event.code === 'KeyC') this.deployFlares();
    if (event.code === 'KeyR') this.triggerUltimate();
  }

  onKeyUp(event) {
    this.keys.delete(event.code);
  }

  start() {
    this.state = 'playing';
    this.paused = false;
    this.timeLeft = this.timeLimit;
    this.elapsed = 0;
    this.kills = 0;
    this.score = 0;
    this.reserveEnemies = 2;
    this.missilesLeft = 8;
    this.flaresLeft = 5;
    this.boost = 100;
    this.cannonAmmo = this.cannonAmmoMax;
    this.ultimateCooldown = 0;
    this.ultimateActive = 0;
    this.ultimateShield = 0;
    this.removeSingularity();
    if (this.shieldMesh) this.shieldMesh.visible = false;
    this.player.hp = this.maxHp;
    this.player.maxHp = this.maxHp;
    this.player.alive = true;
    this.player.invuln = 0;
    const spawnAltitude = this.mapId === 'megacity' ? 620 : 330;
    this.player.position.set(0, spawnAltitude, this.mapId === 'megacity' ? 1150 : 0);
    this.player.velocity.set(0, 0, -this.flightSpeed);
    this.player.speed = this.flightSpeed;
    this.player.quaternion.identity();
    this.playerModel.visible = true;
    this.groundWarned = false;
    this.boundaryWarned = false;
    this.stall = false;
    this.stallWarning = false;
    this.stallWarnTimer = 0;
    this.terrainWarned = false;
    this.lockBeepAccumulator = 0;
    this.warningBeepTimer = 0;
    this.hitMarkerTime = 0;
    this._hud = {};
    this.pitch = 0;
    this.yaw = 0;
    this.roll = 0;
    this.pitchRate = 0;
    this.yawRate = 0;
    this.rollRate = 0;
    this.stick.x = 0;
    this.stick.y = 0;
    this.stickTarget.x = 0;
    this.stickTarget.y = 0;
    if (this.isPvp) {
      const total = Math.max(2, this.networkPlayers.length || this.remotePlayers.size + 1);
      const radius = 820;
      const selfAngle = (this.selfSlot / total) * TAU;
      this.player.position.set(Math.sin(selfAngle) * radius, spawnAltitude, -Math.cos(selfAngle) * radius);
      const spawnDir = new THREE.Vector3(-this.player.position.x, 0, -this.player.position.z).normalize();
      this.player.velocity.copy(spawnDir).multiplyScalar(this.flightSpeed);
      this.yaw = Math.PI - selfAngle;
      for (const remote of this.remotePlayers.values()) {
        const angle = (remote.slot / total) * TAU;
        remote.targetPosition.set(Math.sin(angle) * radius, spawnAltitude, -Math.cos(angle) * radius);
        remote.group.position.copy(remote.targetPosition);
        const dir = new THREE.Vector3(-remote.targetPosition.x, 0, -remote.targetPosition.z).normalize();
        const q = quaternionFromForward(dir);
        remote.targetQuaternion.copy(q);
        remote.group.quaternion.copy(q);
      }
    }
    this.lockTarget = null;
    this.lockProgress = 0;
    this.locked = false;
    this.cloudImmersion = 0;
    this.cannonTimer = 0;
    this.missileCooldown = 0;
    this.flareCooldown = 0;
    this.shotsFired = 0;
    this.cannonHits = 0;
    this.missileHits = 0;
    this.networkStateClock = 0;
    this.snapshotClock = 0;
    this.ammoEmptyWarned = false;
    this.pvpState = { ended: false };
    this.clearEntities();
    this.airlinerTimer = 3.5;
    this.airlinersWarned = false;
    this.enemies = [];
    if (this.isPvp) {
      for (const remote of this.remotePlayers.values()) {
        remote.dead = false;
        remote.alive = true;
        remote.hp = remote.maxHp;
        remote.damageFlash = 0;
        remote.group.visible = true;
        if (!this.enemies.includes(remote)) this.enemies.push(remote);
      }
    } else if (!this.isNetworkGuest) {
      this.spawnInitialEnemies();
    }
    this.playerGroup.position.copy(this.player.position);
    this.playerGroup.quaternion.identity();
    this.lastTime = performance.now();
    audio.stopAmbience();
    audio.startFlightEngine();
    this.emitHud(true);
    this.callbacks.onEvent?.({
      type: 'message',
      kicker: this.network ? (this.isPvp ? 'DOGFIGHT START' : 'FORMATION LINKED') : 'MISSION START',
      text: this.isPvp ? '击落对手' : 'ENGAGE',
      tone: 'info'
    });
    if (this.isNetworkHost) this.emitNetworkSnapshot();
  }

  pause() {
    if (this.state !== 'playing') return;
    this.paused = true;
    this.stickTarget.x = 0;
    this.stickTarget.y = 0;
    this.dragging = false;
    this.keys.clear();
    audio.setFlightEngine(0.12, false);
  }

  resume() {
    if (this.state !== 'playing') return;
    this.paused = false;
    this.lastTime = performance.now();
  }

  setStick(x, y) {
    if (this.state !== 'playing' || this.paused) return;
    this.stickTarget.x = clamp(x, -1, 1);
    this.stickTarget.y = clamp(y, -1, 1);
  }

  setAction(action, pressed) {
    if (action === 'cannon') this.mobileCannon = Boolean(pressed);
    if (action === 'boost') this.mobileBoost = Boolean(pressed);
    if (!pressed) return;
    if (action === 'missile') this.launchPlayerMissile();
    if (action === 'flare') this.deployFlares();
    if (action === 'ultimate') this.triggerUltimate();
  }

  refreshAudio() {
    if (!audio.enabled) {
      audio.stopFlightEngine();
    } else if (this.state === 'playing' && !this.paused) {
      audio.startFlightEngine();
    }
  }

  clearEntities() {
    for (const enemy of this.enemies) {
      if (enemy.isNetworkPlayer) continue;
      this.scene.remove(enemy.group);
      this.disposeGroup(enemy.group);
    }
    this.enemies = [];
    for (const missile of [...this.playerMissiles, ...this.enemyMissiles]) {
      this.scene.remove(missile.group);
      this.disposeGroup(missile.group);
    }
    this.playerMissiles = [];
    this.enemyMissiles = [];
    for (const flare of this.flares) {
      this.scene.remove(flare.sprite);
      flare.sprite.material.dispose?.();
    }
    this.flares = [];
    for (const plane of this.airliners) {
      this.scene.remove(plane.group);
      this.disposeGroup(plane.group);
    }
    this.airliners = [];
    for (const effect of this.effects) {
      this.scene.remove(effect.sprite);
      effect.sprite.material.dispose?.();
    }
    this.effects = [];
    this.removeSingularity();
    for (const tracer of this.tracers) {
      this.scene.remove(tracer.line);
      tracer.line.geometry.dispose();
      tracer.line.material.dispose();
    }
    this.tracers = [];
  }

  spawnInitialEnemies() {
    const positions = [
      [-520, 380, -2050],
      [640, 450, -2500],
      [-1100, 300, -2950],
      [1280, 560, -3250]
    ];
    positions.forEach((pos, index) => this.spawnEnemy(new THREE.Vector3(...pos), index));
  }

  spawnReinforcement() {
    const angle = rand(-0.75, 0.75);
    const distance = rand(1900, 2800);
    const forward = this.getPlayerForward();
    const right = new THREE.Vector3().crossVectors(forward, UP).normalize();
    const position = this.player.position.clone()
      .add(forward.clone().multiplyScalar(-distance))
      .add(right.clone().multiplyScalar(Math.tan(angle) * distance))
      .add(new THREE.Vector3(0, rand(-80, 220), 0));
    position.y = clamp(position.y, 150, 800);
    this.spawnEnemy(position, this.enemies.length + this.kills);
    this.callbacks.onEvent?.({ type: 'message', kicker: 'NEW CONTACT', text: '敌方增援抵达', tone: 'warning' });
  }

  spawnAirliner() {
    if (this.mapId !== 'megacity') return;
    const altitude = rand(760, 1080);
    let start;
    let end;
    if (!this.airlinersWarned) {
      const forward = this.getPlayerForward();
      forward.y = 0;
      forward.normalize();
      const right = new THREE.Vector3(-forward.z, 0, forward.x);
      const routeCenter = this.player.position.clone()
        .addScaledVector(forward, 930)
        .add(new THREE.Vector3(0, 190, 0));
      const routeHalf = rand(1250, 1550);
      start = routeCenter.clone().addScaledVector(right, -routeHalf);
      end = routeCenter.clone().addScaledVector(right, routeHalf);
    } else {
      const startAngle = rand(0, TAU);
      const routeRadius = rand(1650, 2800);
      start = new THREE.Vector3(Math.cos(startAngle) * routeRadius, altitude, Math.sin(startAngle) * routeRadius);
      const endAngle = startAngle + Math.PI + rand(-0.55, 0.55);
      end = new THREE.Vector3(Math.cos(endAngle) * routeRadius, altitude + rand(-70, 70), Math.sin(endAngle) * routeRadius);
    }
    const direction = end.clone().sub(start).normalize();
    const model = buildAirliner();
    model.group.position.copy(start);
    model.group.quaternion.copy(quaternionFromForward(direction));
    this.scene.add(model.group);
    this.airliners.push({
      id: this.nextAirlinerId++,
      group: model.group,
      beacons: model.beacons,
      tailLight: model.tailLight,
      position: model.group.position,
      velocity: direction.multiplyScalar(rand(140, 185)),
      age: 0,
      blink: rand(0, 1),
      collisionRadius: 62
    });
    if (!this.airlinersWarned) {
      this.airlinersWarned = true;
      this.message('CIVILIAN TRAFFIC', '民航航线穿越空域 · 注意避让', 'info');
    }
  }

  updateAirliners(dt) {
    if (this.mapId !== 'megacity' || this.state !== 'playing' || this.paused) return;
    this.airlinerTimer -= dt;
    if (this.airlinerTimer <= 0) {
      if (this.airliners.length < 4) this.spawnAirliner();
      this.airlinerTimer = rand(20, 32);
    }
    for (let i = this.airliners.length - 1; i >= 0; i -= 1) {
      const plane = this.airliners[i];
      plane.age += dt;
      plane.position.addScaledVector(plane.velocity, dt);
      plane.blink += dt;
      const beaconOn = Math.sin(plane.blink * 6.5) > 0;
      for (const beacon of plane.beacons || []) beacon.visible = beaconOn;
      if (plane.tailLight) plane.tailLight.visible = Math.sin(plane.blink * 3.2 + 1.4) > -0.35;
      if (this.player.alive && plane.position.distanceTo(this.player.position) < plane.collisionRadius) {
        this.crashPlayer('airliner');
        return;
      }
      if (plane.position.length() > 5900 || plane.age > 80) {
        this.scene.remove(plane.group);
        this.disposeGroup(plane.group);
        this.airliners.splice(i, 1);
      }
    }
  }

  spawnEnemy(position, index) {
    if (this.mapId === 'megacity') position.y = Math.max(position.y, 640);
    const palette = ENEMY_PALETTES[index % ENEMY_PALETTES.length];
    const enemyId = ['viper', 'falcon', 'titan'][index % 3];
    const model = buildFighter(enemyId, palette, true);
    const group = new THREE.Group();
    group.add(model.group);
    const hitGlow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: this.effectTextures.glow,
      color: '#ff566c',
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    }));
    hitGlow.scale.set(22, 22, 1);
    group.add(hitGlow);
    group.position.copy(position);
    this.scene.add(group);

    const toPlayer = this.player.position.clone().sub(position).normalize();
    const quaternion = quaternionFromForward(toPlayer);
    group.quaternion.copy(quaternion);

    const enemy = {
      id: `e${this.nextEnemyId++}`,
      networkId: `e${this.nextEnemyId - 1}`,
      planeId: enemyId,
      variant: index % ENEMY_PALETTES.length,
      group,
      model: model.group,
      flames: model.flames,
      hitGlow,
      position: group.position,
      quaternion: group.quaternion,
      forward: new THREE.Vector3(0, 0, -1),
      velocity: toPlayer.clone().multiplyScalar(rand(65, 90)),
      speed: rand(72, 95),
      hp: 36,
      maxHp: 36,
      radius: 8,
      name: ENEMY_NAMES[(index + this.kills) % ENEMY_NAMES.length],
      alive: true,
      role: index % 2 === 0 ? 'chaser' : 'interceptor',
      turnBias: index % 2 === 0 ? 1 : -1,
      phase: rand(0, TAU),
      turnRate: rand(0.65, 0.92),
      fireCooldown: rand(0.8, 2.4),
      burstShots: 0,
      burstTimer: 0,
      missileCooldown: rand(12, 20),
      lockProgress: 0,
      damageFlash: 0,
      smokeTimer: 0,
      bank: 0,
      index
    };
    group.rotation.z = 0;
    this.enemies.push(enemy);
    return enemy;
  }

  getPlayerForward() {
    return FORWARD.clone().applyQuaternion(this.player.quaternion).normalize();
  }

  updatePlayer(dt) {
    const player = this.player;
    if (!player.alive) return;

    this.stick.x = damp(this.stick.x, this.stickTarget.x, 9, dt);
    this.stick.y = damp(this.stick.y, this.stickTarget.y, 9, dt);

    let yawInput = this.stick.x;
    let pitchInput = this.stick.y;
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) yawInput -= 1;
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) yawInput += 1;
    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) pitchInput += 1;
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) pitchInput -= 1;
    yawInput = clamp(yawInput, -1, 1);
    pitchInput = clamp(pitchInput, -1, 1);

    let manualRoll = 0;
    if (this.keys.has('KeyQ')) manualRoll -= 1;
    if (this.keys.has('KeyE')) manualRoll += 1;

    const altitude = player.position.y;
    const thinAir = clamp((altitude - 1250) / 450, 0, 1);
    const warningNow = altitude > 1380;
    const stallNow = altitude > 1620;
    if (stallNow && !this.stall) {
      this.stall = true;
      this.cameraShake = Math.max(this.cameraShake, 14);
      this.message('STALL', '失速 · 推杆下降恢复速度', 'danger');
      audio.warningBeep(true);
    } else if (this.stall && altitude < 1500) {
      this.stall = false;
      this.message('STALL RECOVERED', '失速已改出', 'success');
      audio.lockedBeep();
    }
    if (warningNow && !this.stallWarning && !this.stall) {
      this.message('STALL WARNING', '空气稀薄 · 降低高度', 'warning');
    }
    this.stallWarning = warningNow && !this.stall;
    this.stallWarnTimer = Math.max(0, this.stallWarnTimer - dt);
    if ((this.stallWarning || this.stall) && this.stallWarnTimer <= 0) {
      this.stallWarnTimer = this.stall ? 0.9 : 0.65;
      audio.warningBeep(true);
    }

    const authority = this.stall ? 0.28 : 1 - thinAir * 0.45;
    this.yawRate = -yawInput * 1.38 * this.agilityScale * authority;
    this.pitchRate = pitchInput * 1.52 * this.agilityScale * authority;
    this.rollRate = damp(this.rollRate, (-yawInput * 0.86 + manualRoll * 0.7) * this.agilityScale, 10, dt);

    this.yaw += this.yawRate * dt;
    this.pitch = clamp(this.pitch + this.pitchRate * dt, -1.32, 1.32);
    if (this.stall) this.pitch = damp(this.pitch, -0.55, 2.4, dt);
    this.roll = damp(this.roll, -yawInput * 0.78 + manualRoll * 0.6, 8, dt);

    const qYaw = new THREE.Quaternion().setFromAxisAngle(UP, this.yaw);
    const qPitch = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), this.pitch);
    const qRoll = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), this.roll);
    player.quaternion.copy(qYaw).multiply(qPitch).multiply(qRoll);

    const forward = FORWARD.clone().applyQuaternion(player.quaternion);
    const boostPressed = this.mobileBoost || this.keys.has('ShiftLeft') || this.keys.has('ShiftRight');
    if (boostPressed && this.boost > 0.5) {
      this.boost = Math.max(0, this.boost - dt * 24);
      this.boostActive = true;
    } else {
      this.boost = Math.min(100, this.boost + dt * 14);
      this.boostActive = false;
    }
    const densityFactor = this.stall ? 0.48 : 1 - thinAir * 0.45;
    const targetSpeed = (this.flightSpeed + (this.boostActive ? this.boostSpeed : 0) + (this.ultimateActive > 0 ? 240 : 0)) * densityFactor;
    player.speed = damp(player.speed, targetSpeed, this.boostActive ? 2.8 : 1.8, dt);
    const targetVelocity = forward.multiplyScalar(player.speed);
    player.velocity.lerp(targetVelocity, 1 - Math.exp(-2.8 * dt));
    player.position.addScaledVector(player.velocity, dt);

    if (player.position.y < 120) {
      if (!this.groundWarned) {
        this.groundWarned = true;
        this.message('PULL UP', '地形接近 · 撞地会坠机', 'warning');
        this.cameraShake = Math.max(this.cameraShake, 5);
      }
    } else if (player.position.y > 180) {
      this.groundWarned = false;
    }
    if (player.position.y <= 16) {
      this.crashPlayer('ground');
      return;
    }
    if (player.position.y > 2050) {
      player.position.y = 2050;
      player.velocity.y = Math.min(0, player.velocity.y);
    }
    if (this.checkTerrainCollision()) return;

    const horizontalDistance = Math.hypot(player.position.x, player.position.z);
    if (horizontalDistance > 5200) {
      const inward = new THREE.Vector3(-player.position.x, 0, -player.position.z).normalize();
      player.velocity.addScaledVector(inward, 80 * dt);
      if (!this.boundaryWarned) {
        this.boundaryWarned = true;
        this.message('RETURN TO AO', '正在离开任务空域', 'warning');
      }
    } else if (horizontalDistance < 4700) {
      this.boundaryWarned = false;
    }

    this.updateCloudImmersion();
    const maneuver = Math.abs(this.yawRate) + Math.abs(this.pitchRate);
    this.gForce = damp(this.gForce, 1 + maneuver * 2.7, 5, dt);
    player.invuln = Math.max(0, player.invuln - dt);
    if (this.ultimateActive > 0) {
      this.ultimateActive = Math.max(0, this.ultimateActive - dt);
      player.invuln = Math.max(player.invuln, 0.2);
    }
    if (this.ultimateShield > 0) {
      this.ultimateShield = Math.max(0, this.ultimateShield - dt);
      if (this.shieldMesh) {
        this.shieldMesh.visible = true;
        this.shieldMesh.material.opacity = 0.16 + Math.sin(this.elapsed * 8) * 0.05 + this.ultimateShield * 0.018;
        this.shieldMesh.rotation.y += dt * 0.9;
        this.shieldMesh.rotation.x += dt * 0.35;
      }
    } else if (this.shieldMesh && this.shieldMesh.visible) {
      this.shieldMesh.visible = false;
    }
    this.cameraShake = Math.max(0, this.cameraShake - dt * 3.8);

    if (this.cannonTimer > 0) this.cannonTimer -= dt;
    if (this.missileCooldown > 0) this.missileCooldown -= dt;
    if (this.flareCooldown > 0) this.flareCooldown -= dt;
    if (this.ultimateCooldown > 0) {
      const previousCooldown = this.ultimateCooldown;
      this.ultimateCooldown = Math.max(0, this.ultimateCooldown - dt);
      if (previousCooldown > 0 && this.ultimateCooldown === 0) {
        this.message('ULTIMATE READY', `${this.ultimate.name} 已就绪`, 'success');
        audio.lockedBeep();
      }
    }

    const firing = this.mobileCannon || this.keys.has('Space');
    if (firing) {
      if (this.cannonTimer <= 0 && this.cannonAmmo > 0) {
        this.cannonTimer = this.cannonDelay;
        this.fireCannon();
      } else if (this.cannonAmmo <= 0 && !this.ammoEmptyWarned) {
        this.ammoEmptyWarned = true;
        audio.error();
        this.message('GUN EMPTY', '机炮弹药耗尽 · 使用导弹', 'warning');
      }
    }

    const flameLength = 0.65 + player.speed / 190 + (this.boostActive ? 0.55 : 0);
    for (const flame of this.playerFlames) {
      flame.scale.set(0.8 + Math.sin(this.elapsed * 30) * 0.08, flameLength, 0.8 + Math.sin(this.elapsed * 28) * 0.08);
    }
    for (const flame of this.playerOuterFlames) {
      flame.scale.set(1, 0.65 + flameLength * 0.7, 1);
      flame.material.opacity = 0.12 + (this.boostActive ? 0.23 : 0.08);
    }

    if (audio.enabled) audio.setFlightEngine(player.speed / 230, this.boostActive);
    if (player.hp < 35 && Math.random() < dt * 16) {
      this.spawnSmoke(player.position.clone().add(new THREE.Vector3(rand(-1, 1), 0, 1)), true);
    }
    playerGroupTransform(this.playerGroup, player);
  }

  updateCloudImmersion() {
    if (!this.cloudVolumes?.length) {
      this.cloudImmersion = 0;
      return;
    }
    let immersion = 0;
    for (const volume of this.cloudVolumes) {
      const center = volume.group.position;
      const dx = this.player.position.x - center.x;
      const dy = (this.player.position.y - center.y) * 2.2;
      const dz = this.player.position.z - center.z;
      const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
      immersion = Math.max(immersion, clamp(1 - distance / volume.radius, 0, 1));
    }
    this.cloudImmersion = immersion > 0.12 ? immersion : 0;
  }

  updateEnemies(dt) {
    if (this.isNetworkGuest || this.isPvp) return;
    const player = this.player;
    const forward = this.getPlayerForward();
    for (const enemy of this.enemies) {
      if (!enemy.alive || enemy.networkTarget || enemy.isNetworkPlayer) continue;
      enemy.damageFlash = Math.max(0, enemy.damageFlash - dt * 4);
      if (enemy.hitGlow) enemy.hitGlow.material.opacity = enemy.damageFlash * 0.55;
      const toPlayer = player.position.clone().sub(enemy.position);
      const distance = toPlayer.length();
      const directionToPlayer = toPlayer.clone().normalize();
      const enemyForward = FORWARD.clone().applyQuaternion(enemy.quaternion);
      const ahead = enemyForward.dot(directionToPlayer);
      enemy.missileCooldown = Math.max(0, enemy.missileCooldown - dt);
      let desired = new THREE.Vector3();

      if (distance > 1150) {
        const lead = player.velocity.clone().multiplyScalar(clamp(distance / 520, 0.2, 1.1));
        desired.copy(player.position).add(lead).sub(enemy.position);
      } else if (distance < 480) {
        const side = new THREE.Vector3().crossVectors(enemyForward, UP).normalize().multiplyScalar(enemy.turnBias);
        desired.copy(enemyForward).multiplyScalar(0.3).add(side.multiplyScalar(0.9)).add(new THREE.Vector3(0, 0.22, 0));
      } else {
        const side = new THREE.Vector3().crossVectors(directionToPlayer, UP).normalize().multiplyScalar(enemy.turnBias * 0.45);
        desired.copy(directionToPlayer).add(side).add(new THREE.Vector3(0, 0.12, 0));
      }

      if (enemy.position.y < 110) desired.y += 0.9;
      if (enemy.position.y > 900) desired.y -= 0.5;
      desired.normalize();

      const targetQ = quaternionFromForward(desired, UP, this._tmpQ);
      const previousForward = enemyForward.clone();
      enemy.quaternion.rotateTowards(targetQ, enemy.turnRate * dt);
      const nextForward = FORWARD.clone().applyQuaternion(enemy.quaternion);
      enemy.forward.copy(nextForward);
      const turnAmount = 1 - previousForward.dot(nextForward);
      enemy.bank = damp(enemy.bank, clamp(turnAmount * 18 * enemy.turnBias, -0.7, 0.7), 5, dt);
      enemy.model.rotation.z = enemy.bank;
      enemy.speed = damp(enemy.speed, distance < 480 ? 92 : 80, 1.4, dt);
      enemy.position.addScaledVector(nextForward, enemy.speed * dt);
      enemy.position.y = clamp(enemy.position.y, 70, 1200);
      enemy.group.position.copy(enemy.position);
      enemy.group.quaternion.copy(enemy.quaternion);

      for (const flame of enemy.flames) {
        flame.scale.set(1, 0.75 + Math.sin(this.elapsed * 24 + enemy.phase) * 0.12, 1);
      }
      if (Math.random() < dt * 18) {
        this.spawnExhaust(enemy.position, nextForward, '#ff7a5c', 0.16);
      }
      if (distance < 1400 && ahead > 0.84 && this.enemyMissiles.length < 3 && enemy.missileCooldown <= 0 && this.cloudImmersion < 0.28) {
        enemy.lockProgress = Math.min(1, enemy.lockProgress + dt / 2.5);
        if (enemy.lockProgress >= 1) {
          enemy.lockProgress = 0;
          this.launchEnemyMissile(enemy);
        }
      } else {
        enemy.lockProgress = Math.max(0, enemy.lockProgress - dt * 1.8);
      }

      enemy.fireCooldown -= dt;
      if (distance < 900 && ahead > 0.92 && enemy.fireCooldown <= 0 && this.cloudImmersion < 0.45) {
        enemy.fireCooldown = rand(1.8, 2.9);
        enemy.burstShots = 4;
        enemy.burstTimer = 0.02;
      }
      if (enemy.burstShots > 0) {
        enemy.burstTimer -= dt;
        if (enemy.burstTimer <= 0) {
          enemy.burstTimer = 0.065;
          enemy.burstShots -= 1;
          this.enemyCannonShot(enemy, distance);
        }
      }

      if (enemy.hp < enemy.maxHp * 0.38) {
        enemy.smokeTimer -= dt;
        if (enemy.smokeTimer <= 0) {
          enemy.smokeTimer = 0.08;
          this.spawnSmoke(enemy.position.clone().addScaledVector(nextForward, 2), true);
        }
      }
      if (enemy.position.y < 20) enemy.position.y = 20;
    }
  }

  enemyCannonShot(enemy, distance) {
    const cloudPenalty = 1 - this.cloudImmersion * 0.85;
    const hitChance = clamp((0.19 - distance / 6800) * cloudPenalty, 0.02, 0.16);
    const hit = Math.random() < hitChance;
    const aim = this.player.position.clone();
    const spread = hit ? rand(1.8, 5) : rand(24, 60);
    aim.add(new THREE.Vector3(rand(-spread, spread), rand(-spread, spread), rand(-spread, spread)));
    const start = enemy.position.clone().addScaledVector(enemy.forward, -4);
    this.addTracer(start, aim, '#ff606a', 0.09, 6);
    audio.enemyLaser();
    if (hit && this.player.alive) {
      this.damagePlayer(rand(2.1, 3.4), 'CANNON');
    }
  }

  launchEnemyMissile(enemy) {
    if (!this.player.alive) return;
    const direction = this.player.position.clone().sub(enemy.position).normalize();
    const group = buildMissile('enemy');
    group.position.copy(enemy.position).addScaledVector(direction, 3);
    group.quaternion.copy(quaternionFromForward(direction));
    this.scene.add(group);
    const missile = {
      group,
      position: group.position,
      velocity: direction.multiplyScalar(175),
      target: this.player,
      targetType: 'player',
      owner: enemy,
      turnRate: 1.28,
      age: 0,
      life: 10,
      trailTimer: 0,
      evadeTime: 0,
      flare: null
    };
    this.enemyMissiles.push(missile);
    this.warningBeepTimer = 0;
    audio.missileLaunch();
    this.callbacks.onEvent?.({ type: 'message', kicker: 'MISSILE LAUNCH', text: 'MISSILE INBOUND', tone: 'danger' });
    enemy.missileCooldown = rand(18, 26);
  }

  fireCannon() {
    if (!this.player.alive || this.cannonAmmo <= 0) return;
    this.cannonAmmo -= 1;
    this.shotsFired += 1;
    const start = this.player.position.clone()
      .add(new THREE.Vector3(rand(-0.8, 0.8), -0.15, 2))
      .add(this.getPlayerForward().multiplyScalar(-3.5));
    let aimDirection = this.getPlayerForward();
    if (this.lockTarget && this.lockTarget.alive) {
      const offset = this.lockTarget.position.clone().sub(this.player.position);
      const distance = offset.length();
      const toTarget = offset.divideScalar(distance || 1);
      if (distance <= 850 && aimDirection.dot(toTarget) > 0.992) aimDirection = toTarget;
    }
    const ray = new THREE.Ray(this.player.position, aimDirection);
    let hitEnemy = null;
    let hitDistance = Infinity;
    for (const enemy of this.enemies) {
      if (!enemy.alive) continue;
      const projection = this._tmpA.copy(enemy.position).sub(this.player.position).dot(aimDirection);
      if (projection <= 0 || projection > 3000) continue;
      const closest = this._tmpB.copy(this.player.position).addScaledVector(aimDirection, projection);
      const miss = closest.distanceTo(enemy.position);
      if (miss < 16 && projection < hitDistance) {
        hitDistance = projection;
        hitEnemy = enemy;
      }
    }
    const end = hitEnemy
      ? hitEnemy.position.clone()
      : this.player.position.clone().addScaledVector(aimDirection, 1250);
    this.addTracer(start, end, '#ffe08c', 0.115, 5);
    if (this.network) {
      this.callbacks.onNetworkFx?.({
        type: 'tracer',
        start: [start.x, start.y, start.z],
        end: [end.x, end.y, end.z],
        color: '#ffb46a'
      });
    }
    this.spawnMuzzleFlash(start);
    audio.cannon3d();
    if (hitEnemy) {
      this.cannonHits += 1;
      hitEnemy.damageFlash = 1;
      this.hitMarkerTime = this.elapsed;
      this.spawnSparks(end, '#ffb168', 5);
      this.callbacks.onEvent?.({ type: 'hitmarker' });
      const damage = this.cannonDamage;
      if (hitEnemy.isPvpTarget) {
        this.applyLocalPvpHit(hitEnemy, damage * 0.8);
      } else if (this.isNetworkGuest && this.isCoopMode) {
        hitEnemy.hp = Math.max(0, hitEnemy.hp - damage);
        this.callbacks.onNetworkEnemyHit?.({ id: hitEnemy.networkId, damage });
      } else {
        hitEnemy.hp -= damage;
        if (hitEnemy.hp <= 0) this.killEnemy(hitEnemy);
      }
    }
  }

  updateLock(dt) {
    if (!this.player.alive) {
      this.lockTarget = null;
      this.lockProgress = 0;
      this.locked = false;
      return;
    }
    const forward = this.getPlayerForward();
    let candidate = null;
    let candidateScore = Infinity;
    for (const enemy of this.enemies) {
      if (!enemy.alive) continue;
      const toEnemy = enemy.position.clone().sub(this.player.position);
      const distance = toEnemy.length();
      if (distance > 2600) continue;
      const direction = toEnemy.clone().normalize();
      const dot = forward.dot(direction);
      if (dot < 0.82) continue;
      const angle = Math.acos(clamp(dot, -1, 1));
      const score = angle * 4 + distance / 6000;
      if (score < candidateScore) {
        candidateScore = score;
        candidate = enemy;
      }
    }
    if (this.lockTarget && (!this.lockTarget.alive || this.lockTarget.position.distanceTo(this.player.position) > 3000)) {
      this.lockTarget = null;
      this.lockProgress = 0;
      this.locked = false;
    }
    if (!this.lockTarget) {
      this.lockTarget = candidate;
      this.lockProgress = 0;
      this.locked = false;
    } else if (candidate && candidate !== this.lockTarget) {
      const currentDir = this.lockTarget.position.clone().sub(this.player.position).normalize();
      if (forward.dot(currentDir) < 0.78) {
        this.lockTarget = candidate;
        this.lockProgress = 0;
        this.locked = false;
      }
    }

    let projected = null;
    let inReticle = false;
    if (this.lockTarget) {
      const target = this.lockTarget.position.clone();
      target.y += 2;
      projected = target.clone().project(this.camera);
      const width = this.renderer.domElement.clientWidth || window.innerWidth;
      const height = this.renderer.domElement.clientHeight || window.innerHeight;
      const screenX = (projected.x * 0.5 + 0.5) * width;
      const screenY = (-projected.y * 0.5 + 0.5) * height;
      const centerDistance = Math.hypot(screenX - width / 2, screenY - height / 2);
      const reticleRadius = Math.min(width, height) * 0.09;
      inReticle = projected.z < 1 && centerDistance < reticleRadius;
      const forwardDot = forward.dot(this.lockTarget.position.clone().sub(this.player.position).normalize());
      if (inReticle && forwardDot > 0.95) {
        this.lockProgress = Math.min(1, this.lockProgress + dt / 1.0);
        if (this.lockProgress >= 1 && !this.locked) {
          this.locked = true;
          audio.lockedBeep();
          this.callbacks.onEvent?.({ type: 'message', kicker: 'LOCK ACQUIRED', text: 'MISSILE READY', tone: 'success' });
        }
        this.lockBeepAccumulator += dt;
        if (this.lockBeepAccumulator > 0.15 && !this.locked) {
          this.lockBeepAccumulator = 0;
          audio.lockBeep(this.lockProgress);
        }
      } else {
        this.lockProgress = Math.max(0, this.lockProgress - dt / 1.1);
        if (this.lockProgress < 0.2) this.locked = false;
      }
      this._hud.lockScreen = {
        x: screenX,
        y: screenY,
        z: projected.z,
        inReticle,
        distance: this.player.position.distanceTo(this.lockTarget.position)
      };
    } else {
      this.lockProgress = Math.max(0, this.lockProgress - dt);
      this.locked = false;
      this._hud.lockScreen = null;
    }
    this.lockWasInReticle = inReticle;
    if (this.lockTarget) {
      this._hud.lockName = this.lockTarget.name;
      this._hud.lockHp = this.lockTarget.hp / this.lockTarget.maxHp;
    } else {
      this._hud.lockName = '';
      this._hud.lockHp = 0;
    }
  }

  launchPlayerMissile() {
    if (this.state !== 'playing' || this.paused || !this.player.alive) return;
    if (this.missileCooldown > 0 || this.missilesLeft <= 0) return;
    const lockedTarget = this.locked && this.lockTarget?.alive ? this.lockTarget : null;
    const aimTarget = lockedTarget && lockedTarget.position.distanceTo(this.player.position) <= 1200
      ? lockedTarget
      : null;
    const side = this.playerMissiles.length % 2 === 0 ? -1 : 1;
    const position = this.player.position.clone()
      .add(new THREE.Vector3(2.2 * side, -0.6, 1.2).applyQuaternion(this.player.quaternion));
    const group = buildMissile('player');
    group.position.copy(position);
    const direction = aimTarget
      ? aimTarget.position.clone().sub(position).normalize()
      : this.getPlayerForward();
    group.quaternion.copy(quaternionFromForward(direction));
    this.scene.add(group);
    this.playerMissiles.push({
      group,
      position: group.position,
      velocity: direction.multiplyScalar(275),
      target: lockedTarget,
      seekerDelay: 0.25,
      age: 0,
      life: 10,
      trailTimer: 0,
      damage: 46
    });
    this.missilesLeft -= 1;
    this.missileCooldown = 0.35;
    audio.missileLaunch();
    if (lockedTarget) {
      this.lockProgress = 0;
      this.locked = false;
      this.callbacks.onEvent?.({ type: 'message', kicker: 'FOX TWO', text: '导弹已发射', tone: 'success' });
    } else {
      this.callbacks.onEvent?.({ type: 'message', kicker: 'FOX TWO', text: '发射后制导 · 保持目标在准星内', tone: 'info' });
    }
  }

  deployFlares() {
    if (this.state !== 'playing' || this.paused || !this.player.alive) return;
    if (this.flaresLeft <= 0 || this.flareCooldown > 0) {
      audio.error();
      return;
    }
    this.flaresLeft -= 1;
    this.flareCooldown = 2.2;
    const forward = this.getPlayerForward();
    for (let i = 0; i < 8; i += 1) {
      const material = new THREE.SpriteMaterial({
        map: this.effectTextures.glow,
        color: '#ffd27a',
        transparent: true,
        opacity: 1,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      });
      const sprite = new THREE.Sprite(material);
      const position = this.player.position.clone()
        .addScaledVector(forward, -4)
        .add(new THREE.Vector3(rand(-2.4, 2.4), rand(-2.4, 2.4), rand(-2.4, 2.4)));
      sprite.position.copy(position);
      sprite.scale.set(5, 5, 1);
      this.scene.add(sprite);
      const flare = {
        sprite,
        position: sprite.position,
        velocity: forward.clone().multiplyScalar(-18).add(new THREE.Vector3(rand(-38, 38), rand(-18, 18), rand(-38, 38))),
        life: rand(2.4, 3.4),
        maxLife: 3.4,
        phase: rand(0, TAU)
      };
      this.flares.push(flare);
    }
    let decoyed = 0;
    for (const missile of this.enemyMissiles) {
      if (missile.targetType !== 'player') continue;
      const distance = missile.position.distanceTo(this.player.position);
      if (distance > 900) continue;
      if (Math.random() < 0.72) {
        const nearest = this.flares.reduce((best, flare) => {
          if (!best) return flare;
          return flare.position.distanceTo(missile.position) < best.position.distanceTo(missile.position) ? flare : best;
        }, null);
        if (nearest) {
          missile.target = nearest;
          missile.targetType = 'flare';
          missile.flare = nearest;
          missile.turnRate = 1.6;
          decoyed += 1;
        }
      }
    }
    audio.flarePop();
    this.callbacks.onEvent?.({
      type: 'message',
      kicker: decoyed ? 'DECOY SUCCESS' : 'FLARES OUT',
      text: decoyed ? `${decoyed} 枚导弹被诱骗` : '热诱弹已释放',
      tone: decoyed ? 'success' : 'info'
    });
  }

  triggerUltimate() {
    if (this.state !== 'playing' || this.paused || !this.player.alive) return;
    if (this.ultimateCooldown > 0) {
      audio.error();
      this.message('ULTIMATE CHARGING', `${this.ultimate.name} 还有 ${Math.ceil(this.ultimateCooldown)} 秒`, 'info');
      return;
    }
    this.ultimateCooldown = this.ultimateCooldownMax;
    this.castUltimate();
    this.emitHud(true);
  }

  castUltimate() {
    const ultimate = this.ultimate;
    const forward = this.getPlayerForward();
    this.cameraShake = Math.max(this.cameraShake, 7);
    this.spawnMuzzleFlash(this.player.position.clone().addScaledVector(forward, 3));
    audio.missileLaunch();
    if (ultimate.id === 'storm') {
      const targets = this.enemies
        .filter((enemy) => enemy.alive && enemy.position.distanceTo(this.player.position) < 5400)
        .slice(0, 3);
      if (!targets.length) {
        this.message('ULTIMATE', '空域内没有可锁定目标', 'info');
        return;
      }
      targets.forEach((target, index) => this.spawnUltimateMissile(target, index));
      this.message('ULTIMATE', `${ultimate.name} · ${targets.length} 枚导弹齐射`, 'success');
      return;
    }
    if (ultimate.id === 'afterburner') {
      this.ultimateActive = 5;
      this.player.invuln = Math.max(this.player.invuln, 5);
      this.boost = 100;
      this.message('ULTIMATE', `${ultimate.name} · 超频突进 5 秒`, 'success');
      return;
    }
    if (ultimate.id === 'thunder') {
      const radius = 1300;
      let hits = 0;
      for (const enemy of [...this.enemies]) {
        if (!enemy.alive) continue;
        if (enemy.position.distanceTo(this.player.position) > radius) continue;
        this.addTracer(this.player.position.clone(), enemy.position.clone(), '#d3e6c9', 0.38, 9);
        this.spawnSparks(enemy.position.clone(), '#c6dcc0', 9);
        this.damageEnemy(enemy, enemy.isPvpTarget ? 40 : 90);
        hits += 1;
      }
      this.spawnExplosion(this.player.position.clone(), 2.5);
      this.spawnShockwave(this.player.position.clone(), '#c6dcc0', 240);
      this.message('ULTIMATE', `${ultimate.name} · 命中 ${hits} 个目标`, hits ? 'success' : 'info');
      return;
    }
    if (ultimate.id === 'singularity') {
      this.deploySingularity();
      this.message('ULTIMATE', `${ultimate.name} · 引力场已投放`, 'success');
      return;
    }
    if (ultimate.id === 'fortress') {
      this.ultimateShield = 6;
      this.player.hp = Math.min(this.player.maxHp, this.player.hp + 75);
      if (this.shieldMesh) this.shieldMesh.visible = true;
      this.spawnShockwave(this.player.position.clone(), '#c6dcc0', 120);
      this.message('ULTIMATE', `${ultimate.name} · 能量壁垒展开`, 'success');
      return;
    }
    this.message('ULTIMATE', `${ultimate.name} 已启动`, 'success');
  }

  spawnUltimateMissile(target, index) {
    const side = index % 2 === 0 ? -1 : 1;
    const position = this.player.position.clone()
      .add(new THREE.Vector3(3.2 * side, 1.1 - index * 0.35, 2.2 + index * 0.4).applyQuaternion(this.player.quaternion));
    const group = buildMissile('player');
    group.position.copy(position);
    const direction = target.position.clone().sub(position).normalize();
    group.quaternion.copy(quaternionFromForward(direction));
    this.scene.add(group);
    this.playerMissiles.push({
      group,
      position: group.position,
      velocity: direction.multiplyScalar(305),
      target,
      seekerDelay: 0,
      age: 0,
      life: 10,
      trailTimer: 0,
      damage: 55,
      ultimate: true
    });
  }

  deploySingularity() {
    this.removeSingularity();
    const focus = this.lockTarget?.alive
      ? this.lockTarget.position.clone()
      : this.player.position.clone().add(this.getPlayerForward().multiplyScalar(900));
    focus.y = clamp(focus.y, 120, 1300);
    const group = new THREE.Group();
    group.position.copy(focus);
    const core = new THREE.Mesh(
      new THREE.SphereGeometry(18, 18, 12),
      new THREE.MeshBasicMaterial({
        color: '#b68cff',
        transparent: true,
        opacity: 0.82,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      })
    );
    group.add(core);
    const rings = [];
    for (let i = 0; i < 3; i += 1) {
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(34 + i * 18, 1.4, 6, 48),
        new THREE.MeshBasicMaterial({
          color: i === 1 ? '#7fe8ff' : '#c9a4ff',
          transparent: true,
          opacity: 0.65,
          blending: THREE.AdditiveBlending,
          depthWrite: false
        })
      );
      ring.rotation.x = rand(0, Math.PI);
      ring.rotation.y = rand(0, Math.PI);
      group.add(ring);
      rings.push(ring);
    }
    const light = new THREE.PointLight('#b58cff', 9, 900, 2);
    group.add(light);
    this.scene.add(group);
    this.singularity = {
      group,
      position: group.position,
      core,
      rings,
      light,
      life: 4.5,
      maxLife: 4.5,
      tick: 0
    };
  }

  updateSingularity(dt) {
    const singularity = this.singularity;
    if (!singularity) return;
    singularity.life -= dt;
    singularity.core.scale.setScalar(1 + Math.sin(this.elapsed * 7) * 0.14);
    singularity.group.rotation.y += dt * 2.2;
    for (let i = 0; i < singularity.rings.length; i += 1) {
      singularity.rings[i].rotation.z += dt * (0.8 + i * 0.45);
    }
    singularity.tick -= dt;
    if (singularity.tick <= 0) {
      singularity.tick = 0.75;
      for (const enemy of [...this.enemies]) {
        if (!enemy.alive) continue;
        const distance = enemy.position.distanceTo(singularity.position);
        if (distance > 900) continue;
        if (!enemy.isNetworkPlayer && !enemy.isSnapshotEnemy) {
          enemy.position.lerp(singularity.position, 0.02);
          enemy.group.position.copy(enemy.position);
        }
        this.spawnSparks(enemy.position.clone(), '#c9a4ff', 4);
        this.damageEnemy(enemy, 7);
      }
    }
    if (singularity.life <= 0) this.removeSingularity();
  }

  removeSingularity() {
    if (!this.singularity) return;
    this.scene.remove(this.singularity.group);
    this.disposeGroup(this.singularity.group);
    this.singularity = null;
  }

  damageEnemy(enemy, damage) {
    if (!enemy || !enemy.alive || damage <= 0) return;
    if (enemy.isPvpTarget) {
      this.applyLocalPvpHit(enemy, damage);
      return;
    }
    enemy.damageFlash = 1;
    if (this.isNetworkGuest && this.isCoopMode) {
      enemy.hp = Math.max(0, enemy.hp - damage);
      this.callbacks.onNetworkEnemyHit?.({ id: enemy.networkId, damage });
      return;
    }
    enemy.hp = Math.max(0, enemy.hp - damage);
    if (enemy.hp <= 0) this.killEnemy(enemy);
  }

  spawnShockwave(position, color, maxRadius = 200) {
    const material = new THREE.SpriteMaterial({
      map: this.effectTextures.glow,
      color,
      transparent: true,
      opacity: 0.7,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    const sprite = new THREE.Sprite(material);
    sprite.position.copy(position);
    sprite.scale.set(18, 18, 1);
    this.scene.add(sprite);
    this.effects.push({
      sprite,
      velocity: new THREE.Vector3(),
      life: 0.55,
      maxLife: 0.55,
      size: maxRadius * 0.5,
      opacity: 0.7,
      grow: 2.6,
      drag: 0,
      gravity: 0
    });
  }

  updatePlayerMissiles(dt) {
    for (let i = this.playerMissiles.length - 1; i >= 0; i -= 1) {
      const missile = this.playerMissiles[i];
      missile.age += dt;
      missile.trailTimer -= dt;
      if (missile.trailTimer <= 0) {
        missile.trailTimer = 0.025;
        this.spawnMissileTrail(missile.position, '#ffcf7a');
      }
      if (!missile.target && missile.age > (missile.seekerDelay || 0.25) && this.locked && this.lockTarget?.alive) {
        missile.target = this.lockTarget;
        this.callbacks.onEvent?.({ type: 'message', kicker: 'SEEKER LOCK', text: '导弹已接收制导', tone: 'success' });
        audio.lockedBeep();
      }
      if (missile.target && !missile.target.alive) missile.target = null;
      if (missile.target) {
        const desired = missile.target.position.clone().sub(missile.position).normalize();
        const current = missile.velocity.clone().normalize();
        const angle = current.angleTo(desired);
        const maxTurn = 3.1 * dt;
        if (angle > 0.0001) {
          const axis = new THREE.Vector3().crossVectors(current, desired).normalize();
          const turn = new THREE.Quaternion().setFromAxisAngle(axis, Math.min(angle, maxTurn));
          missile.velocity.applyQuaternion(turn);
        }
        const distance = missile.position.distanceTo(missile.target.position);
        if (distance < 24) {
          this.missileHits += 1;
          this.damageEnemy(missile.target, Number(missile.damage) || 58);
          this.spawnExplosion(missile.position, 1.4);
          this.removePlayerMissile(i);
          continue;
        }
      }
      missile.position.addScaledVector(missile.velocity, dt);
      missile.group.position.copy(missile.position);
      const dir = missile.velocity.clone().normalize();
      missile.group.quaternion.copy(quaternionFromForward(dir));
      if (missile.age > missile.life || missile.position.y < 5 || missile.position.length() > 8000) {
        this.removePlayerMissile(i);
      }
    }
  }

  removePlayerMissile(index) {
    const missile = this.playerMissiles[index];
    this.scene.remove(missile.group);
    this.disposeGroup(missile.group);
    this.playerMissiles.splice(index, 1);
  }

  updateEnemyMissiles(dt) {
    for (let i = this.enemyMissiles.length - 1; i >= 0; i -= 1) {
      const missile = this.enemyMissiles[i];
      missile.age += dt;
      missile.trailTimer -= dt;
      if (missile.trailTimer <= 0) {
        missile.trailTimer = 0.032;
        this.spawnMissileTrail(missile.position, '#ff725f');
      }

      if (missile.targetType === 'flare' && missile.target && missile.target.life <= 0) {
        missile.target = null;
        missile.targetType = 'none';
      }

      if (missile.target && missile.targetType === 'player' && this.player.alive) {
        const distance = missile.position.distanceTo(this.player.position);
        const maneuver = Math.abs(this.yawRate) + Math.abs(this.pitchRate);
        if (maneuver > 1.5 && distance > 110 && distance < 680) {
          missile.evadeTime += dt;
          if (missile.evadeTime > 0.58) {
            missile.target = null;
            missile.targetType = 'none';
            this.message('MISSILE EVADED', '大机动摆脱成功', 'success');
            audio.lockedBeep();
          }
        } else {
          missile.evadeTime = Math.max(0, missile.evadeTime - dt * 2);
        }

        if (this.cloudImmersion > 0.35 && distance > 90) {
          missile.cloudTime = (missile.cloudTime || 0) + dt;
          if (missile.cloudTime > 0.68) {
            missile.target = null;
            missile.targetType = 'none';
            this.message('CLOUD COVER', '云层干扰使导弹丢失目标', 'success');
            audio.lockedBeep();
          }
        } else {
          missile.cloudTime = Math.max(0, (missile.cloudTime || 0) - dt * 2);
        }
      }

      if (missile.target) {
        const desired = missile.target.position.clone().sub(missile.position).normalize();
        const current = missile.velocity.clone().normalize();
        const angle = current.angleTo(desired);
        const maxTurn = missile.turnRate * dt;
        if (angle > 0.0001) {
          const axis = new THREE.Vector3().crossVectors(current, desired).normalize();
          const turn = new THREE.Quaternion().setFromAxisAngle(axis, Math.min(angle, maxTurn));
          missile.velocity.applyQuaternion(turn);
        }
        const distance = missile.position.distanceTo(missile.target.position);
        if (distance < 18) {
          if (missile.targetType === 'player') {
            this.damagePlayer(30, 'MISSILE');
            this.spawnExplosion(missile.position, 2.2);
          } else {
            this.spawnExplosion(missile.position, 0.8);
          }
          this.removeEnemyMissile(i);
          continue;
        }
      }
      missile.position.addScaledVector(missile.velocity, dt);
      missile.group.position.copy(missile.position);
      const dir = missile.velocity.clone().normalize();
      missile.group.quaternion.copy(quaternionFromForward(dir));
      if (missile.age > missile.life || missile.position.y < 3 || missile.position.length() > 8000) {
        this.removeEnemyMissile(i);
      }
    }
  }

  removeEnemyMissile(index) {
    const missile = this.enemyMissiles[index];
    this.scene.remove(missile.group);
    this.disposeGroup(missile.group);
    this.enemyMissiles.splice(index, 1);
  }

  updateFlares(dt) {
    for (let i = this.flares.length - 1; i >= 0; i -= 1) {
      const flare = this.flares[i];
      flare.life -= dt;
      flare.phase += dt;
      flare.velocity.y -= 9 * dt;
      flare.velocity.multiplyScalar(1 - dt * 0.55);
      flare.position.addScaledVector(flare.velocity, dt);
      flare.sprite.material.opacity = clamp(flare.life / 0.7, 0, 1);
      const scale = 5 + Math.sin(flare.phase * 20) * 1.2;
      flare.sprite.scale.set(scale, scale, 1);
      if (Math.random() < dt * 24) {
        this.spawnSmoke(flare.position.clone(), false, 0.8);
      }
      if (flare.life <= 0) {
        this.scene.remove(flare.sprite);
        flare.sprite.material.dispose();
        this.flares.splice(i, 1);
      }
    }
  }

  killEnemy(enemy) {
    if (!enemy || !enemy.alive) return;
    enemy.alive = false;
    this.kills += 1;
    const gained = 1300 + Math.round(this.timeLeft * 8);
    this.score += gained;
    this.spawnExplosion(enemy.position.clone(), 2.2);
    this.scene.remove(enemy.group);
    this.disposeGroup(enemy.group);
    this.enemies = this.enemies.filter((item) => item !== enemy);
    this.callbacks.onEvent?.({
      type: 'kill',
      text: `${enemy.name} 击落`,
      score: gained
    });
    audio.explosion3d(2);
    this.cameraShake = Math.max(this.cameraShake, 7);
    if (this.lockTarget === enemy) {
      this.lockTarget = null;
      this.lockProgress = 0;
      this.locked = false;
    }
    if (this.reserveEnemies > 0 && this.reserveThresholds.includes(this.kills)) {
      this.reserveEnemies -= 1;
      this.spawnReinforcement();
    }
    if (this.kills >= this.requiredKills) {
      this.endMission(true, 'complete');
    }
  }

  checkTerrainCollision() {
    const player = this.player;
    const altitude = player.position.y;
    const clearance = Math.max(10, player.radius * 0.7);
    let nearTerrain = false;
    let nearBuilding = false;
    for (const collider of this.mountainColliders) {
      const dx = player.position.x - collider.x;
      const dz = player.position.z - collider.z;
      const distance = Math.hypot(dx, dz);
      if (distance > collider.outerRadius) continue;
      const surfaceY = distance >= collider.radius
        ? 8
        : collider.baseY + collider.height * (1 - distance / collider.radius);
      if (altitude < surfaceY + clearance) {
        this.crashPlayer('mountain');
        return true;
      }
      if (altitude < surfaceY + 210) nearTerrain = true;
    }
    for (const building of this.cityColliders) {
      const dx = Math.abs(player.position.x - building.x) - building.halfX;
      const dz = Math.abs(player.position.z - building.z) - building.halfZ;
      const gap = Math.max(dx, dz);
      if (gap < clearance && altitude < building.top + clearance) {
        this.crashPlayer('building');
        return true;
      }
      if (gap < 220 && altitude < building.top + 220) {
        nearTerrain = true;
        nearBuilding = true;
      }
    }
    if (nearTerrain && !this.terrainWarned) {
      this.terrainWarned = true;
      this.message('TERRAIN AHEAD', nearBuilding ? '前方高楼 · 立即拉升' : '前方山体 · 立即拉升', 'warning');
      audio.warningBeep(true);
      this.cameraShake = Math.max(this.cameraShake, 4);
    } else if (!nearTerrain) {
      this.terrainWarned = false;
    }
    return false;
  }

  crashPlayer(reason = 'ground') {
    if (!this.player.alive || this.state !== 'playing') return;
    this.player.alive = false;
    this.player.hp = 0;
    this.stall = false;
    this.stallWarning = false;
    this.playerModel.visible = false;
    this.spawnExplosion(this.player.position.clone(), 3.4);
    this.cameraShake = 24;
    audio.explosion3d(3);
    if (this.isPvp && this.network) this.callbacks.onNetworkCrash?.();
    this.endMission(false, reason);
  }

  damagePlayer(amount, source) {
    if (!this.player.alive || this.player.invuln > 0) return;
    let incoming = amount;
    if (this.ultimateShield > 0) {
      incoming *= 0.18;
      this.spawnSparks(this.player.position.clone(), '#c6dcc0', 6);
    }
    this.player.hp = Math.max(0, this.player.hp - incoming);
    this.player.invuln = 0.35;
    this.damageFlash = 1;
    this.cameraShake = Math.max(this.cameraShake, 8);
    audio.hit();
    this.callbacks.onEvent?.({ type: 'damage', source });
    this.emitHud(true);
    if (this.player.hp <= 0) {
      this.player.alive = false;
      this.spawnExplosion(this.player.position.clone(), 3.3);
      this.playerModel.visible = false;
      this.cameraShake = 22;
      audio.explosion3d(3);
      this.endMission(false, 'destroyed');
    }
  }

  updateEffects(dt) {
    for (let i = this.effects.length - 1; i >= 0; i -= 1) {
      const effect = this.effects[i];
      effect.life -= dt;
      if (effect.life <= 0) {
        this.scene.remove(effect.sprite);
        effect.sprite.material.dispose();
        if (effect.light) this.scene.remove(effect.light);
        this.effects.splice(i, 1);
        continue;
      }
      effect.sprite.position.addScaledVector(effect.velocity, dt);
      effect.velocity.multiplyScalar(1 - Math.min(0.9, effect.drag * dt));
      if (effect.gravity) effect.velocity.y += effect.gravity * dt;
      const t = 1 - effect.life / effect.maxLife;
      effect.sprite.material.opacity = clamp((1 - t) * effect.opacity, 0, 1);
      const scale = effect.size * (1 + effect.grow * t);
      effect.sprite.scale.set(scale, scale, 1);
    }
    for (let i = this.tracers.length - 1; i >= 0; i -= 1) {
      const tracer = this.tracers[i];
      tracer.life -= dt;
      tracer.line.material.opacity = clamp(tracer.life / tracer.maxLife, 0, 1) * 0.9;
      if (tracer.life <= 0) {
        this.scene.remove(tracer.line);
        tracer.line.geometry.dispose();
        tracer.line.material.dispose();
        this.tracers.splice(i, 1);
      }
    }
  }

  addTracer(start, end, color, life = 0.1, width = 2) {
    const geometry = new THREE.BufferGeometry().setFromPoints([start, end]);
    const material = new THREE.LineBasicMaterial({
      color,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    const line = new THREE.Line(geometry, material);
    line.renderOrder = 10;
    this.scene.add(line);
    this.tracers.push({ line, life, maxLife: life, width });
  }

  spawnMuzzleFlash(position) {
    const material = new THREE.SpriteMaterial({
      map: this.effectTextures.glow,
      color: '#fff1b6',
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    const sprite = new THREE.Sprite(material);
    sprite.position.copy(position);
    sprite.scale.set(8, 8, 1);
    this.scene.add(sprite);
    this.effects.push({
      sprite,
      velocity: new THREE.Vector3(),
      life: 0.08,
      maxLife: 0.08,
      size: 8,
      opacity: 0.9,
      grow: 0.8,
      drag: 0,
      gravity: 0
    });
  }

  spawnSparks(position, color, count) {
    for (let i = 0; i < count; i += 1) {
      const material = new THREE.SpriteMaterial({
        map: this.effectTextures.spark,
        color,
        transparent: true,
        opacity: 0.9,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      });
      const sprite = new THREE.Sprite(material);
      sprite.position.copy(position);
      const scale = rand(1.2, 3.4);
      sprite.scale.set(scale, scale, 1);
      this.scene.add(sprite);
      this.effects.push({
        sprite,
        velocity: new THREE.Vector3(rand(-35, 35), rand(-35, 35), rand(-35, 35)),
        life: rand(0.14, 0.38),
        maxLife: 0.38,
        size: scale,
        opacity: 0.95,
        grow: 0.2,
        drag: 2.2,
        gravity: 0
      });
    }
  }

  spawnSmoke(position, dark = false, scale = 1) {
    const material = new THREE.SpriteMaterial({
      map: this.effectTextures.smoke,
      color: dark ? '#4b4f55' : '#b7bec2',
      transparent: true,
      opacity: 0.34,
      depthWrite: false
    });
    const sprite = new THREE.Sprite(material);
    sprite.position.copy(position);
    const size = rand(5, 13) * scale;
    sprite.scale.set(size, size, 1);
    this.scene.add(sprite);
    this.effects.push({
      sprite,
      velocity: new THREE.Vector3(rand(-1.5, 1.5), rand(1.5, 5), rand(-1.5, 1.5)),
      life: rand(0.8, 1.8),
      maxLife: 1.8,
      size,
      opacity: dark ? 0.45 : 0.3,
      grow: 1.8,
      drag: 0.8,
      gravity: 0
    });
  }

  spawnExhaust(position, forward, color, scale = 0.2) {
    const material = new THREE.SpriteMaterial({
      map: this.effectTextures.glow,
      color,
      transparent: true,
      opacity: 0.32,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    const sprite = new THREE.Sprite(material);
    sprite.position.copy(position).addScaledVector(forward, -4);
    const size = rand(1.2, 2.4) * (scale * 5);
    sprite.scale.set(size, size, 1);
    this.scene.add(sprite);
    this.effects.push({
      sprite,
      velocity: forward.clone().multiplyScalar(-12),
      life: 0.25,
      maxLife: 0.25,
      size,
      opacity: 0.32,
      grow: 0.7,
      drag: 1,
      gravity: 0
    });
  }

  spawnMissileTrail(position, color) {
    const material = new THREE.SpriteMaterial({
      map: this.effectTextures.glow,
      color,
      transparent: true,
      opacity: 0.22,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    const sprite = new THREE.Sprite(material);
    sprite.position.copy(position);
    const size = rand(1.2, 2.6);
    sprite.scale.set(size, size, 1);
    this.scene.add(sprite);
    this.effects.push({
      sprite,
      velocity: new THREE.Vector3(rand(-1, 1), rand(-1, 1), rand(-1, 1)),
      life: 0.6,
      maxLife: 0.6,
      size,
      opacity: 0.24,
      grow: 2.2,
      drag: 0.4,
      gravity: 0
    });
  }

  spawnExplosion(position, scale = 1) {
    for (let i = 0; i < 17; i += 1) {
      const material = new THREE.SpriteMaterial({
        map: this.effectTextures.glow,
        color: i % 3 === 0 ? '#fff3be' : '#ff6b35',
        transparent: true,
        opacity: 0.9,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      });
      const sprite = new THREE.Sprite(material);
      sprite.position.copy(position);
      const size = rand(4, 13) * scale;
      sprite.scale.set(size, size, 1);
      this.scene.add(sprite);
      const velocity = new THREE.Vector3(rand(-1, 1), rand(-1, 1), rand(-1, 1)).normalize().multiplyScalar(rand(8, 55) * scale);
      this.effects.push({
        sprite,
        velocity,
        life: rand(0.35, 0.9),
        maxLife: 0.9,
        size,
        opacity: 0.95,
        grow: 1.3,
        drag: 1.5,
        gravity: -4
      });
    }
    for (let i = 0; i < 12; i += 1) {
      this.spawnSmoke(position.clone().add(new THREE.Vector3(rand(-4, 4), rand(-4, 4), rand(-4, 4))), true, rand(0.8, 1.8) * scale);
    }
    const light = new THREE.PointLight('#ff7b47', 16 * scale, 280 * scale, 2);
    light.position.copy(position);
    this.scene.add(light);
    const life = 0.4;
    this.effects.push({
      sprite: new THREE.Sprite(new THREE.SpriteMaterial({ color: '#ffffff', transparent: true, opacity: 0.001 })),
      velocity: new THREE.Vector3(),
      life,
      maxLife: life,
      size: 0,
      opacity: 0,
      grow: 0,
      drag: 0,
      gravity: 0,
      light
    });
    this.cameraShake = Math.max(this.cameraShake, 4 * scale);
  }

  message(text, kicker = 'SYSTEM', tone = 'info') {
    this.callbacks.onEvent?.({ type: 'message', kicker, text, tone });
  }

  endMission(success, reason) {
    if (this.state !== 'playing') return;
    this.state = 'ending';
    this.stickTarget.x = 0;
    this.stickTarget.y = 0;
    this.dragging = false;
    if (this.isPvp) {
      this.message(success ? 'DOGFIGHT WON' : 'DOGFIGHT LOST', success ? '你赢下了这场混战' : '你被击落了', success ? 'success' : 'danger');
    } else if (success) {
      this.message('MISSION COMPLETE', '目标全部击落', 'success');
    } else if (reason === 'ground' || reason === 'mountain' || reason === 'building' || reason === 'airliner') {
      const impacts = {
        ground: ['GROUND IMPACT', '撞地坠机'],
        mountain: ['TERRAIN IMPACT', '撞山坠机'],
        building: ['BUILDING IMPACT', '撞击高楼坠机'],
        airliner: ['CIVILIAN COLLISION', '与民航客机相撞坠机']
      };
      const impact = impacts[reason] || impacts.ground;
      this.message(impact[0], impact[1], 'danger');
    } else {
      this.message(reason === 'timeout' ? 'TIME EXPIRED' : 'AIRCRAFT DOWN', '任务失败', 'danger');
    }
    if (success) audio.victory();
    else audio.defeat();
    audio.stopFlightEngine();
    this.lockTarget = null;
    this.lockProgress = 0;
    this.locked = false;
    this._hud.warning = null;
    this._hud.lock = { active: false, locked: false, progress: 0, targetName: '', targetHp: 0, screen: null };
    const result = this.buildResult(success, reason);
    this.missionEndTimer = window.setTimeout(() => {
      if (!this.destroyed) this.callbacks.onEnd?.(result);
    }, success ? 1200 : 1500);
  }

  buildResult(success, reason) {
    const accuracy = this.shotsFired > 0 ? this.cannonHits / this.shotsFired : 0;
    const timeBonus = success ? Math.round(this.timeLeft * 22) : 0;
    const hullBonus = success ? Math.round(this.player.hp * 10) : 0;
    const score = Math.round(this.score + timeBonus + hullBonus);
    return {
      success,
      reason,
      score,
      kills: this.kills,
      required: this.requiredKills,
      timeLeft: this.timeLeft,
      duration: this.elapsed,
      hp: Math.max(0, Math.round(this.player.hp)),
      missilesLeft: this.missilesLeft,
      flaresLeft: this.flaresLeft,
      accuracy,
      plane: this.planeId,
      skin: this.skinId,
      map: this.mapId,
      ultimate: this.ultimate.id,
      pvp: this.isPvp,
      pvpHostHp: Math.max(0, Math.round(this.player.hp)),
      pvpGuestHp: this.aliveRemoteCount(),
      pvpKills: this.kills,
      network: Boolean(this.network),
      networkMode: this.networkMode,
      networkRole: this.networkRole
    };
  }

  updateCamera(dt) {
    if (!this.playerGroup) return;
    const speedFactor = clamp((this.player.speed - 110) / 120, 0, 1);
    const offset = new THREE.Vector3(
      Math.sin(this.stick.x * 0.25) * 0.6,
      3.8 + speedFactor * 0.8,
      12.8 + speedFactor * 2.4
    ).applyQuaternion(this.player.quaternion);
    const desired = this.player.position.clone().add(offset);
    if (this.cameraShake > 0) {
      desired.x += rand(-this.cameraShake, this.cameraShake) * 0.18;
      desired.y += rand(-this.cameraShake, this.cameraShake) * 0.18;
    }
    const lookTarget = this.player.position.clone()
      .add(this.getPlayerForward().multiplyScalar(38))
      .add(new THREE.Vector3(0, 1.4, 0));
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(this.player.quaternion);
    this._cameraAimMatrix.lookAt(desired, lookTarget, up);
    this._tmpQ.setFromRotationMatrix(this._cameraAimMatrix);
    this.camera.position.lerp(desired, 1 - Math.exp(-7.5 * dt));
    this.camera.quaternion.slerp(this._tmpQ, 1 - Math.exp(-8.5 * dt));
    const targetFov = 59 + speedFactor * 5 + (this.boostActive ? 5 : 0);
    this.camera.fov = damp(this.camera.fov, targetFov, 3, dt);
    this.camera.updateProjectionMatrix();

    if (this.playerModel) {
      this.playerModel.rotation.z = damp(this.playerModel.rotation.z, -this.stick.x * 0.04, 4, dt);
    }
  }

  updateWarning(dt) {
    const incoming = this.enemyMissiles.filter((missile) => missile.targetType === 'player');
    const locking = this.enemies.filter((enemy) => enemy.alive && enemy.lockProgress > 0.2);
    let threat = null;
    let phase = null;
    if (incoming.length) {
      phase = 'incoming';
      threat = incoming.reduce((best, missile) => {
        if (!best) return missile;
        return missile.position.distanceTo(this.player.position) < best.position.distanceTo(this.player.position) ? missile : best;
      }, null);
    } else if (locking.length) {
      phase = 'lock';
      threat = locking.reduce((best, enemy) => {
        if (!best) return enemy;
        return enemy.position.distanceTo(this.player.position) < best.position.distanceTo(this.player.position) ? enemy : best;
      }, null);
    }

    let warning = null;
    if (threat && this.player.alive) {
      const relative = threat.position.clone().sub(this.player.position);
      const local = relative.clone().applyQuaternion(this.player.quaternion.clone().invert());
      const angle = Math.atan2(local.x, -local.z) * (180 / Math.PI);
      warning = {
        active: true,
        intense: phase === 'incoming',
        phase,
        angle
      };
      this.warningBeepTimer -= dt;
      if (this.warningBeepTimer <= 0) {
        this.warningBeepTimer = phase === 'incoming' ? 0.3 : 0.7;
        audio.warningBeep(phase === 'incoming');
      }
    } else {
      this.warningBeepTimer = 0;
    }
    this._hud.warning = warning;
  }

  updateRadar() {
    const forward = this.getPlayerForward();
    forward.y = 0;
    if (forward.lengthSq() < 0.001) forward.set(0, 0, -1);
    forward.normalize();
    const right = new THREE.Vector3(-forward.z, 0, forward.x);
    const range = 3800;
    const contacts = [];
    const pushContact = (position, kind, target = false, distance = null) => {
      const relative = position.clone().sub(this.player.position);
      contacts.push({
        x: clamp(relative.dot(right) / range, -1, 1),
        y: clamp(-relative.dot(forward) / range, -1, 1),
        distance: distance ?? Math.hypot(relative.x, relative.z),
        target,
        altitude: position.y,
        type: kind
      });
    };
    for (const enemy of this.enemies) {
      if (!enemy.alive || (enemy.isNetworkPlayer && !this.isPvp)) continue;
      pushContact(enemy.position, 'enemy', enemy === this.lockTarget);
    }
    if (!this.isPvp) {
      for (const remote of this.remotePlayers.values()) {
        if (remote.dead || !remote.group.visible) continue;
        pushContact(remote.position, 'ally');
      }
    }
    this._hud.contacts = contacts;
  }

  emitHud(force = false) {
    if (!force && this.hudClock < 0.075) return;
    this.hudClock = 0;
    this.updateRadar();
    const speedKph = Math.round(this.player.speed * 3.6);
    this._hud.timeLeft = this.timeLeft;
    this._hud.kills = this.kills;
    this._hud.required = this.requiredKills;
    this._hud.hp = Math.max(0, Math.round(this.player.hp));
    this._hud.maxHp = this.player.maxHp;
    this._hud.speed = speedKph;
    this._hud.altitude = Math.max(0, Math.round(this.player.position.y));
    this._hud.mach = this.player.speed / 340;
    this._hud.g = this.gForce;
    this._hud.boost = this.boost;
    this._hud.missiles = this.missilesLeft;
    this._hud.flares = this.flaresLeft;
    this._hud.cannonAmmo = this.cannonAmmo;
    this._hud.cannonAmmoMax = this.cannonAmmoMax;
    this._hud.ultimate = {
      id: this.ultimate.id,
      name: this.ultimate.name,
      short: this.ultimate.short || this.ultimate.name,
      ready: this.ultimateCooldown <= 0 && this.player.alive,
      cooldown: this.ultimateCooldown,
      max: this.ultimateCooldownMax,
      active: this.ultimateActive > 0 || this.ultimateShield > 0 || Boolean(this.singularity)
    };
    this._hud.map = this.mapId;
    this._hud.score = this.score;
    this._hud.cloud = this.cloudImmersion;
    this._hud.stall = {
      warning: this.stallWarning,
      active: this.stall,
      altitude: Math.round(this.player.position.y)
    };
    this._hud.networkMode = this.networkMode;
    this._hud.networkRole = this.networkRole;
    this._hud.network = this.network
      ? {
          mode: this.networkMode,
          role: this.networkRole,
          allyName: this.opponentProfile?.name || 'WINGMAN'
        }
      : null;
    const aliveFoes = this.aliveRemoteCount();
    const lastFoe = aliveFoes === 1
      ? [...this.remotePlayers.values()].find((remote) => !remote.dead)
      : null;
    this._hud.pvp = this.isPvp
      ? {
          selfHp: Math.max(0, Math.round(this.player.hp)),
          foeHp: lastFoe ? Math.max(0, Math.round(lastFoe.hp)) : aliveFoes,
          foeName: lastFoe ? lastFoe.name : '存活对手',
          kills: this.kills,
          aliveFoes,
          ended: this.pvpState.ended
        }
      : null;
    this._hud.lock = {
      active: Boolean(this.lockTarget),
      locked: this.locked,
      progress: this.lockProgress,
      targetName: this._hud.lockName || '',
      targetHp: this._hud.lockHp || 0,
      screen: this._hud.lockScreen || null
    };
    this._hud.warning = this._hud.warning || null;
    this._hud.flareCooldown = this.flareCooldown;
    this._hud.missileCooldown = this.missileCooldown;
    this._hud.state = this.state;
    this._hud.hitMarker = this.hitMarkerTime > 0 && this.elapsed - this.hitMarkerTime < 0.16;
    this.callbacks.onHud?.(this._hud);
  }

  updateMissionState(dt) {
    this.elapsed += dt;
    this.timeLeft = Math.max(0, this.timeLimit - this.elapsed);
    if (this.timeLeft <= 0) {
      if (this.isPvp) {
        this.endPvp(this.player.alive);
      } else {
        this.endMission(false, 'timeout');
      }
    }
  }

  update(dt) {
    if (this.state === 'playing' && !this.paused) {
      if (!this.isNetworkGuest || this.isPvp) {
        this.updateMissionState(dt);
        if (this.state !== 'playing') return;
      }
      this.updatePlayer(dt);
      this.updateRemoteVisual(dt);
      if (this.isNetworkGuest && this.isCoopMode) {
        this.updateNetworkEnemies(dt);
      } else if (!this.isPvp) {
        this.updateEnemies(dt);
      }
      this.updateAirliners(dt);
      this.updatePlayerMissiles(dt);
      this.updateEnemyMissiles(dt);
      this.updateFlares(dt);
      this.updateSingularity(dt);
      this.updateLock(dt);
      this.updateWarning(dt);
      this.updateEffects(dt);
      if (this.network) {
        this.networkStateClock += dt;
        if (this.networkStateClock >= 0.05) {
          this.networkStateClock = 0;
          this.emitNetworkState();
        }
        if (this.isNetworkHost) {
          this.snapshotClock += dt;
          if (this.snapshotClock >= 0.1) {
            this.snapshotClock = 0;
            this.emitNetworkSnapshot();
          }
        }
      }
      this.hudClock += dt;
      this.emitHud();
    } else {
      this.updateEffects(dt);
      this.updateFlares(dt);
      this.updateRemoteVisual(dt);
      this.updateCamera(dt);
      this.hudClock += dt;
      this.emitHud();
    }
  }

  resize() {
    const width = window.innerWidth;
    const height = window.innerHeight;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 3));
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }

  loop(now) {
    if (this.destroyed) return;
    try {
      const dt = Math.min(0.04, Math.max(0.001, (now - this.lastTime) / 1000 || 0.016));
      this.lastTime = now;
      this.cloudTime += dt;
      this.oceanTexture.offset.x += dt * 0.0016;
      this.oceanTexture.offset.y += dt * 0.0008;
      for (const cloud of this.clouds) {
        cloud.position.x += dt * 0.55;
        if (cloud.position.x > 5800) cloud.position.x = -5800;
      }
      this.update(dt);
      if (this.state === 'briefing') {
        const t = now / 1000;
        this.playerGroup.position.y = 330 + Math.sin(t * 0.5) * 2;
        this.playerGroup.rotation.y = Math.sin(t * 0.18) * 0.1;
        this.camera.position.set(26 + Math.sin(t * 0.2) * 8, 334, 24);
        this.camera.lookAt(this.player.position.clone().add(new THREE.Vector3(0, 2, -5)));
      } else {
        this.updateCamera(dt);
      }
      this.renderer.render(this.scene, this.camera);
    } catch (error) {
      console.error('[mission3d] frame error', error);
    }
    this.raf = requestAnimationFrame(this.loop);
  }

  disposeGroup(group) {
    group.traverse((node) => {
      if (node.geometry) node.geometry.dispose();
      if (node.material) {
        const materials = Array.isArray(node.material) ? node.material : [node.material];
        for (const material of materials) {
          if (material.map && material.map !== this.effectTextures?.glow) {
            material.map.dispose?.();
          }
          material.dispose?.();
        }
      }
    });
  }

  destroy() {
    this.destroyed = true;
    if (this.raf) cancelAnimationFrame(this.raf);
    if (this.missionEndTimer) clearTimeout(this.missionEndTimer);
    this.canvas.removeEventListener('pointerdown', this.onPointerDown);
    this.canvas.removeEventListener('pointermove', this.onPointerMove);
    this.canvas.removeEventListener('pointerup', this.onPointerUp);
    this.canvas.removeEventListener('pointercancel', this.onPointerUp);
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('resize', this.onResize);
    audio.stopFlightEngine();
    this.clearEntities();
    this.scene.traverse((node) => {
      if (node.geometry) node.geometry.dispose?.();
      if (node.material) {
        const materials = Array.isArray(node.material) ? node.material : [node.material];
        for (const material of materials) {
          if (material.map) material.map.dispose?.();
          material.dispose?.();
        }
      }
    });
    this.renderer.dispose();
  }
}

function playerGroupTransform(group, player) {
  group.position.copy(player.position);
  group.quaternion.copy(player.quaternion);
}
