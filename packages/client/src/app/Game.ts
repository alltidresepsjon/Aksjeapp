// One running mission (campaign chapter or Turf War match): map view, HUD, panels and controls.

import { Application } from 'pixi.js';
import {
  BTYPES, OFFICIALS, RACKETS, SPEC_INFO, VEHICLES, VEHICLE_LIST, WEAPONS, WEAPON_LIST, isNight, isOpen, nightFactor,
  type Act, type Building, type Command, type GameEvent, type Racket, type Stance, type StatKey, type Unit, type Vehicle, type ViewState, type WeaponId,
} from '@bg/shared';
import { WorldRenderer, type Hit } from '../render/WorldRenderer';
import { Minimap } from '../render/Minimap';
import { Input } from '../input/Input';
import { audio } from '../audio/Audio';
import type { Session } from '../session/Session';
import { $, $$, clock, el, esc, money, setHtml, statIcons } from '../ui/dom';

export interface GameOptions {
  title: string;
  subtitle: string;
  tip?: string;
  onEnd: (won: boolean, text: string) => void;
  onQuit: () => void;
  quitLabel: string;
}

type Mode = 'none' | 'kidnap' | 'routeFrom' | 'routeTo' | 'box';

const STANCES: { k: Stance; label: string; hint: string }[] = [
  { k: 'passive', label: 'Passive', hint: 'Hold fire. Sneak past, stay unnoticed.' },
  { k: 'defensive', label: 'Defend', hint: 'Shoot back at anyone who threatens us.' },
  { k: 'aggressive', label: 'Attack', hint: 'Open fire on any rival in range, and chase them.' },
];

export class Game {
  root: HTMLElement;
  app = new Application();
  renderer!: WorldRenderer;
  minimap!: Minimap;
  input!: Input;
  sel = new Set<number>();
  selVehicle = -1;
  selBuilding = -1;
  mode: Mode = 'none';
  routeFrom = -1;
  private uiT = 0;
  private ended = false;
  private tab = 'crew';
  private lastNews = '';
  private toastsSeen = new Set<number>();
  private destroyed = false;
  private sheetOpen = false;
  private lastNight = false;

  constructor(private host: HTMLElement, public sess: Session, private opts: GameOptions) {
    this.root = el(`<div class="game">
      <header id="hud">
        <div class="brand">Bathtub Gin</div>
        <div class="stat" id="h-cash"><small>Cash</small><b>$0</b></div>
        <div class="stat" id="h-inc"><small>Per day</small><b>$0</b></div>
        <div class="stat" id="h-time"><small>Day 1</small><b>08:00</b><div class="bar"><i></i></div></div>
        <div class="stat" id="h-heat"><small>Heat</small><b>0</b><div class="bar heat"><i></i></div></div>
        <div id="speed">
          <button data-sp="0" title="Pause (Space)">❚❚</button>
          <button data-sp="1" title="Normal speed (1)">1×</button>
          <button data-sp="2" title="Fast (2)">2×</button>
          <button data-sp="3" title="Fastest (3)">3×</button>
          <button data-sp="skip" title="Skip to dusk/dawn (N)" class="skip">⏭</button>
        </div>
        <button id="h-menu" class="iconbtn" title="Menu (Esc)">☰</button>
      </header>
      <div id="ticker"><b>HERALD</b><span></span></div>
      <main>
        <div id="view">
          <div id="toasts"></div>
          <div id="maptools">
            <button data-tool="all" title="Select whole crew (A)">👥 All</button>
            <button data-tool="box" title="Drag a box to select (or Shift+drag)">⬚ Box</button>
            <button data-tool="hero" title="Find the boss (H)">◎</button>
          </div>
          <div id="modehint"></div>
          <div id="mmhost"></div>
          <div id="selbar"></div>
          <div id="card"></div>
          <div id="boxsel"></div>
        </div>
        <aside id="side">
          <nav id="tabs">
            <button data-tab="crew" class="on">Crew</button>
            <button data-tab="paper">Herald<span class="badge" id="adBadge"></span></button>
            <button data-tab="goals">Goals</button>
          </nav>
          <section class="pane on" id="p-crew"></section>
          <section class="pane" id="p-paper"></section>
          <section class="pane" id="p-goals"></section>
        </aside>
      </main>
      <div id="overlay"></div>
    </div>`);
    host.appendChild(this.root);
  }

  async start() {
    const view = $('#view', this.root);
    await this.app.init({ resizeTo: view, background: 0x0b0d12, antialias: true, resolution: Math.min(2, devicePixelRatio || 1), autoDensity: true });
    if (this.destroyed) return;
    view.prepend(this.app.canvas);
    this.renderer = new WorldRenderer(this.app, this.sess.map, this.sess);
    this.app.stage.addChild(this.renderer.root);
    this.minimap = new Minimap(this.sess.map, this.sess, this.renderer, $('#mmhost', this.root));
    this.renderer.onEvent = (e, vis) => this.onEvent(e, vis);
    this.input = new Input(this.app.canvas, {
      tap: (x, y, m) => this.onTap(x, y, m.shift),
      secondary: (x, y) => this.onSecondary(x, y),
      pan: (dx, dy) => this.renderer.panBy(dx, dy),
      zoom: (f, x, y) => this.renderer.zoomAt(f, x, y),
      boxMode: () => this.mode === 'box',
      box: (x0, y0, x1, y1) => this.boxSelect(x0, y0, x1, y1),
      boxPreview: (r) => {
        const b = $('#boxsel', this.root);
        if (!r) { b.style.display = 'none'; return; }
        Object.assign(b.style, { display: 'block', left: Math.min(r.x0, r.x1) + 'px', top: Math.min(r.y0, r.y1) + 'px', width: Math.abs(r.x1 - r.x0) + 'px', height: Math.abs(r.y1 - r.y0) + 'px' });
      },
    });
    this.bindUi();
    // start the camera on our headquarters
    this.renderer.zoom = innerWidth < 820 ? 0.8 : 1.1;
    this.renderer.centerOnTile(this.sess.map.w / 2, this.sess.map.h / 2);
    this.placeCamera();
    this.app.ticker.add((t) => this.frame(t.deltaMS / 1000));
    addEventListener('keydown', this.onKey);
    addEventListener('resize', this.onResize);
    audio.startMusic();
    this.refresh(true);
  }

