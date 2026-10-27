import { getPlane, getSkin } from '../../shared/catalog.js';

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function hueToRgb(p, q, t) {
  let value = t;
  if (value < 0) value += 1;
  if (value > 1) value -= 1;
  if (value < 1 / 6) return p + (q - p) * 6 * value;
  if (value < 1 / 2) return q;
  if (value < 2 / 3) return p + (q - p) * (2 / 3 - value) * 6;
  return p;
}

function rgba(color, alpha) {
  if (typeof color !== 'string') return `rgba(255, 255, 255, ${alpha})`;
  const value = color.trim();
  if (value.startsWith('#')) {
    const clean = value.replace('#', '');
    const parsed = parseInt(clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean, 16);
    const r = (parsed >> 16) & 255;
    const g = (parsed >> 8) & 255;
    const b = parsed & 255;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
  const hslMatch = value.match(/^hsla?\(\s*([\d.]+)(?:deg)?\s*,\s*([\d.]+)%\s*,\s*([\d.]+)%\s*(?:,\s*([\d.]+))?\s*\)$/i);
  if (hslMatch) {
    const h = (parseFloat(hslMatch[1]) % 360) / 360;
    const s = parseFloat(hslMatch[2]) / 100;
    const l = parseFloat(hslMatch[3]) / 100;
    const baseAlpha = hslMatch[4] == null ? 1 : parseFloat(hslMatch[4]);
    let r = l;
    let g = l;
    let b = l;
    if (s !== 0) {
      const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
      const p = 2 * l - q;
      r = hueToRgb(p, q, h + 1 / 3);
      g = hueToRgb(p, q, h);
      b = hueToRgb(p, q, h - 1 / 3);
    }
    return `rgba(${Math.round(r * 255)}, ${Math.round(g * 255)}, ${Math.round(b * 255)}, ${alpha * baseAlpha})`;
  }
  const rgbMatch = value.match(/^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+))?\s*\)$/i);
  if (rgbMatch) {
    const baseAlpha = rgbMatch[4] == null ? 1 : parseFloat(rgbMatch[4]);
    return `rgba(${rgbMatch[1]}, ${rgbMatch[2]}, ${rgbMatch[3]}, ${alpha * baseAlpha})`;
  }
  return value;
}

function hsl(h, s, l, a = 1) {
  return `hsla(${h}, ${s}%, ${l}%, ${a})`;
}

export function resolvePalette(skinId, time = 0) {
  const skin = getSkin(skinId);
  const palette = { ...skin.palette };
  if (skin.animated === 'aurora') {
    const hue = (time * 38) % 360;
    palette.accent = hsl((hue + 160) % 360, 92, 70);
    palette.glow = hsl((hue + 205) % 360, 95, 68);
    palette.trail = hsl((hue + 80) % 360, 95, 66);
  } else if (skin.animated === 'ember') {
    palette.glow = `hsl(${20 + Math.sin(time * 2) * 7}, 100%, 63%)`;
    palette.trail = `hsl(${31 + Math.sin(time * 2.4) * 5}, 100%, 64%)`;
  } else if (skin.animated === 'solar') {
    const pulse = 0.5 + Math.sin(time * 1.8) * 0.5;
    palette.glow = `hsl(${45 + pulse * 6}, 100%, ${66 + pulse * 5}%)`;
  } else if (skin.animated === 'specter') {
    const shimmer = 0.6 + Math.sin(time * 3.2) * 0.22;
    palette.glow = rgba('#c08cff', shimmer);
    palette.trail = rgba('#925cff', shimmer);
  }
  return palette;
}

