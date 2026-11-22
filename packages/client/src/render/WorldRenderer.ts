// Draws the isometric city with PixiJS: ground, buildings, people, cars, lights, fog and effects.

import { Application, Container, Graphics, Sprite, Text, Texture } from 'pixi.js';
import {
  BTYPES, nightFactor, PathFinder, type Building, type FamId, type GameEvent, type MapData, type Unit, type Vehicle, type ViewState,
} from '@bg/shared';
import { drawGround, isParkBlock } from './ground';
import { buildOutskirts, type Outskirts } from './outskirts';
import { PERIOD as BLOCK_PERIOD, ROAD as ROAD_W } from '@bg/shared';
import { BUILDING_RES, INSET, buildingArt, burnedArt, type BuildingArt } from './tex/buildings';
import { SPRITE_RES, carFrame, corpse, dot, flag, glow, lampPost, personFrames, tree, type PersonLook } from './tex/sprites';
import { artRng, hex, mix, mul, toScreen, toWorld, TW, TH } from './iso';
import { propArt, type PropKind } from './tex/props';
import type { ArtPack } from './artPack';
import { Ambient } from './ambient';
import type { Session } from '../session/Session';

export type Hit =
  | { k: 'unit'; u: Unit }
  | { k: 'vehicle'; v: Vehicle }
  | { k: 'building'; b: Building }
  | { k: 'ground'; x: number; y: number };

interface BSprite { b: Building; art: BuildingArt; spr: Sprite; lit: Sprite; flag: Sprite; burned: Texture | null; dayTex: Texture; depth: number; poly: number[]; fade: number; custom: boolean }
interface USprite { root: Container; body: Sprite; shadow: Sprite; frames: Texture[]; key: string; seen: number; base?: number; single?: boolean }
interface CarFrame { tex: Texture; ax: number; ay: number; s: number; flip: boolean; tintable: boolean }
interface VSprite { root: Container; body: Sprite; key: string; frames: CarFrame[]; head: Sprite; seen: number; color?: number }

const CIV_COATS = [0x6a5a4a, 0x4a5a6a, 0x7a6a50, 0x5a4a5a, 0x3a4a3a, 0x8a7a6a, 0x5a5048, 0x6a4038];
const CIV_CARS = [0x2a2a2a, 0x4a3a2a, 0x2a3a4a, 0x5a2a2a, 0x3a4a3a, 0xc9a23a, 0x2a2a3a];

export class WorldRenderer {
  root = new Container();
  private groundG: Graphics;
  private ownerG = new Graphics();
  private fxGround = new Graphics();
  private fogG = new Graphics();
  private objects = new Container();
  private lights = new Container();
  private fx = new Graphics();
  private overlay = new Container();
  private bars = new Graphics();
  private texts: Text[] = [];
  private textUsed = 0;
  private floats: { t: Text; life: number; x: number; y: number }[] = [];
  private buildings = new Map<number, BSprite>();
  private units = new Map<number, USprite>();
  private vehicles = new Map<number, VSprite>();
  private civs = new Map<number, USprite | VSprite>();
  private corpses: { s: Sprite; life: number }[] = [];
  private tracers: { x0: number; y0: number; x1: number; y1: number; life: number; color: number }[] = [];
  private flashes: { s: Sprite; life: number; max: number }[] = [];
  private sparks: { x: number; y: number; vx: number; vy: number; life: number; max: number; color: number; size: number; grav: number; a?: number }[] = [];
  private hurtUntil = new Map<number, number>();
  private lampGlows: Sprite[] = [];
  private props: Sprite[] = [];
  private texCache = new Map<string, Texture[]>();
  private carCache = new Map<string, CarFrame[]>();
  private glowTex = Texture.from(glow('rgba(255,210,130,0.85)', 160));
  private headTex: Texture;
  private dotTex: Texture;
  private flagTex: Texture;
  private lastEv = 0;
  private explored: Uint8Array;
  private fogKey = '';
  private ownerKey = '';
  private time = 0;
  ambient: Ambient;
  zoom = 1;
  camX = 0;
  camY = 0;
  onEvent?: (e: GameEvent, visible: boolean) => void;
  selected = new Set<number>();
  selectedVehicle = -1;
  selectedBuilding = -1;
  highlight: number[] = [];

  constructor(public app: Application, public map: MapData, private sess: Session, private pack: ArtPack | null = null) {
    this.explored = new Uint8Array(map.w * map.h);
    this.groundG = drawGround(map);
    this.objects.sortableChildren = true;
    this.out = buildOutskirts(map);
    this.root.addChild(this.out.back, this.groundG, this.ownerG, this.fxGround, this.fogG, this.objects, this.lights, this.fx, this.overlay);
    for (const o of this.out.objects) {
      o.sprite.zIndex = o.depth;
      this.objects.addChild(o.sprite);
      if (o.lit) this.lights.addChild(o.lit);
    }
    // lamps along the boardwalk
    {
      const lampTex2 = Texture.from(lampPost());
      const spots: { x: number; y: number }[] = [];
      for (let x = -6; x < map.w + 2; x += 4) spots.push({ x, y: map.h + 2.0 });
      for (let y = -6; y < map.h; y += 4) spots.push({ x: map.w + 2.0, y });
      for (const l of spots) {
        const p = toScreen(l.x, l.y);
        const s = new Sprite(lampTex2); s.anchor.set(0.5, 57 / 60); s.scale.set(1 / SPRITE_RES); s.position.set(p.x, p.y); s.zIndex = l.x + l.y;
        this.objects.addChild(s); this.props.push(s);
        const gl = new Sprite(this.glowTex); gl.anchor.set(0.5); gl.blendMode = 'add'; gl.scale.set(1.2); gl.position.set(p.x, p.y);
        this.lights.addChild(gl); this.lampGlows.push(gl);
      }
    }
    // bandstands and statues in the parks
    for (let by = 0; by < map.bh; by++) for (let bx = 0; bx < map.bw; bx++) {
      if (!isParkBlock(map, bx, by)) continue;
      const cx = bx * BLOCK_PERIOD + ROAD_W + 3, cy = by * BLOCK_PERIOD + ROAD_W + 3;
      const a = propArt((bx + by) % 2 ? 'statue' : 'bandstand');
      const sp = new Sprite(Texture.from(a.cv)); sp.anchor.set(a.ax, a.ay); sp.scale.set(1 / SPRITE_RES);
      const q = toScreen(cx, cy); sp.position.set(q.x, q.y); sp.zIndex = cx + cy;
      this.objects.addChild(sp); this.props.push(sp);
      this.parkCenters.push({ x: cx, y: cy });
    }
    this.overlay.addChild(this.bars);

    this.headTex = Texture.from(glow('rgba(255,240,190,0.9)', 120));
    this.dotTex = Texture.from(dot(32));
    this.flagTex = Texture.from(flag());
    const lampTex = Texture.from(lampPost());
    for (const l of map.lamps) {
      const p = toScreen(l.x, l.y);
      const s = new Sprite(lampTex);
      s.anchor.set(0.5, 57 / 60);
      s.scale.set(1 / SPRITE_RES);
      s.position.set(p.x, p.y);
      s.zIndex = l.x + l.y;
      this.objects.addChild(s);
      this.props.push(s);
      const gl = new Sprite(this.glowTex);
      gl.anchor.set(0.5);
      gl.blendMode = 'add';
      gl.scale.set(1.3);
      gl.position.set(p.x, p.y);
      this.lights.addChild(gl);
      this.lampGlows.push(gl);
    }
    const treeTex = [0, 1, 2, 3].map((i) => Texture.from(tree(i * 7919 + 13)));
    map.trees.forEach((t, i) => {
      // keep paths, the ring walk and the bandstand clear
      if (this.parkCenters.some((c) => { const dx = t.x - c.x, dy = t.y - c.y, d = Math.hypot(dx, dy); return d < 1.2 || (d > 1.55 && d < 2.4) || ((Math.abs(dx) < 0.45 || Math.abs(dy) < 0.45) && d < 3.1); })) return;
      const p = toScreen(t.x, t.y);
      const s = new Sprite(treeTex[i % treeTex.length]);
      s.anchor.set(0.5, 60 / 64);
      s.scale.set((0.9 + (i % 5) * 0.06) / SPRITE_RES);
      s.position.set(p.x, p.y);
      s.zIndex = t.x + t.y;
      this.objects.addChild(s);
      this.props.push(s);
    });
    this.placeStreetProps();
    this.ambient = new Ambient(map);
    void PathFinder;
  }

