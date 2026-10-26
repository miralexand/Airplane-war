import { getPlane, getSkin, PVP } from '../../shared/catalog.js';
import { drawEnemy, drawFighter, rgba, resolvePalette } from './visuals.js';
import { audio } from './audio.js';

const TAU = Math.PI * 2;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const rand = (min, max) => min + Math.random() * (max - min);
const pick = (items) => items[Math.floor(Math.random() * items.length)];

function distanceSq(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
}

function circleHit(a, ra, b, rb) {
  const radius = ra + rb;
  return distanceSq(a, b) <= radius * radius;
}

class BaseCanvasGame {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.width = 0;
    this.height = 0;
    this.dpr = 1;
    this.running = false;
    this.destroyed = false;
    this.lastTime = 0;
    this.raf = null;
    this.time = 0;
    this.shake = 0;
    this.flash = 0;
    this.particles = [];
    this.stars = [];
    this.backgroundTime = 0;
    this.resize = this.resize.bind(this);
    this.loop = this.loop.bind(this);
    window.addEventListener('resize', this.resize);
    this.resize();
  }

  resize() {
    this.width = window.innerWidth;
    this.height = window.innerHeight;
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = Math.floor(this.width * this.dpr);
    this.canvas.height = Math.floor(this.height * this.dpr);
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.buildStars();
  }

  buildStars() {
    const count = Math.floor((this.width * this.height) / 8000);
    this.stars = Array.from({ length: count }, () => ({
      x: Math.random() * this.width,
      y: Math.random() * this.height,
      z: 0.2 + Math.random() * 0.8,
      size: 0.3 + Math.random() * 1.1,
      speed: 14 + Math.random() * 36
    }));
    this.clouds = [
      { x: this.width * 0.18, y: this.height * 0.2, r: this.width * 0.34, speed: 5, alpha: 0.035 },
      { x: this.width * 0.83, y: this.height * 0.62, r: this.width * 0.42, speed: 9, alpha: 0.028 },
      { x: this.width * 0.46, y: this.height * 0.85, r: this.width * 0.3, speed: 14, alpha: 0.022 }
    ];
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.lastTime = performance.now();
    this.raf = requestAnimationFrame(this.loop);
  }

  stop() {
    this.running = false;
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = null;
  }

  loop(now) {
    if (!this.running) return;
    const dt = Math.min(0.04, Math.max(0.001, (now - this.lastTime) / 1000 || 0.016));
    this.lastTime = now;
    this.time += dt;
    this.update(dt);
    this.render(dt);
    this.raf = requestAnimationFrame(this.loop);
  }

  destroy() {
    this.destroyed = true;
    this.stop();
    this.clearTimers();
    window.removeEventListener('resize', this.resize);
  }

  clearTimers() {
    if (this.timers) {
      this.timers.forEach((timer) => clearTimeout(timer));
      this.timers = [];
    }
  }

  later(fn, delay) {
    if (!this.timers) this.timers = [];
    const timer = setTimeout(() => {
      if (!this.destroyed) fn();
    }, delay);
    this.timers.push(timer);
    return timer;
  }

  update(dt) {
    this.backgroundTime += dt;
    this.updateStars(dt);
    this.updateParticles(dt);
    this.shake = Math.max(0, this.shake - dt * 26);
    this.flash = Math.max(0, this.flash - dt * 2.4);
  }

  updateStars(dt) {
    const speedBoost = this.mode === 'duel' ? 0.5 : 1;
    for (const star of this.stars) {
      star.y += star.speed * star.z * dt * speedBoost;
      if (star.y > this.height + 4) {
        star.y = -4;
        star.x = Math.random() * this.width;
      }
    }
    if (this.clouds) {
      for (const cloud of this.clouds) {
        cloud.y += cloud.speed * dt;
        if (cloud.y - cloud.r > this.height) {
          cloud.y = -cloud.r;
          cloud.x = Math.random() * this.width;
        }
      }
    }
  }

  updateParticles(dt) {
    for (let i = this.particles.length - 1; i >= 0; i -= 1) {
      const p = this.particles[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.particles.splice(i, 1);
        continue;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 1 - p.drag * dt;
      p.vy *= 1 - p.drag * dt;
      if (p.gravity) p.vy += p.gravity * dt;
      if (p.shrink) p.size *= 1 - p.shrink * dt;
    }
    if (this.particles.length > 850) this.particles.splice(0, this.particles.length - 850);
  }

  spawnParticle(options) {
    this.particles.push({
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      life: 0.6,
      maxLife: 0.6,
      size: 2,
      color: '#8beeff',
      drag: 1.8,
      gravity: 0,
      shape: 'dot',
      shrink: 0,
      ...options
    });
  }

  burst(x, y, color, count = 12, power = 180, options = {}) {
    for (let i = 0; i < count; i += 1) {
      const angle = Math.random() * TAU;
      const speed = rand(power * 0.25, power);
      const life = rand(0.28, 0.8);
      this.spawnParticle({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life,
        maxLife: life,
        size: rand(1.2, 3.2),
        color,
        drag: rand(1.4, 3.2),
        shape: Math.random() > 0.6 ? 'spark' : 'dot',
        ...options
      });
    }
  }

  ring(x, y, color, radius = 8, speed = 150) {
    this.spawnParticle({
      x,
      y,
      life: 0.45,
      maxLife: 0.45,
      size: radius,
      color,
      shape: 'ring',
      vx: 0,
      vy: 0,
      drag: 0,
      ringSpeed: speed
    });
  }

  drawBackground() {
    const ctx = this.ctx;
    const w = this.width;
    const h = this.height;
    const modeTint = this.mode === 'duel'
      ? ['#090612', '#130c20', '#05040b']
      : this.mode === 'campaign'
        ? ['#03080f', '#071b25', '#03070d']
        : ['#030710', '#071523', '#02050b'];
    const gradient = ctx.createLinearGradient(0, 0, w * 0.4, h);
    gradient.addColorStop(0, modeTint[0]);
    gradient.addColorStop(0.55, modeTint[1]);
    gradient.addColorStop(1, modeTint[2]);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, w, h);

    const nebula = ctx.createRadialGradient(w * 0.7, h * 0.22, 4, w * 0.7, h * 0.22, w * 0.55);
    nebula.addColorStop(0, this.mode === 'duel' ? 'rgba(123, 50, 122, 0.11)' : 'rgba(24, 110, 150, 0.12)');
    nebula.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = nebula;
    ctx.fillRect(0, 0, w, h);

    if (this.clouds) {
      for (const cloud of this.clouds) {
        const grad = ctx.createRadialGradient(cloud.x, cloud.y, 0, cloud.x, cloud.y, cloud.r);
        grad.addColorStop(0, `rgba(70, 150, 184, ${cloud.alpha})`);
        grad.addColorStop(0.6, `rgba(38, 90, 130, ${cloud.alpha * 0.5})`);
        grad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(cloud.x, cloud.y, cloud.r, 0, TAU);
        ctx.fill();
      }
    }

    for (const star of this.stars) {
      ctx.beginPath();
      ctx.arc(star.x, star.y, star.size * (0.5 + star.z), 0, TAU);
      ctx.fillStyle = `rgba(198, 232, 247, ${0.12 + star.z * 0.44})`;
      ctx.fill();
    }

    const horizon = ctx.createLinearGradient(0, h * 0.6, 0, h);
    horizon.addColorStop(0, 'rgba(0,0,0,0)');
    horizon.addColorStop(1, 'rgba(1,4,9,0.55)');
    ctx.fillStyle = horizon;
    ctx.fillRect(0, h * 0.58, w, h * 0.42);
  }

  drawShake() {
    const ctx = this.ctx;
    if (this.shake > 0.1) {
      ctx.translate(rand(-this.shake, this.shake), rand(-this.shake, this.shake));
    }
  }

  drawParticles() {
    const ctx = this.ctx;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const p of this.particles) {
      const alpha = clamp(p.life / p.maxLife, 0, 1);
      if (p.shape === 'ring') {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size + (1 - alpha) * (p.ringSpeed || 120), 0, TAU);
        ctx.strokeStyle = rgba(p.color, alpha * 0.75);
        ctx.lineWidth = Math.max(0.5, alpha * 1.6);
        ctx.stroke();
        continue;
      }
      if (p.shape === 'spark') {
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x - p.vx * 0.025, p.y - p.vy * 0.025);
        ctx.strokeStyle = rgba(p.color, alpha);
        ctx.lineWidth = Math.max(0.4, p.size * 0.8);
        ctx.stroke();
        continue;
      }
      ctx.beginPath();
      ctx.arc(p.x, p.y, Math.max(0.2, p.size * alpha), 0, TAU);
      ctx.fillStyle = rgba(p.color, alpha);
      ctx.fill();
    }
    ctx.restore();
  }

  drawFlash() {
    if (this.flash <= 0) return;
    const ctx = this.ctx;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const grad = ctx.createRadialGradient(
      this.width / 2,
      this.height / 2,
      0,
      this.width / 2,
      this.height / 2,
      Math.max(this.width, this.height) * 0.7
    );
    grad.addColorStop(0, `rgba(255, 255, 255, ${this.flash * 0.16})`);
    grad.addColorStop(1, 'rgba(255, 143, 143, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, this.width, this.height);
    ctx.restore();
  }

  update() {}
  render() {}
}