function wing(ctx, points, fill, stroke, accent) {
  ctx.beginPath();
  ctx.moveTo(points[0][0], points[0][1]);
  for (let i = 1; i < points.length; i += 1) ctx.lineTo(points[i][0], points[i][1]);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.strokeStyle = stroke;
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(points[0][0] * 0.6, points[0][1] * 0.6);
  ctx.lineTo(points[points.length - 1][0] * 0.8, points[points.length - 1][1] * 0.8);
  ctx.strokeStyle = accent;
  ctx.lineWidth = 0.7;
  ctx.stroke();
}

const SHAPES = {
  falcon: {
    wing: [[-3, 1], [-29, 14], [-33, 20], [-20, 22], [-6, 13]],
    canard: [[-4, -17], [-17, -8], [-10, -4]],
    fins: [[-6, 21], [-12, 31], [-5, 27]],
    engines: [[-7, 27], [7, 27]],
    cockpit: [-3.5, -18, 7, 15],
    pods: [[-19, 14], [19, 14]]
  },
  viper: {
    wing: [[-3, -3], [-24, -15], [-31, -8], [-16, 12], [-5, 10]],
    canard: [[-4, -20], [-13, -14], [-9, -9]],
    fins: [[-5, 18], [-14, 34], [-4, 28]],
    engines: [[-4, 28], [4, 28]],
    cockpit: [-2.8, -20, 5.6, 13],
    pods: [[-14, 8], [14, 8]]
  },
  titan: {
    wing: [[-5, -1], [-35, 8], [-36, 20], [-19, 22], [-7, 14]],
    canard: [[-5, -18], [-21, -9], [-12, -4]],
    fins: [[-7, 22], [-15, 33], [-5, 29]],
    engines: [[-13, 26], [13, 26]],
    cockpit: [-4.4, -17, 8.8, 15],
    pods: [[-26, 16], [26, 16]]
  },
  nova: {
    wing: [[-4, -6], [-27, -22], [-34, 6], [-19, 17], [-7, 12]],
    canard: [[-4, -19], [-15, -15], [-11, -8]],
    fins: [[-6, 18], [-20, 31], [-5, 27]],
    engines: [[-6, 27], [6, 27]],
    cockpit: [-3, -19, 6, 14],
    pods: [[-18, 10], [18, 10]]
  },
  bastion: {
    wing: [[-6, -2], [-40, 12], [-40, 23], [-26, 26], [-8, 17]],
    canard: [[-6, -18], [-24, -10], [-14, -3]],
    fins: [[-8, 24], [-18, 35], [-5, 31]],
    engines: [[-16, 27], [-2, 27], [12, 27]],
    cockpit: [-4.8, -17, 9.6, 16],
    pods: [[-30, 18], [30, 18]]
  }
};

function mirrored(points) {
  return points.map(([x, y]) => [-x, y]);
}

