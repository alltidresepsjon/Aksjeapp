// Bathtub Gin game server: hosts Turf War rooms. The server runs the simulation;
// clients send commands and receive fog-filtered snapshots. Also serves the built client.

import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes } from 'node:crypto';
import { WebSocketServer, type WebSocket } from 'ws';
import {
  buildTurfWorld, makeSnapshot, turfLayout, TURF_FAMILIES, type ClientMsg, type Layout, type LobbyPlayer, type ServerMsg, type World,
} from '@bg/shared';

const PORT = Number(process.env.PORT ?? 8787);
const DIST = fileURLToPath(new URL('../../client/dist/', import.meta.url));
const TICK_MS = 100;
const SNAP_EVERY = 2;

interface Player { id: string; token: string; name: string; ws: WebSocket | null; fam: string; host: boolean; lastEv: number; room: Room | null }
interface Room {
  code: string;
  players: Player[];
  ai: number;
  days: number;
  world: World | null;
  timer: NodeJS.Timeout | null;
  speed: number;
  paused: boolean;
  skipping: boolean;
  skipUntil: number;
  pauseVotes: Set<string>;
  skipVotes: Set<string>;
  n: number;
  emptySince: number;
}

const rooms = new Map<string, Room>();
const byToken = new Map<string, Player>();

const send = (p: Player, m: ServerMsg) => { if (p.ws && p.ws.readyState === 1) p.ws.send(JSON.stringify(m)); };
const code = (): string => { const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; let c = ''; for (let i = 0; i < 4; i++) c += A[Math.floor(Math.random() * A.length)]; return rooms.has(c) ? code() : c; };

function lobbyMsg(r: Room): ServerMsg {
  const players: LobbyPlayer[] = r.players.map((p) => ({ id: p.id, name: p.name, fam: p.fam, host: p.host, connected: !!p.ws }));
  return { t: 'lobby', code: r.code, players, ai: Math.min(r.ai, 4 - r.players.length), days: r.days, started: !!r.world };
}
function broadcastLobby(r: Room) { const m = lobbyMsg(r); for (const p of r.players) send(p, m); }
function humans(r: Room) { return r.players.filter((p) => p.ws); }
function votesMsg(r: Room): ServerMsg { return { t: 'votes', pause: [...r.pauseVotes], skip: [...r.skipVotes], need: humans(r).length }; }

function assignFamilies(r: Room) { r.players.forEach((p, i) => { p.fam = TURF_FAMILIES[i].id; }); }

// The client regenerates the map from the same layout, so keep it with the room.
const layouts = new WeakMap<Room, Layout>();

function step(r: Room) {
  const w = r.world!;
  if (!w.s.result && !r.paused) {
    const n = r.skipping ? 12 : r.speed;
    for (let i = 0; i < n; i++) {
      w.tick();
      if (r.skipping && (w.absHour() >= r.skipUntil || w.s.result)) { r.skipping = false; break; }
    }
  }
  r.n++;
  if (r.n % SNAP_EVERY === 0) {
    for (const p of r.players) {
      if (!p.ws) continue;
      const snap = makeSnapshot(w, p.fam, p.lastEv, { speed: r.speed, paused: r.paused, skipping: r.skipping });
      p.lastEv = w.s.evId - 1;
      send(p, { t: 'snap', s: snap });
    }
  }
  if (!humans(r).length) {
    if (!r.emptySince) r.emptySince = Date.now();
    if (Date.now() - r.emptySince > 5 * 60_000) closeRoom(r);
  } else r.emptySince = 0;
}

function closeRoom(r: Room) {
  if (r.timer) clearInterval(r.timer);
  for (const p of r.players) { byToken.delete(p.token); p.room = null; }
  rooms.delete(r.code);
}