  /** Street furniture and parked cars along the sidewalks (cosmetic). */
  private placeStreetProps() {
    const map = this.map;
    const rnd = artRng(map.w * 131 + map.h * 7 + map.lots.length);
    const tex = new Map<PropKind, { t: Texture; ax: number; ay: number }>();
    const get = (k: PropKind) => {
      let v = tex.get(k);
      if (!v) { const a = propArt(k); v = { t: Texture.from(a.cv), ax: a.ax, ay: a.ay }; tex.set(k, v); }
      return v;
    };
    const tile = (x: number, y: number) => (x < 0 || y < 0 || x >= map.w || y >= map.h ? -1 : map.tiles[y * map.w + x]);
    const nearDoor = (x: number, y: number, r: number) => map.lots.some((l) => Math.hypot(l.door.x - x, l.door.y - y) < r);
    const lotNear = (x: number, y: number) => map.lots.find((l) => x >= l.x - 1 && x <= l.x + l.size && y >= l.y - 1 && y <= l.y + l.size);
    const kinds: PropKind[] = ['hydrant', 'mailbox', 'trash', 'bench', 'newsstand', 'clock', 'hydrant', 'trash'];
    for (let y = 0; y < map.h; y++) for (let x = 0; x < map.w; x++) {
      if (tile(x, y) !== 0) continue;
      const dirs = [[0, -1], [0, 1], [-1, 0], [1, 0]].filter(([dx, dy]) => tile(x + dx, y + dy) === 1 || tile(x + dx, y + dy) === 2);
      if (!dirs.length) continue;
      const [dx, dy] = dirs[0];
      const px = x + 0.5 + dx * 0.36, py = y + 0.5 + dy * 0.36;
      const r = rnd();
      if (r < 0.075 && !nearDoor(px, py, 1.1)) {
        const lot = lotNear(x + dx, y + dy);
        let kind = kinds[Math.floor(rnd() * kinds.length)];
        if (lot && (lot.type === 'warehouse' || lot.type === 'pier' || lot.type === 'garage')) kind = rnd() < 0.5 ? 'barrels' : 'crates';
        const a = get(kind);
        const sp = new Sprite(a.t);
        sp.anchor.set(a.ax, a.ay);
        sp.scale.set(1 / SPRITE_RES);
        const q = toScreen(px, py);
        sp.position.set(q.x, q.y);
        sp.zIndex = px + py;
        this.objects.addChild(sp);
        this.props.push(sp);
      } else if (r > 0.955 && !nearDoor(px, py, 1.6)) {
        // parked car at the kerb, nose along the street
        const intersection = (x % 8 < 2) && (y % 8 < 2);
        if (intersection) continue;
        const cx = x + 0.5 + dx * 0.05, cy = y + 0.5 + dy * 0.05;
        const along = dy !== 0 ? (rnd() < 0.5 ? 0 : 2) : (rnd() < 0.5 ? 1 : 3);
        const color = CIV_CARS[Math.floor(rnd() * CIV_CARS.length)];
        const frames = this.carTex('park-' + color, color, rnd() < 0.2 ? 'roadster' : 'sedan');
        const fr = frames[along];
        const sp = new Sprite(fr.tex);
        this.applyCar(sp, fr, color, 0xffffff);
        this.parked.push({ sp, fr, color });
        const q = toScreen(cx, cy);
        sp.position.set(q.x, q.y);
        sp.zIndex = cx + cy;
        this.objects.addChild(sp);
      }
    }
  }
  private parked: { sp: Sprite; fr: CarFrame; color: number }[] = [];
  private parkCenters: { x: number; y: number }[] = [];
  private out!: Outskirts;
  private steamT = 0;
  rain = 0;

  // ---------- camera ----------
  setCamera(x: number, y: number, zoom = this.zoom) {
    const { w, h } = this.map;
    const minX = -(h + 6) * (TW / 2), maxX = (w + 6) * (TW / 2), maxY = (w + h + 10) * (TH / 2);
    this.camX = Math.max(minX, Math.min(maxX, x));
    this.camY = Math.max(-260, Math.min(maxY, y));
    this.zoom = Math.max(0.35, Math.min(2.6, zoom));
    this.applyCamera();
  }
  applyCamera() {
    const sw = this.app.screen.width, sh = this.app.screen.height;
    this.root.scale.set(this.zoom);
    this.root.position.set(sw / 2 - this.camX * this.zoom, sh / 2 - this.camY * this.zoom);
  }
  centerOnTile(x: number, y: number) { const p = toScreen(x, y); this.setCamera(p.x, p.y); }
  panBy(dx: number, dy: number) { this.setCamera(this.camX - dx / this.zoom, this.camY - dy / this.zoom); }
  zoomAt(factor: number, sx: number, sy: number) {
    const before = this.screenToIso(sx, sy);
    const nz = Math.max(0.35, Math.min(2.6, this.zoom * factor));
    this.zoom = nz;
    const sw = this.app.screen.width, sh = this.app.screen.height;
    this.setCamera(before.x - (sx - sw / 2) / nz, before.y - (sy - sh / 2) / nz, nz);
  }
  screenToIso(sx: number, sy: number) {
    return { x: (sx - this.root.position.x) / this.zoom, y: (sy - this.root.position.y) / this.zoom };
  }
  screenToTile(sx: number, sy: number) { const p = this.screenToIso(sx, sy); return toWorld(p.x, p.y); }
  tileToScreen(x: number, y: number) { const p = toScreen(x, y); return { x: p.x * this.zoom + this.root.position.x, y: p.y * this.zoom + this.root.position.y }; }
  /** Visible world area as four tile-space corners (for the minimap). */
  viewCorners() {
    const sw = this.app.screen.width, sh = this.app.screen.height;
    return [this.screenToTile(0, 0), this.screenToTile(sw, 0), this.screenToTile(sw, sh), this.screenToTile(0, sh)];
  }