  private onResize = () => { this.renderer?.applyCamera(); };
  private cameraPlaced = false;
  /** Start the camera at our headquarters (a little toward the city centre), once the state has arrived. */
  private placeCamera() {
    if (this.cameraPlaced) return;
    const v = this.sess.view();
    const hq = v.buildings.find((b) => b.hqOf === this.sess.fam) ?? v.buildings.find((b) => b.owner === this.sess.fam);
    if (!hq) return;
    this.cameraPlaced = true;
    const cx = this.sess.map.w / 2, cy = this.sess.map.h / 2;
    this.renderer.centerOnTile(hq.door.x + (cx - hq.door.x) * 0.25, hq.door.y + (cy - hq.door.y) * 0.25);
    const hero = v.units.find((u) => u.fam === this.sess.fam && u.hero);
    if (hero) this.sel.add(hero.id);
  }

  private frame(dt: number) {
    if (this.destroyed) return;
    this.sess.update(dt);
    if (!this.cameraPlaced) this.placeCamera();
    const v = this.sess.view();
    // drop stale selections
    for (const id of [...this.sel]) { const u = v.units.find((x) => x.id === id); if (!u || u.fam !== this.sess.fam || (u.loc !== 'street' && u.loc !== 'inside' && u.loc !== 'car')) this.sel.delete(id); }
    if (this.selVehicle >= 0 && !v.vehicles.some((x) => x.id === this.selVehicle && !x.dead)) this.selVehicle = -1;
    this.renderer.selected = this.sel;
    this.renderer.selectedVehicle = this.selVehicle;
    this.renderer.selectedBuilding = this.selBuilding;
    this.renderer.sync(dt);
    this.minimap.update(dt);
    const night = isNight(v.hour);
    if (night !== this.lastNight) { this.lastNight = night; audio.setNight(night); }
    this.uiT -= dt;
    if (this.uiT <= 0) { this.uiT = 0.2; this.refresh(false); }
    if (v.result && !this.ended) {
      this.ended = true;
      const won = v.result.winner === this.sess.fam;
      if (won) audio.fanfare(); else audio.death();
      setTimeout(() => this.opts.onEnd(won, v.result!.text), 900);
    }
  }

  // ---------- events → sound + notifications ----------
  private onEvent(e: GameEvent, visible: boolean) {
    const r = this.renderer;
    const distVol = (x: number, y: number) => {
      const p = r.tileToScreen(x, y);
      const cx = this.app.screen.width / 2, cy = this.app.screen.height / 2;
      const d = Math.hypot(p.x - cx, p.y - cy) / Math.max(400, this.app.screen.width);
      return Math.max(0, 1 - d) * (0.4 + r.zoom * 0.3);
    };
    if (e.k === 'shot' && visible) audio.shot(e.w, distVol(e.x, e.y) * (e.w === 'tommy' ? 0.6 : 1));
    else if (e.k === 'siren') audio.siren(distVol(e.x, e.y) * 0.8 + 0.1);
    else if (e.k === 'cash' && e.fam === this.sess.fam && e.amount >= 20) audio.cash();
    else if (e.k === 'fire') audio.fire();
    else if (e.k === 'death' && visible) audio.death();
    else if (e.k === 'toast' && e.fam === this.sess.fam && !this.toastsSeen.has(e.id)) {
      this.toastsSeen.add(e.id);
      this.toast(e.text, e.urgent, e.x !== undefined ? { x: e.x, y: e.y! } : undefined);
    }
  }
  toast(text: string, urgent = false, at?: { x: number; y: number }) {
    const box = $('#toasts', this.root);
    const t = el(`<div class="toast ${urgent ? 'urgent' : ''}">${at ? '<span class="jump">◎</span>' : ''}${esc(text)}</div>`);
    if (at) t.onclick = () => this.renderer.centerOnTile(at.x, at.y);
    else t.onclick = () => t.remove();
    box.prepend(t);
    while (box.children.length > 4) box.lastElementChild!.remove();
    if (urgent) audio.alert();
    setTimeout(() => { t.classList.add('fade'); setTimeout(() => t.remove(), 600); }, urgent ? 7000 : 4500);
  }
  private cmd(c: Command) {
    const err = this.sess.command(c);
    if (err) this.toast(err);
    else audio.click();
    this.refresh(true);
    return err;
  }

