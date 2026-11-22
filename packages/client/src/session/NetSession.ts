// Turf War client: sends commands, receives fog-filtered snapshots and interpolates movement.

import { generateMap, unpackBits, type ClientMsg, type Command, type FamId, type Layout, type MapData, type ServerMsg, type Snapshot, type ViewState } from '@bg/shared';
import type { Session } from './Session';

export class Net {
  ws: WebSocket | null = null;
  handlers = new Set<(m: ServerMsg) => void>();
  id = '';
  private queue: ClientMsg[] = [];
  connect(name: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const proto = location.protocol === 'https:' ? 'wss' : 'ws';
      const ws = new WebSocket(`${proto}://${location.host}/ws`);
      this.ws = ws;
      let ok = false;
      ws.onopen = () => {
        const token = sessionStorage.getItem('bg-token') ?? undefined;
        ws.send(JSON.stringify({ t: 'hello', name, token } satisfies ClientMsg));
        for (const m of this.queue) ws.send(JSON.stringify(m));
        this.queue = [];
      };
      ws.onmessage = (ev) => {
        const m = JSON.parse(ev.data as string) as ServerMsg;
        if (m.t === 'welcome') { this.id = m.id; sessionStorage.setItem('bg-token', m.token); ok = true; resolve(); }
        for (const h of this.handlers) h(m);
      };
      ws.onerror = () => { if (!ok) reject(new Error('Could not reach the game server.')); };
      ws.onclose = () => { for (const h of this.handlers) h({ t: 'error', text: 'Disconnected from the server.' }); };
    });
  }
  send(m: ClientMsg) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(m));
    else this.queue.push(m);
  }
  on(h: (m: ServerMsg) => void) { this.handlers.add(h); return () => this.handlers.delete(h); }
  close() { this.ws?.close(); this.ws = null; }
}

export class NetSession implements Session {
  readonly isNet = true;
  readonly map: MapData;
  speed = 1;
  paused = false;
  skipping = false;
  onError?: (text: string) => void;
  private cur: Snapshot | null = null;
  private prevPos = new Map<number, { x: number; y: number }>();
  private curPos = new Map<number, { x: number; y: number }>();
  private arrived = 0;
  private interval = 200;
  private visBits: Uint8Array | null = null;
  private off: () => void;
  private empty: ViewState;

  constructor(private net: Net, readonly fam: FamId, layout: Layout, startHour: number) {
    this.map = generateMap(layout);
    this.empty = { mode: 'turf', chapter: 'turf', tick: 0, time: 0, day: 1, hour: startHour, units: [], buildings: [], vehicles: [], families: {}, order: [], news: [], ads: [], events: [], objectives: [], result: null, fog: true, timeLimitDay: 0 };
    this.off = net.on((m) => {
      if (m.t === 'snap') this.onSnap(m.s);
      else if (m.t === 'cmdErr' || m.t === 'error') this.onError?.(m.text);
    });
  }
  private onSnap(s: Snapshot) {
    const now = performance.now();
    if (this.arrived) this.interval = this.interval * 0.8 + Math.min(600, now - this.arrived) * 0.2;
    this.arrived = now;
    this.prevPos = this.curPos;
    this.curPos = new Map();
    for (const u of s.units) this.curPos.set(u.id, { x: u.x, y: u.y });
    for (const v of s.vehicles) this.curPos.set(v.id, { x: v.x, y: v.y });
    // keep events cumulative so the renderer sees each one once
    const old = this.cur ? this.cur.events : [];
    const merged = old.concat(s.events).slice(-300);
    this.cur = { ...s, events: merged };
    this.visBits = unpackBits(s.vis, this.map.w * this.map.h);
    this.speed = s.speed;
    this.paused = s.paused;
    this.skipping = s.skipping;
  }
  view(): ViewState { return this.cur ?? this.empty; }
  vis() { return this.visBits; }
  lerpPos(id: number, x: number, y: number) {
    const a = this.prevPos.get(id), b = this.curPos.get(id);
    if (!a || !b) return { x, y };
    const t = Math.min(1, (performance.now() - this.arrived) / Math.max(50, this.interval));
    if (Math.hypot(b.x - a.x, b.y - a.y) > 3) return b;
    return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
  }
  command(cmd: Command): string | null { this.net.send({ t: 'cmd', cmd }); return null; }
  setSpeed(n: number) { this.net.send({ t: 'speed', speed: n }); }
  togglePause() { this.net.send({ t: 'vote', kind: 'pause' }); }
  skip() { this.net.send({ t: 'vote', kind: 'skip' }); }
  update() {}
  destroy() { this.off(); }
}