  // ---------- textures ----------
  private personTex(key: string, look: PersonLook): Texture[] {
    let t = this.texCache.get(key);
    if (!t) { t = personFrames(look).map((c) => Texture.from(c)); this.texCache.set(key, t); }
    return t;
  }
  private lookFor(u: Unit, view: ViewState): { key: string; look: PersonLook } {
    if (u.cop) return { key: 'cop', look: { coat: 0x2a3a6a, hat: 0x1a2240, pants: 0x1e2436, skin: 0xd8b090, kind: 'cop' } };
    const f = view.families[u.fam];
    const color = f ? hex(f.color) : 0x888888;
    const coat = mix(color, 0x222222, 0.25);
    const kind = u.boss || u.hero ? 'boss' : u.name.match(/^(Mae|Rosie|Dot|Ruby|Hattie|Nell|Lena|Irene|Ida|Viola|Lottie)\b/) ? 'woman' : 'gangster';
    const skin = [0xe0b898, 0xc89a78, 0x9a6a4a, 0x6a4a32, 0xd8a888][u.id % 5];
    const hat = u.hero ? 0xd8d0c0 : u.boss ? 0x1a1a1a : mix(color, 0x101010, 0.6);
    return { key: `${u.fam}-${kind}-${u.id % 5}-${u.hero ? 1 : 0}`, look: { coat, hat, pants: 0x24242a, skin, kind } };
  }
  private carTex(key: string, color: number, model: string): CarFrame[] {
    const front = this.pack?.car(model, 'front') ?? (model === 'taxi' ? this.pack?.car('sedan', 'front') : null);
    const rear = this.pack?.car(model, 'rear') ?? (model === 'taxi' ? this.pack?.car('sedan', 'rear') : null);
    if (front && rear) {
      const f = (tex: Texture, flip: boolean): CarFrame => ({ tex, ax: 0.5, ay: 0.8, s: 104 / tex.width, flip, tintable: true });
      return [f(front, false), f(front, true), f(rear, true), f(rear, false)];
    }
    let t = this.carCache.get(key);
    if (!t) {
      t = [0, 1, 2, 3].map((d) => { const fr = carFrame({ body: color, model: model as 'sedan' }, d); return { tex: Texture.from(fr.cv), ax: fr.ox / (fr.cv.width / SPRITE_RES), ay: fr.oy / (fr.cv.height / SPRITE_RES), s: 1 / SPRITE_RES, flip: false, tintable: false }; });
      this.carCache.set(key, t);
    }
    return t;
  }
  private applyCar(sp: Sprite, fr: CarFrame, color: number, ambient: number) {
    sp.texture = fr.tex;
    sp.anchor.set(fr.ax, fr.ay);
    sp.scale.set((fr.flip ? -1 : 1) * fr.s, fr.s);
    // imported cars are painted light grey so each family can colour them
    sp.tint = fr.tintable ? mul(mix(color, 0xffffff, 0.25), ambient) : ambient;
  }
  /** Imported character art for a unit, if the art pack has some. */
  private packPerson(u: Unit, view: ViewState): Texture[] | null {
    if (!this.pack || this.pack.empty) return null;
    const fam = u.cop ? 'police' : (view.families[u.fam]?.short ?? '').toLowerCase();
    const keys: string[] = [];
    if (u.hero && view.mode === 'campaign') keys.push('nico');
    if (u.boss && u.tag) keys.push(u.tag);
    if (u.boss) keys.push(fam + '-boss');
    keys.push(fam);
    return this.pack.person(keys, u.id);
  }

  // ---------- buildings ----------
  private ensureBuildings(view: ViewState) {
    if (this.buildings.size || !view.buildings.length) return;
    for (const b of view.buildings) {
      if (b.type === 'park' || b.type === 'water' || b.type === 'plaza') continue;
      const custom = this.pack?.building(b.type, BTYPES[b.type].look, b.size, b.seed) ?? null;
      if (custom) { this.addCustomBuilding(b, custom); continue; }
      const art = buildingArt(b);
      const dayTex = Texture.from(art.day);
      const spr = new Sprite(dayTex);
      spr.anchor.set(art.ox / art.w, art.oy / art.h);
      spr.scale.set(1 / BUILDING_RES);
      const p = toScreen(b.x + INSET, b.y + INSET);
      spr.position.set(p.x, p.y);
      const depth = b.x + b.y + b.size;
      spr.zIndex = depth;
      const lit = new Sprite(Texture.from(art.lit));
      lit.anchor.copyFrom(spr.anchor);
      lit.scale.copyFrom(spr.scale);
      lit.position.copyFrom(spr.position);
      lit.zIndex = depth + 0.001;
      lit.blendMode = 'add';
      const fl = new Sprite(this.flagTex);
      fl.anchor.set(0.05, 1);
      fl.scale.set(1 / SPRITE_RES);
      fl.position.set(p.x + art.flag.x, p.y + art.flag.y);
      fl.zIndex = depth + 0.002;
      this.objects.addChild(spr, lit, fl);
      const s = b.size - INSET * 2;
      const T = toScreen(b.x + INSET, b.y + INSET), R = toScreen(b.x + INSET + s, b.y + INSET), B = toScreen(b.x + INSET + s, b.y + INSET + s), L = toScreen(b.x + INSET, b.y + INSET + s);
      const Hh = art.height + (b.type === 'church' ? 60 : 12);
      this.buildings.set(b.id, { b, art, spr, lit, flag: fl, burned: null, dayTex, depth, fade: 1, custom: false, poly: [T.x, T.y - Hh, R.x, R.y - Hh, R.x, R.y, B.x, B.y, L.x, L.y, L.x, L.y - Hh] });
    }
  }