export class CombatGame extends BaseCanvasGame {
  constructor(options) {
    super(options.canvas);
    this.mode = options.mode === 'campaign' ? 'campaign' : 'endless';
    this.planeId = options.plane || 'falcon';
    this.skinId = options.skin || 'chrome';
    this.plane = getPlane(this.planeId);
    this.skin = getSkin(this.skinId);
    this.callbacks = options.callbacks || {};
    this.phase = 'playing';
    this.paused = false;
    this.score = 0;
    this.kills = 0;
    this.combo = 0;
    this.comboTimer = 0;
    this.stage = Math.max(1, options.stage || 1);
    this.stageTime = 0;
    this.bossSpawned = false;
    this.boss = null;
    this.bossCount = 0;
    this.nextBossAt = 32;
    this.spawnTimer = 1.2;
    this.enemies = [];
    this.bullets = [];
    this.enemyBullets = [];
    this.pickups = [];
    this.texts = [];
    this.hudClock = 0;
    this.modeLabel = this.mode === 'campaign' ? 'CAMPAIGN' : 'ENDLESS SORTIE';
    this.keys = new Set();
    this.pointerActive = false;
    this.pointerId = null;
    this.player = {
      x: this.width / 2,
      y: this.height - 130,
      targetX: this.width / 2,
      targetY: this.height - 130,
      vx: 0,
      vy: 0,
      radius: this.plane.loadout.radius,
      hp: this.plane.loadout.hp,
      maxHp: this.plane.loadout.hp,
      fireTimer: 0,
      powerLevel: 1,
      shield: 0,
      invuln: 1.4,
      trailTimer: 0,
      damageFlash: 0,
      angle: 0,
      alive: true
    };
    this.endTimer = null;
    this.stageTimer = null;

    this.onPointerDown = this.onPointerDown.bind(this);
    this.onPointerMove = this.onPointerMove.bind(this);
    this.onPointerUp = this.onPointerUp.bind(this);
    this.onKeyDown = this.onKeyDown.bind(this);
    this.onKeyUp = this.onKeyUp.bind(this);

    this.canvas.addEventListener('pointerdown', this.onPointerDown);
    this.canvas.addEventListener('pointermove', this.onPointerMove);
    this.canvas.addEventListener('pointerup', this.onPointerUp);
    this.canvas.addEventListener('pointercancel', this.onPointerUp);
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);

