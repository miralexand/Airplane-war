import { AIR_MAPS, PLANE_MAP, SKIN_MAP } from '../shared/catalog.js';

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const MAX_PLAYERS = 5;
const MAP_IDS = new Set(AIR_MAPS.map((map) => map.id));
const rooms = new Map();

function normalizeMap(value) {
  return MAP_IDS.has(value) ? value : 'blacksky';
}

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

function maxHpFor(planeId) {
  return PLANE_MAP[planeId]?.loadout?.hp || 110;
}

function sortPlayers(room) {
  return room.players.filter((player) => !player.left).slice().sort((a, b) => a.slot - b.slot);
}

function roomPlayers(room) {
  return sortPlayers(room).map((player) => ({
    slot: player.slot,
    name: player.profile.name,
    plane: player.profile.plane,
    skin: player.profile.skin,
    hp: player.hp,
    maxHp: player.maxHp,
    alive: player.alive !== false,
    kills: player.kills || 0,
    ready: Boolean(player.ready),
    returned: Boolean(player.returned)
  }));
}

function roomPayload(room) {
  return {
    code: room.code,
    mode: room.mode,
    map: normalizeMap(room.map),
    status: room.status,
    hostSlot: 0,
    maxPlayers: MAX_PLAYERS,
    players: roomPlayers(room)
  };
}

function freeSlot(room) {
  for (let slot = 0; slot < MAX_PLAYERS; slot += 1) {
    if (!room.players.some((player) => player.slot === slot)) return slot;
  }
  return -1;
}

function send(socket, event, payload) {
  if (socket?.connected) socket.emit(event, payload);
}