  /** A building drawn from an imported picture: the footprint's lower corner sits on the bottom of the image. */
  private addCustomBuilding(b: Building, tex: Texture) {
    const s = b.size - INSET * 2;
    const B = toScreen(b.x + INSET + s, b.y + INSET + s);
    const scale = (s * 64) / tex.width;
    const h = tex.height * scale;
    const spr = new Sprite(tex);
    spr.anchor.set(0.5, 1);
    spr.scale.set(scale);
    spr.position.set(B.x, B.y + 2);
    const depth = b.x + b.y + b.size;
    spr.zIndex = depth;
    const lit = new Sprite(Texture.EMPTY);
    lit.alpha = 0;
    const fl = new Sprite(this.flagTex);
    fl.anchor.set(0.05, 1);
    fl.scale.set(1 / SPRITE_RES);
    fl.position.set(B.x + s * 14, B.y - h * 0.9);
    fl.zIndex = depth + 0.002;
    this.objects.addChild(spr, fl);
    const art: BuildingArt = { day: null as unknown as HTMLCanvasElement, lit: null as unknown as HTMLCanvasElement, ox: 0, oy: 0, w: s * 64, h, flag: { x: 0, y: 0 }, height: Math.max(20, h - s * 32) };
    const poly = [B.x - s * 32, B.y - h, B.x + s * 32, B.y - h, B.x + s * 32, B.y - s * 16, B.x, B.y, B.x - s * 32, B.y - s * 16];
    this.buildings.set(b.id, { b, art, spr, lit, flag: fl, burned: null, dayTex: tex, depth, fade: 1, custom: true, poly });
  }

  private drawOwners(view: ViewState) {
    const key = view.buildings.map((b) => (b.owner ?? '-') + (b.burned ? 'x' : '') + (this.selectedBuilding === b.id ? 's' : '') + (this.highlight.includes(b.id) ? 'h' : '')).join('');
    if (key === this.ownerKey) return;
    this.ownerKey = key;
    const g = this.ownerG;
    g.clear();
    for (const b of view.buildings) {
      const f = b.owner ? view.families[b.owner] : null;
      const c = b.type === 'precinct' ? 0x4d8cff : f ? hex(f.color) : 0;
      const m = 0.05;
      const pts = [toScreen(b.x + m, b.y + m), toScreen(b.x + b.size - m, b.y + m), toScreen(b.x + b.size - m, b.y + b.size - m), toScreen(b.x + m, b.y + b.size - m)].flatMap((p) => [p.x, p.y]);
      if (c) { g.poly(pts).fill({ color: c, alpha: 0.16 }); g.poly(pts).stroke({ width: 3, color: c, alpha: 0.95 }); }
      if (this.selectedBuilding === b.id || this.highlight.includes(b.id)) g.poly(pts).stroke({ width: 3, color: 0xffffff, alpha: 0.9 });
      // door marker
      const d = toScreen(b.door.x, b.door.y);
      g.ellipse(d.x, d.y, 7, 3.5).fill({ color: c || 0xd8d0c0, alpha: c ? 0.8 : 0.35 });
    }
  }