export function drawFighter(ctx, planeId, skinId, options = {}) {
  const plane = getPlane(planeId);
  const skin = getSkin(skinId);
  const palette = resolvePalette(skinId, options.time || 0);
  const shape = SHAPES[plane.shape] || SHAPES.falcon;
  const scale = options.scale || 1;
  const angle = options.angle || 0;
  const alpha = options.alpha == null ? 1 : options.alpha;
  const thrust = options.thrust == null ? 0.7 : options.thrust;
  const damageFlash = options.damageFlash || 0;
  const time = options.time || 0;

  ctx.save();
  ctx.translate(options.x || 0, options.y || 0);
  ctx.rotate(angle);
  ctx.scale(scale, scale);
  ctx.globalAlpha = alpha;

  const wingGradient = ctx.createLinearGradient(-34, 0, 34, 18);
  wingGradient.addColorStop(0, palette.dark);
  wingGradient.addColorStop(0.35, palette.body2);
  wingGradient.addColorStop(0.5, palette.body);
  wingGradient.addColorStop(0.65, palette.body2);
  wingGradient.addColorStop(1, palette.dark);

  const bodyGradient = ctx.createLinearGradient(0, -38, 0, 31);
  bodyGradient.addColorStop(0, '#ffffff');
  bodyGradient.addColorStop(0.12, palette.body);
  bodyGradient.addColorStop(0.58, palette.body2);
  bodyGradient.addColorStop(1, palette.dark);

  ctx.shadowColor = palette.glow;
  ctx.shadowBlur = 15;

  const wingFill = wingGradient;
  const wingStroke = rgba(palette.accent, 0.42);

  wing(ctx, shape.wing, wingFill, wingStroke, palette.accent);
  ctx.save();
  ctx.scale(-1, 1);
  wing(ctx, shape.wing, wingFill, wingStroke, palette.accent);
  ctx.restore();

  wing(ctx, shape.canard, wingFill, rgba(palette.accent, 0.24), palette.accent);
  ctx.save();
  ctx.scale(-1, 1);
  wing(ctx, shape.canard, wingFill, rgba(palette.accent, 0.24), palette.accent);
  ctx.restore();

  wing(ctx, shape.fins, palette.dark, rgba(palette.accent, 0.26), palette.accent);
  ctx.save();
  ctx.scale(-1, 1);
  wing(ctx, shape.fins, palette.dark, rgba(palette.accent, 0.26), palette.accent);
  ctx.restore();

  for (const [px, py] of shape.pods) {
    ctx.beginPath();
    ctx.roundRect(px - 2.2, py - 7, 4.4, 16, 2);
    ctx.fillStyle = palette.dark;
    ctx.fill();
    ctx.strokeStyle = rgba(palette.accent, 0.38);
    ctx.lineWidth = 0.6;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(px, py + 8, 1.2, 0, Math.PI * 2);
    ctx.fillStyle = palette.accent;
    ctx.fill();
  }

  ctx.shadowBlur = 0;
  ctx.beginPath();
  ctx.moveTo(0, -38);
  ctx.bezierCurveTo(4.7, -26, 6.4, -3, 5.5, 18);
  ctx.lineTo(3, 29);
  ctx.lineTo(-3, 29);
  ctx.lineTo(-5.5, 18);
  ctx.bezierCurveTo(-6.4, -3, -4.7, -26, 0, -38);
  ctx.closePath();
  ctx.fillStyle = bodyGradient;
  ctx.fill();
  ctx.strokeStyle = rgba(palette.accent, 0.5);
  ctx.lineWidth = 0.75;
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(0, -36);
  ctx.lineTo(1.1, -7);
  ctx.strokeStyle = rgba('#ffffff', 0.5);
  ctx.lineWidth = 0.5;
  ctx.stroke();

  const [cx, cy, cw, ch] = shape.cockpit;
  const cockpitGradient = ctx.createLinearGradient(cx, cy, cx + cw, cy + ch);
  cockpitGradient.addColorStop(0, rgba('#ffffff', 0.55));
  cockpitGradient.addColorStop(0.28, palette.canopy);
  cockpitGradient.addColorStop(1, palette.dark);
  ctx.beginPath();
  ctx.ellipse(cx, cy, cw / 2, ch / 2, 0, 0, Math.PI * 2);
  ctx.fillStyle = cockpitGradient;
  ctx.fill();
  ctx.strokeStyle = rgba(palette.accent, 0.55);
  ctx.lineWidth = 0.55;
  ctx.stroke();

  for (const [ex, ey] of shape.engines) {
    const flameLength = 8 + thrust * (8 + Math.sin(time * 25 + ex) * 3);
    const flameGradient = ctx.createLinearGradient(ex, ey, ex, ey + flameLength);
    flameGradient.addColorStop(0, rgba('#ffffff', 0.92));
    flameGradient.addColorStop(0.22, palette.trail);
    flameGradient.addColorStop(0.6, rgba(palette.accent, 0.62));
    flameGradient.addColorStop(1, rgba(palette.accent, 0));
    ctx.beginPath();
    ctx.moveTo(ex - 2.3, ey);
    ctx.lineTo(ex + 2.3, ey);
    ctx.lineTo(ex + Math.sin(time * 18 + ey) * 0.8, ey + flameLength);
    ctx.closePath();
    ctx.fillStyle = flameGradient;
    ctx.fill();

    ctx.beginPath();
    ctx.arc(ex, ey, 2.1, 0, Math.PI * 2);
    ctx.fillStyle = palette.glow;
    ctx.fill();
  }

  ctx.beginPath();
  ctx.moveTo(-3.2, 24);
  ctx.lineTo(0, 30);
  ctx.lineTo(3.2, 24);
  ctx.strokeStyle = palette.accent;
  ctx.lineWidth = 0.8;
  ctx.stroke();

  if (damageFlash > 0) {
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = damageFlash * 0.5;
    ctx.beginPath();
    ctx.arc(0, 0, 24, 0, Math.PI * 2);
    ctx.fillStyle = '#ff4f68';
    ctx.fill();
  }

  ctx.globalCompositeOperation = 'source-over';
  ctx.restore();
  return { palette, plane, skin };
}

