import http from 'node:http';
import { createReadStream, existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes, randomUUID } from 'node:crypto';
import { WebSocketServer, WebSocket } from 'ws';
import { CARDS, HEROES, TURN_SECONDS, getHero } from '../shared/content.js';
import {
  createGame, getLegalActions, resolveRound, sanitizeState, validateAction,
} from '../shared/engine.js';
import { chooseTimeoutAction } from '../shared/ai.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const PORT = Number(process.env.PORT || 3000);
const DATA_DIR = process.env.PALIMPSEST_DATA_DIR ? path.resolve(process.env.PALIMPSEST_DATA_DIR) : path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'players.json');
const REVEAL_MS = 4200;
const RECONNECT_GRACE_MS = 60_000;
const ROOM_IDLE_MS = 20 * 60_000;

mkdirSync(DATA_DIR, { recursive: true });

const ARCHIVE_BOTS = [
  { id: 'bot-oracle', name: 'ОРАКУЛ', rating: 1542, wins: 91, losses: 38, draws: 4, games: 133, isBot: true },
  { id: 'bot-mnemon', name: 'МНЕМОН', rating: 1387, wins: 64, losses: 41, draws: 2, games: 107, isBot: true },
  { id: 'bot-redactor', name: 'КРАСНАЯ СТРОКА', rating: 1264, wins: 48, losses: 35, draws: 6, games: 89, isBot: true },
  { id: 'bot-reader', name: 'ЧИТАТЕЛЬ', rating: 1096, wins: 27, losses: 29, draws: 3, games: 59, isBot: true },
];

function loadPlayers() {
  try {
    return JSON.parse(readFileSync(DATA_FILE, 'utf8'));
  } catch {
    return { players: {} };
  }
}

const database = loadPlayers();
database.players ||= {};
let saveTimer = null;
function saveDatabase() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    const temporary = `${DATA_FILE}.tmp`;
    writeFileSync(temporary, JSON.stringify(database, null, 2));
    renameSync(temporary, DATA_FILE);
  }, 80);
}

const cleanName = (value) => String(value || '').replace(/[<>\u0000-\u001f]/g, '').trim().slice(0, 18) || 'БЕЗЫМЯННЫЙ';
const publicProfile = (player) => ({
  id: player.id, name: player.name, rating: player.rating, wins: player.wins || 0,
  losses: player.losses || 0, draws: player.draws || 0, games: player.games || 0,
  bestRating: player.bestRating || player.rating, isBot: Boolean(player.isBot),
});

function createPlayer(name) {
  const id = randomUUID();
  const token = randomBytes(24).toString('base64url');
  const player = {
    id, token, name: cleanName(name || `РЕДАКТОР-${id.slice(0, 4).toUpperCase()}`),
    rating: 1000, bestRating: 1000, wins: 0, losses: 0, draws: 0, games: 0,
    createdAt: Date.now(), lastSeen: Date.now(),
  };
  database.players[token] = player;
  saveDatabase();
  return player;
}

function findPlayerById(id) {
  return Object.values(database.players).find((player) => player.id === id) || null;
}