  // ---------- per frame ----------
  sync(dt: number) {
    const view = this.sess.view();
    this.time += dt;
    this.ensureBuildings(view);
    const nf = nightFactor(view.hour);
    const dusk = view.hour > 16 && view.hour < 21 ? 1 - Math.abs(view.hour - 19) / 2.5 : 0;
    const visEarly = this.sess.vis();
    const seenFn = (x: number, y: number) => !visEarly || visEarly[Math.floor(y) * this.map.w + Math.floor(x)] === 1;
    // warm amber by day, deep blue at night, a little greyer when it rains
    let ambient = mix(0xfff1dc, 0x55669f, nf * 0.85);
    if (dusk > 0 && nf < 0.8) ambient = mix(ambient, 0xffa860, Math.max(0, dusk) * 0.4);
    if (this.rain > 0) ambient = mix(ambient, 0x8c96a4, 0.28 * this.rain);
    this.groundG.tint = ambient;
    for (const c of this.out.back.children) if (c !== this.out.night) (c as Graphics).tint = ambient;
    this.out.night.alpha = nf;
    for (const o of this.out.objects) { o.sprite.tint = ambient; if (o.lit) { o.lit.alpha = nf; o.lit.visible = nf > 0.05; } }
    this.steamT -= dt;
    if (this.steamT <= 0) {
      this.steamT = 0.25;
      for (const st of this.out.steam) {
        if (!seenFn(st.x, st.y)) continue;
        const q = toScreen(st.x, st.y);
        this.sparks.push({ x: q.x + (Math.random() - 0.5) * 6, y: q.y - 2, vx: (Math.random() - 0.5) * 6, vy: -12 - Math.random() * 6, life: 2.4, max: 2.4, color: 0xc8c8c4, size: 3 + Math.random() * 2.5, grav: -2, a: 0.32 });
      }
    }
    this.ownerG.alpha = 0.6 + nf * 0.4;
    const vis = this.sess.vis();
    if (vis) for (let i = 0; i < vis.length; i++) if (vis[i]) this.explored[i] = 1;
    const seen = (x: number, y: number) => {
      if (!vis) return true;
      const tx = Math.floor(x), ty = Math.floor(y);
      return tx >= 0 && ty >= 0 && tx < this.map.w && ty < this.map.h && vis[ty * this.map.w + tx] === 1;
    };
    this.drawOwners(view);
    this.drawFog(vis);

    // our own people and cars hidden behind a building make it see-through
    const behind: { x: number; y: number; d: number }[] = [];
    for (const u of view.units) {
      if (u.fam !== this.sess.fam || u.loc !== 'street') continue;
      const p = this.sess.lerpPos(u.id, u.x, u.y);
      const sp = toScreen(p.x, p.y);
      behind.push({ x: sp.x, y: sp.y - 20, d: p.x + p.y });
    }
    for (const v of view.vehicles) {
      if (v.fam !== this.sess.fam || v.dead) continue;
      const sp = toScreen(v.x, v.y);
      behind.push({ x: sp.x, y: sp.y - 10, d: v.x + v.y });
    }

    // buildings
    for (const bs of this.buildings.values()) {
      const b = view.buildings[bs.b.id] ?? bs.b;
      bs.b = b;
      const hides = behind.some((q) => q.d < bs.depth - 0.2 && inPoly(q.x, q.y, bs.poly));
      const target = hides ? 0.3 : 1;
      bs.fade += (target - bs.fade) * Math.min(1, dt * 8);
      bs.spr.alpha = bs.fade;
      bs.flag.alpha = bs.fade;
      if (b.burned && !bs.burned && !bs.custom) bs.burned = Texture.from(burnedArt(bs.art));
      bs.spr.texture = b.burned && bs.burned ? bs.burned : bs.dayTex;
      const fogDim = vis && !seen(b.door.x, b.door.y) ? (this.explored[Math.floor(b.door.y) * this.map.w + Math.floor(b.door.x)] ? 0.62 : 0.45) : 1;
      bs.spr.tint = mul(ambient, mix(0x000000, 0xffffff, fogDim * (bs.custom && b.burned ? 0.35 : 1)));
      bs.lit.alpha = b.burned ? 0 : nf * (b.racket ? 1 : 0.85) * (b.type === 'warehouse' ? 0.6 : 1);
      bs.lit.alpha *= bs.fade;
      bs.lit.visible = bs.lit.alpha > 0.02;
      const f = b.owner ? view.families[b.owner] : null;
      bs.flag.visible = !!f;
      if (f) { bs.flag.tint = mul(hex(f.color), ambient); bs.flag.skew.x = Math.sin(this.time * 3 + b.id) * 0.06; }
    }
    for (const s of this.props) s.tint = ambient;
    for (const c of this.parked) this.applyCar(c.sp, c.fr, c.color, ambient);
    for (const g of this.lampGlows) { g.alpha = nf * 0.75; g.visible = nf > 0.05; }

    // events
    for (const e of view.events) {
      if (e.id <= this.lastEv) continue;
      this.lastEv = Math.max(this.lastEv, e.id);
      let visible = true;
      if (e.k === 'shot') {
        visible = seen(e.x, e.y) || seen(e.tx, e.ty);
        if (visible) this.addShot(e.x, e.y, e.tx, e.ty, e.hit, e.w, e.t);
        this.ambient.scare(e.x, e.y);
      } else if (e.k === 'death') {
        visible = seen(e.x, e.y);
        if (visible) this.addCorpse(e.x, e.y, view.families[e.fam]?.color);
      } else if (e.k === 'cash' && e.fam === this.sess.fam && Math.abs(e.amount) >= 10) {
        this.float(e.x, e.y, (e.amount >= 0 ? '+$' : '−$') + Math.abs(e.amount), e.amount >= 0 ? 0x8fe3b8 : 0xff7a6a);
      } else if (e.k === 'capture') {
        const b = view.buildings[e.b];
        if (b && (e.fam === this.sess.fam || e.prev === this.sess.fam)) this.float(b.door.x, b.door.y, e.fam === this.sess.fam ? 'Ours!' : 'Lost!', hex(view.families[e.fam]?.color ?? '#ffffff'));
      } else if (e.k === 'levelup' && e.fam === this.sess.fam) {
        const u = view.units.find((x) => x.id === e.unit);
        if (u) this.float(u.x, u.y, 'LEVEL UP', 0xd8b25a);
      } else if (e.k === 'arrest') {
        visible = seen(e.x, e.y);
        if (visible) this.float(e.x, e.y, 'ARRESTED', 0x7aa8ff);
      }
      this.onEvent?.(e, visible);
    }

    // units
    const now = this.time;
    for (const u of view.units) {
      const show = (u.loc === 'street') && (u.fam === this.sess.fam || seen(u.x, u.y));
      let us = this.units.get(u.id);
      if (!show) { if (us) us.root.visible = false; continue; }
      const custom = this.packPerson(u, view);
      const { key: baseKey, look } = this.lookFor(u, view);
      const key = custom ? 'pk:' + custom[0].uid : baseKey;
      if (!us || us.key !== key) {
        if (us) us.root.destroy({ children: true });
        const frames = custom ? (custom.length >= 4 ? custom : [custom[0], custom[0], custom[0], custom[0]]) : this.personTex(key, look);
        const root = new Container();
        const shadow = new Sprite(this.dotTex);
        shadow.anchor.set(0.5); shadow.tint = 0; shadow.alpha = 0.45; shadow.scale.set(0.7, 0.3);
        const body = new Sprite(frames[0]);
        body.anchor.set(0.5, custom ? 0.97 : 37 / 40);
        const base = custom ? 46 / custom[0].height : 1 / SPRITE_RES;
        body.scale.set(base);
        root.addChild(shadow, body);
        this.objects.addChild(root);
        us = { root, body, shadow, frames, key, seen: now, base, single: !!custom && custom.length < 4 };
        this.units.set(u.id, us);
      }
      us.seen = now;
      us.root.visible = true;
      const p = this.sess.lerpPos(u.id, u.x, u.y);
      const jx = ((u.id * 37) % 7 - 3) * 0.035, jy = ((u.id * 53) % 7 - 3) * 0.035;
      const sp = toScreen(p.x + jx, p.y + jy);
      us.root.position.set(sp.x, sp.y);
      us.root.zIndex = p.x + p.y + 0.0005;
      const aiming = u.target >= 0 && view.time - u.lastShot < 1.2;
      const walking = u.moving || u.path.length > 0;
      const frame = aiming ? 3 : walking ? 1 + (Math.floor(now * 7 + u.id) % 2) : 0;
      us.body.texture = us.frames[frame];
      const big = (u.hero || u.boss ? 1.12 : 1) * (us.base ?? 1 / SPRITE_RES);
      us.body.scale.set((u.face >= 0 ? 1 : -1) * big, big);
      if (us.single) {
        // one still picture: bob while walking, lean when shooting
        us.body.y = walking ? -Math.abs(Math.sin(now * 10 + u.id)) * 2.5 : 0;
        us.body.rotation = aiming ? 0.06 * (u.face >= 0 ? 1 : -1) : walking ? Math.sin(now * 10 + u.id) * 0.04 : 0;
      }
      const hurt = (this.hurtUntil.get(u.id) ?? 0) > now;
      us.body.tint = hurt ? 0xff5a4a : mix(ambient, 0xffffff, 0.35);
    }
    for (const [id, us] of this.units) if (us.seen !== now) { if (now - us.seen > 2) { us.root.destroy({ children: true }); this.units.delete(id); } else us.root.visible = false; }

    // vehicles
    for (const v of view.vehicles) {
      const show = !v.dead && (v.fam === this.sess.fam || seen(v.x, v.y));
      let vs = this.vehicles.get(v.id);
      if (!show) { if (vs) vs.root.visible = false; continue; }
      const f = view.families[v.fam];
      const color = f ? mix(hex(f.color), 0x1a1a1a, 0.45) : 0x2a2a2a;
      const key = `${v.model}-${v.fam}`;
      if (!vs || vs.key !== key) {
        if (vs) vs.root.destroy({ children: true });
        const frames = this.carTex(key, color, v.model);
        const root = new Container();
        const head = new Sprite(this.headTex);
        head.anchor.set(0.1, 0.5); head.blendMode = 'add'; head.scale.set(0.9, 0.9);
        const body = new Sprite(frames[0].tex);
        root.addChild(head, body);
        this.objects.addChild(root);
        vs = { root, body, key, frames, head, seen: now, color };
        this.vehicles.set(v.id, vs);
      }
      vs.seen = now;
      vs.root.visible = true;
      const p = this.sess.lerpPos(v.id, v.x, v.y);
      const sp = toScreen(p.x, p.y);
      vs.root.position.set(sp.x, sp.y);
      vs.root.zIndex = p.x + p.y + 0.001;
      const fr = vs.frames[v.face] ?? vs.frames[0];
      this.applyCar(vs.body, fr, vs.color ?? color, ambient);
      vs.head.alpha = nf * 0.6;
      vs.head.visible = nf > 0.1;
      const dirv = [toScreen(1, 0), toScreen(0, 1), toScreen(-1, 0), toScreen(0, -1)][v.face];
      vs.head.rotation = Math.atan2(dirv.y, dirv.x);
      // exhaust puffs while driving
      if (v.path.length && Math.random() < dt * 14) {
        const back = [[-1, 0], [0, -1], [1, 0], [0, 1]][v.face];
        const q = toScreen(p.x + back[0] * 0.75, p.y + back[1] * 0.75);
        this.sparks.push({ x: q.x, y: q.y - 6, vx: (Math.random() - 0.5) * 10, vy: -12 - Math.random() * 10, life: 0.9, max: 0.9, color: 0x9a9a98, size: 2.5 + Math.random() * 2.5, grav: -6 });
      }
    }
    for (const [id, vs] of this.vehicles) if (vs.seen !== now) { vs.root.destroy({ children: true }); this.vehicles.delete(id); }

    this.syncAmbient(dt, view, ambient, seen);
    this.drawFx(dt, view, nf);
    this.drawBars(view, seen);
    this.updateFloats(dt);
    for (const c of this.corpses) { c.life -= dt; c.s.alpha = Math.min(1, c.life / 3); c.s.tint = ambient; }
    this.corpses = this.corpses.filter((c) => { if (c.life <= 0) { c.s.destroy(); return false; } return true; });
  }

