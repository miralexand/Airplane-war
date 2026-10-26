import express from 'express';
import { createServer } from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Server as SocketServer } from 'socket.io';
import { PLANES, PVP, SKINS } from '../shared/catalog.js';
import { Store } from './store.js';
import {
  authMiddleware,
  hashPassword,
  issueToken,
  requireAuth,
  serializeUser,
  tokenFromRequest,
  verifyPassword,
  verifyToken
} from './auth.js';
import { redeemCode } from './codes.js';
import { attachDuelServer } from './duel.js';
import { attachAir3DServer } from './air3d.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const publicDir = path.join(rootDir, 'public');
const sharedDir = path.join(rootDir, 'shared');
const port = Number(process.env.PORT) || 3000;

const store = new Store(process.env.DATA_DIR || path.join(rootDir, 'data'));
await store.init();

const app = express();
const server = createServer(app);
const io = new SocketServer(server, {
  maxHttpBufferSize: 64 * 1024,
  pingInterval: 20000,
  pingTimeout: 20000
});

app.disable('x-powered-by');
app.set('trust proxy', process.env.TRUST_PROXY === '1');
app.use(express.json({ limit: '24kb' }));
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'same-origin');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  next();
});
app.use(authMiddleware(store));

const buckets = new Map();
function rateLimit(max, windowMs) {
  return (req, res, next) => {
    const key = `${req.ip}:${req.path}`;
    const now = Date.now();
    const bucket = buckets.get(key);
    if (!bucket || now - bucket.start > windowMs) {
      buckets.set(key, { start: now, count: 1 });
      return next();
    }
    bucket.count += 1;
    if (bucket.count > max) {
      return res.status(429).json({ error: '操作太频繁了，稍后再试。' });
    }
    return next();
  };
}

setInterval(() => {
  const cutoff = Date.now() - 1000 * 60 * 10;
  for (const [key, bucket] of buckets) {
    if (bucket.start < cutoff) buckets.delete(key);
  }
}, 1000 * 60 * 5).unref();

function usernameValid(name) {
  return /^[\p{L}\p{N}_-]{2,16}$/u.test(name);
}

function cleanUsername(value) {
  return String(value || '').trim().replace(/\s+/g, ' ');
}

function publicCatalog() {
  return {
    planes: PLANES,
    skins: SKINS,
    pvp: PVP,
    online: io.engine?.clientsCount || 0
  };
}

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'sky-strike-arena', time: new Date().toISOString() });
});

app.get('/api/catalog', (_req, res) => {
  res.json(publicCatalog());
});

app.get('/api/network', (req, res) => {
  const host = req.hostname || 'localhost';
  const portLabel = port;
  const urls = new Set();
  if (/^\d+\.\d+\.\d+\.\d+$/.test(host)) urls.add(`http://${host}:${portLabel}`);
  for (const entries of Object.values(os.networkInterfaces())) {
    for (const entry of entries || []) {
      if (entry.family === 'IPv4' && !entry.internal) {
        urls.add(`http://${entry.address}:${portLabel}`);
      }
    }
  }
  res.json({
    hostname: os.hostname(),
    port: portLabel,
    urls: [...urls]
  });
});

app.post('/api/auth/register', rateLimit(12, 60_000), async (req, res) => {
  const username = cleanUsername(req.body?.username);
  const password = String(req.body?.password || '');
  if (!usernameValid(username)) {
    return res.status(400).json({ error: '呼号需为 2-16 位中文、字母、数字、下划线或短横线。' });
  }
  if (password.length < 6 || password.length > 72) {
    return res.status(400).json({ error: '密码长度需在 6-72 位之间。' });
  }
  const usernameKey = username.toLowerCase();
  if (store.findUserByName(usernameKey)) {
    return res.status(409).json({ error: '这个呼号已经被其他飞行员占用了。' });
  }
  const { salt, hash } = await hashPassword(password);
  if (store.findUserByName(usernameKey)) {
    return res.status(409).json({ error: '这个呼号已经被其他飞行员占用了。' });
  }
  const user = store.createUser({ username, usernameKey, salt, hash });
  await store.save();
  res.status(201).json({
    token: issueToken(user.id, store.secret),
    user: serializeUser(user, store)
  });
});

app.post('/api/auth/login', rateLimit(20, 60_000), async (req, res) => {
  const username = cleanUsername(req.body?.username);
  const password = String(req.body?.password || '');
  const user = store.findUserByName(username.toLowerCase());
  if (!user || !(await verifyPassword(password, user.salt, user.hash))) {
    return res.status(401).json({ error: '呼号或密码不正确。' });
  }
  res.json({
    token: issueToken(user.id, store.secret),
    user: serializeUser(user, store)
  });
});

app.get('/api/me', requireAuth, (req, res) => {
  res.json({ user: serializeUser(req.user, store), online: io.engine?.clientsCount || 0 });
});

app.get('/api/leaderboard', (req, res) => {
  const requestedMode = String(req.query.mode || 'endless');
  const mode = ['campaign', 'mission', 'endless'].includes(requestedMode) ? requestedMode : 'endless';
  const rows = store.leaderboard(mode, 50);
  let self = null;
  const token = tokenFromRequest(req);
  const tokenData = token ? verifyToken(token, store.secret) : null;
  if (tokenData) {
    const user = store.getUser(tokenData.sub);
    if (user) {
      self = {
        rank: store.rankFor(user.id, mode),
        best: user.best?.[mode]?.score || 0,
        username: user.username
      };
    }
  }
  res.json({ mode, rows, self });
});