    audio.startAmbience('combat');
    this.later(() => this.callbacks.onBanner?.({
      kicker: this.mode === 'campaign' ? `SECTOR ${String(this.stage).padStart(2, '0')}` : 'ENDLESS SORTIE',
      text: this.mode === 'campaign' ? '突破空域' : '无限战斗'
    }), 200);
    this.emitHud();
    this.start();
  }

  get speed() {
    return this.plane.loadout.speed;
  }

  isPlaying() {
    return this.phase === 'playing' && !this.paused && !this.destroyed;
  }

  onPointerDown(event) {
    if (!this.isPlaying()) return;
    audio.init();
    this.pointerActive = true;
    this.pointerId = event.pointerId;
    this.canvas.setPointerCapture?.(event.pointerId);
    this.setPointerTarget(event);
    event.preventDefault();
  }

  onPointerMove(event) {
    if (!this.isPlaying() || !this.pointerActive) return;
    this.setPointerTarget(event);
    event.preventDefault();
  }

  onPointerUp(event) {
    if (this.pointerId != null && event.pointerId !== this.pointerId) return;
    this.pointerActive = false;
    this.pointerId = null;
  }

  setPointerTarget(event) {
    const rect = this.canvas.getBoundingClientRect();
    let x = event.clientX - rect.left;
    let y = event.clientY - rect.top;
    if (event.pointerType === 'touch') y -= 50;
    this.player.targetX = clamp(x, this.player.radius + 4, this.width - this.player.radius - 4);
    this.player.targetY = clamp(y, this.player.radius + 60, this.height - this.player.radius - 12);
  }

  onKeyDown(event) {
    if (!this.isPlaying()) return;
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'KeyW', 'KeyA', 'KeyS', 'KeyD'].includes(event.code)) {
      event.preventDefault();
    }
    this.keys.add(event.code);
    if (event.code === 'Escape') this.callbacks.onPauseRequest?.();
  }

  onKeyUp(event) {
    this.keys.delete(event.code);
  }

  pause() {
    if (this.phase !== 'playing') return;
    this.paused = true;
    this.keys.clear();
    this.pointerActive = false;
  }

  resume() {
    if (this.phase !== 'playing') return;
    this.paused = false;
    this.lastTime = performance.now();
  }

  update(dt) {
    super.update(dt);
    this.updateTexts(dt);

    if (this.phase === 'playing' && !this.paused) {
      this.stageTime += dt;
      this.comboTimer = Math.max(0, this.comboTimer - dt);
      if (this.comboTimer <= 0) {
        this.combo = 0;
      }
      this.player.invuln = Math.max(0, this.player.invuln - dt);
      this.player.shield = Math.max(0, this.player.shield - dt);
      this.player.damageFlash = Math.max(0, this.player.damageFlash - dt * 4);
      this.updatePlayer(dt);
      this.updateBullets(dt);
      this.updateEnemies(dt);
      this.updateEnemyBullets(dt);
      this.updatePickups(dt);
      this.spawnLogic(dt);
      this.collisions();
      this.hudClock += dt;
      if (this.hudClock >= 0.08) {
        this.hudClock = 0;
        this.emitHud();
      }
    }
  }

  updatePlayer(dt) {
    const player = this.player;
    if (!player.alive) return;
    let moveX = 0;
    let moveY = 0;
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) moveX -= 1;
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) moveX += 1;
    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) moveY -= 1;
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) moveY += 1;

    if (moveX || moveY) {
      const length = Math.hypot(moveX, moveY) || 1;
      player.vx = (moveX / length) * this.speed;
      player.vy = (moveY / length) * this.speed;
      player.x += player.vx * dt;
      player.y += player.vy * dt;
      player.targetX = player.x;
      player.targetY = player.y;
    } else if (this.pointerActive) {
      const dx = player.targetX - player.x;
      const dy = player.targetY - player.y;
      const distance = Math.hypot(dx, dy);
      const maxMove = this.speed * 1.35 * dt;
      if (distance > 0.3) {
        const step = Math.min(distance, maxMove);
        player.vx = (dx / distance) * (step / dt);
        player.vy = (dy / distance) * (step / dt);
        player.x += (dx / distance) * step;
        player.y += (dy / distance) * step;
      } else {
        player.vx *= 0.7;
        player.vy *= 0.7;
      }
    } else {
      player.vx *= Math.max(0, 1 - dt * 7);
      player.vy *= Math.max(0, 1 - dt * 7);
    }

    player.x = clamp(player.x, player.radius + 4, this.width - player.radius - 4);
    player.y = clamp(player.y, player.radius + 55, this.height - player.radius - 10);
    player.angle = clamp(player.vx / this.speed, -1, 1) * 0.16;

    player.trailTimer -= dt;
    if (player.trailTimer <= 0) {
      player.trailTimer = 0.025;
      const palette = resolvePalette(this.skinId, this.time);
      this.spawnParticle({
        x: player.x + rand(-6, 6),
        y: player.y + 24,
        vx: rand(-16, 16),
        vy: rand(80, 170),
        life: rand(0.18, 0.4),
        size: rand(1.2, 2.8),
        color: palette.trail,
        drag: 1.3
      });
    }

    player.fireTimer -= dt;
    if (player.fireTimer <= 0) {
      this.firePlayer();
      player.fireTimer = this.plane.loadout.fireDelay * 0.88;
    }
  }

  firePlayer() {
    const player = this.player;
    const pattern = this.plane.loadout.pattern;
    const level = player.powerLevel;
    const baseDamage = this.plane.loadout.damage * (1 + (level - 1) * 0.12);
    const speed = this.plane.loadout.bulletSpeed;
    const shots = [];

    if (pattern === 'single') {
      if (level === 1) shots.push({ ox: 0, vx: 0 });
      else if (level === 2) shots.push({ ox: -7, vx: 0 }, { ox: 7, vx: 0 });
      else shots.push({ ox: -12, vx: -30 }, { ox: 0, vx: 0 }, { ox: 12, vx: 30 });
    } else if (pattern === 'twin') {
      shots.push({ ox: -7, vx: 0 }, { ox: 7, vx: 0 });
      if (level >= 2) shots.push({ ox: -13, vx: -45 }, { ox: 13, vx: 45 });
      if (level >= 3) shots.push({ ox: 0, vx: 0 });
    } else if (pattern === 'spread') {
      shots.push({ ox: -4, vx: -55 }, { ox: 0, vx: 0 }, { ox: 4, vx: 55 });
      if (level >= 2) shots.push({ ox: -10, vx: -145 }, { ox: 10, vx: 145 });
      if (level >= 3) shots.push({ ox: -16, vx: -225 }, { ox: 16, vx: 225 });
    } else {
      shots.push({ ox: -5, vx: 0 }, { ox: 5, vx: 0 });
      if (level >= 2) shots.push({ ox: -13, vx: -65 }, { ox: 13, vx: 65 });
      if (level >= 3) shots.push({ ox: 0, vx: 0 });
    }

    for (const shot of shots) {
      this.bullets.push({
        x: player.x + shot.ox,
        y: player.y - 28,
        vx: shot.vx,
        vy: -speed,
        radius: pattern === 'spread' ? 3.2 : 2.4,
        damage: baseDamage,
        pierce: pattern === 'pulse' ? 1 : 0,
        kind: pattern,
        life: 2.2
      });
    }

    this.spawnParticle({
      x: player.x,
      y: player.y - 32,
      life: 0.12,
      maxLife: 0.12,
      size: 9,
      color: resolvePalette(this.skinId, this.time).glow,
      shape: 'ring',
      ringSpeed: 30
    });
    audio.laser();
  }

  spawnEnemy(type = null) {
    if (this.enemies.length > 32) return;
    const difficulty = 1 + this.stage * 0.16 + this.time / 95;
    let enemyType = type;
    if (!enemyType) {
      const roll = Math.random();
      if (this.stage >= 2 && roll > 0.84) enemyType = 'tank';
      else if (roll > 0.58) enemyType = 'striker';
      else enemyType = 'scout';
    }
    const margin = 46;
    const baseX = rand(margin, this.width - margin);
    const configurations = {
      scout: {
        hp: 20,
        speed: rand(120, 170),
        radius: 15,
        score: 110,
        fireDelay: rand(1.8, 3.4),
        damage: 9
      },
      striker: {
        hp: 52,
        speed: rand(90, 130),
        radius: 23,
        score: 300,
        fireDelay: rand(1.5, 2.6),
        damage: 11
      },
      tank: {
        hp: 155,
        speed: rand(52, 72),
        radius: 33,
        score: 690,
        fireDelay: rand(1.7, 2.8),
        damage: 14
      }
    };
    const config = configurations[enemyType];
    const hpScale = 1 + (this.stage - 1) * 0.24 + this.time / 150;
    const enemy = {
      type: enemyType,
      x: baseX,
      baseX,
      y: -60,
      hp: config.hp * hpScale,
      maxHp: config.hp * hpScale,
      radius: config.radius,
      speed: config.speed * (1 + this.time / 700),
      score: config.score,
      fireTimer: rand(0.8, 2.2),
      fireDelay: config.fireDelay,
      damage: config.damage,
      phase: Math.random() * TAU,
      entry: Math.random() * 2,
      flash: 0,
      spin: 0,
      difficulty
    };
    this.enemies.push(enemy);
  }

  spawnBoss() {
    this.bossSpawned = true;
    const isCampaign = this.mode === 'campaign';
    const hp = (isCampaign ? 1250 + this.stage * 640 : 1700 + this.bossCount * 980);
    const boss = {
      type: 'boss',
      name: isCampaign ? `虚空旗舰 · 阶段 ${this.stage}` : `虚空母舰 MK-${this.bossCount + 1}`,
      x: this.width / 2,
      baseX: this.width / 2,
      y: -150,
      hp,
      maxHp: hp,
      radius: 78,
      speed: 48,
      score: isCampaign ? 4200 + this.stage * 700 : 6000,
      fireTimer: 2.3,
      damage: 16,
      phase: 0,
      flash: 0,
      entering: true,
      pattern: 0,
      patternTimer: 0,
      hitTimer: 0
    };
    this.boss = boss;
    this.enemies.push(boss);
    this.shake = Math.max(this.shake, 11);
    this.flash = 0.3;
    audio.boss();
    this.callbacks.onBanner?.({ kicker: 'WARNING // VANGUARD', text: isCampaign ? '虚空旗舰接近' : '母舰信号锁定' });
  }

  spawnLogic(dt) {
    if (this.mode === 'campaign' && !this.bossSpawned && this.stageTime > 17 + this.stage * 1.5) {
      this.spawnBoss();
    }
    if (this.mode === 'endless' && this.time > this.nextBossAt && !this.boss) {
      this.spawnBoss();
      this.nextBossAt = this.time + 44 + this.bossCount * 12;
    }

    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      const pressure = this.boss ? 0.55 : 1;
      const baseInterval = Math.max(0.34, 0.95 - this.time * 0.004 - this.stage * 0.025);
      this.spawnTimer = baseInterval / pressure;
      const count = !this.boss && this.stage >= 4 && Math.random() > 0.76 ? 2 : 1;
      for (let i = 0; i < count; i += 1) {
        this.spawnEnemy();
      }
    }
  }

  updateEnemies(dt) {
    for (let i = this.enemies.length - 1; i >= 0; i -= 1) {
      const enemy = this.enemies[i];
      enemy.flash = Math.max(0, enemy.flash - dt * 5);
      if (enemy.type === 'boss') {
        this.updateBoss(enemy, dt);
      } else {
        enemy.y += enemy.speed * dt;
        if (enemy.type === 'scout') {
          enemy.x = enemy.baseX + Math.sin(this.time * 1.8 + enemy.phase) * 20;
        } else if (enemy.type === 'striker') {
          enemy.x = enemy.baseX + Math.sin(this.time * 1.15 + enemy.phase) * 55;
        } else {
          enemy.x = enemy.baseX + Math.sin(this.time * 0.7 + enemy.phase) * 28;
        }
        enemy.fireTimer -= dt;
        if (enemy.fireTimer <= 0 && enemy.y > 30 && enemy.y < this.player.y - 90) {
          enemy.fireTimer = enemy.fireDelay * rand(0.8, 1.2);
          this.enemyFire(enemy);
        }
        if (enemy.y > this.height + 90) {
          this.enemies.splice(i, 1);
        }
      }
    }
  }

  updateBoss(boss, dt) {
    if (boss.entering) {
      boss.y += 70 * dt;
      if (boss.y >= 145) {
        boss.y = 145;
        boss.entering = false;
      }
      return;
    }
    boss.y = 145 + Math.sin(this.time * 0.7) * 14;
    boss.x = this.width / 2 + Math.sin(this.time * 0.42 + boss.phase) * Math.max(60, this.width * 0.27);
    boss.fireTimer -= dt;
    boss.patternTimer += dt;
    if (boss.fireTimer <= 0) {
      boss.fireTimer = 1.8;
      this.bossFire(boss);
      boss.pattern = (boss.pattern + 1) % 3;
    }
    if (boss.hp < boss.maxHp * 0.35) {
      boss.fireTimer -= dt * 0.65;
    }
  }

  enemyFire(enemy) {
    const dx = this.player.x - enemy.x;
    const dy = this.player.y - enemy.y;
    const angle = Math.atan2(dy, dx);
    const speed = 250 + this.stage * 12 + this.time * 0.4;
    if (enemy.type === 'tank') {
      for (let i = -1; i <= 1; i += 1) {
        const a = angle + i * 0.18;
        this.enemyBullets.push({
          x: enemy.x,
          y: enemy.y + 20,
          vx: Math.cos(a) * speed * 0.86,
          vy: Math.sin(a) * speed * 0.86,
          radius: 5,
          damage: enemy.damage,
          life: 5,
          color: '#ff9c55'
        });
      }
    } else {
      this.enemyBullets.push({
        x: enemy.x,
        y: enemy.y + 18,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        radius: enemy.type === 'striker' ? 4.4 : 3.5,
        damage: enemy.damage,
        life: 5,
        color: enemy.type === 'striker' ? '#ff637d' : '#ff8f65'
      });
    }
    audio.enemyLaser();
  }

  bossFire(boss) {
    const angle = Math.atan2(this.player.y - boss.y, this.player.x - boss.x);
    const speed = 245 + this.stage * 8;
    if (boss.pattern === 0) {
      for (let i = -3; i <= 3; i += 1) {
        const a = angle + i * 0.14;
        this.enemyBullets.push({
          x: boss.x,
          y: boss.y + 54,
          vx: Math.cos(a) * speed,
          vy: Math.sin(a) * speed,
          radius: 5.5,
          damage: boss.damage,
          life: 5,
          color: '#ff4169'
        });
      }
    } else if (boss.pattern === 1) {
      const count = 16;
      const offset = this.time * 0.4;
      for (let i = 0; i < count; i += 1) {
        const a = offset + (i / count) * TAU;
        this.enemyBullets.push({
          x: boss.x,
          y: boss.y + 18,
          vx: Math.cos(a) * speed * 0.75,
          vy: Math.sin(a) * speed * 0.75,
          radius: 4.7,
          damage: boss.damage * 0.75,
          life: 5,
          color: '#ff87ad'
        });
      }
    } else {
      for (let side = -1; side <= 1; side += 2) {
        for (let i = 0; i < 3; i += 1) {
          this.enemyBullets.push({
            x: boss.x + side * (42 + i * 8),
            y: boss.y + 20,
            vx: side * (65 + i * 18),
            vy: speed * 0.8,
            radius: 5,
            damage: boss.damage * 0.8,
            life: 5,
            color: '#ff9bbd'
          });
        }
      }
    }
    audio.enemyLaser();
    this.shake = Math.max(this.shake, 2.5);
  }

  updateBullets(dt) {
    for (let i = this.bullets.length - 1; i >= 0; i -= 1) {
      const bullet = this.bullets[i];
      bullet.x += bullet.vx * dt;
      bullet.y += bullet.vy * dt;
      bullet.life -= dt;
      if (bullet.y < -30 || bullet.x < -20 || bullet.x > this.width + 20 || bullet.life <= 0) {
        this.bullets.splice(i, 1);
      }
    }
  }

  updateEnemyBullets(dt) {
    for (let i = this.enemyBullets.length - 1; i >= 0; i -= 1) {
      const bullet = this.enemyBullets[i];
      bullet.x += bullet.vx * dt;
      bullet.y += bullet.vy * dt;
      bullet.life -= dt;
      if (
        bullet.life <= 0 ||
        bullet.y < -40 ||
        bullet.y > this.height + 40 ||
        bullet.x < -40 ||
        bullet.x > this.width + 40
      ) {
        this.enemyBullets.splice(i, 1);
      }
    }
  }

  updatePickups(dt) {
    for (let i = this.pickups.length - 1; i >= 0; i -= 1) {
      const pickup = this.pickups[i];
      pickup.y += pickup.vy * dt;
      pickup.x += Math.sin(this.time * 2.5 + pickup.phase) * 12 * dt;
      pickup.phase += dt;
      if (pickup.y > this.height + 30) {
        this.pickups.splice(i, 1);
        continue;
      }
      if (circleHit(pickup, pickup.radius, this.player, this.player.radius + 4)) {
        this.collectPickup(pickup);
        this.pickups.splice(i, 1);
      }
    }
  }

  collectPickup(pickup) {
    if (pickup.type === 'power') {
      if (this.player.powerLevel < 3) {
        this.player.powerLevel += 1;
        this.addText(this.player.x, this.player.y - 48, '火力提升', '#ffcf5b');
      } else {
        this.score += 500;
        this.addText(this.player.x, this.player.y - 48, '+500', '#ffcf5b');
      }
      audio.pickup();
    } else if (pickup.type === 'heal') {
      this.player.hp = Math.min(this.player.maxHp, this.player.hp + 32);
      this.addText(this.player.x, this.player.y - 48, '+32 结构', '#6bffb8');
      audio.pickup();
    } else if (pickup.type === 'shield') {
      this.player.shield = 7;
      this.addText(this.player.x, this.player.y - 48, '相位护盾', '#79b9ff');
      audio.shield();
    }
    this.ring(pickup.x, pickup.y, pickup.type === 'heal' ? '#6bffb8' : pickup.type === 'shield' ? '#79b9ff' : '#ffcf5b', 9, 90);
  }

  collisions() {
    const player = this.player;

    for (let i = this.bullets.length - 1; i >= 0; i -= 1) {
      const bullet = this.bullets[i];
      let consumed = false;
      for (let j = this.enemies.length - 1; j >= 0; j -= 1) {
        const enemy = this.enemies[j];
        if (!circleHit(bullet, bullet.radius, enemy, enemy.radius)) continue;
        enemy.hp -= bullet.damage;
        enemy.flash = 1;
        this.burst(bullet.x, bullet.y, bullet.kind === 'spread' ? '#ffcf5b' : '#8eeeff', 3, 90);
        audio.hit();
        if (bullet.pierce > 0) {
          bullet.pierce -= 1;
        } else {
          this.bullets.splice(i, 1);
          consumed = true;
        }
        if (enemy.hp <= 0) this.killEnemy(enemy, j);
        if (consumed) break;
      }
      if (consumed) continue;
    }

    for (let i = this.enemyBullets.length - 1; i >= 0; i -= 1) {
      const bullet = this.enemyBullets[i];
      if (!circleHit(bullet, bullet.radius, player, player.radius)) continue;
      this.enemyBullets.splice(i, 1);
      this.damagePlayer(bullet.damage);
    }

    if (player.invuln <= 0) {
      for (let i = this.enemies.length - 1; i >= 0; i -= 1) {
        const enemy = this.enemies[i];
        if (!circleHit(player, player.radius, enemy, enemy.radius)) continue;
        this.damagePlayer(enemy.type === 'boss' ? 34 : 20);
        if (enemy.type !== 'boss') this.killEnemy(enemy, i, true);
      }
    }
  }

  killEnemy(enemy, index, collided = false) {
    if (enemy.type === 'boss') {
      this.killBoss(enemy, index);
      return;
    }
    this.enemies.splice(index, 1);
    this.combo += 1;
    this.comboTimer = 3.2;
    const multiplier = 1 + Math.min(3, this.combo * 0.075);
    const gained = Math.round(enemy.score * multiplier);
    this.score += gained;
    this.kills += 1;
    this.addText(enemy.x, enemy.y - 8, `+${gained}`, this.combo > 3 ? '#ffcf5b' : '#bdefff');
    this.burst(enemy.x, enemy.y, enemy.type === 'tank' ? '#ff9c55' : '#ff6f86', enemy.type === 'tank' ? 32 : 18, enemy.type === 'tank' ? 260 : 180);
    this.ring(enemy.x, enemy.y, '#ff6f86', 10, 170);
    this.shake = Math.max(this.shake, enemy.type === 'tank' ? 7 : 3.5);
    audio.explosion(enemy.type === 'tank' ? 1.5 : 0.8);
    if (collided) this.damagePlayer(10);

    const roll = Math.random();
    if (roll < 0.11) this.spawnPickup(enemy.x, enemy.y, 'power');
    else if (roll < 0.17) this.spawnPickup(enemy.x, enemy.y, 'heal');
    else if (roll < 0.205) this.spawnPickup(enemy.x, enemy.y, 'shield');
  }

  killBoss(boss, index) {
    this.enemies.splice(index, 1);
    this.boss = null;
    this.score += boss.score;
    this.kills += 1;
    this.combo += 2;
    this.comboTimer = 4;
    this.addText(boss.x, boss.y, `+${boss.score}`, '#ffcf5b');
    this.burst(boss.x, boss.y, '#ff5279', 80, 420);
    this.burst(boss.x, boss.y, '#ffd37a', 44, 300);
    this.ring(boss.x, boss.y, '#ff8dac', 28, 320);
    this.ring(boss.x, boss.y, '#ffcf5b', 50, 460);
    this.shake = 25;
    this.flash = 0.9;
    audio.explosion(3);
    this.spawnPickup(boss.x - 60, boss.y, 'power');
    this.spawnPickup(boss.x + 10, boss.y, 'heal');
    this.spawnPickup(boss.x + 70, boss.y, 'shield');

    if (this.mode === 'endless') {
      this.bossCount += 1;
      this.callbacks.onBanner?.({ kicker: 'VANGUARD DESTROYED', text: '旗舰击破' });
      return;
    }

    this.phase = 'stageclear';
    this.clearHostileFire();
    const bonus = 1200 + this.stage * 650;
    this.score += bonus;
    this.callbacks.onBanner?.({ kicker: 'SECTOR SECURED', text: `空域 ${String(this.stage).padStart(2, '0')} 已肃清` });
    this.stageTimer = this.later(() => {
      this.callbacks.onStageClear?.(this.getResult(true));
    }, 1100);
  }

  clearHostileFire() {
    this.enemyBullets = [];
    for (const enemy of this.enemies) {
      if (enemy.type !== 'boss') enemy.fireTimer = 99;
    }
  }

  spawnPickup(x, y, type) {
    this.pickups.push({
      x,
      y,
      vy: rand(55, 82),
      radius: 13,
      type,
      phase: Math.random() * TAU
    });
  }

  damagePlayer(amount) {
    const player = this.player;
    if (!player.alive || player.invuln > 0) return;
    if (player.shield > 0) {
      player.shield = 0;
      player.invuln = 0.6;
      this.ring(player.x, player.y, '#8ac4ff', 18, 210);
      this.burst(player.x, player.y, '#8ac4ff', 18, 180);
      audio.shield();
      this.addText(player.x, player.y - 42, '护盾碎裂', '#8ac4ff');
      return;
    }
    player.hp = Math.max(0, player.hp - amount);
    player.invuln = 1.05;
    player.damageFlash = 1;
    this.combo = 0;
    this.comboTimer = 0;
    this.shake = Math.max(this.shake, 9);
    this.flash = Math.max(this.flash, 0.38);
    this.burst(player.x, player.y, '#ff5a72', 16, 210);
    audio.hit();
    if (player.hp <= 0) {
      this.endRun();
    }
  }

  endRun() {
    if (this.phase === 'ended') return;
    this.phase = 'ended';
    this.player.alive = false;
    this.burst(this.player.x, this.player.y, '#ffbe68', 70, 360);
    this.burst(this.player.x, this.player.y, '#ff4968', 50, 270);
    this.ring(this.player.x, this.player.y, '#ffcf5b', 22, 330);
    this.shake = 28;
    this.flash = 1;
    this.clearHostileFire();
    audio.defeat();
    this.stageTimer = this.later(() => {
      this.callbacks.onEnd?.(this.getResult(false));
    }, 1150);
    this.emitHud();
  }

  nextStage() {
    if (this.phase !== 'stageclear') return;
    this.stage += 1;
    this.stageTime = 0;
    this.bossSpawned = false;
    this.boss = null;
    this.enemies = [];
    this.enemyBullets = [];
    this.bullets = [];
    this.pickups = [];
    this.player.hp = Math.min(this.player.maxHp, this.player.hp + this.player.maxHp * 0.4);
    this.player.invuln = 2;
    this.player.x = this.width / 2;
    this.player.y = this.height - 130;
    this.player.targetX = this.player.x;
    this.player.targetY = this.player.y;
    this.spawnTimer = 1.3;
    this.phase = 'playing';
    this.paused = false;
    this.emitHud();
    audio.startAmbience('combat');
    this.callbacks.onBanner?.({
      kicker: `SECTOR ${String(this.stage).padStart(2, '0')}`,
      text: '下一空域'
    });
  }

  finish() {
    if (this.phase === 'ended' || this.destroyed) return;
    this.phase = 'ended';
    this.player.alive = false;
    this.clearHostileFire();
    this.callbacks.onEnd?.(this.getResult(false, true));
    this.emitHud();
  }

  getResult(stageCleared = false, aborted = false) {
    return {
      mode: this.mode,
      plane: this.planeId,
      skin: this.skinId,
      score: Math.round(this.score),
      kills: this.kills,
      stage: this.stage,
      wave: this.stage,
      duration: Math.round(this.time),
      stageCleared,
      aborted
    };
  }

  emitHud() {
    this.callbacks.onHud?.({
      mode: this.mode,
      score: Math.round(this.score),
      kills: this.kills,
      time: this.time,
      combo: 1 + Math.min(3, this.combo * 0.075),
      comboActive: this.comboTimer > 0,
      hp: Math.max(0, Math.ceil(this.player.hp)),
      maxHp: this.player.maxHp,
      shield: this.player.shield > 0,
      power: this.player.powerLevel,
      stage: this.stage,
      phase: this.phase,
      boss: this.boss
        ? {
            name: this.boss.name,
            ratio: clamp(this.boss.hp / this.boss.maxHp, 0, 1),
            entering: this.boss.entering
          }
        : null
    });
  }

  addText(x, y, text, color) {
    this.texts.push({ x, y, text, color, life: 0.85, maxLife: 0.85 });
  }

  updateTexts(dt) {
    for (let i = this.texts.length - 1; i >= 0; i -= 1) {
      const text = this.texts[i];
      text.life -= dt;
      text.y -= 28 * dt;
      if (text.life <= 0) this.texts.splice(i, 1);
    }
  }

  render() {
    const ctx = this.ctx;
    const w = this.width;
    const h = this.height;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.drawBackground();

    ctx.save();
    this.drawShake();

    this.drawPickups(ctx);
    this.drawEnemyBullets(ctx);
    this.drawPlayerBullets(ctx);

    for (const enemy of this.enemies) {
      const boss = enemy.type === 'boss';
      drawEnemy(ctx, enemy.type, {
        x: enemy.x,
        y: enemy.y,
        scale: boss ? 1.06 : enemy.type === 'tank' ? 1.08 : 0.92,
        time: this.time,
        damageFlash: enemy.flash
      });
      if (!boss) this.drawEnemyHealth(ctx, enemy);
    }

    this.drawPlayer(ctx);
    this.drawParticles();
    this.drawTexts(ctx);
    ctx.restore();
    this.drawFlash();

    const warning = this.player.hp / this.player.maxHp;
    if (warning < 0.28 && this.phase === 'playing') {
      const pulse = 0.12 + Math.sin(this.time * 5) * 0.04;
      const damageGradient = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.3, w / 2, h / 2, Math.max(w, h) * 0.7);
      damageGradient.addColorStop(0, 'rgba(255, 40, 70, 0)');
      damageGradient.addColorStop(1, `rgba(255, 40, 70, ${pulse})`);
      ctx.fillStyle = damageGradient;
      ctx.fillRect(0, 0, w, h);
    }
  }

  drawPlayer(ctx) {
    const player = this.player;
    if (!player.alive) return;
    const blink = player.invuln > 0 && Math.floor(this.time * 14) % 2 === 0;
    const palette = resolvePalette(this.skinId, this.time);
    if (player.shield > 0) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.beginPath();
      ctx.arc(player.x, player.y, player.radius + 13 + Math.sin(this.time * 4) * 2, 0, TAU);
      ctx.strokeStyle = rgba('#85b9ff', 0.45);
      ctx.lineWidth = 1.2;
      ctx.stroke();
      const shield = ctx.createRadialGradient(player.x, player.y, player.radius, player.x, player.y, player.radius + 20);
      shield.addColorStop(0, 'rgba(101, 152, 255, 0)');
      shield.addColorStop(1, 'rgba(101, 152, 255, 0.14)');
      ctx.fillStyle = shield;
      ctx.beginPath();
      ctx.arc(player.x, player.y, player.radius + 20, 0, TAU);
      ctx.fill();
      ctx.restore();
    }
    drawFighter(ctx, this.planeId, this.skinId, {
      x: player.x,
      y: player.y,
      scale: this.planeId === 'titan' ? 0.82 : 0.76,
      angle: player.angle,
      time: this.time,
      thrust: 0.9,
      alpha: blink ? 0.4 : 1,
      damageFlash: player.damageFlash
    });
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.beginPath();
    ctx.arc(player.x, player.y + 20, 2.5, 0, TAU);
    ctx.fillStyle = palette.glow;
    ctx.fill();
    ctx.restore();
  }

  drawPlayerBullets(ctx) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const palette = resolvePalette(this.skinId, this.time);
    for (const bullet of this.bullets) {
      const color = bullet.kind === 'spread' ? '#ffcf5b' : palette.glow;
      const grad = ctx.createLinearGradient(bullet.x, bullet.y + 10, bullet.x, bullet.y - 14);
      grad.addColorStop(0, rgba(color, 0));
      grad.addColorStop(0.4, rgba(color, 0.7));
      grad.addColorStop(1, '#ffffff');
      ctx.beginPath();
      ctx.roundRect(bullet.x - bullet.radius * 0.55, bullet.y - 10, bullet.radius * 1.1, 20, 4);
      ctx.fillStyle = grad;
      ctx.fill();
      ctx.beginPath();
      ctx.arc(bullet.x, bullet.y, bullet.radius * 1.5, 0, TAU);
      ctx.fillStyle = rgba(color, 0.1);
      ctx.fill();
    }
    ctx.restore();
  }

  drawEnemyBullets(ctx) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const bullet of this.enemyBullets) {
      const trail = ctx.createLinearGradient(bullet.x, bullet.y, bullet.x - bullet.vx * 0.05, bullet.y - bullet.vy * 0.05);
      trail.addColorStop(0, rgba(bullet.color, 0.9));
      trail.addColorStop(1, rgba(bullet.color, 0));
      ctx.beginPath();
      ctx.moveTo(bullet.x, bullet.y);
      ctx.lineTo(bullet.x - bullet.vx * 0.05, bullet.y - bullet.vy * 0.05);
      ctx.strokeStyle = trail;
      ctx.lineWidth = bullet.radius * 1.15;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(bullet.x, bullet.y, bullet.radius * 1.8, 0, TAU);
      ctx.fillStyle = rgba(bullet.color, 0.1);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(bullet.x, bullet.y, bullet.radius, 0, TAU);
      ctx.fillStyle = rgba(bullet.color, 0.9);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(bullet.x, bullet.y, bullet.radius * 0.45, 0, TAU);
      ctx.fillStyle = '#fff';
      ctx.fill();
    }
    ctx.restore();
  }

  drawEnemyHealth(ctx, enemy) {
    if (enemy.hp >= enemy.maxHp) return;
    const width = enemy.type === 'tank' ? 56 : 34;
    const ratio = clamp(enemy.hp / enemy.maxHp, 0, 1);
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fillRect(enemy.x - width / 2, enemy.y - enemy.radius - 13, width, 2);
    ctx.fillStyle = ratio > 0.4 ? '#ff8a68' : '#ff4769';
    ctx.fillRect(enemy.x - width / 2, enemy.y - enemy.radius - 13, width * ratio, 2);
  }

  drawPickups(ctx) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const pickup of this.pickups) {
      const palette = pickup.type === 'heal'
        ? ['#6bffb8', '#2ad69b']
        : pickup.type === 'shield'
          ? ['#82b7ff', '#3d62d9']
          : ['#ffcf5b', '#ff8f35'];
      const pulse = 1 + Math.sin(this.time * 4 + pickup.phase) * 0.12;
      const glow = ctx.createRadialGradient(pickup.x, pickup.y, 0, pickup.x, pickup.y, 25);
      glow.addColorStop(0, rgba(palette[0], 0.4));
      glow.addColorStop(1, rgba(palette[0], 0));
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(pickup.x, pickup.y, 25, 0, TAU);
      ctx.fill();

      ctx.save();
      ctx.translate(pickup.x, pickup.y);
      ctx.rotate(Math.PI / 4 + this.time * 0.7);
      ctx.scale(pulse, pulse);
      ctx.fillStyle = palette[1];
      ctx.strokeStyle = palette[0];
      ctx.lineWidth = 1.3;
      ctx.beginPath();
      ctx.roundRect(-7, -7, 14, 14, 2);
      ctx.fill();
      ctx.stroke();
      ctx.restore();

      ctx.fillStyle = '#04101a';
      ctx.font = 'bold 9px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(pickup.type === 'heal' ? '+' : pickup.type === 'shield' ? 'S' : 'P', pickup.x, pickup.y + 0.5);
    }
    ctx.restore();
  }

  drawTexts(ctx) {
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const text of this.texts) {
      const alpha = clamp(text.life / text.maxLife, 0, 1);
      ctx.globalAlpha = alpha;
      ctx.font = '600 11px "Bahnschrift", sans-serif';
      ctx.fillStyle = text.color;
      ctx.shadowColor = text.color;
      ctx.shadowBlur = 8;
      ctx.fillText(text.text, text.x, text.y);
      ctx.shadowBlur = 0;
    }
    ctx.globalAlpha = 1;
  }

  destroy() {
    clearTimeout(this.endTimer);
    clearTimeout(this.stageTimer);
    this.canvas.removeEventListener('pointerdown', this.onPointerDown);
    this.canvas.removeEventListener('pointermove', this.onPointerMove);
    this.canvas.removeEventListener('pointerup', this.onPointerUp);
    this.canvas.removeEventListener('pointercancel', this.onPointerUp);
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    super.destroy();
  }
}