  private syncAmbient(dt: number, view: ViewState, ambient: number, seen: (x: number, y: number) => boolean) {
    this.ambient.update(dt, view.hour);
    for (const w of this.ambient.walkers) {
      let s = this.civs.get(w.id);
      if (!s) {
        if (w.car) {
          const color = CIV_CARS[w.look % CIV_CARS.length];
          const frames = this.carTex('civ-' + color + (w.look === 5 ? 't' : ''), color, w.look === 5 ? 'taxi' : 'sedan');
          const root = new Container();
          const head = new Sprite(this.headTex); head.anchor.set(0.1, 0.5); head.blendMode = 'add';
          const body = new Sprite(frames[0].tex);
          root.addChild(head, body);
          this.objects.addChild(root);
          s = { root, body, key: 'c', frames, head, seen: 0, color } as VSprite;
        } else {
          const coat = CIV_COATS[w.look];
          const look: PersonLook = { coat, hat: mix(coat, 0x111111, 0.5), pants: 0x2a2a30, skin: [0xe0b898, 0xc89a78, 0x9a6a4a, 0x6a4a32][w.look % 4], kind: w.look % 3 === 0 ? 'woman' : 'civ' };
          const custom = this.pack?.person(['civilian'], w.look) ?? null;
          const frames = custom ? (custom.length >= 4 ? custom : [custom[0], custom[0], custom[0], custom[0]]) : this.personTex('civ' + w.look, look);
          const root = new Container();
          const shadow = new Sprite(this.dotTex); shadow.anchor.set(0.5); shadow.tint = 0; shadow.alpha = 0.4; shadow.scale.set(0.6, 0.26);
          const body = new Sprite(frames[0]); body.anchor.set(0.5, custom ? 0.97 : 37 / 40);
          const base = custom ? 44 / custom[0].height : 1 / SPRITE_RES;
          body.scale.set(base);
          root.addChild(shadow, body);
          this.objects.addChild(root);
          s = { root, body, shadow, frames, key: 'p', seen: 0, base, single: !!custom && custom.length < 4 } as USprite;
        }
        this.civs.set(w.id, s);
      }
      const sp = toScreen(w.x, w.y);
      s.root.position.set(sp.x, sp.y);
      s.root.zIndex = w.x + w.y;
      s.root.visible = seen(w.x, w.y);
      if (w.car) {
        const vs = s as VSprite;
        const fr = vs.frames[w.dir];
        this.applyCar(vs.body, fr, vs.color ?? 0x2a2a2a, ambient);
        const nf = nightFactor(view.hour);
        vs.head.alpha = nf * 0.5; vs.head.visible = nf > 0.1;
        const dirv = [toScreen(1, 0), toScreen(0, 1), toScreen(-1, 0), toScreen(0, -1)][w.dir];
        vs.head.rotation = Math.atan2(dirv.y, dirv.x);
      } else {
        const us = s as USprite;
        us.body.texture = us.frames[w.moving ? 1 + (Math.floor(this.time * (w.panic > 0 ? 11 : 6) + w.id) % 2) : 0];
        const base = us.base ?? 1 / SPRITE_RES;
        us.body.scale.set((w.face >= 0 ? 1 : -1) * base, base);
        if (us.single) us.body.y = w.moving ? -Math.abs(Math.sin(this.time * 10 + w.id)) * 2 : 0;
        us.body.tint = mix(ambient, 0x000000, 0.08);
      }
    }
  }

  private addShot(x0: number, y0: number, x1: number, y1: number, hit: boolean, w: string, target?: number) {
    const a = toScreen(x0, y0), b = toScreen(x1, y1);
    const ox = hit ? 0 : (Math.random() - 0.5) * 26, oy = hit ? 0 : (Math.random() - 0.5) * 14;
    const sx = a.x + (b.x > a.x ? 9 : -9), sy = a.y - 24;
    const tx = b.x + ox, ty = b.y - 20 + oy;
    const pellets = w === 'shotgun' ? 4 : 1;
    for (let i = 0; i < pellets; i++) {
      const spread = pellets > 1 ? (Math.random() - 0.5) * 16 : 0;
      this.tracers.push({ x0: sx, y0: sy, x1: tx + spread, y1: ty + spread * 0.5, life: 0.16, color: w === 'tommy' ? 0xffd070 : w === 'rifle' ? 0xffffff : 0xfff0b0 });
    }
    const fl = new Sprite(this.dotTex);
    fl.anchor.set(0.5); fl.blendMode = 'add'; fl.tint = 0xffc050;
    fl.scale.set(w === 'shotgun' || w === 'rifle' ? 1.6 : w === 'tommy' ? 1.1 : 1.2);
    fl.position.set(sx, sy);
    this.lights.addChild(fl);
    this.flashes.push({ s: fl, life: 0.1, max: 0.1 });
    if (hit) {
      // blood and a red flash on whoever was hit
      for (let i = 0; i < 7; i++) this.sparks.push({ x: tx, y: ty, vx: (Math.random() - 0.5) * 90 + (b.x - a.x > 0 ? 40 : -40), vy: -Math.random() * 70, life: 0.45, max: 0.45, color: i % 3 ? 0xb01818 : 0xff4030, size: 1.6 + Math.random() * 1.8, grav: 260 });
      if (target !== undefined) this.hurtUntil.set(target, this.time + 0.14);
    } else {
      // dust where the bullet hit the street
      const gx = b.x + ox * 1.4, gy = b.y + Math.abs(oy) * 0.4;
      for (let i = 0; i < 4; i++) this.sparks.push({ x: gx, y: gy, vx: (Math.random() - 0.5) * 40, vy: -20 - Math.random() * 30, life: 0.35, max: 0.35, color: 0xb8ad98, size: 2 + Math.random() * 2, grav: 120 });
    }
  }
  private addCorpse(x: number, y: number, color?: string) {
    const key = 'corpse-' + (color ?? 'x');
    let t = this.texCache.get(key);
    if (!t) { t = [Texture.from(corpse(color ? mix(hex(color), 0x222222, 0.25) : 0x555555))]; this.texCache.set(key, t); }
    const s = new Sprite(t[0]);
    s.anchor.set(0.5, 0.6);
    s.scale.set(1 / SPRITE_RES);
    const p = toScreen(x, y);
    s.position.set(p.x, p.y);
    s.zIndex = x + y - 0.01;
    this.objects.addChild(s);
    this.corpses.push({ s, life: 25 });
  }