export function drawEnemy(ctx, type, options = {}) {
  const x = options.x || 0;
  const y = options.y || 0;
  const scale = options.scale || 1;
  const time = options.time || 0;
  const damageFlash = options.damageFlash || 0;
  const boss = type === 'boss';
  const heavy = type === 'tank' || boss;

  let wingSpan = type === 'scout' ? 20 : type === 'striker' ? 27 : 34;
  if (boss) wingSpan = 98;

  const colors = boss
    ? { body: '#ff9aa8', body2: '#9d243e', dark: '#290613', accent: '#ff3f6d', glow: '#ff375f' }
    : heavy
      ? { body: '#ffc58f', body2: '#974629', dark: '#2b100a', accent: '#ff8a35', glow: '#ff713a' }
      : { body: '#ffb1b8', body2: '#87313e', dark: '#250810', accent: '#ff5470', glow: '#ff4567' };

  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);

  if (boss) {
    ctx.rotate(Math.sin(time * 0.6) * 0.03);
    ctx.shadowColor = colors.glow;
    ctx.shadowBlur = 35;
    ctx.beginPath();
    ctx.arc(0, 0, 58 + Math.sin(time * 2) * 3, 0, Math.PI * 2);
    ctx.strokeStyle = rgba(colors.accent, 0.16);
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 0, 45 + Math.cos(time * 1.4) * 2, 0, Math.PI * 2);
    ctx.strokeStyle = rgba(colors.accent, 0.1);
    ctx.setLineDash([6, 9]);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  const wingGradient = ctx.createLinearGradient(-wingSpan, -4, wingSpan, 22);
  wingGradient.addColorStop(0, colors.dark);
  wingGradient.addColorStop(0.5, colors.body2);
  wingGradient.addColorStop(1, colors.dark);

  ctx.shadowColor = colors.glow;
  ctx.shadowBlur = boss ? 24 : 12;

  const wingShape = type === 'striker'
    ? [[-3, -2], [-wingSpan, 8], [-wingSpan * 0.78, 17], [-5, 12]]
    : [[-4, 3], [-wingSpan, 21], [-wingSpan * 0.82, 27], [-5, 17]];

  wing(ctx, wingShape, wingGradient, rgba(colors.accent, 0.4), colors.accent);
  ctx.save();
  ctx.scale(-1, 1);
  wing(ctx, wingShape, wingGradient, rgba(colors.accent, 0.4), colors.accent);
  ctx.restore();

  const bodyGradient = ctx.createLinearGradient(0, 27, 0, -32);
  bodyGradient.addColorStop(0, colors.body);
  bodyGradient.addColorStop(0.55, colors.body2);
  bodyGradient.addColorStop(1, colors.dark);
  ctx.beginPath();
  ctx.moveTo(0, 31);
  ctx.bezierCurveTo(-6, 15, -7, -8, 0, -34);
  ctx.bezierCurveTo(7, -8, 6, 15, 0, 31);
  ctx.closePath();
  ctx.fillStyle = bodyGradient;
  ctx.fill();
  ctx.strokeStyle = rgba(colors.accent, 0.5);
  ctx.lineWidth = 0.8;
  ctx.stroke();

  ctx.shadowBlur = 0;
  if (boss) {
    for (const [px, py] of [[-52, 14], [52, 14], [-34, -22], [34, -22]]) {
      ctx.beginPath();
      ctx.arc(px, py, 6, 0, Math.PI * 2);
      ctx.fillStyle = colors.dark;
      ctx.fill();
      ctx.strokeStyle = rgba(colors.accent, 0.7);
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(px, py, 2, 0, Math.PI * 2);
      ctx.fillStyle = colors.glow;
      ctx.fill();
    }
  }

  ctx.beginPath();
  ctx.ellipse(0, -7, boss ? 13 : 4.6, boss ? 19 : 8, 0, 0, Math.PI * 2);
  const canopy = ctx.createLinearGradient(0, -18, 0, 4);
  canopy.addColorStop(0, rgba('#ffffff', 0.35));
  canopy.addColorStop(0.5, colors.dark);
  canopy.addColorStop(1, rgba(colors.accent, 0.45));
  ctx.fillStyle = canopy;
  ctx.fill();

  const coreRadius = boss ? 10 : 2.7;
  ctx.beginPath();
  ctx.arc(0, boss ? 12 : 18, coreRadius + Math.sin(time * 5) * (boss ? 1.4 : 0.4), 0, Math.PI * 2);
  ctx.fillStyle = colors.glow;
  ctx.shadowColor = colors.glow;
  ctx.shadowBlur = boss ? 28 : 10;
  ctx.fill();

  const trail = ctx.createLinearGradient(0, boss ? -24 : -26, 0, boss ? -70 : -52);
  trail.addColorStop(0, rgba(colors.accent, 0.8));
  trail.addColorStop(1, rgba(colors.accent, 0));
  ctx.beginPath();
  ctx.moveTo(-3, boss ? -23 : -28);
  ctx.lineTo(3, boss ? -23 : -28);
  ctx.lineTo(0, boss ? -72 : -48);
  ctx.closePath();
  ctx.fillStyle = trail;
  ctx.fill();

  if (damageFlash > 0) {
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = Math.min(0.8, damageFlash);
    ctx.beginPath();
    ctx.arc(0, 0, boss ? 84 : 34, 0, Math.PI * 2);
    ctx.fillStyle = '#ff4565';
    ctx.fill();
  }

  ctx.restore();
}