function broadcast(room, event, payload, exceptSocket = null) {
  for (const player of room.players) {
    if (player.left || player.socket === exceptSocket) continue;
    send(player.socket, event, payload);
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

function destroyRoom(room, message = '房间已解散。') {
  if (room.timer) clearTimeout(room.timer);
  rooms.delete(room.code);
  for (const player of room.players) {
    if (player.left || !player.socket) continue;
    send(player.socket, 'air3d:opponentleft', { message });
    player.socket.leave(`air3d:${room.code}`);
    player.socket.data.air3dCode = null;
  }
}

function resetRoomToWaiting(room) {
  if (room.timer) clearTimeout(room.timer);
  room.timer = null;
  room.status = 'waiting';
  for (const player of room.players) {
    player.hp = player.maxHp || maxHpFor(player.profile.plane);
    player.maxHp = player.maxHp || maxHpFor(player.profile.plane);
    player.alive = true;
    player.kills = 0;
    player.ready = false;
    player.returned = false;
  }
}

function maybeReopenRoom(room) {
  if (!room || !['active', 'ended'].includes(room.status)) return false;
  const players = sortPlayers(room);
  if (!players.length) return false;
  if (room.status === 'ended' && players.every((player) => player.returned)) {
    resetRoomToWaiting(room);
    broadcast(room, 'air3d:room', roomPayload(room));
    return true;
  }
  broadcast(room, 'air3d:room', roomPayload(room));
  return false;
}

function startRoom(room) {
  if (room.status !== 'waiting') return false;
  const players = sortPlayers(room);
  if (players.length < 2) return false;
  if (!players.every((player) => player.ready)) return false;
  for (const player of players) {
    player.maxHp = maxHpFor(player.profile.plane);
    player.hp = player.maxHp;
    player.alive = true;
    player.kills = 0;
    player.ready = false;
    player.returned = false;
  }
  room.status = 'countdown';
  const startAt = Date.now() + 3600;
  const matched = {
    code: room.code,
    mode: room.mode,
    map: normalizeMap(room.map),
    startAt,
    hostSlot: 0,
    maxPlayers: MAX_PLAYERS,
    players: roomPlayers(room)
  };
  broadcast(room, 'air3d:matched', matched);
  room.timer = setTimeout(() => {
    if (!rooms.has(room.code)) return;
    room.status = 'active';
    room.timer = null;
    broadcast(room, 'air3d:go', { mode: room.mode, startAt: Date.now() });
  }, 3600);
  return true;
}

function endPvpRoom(room) {
  if (room.status !== 'active') return;
  const alive = sortPlayers(room).filter((player) => player.alive !== false);
  if (alive.length > 1) return;
  room.status = 'ended';
  if (room.timer) clearTimeout(room.timer);
  for (const player of sortPlayers(room)) player.returned = false;
  broadcast(room, 'air3d:end', {
    serverResult: true,
    pvp: true,
    networkMode: 'pvp',
    winnerSlot: alive[0]?.slot ?? -1,
    players: roomPlayers(room)
  });
}

function findSlot(room, socket) {
  return room.players.find((player) => player.socket === socket)?.slot ?? -1;
}

function leaveRoom(socket, message = null) {
  const code = socket.data.air3dCode;
  socket.data.air3dCode = null;
  const room = rooms.get(code);
  if (!room) return;
  const player = room.players.find((entry) => entry.socket === socket);
  if (!player) return;
  if (player.slot === 0) {
    destroyRoom(room, message || '房主已离开，3D 房间解散。');
    return;
  }
  player.left = true;
  room.players = room.players.filter((entry) => entry !== player);
  socket.leave(`air3d:${room.code}`);

  if (!room.players.length) {
    rooms.delete(room.code);
    if (room.timer) clearTimeout(room.timer);
    return;
  }

  if (room.status === 'waiting') {
    broadcast(room, 'air3d:room', roomPayload(room));
    return;
  }

  if (room.status === 'ended') {
    if (!sortPlayers(room).length) {
      destroyRoom(room);
      return;
    }
    maybeReopenRoom(room);
    return;
  }

  if (room.status === 'countdown' && sortPlayers(room).length < 2) {
    destroyRoom(room, '人数不足，3D 房间已解散。');
    return;
  }

  broadcast(room, 'air3d:playerleft', {
    slot: player.slot,
    name: player.profile.name,
    message: `${player.profile.name} 已离开战场。`
  });
  if (room.mode === 'pvp' && room.status === 'active') {
    player.alive = false;
    endPvpRoom(room);
  }
}

export function attachAir3DServer(io) {
  io.on('connection', (socket) => {
    socket.data.air3dCode = null;
    socket.data.air3dRate = {};

    socket.on('air3d:create', (payload, ack) => {
      leaveRoom(socket);
      const mode = payload?.mode === 'pvp' ? 'pvp' : 'coop';
      const profile = makeProfile(payload);
      const maxHp = maxHpFor(profile.plane);
      const room = {
        code: randomCode(),
        mode,
        map: normalizeMap(payload?.map),
        players: [{
          slot: 0,
          socket,
          profile,
          hp: maxHp,
          maxHp,
          alive: true,
          kills: 0,
          ready: false,
          returned: false,
          left: false
        }],
        status: 'waiting',
        timer: null,
        createdAt: Date.now()
      };
      rooms.set(room.code, room);
      socket.data.air3dCode = room.code;
      socket.join(`air3d:${room.code}`);
      if (typeof ack === 'function') {
        ack({ ok: true, code: room.code, slot: 0, mode, maxPlayers: MAX_PLAYERS, room: roomPayload(room) });
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
        if (typeof ack === 'function') ack({ ok: false, error: '你已经在这个房间里。' });
        return;
      }
      if (sortPlayers(room).length >= MAX_PLAYERS) {
        if (typeof ack === 'function') ack({ ok: false, error: `这个 3D 房间已经满员（最多 ${MAX_PLAYERS} 人）。` });
        return;
      }
      if (room.status !== 'waiting') {
        if (typeof ack === 'function') ack({ ok: false, error: '战斗已经开始，请创建新房间。' });
        return;
      }
      leaveRoom(socket);
      const profile = makeProfile(payload);
      const maxHp = maxHpFor(profile.plane);
      const slot = freeSlot(room);
      for (const player of sortPlayers(room)) player.ready = false;
      room.players.push({
        slot,
        socket,
        profile,
        hp: maxHp,
        maxHp,
        alive: true,
        kills: 0,
        ready: false,
        returned: false,
        left: false
      });
      socket.data.air3dCode = room.code;
      socket.join(`air3d:${room.code}`);
      if (typeof ack === 'function') {
        ack({ ok: true, code: room.code, slot, mode: room.mode, maxPlayers: MAX_PLAYERS, room: roomPayload(room) });
      }
      broadcast(room, 'air3d:room', roomPayload(room));
    });

    socket.on('air3d:start', (payload, ack) => {
      const room = rooms.get(socket.data.air3dCode);
      const slot = room ? findSlot(room, socket) : -1;
      if (!room || slot !== 0) {
        if (typeof ack === 'function') ack({ ok: false, error: '只有房主可以开始战斗。' });
        return;
      }
      if (sortPlayers(room).length < 2) {
        if (typeof ack === 'function') ack({ ok: false, error: '至少需要 2 名飞行员才能开始。' });
        return;
      }
      if (room.status !== 'waiting') {
        if (typeof ack === 'function') ack({ ok: false, error: '当前无法开始战斗。' });
        return;
      }
      if (!sortPlayers(room).every((player) => player.ready)) {
        if (typeof ack === 'function') ack({ ok: false, error: '全体飞行员准备后才能开始。' });
        return;
      }
      const started = startRoom(room);
      if (typeof ack === 'function') ack({ ok: started });
    });

    socket.on('air3d:ready', (payload, ack) => {
      const room = rooms.get(socket.data.air3dCode);
      const slot = room ? findSlot(room, socket) : -1;
      if (!room || slot < 0) {
        if (typeof ack === 'function') ack({ ok: false, error: '你不在这个房间中。' });
        return;
      }
      if (room.status !== 'waiting') {
        if (typeof ack === 'function') ack({ ok: false, error: '战斗已经开始，暂时无法准备。' });
        return;
      }
      const player = room.players.find((entry) => entry.slot === slot);
      if (!player) return;
      player.ready = Boolean(payload?.ready);
      broadcast(room, 'air3d:room', roomPayload(room));
      if (typeof ack === 'function') ack({ ok: true });
    });

    socket.on('air3d:map', (payload, ack) => {
      const room = rooms.get(socket.data.air3dCode);
      const slot = room ? findSlot(room, socket) : -1;
      if (!room || slot !== 0) {
        if (typeof ack === 'function') ack({ ok: false, error: '只有房主可以选择地图。' });
        return;
      }
      if (room.status !== 'waiting') {
        if (typeof ack === 'function') ack({ ok: false, error: '战斗已经开始，无法更换地图。' });
        return;
      }
      room.map = normalizeMap(payload?.map);
      broadcast(room, 'air3d:room', roomPayload(room));
      if (typeof ack === 'function') ack({ ok: true });
    });

    socket.on('air3d:return', (payload, ack) => {
      const room = rooms.get(socket.data.air3dCode);
      const slot = room ? findSlot(room, socket) : -1;
      if (!room || slot < 0) {
        if (typeof ack === 'function') ack({ ok: false, error: '房间已经解散。' });
        return;
      }
      const player = room.players.find((entry) => entry.slot === slot);
      if (!player) return;
      if (room.status === 'ended' || room.status === 'active') {
        player.returned = true;
        maybeReopenRoom(room);
      }
      if (typeof ack === 'function') ack({ ok: true });
    });

    socket.on('air3d:leave', () => {
      leaveRoom(socket);
    });

    socket.on('air3d:state', (payload) => {
      const room = rooms.get(socket.data.air3dCode);
      if (!room || room.status !== 'active' || !allow(socket, 'state', 40, 1000)) return;
      const slot = findSlot(room, socket);
      if (slot < 0) return;
      broadcast(room, 'air3d:state', {
        slot,
        x: Number(payload?.x) || 0,
        y: Number(payload?.y) || 0,
        z: Number(payload?.z) || 0,
        qx: Number(payload?.qx) || 0,
        qy: Number(payload?.qy) || 0,
        qz: Number(payload?.qz) || 0,
        qw: Number.isFinite(Number(payload?.qw)) ? Number(payload.qw) : 1,
        speed: Number(payload?.speed) || 0
      }, socket);
    });

    socket.on('air3d:snapshot', (payload) => {
      const room = rooms.get(socket.data.air3dCode);
      if (!room || room.status !== 'active' || room.mode !== 'coop' || !allow(socket, 'snapshot', 16, 1000)) return;
      if (findSlot(room, socket) !== 0) return;
      broadcast(room, 'air3d:snapshot', payload, socket);
    });

    socket.on('air3d:enemyHit', (payload) => {
      const room = rooms.get(socket.data.air3dCode);
      if (!room || room.status !== 'active' || room.mode !== 'coop' || !allow(socket, 'hit', 40, 1000)) return;
      const slot = findSlot(room, socket);
      if (slot <= 0) return;
      const host = room.players.find((player) => player.slot === 0);
      send(host?.socket, 'air3d:enemyHit', {
        id: String(payload?.id || '').slice(0, 32),
        damage: Math.max(0, Math.min(200, Number(payload?.damage) || 0))
      });
    });

    socket.on('air3d:fx', (payload) => {
      const room = rooms.get(socket.data.air3dCode);
      if (!room || room.status !== 'active' || !allow(socket, 'fx', 45, 1000)) return;
      const slot = findSlot(room, socket);
      if (slot < 0) return;
      broadcast(room, 'air3d:fx', {
        slot,
        type: payload?.type === 'missile' ? 'missile' : 'tracer',
        start: Array.isArray(payload?.start) ? payload.start.slice(0, 3).map(Number) : null,
        end: Array.isArray(payload?.end) ? payload.end.slice(0, 3).map(Number) : null,
        color: String(payload?.color || '#ffbc75').slice(0, 16)
      }, socket);
    });

    socket.on('air3d:pvpHit', (payload) => {
      const room = rooms.get(socket.data.air3dCode);
      if (!room || room.status !== 'active' || room.mode !== 'pvp' || !allow(socket, 'pvpHit', 30, 1000)) return;
      const attackerSlot = findSlot(room, socket);
      if (attackerSlot < 0) return;
      const targetSlot = Number(payload?.targetSlot);
      if (!Number.isInteger(targetSlot) || targetSlot === attackerSlot) return;
      const attacker = room.players.find((player) => player.slot === attackerSlot);
      const target = room.players.find((player) => player.slot === targetSlot);
      if (!attacker || !target || target.alive === false || target.left) return;
      const damage = Math.max(0, Math.min(90, Number(payload?.damage) || 0));
      if (damage <= 0) return;
      target.hp = Math.max(0, target.hp - damage);
      broadcast(room, 'air3d:pvpHit', {
        targetSlot,
        hp: target.hp,
        bySlot: attackerSlot,
        damage
      });
      if (target.hp <= 0) {
        target.alive = false;
        attacker.kills = (attacker.kills || 0) + 1;
        broadcast(room, 'air3d:pvpDeath', {
          targetSlot,
          bySlot: attackerSlot,
          kills: attacker.kills,
          players: roomPlayers(room)
        });
        endPvpRoom(room);
      }
    });

    socket.on('air3d:crash', (payload, ack) => {
      const room = rooms.get(socket.data.air3dCode);
      if (!room || room.status !== 'active' || room.mode !== 'pvp' || !allow(socket, 'crash', 3, 1000)) {
        if (typeof ack === 'function') ack({ ok: false });
        return;
      }
      const slot = findSlot(room, socket);
      if (slot < 0) {
        if (typeof ack === 'function') ack({ ok: false });
        return;
      }
      const player = room.players.find((entry) => entry.slot === slot);
      if (!player || player.alive === false) {
        if (typeof ack === 'function') ack({ ok: true });
        return;
      }
      player.hp = 0;
      player.alive = false;
      broadcast(room, 'air3d:pvpDeath', {
        targetSlot: slot,
        bySlot: -1,
        kills: player.kills || 0,
        players: roomPlayers(room)
      });
      endPvpRoom(room);
      if (typeof ack === 'function') ack({ ok: true });
    });

    socket.on('air3d:end', (payload) => {
      const room = rooms.get(socket.data.air3dCode);
      if (!room || !allow(socket, 'end', 5, 1000)) return;
      if (findSlot(room, socket) !== 0) return;
      if (room.status === 'active') {
        room.status = 'ended';
        if (room.timer) clearTimeout(room.timer);
        for (const player of sortPlayers(room)) player.returned = false;
      }
      broadcast(room, 'air3d:end', payload || {}, socket);
    });

    socket.on('disconnect', () => {
      leaveRoom(socket);
    });
  });

  setInterval(() => {
    const stale = Date.now() - 1000 * 60 * 30;
    for (const room of [...rooms.values()]) {
      if (room.createdAt < stale && room.status !== 'active') destroyRoom(room);
    }
  }, 1000 * 60 * 5).unref();
}