export class DuelGame extends BaseCanvasGame {
  constructor(options) {
    super(options.canvas);
    this.mode = 'duel';
    this.slot = options.slot === 1 ? 1 : 0;
    this.planeId = options.plane || 'falcon';
    this.skinId = options.skin || 'chrome';
    this.plane = getPlane(this.planeId);
    this.skin = getSkin(this.skinId);
    this.callbacks = options.callbacks || {};
    this.opponent = {
      name: options.opponent?.name || '未知飞行员',
      plane: options.opponent?.plane || 'falcon',
      skin: options.opponent?.skin || 'chrome',
      x: PVP.arenaWidth / 2,
      y: this.slot === 0 ? 130 : PVP.arenaHeight - 130,
      renderX: PVP.arenaWidth / 2,
      renderY: this.slot === 0 ? 130 : PVP.arenaHeight - 130
    };
    this.player = {
      x: PVP.arenaWidth / 2,
      y: this.slot === 0 ? PVP.arenaHeight - 150 : 150,
      targetX: PVP.arenaWidth / 2,
      targetY: this.slot === 0 ? PVP.arenaHeight - 150 : 150,
      hp: PVP.maxHp,
      fireTimer: 0,
      invuln: 0,
      angle: 0,
      trailTimer: 0,
      damageFlash: 0,
      alive: true
    };
    this.selfBullets = [];
    this.remoteBullets = [];
    this.scores = [0, 0];
    this.round = 1;
    this.active = false;
    this.paused = false;
    this.hudClock = 0;
    this.keys = new Set();
    this.pointerActive = false;
    this.pointerId = null;
    this.emitClock = 0;
    this.arenaScale = 1;
    this.arenaOffsetX = 0;
    this.arenaOffsetY = 0;
    this.lastStateSent = 0;

    this.onPointerDown = this.onPointerDown.bind(this);
    this.onPointerMove = this.onPointerMove.bind(this);
    this.onPointerUp = this.onPointerUp.bind(this);
    this.onKeyDown = this.onKeyDown.bind(this);
    this.onKeyUp = this.onKeyUp.bind(this);

    this.canvas.addEventListener('pointerdown', this.onPointerDown);
    this.canvas.addEventListener('pointermove', this.onPointerMove);
    this.canvas.addEventListener('pointerup', this.onPointerUp);
    this.canvas.addEventListener('pointercancel', this.onPointerUp);
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);

