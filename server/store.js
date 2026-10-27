import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { randomBytes, randomUUID } from 'node:crypto';
import path from 'node:path';

const MAX_RUNS = 5000;

function freshState() {
  return {
    version: 1,
    secret: randomBytes(32).toString('hex'),
    createdAt: new Date().toISOString(),
    users: {},
    runs: []
  };
}

function normalizeState(input) {
  const state = input && typeof input === 'object' ? input : {};
  return {
    ...freshState(),
    ...state,
    users: state.users && typeof state.users === 'object' ? state.users : {},
    runs: Array.isArray(state.runs) ? state.runs : []
  };
}

export class Store {
  constructor(dataDir = process.env.DATA_DIR || 'data') {
    this.dataDir = path.resolve(dataDir);
    this.file = path.join(this.dataDir, 'sky-strike.json');
    this.data = freshState();
    this.writeChain = Promise.resolve();
  }

  async init() {
    await mkdir(this.dataDir, { recursive: true });
    try {
      const raw = await readFile(this.file, 'utf8');
      this.data = normalizeState(JSON.parse(raw));
    } catch (error) {
      if (error.code !== 'ENOENT') {
        console.error('[store] Could not read data file, starting fresh:', error.message);
      }
      await this.save();
    }
  }

  get secret() {
    return this.data.secret;
  }

  findUserByName(usernameKey) {
    return Object.values(this.data.users).find((user) => user.usernameKey === usernameKey) || null;
  }

  getUser(id) {
    return this.data.users[id] || null;
  }

  createUser({ username, usernameKey, salt, hash }) {
    const now = new Date().toISOString();
    const user = {
      id: randomUUID(),
      username,
      usernameKey,
      salt,
      hash,
      createdAt: now,
      credits: 300,
      best: { endless: null, campaign: null, mission: null },
      campaignStage: 1,
      totalKills: 0,
      totalScore: 0,
      games: 0,
      ownedPlanes: ['falcon', 'viper', 'titan', 'bastion'],
      ownedSkins: ['chrome'],
      equippedPlane: 'falcon',
      equippedSkin: 'chrome',
      redeemed: []
    };
    this.data.users[user.id] = user;
    return user;
  }

  updateUser(id, updater) {
    const user = this.getUser(id);
    if (!user) return null;
    updater(user);
    return user;
  }

  recordRun({ user, mode, score, wave, kills, stage, stageCleared, duration, plane, skin, creditsEarned }) {
    if (!user.best) user.best = { endless: null, campaign: null, mission: null };
    const previous = user.best[mode];
    const isRecord = !previous || score > previous.score;
    const now = new Date().toISOString();

    user.games += 1;
    user.totalKills += kills;
    user.totalScore += score;
    user.credits += creditsEarned;

    if (mode === 'campaign') {
      const unlockedStage = (stage || 1) + (stageCleared ? 1 : 0);
      user.campaignStage = Math.max(user.campaignStage || 1, unlockedStage);
    }

    if (isRecord) {
      user.best[mode] = {
        score,
        wave,
        kills,
        stage,
        duration,
        plane,
        skin,
        date: now
      };
      const run = {
        id: randomUUID(),
        userId: user.id,
        username: user.username,
        mode,
        score,
        wave,
        kills,
        stage,
        duration,
        plane,
        skin,
        createdAt: now
      };
      const existing = this.data.runs.findIndex((item) => item.userId === user.id && item.mode === mode);
      if (existing >= 0) {
        this.data.runs.splice(existing, 1, run);
      } else {
        this.data.runs.push(run);
      }
      if (this.data.runs.length > MAX_RUNS) {
        this.data.runs.sort((a, b) => b.score - a.score);
        this.data.runs.length = MAX_RUNS;
      }
    }

    return { isRecord, previous };
  }

  leaderboard(mode, limit = 50) {
    return this.data.runs
      .filter((run) => run.mode === mode)
      .sort((a, b) => b.score - a.score || b.kills - a.kills || new Date(a.createdAt) - new Date(b.createdAt))
      .slice(0, limit)
      .map((run, index) => ({
        rank: index + 1,
        username: run.username,
        score: run.score,
        wave: run.wave || 1,
        kills: run.kills || 0,
        stage: run.stage || 1,
        plane: run.plane || 'falcon',
        skin: run.skin || 'chrome',
        date: run.createdAt
      }));
  }

  rankFor(userId, mode) {
    const rows = this.data.runs
      .filter((run) => run.mode === mode)
      .sort((a, b) => b.score - a.score || b.kills - a.kills);
    const index = rows.findIndex((run) => run.userId === userId);
    return index >= 0 ? index + 1 : null;
  }

  save() {
    const payload = JSON.stringify(this.data, null, 2);
    const tempFile = `${this.file}.tmp`;
    this.writeChain = this.writeChain
      .catch(() => {})
      .then(async () => {
        await writeFile(tempFile, payload, 'utf8');
        await rename(tempFile, this.file);
      });
    return this.writeChain;
  }
}
