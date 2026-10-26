import { PLANE_MAP, PVP, SKIN_MAP } from '../shared/catalog.js';

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const rooms = new Map();

function randomCode() {
  let code = '';
  for (let i = 0; i < 5; i += 1) {
    code += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  }
  return rooms.has(code) ? randomCode() : code;
}

function cleanName(value) {
  const name = String(value || '').replace(/[<>&"]/g, '').trim().slice(0, 18);
  return name || '匿名飞行员';
}

function makeProfile(payload) {
  const source = payload && typeof payload === 'object' ? payload : {};
  return {
    name: cleanName(source.name),
    plane: PLANE_MAP[source.plane] ? source.plane : 'falcon',
    skin: SKIN_MAP[source.skin] ? source.skin : 'chrome'
  };
}

function publicPlayers(room) {
  return room.players.map((player, index) => ({
    slot: index,
    name: player.profile.name,
    plane: player.profile.plane,
    skin: player.profile.skin
  }));
}

function roomPayload(room) {
  return {
    code: room.code,
    startAt: Date.now() + 3200,
    arena: { width: PVP.arenaWidth, height: PVP.arenaHeight },
    killsToWin: PVP.killsToWin,
    players: publicPlayers(room),
    scores: room.scores,
    hp: room.hp,
    round: room.round
  };
}

function send(socket, event, payload) {
  if (socket && socket.connected) socket.emit(event, payload);
}

function broadcast(room, event, payload) {
  for (const player of room.players) send(player.socket, event, payload);
}

function scheduleRelay(io, room, event, payload) {
  for (const player of room.players) {
    if (player.socket && player.socket.connected) {
      player.socket.emit(event, payload);
    }
  }
}

function allow(socket, bucket, limit, windowMs) {
  const now = Date.now();
  const state = socket.data.rate || (socket.data.rate = {});
  const entry = state[bucket];
  if (!entry || now - entry.start > windowMs) {
    state[bucket] = { start: now, count: 1 };
    return true;
  }
  entry.count += 1;
  return entry.count <= limit;
}

function clearRoomTimer(room) {
  if (room.timer) {
    clearTimeout(room.timer);
    room.timer = null;
  }
}

function beginCountdown(room, eventName = 'duel:matched', extra = {}) {
  clearRoomTimer(room);
  room.status = 'countdown';
  const payload = { ...roomPayload(room), ...extra };
  broadcast(room, eventName, payload);
  room.timer = setTimeout(() => {
    if (!rooms.has(room.code) || room.status !== 'countdown') return;
    room.status = 'playing';
    room.timer = null;
    broadcast(room, 'duel:go', {
      round: room.round,
      startAt: Date.now(),
      scores: room.scores,
      hp: room.hp
    });
  }, 3200);
}

function endRound(room, winnerSlot) {
  if (room.status !== 'playing') return;
  room.status = 'roundover';
  clearRoomTimer(room);
  room.scores[winnerSlot] += 1;
  const matchOver = room.scores[winnerSlot] >= PVP.killsToWin;
  if (matchOver) room.status = 'ended';

  broadcast(room, 'duel:roundend', {
    winnerSlot,
    scores: room.scores,
    hp: room.hp,
    round: room.round,
    matchOver
  });

  if (matchOver) return;

  room.timer = setTimeout(() => {
    if (!rooms.has(room.code) || room.players.length < 2) return;
    room.round += 1;
    room.hp = [PVP.maxHp, PVP.maxHp];
    room.status = 'countdown';
    broadcast(room, 'duel:roundstart', {
      round: room.round,
      scores: room.scores,
      hp: room.hp,
      startAt: Date.now() + 2600
    });
    room.timer = setTimeout(() => {
      if (!rooms.has(room.code) || room.players.length < 2) return;
      room.status = 'playing';
      room.timer = null;
      broadcast(room, 'duel:go', {
        round: room.round,
        startAt: Date.now(),
        scores: room.scores,
        hp: room.hp
      });
    }, 2600);
  }, 2400);
}

function destroyRoom(room, exceptSocket = null) {
  clearRoomTimer(room);
  rooms.delete(room.code);
  for (const player of room.players) {
    if (player.socket === exceptSocket) continue;
    if (player.socket) {
      send(player.socket, 'duel:opponentleft', { message: '对手已离开战场。' });
      player.socket.leave(`duel:${room.code}`);
      player.socket.data.duelCode = null;
    }
  }
}

function leaveCurrentRoom(socket) {
  const code = socket.data.duelCode;
  if (!code) return;
  const room = rooms.get(code);
  socket.data.duelCode = null;
  if (!room) return;
  destroyRoom(room, socket);
}

export function attachDuelServer(io) {
  io.on('connection', (socket) => {
    socket.data.duelCode = null;
    socket.data.rate = {};

    socket.on('duel:create', (payload, ack) => {
      leaveCurrentRoom(socket);
      const room = {
        code: randomCode(),
        players: [{ socket, profile: makeProfile(payload) }],
        status: 'waiting',
        scores: [0, 0],
        hp: [PVP.maxHp, PVP.maxHp],
        round: 1,
        timer: null,
        rematchVotes: new Set(),
        createdAt: Date.now()
      };
      rooms.set(room.code, room);
      socket.data.duelCode = room.code;
      socket.join(`duel:${room.code}`);
      if (typeof ack === 'function') {
        ack({ ok: true, code: room.code, slot: 0, room: roomPayload(room) });
      }
    });

    socket.on('duel:join', (payload, ack) => {
      const code = String(payload?.code || '').trim().toUpperCase();
      const room = rooms.get(code);
      if (!room) {
        if (typeof ack === 'function') ack({ ok: false, error: '房间不存在，或战斗已经结束。' });
        return;
      }
      if (room.players.length >= 2) {
        if (typeof ack === 'function') ack({ ok: false, error: '这间机库已经满员了。' });
        return;
      }
      if (room.status !== 'waiting') {
        if (typeof ack === 'function') ack({ ok: false, error: '战斗已经打响，请创建新的房间。' });
        return;
      }
      leaveCurrentRoom(socket);
      room.players.push({ socket, profile: makeProfile(payload) });
      socket.data.duelCode = room.code;
      socket.join(`duel:${room.code}`);
      room.hp = [PVP.maxHp, PVP.maxHp];
      room.scores = [0, 0];
      room.round = 1;
      if (typeof ack === 'function') {
        ack({ ok: true, code: room.code, slot: 1, room: roomPayload(room) });
      }
      beginCountdown(room);
    });

    socket.on('duel:quick', (payload, ack) => {
      const waiting = [...rooms.values()].find(
        (room) => room.status === 'waiting' && room.players.length === 1
      );
      if (waiting) {
        leaveCurrentRoom(socket);
        waiting.players.push({ socket, profile: makeProfile(payload) });
        socket.data.duelCode = waiting.code;
        socket.join(`duel:${waiting.code}`);
        waiting.hp = [PVP.maxHp, PVP.maxHp];
        waiting.scores = [0, 0];
        waiting.round = 1;
        if (typeof ack === 'function') {
          ack({ ok: true, code: waiting.code, slot: 1, room: roomPayload(waiting) });
        }
        beginCountdown(waiting);
        return;
      }
      const room = {
        code: randomCode(),
        players: [{ socket, profile: makeProfile(payload) }],
        status: 'waiting',
        scores: [0, 0],
        hp: [PVP.maxHp, PVP.maxHp],
        round: 1,
        timer: null,
        rematchVotes: new Set(),
        createdAt: Date.now()
      };
      rooms.set(room.code, room);
      socket.data.duelCode = room.code;
      socket.join(`duel:${room.code}`);
      if (typeof ack === 'function') {
        ack({ ok: true, code: room.code, slot: 0, room: roomPayload(room), waiting: true });
      }
    });

    socket.on('duel:leave', () => {
      leaveCurrentRoom(socket);
    });

    socket.on('duel:state', (payload) => {
      const room = rooms.get(socket.data.duelCode);
      if (!room || room.status !== 'playing') return;
      const slot = room.players.findIndex((player) => player.socket === socket);
      if (slot < 0) return;
      const x = Number(payload?.x);
      const y = Number(payload?.y);
      if (!Number.isFinite(x) || !Number.isFinite(y)) return;
      const opponent = room.players[1 - slot];
      send(opponent?.socket, 'duel:state', {
        slot,
        x: Math.max(0, Math.min(PVP.arenaWidth, x)),
        y: Math.max(0, Math.min(PVP.arenaHeight, y)),
        angle: Number(payload?.angle) || 0,
        thrust: Boolean(payload?.thrust),
        tick: Date.now()
      });
    });

    socket.on('duel:shot', (payload) => {
      const room = rooms.get(socket.data.duelCode);
      if (!room || room.status !== 'playing' || !allow(socket, 'shot', 45, 1000)) return;
      const slot = room.players.findIndex((player) => player.socket === socket);
      if (slot < 0) return;
      const opponent = room.players[1 - slot];
      send(opponent?.socket, 'duel:shot', {
        id: String(payload?.id || '').slice(0, 32),
        x: Number(payload?.x),
        y: Number(payload?.y),
        vx: Number(payload?.vx),
        vy: Number(payload?.vy),
        kind: String(payload?.kind || 'pulse').slice(0, 16)
      });
    });

    socket.on('duel:damage', () => {
      const room = rooms.get(socket.data.duelCode);
      if (!room || room.status !== 'playing' || !allow(socket, 'damage', 22, 1000)) return;
      const slot = room.players.findIndex((player) => player.socket === socket);
      if (slot < 0) return;
      room.hp[slot] = Math.max(0, room.hp[slot] - PVP.damage);
      broadcast(room, 'duel:damage', {
        targetSlot: slot,
        hp: room.hp,
        amount: PVP.damage
      });
      if (room.hp[slot] <= 0) endRound(room, 1 - slot);
    });

    socket.on('duel:rematch', () => {
      const room = rooms.get(socket.data.duelCode);
      if (!room || room.status !== 'ended' || room.players.length < 2) return;
      const slot = room.players.findIndex((player) => player.socket === socket);
      if (slot < 0) return;
      room.rematchVotes.add(slot);
      broadcast(room, 'duel:rematchvote', { votes: [...room.rematchVotes], slot });
      if (room.rematchVotes.size >= 2) {
        room.rematchVotes.clear();
        room.scores = [0, 0];
        room.hp = [PVP.maxHp, PVP.maxHp];
        room.round = 1;
        beginCountdown(room, 'duel:matched', { rematch: true });
      }
    });

    socket.on('disconnect', () => {
      leaveCurrentRoom(socket);
    });
  });

  setInterval(() => {
    const staleBefore = Date.now() - 1000 * 60 * 45;
    for (const room of rooms.values()) {
      if (room.createdAt < staleBefore && room.status !== 'playing') {
        destroyRoom(room);
      }
    }
  }, 1000 * 60 * 5).unref();
}