app.post('/api/scores', requireAuth, rateLimit(30, 60_000), async (req, res) => {
  const requestedMode = String(req.body?.mode || 'endless');
  const mode = ['campaign', 'mission', 'endless'].includes(requestedMode) ? requestedMode : 'endless';
  const score = Math.max(0, Math.min(50_000_000, Math.floor(Number(req.body?.score) || 0)));
  const kills = Math.max(0, Math.min(200_000, Math.floor(Number(req.body?.kills) || 0)));
  const wave = Math.max(1, Math.min(9999, Math.floor(Number(req.body?.wave) || 1)));
  const stage = Math.max(1, Math.min(999, Math.floor(Number(req.body?.stage) || 1)));
  const duration = Math.max(0, Math.min(86_400, Number(req.body?.duration) || 0));
  const stageCleared = Boolean(req.body?.stageCleared);
  const plane = PLANES.some((item) => item.id === req.body?.plane) ? req.body.plane : 'falcon';
  const skin = SKINS.some((item) => item.id === req.body?.skin) ? req.body.skin : 'chrome';

  const reasonableness = duration * 4500 + kills * 3000 + 20_000;
  if (score > reasonableness) {
    return res.status(400).json({ error: '飞行数据校验失败，请重新出击。' });
  }

  const creditsEarned = Math.min(300, Math.floor(score / 700) + kills * 2);
  const { isRecord, previous } = store.recordRun({
    user: req.user,
    mode,
    score,
    wave,
    kills,
    stage,
    stageCleared,
    duration,
    plane,
    skin,
    creditsEarned
  });
  await store.save();
  res.json({
    ok: true,
    isRecord,
    previousBest: previous?.score || 0,
    creditsEarned,
    rank: store.rankFor(req.user.id, mode),
    user: serializeUser(req.user, store)
  });
});

app.post('/api/progress', requireAuth, rateLimit(30, 60_000), async (req, res) => {
  const clearedStage = Math.max(1, Math.min(999, Math.floor(Number(req.body?.stage) || 1)));
  req.user.campaignStage = Math.max(req.user.campaignStage || 1, clearedStage + 1);
  await store.save();
  res.json({ ok: true, user: serializeUser(req.user, store) });
});

app.post('/api/redeem', requireAuth, rateLimit(12, 60_000), async (req, res) => {
  const result = redeemCode(req.user, req.body?.code);
  if (!result.ok) return res.status(400).json({ error: result.error });
  await store.save();
  res.json({
    ok: true,
    reward: result,
    user: serializeUser(req.user, store)
  });
});

app.post('/api/hangar/buy', requireAuth, rateLimit(20, 60_000), async (req, res) => {
  const type = req.body?.type === 'plane' ? 'plane' : 'skin';
  const id = String(req.body?.id || '');
  const item = type === 'plane' ? PLANES.find((entry) => entry.id === id) : SKINS.find((entry) => entry.id === id);
  if (!item || item.unlock !== 'purchase') {
    return res.status(400).json({ error: '这件装备无法直接购买。' });
  }
  const owned = type === 'plane' ? req.user.ownedPlanes : req.user.ownedSkins;
  if (owned.includes(id)) return res.status(400).json({ error: '你已经拥有这件装备。' });
  if (req.user.credits < item.price) {
    return res.status(400).json({ error: `星尘不足，还差 ${item.price - req.user.credits}。` });
  }
  req.user.credits -= item.price;
  owned.push(id);
  await store.save();
  res.json({ ok: true, user: serializeUser(req.user, store) });
});

app.post('/api/hangar/equip', requireAuth, async (req, res) => {
  const planeId = String(req.body?.plane || '');
  const skinId = String(req.body?.skin || '');
  if (planeId && !req.user.ownedPlanes.includes(planeId)) {
    return res.status(400).json({ error: '尚未解锁这架战机。' });
  }
  if (skinId && !req.user.ownedSkins.includes(skinId)) {
    return res.status(400).json({ error: '尚未解锁这套涂装。' });
  }
  if (planeId) req.user.equippedPlane = planeId;
  if (skinId) req.user.equippedSkin = skinId;
  await store.save();
  res.json({ ok: true, user: serializeUser(req.user, store) });
});

app.use('/shared', express.static(sharedDir, { fallthrough: false, maxAge: 0 }));
app.use(express.static(publicDir, { extensions: ['html'], maxAge: 0 }));
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/') || req.path.startsWith('/socket.io/')) return next();
  res.sendFile(path.join(publicDir, 'index.html'));
});

app.use((req, res) => {
  res.status(404).json({ error: 'Signal lost.' });
});

app.use((error, _req, res, _next) => {
  console.error('[api]', error);
  if (res.headersSent) return;
  res.status(error.status || 500).json({ error: error.message || '服务器开小差了。' });
});

attachDuelServer(io);
attachAir3DServer(io);

server.listen(port, '0.0.0.0', () => {
  console.log(`Sky Strike Arena online -> http://localhost:${port}`);
  const addresses = [];
  for (const entries of Object.values(os.networkInterfaces())) {
    for (const entry of entries || []) {
      if (entry.family === 'IPv4' && !entry.internal) addresses.push(entry.address);
    }
  }
  if (addresses.length) console.log(`LAN access -> http://${addresses[0]}:${port}`);
});

async function shutdown(signal) {
  console.log(`\n[server] ${signal} received, saving...`);
  try {
    await store.save();
  } catch (error) {
    console.error('[store] final save failed', error);
  }
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 3000).unref();
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