export function drawShipThumbnail(canvas, planeId, skinId) {
  if (!canvas) return;
  const width = 124;
  const height = 92;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = width * dpr;
  canvas.height = height * dpr;
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, width, height);
  const glow = ctx.createRadialGradient(width / 2, height / 2, 2, width / 2, height / 2, 44);
  glow.addColorStop(0, rgba(getSkin(skinId).palette.glow, 0.16));
  glow.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, width, height);
  drawFighter(ctx, planeId, skinId, {
    x: width / 2,
    y: height / 2 + 4,
    scale: 0.88,
    time: 0.8,
    thrust: 0.6,
    angle: 0.2
  });
}

export class MenuScene {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.width = 0;
    this.height = 0;
    this.stars = [];
    this.frontStars = [];
    this.meteors = [];
    this.time = 0;
    this.last = 0;
    this.running = false;
    this.theme = 'default';
    this.raf = null;
    this.resize = this.resize.bind(this);
    this.loop = this.loop.bind(this);
    window.addEventListener('resize', this.resize);
    this.resize();
  }

  setTheme(theme) {
    this.theme = theme === 'sage' ? 'sage' : 'default';
  }

  resize() {
    this.width = window.innerWidth;
    this.height = window.innerHeight;
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = this.width * this.dpr;
    this.canvas.height = this.height * this.dpr;
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    const count = Math.floor((this.width * this.height) / 9500);
    this.stars = Array.from({ length: count }, () => this.makeStar(0.7));
    this.frontStars = Array.from({ length: Math.max(14, Math.floor(count / 7)) }, () => this.makeStar(1.6));
    this.meteors = [];
  }

  makeStar(speedFactor = 1) {
    return {
      x: Math.random() * this.width,
      y: Math.random() * this.height,
      z: 0.15 + Math.random() * 0.85,
      size: Math.random() * 1.3 + 0.25,
      speed: (5 + Math.random() * 17) * speedFactor,
      phase: Math.random() * Math.PI * 2,
      hue: Math.random() > 0.88 ? 190 : null
    };
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.loop);
  }

  stop() {
    this.running = false;
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = null;
  }

  loop(now) {
    if (!this.running) return;
    const dt = Math.min(0.05, (now - this.last) / 1000 || 0.016);
    this.last = now;
    this.time += dt;
    this.draw(dt, now / 1000);
    this.raf = requestAnimationFrame(this.loop);
  }

  draw(dt) {
    const ctx = this.ctx;
    const w = this.width;
    const h = this.height;
    const sage = this.theme === 'sage';
    ctx.clearRect(0, 0, w, h);

    const sky = ctx.createLinearGradient(0, 0, w, h);
    sky.addColorStop(0, sage ? '#18221c' : '#040811');
    sky.addColorStop(0.45, sage ? '#26362b' : '#07121f');
    sky.addColorStop(1, sage ? '#121b16' : '#03060c');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, h);

    const nebula = ctx.createRadialGradient(w * 0.72, h * 0.36, 10, w * 0.72, h * 0.36, w * 0.46);
    nebula.addColorStop(0, sage ? 'rgba(151, 181, 146, 0.16)' : 'rgba(22, 111, 158, 0.15)');
    nebula.addColorStop(0.45, sage ? 'rgba(82, 112, 88, 0.09)' : 'rgba(21, 65, 112, 0.07)');
    nebula.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = nebula;
    ctx.fillRect(0, 0, w, h);

    const violet = ctx.createRadialGradient(w * 0.27, h * 0.76, 4, w * 0.27, h * 0.76, w * 0.36);
    violet.addColorStop(0, sage ? 'rgba(196, 179, 139, 0.09)' : 'rgba(74, 43, 111, 0.09)');
    violet.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = violet;
    ctx.fillRect(0, 0, w, h);

    ctx.save();
    ctx.translate(-w * 0.18 + Math.sin(this.time * 0.03) * 14, -h * 0.08);
    ctx.rotate(-0.16);
    for (let i = 0; i < 3; i += 1) {
      ctx.beginPath();
      ctx.ellipse(w * 0.5 + i * w * 0.13, h * 0.52 + i * 50, w * 0.55, h * 0.035, 0.08, 0, Math.PI * 2);
      ctx.fillStyle = sage
        ? `rgba(121, 151, 122, ${0.02 + i * 0.008})`
        : `rgba(47, 126, 170, ${0.018 + i * 0.007})`;
      ctx.fill();
    }
    ctx.restore();

    for (const star of this.stars) {
      star.y += star.speed * dt;
      if (star.y > h + 3) {
        star.y = -3;
        star.x = Math.random() * w;
      }
      const alpha = 0.18 + star.z * 0.55;
      ctx.beginPath();
      ctx.arc(star.x, star.y, star.size * star.z, 0, Math.PI * 2);
      ctx.fillStyle = star.hue
        ? (sage ? `rgba(201, 221, 191, ${alpha})` : `rgba(88, 227, 255, ${alpha})`)
        : (sage ? `rgba(224, 232, 215, ${alpha})` : `rgba(206, 231, 246, ${alpha})`);
      ctx.fill();
    }

    for (const star of this.frontStars) {
      star.y += star.speed * dt;
      if (star.y > h + 30) {
        star.y = -30;
        star.x = Math.random() * w;
      }
      const alpha = 0.08 + star.z * 0.15;
      ctx.beginPath();
      ctx.moveTo(star.x, star.y);
      ctx.lineTo(star.x, star.y - star.speed * 0.45);
      ctx.strokeStyle = sage ? `rgba(190, 209, 184, ${alpha})` : `rgba(141, 213, 240, ${alpha})`;
      ctx.lineWidth = star.size * 0.7;
      ctx.stroke();
    }

    if (Math.random() < dt * 0.18 && this.meteors.length < 2) {
      this.meteors.push({
        x: w * (0.2 + Math.random() * 0.7),
        y: h * Math.random() * 0.4,
        vx: -160 - Math.random() * 130,
        vy: 80 + Math.random() * 90,
        life: 1.4,
        maxLife: 1.4
      });
    }

    for (let i = this.meteors.length - 1; i >= 0; i -= 1) {
      const m = this.meteors[i];
      m.life -= dt;
      m.x += m.vx * dt;
      m.y += m.vy * dt;
      if (m.life <= 0) {
        this.meteors.splice(i, 1);
        continue;
      }
      const alpha = m.life / m.maxLife;
      const grad = ctx.createLinearGradient(m.x, m.y, m.x - m.vx * 0.11, m.y - m.vy * 0.11);
      grad.addColorStop(0, sage ? `rgba(237, 244, 226, ${alpha * 0.6})` : `rgba(226, 252, 255, ${alpha * 0.6})`);
      grad.addColorStop(1, sage ? 'rgba(201, 221, 191, 0)' : 'rgba(87, 229, 255, 0)');
      ctx.beginPath();
      ctx.moveTo(m.x, m.y);
      ctx.lineTo(m.x - m.vx * 0.11, m.y - m.vy * 0.11);
      ctx.strokeStyle = grad;
      ctx.lineWidth = 1.1;
      ctx.stroke();
    }

    const horizon = ctx.createLinearGradient(0, h * 0.72, 0, h);
    horizon.addColorStop(0, 'rgba(3, 8, 15, 0)');
    horizon.addColorStop(1, sage ? 'rgba(9, 16, 12, 0.78)' : 'rgba(2, 5, 10, 0.78)');
    ctx.fillStyle = horizon;
    ctx.fillRect(0, h * 0.68, w, h * 0.32);

    ctx.beginPath();
    const scanY = (this.time * 38) % (h + 200) - 100;
    const scan = ctx.createLinearGradient(0, scanY - 60, 0, scanY + 60);
    scan.addColorStop(0, sage ? 'rgba(201, 221, 191, 0)' : 'rgba(87, 229, 255, 0)');
    scan.addColorStop(0.5, sage ? 'rgba(201, 221, 191, 0.02)' : 'rgba(87, 229, 255, 0.018)');
    scan.addColorStop(1, sage ? 'rgba(201, 221, 191, 0)' : 'rgba(87, 229, 255, 0)');
    ctx.fillStyle = scan;
    ctx.fillRect(0, scanY - 60, w, 120);
  }

  destroy() {
    this.stop();
    window.removeEventListener('resize', this.resize);
  }
}