  // ---------- map input ----------
  private mine(u: Unit) { return u.fam === this.sess.fam; }
  private selectedUnits(): Unit[] {
    const v = this.sess.view();
    return [...this.sel].map((id) => v.units.find((u) => u.id === id)).filter((u): u is Unit => !!u);
  }
  private onTap(x: number, y: number, shift: boolean) {
    audio.unlock();
    const hit = this.renderer.pick(x, y);
    const v = this.sess.view();
    if (this.mode === 'kidnap') {
      if (hit.k === 'unit' && !this.mine(hit.u)) { this.cmd({ c: 'kidnap', units: [...this.sel], target: hit.u.id }); this.setMode('none'); }
      else this.toast('Tap a rival gangster to kidnap.');
      return;
    }
    if (this.mode === 'routeFrom' || this.mode === 'routeTo') {
      if (hit.k !== 'building') { this.toast('Tap a building.'); return; }
      if (this.mode === 'routeFrom') { this.routeFrom = hit.b.id; this.setMode('routeTo'); return; }
      this.cmd({ c: 'route', v: this.selVehicle, from: this.routeFrom, to: hit.b.id });
      this.setMode('none');
      return;
    }
    if (hit.k === 'unit') {
      const u = hit.u;
      if (this.mine(u)) {
        this.selVehicle = -1;
        this.selBuilding = -1;
        if (shift || this.multi) { if (this.sel.has(u.id)) this.sel.delete(u.id); else this.sel.add(u.id); }
        else if (this.sel.size === 1 && this.sel.has(u.id)) this.sel.clear();
        else { this.sel.clear(); this.sel.add(u.id); }
      } else if (this.sel.size) {
        this.cmd({ c: 'attack', units: [...this.sel], target: u.id });
        this.toast(u.cop ? 'Shooting at a cop? That will bring the whole precinct.' : `Go get ${u.name}!`);
      } else {
        const f = v.families[u.fam];
        this.toast(`${u.name} — ${u.cop ? 'Port Halloran Police' : f?.name ?? ''}${u.boss ? ` (${u.role})` : ''} · ${WEAPONS[u.weapon].name}`, false, { x: u.x, y: u.y });
      }
      this.refresh(true);
      return;
    }
    if (hit.k === 'vehicle') {
      const veh = hit.v;
      if (veh.fam === this.sess.fam) {
        const walkers = this.selectedUnits().filter((u) => u.loc !== 'car');
        if (walkers.length && this.selVehicle !== veh.id) { this.cmd({ c: 'board', units: walkers.map((u) => u.id), v: veh.id }); this.toast(`Getting in the ${veh.name}.`); }
        else { this.selVehicle = this.selVehicle === veh.id ? -1 : veh.id; this.sel.clear(); this.selBuilding = -1; }
      } else if (this.sel.size) {
        const occupant = veh.seats.map((id) => v.units.find((u) => u.id === id)).find(Boolean);
        if (occupant) this.cmd({ c: 'attack', units: [...this.sel], target: occupant.id });
      }
      this.refresh(true);
      return;
    }
    if (hit.k === 'building') {
      this.selBuilding = this.selBuilding === hit.b.id ? -1 : hit.b.id;
      this.refresh(true);
      return;
    }
    // ground
    this.selBuilding = -1;
    if (this.selVehicle >= 0) { this.cmd({ c: 'drive', v: this.selVehicle, x: hit.x, y: hit.y }); return; }
    if (this.sel.size) { this.cmd({ c: 'move', units: [...this.sel], x: hit.x, y: hit.y }); return; }
    this.refresh(true);
  }
  /** Right click / long press: do the obvious thing. */
  private onSecondary(x: number, y: number) {
    audio.unlock();
    const hit = this.renderer.pick(x, y);
    if (hit.k === 'building' && this.sel.size) {
      const b = hit.b;
      const act: Act = b.owner === this.sess.fam ? 'enter' : b.type === 'precinct' || b.type === 'cityhall' || b.type === 'courthouse' ? 'bribe' : !b.owner && isOpen(this.sess.view().hour) && BTYPES[b.type].business ? 'extort' : 'takeover';
      this.cmd({ c: 'act', units: [...this.sel], b: b.id, act });
      return;
    }
    if (hit.k === 'ground') {
      if (this.selVehicle >= 0) this.cmd({ c: 'drive', v: this.selVehicle, x: hit.x, y: hit.y });
      else if (this.sel.size) this.cmd({ c: 'move', units: [...this.sel], x: hit.x, y: hit.y });
      return;
    }
    this.onTap(x, y, false);
  }
  private boxSelect(x0: number, y0: number, x1: number, y1: number) {
    const v = this.sess.view();
    const [ax, bx] = [Math.min(x0, x1), Math.max(x0, x1)], [ay, by] = [Math.min(y0, y1), Math.max(y0, y1)];
    this.sel.clear();
    for (const u of v.units) {
      if (!this.mine(u) || u.loc !== 'street') continue;
      const p = this.renderer.tileToScreen(u.x, u.y);
      if (p.x >= ax && p.x <= bx && p.y - 20 >= ay - 20 && p.y - 20 <= by) this.sel.add(u.id);
    }
    this.selVehicle = -1;
    this.setMode('none');
    this.refresh(true);
  }
  private multi = false;
  private setMode(m: Mode) {
    this.mode = m;
    const hint = $('#modehint', this.root);
    const text = m === 'kidnap' ? 'Kidnap: tap the rival to grab. One of our cars must be close by.' : m === 'routeFrom' ? 'Supply route: tap where to LOAD (your distillery, or a smugglers\' pier at night).' : m === 'routeTo' ? 'Supply route: now tap the speakeasy to deliver to.' : m === 'box' ? 'Drag a box around the people you want.' : '';
    hint.innerHTML = text ? `${esc(text)} <button data-mode-cancel>Cancel</button>` : '';
    hint.style.display = text ? 'block' : 'none';
    $$('#maptools button', this.root).forEach((b) => b.classList.toggle('on', b.dataset.tool === 'box' && m === 'box'));
  }

  private onKey = (e: KeyboardEvent) => {
    if ((e.target as HTMLElement).tagName === 'INPUT') return;
    if (e.code === 'Space') { e.preventDefault(); this.sess.togglePause(); this.refresh(true); }
    else if (e.key === '1' || e.key === '2' || e.key === '3') this.sess.setSpeed(+e.key);
    else if (e.key === 'n' || e.key === 'N') this.sess.skip();
    else if (e.key === 'a' || e.key === 'A') this.selectAll();
    else if (e.key === 'h' || e.key === 'H') this.findHero();
    else if (e.key === 'Escape') { if (this.mode !== 'none') this.setMode('none'); else if (this.sel.size || this.selBuilding >= 0 || this.selVehicle >= 0) { this.sel.clear(); this.selBuilding = -1; this.selVehicle = -1; } else this.menu(); this.refresh(true); }
    const step = 60;
    if (e.key === 'ArrowLeft') this.renderer.panBy(step, 0);
    if (e.key === 'ArrowRight') this.renderer.panBy(-step, 0);
    if (e.key === 'ArrowUp') this.renderer.panBy(0, step);
    if (e.key === 'ArrowDown') this.renderer.panBy(0, -step);
    if (e.key === '+' || e.key === '=') this.renderer.zoomAt(1.15, this.app.screen.width / 2, this.app.screen.height / 2);
    if (e.key === '-') this.renderer.zoomAt(1 / 1.15, this.app.screen.width / 2, this.app.screen.height / 2);
  };
  private selectAll() {
    this.sel.clear();
    for (const u of this.sess.view().units) if (this.mine(u) && (u.loc === 'street' || u.loc === 'inside')) this.sel.add(u.id);
    this.selVehicle = -1;
    this.refresh(true);
  }
  private findHero() {
    const v = this.sess.view();
    const h = v.units.find((u) => this.mine(u) && u.hero);
    if (!h) return;
    const p = h.loc === 'car' ? v.vehicles.find((x) => x.id === h.car) ?? h : h.loc === 'inside' ? v.buildings[h.bld]?.door ?? h : h;
    this.renderer.centerOnTile(p.x, p.y);
  }

  // ---------- UI wiring ----------
  private bindUi() {
    const r = this.root;
    $('#speed', r).onclick = (e) => {
      audio.unlock();
      const b = (e.target as HTMLElement).closest('button');
      if (!b) return;
      const sp = b.dataset.sp!;
      if (sp === 'skip') this.sess.skip();
      else if (sp === '0') this.sess.togglePause();
      else this.sess.setSpeed(+sp);
      this.refresh(true);
    };
    $('#h-menu', r).onclick = () => this.menu();
    $('#maptools', r).onclick = (e) => {
      audio.unlock();
      const b = (e.target as HTMLElement).closest('button');
      if (!b) return;
      if (b.dataset.tool === 'all') this.selectAll();
      if (b.dataset.tool === 'box') this.setMode(this.mode === 'box' ? 'none' : 'box');
      if (b.dataset.tool === 'hero') this.findHero();
    };
    $('#modehint', r).onclick = (e) => { if ((e.target as HTMLElement).closest('[data-mode-cancel]')) this.setMode('none'); };
    $('#tabs', r).onclick = (e) => {
      const b = (e.target as HTMLElement).closest('button');
      if (!b) return;
      const same = this.tab === b.dataset.tab;
      this.tab = b.dataset.tab!;
      // on phones the panel is a bottom sheet: tapping the open tab again folds it
      this.sheetOpen = innerWidth <= 820 ? !(same && this.sheetOpen) : true;
      $$('#tabs button', r).forEach((x) => x.classList.toggle('on', x === b));
      $$('.pane', r).forEach((p) => p.classList.toggle('on', p.id === 'p-' + this.tab));
      $('#side', r).classList.toggle('open', this.sheetOpen);
      this.refresh(true);
    };
    const delegate = (e: Event) => this.onUiAction(e);
    $('#side', r).addEventListener('click', delegate);
    $('#selbar', r).addEventListener('click', delegate);
    $('#card', r).addEventListener('click', delegate);
    $('#overlay', r).addEventListener('click', delegate);
  }