  float(x: number, y: number, text: string, color: number) {
    const t = new Text({ text, style: { fontFamily: 'Libre Franklin', fontWeight: '800', fontSize: 15, fill: color, stroke: { color: 0x000000, width: 4 } } });
    t.anchor.set(0.5);
    const p = toScreen(x, y);
    this.overlay.addChild(t);
    this.floats.push({ t, life: 1.8, x: p.x, y: p.y - 40 });
  }
  private updateFloats(dt: number) {
    for (const f of this.floats) {
      f.life -= dt;
      f.t.position.set(f.x, f.y - (1.8 - f.life) * 22);
      f.t.alpha = Math.min(1, f.life);
      f.t.scale.set(1 / Math.max(0.6, this.zoom));
    }
    this.floats = this.floats.filter((f) => { if (f.life <= 0) { f.t.destroy(); return false; } return true; });
  }

  private drawFog(vis: Uint8Array | null) {
    if (!vis) { if (this.fogKey) { this.fogG.clear(); this.fogKey = ''; } return; }
    // cheap change detection
    let h = 0;
    for (let i = 0; i < vis.length; i += 3) h = (h * 31 + vis[i] + this.explored[i] * 2) | 0;
    const key = String(h);
    if (key === this.fogKey) return;
    this.fogKey = key;
    const g = this.fogG;
    g.clear();
    const { w, h: H } = this.map;
    for (let y = 0; y < H; y++) {
      let x = 0;
      while (x < w) {
        const i = y * w + x;
        if (vis[i]) { x++; continue; }
        const ex = this.explored[i];
        let x2 = x + 1;
        while (x2 < w && !vis[y * w + x2] && this.explored[y * w + x2] === ex) x2++;
        const a = toScreen(x, y), b = toScreen(x2, y), c = toScreen(x2, y + 1), d = toScreen(x, y + 1);
        g.poly([a.x, a.y, b.x, b.y, c.x, c.y, d.x, d.y]).fill({ color: 0x05060a, alpha: ex ? 0.38 : 0.62 });
        x = x2;
      }
    }
  }

  private drawFx(dt: number, view: ViewState, nf: number) {
    const g = this.fx;
    g.clear();
    for (const t of this.tracers) {
      t.life -= dt;
      const a = Math.max(0, t.life / 0.16);
      // the bright head travels from gun to target, leaving a fading trail
      const k = Math.min(1, (0.16 - t.life) / 0.05);
      const hx = t.x0 + (t.x1 - t.x0) * k, hy = t.y0 + (t.y1 - t.y0) * k;
      g.moveTo(t.x0, t.y0).lineTo(hx, hy).stroke({ width: 5, color: t.color, alpha: a * 0.18 });
      g.moveTo(t.x0, t.y0).lineTo(hx, hy).stroke({ width: 1.8, color: t.color, alpha: a * 0.95 });
    }
    this.tracers = this.tracers.filter((t) => t.life > 0);
    for (const sp of this.sparks) {
      sp.life -= dt;
      sp.vy += sp.grav * dt;
      sp.x += sp.vx * dt; sp.y += sp.vy * dt;
      g.circle(sp.x, sp.y, sp.size * (sp.a !== undefined ? 1 + (1 - sp.life / sp.max) : 1)).fill({ color: sp.color, alpha: Math.max(0, sp.life / sp.max) * (sp.a ?? 1) });
    }
    this.sparks = this.sparks.filter((sp) => sp.life > 0);
    for (const f of this.flashes) { f.life -= dt; f.s.alpha = Math.max(0, f.life / f.max); }
    this.flashes = this.flashes.filter((f) => { if (f.life <= 0) { f.s.destroy(); return false; } return true; });
    // fires
    for (const b of view.buildings) {
      if (b.fire <= 0 && !b.burned) continue;
      const bs = this.buildings.get(b.id);
      if (!bs) continue;
      const c = toScreen(b.x + b.size / 2, b.y + b.size / 2);
      const top = c.y - bs.art.height;
      if (b.fire > 0) {
        for (let i = 0; i < 14; i++) {
          const ph = (this.time * 2 + i * 0.37) % 1;
          const x = c.x + Math.sin(i * 12.9 + this.time * 3) * b.size * 16;
          const y = top - ph * 40;
          g.circle(x, y, (1 - ph) * 9 + 2).fill({ color: ph < 0.5 ? 0xffb040 : 0xff5a20, alpha: (1 - ph) * 0.85 });
        }
      }
      for (let i = 0; i < 5; i++) {
        const ph = (this.time * 0.4 + i * 0.2) % 1;
        g.circle(c.x + Math.sin(i * 7 + this.time) * 10, top - 20 - ph * 70, 6 + ph * 14).fill({ color: 0x222222, alpha: (1 - ph) * (b.fire > 0 ? 0.5 : 0.18) });
      }
    }
    // cop lights
    for (const u of view.units) {
      if (!u.cop || u.loc !== 'street') continue;
      const us = this.units.get(u.id);
      if (!us || !us.root.visible) continue;
      const on = Math.floor(this.time * 6 + u.id) % 2;
      g.circle(us.root.x, us.root.y - 46, 2.6).fill({ color: on ? 0xff3030 : 0x3080ff });
    }
    void nf;
  }

