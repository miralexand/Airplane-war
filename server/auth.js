import { createHmac, randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scryptAsync = promisify(scrypt);
const TOKEN_TTL = 1000 * 60 * 60 * 24 * 30;

function base64url(value) {
  return Buffer.from(value).toString('base64url');
}

function sign(payload, secret) {
  return createHmac('sha256', secret).update(payload).digest('base64url');
}

export async function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const derived = await scryptAsync(password, salt, 64);
  return { salt, hash: Buffer.from(derived).toString('hex') };
}

export async function verifyPassword(password, salt, hash) {
  const derived = Buffer.from(await scryptAsync(password, salt, 64));
  const expected = Buffer.from(hash, 'hex');
  return derived.length === expected.length && timingSafeEqual(derived, expected);
}

export function issueToken(userId, secret) {
  const payload = base64url(
    JSON.stringify({
      sub: userId,
      iat: Date.now(),
      exp: Date.now() + TOKEN_TTL
    })
  );
  return `${payload}.${sign(payload, secret)}`;
}

export function verifyToken(token, secret) {
  if (typeof token !== 'string' || !token.includes('.')) return null;
  const [payload, signature] = token.split('.');
  const expected = sign(payload, secret);
  const a = Buffer.from(signature || '');
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (!data.sub || !data.exp || data.exp < Date.now()) return null;
    return data;
  } catch {
    return null;
  }
}

export function tokenFromRequest(req) {
  const header = req.headers.authorization || '';
  return header.startsWith('Bearer ') ? header.slice(7) : '';
}

export function authMiddleware(store) {
  return (req, _res, next) => {
    const data = verifyToken(tokenFromRequest(req), store.secret);
    if (data) {
      req.user = store.getUser(data.sub);
    }
    next();
  };
}

export function requireAuth(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: '请先登录飞行员账号。' });
  }
  next();
}

export function serializeUser(user, store) {
  if (!user) return null;
  return {
    id: user.id,
    username: user.username,
    createdAt: user.createdAt,
    credits: user.credits,
    bestEndless: user.best?.endless?.score || 0,
    bestCampaign: user.best?.campaign?.score || 0,
    bestMission: user.best?.mission?.score || 0,
    campaignStage: user.campaignStage || 1,
    totalKills: user.totalKills || 0,
    totalScore: user.totalScore || 0,
    games: user.games || 0,
    ownedPlanes: user.ownedPlanes || ['falcon', 'viper', 'titan'],
    ownedSkins: user.ownedSkins || ['chrome'],
    equippedPlane: user.equippedPlane || 'falcon',
    equippedSkin: user.equippedSkin || 'chrome',
    redeemedCount: user.redeemed?.length || 0,
    rankEndless: store.rankFor(user.id, 'endless'),
    rankCampaign: store.rankFor(user.id, 'campaign'),
    rankMission: store.rankFor(user.id, 'mission')
  };
}