const server = http.createServer((request, response) => {
  const url = new URL(request.url, `http://${request.headers.host || 'localhost'}`);
  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  response.setHeader('Cache-Control', 'no-store');
  if (request.method === 'OPTIONS') {
    response.writeHead(204);
    response.end();
    return;
  }

  if (url.pathname === '/api/health') {
    sendJson(response, { ok: true, name: 'Palimpsest Echo Authority', time: Date.now(), version: '1.0.0' });
    return;
  }
  if (url.pathname === '/api/leaderboard') {
    const humans = Object.values(database.players).map(publicProfile);
    const ranking = [...humans, ...ARCHIVE_BOTS]
      .sort((a, b) => b.rating - a.rating || b.wins - a.wins)
      .slice(0, 50)
      .map((player, index) => ({ ...player, position: index + 1 }));
    sendJson(response, { ranking, updatedAt: Date.now() });
    return;
  }
  if (url.pathname === '/api/stats') {
    const profiles = Object.values(database.players);
    sendJson(response, {
      online: new Set([...clients.values()].filter((client) => client.player).map((client) => client.player.id)).size,
      activeDuels: [...rooms.values()].filter((room) => room.phase === 'select' || room.phase === 'reveal').length,
      openRooms: [...rooms.values()].filter((room) => room.phase === 'waiting' && !room.private).length,
      registered: profiles.length,
      games: profiles.reduce((sum, player) => sum + (player.games || 0), 0),
      season: { id: 'S01', name: 'Город после точки', endsAt: '2026-12-15T00:00:00.000Z' },
    });
    return;
  }
  if (url.pathname.startsWith('/api/profile/')) {
    const player = findPlayerById(url.pathname.split('/').pop());
    if (!player) {
      sendJson(response, { error: 'Профиль не найден' }, 404);
      return;
    }
    sendJson(response, { profile: publicProfile(player) });
    return;
  }
  if (url.pathname === '/api/lobby') {
    sendJson(response, { rooms: openRooms() });
    return;
  }

  const dist = path.join(ROOT, 'dist');
  if (!existsSync(dist)) {
    sendJson(response, { ok: true, message: 'Сервер Палимпсеста активен. Клиент запускается отдельно через Vite.' });
    return;
  }
  let requested = decodeURIComponent(url.pathname);
  if (requested === '/') requested = '/index.html';
  let filePath = path.resolve(dist, `.${requested}`);
  if (!filePath.startsWith(dist)) {
    response.writeHead(403);
    response.end();
    return;
  }
  if (!existsSync(filePath) || !path.extname(filePath)) filePath = path.join(dist, 'index.html');
  const types = {
    '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css',
    '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png',
    '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.woff2': 'font/woff2',
    '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg',
  };
  response.setHeader('Content-Type', types[path.extname(filePath)] || 'application/octet-stream');
  response.setHeader('Cache-Control', path.extname(filePath) === '.html' ? 'no-cache' : 'public, max-age=86400');
  createReadStream(filePath).on('error', () => response.end()).pipe(response);
});

function sendJson(response, value, status = 200) {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify(value));
}

const wss = new WebSocketServer({ server, path: '/ws' });
const clients = new Map();
const playerSockets = new Map();
const rooms = new Map();
const queues = { ranked: [], casual: [] };

function send(ws, type, payload = {}) {
  if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type, ...payload }));
}

function sendError(ws, message) {
  send(ws, 'error', { message });
}

function removeFromQueues(ws) {
  for (const queue of Object.values(queues)) {
    const index = queue.findIndex((entry) => entry.ws === ws);
    if (index >= 0) queue.splice(index, 1);
  }
  const client = clients.get(ws);
  if (client) client.queued = null;
}

function roomCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  do {
    code = Array.from({ length: 6 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join('');
  } while ([...rooms.values()].some((room) => room.code === code));
  return code;
}

function roomPlayer(ws, heroId) {
  const client = clients.get(ws);
  return {
    playerId: client.player.id, heroId: getHero(heroId).id, ws,
    connected: true, disconnectedAt: null, ready: false, rematch: false,
  };
}

function createRoom(entries, { ranked = false, private: isPrivate = false } = {}) {
  const id = randomUUID();
  const room = {
    id, code: roomCode(), ranked, private: isPrivate,
    players: entries.map((entry) => roomPlayer(entry.ws, entry.heroId)),
    state: null, phase: 'waiting', pending: [null, null], deadline: null,
    createdAt: Date.now(), updatedAt: Date.now(), revealTimer: null,
    ratingChanges: null, ratedApplied: false, chat: [], resultPayload: null,
  };
  rooms.set(id, room);
  for (const seat of room.players) {
    const client = clients.get(seat.ws);
    client.roomId = id;
    client.queued = null;
  }
  if (room.players.length === 2) startMatch(room);
  else broadcastRoom(room);
  broadcastLobby();
  return room;
}

function startMatch(room) {
  clearTimeout(room.revealTimer);
  room.state = createGame({ seed: `${room.id}:${Date.now()}:${Math.random()}`, heroes: room.players.map((seat) => seat.heroId) });
  room.phase = 'select';
  room.pending = [null, null];
  room.deadline = Date.now() + TURN_SECONDS * 1000;
  room.ratingChanges = null;
  room.ratedApplied = false;
  room.resultPayload = null;
  room.updatedAt = Date.now();
  for (const seat of room.players) {
    seat.ready = false;
    seat.rematch = false;
    seat.disconnectedAt = null;
  }
  broadcastRoom(room, 'match_started');
}

function roomMeta(room, viewerId) {
  return {
    id: room.id, code: room.code, ranked: room.ranked, private: room.private,
    phase: room.phase, deadline: room.deadline, createdAt: room.createdAt,
    players: room.players.map((seat, index) => ({
      ...publicProfile(findPlayerById(seat.playerId) || { id: seat.playerId, name: 'РЕДАКТОР', rating: 1000 }),
      heroId: seat.heroId, seat: index, connected: seat.connected,
      ready: Boolean(room.pending[index]), rematch: seat.rematch,
    })),
    youAreHost: room.players[0]?.playerId === viewerId,
    chat: room.chat.slice(-12),
  };
}

function openRooms() {
  return [...rooms.values()]
    .filter((room) => room.phase === 'waiting' && !room.private)
    .map((room) => ({
      id: room.id, code: room.code, createdAt: room.createdAt,
      host: publicProfile(findPlayerById(room.players[0].playerId)),
      heroId: room.players[0].heroId,
    }));
}

function broadcastRoom(room, type = 'room_state') {
  room.updatedAt = Date.now();
  for (let index = 0; index < room.players.length; index += 1) {
    const seat = room.players[index];
    send(seat.ws, type, {
      room: roomMeta(room, seat.playerId), state: room.state ? sanitizeState(room.state, index) : null,
      you: index, serverTime: Date.now(), ratingChanges: room.ratingChanges,
      result: room.resultPayload,
    });
  }
}

function broadcastLobby() {
  const payload = {
    rooms: openRooms(),
    online: new Set([...clients.values()].filter((client) => client.player).map((client) => client.player.id)).size,
    queues: { ranked: queues.ranked.length, casual: queues.casual.length },
  };
  for (const ws of clients.keys()) send(ws, 'lobby', payload);
}

function applyRating(room, winner) {
  if (!room.ranked || room.ratedApplied) return;
  room.ratedApplied = true;
  const profiles = room.players.map((seat) => findPlayerById(seat.playerId));
  if (profiles.some((profile) => !profile)) return;
  const [a, b] = profiles;
  const scoreA = winner === 'draw' ? 0.5 : winner === 0 ? 1 : 0;
  const scoreB = 1 - scoreA;
  const expectedA = 1 / (1 + 10 ** ((b.rating - a.rating) / 400));
  const expectedB = 1 - expectedA;
  const kA = a.games < 10 ? 48 : 32;
  const kB = b.games < 10 ? 48 : 32;
  const oldA = a.rating;
  const oldB = b.rating;
  a.rating = Math.max(0, Math.round(a.rating + kA * (scoreA - expectedA)));
  b.rating = Math.max(0, Math.round(b.rating + kB * (scoreB - expectedB)));
  a.bestRating = Math.max(a.bestRating || 0, a.rating);
  b.bestRating = Math.max(b.bestRating || 0, b.rating);
  a.games += 1;
  b.games += 1;
  if (winner === 'draw') {
    a.draws += 1;
    b.draws += 1;
  } else {
    const winnerProfile = profiles[winner];
    const loserProfile = profiles[1 - winner];
    winnerProfile.wins += 1;
    loserProfile.losses += 1;
  }
  room.ratingChanges = [
    { before: oldA, after: a.rating, delta: a.rating - oldA },
    { before: oldB, after: b.rating, delta: b.rating - oldB },
  ];
  saveDatabase();
}

function finishByForfeit(room, winner) {
  if (!room.state || room.state.winner !== null) return;
  room.state.winner = winner;
  room.state.winReason = 'forfeit';
  room.phase = 'finished';
  room.deadline = null;
  room.resultPayload = { actions: null, events: [{ type: 'gameover', winner, reason: 'forfeit' }] };
  applyRating(room, winner);
  broadcastRoom(room, 'match_finished');
  broadcastLobby();
}

function resolvePending(room) {
  if (!room.pending[0] || !room.pending[1] || room.phase !== 'select') return;
  try {
    const resolution = resolveRound(room.state, room.pending);
    room.state = resolution.state;
    room.resultPayload = { actions: resolution.actions, events: resolution.events };
    room.pending = [null, null];
    room.deadline = null;
    room.phase = room.state.winner !== null ? 'finished' : 'reveal';
    if (room.state.winner !== null) applyRating(room, room.state.winner);
    broadcastRoom(room, 'resolution');
    if (room.phase === 'reveal') {
      room.revealTimer = setTimeout(() => {
        if (room.phase !== 'reveal') return;
        room.phase = 'select';
        room.deadline = Date.now() + TURN_SECONDS * 1000;
        room.resultPayload = null;
        broadcastRoom(room);
      }, REVEAL_MS);
    } else {
      broadcastLobby();
    }
  } catch (error) {
    console.error('Resolution failed', error);
    room.pending = [null, null];
    room.deadline = Date.now() + 10_000;
    broadcastRoom(room);
  }
}

function leaveCurrentRoom(ws, { forfeit = true } = {}) {
  const client = clients.get(ws);
  if (!client?.roomId) return;
  const room = rooms.get(client.roomId);
  client.roomId = null;
  if (!room) return;
  const seatIndex = room.players.findIndex((seat) => seat.ws === ws);
  if (seatIndex < 0) return;
  if (room.phase === 'waiting') {
    rooms.delete(room.id);
    for (const seat of room.players) {
      const otherClient = clients.get(seat.ws);
      if (otherClient) otherClient.roomId = null;
      send(seat.ws, 'room_closed', { message: 'Комната закрыта' });
    }
  } else if (room.phase !== 'finished' && forfeit) {
    finishByForfeit(room, 1 - seatIndex);
  } else {
    send(seat.ws, 'room_closed', { message: 'Вы покинули архив' });
  }
  broadcastLobby();
}

wss.on('connection', (ws) => {
  clients.set(ws, { player: null, roomId: null, queued: null });
  ws.isAlive = true;
  ws.on('pong', () => { ws.isAlive = true; });
  send(ws, 'connected', { message: 'Архив открыт', serverTime: Date.now() });

  ws.on('message', (raw) => {
    let message;
    try {
      message = JSON.parse(raw.toString());
    } catch {
      sendError(ws, 'Некорректный пакет');
      return;
    }
    const client = clients.get(ws);
    if (!client) return;

    try {
      if (message.type === 'hello') {
        let player = message.token ? database.players[message.token] : null;
        if (!player) player = createPlayer(message.name);
        if (message.name && cleanName(message.name) !== player.name) player.name = cleanName(message.name);
        player.lastSeen = Date.now();
        client.player = player;
        const previous = playerSockets.get(player.id);
        if (previous && previous !== ws) {
          const previousClient = clients.get(previous);
          if (previousClient) previousClient.player = null;
          send(previous, 'session_replaced', { message: 'Профиль открыт в другой вкладке' });
          previous.close();
        }
        playerSockets.set(player.id, ws);
        saveDatabase();
        send(ws, 'welcome', { token: player.token, profile: publicProfile(player), serverTime: Date.now() });

        const room = [...rooms.values()]
          .filter((candidate) => candidate.players.some((seat) => seat.playerId === player.id))
          .sort((a, b) => b.updatedAt - a.updatedAt)[0];
        if (room) {
          const seat = room.players.find((item) => item.playerId === player.id);
          seat.ws = ws;
          seat.connected = true;
          seat.disconnectedAt = null;
          client.roomId = room.id;
          if (room.phase === 'select' && !room.deadline) room.deadline = Date.now() + TURN_SECONDS * 1000;
          broadcastRoom(room, 'reconnected');
        }
        broadcastLobby();
        return;
      }

      if (!client.player) {
        sendError(ws, 'Сначала представьтесь Архиву');
        return;
      }
      client.player.lastSeen = Date.now();

      if (message.type === 'set_name') {
        client.player.name = cleanName(message.name);
        saveDatabase();
        send(ws, 'profile', { profile: publicProfile(client.player) });
        const room = rooms.get(client.roomId);
        if (room) broadcastRoom(room);
        return;
      }

      if (message.type === 'quick_match') {
        leaveCurrentRoom(ws);
        removeFromQueues(ws);
        const ranked = Boolean(message.ranked);
        const queue = ranked ? queues.ranked : queues.casual;
        const opponentIndex = queue.findIndex((entry) => (
          entry.ws.readyState === WebSocket.OPEN && clients.get(entry.ws)?.player?.id !== client.player.id
        ));
        if (opponentIndex >= 0) {
          const [opponent] = queue.splice(opponentIndex, 1);
          createRoom([opponent, { ws, heroId: message.heroId }], { ranked });
        } else {
          queue.push({ ws, heroId: getHero(message.heroId).id, at: Date.now() });
          client.queued = ranked ? 'ranked' : 'casual';
          send(ws, 'queue', { active: true, ranked, position: queue.length, startedAt: Date.now() });
          broadcastLobby();
        }
        return;
      }

      if (message.type === 'cancel_queue') {
        removeFromQueues(ws);
        send(ws, 'queue', { active: false });
        broadcastLobby();
        return;
      }

      if (message.type === 'create_room') {
        leaveCurrentRoom(ws);
        removeFromQueues(ws);
        createRoom([{ ws, heroId: message.heroId }], { ranked: false, private: Boolean(message.private) });
        return;
      }

      if (message.type === 'join_room') {
        leaveCurrentRoom(ws);
        removeFromQueues(ws);
        const code = String(message.code || '').trim().toUpperCase();
        const room = rooms.get(message.roomId) || [...rooms.values()].find((candidate) => candidate.code === code);
        if (!room || room.phase !== 'waiting' || room.players.length >= 2) {
          sendError(ws, 'Комната не найдена или дуэль уже началась');
          return;
        }
        if (room.players[0].playerId === client.player.id) {
          sendError(ws, 'Нельзя присоединиться к собственной комнате из этого профиля');
          return;
        }
        room.players.push(roomPlayer(ws, message.heroId));
        client.roomId = room.id;
        startMatch(room);
        return;
      }

      if (message.type === 'leave_room') {
        leaveCurrentRoom(ws);
        removeFromQueues(ws);
        send(ws, 'left_room');
        return;
      }

      if (message.type === 'submit_action') {
        const room = rooms.get(client.roomId);
        if (!room || room.phase !== 'select') {
          sendError(ws, 'Сейчас Архив не принимает приказы');
          return;
        }
        const seatIndex = room.players.findIndex((seat) => seat.playerId === client.player.id);
        if (seatIndex < 0) return;
        if (room.pending[seatIndex]) return;
        const validation = validateAction(room.state, seatIndex, message.action);
        if (!validation.valid) {
          sendError(ws, validation.reason);
          return;
        }
        room.pending[seatIndex] = {
          cardId: message.action.cardId,
          target: Number.isInteger(message.action.target) ? message.action.target : null,
        };
        send(ws, 'action_accepted', { action: room.pending[seatIndex] });
        broadcastRoom(room, 'opponent_ready');
        resolvePending(room);
        return;
      }

      if (message.type === 'emote') {
        const room = rooms.get(client.roomId);
        if (!room) return;
        const seatIndex = room.players.findIndex((seat) => seat.playerId === client.player.id);
        const entry = {
          id: randomUUID(), seat: seatIndex, name: client.player.name,
          text: cleanName(message.text).slice(0, 64), at: Date.now(),
        };
        room.chat.push(entry);
        room.chat = room.chat.slice(-30);
        broadcastRoom(room, 'emote');
        return;
      }

      if (message.type === 'rematch') {
        const room = rooms.get(client.roomId);
        if (!room || room.phase !== 'finished') return;
        const seat = room.players.find((item) => item.playerId === client.player.id);
        if (!seat) return;
        seat.rematch = true;
        if (room.players.every((item) => item.rematch && item.connected)) startMatch(room);
        else broadcastRoom(room);
        return;
      }
    } catch (error) {
      console.error('Message error', error);
      sendError(ws, 'Архив не смог выполнить операцию');
    }
  });

  ws.on('close', () => {
    removeFromQueues(ws);
    const client = clients.get(ws);
    if (client?.player && playerSockets.get(client.player.id) === ws) playerSockets.delete(client.player.id);
    if (client?.roomId) {
      const room = rooms.get(client.roomId);
      const seat = room?.players.find((item) => item.ws === ws);
      if (seat && room.phase !== 'finished') {
        seat.connected = false;
        seat.disconnectedAt = Date.now();
        if (room.phase === 'waiting') {
          rooms.delete(room.id);
        } else {
          room.deadline = null;
          broadcastRoom(room);
        }
      }
    }
    clients.delete(ws);
    broadcastLobby();
  });
});

const turnTimer = setInterval(() => {
  const now = Date.now();
  for (const room of rooms.values()) {
    if (room.phase === 'select') {
      const disconnected = room.players.find((seat) => !seat.connected && seat.disconnectedAt && now - seat.disconnectedAt >= RECONNECT_GRACE_MS);
      if (disconnected) {
        const winner = 1 - room.players.indexOf(disconnected);
        finishByForfeit(room, winner);
        continue;
      }
      if (room.deadline && now >= room.deadline && room.players.every((seat) => seat.connected)) {
        for (let index = 0; index < 2; index += 1) {
          if (!room.pending[index]) room.pending[index] = chooseTimeoutAction(room.state, index);
        }
        resolvePending(room);
      }
    }
    if (now - room.updatedAt > ROOM_IDLE_MS && room.phase === 'waiting') rooms.delete(room.id);
    if (room.phase === 'finished' && now - room.updatedAt > ROOM_IDLE_MS) rooms.delete(room.id);
  }
}, 1000);
turnTimer.unref();

const heartbeat = setInterval(() => {
  for (const ws of wss.clients) {
    if (!ws.isAlive) {
      ws.terminate();
      continue;
    }
    ws.isAlive = false;
    ws.ping();
  }
}, 30_000);
heartbeat.unref();

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[Palimpsest] Authority server: http://0.0.0.0:${PORT}`);
  console.log(`[Palimpsest] ${Object.keys(CARDS).length} orders, ${HEROES.length} editors, WebSocket /ws`);
});

function shutdown() {
  clearInterval(turnTimer);
  clearInterval(heartbeat);
  clearTimeout(saveTimer);
  writeFileSync(DATA_FILE, JSON.stringify(database, null, 2));
  for (const room of rooms.values()) clearTimeout(room.revealTimer);
  wss.close();
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 1000).unref();
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