  private text(i: number): Text {
    if (!this.texts[i]) {
      const t = new Text({ text: '', style: { fontFamily: 'Libre Franklin', fontWeight: '700', fontSize: 11, fill: 0xffffff, stroke: { color: 0x000000, width: 3 } } });
      t.anchor.set(0.5, 0);
      this.overlay.addChild(t);
      this.texts[i] = t;
    }
    return this.texts[i];
  }
  private drawBars(view: ViewState, seen: (x: number, y: number) => boolean) {
    const g = this.bars;
    g.clear();
    const fg = this.fxGround;
    fg.clear();
    this.textUsed = 0;
    const inv = 1 / Math.max(0.7, this.zoom);
    for (const u of view.units) {
      if (u.loc !== 'street') continue;
      if (u.fam !== this.sess.fam && !seen(u.x, u.y)) continue;
      const us = this.units.get(u.id);
      if (!us) continue;
      const x = us.root.x, y = us.root.y;
      const sel = this.selected.has(u.id);
      if (sel) {
        fg.ellipse(x, y, 13, 6.5).stroke({ width: 2, color: 0xffffff, alpha: 0.9 });
        if (u.path.length && u.fam === this.sess.fam) {
          let a = { x, y };
          for (const p of u.path) { const b = toScreen(p.x, p.y); fg.moveTo(a.x, a.y).lineTo(b.x, b.y); a = b; }
          fg.stroke({ width: 1.5, color: 0xffffff, alpha: 0.35 });
        }
      } else if (u.fam !== this.sess.fam && !u.cop) {
        const f = view.families[u.fam];
        fg.ellipse(x, y, 10, 5).stroke({ width: 1.5, color: f ? hex(f.color) : 0xffffff, alpha: 0.7 });
      } else if (u.fam === this.sess.fam) {
        fg.ellipse(x, y, 10, 5).stroke({ width: 1.5, color: hex(view.families[u.fam]?.color ?? '#3fbf8a'), alpha: 0.7 });
      }
      const fighting = view.time - u.lastShot < 1.5 || view.time - u.lastHurt < 1.5;
      if (fighting) {
        const pulse = 0.5 + 0.5 * Math.sin(this.time * 12);
        fg.ellipse(x, y, 15 + pulse * 2, 7.5 + pulse).stroke({ width: 2.2, color: 0xff3a2a, alpha: 0.55 + pulse * 0.35 });
      }
      const showBar = u.hp < u.maxHp - 0.5 || sel || fighting;
      if (showBar) {
        const w = 34 * inv, h = 5 * inv, by = y - 54 * (u.hero || u.boss ? 1.1 : 1);
        g.rect(x - w / 2, by, w, h).fill({ color: 0x000000, alpha: 0.65 });
        const r = Math.max(0, u.hp / u.maxHp);
        const barColor = u.fam === this.sess.fam ? (r > 0.4 ? 0x7be08f : 0xff6b5a) : u.cop ? 0x7aa8ff : (r > 0.4 ? 0xe8c060 : 0xff6b5a);
        g.rect(x - w / 2, by, w * r, h).fill({ color: barColor });
        g.rect(x - w / 2, by, w, h).stroke({ width: 1, color: 0x000000, alpha: 0.8 });
        if (u.fam === this.sess.fam && u.heat > 0) {
          g.rect(x - w / 2, by + h + 1, w, h * 0.7).fill({ color: 0x000000, alpha: 0.6 });
          g.rect(x - w / 2, by + h + 1, (w * u.heat) / 100, h * 0.7).fill({ color: u.heat >= 50 ? 0xff5a5a : 0xd8b25a });
        }
      }
      if (u.task && u.fam === this.sess.fam && u.task.total > 0 && u.task.k !== 'cards') {
        const w = 30 * inv, by = y - 60;
        g.rect(x - w / 2, by, w, 4 * inv).fill({ color: 0x000000, alpha: 0.65 });
        g.rect(x - w / 2, by, (w * Math.min(1, u.task.t / u.task.total)), 4 * inv).fill({ color: 0xd8b25a });
      }
      if (u.fam === this.sess.fam && u.heat >= 50) {
        g.circle(x + 12, y - 44, 5 * inv).fill({ color: 0xff3a3a });
      }
      if ((u.hero || u.boss || sel) && this.zoom > 0.55) {
        const t = this.text(this.textUsed++);
        t.visible = true;
        t.text = u.hero || u.boss ? u.name : u.name.split(' ')[0];
        t.position.set(x, y + 4);
        t.scale.set(inv);
        t.style.fill = u.boss && u.fam !== this.sess.fam ? 0xffd36b : 0xffffff;
      }
    }
    // capture progress on buildings
    for (const b of view.buildings) {
      const entries = Object.entries(b.prog);
      if (!entries.length) continue;
      const [fid, v] = entries.sort((a, c) => c[1] - a[1])[0];
      if (v < 1) continue;
      const bs = this.buildings.get(b.id);
      if (!bs) continue;
      const c = toScreen(b.x + b.size / 2, b.y + b.size / 2);
      const top = c.y - bs.art.height - 18;
      const w = 50 * inv;
      g.rect(c.x - w / 2, top, w, 6 * inv).fill({ color: 0x000000, alpha: 0.7 });
      g.rect(c.x - w / 2, top, (w * Math.min(100, v)) / 100, 6 * inv).fill({ color: hex(view.families[fid as FamId]?.color ?? '#ffffff') });
    }
    // selected vehicle
    if (this.selectedVehicle >= 0) {
      const vs = this.vehicles.get(this.selectedVehicle);
      if (vs) fg.ellipse(vs.root.x, vs.root.y, 30, 15).stroke({ width: 2, color: 0xffffff, alpha: 0.9 });
    }
    for (let i = this.textUsed; i < this.texts.length; i++) this.texts[i].visible = false;
  }

  // ---------- picking ----------
  pick(sx: number, sy: number): Hit {
    const view = this.sess.view();
    const p = this.screenToIso(sx, sy);
    let best: Hit | null = null, bestD = 1e9;
    const R = Math.max(14, 16 / this.zoom);
    for (const u of view.units) {
      const us = this.units.get(u.id);
      if (!us || !us.root.visible) continue;
      const dx = p.x - us.root.x, dy = p.y - (us.root.y - 18);
      const d = Math.hypot(dx, dy * 0.7);
      if (d < R + 6 && d < bestD) { bestD = d; best = { k: 'unit', u }; }
    }
    if (best) return best;
    for (const v of view.vehicles) {
      const vs = this.vehicles.get(v.id);
      if (!vs || !vs.root.visible) continue;
      const d = Math.hypot(p.x - vs.root.x, (p.y - vs.root.y + 8) * 1.4);
      if (d < 34 && d < bestD) { bestD = d; best = { k: 'vehicle', v }; }
    }
    if (best) return best;
    let bb: BSprite | null = null;
    for (const bs of this.buildings.values()) {
      if (inPoly(p.x, p.y, bs.poly) && (!bb || bs.depth > bb.depth)) bb = bs;
    }
    if (bb) return { k: 'building', b: view.buildings[bb.b.id] ?? bb.b };
    const t = toWorld(p.x, p.y);
    return { k: 'ground', x: t.x, y: t.y };
  }

  destroy() {
    this.root.destroy({ children: true });
    for (const t of this.texCache.values()) for (const x of t) x.destroy(true);
    for (const t of this.carCache.values()) for (const x of t) x.tex.destroy(true);
    for (const b of this.buildings.values()) { b.dayTex.destroy(true); b.lit.texture.destroy(true); b.burned?.destroy(true); }
  }
}

function inPoly(x: number, y: number, pts: number[]): boolean {
  let inside = false;
  for (let i = 0, j = pts.length - 2; i < pts.length; j = i, i += 2) {
    const xi = pts[i], yi = pts[i + 1], xj = pts[j], yj = pts[j + 1];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

export { BTYPES };