  private onUiAction(e: Event) {
    audio.unlock();
    const t = (e.target as HTMLElement).closest<HTMLElement>('[data-a]');
    if (!t) return;
    e.stopPropagation();
    const a = t.dataset.a!;
    const id = Number(t.dataset.id ?? -1);
    const v = this.sess.view();
    const units = [...this.sel];
    switch (a) {
      case 'sel': {
        if (this.multi || (e as MouseEvent).shiftKey || (e as MouseEvent).ctrlKey || (e as MouseEvent).metaKey) { if (this.sel.has(id)) this.sel.delete(id); else this.sel.add(id); }
        else if (this.sel.size === 1 && this.sel.has(id)) { const u = v.units.find((x) => x.id === id); if (u) { const p = u.loc === 'inside' ? v.buildings[u.bld]?.door ?? u : u; this.renderer.centerOnTile(p.x, p.y); } }
        else { this.sel.clear(); this.sel.add(id); }
        this.selVehicle = -1;
        break;
      }
      case 'seladd': if (this.sel.has(id)) this.sel.delete(id); else this.sel.add(id); break;
      case 'multi': this.multi = !this.multi; break;
      case 'selcar': this.selVehicle = id; this.sel.clear(); { const c = v.vehicles.find((x) => x.id === id); if (c) this.renderer.centerOnTile(c.x, c.y); } break;
      case 'all': this.selectAll(); return;
      case 'none': this.sel.clear(); this.selVehicle = -1; break;
      case 'bail': this.cmd({ c: 'bail', unit: id }); return;
      case 'fire': if (confirm('Let this one go? They will leave the family for good.')) this.cmd({ c: 'fire', unit: id }); return;
      case 'skill': this.cmd({ c: 'skill', unit: id, stat: t.dataset.stat as StatKey }); return;
      case 'hire': this.cmd({ c: 'hire', ad: t.dataset.ad! }); return;
      case 'stance': this.cmd({ c: 'stance', units, stance: t.dataset.v as Stance }); return;
      case 'retreat': { const on = t.dataset.v === '1'; this.cmd({ c: 'retreat', units, on }); return; }
      case 'kidnap': this.setMode('kidnap'); return;
      case 'act': this.cmd({ c: 'act', units, b: this.selBuilding, act: t.dataset.v as Act, arg: t.dataset.arg }); return;
      case 'manager': this.cmd({ c: 'manager', b: this.selBuilding, idx: id }); return;
      case 'fireManager': this.cmd({ c: 'fireManager', b: this.selBuilding }); return;
      case 'guard': this.cmd({ c: 'hireGuard', b: this.selBuilding }); return;
      case 'racket': this.cmd({ c: 'racket', b: this.selBuilding, kind: t.dataset.v as Racket }); return;
      case 'closeRacket': this.cmd({ c: 'closeRacket', b: this.selBuilding }); return;
      case 'buyCar': this.cmd({ c: 'buyCar', b: this.selBuilding, model: t.dataset.v as Vehicle['model'] }); return;
      case 'cargo': this.cmd({ c: 'cargo', v: this.selVehicle, b: this.selBuilding, op: t.dataset.v as 'load' | 'unload' }); return;
      case 'exit': this.cmd({ c: 'exit', v: this.selVehicle }); return;
      case 'driveBy': this.cmd({ c: 'driveBy', v: this.selVehicle, on: t.dataset.v === '1' }); return;
      case 'route': this.setMode('routeFrom'); return;
      case 'stopRoute': this.cmd({ c: 'stopRoute', v: this.selVehicle }); return;
      case 'hostage': this.cmd({ c: 'hostage', unit: id, what: t.dataset.v as 'interrogate' }); return;
      case 'closeCard': this.selBuilding = -1; break;
      case 'walk': { const b = v.buildings[this.selBuilding]; if (b) this.cmd({ c: 'move', units, x: b.door.x, y: b.door.y }); return; }
      case 'goto': { const b = v.buildings[id]; if (b) { this.renderer.centerOnTile(b.door.x, b.door.y); this.selBuilding = id; } break; }
      case 'resume': $('#overlay', this.root).innerHTML = ''; if (this.sess.paused && !this.sess.isNet) this.sess.togglePause(); return;
      case 'quit': $('#overlay', this.root).innerHTML = ''; this.opts.onQuit(); return;
      case 'vol': return;
      case 'help': this.help(); return;
    }
    this.refresh(true);
  }

  menu() {
    if (!this.sess.isNet && !this.sess.paused) this.sess.togglePause();
    const o = $('#overlay', this.root);
    o.innerHTML = `<div class="modal"><h2>Paused</h2>
      <p class="mute">${esc(this.opts.title)} · ${esc(this.opts.subtitle)}</p>
      <label class="slider">Effects <input type="range" min="0" max="1" step="0.05" value="${audio.volume.sfx}" data-vol="sfx"></label>
      <label class="slider">Music <input type="range" min="0" max="1" step="0.05" value="${audio.volume.music}" data-vol="music"></label>
      <div class="row-btns"><button class="btn gold" data-a="resume">Resume</button><button class="btn" data-a="help">How to play</button><button class="btn red" data-a="quit">${esc(this.opts.quitLabel)}</button></div></div>`;
    $$<HTMLInputElement>('input[data-vol]', o).forEach((i) => { i.oninput = () => { audio.volume[i.dataset.vol as 'sfx' | 'music'] = +i.value; audio.applyVolume(); }; });
  }
  help() {
    const o = $('#overlay', this.root);
    o.innerHTML = `<div class="modal wide"><h2>How to play</h2>${HELP_HTML}<div class="row-btns"><button class="btn gold" data-a="resume">Back to the game</button></div></div>`;
  }