export class ShowcaseScene {
  constructor(canvas, options = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.planeId = options.plane || 'falcon';
    this.skinId = options.skin || 'chrome';
    this.style = options.style || 'hero';
    this.time = 0;
    this.last = 0;
    this.running = false;
    this.raf = null;
    this.width = 0;
    this.height = 0;
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.resize = this.resize.bind(this);
    this.loop = this.loop.bind(this);
    window.addEventListener('resize', this.resize);
    this.resize();
  }

  setLook(planeId, skinId) {
    this.planeId = planeId || this.planeId;
    this.skinId = skinId || this.skinId;
  }

  resize() {
    const rect = this.canvas.getBoundingClientRect();
    this.width = Math.max(1, rect.width);
    this.height = Math.max(1, rect.height);
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = this.width * this.dpr;
    this.canvas.height = this.height * this.dpr;
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.loop);
  }

  stop() {
    this.running = false;
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = null;
  }

  loop(now) {
    if (!this.running) return;
    const dt = Math.min(0.05, (now - this.last) / 1000 || 0.016);
    this.last = now;
    this.time += dt;
    this.draw();
    this.raf = requestAnimationFrame(this.loop);
  }

  draw() {
    const ctx = this.ctx;
    const w = this.width;
    const h = this.height;
    const t = this.time;
    ctx.clearRect(0, 0, w, h);

    const centerX = w * 0.52;
    const centerY = h * 0.5;
    const scale = clamp(Math.min(w, h) / (this.style === 'hangar' ? 92 : 115), 1.25, 5.2);
    const palette = resolvePalette(this.skinId, t);

    const halo = ctx.createRadialGradient(centerX, centerY, 4, centerX, centerY, Math.min(w, h) * 0.44);
    halo.addColorStop(0, rgba(palette.glow, 0.16));
    halo.addColorStop(0.36, rgba(palette.glow, 0.055));
    halo.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = halo;
    ctx.fillRect(0, 0, w, h);

    ctx.save();
    ctx.translate(centerX, centerY + 18);
    ctx.scale(1, 0.28);
    const floor = ctx.createRadialGradient(0, 0, 4, 0, 0, Math.min(w, h) * 0.3);
    floor.addColorStop(0, rgba(palette.glow, 0.13));
    floor.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = floor;
    ctx.beginPath();
    ctx.arc(0, 0, Math.min(w, h) * 0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.translate(centerX, centerY);
    for (let i = 0; i < 3; i += 1) {
      const radius = Math.min(w, h) * (0.21 + i * 0.08);
      ctx.beginPath();
      ctx.ellipse(0, 0, radius, radius * 0.32, -0.2 + i * 0.22, 0, Math.PI * 2);
      ctx.strokeStyle = rgba(palette.accent, 0.08 - i * 0.018);
      ctx.lineWidth = 0.8;
      ctx.stroke();
    }
    ctx.restore();

    const bob = Math.sin(t * 1.15) * 4;
    const tilt = Math.sin(t * 0.52) * 0.035 - 0.06;
    const thrust = 0.55 + Math.sin(t * 7.2) * 0.12;

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 1; i <= 3; i += 1) {
      drawFighter(ctx, this.planeId, this.skinId, {
        x: centerX + i * 8,
        y: centerY + bob + i * 12,
        scale: scale * (1 - i * 0.02),
        angle: tilt,
        time: t - i * 0.03,
        thrust,
        alpha: 0.08 / i
      });
    }
    ctx.restore();

    drawFighter(ctx, this.planeId, this.skinId, {
      x: centerX,
      y: centerY + bob,
      scale,
      angle: tilt,
      time: t,
      thrust,
      alpha: 1
    });

    const sparkleAlpha = 0.15 + Math.sin(t * 2) * 0.06;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 5; i += 1) {
      const angle = t * 0.15 + i * 1.7;
      const radius = Math.min(w, h) * (0.26 + (i % 3) * 0.07);
      const x = centerX + Math.cos(angle) * radius;
      const y = centerY + Math.sin(angle) * radius * 0.45;
      ctx.beginPath();
      ctx.arc(x, y, 1.2, 0, Math.PI * 2);
      ctx.fillStyle = rgba(palette.glow, sparkleAlpha);
      ctx.fill();
    }
    ctx.restore();
  }

  destroy() {
    this.stop();
    window.removeEventListener('resize', this.resize);
  }
}

export { rgba };
