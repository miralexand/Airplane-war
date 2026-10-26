import { PLANE_MAP, SKIN_MAP } from '../shared/catalog.js';

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
  return String(value || '').replace(/[<>&"]/g, '').trim().slice(0, 18) || '匿名飞行员';
}

function makeProfile(payload) {
  const source = payload && typeof payload === 'object' ? payload : {};
  return {
    name: cleanName(source.name),
    plane: PLANE_MAP[source.plane] ? source.plane : 'falcon',
    skin: SKIN_MAP[source.skin] ? source.skin : 'chrome'
  };
}

function roomPlayers(room) {
  return room.players.map((player, index) => ({
    slot: index,
    name: player.profile.name,
    plane: player.profile.plane,
    skin: player.profile.skin
  }));
}

function send(socket, event, payload) {
  if (socket?.connected) socket.emit(event, payload);
}

function broadcast(room, event, payload, exceptSocket = null) {
  for (const player of room.players) {
    if (player.socket !== exceptSocket) send(player.socket, event, payload);
  }
}

function allow(socket, bucket, limit, windowMs) {
  const now = Date.now();
  const state = socket.data.air3dRate || (socket.data.air3dRate = {});
  const entry = state[bucket];
  if (!entry || now - entry.start > windowMs) {
    state[bucket] = { start: now, count: 1 };
    return true;
  }
  entry.count += 1;
  return entry.count <= limit;
}

function destroyRoom(room, exceptSocket = null) {
  if (room.timer) clearTimeout(room.timer);
  rooms.delete(room.code);
  for (const player of room.players) {
    if (player.socket === exceptSocket) continue;
    if (player.socket) {
      send(player.socket, 'air3d:opponentleft', { message: '队友已离开 3D 战场。' });
      player.socket.leave(`air3d:${room.code}`);
      player.socket.data.air3dCode = null;
    }
  }
}

function leaveRoom(socket) {
  const code = socket.data.air3dCode;
  socket.data.air3dCode = null;
  const room = rooms.get(code);
  if (!room) return;
  destroyRoom(room, socket);
}

function findSlot(room, socket) {
  return room.players.findIndex((player) => player.socket === socket);
}

export function attachAir3DServer(io) {
  io.on('connection', (socket) => {
    socket.data.air3dCode = null;
    socket.data.air3dRate = {};

    socket.on('air3d:create', (payload, ack) => {
      leaveRoom(socket);
      const mode = payload?.mode === 'pvp' ? 'pvp' : 'coop';
      const room = {
        code: randomCode(),
        mode,
        players: [{ socket, profile: makeProfile(payload) }],
        status: 'waiting',
        timer: null,
        createdAt: Date.now()
      };
      rooms.set(room.code, room);
      socket.data.air3dCode = room.code;
      socket.join(`air3d:${room.code}`);
      if (typeof ack === 'function') {
        ack({ ok: true, code: room.code, slot: 0, mode, room: { code: room.code, mode, players: roomPlayers(room), status: 'waiting' } });
      }
    });

    socket.on('air3d:join', (payload, ack) => {
      const code = String(payload?.code || '').trim().toUpperCase();
      const room = rooms.get(code);
      if (!room) {
        if (typeof ack === 'function') ack({ ok: false, error: '3D 房间不存在或已经解散。' });
        return;
      }
      if (room.players.some((player) => player.socket === socket)) {
        if (typeof ack === 'function') ack({ ok: false, error: '你已经是这个房间的房主。' });
        return;
      }
      if (room.players.length >= 2) {
        if (typeof ack === 'function') ack({ ok: false, error: '这个 3D 房间已经满员。' });
        return;
      }
      if (room.status !== 'waiting') {
        if (typeof ack === 'function') ack({ ok: false, error: '战斗已经开始，请创建新房间。' });
        return;
      }
      leaveRoom(socket);
      room.players.push({ socket, profile: makeProfile(payload) });
      socket.data.air3dCode = room.code;
      socket.join(`air3d:${room.code}`);
      room.status = 'countdown';
      const startAt = Date.now() + 3600;
      const matched = {
        code: room.code,
        mode: room.mode,
        startAt,
        hostSlot: 0,
        players: roomPlayers(room)
      };
      if (typeof ack === 'function') {
        ack({ ok: true, code: room.code, slot: 1, mode: room.mode, startAt, room: matched });
      }
      broadcast(room, 'air3d:matched', matched);
      room.timer = setTimeout(() => {
        if (!rooms.has(room.code)) return;
        room.status = 'active';
        room.timer = null;
        broadcast(room, 'air3d:go', { mode: room.mode, startAt: Date.now() });
      }, 3600);
    });

    socket.on('air3d:leave', () => {
      leaveRoom(socket);
    });

    socket.on('air3d:state', (payload) => {
      const room = rooms.get(socket.data.air3dCode);
      if (!room || room.status !== 'active' || !allow(socket, 'state', 40, 1000)) return;
      const slot = findSlot(room, socket);
      if (slot < 0) return;
      const opponent = room.players[1 - slot];
      send(opponent?.socket, 'air3d:state', {
        slot,
        x: Number(payload?.x) || 0,
        y: Number(payload?.y) || 0,
        z: Number(payload?.z) || 0,
        qx: Number(payload?.qx) || 0,
        qy: Number(payload?.qy) || 0,
        qz: Number(payload?.qz) || 0,
        qw: Number.isFinite(Number(payload?.qw)) ? Number(payload.qw) : 1,
        speed: Number(payload?.speed) || 0
      });
    });

    socket.on('air3d:snapshot', (payload) => {
      const room = rooms.get(socket.data.air3dCode);
      if (!room || room.status !== 'active' || room.mode !== 'coop' && room.mode !== 'pvp') return;
      const slot = findSlot(room, socket);
      if (slot !== 0 || !allow(socket, 'snapshot', 16, 1000)) return;
      const opponent = room.players[1];
      send(opponent?.socket, 'air3d:snapshot', payload);
    });

    socket.on('air3d:enemyHit', (payload) => {
      const room = rooms.get(socket.data.air3dCode);
      if (!room || room.status !== 'active' || room.mode !== 'coop' || !allow(socket, 'hit', 40, 1000)) return;
      const slot = findSlot(room, socket);
      if (slot !== 1) return;
      send(room.players[0]?.socket, 'air3d:enemyHit', {
        id: String(payload?.id || '').slice(0, 32),
        damage: Math.max(0, Math.min(200, Number(payload?.damage) || 0))
      });
    });

    socket.on('air3d:fx', (payload) => {
      const room = rooms.get(socket.data.air3dCode);
      if (!room || room.status !== 'active' || !allow(socket, 'fx', 45, 1000)) return;
      const slot = findSlot(room, socket);
      if (slot < 0) return;
      const opponent = room.players[1 - slot];
      send(opponent?.socket, 'air3d:fx', {
        type: payload?.type === 'missile' ? 'missile' : 'tracer',
        start: Array.isArray(payload?.start) ? payload.start.slice(0, 3).map(Number) : null,
        end: Array.isArray(payload?.end) ? payload.end.slice(0, 3).map(Number) : null,
        color: String(payload?.color || '#ffbc75').slice(0, 16)
      });
    });

    socket.on('air3d:pvpHit', (payload) => {
      const room = rooms.get(socket.data.air3dCode);
      if (!room || room.status !== 'active' || room.mode !== 'pvp' || !allow(socket, 'pvpHit', 25, 1000)) return;
      const slot = findSlot(room, socket);
      if (slot !== 1) return;
      send(room.players[0]?.socket, 'air3d:pvpHit', {
        damage: Math.max(0, Math.min(80, Number(payload?.damage) || 0))
      });
    });

    socket.on('air3d:end', (payload) => {
      const room = rooms.get(socket.data.air3dCode);
      if (!room || !allow(socket, 'end', 5, 1000)) return;
      const slot = findSlot(room, socket);
      if (slot !== 0) return;
      const opponent = room.players[1];
      send(opponent?.socket, 'air3d:end', payload || {});
    });

    socket.on('disconnect', () => {
      leaveRoom(socket);
    });
  });

  setInterval(() => {
    const stale = Date.now() - 1000 * 60 * 30;
    for (const room of rooms.values()) {
      if (room.createdAt < stale && room.status !== 'active') destroyRoom(room);
    }
  }, 1000 * 60 * 5).unref();
}