  // ---------- panels ----------
  private refresh(force: boolean) {
    void force;
    if (!this.renderer) return;
    const v = this.sess.view();
    const fam = v.families[this.sess.fam];
    if (!fam) return;
    this.hud(v);
    if (this.tab === 'crew') this.crewPane(v);
    else if (this.tab === 'paper') this.paperPane(v);
    else this.goalsPane(v);
    this.selBar(v);
    this.card(v);
    const affordable = v.ads.filter((a) => a.fee <= fam.money).length;
    const badge = $('#adBadge', this.root);
    badge.textContent = affordable ? String(affordable) : '';
    badge.style.display = affordable ? 'inline-block' : 'none';
  }

  private hud(v: ViewState) {
    const r = this.root;
    const fam = v.families[this.sess.fam];
    let inc = 0;
    for (const b of v.buildings) if (b.owner === fam.id && !b.burned) {
      inc += BTYPES[b.type].income * (b.size === 6 ? 1.6 : 1) * (b.manager ? 1 + b.manager.skill * 0.08 : 1);
      if (b.racket && b.shut <= 0 && b.manager) inc += RACKETS[b.racket].income;
    }
    let wages = 0;
    for (const u of v.units) if (u.fam === fam.id && (u.loc === 'street' || u.loc === 'inside' || u.loc === 'car')) wages += u.wage;
    for (const b of v.buildings) if (b.owner === fam.id && b.manager) wages += b.manager.wage;
    const net = inc - wages;
    $('#h-cash b', r).textContent = money(fam.money);
    const ib = $('#h-inc b', r);
    ib.textContent = (net >= 0 ? '+' : '') + money(net);
    ib.style.color = net >= 0 ? '#c9e8d6' : '#ff8a7a';
    const night = isNight(v.hour);
    $('#h-time small', r).textContent = `Day ${v.day}${v.timeLimitDay ? '/' + v.timeLimitDay : ''} ${night ? '☾' : '☀'}`;
    $('#h-time b', r).textContent = clock(v.hour);
    ($('#h-time i', r) as HTMLElement).style.width = (v.hour / 24) * 100 + '%';
    const mh = v.units.filter((u) => u.fam === fam.id && (u.loc === 'street' || u.loc === 'car')).reduce((a, u) => Math.max(a, u.heat), 0);
    $('#h-heat b', r).textContent = String(Math.round(mh));
    ($('#h-heat b', r) as HTMLElement).style.color = mh >= 50 ? '#ff7a6a' : '';
    ($('#h-heat i', r) as HTMLElement).style.width = mh + '%';
    const sp = this.sess.paused ? '0' : this.sess.skipping ? 'skip' : String(this.sess.speed);
    $$('#speed button', r).forEach((b) => b.classList.toggle('on', b.dataset.sp === sp));
    ($('#speed .skip', r) as HTMLElement).title = night ? 'Skip to dawn (N)' : 'Skip to dusk (N)';
    const head = v.news[0];
    if (head && head.text !== this.lastNews) {
      this.lastNews = head.text;
      const s = $('#ticker span', r);
      s.textContent = head.text;
      s.classList.remove('flash'); void s.offsetWidth; s.classList.add('flash');
    }
    r.classList.toggle('paused', this.sess.paused);
    r.classList.toggle('night', nightFactor(v.hour) > 0.5);
  }

  private status(u: Unit, v: ViewState): string {
    if (u.loc === 'jail') return 'In jail';
    if (u.loc === 'held') return 'Hostage';
    if (u.loc === 'car') { const c = v.vehicles.find((x) => x.id === u.car); return c && c.path.length ? 'Driving' : 'In car'; }
    if (u.task && u.task.k === 'cards') return 'At the tables';
    if (u.target >= 0 && v.time - u.lastShot < 2) return '<span class="hot">Fighting</span>';
    if (u.task) return ({ extort: 'Extorting', takeover: 'Muscling in', crack: 'Cracking safe', torch: 'Pouring kerosene', spring: 'Talking to the desk' } as Record<string, string>)[u.task.k] ?? 'Working';
    if (u.loc === 'inside') return 'Inside ' + esc(v.buildings[u.bld]?.name ?? '');
    const o = u.order;
    if (o.k === 'retreat') return 'Falling back';
    if (o.k === 'attack') return 'Hunting';
    if (o.k === 'kidnap') return 'Grabbing';
    if (o.k === 'goto' || o.k === 'move' || o.k === 'board') return 'On the move';
    return 'Idle';
  }

  private crewPane(v: ViewState) {
    const crew = v.units.filter((u) => u.fam === this.sess.fam && u.loc !== 'dead' && !u.cop && u.loc !== 'held');
    const fam = v.families[this.sess.fam];
    const rows = crew.map((u) => {
      const st = this.status(u, v);
      if (u.loc === 'jail') {
        const fixer = crew.some((x) => x.spec === 'fixer' && x.loc !== 'jail');
        const bail = Math.round(u.bail * (fixer ? 0.5 : 1));
        return `<div class="row jail"><div class="dot cop"></div><div class="info"><b>${esc(u.name)}</b><span class="role">${esc(u.role)}</span><div class="stats">Bail ${money(bail)}${fixer ? ' (fixer discount)' : ''}</div></div><button class="btn gold" data-a="bail" data-id="${u.id}" ${fam.money < bail ? 'disabled' : ''}>Bail</button></div>`;
      }
      const sel = this.sel.has(u.id);
      const spec = u.spec !== 'none' ? `<span class="spec">${SPEC_INFO[u.spec].name}</span>` : '';
      const skill = sel && u.sp > 0 ? `<div class="sp">Skill points: ${u.sp} ${(['muscle', 'aim', 'charm', 'stealth'] as StatKey[]).map((k) => `<button class="mini" data-a="skill" data-id="${u.id}" data-stat="${k}">+${statIcons[k]}</button>`).join('')}</div>` : '';
      return `<div class="row ${sel ? 'sel' : ''}" data-a="sel" data-id="${u.id}">
        <div class="dot" style="background:${fam.color}${u.hero ? ';box-shadow:0 0 0 2px #ffd36b' : ''}"></div>
        <div class="info"><b>${esc(u.name)}</b><span class="role">${esc(u.role)} · L${u.level}</span>${spec}
          <div class="stats">${statIcons.muscle}${u.stats.muscle} ${statIcons.aim}${u.stats.aim} ${statIcons.charm}${u.stats.charm} ${statIcons.stealth}${u.stats.stealth} · ${WEAPONS[u.weapon].name}${u.wage ? ` · ${money(u.wage)}/day` : ''}${u.sp && !sel ? ` · <span class="gold">+${u.sp} SP</span>` : ''}</div>
          <div class="bars"><i style="width:${(100 * u.hp) / u.maxHp}%"></i></div><div class="bars heat"><i style="width:${u.heat}%"></i></div>${skill}
        </div>
        <div class="st">${st}${u.stance !== 'defensive' ? `<br><small>${u.stance}</small>` : ''}</div>
        ${sel && this.sel.size === 1 && !u.hero && !u.guard ? `<button class="x mini" title="Fire" data-a="fire" data-id="${u.id}">✕</button>` : ''}
      </div>`;
    }).join('');
    const cars = v.vehicles.filter((c) => c.fam === this.sess.fam && !c.dead).map((c) => `<div class="row car ${this.selVehicle === c.id ? 'sel' : ''}" data-a="selcar" data-id="${c.id}"><div class="dot carico">🚗</div><div class="info"><b>${esc(c.name)}</b><div class="stats">${c.seats.length}/${VEHICLES[c.model].seats} aboard · cargo ${c.cargo}/${VEHICLES[c.model].cargo}${c.route ? ' · on supply route' : ''}</div><div class="bars"><i style="width:${(100 * c.hp) / c.maxHp}%"></i></div></div></div>`).join('');
    const hostages = v.units.filter((u) => u.loc === 'held' && u.heldBy === this.sess.fam).map((u) => `<div class="row"><div class="dot" style="background:${v.families[u.fam]?.color ?? '#888'}"></div><div class="info"><b>${esc(u.name)}</b><span class="role">Hostage</span><div class="acts"><button class="mini" data-a="hostage" data-v="interrogate" data-id="${u.id}">Interrogate</button><button class="mini" data-a="hostage" data-v="ransom" data-id="${u.id}">Ransom</button><button class="mini" data-a="hostage" data-v="release" data-id="${u.id}">Release</button></div></div></div>`).join('');
    setHtml($('#p-crew', this.root), `<div class="crewHead"><button class="btn" data-a="all">Select all</button><button class="btn ${this.multi ? 'gold' : ''}" data-a="multi" title="Tap several people to add them">Multi-select</button><button class="btn" data-a="none">Clear</button></div>
      ${rows}
      ${cars ? `<h4 class="sub">Cars</h4>${cars}` : ''}
      ${hostages ? `<h4 class="sub">In the cellar</h4>${hostages}` : ''}
      <p class="hint">Tap people to select them, then tap a building or a spot on the map. Tap a rival to attack. Right-click or long-press does the obvious thing. 💪 Muscle: health and muscling in · 🎯 Aim: hitting the target · 🗣 Charm: extortion and deals · 🥷 Stealth: less heat, harder to spot.</p>`);
  }