function vote(r: Room, p: Player, kind: 'pause' | 'skip') {
  const set = kind === 'pause' ? r.pauseVotes : r.skipVotes;
  if (kind === 'pause' && r.paused) { r.paused = false; r.pauseVotes.clear(); for (const q of r.players) send(q, votesMsg(r)); return; }
  if (kind === 'skip' && r.skipping) { r.skipping = false; r.skipVotes.clear(); return; }
  if (set.has(p.name)) set.delete(p.name); else set.add(p.name);
  if (set.size >= humans(r).length) {
    set.clear();
    if (kind === 'pause') r.paused = true;
    else {
      const w = r.world!;
      const abs = w.absHour();
      const night = w.s.hour >= 20 || w.s.hour < 6;
      let target = Math.floor(abs / 24) * 24 + (night ? 6 : 20);
      if (target <= abs) target += 24;
      r.skipUntil = target;
      r.skipping = true;
    }
  }
  for (const q of r.players) send(q, votesMsg(r));
}

function leave(p: Player) {
  const r = p.room;
  if (!r) return;
  if (!r.world) {
    r.players = r.players.filter((x) => x !== p);
    byToken.delete(p.token);
    p.room = null;
    if (!r.players.length) { closeRoom(r); return; }
    if (!r.players.some((x) => x.host)) r.players[0].host = true;
    assignFamilies(r);
    broadcastLobby(r);
  } else {
    // the family carries on under AI control
    const f = r.world.s.families[p.fam];
    if (f) f.human = false;
    p.ws = null;
    r.pauseVotes.delete(p.name); r.skipVotes.delete(p.name);
  }
}

function onMessage(p: Player, m: ClientMsg) {
  const r = p.room;
  switch (m.t) {
    case 'create': {
      if (r) leave(p);
      const room: Room = { code: code(), players: [], ai: Math.max(0, Math.min(3, m.ai | 0)), days: Math.max(3, Math.min(20, m.days | 0 || 8)), world: null, timer: null, speed: 1, paused: false, skipping: false, skipUntil: 0, pauseVotes: new Set(), skipVotes: new Set(), n: 0, emptySince: 0 };
      rooms.set(room.code, room);
      p.host = true; p.room = room; room.players.push(p);
      assignFamilies(room);
      broadcastLobby(room);
      return;
    }
    case 'join': {
      const room = rooms.get(m.code.toUpperCase());
      if (!room) return send(p, { t: 'error', text: `No room with code ${m.code}.` });
      if (room.world) return send(p, { t: 'error', text: 'That war has already started.' });
      if (room.players.length >= 4) return send(p, { t: 'error', text: 'Room is full.' });
      if (r && r !== room) leave(p);
      p.host = false; p.room = room;
      if (!room.players.includes(p)) room.players.push(p);
      assignFamilies(room);
      broadcastLobby(room);
      return;
    }
    case 'config': if (r && p.host && !r.world) { r.ai = Math.max(0, Math.min(3, m.ai | 0)); r.days = m.days | 0 || r.days; broadcastLobby(r); } return;
    case 'start': {
      if (!r || !p.host || r.world) return;
      if (r.players.length + Math.min(r.ai, 4 - r.players.length) < 2) return send(p, { t: 'error', text: 'Need at least two families.' });
      const seed = Math.floor(Math.random() * 1e9);
      const ai = Math.min(r.ai, 4 - r.players.length);
      const slots = r.players.map((x) => ({ fam: x.fam, player: x.id, name: x.name, human: true }));
      for (let i = 0; i < ai; i++) slots.push({ fam: TURF_FAMILIES[r.players.length + i].id, player: '', name: '', human: false });
      layouts.set(r, turfLayout(seed, slots.length));
      r.world = buildTurfWorld(slots, seed, r.days);
      for (const x of r.players) { x.lastEv = 0; send(x, { t: 'start', fam: x.fam, layout: layouts.get(r)!, startHour: 8 }); }
      r.timer = setInterval(() => step(r), TICK_MS);
      broadcastLobby(r);
      return;
    }
    case 'leave': leave(p); return;
    case 'cmd': {
      if (!r || !r.world) return;
      const err = r.world.command(p.fam, m.cmd);
      if (err) send(p, { t: 'cmdErr', text: err });
      return;
    }
    case 'speed': if (r && r.world && p.host) { r.speed = Math.max(1, Math.min(3, m.speed | 0)); r.paused = false; r.skipping = false; } return;
    case 'vote': if (r && r.world) vote(r, p, m.kind); return;
    case 'chat': if (r) for (const q of r.players) send(q, { t: 'chat', from: p.name, text: String(m.text).slice(0, 200) }); return;
  }
}