    this.emitHud();
    this.start();
  }

  buildStars() {
    super.buildStars();
    this.arenaStars = Array.from({ length: 95 }, () => ({
      x: Math.random() * this.width,
      y: Math.random() * this.height,
      z: 0.2 + Math.random() * 0.8,
      size: 0.4 + Math.random() * 1.2
    }));
  }

  onPointerDown(event) {
    if (!this.active || this.paused) return;
    audio.init();
    this.pointerActive = true;
    this.pointerId = event.pointerId;
    this.canvas.setPointerCapture?.(event.pointerId);
    this.setPointerTarget(event);
    event.preventDefault();
  }

  onPointerMove(event) {
    if (!this.active || !this.pointerActive || this.paused) return;
    this.setPointerTarget(event);
    event.preventDefault();
  }

  onPointerUp(event) {
    if (this.pointerId != null && event.pointerId !== this.pointerId) return;
    this.pointerActive = false;
    this.pointerId = null;
  }

  setPointerTarget(event) {
    const rect = this.canvas.getBoundingClientRect();
    let sx = event.clientX - rect.left;
    let sy = event.clientY - rect.top;
    if (event.pointerType === 'touch') {
      sy += this.slot === 0 ? -55 : 55;
    }
    const x = (sx - this.arenaOffsetX) / this.arenaScale;
    const y = (sy - this.arenaOffsetY) / this.arenaScale;
    this.player.targetX = clamp(x, 22, PVP.arenaWidth - 22);
    this.player.targetY = clamp(y, 32, PVP.arenaHeight - 32);
  }

  onKeyDown(event) {
    if (!this.active || this.paused) return;
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'KeyW', 'KeyA', 'KeyS', 'KeyD', 'Space'].includes(event.code)) {
      event.preventDefault();
    }
    this.keys.add(event.code);
    if (event.code === 'Escape') this.callbacks.onPauseRequest?.();
  }

  onKeyUp(event) {
    this.keys.delete(event.code);
  }

  begin() {
    this.active = true;
    this.paused = false;
    this.player.hp = PVP.maxHp;
    this.player.alive = true;
    this.player.invuln = 0.8;
    this.emitHud();
    audio.startAmbience('combat');
  }

  pause() {
    this.paused = true;
    this.pointerActive = false;
    this.keys.clear();
  }

  resume() {
    this.paused = false;
    this.lastTime = performance.now();
  }

  freeze() {
    this.active = false;
    this.pointerActive = false;
    this.keys.clear();
    this.selfBullets = [];
    this.remoteBullets = [];
  }

  setRemoteState(state) {
    if (!state) return;
    this.opponent.x = Number(state.x) || this.opponent.x;
    this.opponent.y = Number(state.y) || this.opponent.y;
    this.opponent.angle = Number(state.angle) || 0;
    this.opponent.thrust = Boolean(state.thrust);
  }

  addRemoteShot(bullet) {
    if (!this.active) return;
    if (!Number.isFinite(bullet.x) || !Number.isFinite(bullet.y)) return;
    this.remoteBullets.push({
      x: bullet.x,
      y: bullet.y,
      vx: bullet.vx,
      vy: bullet.vy,
      radius: 3.2,
      life: 3,
      kind: bullet.kind || 'pulse'
    });
    audio.laser();
  }

  syncHp(hpArray) {
    if (!Array.isArray(hpArray)) return;
    this.player.hp = clamp(hpArray[this.slot], 0, PVP.maxHp);
    if (this.player.hp <= 0) this.player.alive = false;
    this.emitHud();
  }

  syncScores(scores, round) {
    if (Array.isArray(scores)) this.scores = [...scores];
    if (round) this.round = round;
    this.emitHud();
  }

  roundReset(hpArray, scores, round) {
    this.freeze();
    this.syncScores(scores || [0, 0], round || this.round);
    this.player.hp = PVP.maxHp;
    this.player.alive = true;
    this.player.x = PVP.arenaWidth / 2;
    this.player.y = this.slot === 0 ? PVP.arenaHeight - 150 : 150;
    this.player.targetX = this.player.x;
    this.player.targetY = this.player.y;
    this.opponent.x = PVP.arenaWidth / 2;
    this.opponent.y = this.slot === 0 ? 130 : PVP.arenaHeight - 130;
    this.opponent.renderX = this.opponent.x;
    this.opponent.renderY = this.opponent.y;
    this.selfBullets = [];
    this.remoteBullets = [];
    if (hpArray) this.syncHp(hpArray);
    else this.syncHp([PVP.maxHp, PVP.maxHp]);
    this.emitHud();
  }

  update(dt) {
    super.update(dt);
    if (!this.active || this.paused) {
      this.opponent.renderX += (this.opponent.x - this.opponent.renderX) * Math.min(1, dt * 10);
      this.opponent.renderY += (this.opponent.y - this.opponent.renderY) * Math.min(1, dt * 10);
      return;
    }
    this.player.invuln = Math.max(0, this.player.invuln - dt);
    this.player.damageFlash = Math.max(0, this.player.damageFlash - dt * 4);
    this.updatePlayer(dt);
    this.updateBullets(dt);
    this.updateRemoteBullets(dt);
    this.opponent.renderX += (this.opponent.x - this.opponent.renderX) * Math.min(1, dt * 13);
    this.opponent.renderY += (this.opponent.y - this.opponent.renderY) * Math.min(1, dt * 13);
    this.emitClock += dt;
    if (this.emitClock >= 0.05) {
      this.emitClock = 0;
      this.callbacks.onState?.({
        x: this.player.x,
        y: this.player.y,
        angle: this.player.angle,
        thrust: true
      });
    }
    this.hudClock += dt;
    if (this.hudClock >= 0.1) {
      this.hudClock = 0;
      this.emitHud();
    }
  }

  updatePlayer(dt) {
    const player = this.player;
    const speed = this.plane.loadout.speed * 0.9;
    let moveX = 0;
    let moveY = 0;
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) moveX -= 1;
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) moveX += 1;
    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) moveY -= 1;
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) moveY += 1;

    if (moveX || moveY) {
      const length = Math.hypot(moveX, moveY) || 1;
      player.x += (moveX / length) * speed * dt;
      player.y += (moveY / length) * speed * dt;
      player.targetX = player.x;
      player.targetY = player.y;
    } else if (this.pointerActive) {
      const dx = player.targetX - player.x;
      const dy = player.targetY - player.y;
      const distance = Math.hypot(dx, dy);
      const step = Math.min(distance, speed * 1.4 * dt);
      if (distance > 0.5) {
        player.x += (dx / distance) * step;
        player.y += (dy / distance) * step;
      }
    }

    player.x = clamp(player.x, 22, PVP.arenaWidth - 22);
    player.y = clamp(player.y, 34, PVP.arenaHeight - 34);
    player.angle = this.slot === 0 ? 0 : Math.PI;

    player.trailTimer -= dt;
    if (player.trailTimer <= 0) {
      player.trailTimer = 0.03;
      const palette = resolvePalette(this.skinId, this.time);
      this.spawnParticle({
        x: this.arenaOffsetX + player.x * this.arenaScale + rand(-4, 4),
        y: this.arenaOffsetY + (player.y + (this.slot === 0 ? 22 : -22)) * this.arenaScale,
        vx: rand(-14, 14),
        vy: this.slot === 0 ? rand(60, 130) : rand(-130, -60),
        life: rand(0.14, 0.32),
        size: rand(1, 2.4),
        color: palette.trail
      });
    }

    player.fireTimer -= dt;
    if (player.fireTimer <= 0) {
      player.fireTimer = this.plane.loadout.fireDelay * 1.02;
      this.fire();
    }
  }

  fire() {
    const direction = this.slot === 0 ? -1 : 1;
    const pattern = this.plane.loadout.pattern;
    const speed = Math.max(780, this.plane.loadout.bulletSpeed);
    const shots = [];
    if (pattern === 'twin' || pattern === 'pulse') shots.push({ ox: -6, vx: 0 }, { ox: 6, vx: 0 });
    else if (pattern === 'spread') shots.push({ ox: -4, vx: -45 }, { ox: 0, vx: 0 }, { ox: 4, vx: 45 });
    else shots.push({ ox: 0, vx: 0 });

    for (const shot of shots) {
      const bullet = {
        id: Math.random().toString(36).slice(2, 10),
        x: this.player.x + shot.ox,
        y: this.player.y + direction * 25,
        vx: shot.vx,
        vy: direction * speed,
        radius: 3,
        life: 2.2,
        kind: pattern
      };
      this.selfBullets.push(bullet);
      this.callbacks.onShot?.({
        id: bullet.id,
        x: bullet.x,
        y: bullet.y,
        vx: bullet.vx,
        vy: bullet.vy,
        kind: bullet.kind
      });
    }
    const palette = resolvePalette(this.skinId, this.time);
    this.spawnParticle({
      x: this.arenaOffsetX + this.player.x * this.arenaScale,
      y: this.arenaOffsetY + this.player.y * this.arenaScale,
      life: 0.12,
      maxLife: 0.12,
      size: 8,
      color: palette.glow,
      shape: 'ring',
      ringSpeed: 25
    });
    audio.laser();
  }

  updateBullets(dt) {
    for (let i = this.selfBullets.length - 1; i >= 0; i -= 1) {
      const bullet = this.selfBullets[i];
      bullet.x += bullet.vx * dt;
      bullet.y += bullet.vy * dt;
      bullet.life -= dt;
      if (bullet.life <= 0 || bullet.y < -20 || bullet.y > PVP.arenaHeight + 20 || bullet.x < -20 || bullet.x > PVP.arenaWidth + 20) {
        this.selfBullets.splice(i, 1);
        continue;
      }
      if (circleHit(bullet, bullet.radius, this.opponent, 18)) {
        this.selfBullets.splice(i, 1);
        this.burst(this.arenaOffsetX + bullet.x * this.arenaScale, this.arenaOffsetY + bullet.y * this.arenaScale, '#ff7d98', 6, 90);
        audio.hit();
      }
    }
  }

  updateRemoteBullets(dt) {
    for (let i = this.remoteBullets.length - 1; i >= 0; i -= 1) {
      const bullet = this.remoteBullets[i];
      bullet.x += bullet.vx * dt;
      bullet.y += bullet.vy * dt;
      bullet.life -= dt;
      if (bullet.life <= 0 || bullet.y < -20 || bullet.y > PVP.arenaHeight + 20 || bullet.x < -20 || bullet.x > PVP.arenaWidth + 20) {
        this.remoteBullets.splice(i, 1);
        continue;
      }
      if (this.player.invuln <= 0 && circleHit(bullet, bullet.radius, this.player, 16)) {
        this.remoteBullets.splice(i, 1);
        this.player.hp = Math.max(0, this.player.hp - PVP.damage);
        this.player.invuln = 0.55;
        this.player.damageFlash = 1;
        this.shake = Math.max(this.shake, 7);
        this.flash = Math.max(this.flash, 0.35);
        this.burst(this.arenaOffsetX + this.player.x * this.arenaScale, this.arenaOffsetY + this.player.y * this.arenaScale, '#ff6b86', 13, 170);
        this.callbacks.onDamage?.();
        audio.hit();
        this.emitHud();
      }
    }
  }

  collisions() {
    for (let i = this.remoteBullets.length - 1; i >= 0; i -= 1) {
      const bullet = this.remoteBullets[i];
      if (this.player.invuln <= 0 && circleHit(bullet, bullet.radius, this.player, 16)) {
        this.remoteBullets.splice(i, 1);
        this.player.hp = Math.max(0, this.player.hp - PVP.damage);
        this.player.invuln = 0.55;
        this.player.damageFlash = 1;
        this.shake = Math.max(this.shake, 7);
        this.flash = Math.max(this.flash, 0.35);
        this.burst(this.arenaOffsetX + this.player.x * this.arenaScale, this.arenaOffsetY + this.player.y * this.arenaScale, '#ff6b86', 13, 170);
        this.callbacks.onDamage?.();
        audio.hit();
        this.emitHud();
      }
    }
  }

  emitHud() {
    this.callbacks.onHud?.({
      mode: 'duel',
      hp: Math.max(0, Math.ceil(this.player.hp)),
      maxHp: PVP.maxHp,
      selfScore: this.scores[this.slot] || 0,
      foeScore: this.scores[1 - this.slot] || 0,
      round: this.round,
      active: this.active
    });
  }

  calcArena() {
    const scale = Math.min((this.width * 0.94) / PVP.arenaWidth, (this.height * 0.94) / PVP.arenaHeight);
    this.arenaScale = clamp(scale, 0.2, 3);
    this.arenaOffsetX = (this.width - PVP.arenaWidth * this.arenaScale) / 2;
    this.arenaOffsetY = (this.height - PVP.arenaHeight * this.arenaScale) / 2;
  }

  updateStars(dt) {
    for (const star of this.stars) {
      star.y += star.speed * star.z * dt * 0.5;
      if (star.y > this.height + 4) {
        star.y = -4;
        star.x = Math.random() * this.width;
      }
    }
  }

  render() {
    const ctx = this.ctx;
    this.calcArena();
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.drawBackground();

    ctx.save();
    this.drawShake();
    const ox = this.arenaOffsetX;
    const oy = this.arenaOffsetY;
    const scale = this.arenaScale;
    const aw = PVP.arenaWidth * scale;
    const ah = PVP.arenaHeight * scale;

    ctx.save();
    ctx.translate(ox, oy);
    ctx.scale(scale, scale);

    const arena = ctx.createLinearGradient(0, 0, PVP.arenaWidth, PVP.arenaHeight);
    arena.addColorStop(0, 'rgba(5, 12, 22, 0.38)');
    arena.addColorStop(0.5, 'rgba(9, 10, 27, 0.2)');
    arena.addColorStop(1, 'rgba(15, 5, 19, 0.4)');
    ctx.fillStyle = arena;
    ctx.fillRect(0, 0, PVP.arenaWidth, PVP.arenaHeight);

    ctx.strokeStyle = 'rgba(255, 110, 159, 0.09)';
    ctx.lineWidth = 1 / scale;
    ctx.strokeRect(1 / scale, 1 / scale, PVP.arenaWidth - 2 / scale, PVP.arenaHeight - 2 / scale);

    ctx.strokeStyle = 'rgba(87, 229, 255, 0.035)';
    for (let x = 120; x < PVP.arenaWidth; x += 120) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, PVP.arenaHeight);
      ctx.stroke();
    }
    for (let y = 160; y < PVP.arenaHeight; y += 160) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(PVP.arenaWidth, y);
      ctx.stroke();
    }

    ctx.beginPath();
    ctx.arc(PVP.arenaWidth / 2, PVP.arenaHeight / 2, 58, 0, TAU);
    ctx.strokeStyle = 'rgba(255, 110, 159, 0.09)';
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(PVP.arenaWidth / 2, PVP.arenaHeight / 2, 4, 0, TAU);
    ctx.fillStyle = 'rgba(255, 110, 159, 0.2)';
    ctx.fill();

    for (let i = this.remoteBullets.length - 1; i >= 0; i -= 1) {
      const bullet = this.remoteBullets[i];
      if (bullet.life <= 0) {
        this.remoteBullets.splice(i, 1);
        continue;
      }
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.beginPath();
      ctx.arc(bullet.x, bullet.y, 7, 0, TAU);
      ctx.fillStyle = 'rgba(255, 86, 124, 0.12)';
      ctx.fill();
      ctx.beginPath();
      ctx.arc(bullet.x, bullet.y, 3, 0, TAU);
      ctx.fillStyle = '#ff7d9d';
      ctx.fill();
      ctx.restore();
    }

    for (const bullet of this.selfBullets) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.beginPath();
      ctx.roundRect(bullet.x - 1.5, bullet.y - 6, 3, 12, 2);
      ctx.fillStyle = this.skin.palette.glow;
      ctx.fill();
      ctx.restore();
    }

    const drawDuelShip = (x, y, planeId, skinId, angle, isSelf) => {
      if (isSelf && this.player.invuln > 0 && Math.floor(this.time * 12) % 2 === 0) return;
      drawFighter(ctx, planeId, skinId, {
        x,
        y,
        scale: 0.7,
        angle,
        time: this.time,
        thrust: 0.75,
        alpha: 1,
        damageFlash: isSelf ? this.player.damageFlash : 0
      });
      ctx.beginPath();
      ctx.arc(x, y, isSelf ? 26 : 22, 0, TAU);
      ctx.strokeStyle = isSelf ? 'rgba(87, 229, 255, 0.22)' : 'rgba(255, 110, 159, 0.24)';
      ctx.lineWidth = 1 / scale;
      ctx.stroke();
    };

    drawDuelShip(this.opponent.renderX, this.opponent.renderY, this.opponent.plane, this.opponent.skin, this.slot === 0 ? Math.PI : 0, false);
    drawDuelShip(this.player.x, this.player.y, this.planeId, this.skinId, this.slot === 0 ? 0 : Math.PI, true);

    if (this.player.invuln > 0) {
      ctx.beginPath();
      ctx.arc(this.player.x, this.player.y, 34 + Math.sin(this.time * 8) * 2, 0, TAU);
      ctx.strokeStyle = 'rgba(87, 229, 255, 0.35)';
      ctx.lineWidth = 1.2 / scale;
      ctx.stroke();
    }

    ctx.restore();

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const particle of this.particles) {
      const alpha = clamp(particle.life / particle.maxLife, 0, 1);
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, particle.size * alpha, 0, TAU);
      ctx.fillStyle = rgba(particle.color, alpha);
      ctx.fill();
    }
    ctx.restore();

    ctx.strokeStyle = 'rgba(87, 229, 255, 0.16)';
    ctx.lineWidth = 1;
    ctx.strokeRect(ox + 0.5, oy + 0.5, aw - 1, ah - 1);

    const topGrad = ctx.createLinearGradient(0, oy, 0, oy + 60);
    topGrad.addColorStop(0, 'rgba(255, 110, 159, 0.12)');
    topGrad.addColorStop(1, 'rgba(255, 110, 159, 0)');
    ctx.fillStyle = topGrad;
    ctx.fillRect(ox, oy, aw, 60);
    const bottomGrad = ctx.createLinearGradient(0, oy + ah, 0, oy + ah - 60);
    bottomGrad.addColorStop(0, 'rgba(87, 229, 255, 0.09)');
    bottomGrad.addColorStop(1, 'rgba(87, 229, 255, 0)');
    ctx.fillStyle = bottomGrad;
    ctx.fillRect(ox, oy + ah - 60, aw, 60);

    ctx.restore();
    this.drawFlash();

    if (!this.active && !this.paused) {
      ctx.fillStyle = 'rgba(2,5,10,0.12)';
      ctx.fillRect(0, 0, this.width, this.height);
    }
  }

  destroy() {
    this.canvas.removeEventListener('pointerdown', this.onPointerDown);
    this.canvas.removeEventListener('pointermove', this.onPointerMove);
    this.canvas.removeEventListener('pointerup', this.onPointerUp);
    this.canvas.removeEventListener('pointercancel', this.onPointerUp);
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    super.destroy();
  }
}