  private paperPane(v: ViewState) {
    const fam = v.families[this.sess.fam];
    setHtml($('#p-paper', this.root), `<div class="paper"><div class="mast"><h2>The Halloran Herald</h2><small>Port Halloran · Day ${v.day} · Two cents</small></div>
      ${v.news.slice(0, 14).map((n) => `<div class="news ${n.big ? 'big' : ''}"><em>Day ${n.day}, ${String(n.hour).padStart(2, '0')}:00</em>${esc(n.text)}</div>`).join('')}
      <div class="adsHead">Help Wanted · Situations</div>
      ${v.ads.length ? v.ads.map((a) => `<div class="ad"><b>${esc(a.name)}</b> — <i>${esc(a.role)}</i><div>${esc(a.blurb)}</div>
        <div class="s">${statIcons.muscle}${a.stats.muscle} ${statIcons.aim}${a.stats.aim} ${statIcons.charm}${a.stats.charm} ${statIcons.stealth}${a.stats.stealth} · ${WEAPONS[a.weapon].name} · Wage ${money(a.wage)}/day${a.spec !== 'none' ? `<br><i>${esc(SPEC_INFO[a.spec].ability)}</i>` : ''}</div>
        <button data-a="hire" data-ad="${a.id}" ${fam.money < a.fee ? 'disabled' : ''}>Hire for ${money(a.fee)}</button></div>`).join('') : '<p class="center"><i>No new notices today. Check tomorrow\'s edition.</i></p>'}
      <p class="small">Managers are hired straight from each building's menu. Guns are sold at the pawn shop.</p></div>`);
  }

  private goalsPane(v: ViewState) {
    let html = `<h3 class="ctitle">${esc(this.opts.title)}</h3><p class="mute">${esc(this.opts.subtitle)}</p>`;
    if (v.mode === 'turf') {
      const fams = v.order.map((id) => v.families[id]).filter(Boolean);
      html += fams.map((f) => {
        const n = v.buildings.filter((b) => b.owner === f.id).length;
        return `<div class="mis ${f.eliminated ? 'done' : ''} ${f.id === this.sess.fam ? 'cur' : ''}"><h4 style="color:${f.color}">${esc(f.name)}${f.human ? '' : ' (AI)'}</h4><p>${f.eliminated ? 'Finished.' : `${n} buildings · ~${money(f.money)}`}</p></div>`;
      }).join('');
      html += `<p class="hint">Take your rivals' headquarters or kill their Don to knock them out. ${v.timeLimitDay ? `When day ${v.timeLimitDay} ends, the richest family wins.` : ''} You only see what your people can see.</p>`;
    } else {
      html += v.objectives.map((o) => {
        const locked = o.after && !v.objectives.find((x) => x.id === o.after)?.done;
        return `<div class="mis ${o.done ? 'done' : ''} ${o.failed ? 'failed' : ''} ${!o.done && !locked ? 'cur' : ''}"><p class="goal">${o.done ? '✓' : o.failed ? '✕' : locked ? '…' : '▸'} ${esc(locked ? 'Not yet' : o.text)}${o.progress && !o.done && !locked ? ` <span class="prog">${esc(o.progress)}</span>` : ''}</p>${o.optional ? '<small>Optional</small>' : ''}</div>`;
      }).join('');
      if (this.opts.tip) html += `<p class="hint">💡 ${esc(this.opts.tip)}</p>`;
      html += `<p class="hint">Keep Nico alive and hold your headquarters. If either is lost, the chapter is lost.</p>`;
    }
    setHtml($('#p-goals', this.root), html);
  }