// ---------- static files ----------
const MIME: Record<string, string> = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2', '.woff': 'font/woff', '.ogg': 'audio/ogg', '.mp3': 'audio/mpeg', '.json': 'application/json', '.md': 'text/plain; charset=utf-8' };
async function serveStatic(req: IncomingMessage, res: ServerResponse) {
  const url = new URL(req.url ?? '/', 'http://x');
  if (url.pathname === '/health') { res.writeHead(200, { 'content-type': 'text/plain' }); res.end('ok'); return; }
  let path = normalize(decodeURIComponent(url.pathname)).replace(/^(\.\.[/\\])+/, '');
  if (path.endsWith('/')) path += 'index.html';
  let file = join(DIST, path);
  if (!file.startsWith(DIST)) { res.writeHead(403); res.end(); return; }
  try { if (!(await stat(file)).isFile()) throw new Error(); } catch { file = join(DIST, 'index.html'); }
  try {
    const body = await readFile(file);
    res.writeHead(200, { 'content-type': MIME[extname(file)] ?? 'application/octet-stream', 'cache-control': file.includes('/assets/') && !file.endsWith('.html') ? 'public, max-age=86400' : 'no-cache' });
    res.end(body);
  } catch {
    res.writeHead(404, { 'content-type': 'text/plain' });
    res.end('Client not built. Run "npm run build" (or use "npm run dev" for development).');
  }
}

const server = createServer((req, res) => { void serveStatic(req, res); });
const wss = new WebSocketServer({ server, path: '/ws', maxPayload: 64 * 1024 });

wss.on('connection', (ws) => {
  let player: Player | null = null;
  ws.on('message', (data) => {
    let m: ClientMsg;
    try { m = JSON.parse(String(data)); } catch { return; }
    if (!player) {
      if (m.t !== 'hello') return;
      const existing = m.token ? byToken.get(m.token) : undefined;
      if (existing) {
        player = existing;
        player.ws?.close();
        player.ws = ws;
        send(player, { t: 'welcome', id: player.id, token: player.token });
        const r = player.room;
        if (r) {
          if (r.world) {
            const f = r.world.s.families[player.fam];
            if (f) f.human = true;
            player.lastEv = 0;
            send(player, { t: 'start', fam: player.fam, layout: layouts.get(r)!, startHour: 8 });
          }
          broadcastLobby(r);
        }
        return;
      }
      player = { id: randomBytes(6).toString('hex'), token: randomBytes(16).toString('hex'), name: String(m.name || 'Boss').slice(0, 16), ws, fam: '', host: false, lastEv: 0, room: null };
      byToken.set(player.token, player);
      send(player, { t: 'welcome', id: player.id, token: player.token });
      return;
    }
    try { onMessage(player, m); } catch (e) { console.error('message error', e); }
  });
  ws.on('close', () => {
    if (!player || player.ws !== ws) return;
    player.ws = null;
    const r = player.room;
    if (r && !r.world) { setTimeout(() => { if (player && !player.ws) leave(player); }, 15_000); broadcastLobby(r); }
    else if (r) { r.pauseVotes.delete(player.name); r.skipVotes.delete(player.name); }
  });
});

server.listen(PORT, () => {
  console.log(`Bathtub Gin server on http://localhost:${PORT} (WebSocket at /ws)`);
});