  private selBar(v: ViewState) {
    const bar = $('#selbar', this.root);
    if (this.selVehicle >= 0) {
      const c = v.vehicles.find((x) => x.id === this.selVehicle);
      if (!c) { setHtml(bar, ''); bar.classList.remove('show'); return; }
      const def = VEHICLES[c.model];
      const names = c.seats.map((id) => v.units.find((u) => u.id === id)).filter(Boolean).map((u) => esc(u!.name.split(' ')[0])).join(', ');
      setHtml(bar, `<div class="selhead"><b>🚗 ${esc(c.name)}</b> <span class="mute">${c.seats.length}/${def.seats} · cargo ${c.cargo}/${def.cargo} · HP ${Math.ceil(c.hp)}/${c.maxHp}</span><div class="mute small">${names || 'Empty: select crew and tap the car to get in.'}</div></div>
        <div class="acts">
          <button class="btn ${c.driveBy ? 'gold' : ''}" data-a="driveBy" data-v="${c.driveBy ? 0 : 1}" title="Passengers shoot from the windows">Drive-by ${c.driveBy ? 'ON' : 'OFF'}</button>
          <button class="btn" data-a="exit">Everyone out</button>
          ${c.route ? '<button class="btn" data-a="stopRoute">Stop route</button>' : '<button class="btn" data-a="route" title="Loop between a distillery or pier and a speakeasy">Supply route…</button>'}
          <button class="btn" data-a="none">✕</button>
        </div><div class="mute small">Tap the map to drive. Tap a building for load/unload.</div>`);
      bar.classList.add('show');
      return;
    }
    const us = this.selectedUnits();
    if (!us.length) { setHtml(bar, ''); bar.classList.remove('show'); return; }
    const stance = us.every((u) => u.stance === us[0].stance) ? us[0].stance : '';
    const retreat = us.every((u) => u.retreat);
    const specs = [...new Set(us.map((u) => u.spec).filter((s) => s !== 'none'))];
    const title = us.length === 1 ? `${esc(us[0].name)} <span class="mute">· ${esc(us[0].role)} · ${WEAPONS[us[0].weapon].name}</span>` : `${us.length} selected <span class="mute">· ${us.map((u) => esc(u.name.split(' ')[0])).join(', ')}</span>`;
    setHtml(bar, `<div class="selhead"><b>${title}</b>${specs.length ? `<div class="mute small">${specs.map((s) => esc(SPEC_INFO[s].ability)).join(' ')}</div>` : ''}</div>
      <div class="acts">
        <div class="seg" title="Aggression">${STANCES.map((s) => `<button class="${stance === s.k ? 'on' : ''}" data-a="stance" data-v="${s.k}" title="${esc(s.hint)}">${s.label}</button>`).join('')}</div>
        <button class="btn ${retreat ? 'gold' : ''}" data-a="retreat" data-v="${retreat ? 0 : 1}" title="Fall back to the nearest of our buildings below 30% health">Flee when hurt ${retreat ? 'ON' : 'OFF'}</button>
        <button class="btn red" data-a="kidnap" title="Grab a rival and drive him to our headquarters">Kidnap…</button>
        <button class="btn" data-a="none">✕</button>
      </div>`);
    bar.classList.add('show');
  }

  private card(v: ViewState) {
    const card = $('#card', this.root);
    const b = v.buildings[this.selBuilding];
    if (!b) { setHtml(card, ''); card.classList.remove('show'); return; }
    const fam = v.families[this.sess.fam];
    const def = BTYPES[b.type];
    const us = this.selectedUnits().filter((u) => u.loc !== 'jail');
    const own = b.owner === this.sess.fam;
    const owner = b.type === 'precinct' || b.type === 'cityhall' || b.type === 'courthouse' ? 'City of Port Halloran' : b.owner ? v.families[b.owner]?.name ?? 'Rivals' : b.burned ? 'Burned out' : def.business ? 'Independent — nobody\'s paying for protection' : '';
    const open = isOpen(v.hour), night = isNight(v.hour);
    const inside = v.units.filter((u) => u.loc === 'inside' && u.bld === b.id && u.fam === this.sess.fam);
    const meta: string[] = [esc(b.street), esc(owner)];
    if (def.income && !b.burned) meta.push(`${money(def.income * (b.size === 6 ? 1.6 : 1))}/day`);
    if (own && inside.length) meta.push(`${inside.length} inside`);
    let prog = '';
    const entries = Object.entries(b.prog).sort((a, c) => c[1] - a[1]);
    if (entries.length) prog = `<div class="prog"><i style="width:${Math.min(100, entries[0][1])}%;background:${v.families[entries[0][0]]?.color ?? '#fff'}"></i></div>`;
    const acts: string[] = [];
    const n = us.length > 1 ? ` (${us.length})` : '';
    const has = (s: string) => us.some((u) => u.spec === s);
    const disabled = (cond: boolean) => (cond ? '' : 'disabled');
    if (us.length) {
      if (own) acts.push(`<button class="btn" data-a="act" data-v="enter">Go inside / guard${n}</button>`);
      else acts.push(`<button class="btn" data-a="walk">Go here${n}</button>`);
      if (def.business && !own && !b.burned && b.type !== 'hq' && !b.owner) acts.push(`<button class="btn gold" data-a="act" data-v="extort" ${disabled(open)} title="Quiet. Faster with Charm. Shops are open 8:00–20:00.">Extort${n}${open ? '' : ' (closed)'}</button>`);
      if (def.business && !own && !b.burned) acts.push(`<button class="btn red" data-a="act" data-v="takeover" title="Loud. Faster with Muscle. Clear out any defenders first.">Muscle in${n}</button>`);
      if (!b.owner && def.price) acts.push(`<button class="btn" data-a="act" data-v="buy" ${disabled(open && fam.money >= b.price)}>${b.burned ? 'Rebuild' : 'Buy'} ~${money(b.price * (b.burned ? 1.2 : 1) * (fam.payroll.hall > 0 ? 0.7 : 1))}</button>`);
      if (b.type === 'precinct' || b.type === 'cityhall' || b.type === 'courthouse') {
        const o = OFFICIALS[b.type];
        acts.push(`<button class="btn gold" data-a="act" data-v="bribe" title="${esc(o.effect)}">Bribe the ${o.who} ~${money(o.cost)}</button>`);
        if (b.type === 'precinct' && has('fixer')) acts.push(`<button class="btn" data-a="act" data-v="spring">Spring someone (fixer)</button>`);
      }
      if (has('safecracker') && ((b.type === 'bank') || (own && b.safe > 0 && !b.cracked))) acts.push(`<button class="btn gold" data-a="act" data-v="crack" ${disabled(b.type !== 'bank' || night)}>Crack the safe${b.type === 'bank' && !night ? ' (night only)' : ''}</button>`);
      if (has('arsonist') && !own && def.business && b.type !== 'hq' && !b.burned) acts.push(`<button class="btn red" data-a="act" data-v="torch">Torch it 🔥</button>`);
      if (has('cardsharp') && (b.type === 'casino' || b.type === 'club' || b.racket === 'gambling')) acts.push(`<button class="btn gold" data-a="act" data-v="cards">Play cards 🃏</button>`);
      if (b.type === 'pawn' && (!b.owner || own)) acts.push(`<div class="guns">${WEAPON_LIST.map((w: WeaponId) => { const p = Math.round(WEAPONS[w].price * (own ? 0.5 : 1)); return `<button class="mini" data-a="act" data-v="arm" data-arg="${w}" ${fam.money < p ? 'disabled' : ''} title="${esc(WEAPONS[w].desc)}">${WEAPONS[w].name} ${money(p)}</button>`; }).join('')}</div>`);
    }
    if (this.selVehicle >= 0) {
      if ((own && b.racket === 'still') || (b.type === 'pier' && (!b.owner || own))) acts.push(`<button class="btn" data-a="cargo" data-v="load">Load crates here</button>`);
      if (own && b.racket === 'speakeasy') acts.push(`<button class="btn" data-a="cargo" data-v="unload">Unload crates here</button>`);
    }
    let extra = '';
    if (own && def.business && b.type !== 'hq') {
      if (b.manager) extra += `<div class="sub">Manager: <b>${esc(b.manager.name)}</b> (skill ${b.manager.skill}, ${money(b.manager.wage)}/day, +${b.manager.skill * 8}% income) <button class="mini" data-a="fireManager">Let go</button></div>`;
      else extra += `<div class="sub">Hire a manager (more income, needed for a racket):<div class="cands">${b.candidates.map((c, i) => `<button class="mini" data-a="manager" data-id="${i}" ${fam.money < c.fee ? 'disabled' : ''}>${esc(c.name)} · skill ${c.skill} · ${money(c.fee)} + ${money(c.wage)}/day</button>`).join('') || '<i>No one available today.</i>'}</div></div>`;
      if (def.front) {
        if (b.racket) extra += `<div class="sub">Behind the front: <b>${RACKETS[b.racket].name}</b>${b.racket !== 'gambling' ? ` · ${b.stock} crates` : ''}${b.shut > 0 ? ' · <span class="hot">closed by police</span>' : ''} <button class="mini" data-a="closeRacket">Close</button></div>`;
        else extra += `<div class="sub">Open a racket (pays at night):<div class="cands">${(Object.keys(RACKETS) as Racket[]).map((k) => `<button class="mini" data-a="racket" data-v="${k}" title="${esc(RACKETS[k].desc)}" ${fam.money < RACKETS[k].setup ? 'disabled' : ''}>${RACKETS[k].name} ${money(RACKETS[k].setup)}</button>`).join('')}</div></div>`;
      }
    }
    if (own) {
      const guards = v.units.filter((u) => u.guard && u.bld === b.id && u.loc === 'inside').length;
      extra += `<div class="sub">Hired guards: ${guards}/3 <button class="mini" data-a="guard" ${fam.money < 90 || guards >= 3 ? 'disabled' : ''}>Hire a guard $90 + $12/day</button></div>`;
    }
    if (b.type === 'garage' && (!b.owner || own)) {
      extra += `<div class="sub">For sale:<div class="cands">${VEHICLE_LIST.map((m) => { const p = Math.round(VEHICLES[m].price * (own ? 0.75 : 1)); return `<button class="mini" data-a="buyCar" data-v="${m}" ${fam.money < p ? 'disabled' : ''} title="${esc(VEHICLES[m].desc)}">${VEHICLES[m].name} ${money(p)}</button>`; }).join('')}</div></div>`;
    }
    if (b.hqOf === this.sess.fam) {
      const held = v.units.filter((u) => u.loc === 'held' && u.heldBy === this.sess.fam);
      if (held.length) extra += `<div class="sub">In the cellar: ${held.map((u) => `<b>${esc(u.name)}</b> <button class="mini" data-a="hostage" data-v="interrogate" data-id="${u.id}">Interrogate</button><button class="mini" data-a="hostage" data-v="ransom" data-id="${u.id}">Ransom</button>`).join(' ')}</div>`;
    }
    if (b.type === 'bank') extra += `<div class="sub mute">Vault: about ${money(b.safe)}. ${night ? 'Closed for the night.' : 'Open for business — too many witnesses.'}</div>`;
    if (!us.length && !own && !extra) acts.push('<div class="hint">Select crew first, then choose what to do here.</div>');
    const title = b.type === 'hq' ? `★ ${esc(b.name)}` : `${def.icon} ${esc(b.name)}`;
    setHtml(card, `<button class="x" data-a="closeCard">×</button><h3>${title}</h3><div class="meta">${meta.join(' · ')}</div>${prog}<div class="acts">${acts.join('')}</div>${extra}`);
    card.classList.add('show');
  }

  destroy() {
    this.destroyed = true;
    removeEventListener('keydown', this.onKey);
    removeEventListener('resize', this.onResize);
    audio.stopMusic();
    try { this.input?.destroy(); this.minimap?.destroy(); this.renderer?.destroy(); this.app.destroy(true, { children: true }); } catch { /* ignore */ }
    this.sess.destroy();
    this.root.remove();
    void this.host;
  }
}

export const HELP_HTML = `
<ul class="help">
<li><b>Select</b>: tap one of your gangsters (or a row in the Crew tab). <b>Multi-select</b>, <b>👥 All</b> or <b>⬚ Box</b> select several at once.</li>
<li><b>Move</b>: tap the street. <b>Attack</b>: tap a rival. <b>Buildings</b>: tap one to open its menu: extort, muscle in, buy, bribe, hire a manager, open a racket, buy cars or guns.</li>
<li><b>Right-click</b> (PC) or <b>long-press</b> (mobile) does the obvious thing: walk there, go inside, muscle in.</li>
<li><b>Aggression</b>: <i>Passive</i> holds fire and stays unnoticed, <i>Defend</i> shoots back, <i>Attack</i> opens fire on any rival and chases them. <i>Flee when hurt</i> sends them back to safety at low health. Weapon range and Aim decide who wins a shootout; standing next to a wall gives cover.</li>
<li><b>Cars</b>: select crew and tap your car to get in, then select the car and tap the map to drive. Passengers shoot from the windows (drive-by). Trucks carry liquor crates, and a <i>supply route</i> keeps them moving on their own.</li>
<li><b>Money</b>: legal shops pay by day (8:00–20:00). Rackets behind a front pay at night, and every racket needs a manager. Speakeasies need crates from a distillery or the smugglers' pier.</li>
<li><b>Heat</b>: gunfire and crime build heat. From 50 the police hunt that person. Bribe officials, lay low inside a building, or pay bail when someone is arrested.</li>
<li><b>Specialists</b>: the safecracker robs banks and safes, the arsonist burns buildings, the hitman kills unseen, the card sharp wins money and rumours, the fixer gets people out of jail and gets better prices.</li>
<li><b>Time</b>: pause (Space), 1×/2×/3× (keys 1–3) and ⏭ to skip to dusk or dawn. The skip stops by itself if trouble starts.</li>
<li><b>Map</b>: drag to pan, pinch or scroll to zoom, and tap the minimap to jump.</li>
</ul>`;

export type { Hit };
