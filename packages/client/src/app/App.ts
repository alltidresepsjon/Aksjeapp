// Screen flow: title → campaign (briefing → chapter → report → safehouse) or Turf War lobby → match.

import { store } from '../ui/storage';
import { ask, notice } from '../ui/dialog';
import {
  CHAPTERS, SPEC_INFO, TURF_FAMILIES, VEHICLES, VEHICLE_LIST, WEAPONS, WEAPON_LIST, buildChapterWorld, finishChapter, hireFromAd,
  newCampaign, refreshSafehouseAds, spendSkillPoint, DIFFICULTY, type CampaignSave, type ChapterDef, type Difficulty, type LobbyPlayer, type ServerMsg, type StatKey, type WorldSave,
  type VModel, type WeaponId, type Layout, XP_PER_LEVEL,
} from '@bg/shared';
import { Game, HELP_HTML } from './Game';
import { LocalSession } from '../session/LocalSession';
import { Net, NetSession } from '../session/NetSession';
import { audio } from '../audio/Audio';
import { loadArtPack } from '../render/artPack';
import { $, $$, el, esc, money, statIcons } from '../ui/dom';

const SAVE_KEY = 'bg-campaign-v1';
const CHAPTER_KEY = 'bg-chapter-v1';

interface ChapterSave { chapter: string; crew: string[]; when: string; world: WorldSave }
function readChapterSave(): ChapterSave | null {
  try { return JSON.parse(store.getItem(CHAPTER_KEY) ?? 'null'); } catch { return null; }
}

export class App {
  save: CampaignSave | null = null;
  game: Game | null = null;
  screen: HTMLElement;
  net: Net | null = null;

  /** Background picture for a screen, if one was imported. */
  private backdrop(name: string, dark = 0.8) {
    void loadArtPack().then((p) => {
      const url = p.ui(name);
      if (url) this.screen.style.backgroundImage = `linear-gradient(rgba(5,6,8,${dark - 0.25}), rgba(5,6,8,${dark})), url(${url})`;
    });
  }

  constructor(private root: HTMLElement) {
    // imported textures for panels, paper and buttons become CSS variables
    void loadArtPack().then((p) => {
      const st = document.documentElement.style;
      for (const n of ['panel', 'paper', 'button']) { const u = p.ui(n); if (u) st.setProperty(`--ui-${n}`, `url(${u})`); }
    });
    this.screen = el('<div class="screen"></div>');
    root.appendChild(this.screen);
    try { const raw = store.getItem(SAVE_KEY); if (raw) this.save = JSON.parse(raw); } catch { this.save = null; }
    this.screen.addEventListener('click', () => audio.unlock(), { capture: true });
    this.title();
  }

  private persist() { if (this.save) store.setItem(SAVE_KEY, JSON.stringify(this.save)); }
  private show(html: string, cls = '') {
    this.screen.className = 'screen ' + cls;
    this.screen.style.backgroundImage = '';
    this.screen.innerHTML = html;
    this.screen.style.display = 'flex';
    this.screen.scrollTop = 0;
    const art = this.screen.querySelector<HTMLElement>('[data-art]');
    if (art) void loadArtPack().then((pk) => { const u = pk.ui(art.dataset.art!); if (u) art.innerHTML = `<img src="${u}" alt="">`; else art.remove(); });
  }
  private hide() { this.screen.style.display = 'none'; this.screen.innerHTML = ''; }

  // ---------- title ----------
  title() {
    this.game?.destroy();
    this.game = null;
    const cont = this.save && this.save.chapter < CHAPTERS.length;
    this.show(`<div class="box title">
      <h1>Bathtub Gin</h1><div class="sub">Blood Debt · Port Halloran, 1928</div>
      <div class="menu">
        ${cont ? (() => { const cs = readChapterSave(); const c = CHAPTERS[this.save!.chapter]; return cs && cs.chapter === c.id
          ? `<button class="go" data-go="resume">Continue — Chapter ${c.num}: ${esc(c.title)} <small>(saved ${esc(cs.when)})</small></button>`
          : `<button class="go" data-go="continue">Continue — Chapter ${c.num}: ${esc(c.title)}</button>`; })() : ''}
        <button class="${cont ? 'btn big' : 'go'}" data-go="new">New campaign</button>
        <button class="btn big" data-go="turf">Turf War · online, 2–4 players</button>
        <button class="btn big" data-go="help">How to play</button>
      </div>
      <p class="credits">An original game about Prohibition, family and revenge. Works on PC and mobile.</p>
    </div>`, 'title-screen');
    void loadArtPack().then((p) => {
      const bg = p.ui('title');
      if (bg) this.screen.style.backgroundImage = `linear-gradient(rgba(5,6,8,.35), rgba(5,6,8,.88)), url(${bg})`;
      const logo = p.ui('logo');
      const h1 = this.screen.querySelector('.title h1');
      if (logo && h1) h1.outerHTML = `<img class="logo" src="${logo}" alt="Bathtub Gin">`;
    });
    this.screen.onclick = (e) => {
      const g = (e.target as HTMLElement).closest<HTMLElement>('[data-go]')?.dataset.go;
      if (g === 'continue') this.safehouseOrBriefing();
      if (g === 'resume') { const cs = readChapterSave(); const c = CHAPTERS[this.save!.chapter]; if (cs && c) this.play(c, cs.crew, cs.world); }
      if (g === 'new') { if (!this.save) this.pickDifficulty(); else void ask('Start a new campaign? Your current progress will be replaced.', 'Start over').then((ok) => { if (ok) this.pickDifficulty(); }); }
      if (g === 'turf') { if (import.meta.env.VITE_STATIC) void notice('Turf War is played online against friends and needs the game server. In this test version you can play the whole campaign. To play Turf War, run the game with "npm run dev" (see the README).'); else this.turfMenu(); }
      if (g === 'help') this.helpScreen();
    };
  }
  helpScreen() {
    this.show(`<div class="box"><h2>How to play</h2>${HELP_HTML}<button class="go" data-go="back">Back</button></div>`);
    this.screen.onclick = (e) => { if ((e.target as HTMLElement).closest('[data-go="back"]')) this.title(); };
  }
  pickDifficulty() {
    const card = (d: Difficulty) => `<button class="pick diff ${d === 'normal' ? 'on' : ''}" data-diff="${d}"><b>${DIFFICULTY[d].name}</b><small>${esc(DIFFICULTY[d].desc)}</small></button>`;
    this.show(`<div class="box"><h2>How hard is the city?</h2><div class="sub">You can change this later in the safehouse</div>
      <div class="picks">${card('easy')}${card('normal')}${card('hard')}</div>
      <div class="row-btns"><button class="btn" data-go="back">Back</button></div></div>`);
    this.screen.onclick = (e) => {
      const t = e.target as HTMLElement;
      const d = t.closest<HTMLElement>('[data-diff]')?.dataset.diff as Difficulty | undefined;
      if (d) { store.removeItem(CHAPTER_KEY); this.save = newCampaign(Date.now(), d); this.persist(); this.intro(); }
      if (t.closest('[data-go="back"]')) this.title();
    };
  }

  intro() {
    this.show(`<div class="box">
      <h1>Bathtub Gin</h1><div class="sub">Blood Debt · Port Halloran, 1928</div>
      <div class="story">Prohibition has turned the city into a gold rush for anyone willing to bleed for it. Three nights ago your father, Sal Corrado, was gunned down outside his bakery on Foundry Street. The police called it a robbery. You know better.<br><br>You are <b>Nico Corrado</b>. You have two loyal friends, a borrowed pistol and $600. Take back the neighbourhood, find the men who did this, and settle the debt.</div>
      <button class="go" data-go="next">Read the briefing</button></div>`);
    this.screen.onclick = (e) => { if ((e.target as HTMLElement).closest('[data-go="next"]')) this.briefing(); };
  }
  safehouseOrBriefing() {
    if (!this.save) return this.title();
    if (this.save.chapter >= CHAPTERS.length) return this.ending();
    if (this.save.chapter === 0 && !this.save.completed.length) return this.briefing();
    this.safehouse();
  }

  // ---------- safehouse ----------
  safehouse(tab = 'crew') {
    const s = this.save!;
    const next = CHAPTERS[s.chapter];
    const roster = s.roster.map((r) => {
      const stats = (['muscle', 'aim', 'charm', 'stealth'] as StatKey[]).map((k) => `<span class="st">${statIcons[k]} ${r.stats[k]}${r.sp > 0 && r.stats[k] < 10 ? ` <button class="mini" data-sp="${r.id}" data-stat="${k}">+</button>` : ''}</span>`).join('');
      const guns = WEAPON_LIST.map((w) => `<option value="${w}" ${r.weapon === w ? 'selected' : ''}>${WEAPONS[w].name}${r.weapon === w ? '' : ` (${money(WEAPONS[w].price)})`}</option>`).join('');
      return `<div class="rcard ${r.hero ? 'hero' : ''}"><div class="rtop"><b>${esc(r.name)}</b><span class="role">${esc(r.role)}${r.spec !== 'none' ? ' · ' + SPEC_INFO[r.spec].name : ''}</span></div>
        <div class="lvl">Level ${r.level} <div class="bars xp"><i style="width:${(100 * r.xp) / (r.level * XP_PER_LEVEL)}%"></i></div>${r.sp ? `<span class="gold">${r.sp} skill point${r.sp > 1 ? 's' : ''}</span>` : ''}</div>
        <div class="rstats">${stats}</div>
        <div class="rfoot"><select data-gun="${r.id}">${guns}</select><span class="mute">${r.wage ? money(r.wage) + '/day' : 'family'} · ${r.kills} kills</span>${r.hero ? '' : `<button class="mini red" data-fire="${r.id}">Fire</button>`}</div></div>`;
    }).join('');
    const ads = s.ads.map((a) => `<div class="ad"><b>${esc(a.name)}</b> — <i>${esc(a.role)}</i><div>${esc(a.blurb)}</div><div class="s">${statIcons.muscle}${a.stats.muscle} ${statIcons.aim}${a.stats.aim} ${statIcons.charm}${a.stats.charm} ${statIcons.stealth}${a.stats.stealth} · ${WEAPONS[a.weapon].name} · ${money(a.wage)}/day${a.spec !== 'none' ? `<br><i>${esc(SPEC_INFO[a.spec].ability)}</i>` : ''}</div><button data-hire="${a.id}" ${s.cash < a.fee ? 'disabled' : ''}>Hire for ${money(a.fee)}</button></div>`).join('');
    const cars = s.cars.map((c, i) => `<div class="row"><div class="info"><b>${VEHICLES[c].name}</b><div class="stats">${VEHICLES[c].seats} seats · cargo ${VEHICLES[c].cargo}</div></div><button class="mini" data-sell="${i}">Sell ${money(VEHICLES[c].price * 0.5)}</button></div>`).join('') || '<p class="mute">No cars yet.</p>';
    const shop = VEHICLE_LIST.map((m: VModel) => `<div class="row"><div class="info"><b>${VEHICLES[m].name}</b><div class="stats">${esc(VEHICLES[m].desc)}</div></div><button class="btn" data-buy="${m}" ${s.cash < VEHICLES[m].price || s.cars.length >= 3 ? 'disabled' : ''}>${money(VEHICLES[m].price)}</button></div>`).join('');
    const rep = s.lastReport && s.lastReport.won ? `<div class="report"><b>Last job:</b> ${s.lastReport.earned >= 0 ? '+' : ''}${money(s.lastReport.earned)} · ${s.lastReport.levelUps.map((l) => `${esc(l.name)} reached level ${l.level}`).join(', ') || 'no level-ups'}${s.lastReport.dead.length ? ` · Lost: ${s.lastReport.dead.map(esc).join(', ')}` : ''}</div>` : '';
    this.show(`<div class="box wide safehouse">
      <h2>The Safehouse</h2><div class="sub">Back room of the Corrado bakery · Cash ${money(s.cash)}</div>${rep}
      <div class="diffrow">Difficulty: ${(['easy', 'normal', 'hard'] as Difficulty[]).map((d) => `<button class="mini ${(s.difficulty ?? 'normal') === d ? 'gold-btn' : ''}" data-setdiff="${d}">${DIFFICULTY[d].name}</button>`).join('')}</div>
      <nav class="tabs2">${['crew', 'herald', 'garage'].map((t) => `<button data-tab="${t}" class="${t === tab ? 'on' : ''}">${t === 'crew' ? 'Crew' : t === 'herald' ? 'The Herald' : 'Garage'}</button>`).join('')}</nav>
      <div class="tabbody">${tab === 'crew' ? `<div class="rgrid">${roster}</div><p class="hint">Spend skill points, change weapons (paid at the pawn shop) and let people go. Survivors earn experience in every chapter.</p>` : tab === 'herald' ? `<div class="paper"><div class="mast"><h2>Help Wanted</h2><small>The Halloran Herald · classifieds</small></div>${ads || '<p>No ads today.</p>'}</div>` : `<h4>Your cars (max 3 per chapter)</h4>${cars}<h4>Dealer</h4>${shop}`}</div>
      <div class="row-btns"><button class="btn" data-go="title">Title screen</button><button class="go" data-go="brief">Next: Chapter ${next.num} — ${esc(next.title)}</button></div></div>`, 'scroll');
    this.backdrop('safehouse');
    this.screen.onclick = (e) => {
      const t = e.target as HTMLElement;
      const d = (k: string) => t.closest<HTMLElement>(`[data-${k}]`)?.dataset[k];
      if (d('tab')) return this.safehouse(d('tab'));
      if (d('setdiff')) { s.difficulty = d('setdiff') as Difficulty; this.persist(); return this.safehouse(tab); }
      if (d('go') === 'title') return this.title();
      if (d('go') === 'brief') return this.briefing();
      const sp = d('sp');
      if (sp) { const r = s.roster.find((x) => x.id === sp)!; spendSkillPoint(r, t.closest<HTMLElement>('[data-stat]')!.dataset.stat as StatKey); this.persist(); return this.safehouse(tab); }
      const fire = d('fire');
      if (fire) { void ask('Let them go for good?', 'Fire').then((ok) => { if (ok) { s.roster = s.roster.filter((r) => r.id !== fire); this.persist(); this.safehouse(tab); } }); return; }
      const hire = d('hire');
      if (hire) { const err = hireFromAd(s, hire); if (err) void notice(err); this.persist(); return this.safehouse(tab); }
      const buy = d('buy') as VModel | undefined;
      if (buy && s.cash >= VEHICLES[buy].price) { s.cash -= VEHICLES[buy].price; s.cars.push(buy); this.persist(); return this.safehouse(tab); }
      const sell = d('sell');
      if (sell !== undefined) { const m = s.cars[+sell]; s.cars.splice(+sell, 1); s.cash += Math.round(VEHICLES[m].price * 0.5); this.persist(); return this.safehouse(tab); }
    };
    $$<HTMLSelectElement>('select[data-gun]', this.screen).forEach((sel) => sel.onchange = () => {
      const r = s.roster.find((x) => x.id === sel.dataset.gun)!;
      const w = sel.value as WeaponId;
      if (s.cash < WEAPONS[w].price) { void notice('Not enough cash.'); sel.value = r.weapon; return; }
      s.cash -= WEAPONS[w].price; r.weapon = w; this.persist(); this.safehouse(tab);
    });
  }

  // ---------- briefing & crew selection ----------
  briefing() {
    const s = this.save!;
    const c = CHAPTERS[s.chapter];
    const picked = new Set<string>(s.roster.filter((r) => !r.hero).slice(0, c.slots - 1).map((r) => r.id));
    const render = () => {
      const crew = s.roster.map((r) => {
        const on = r.hero || picked.has(r.id);
        return `<button class="pick ${on ? 'on' : ''} ${r.hero ? 'locked' : ''}" data-pick="${r.id}"><b>${esc(r.name)}</b><small>${esc(r.role)}${r.spec !== 'none' ? ' · ' + SPEC_INFO[r.spec].name : ''} · L${r.level}</small><small>${statIcons.muscle}${r.stats.muscle} ${statIcons.aim}${r.stats.aim} ${statIcons.charm}${r.stats.charm} ${statIcons.stealth}${r.stats.stealth} · ${WEAPONS[r.weapon].name}</small></button>`;
      }).join('');
      const count = 1 + picked.size;
      const cars = [...s.cars.slice(0, 3), ...c.gift];
      this.show(`<div class="box wide briefing">
        <div class="paper brief"><div class="mast"><small>Chapter ${c.num} of ${CHAPTERS.length} · ${esc(c.district)}</small><h2>${esc(c.title)}</h2></div>
        <div class="brief-art" data-art="briefing-${c.id}"></div>
        ${c.briefing.map((p) => `<p>${esc(p)}</p>`).join('')}
        <div class="adsHead">Objectives</div><ul>${c.objectives.map((o) => `<li>${esc(o.text)}</li>`).join('')}</ul>
        <p class="small">💡 ${esc(c.tip)}</p></div>
        <h3>Choose your crew <span class="mute">${count}/${c.slots}</span></h3>
        <div class="picks">${crew}</div>
        <p class="mute">Cash: ${money(Math.max(s.cash, c.minCash))}${c.minCash > s.cash ? ' (Uncle Tommaso chipped in)' : ''} · Cars: ${cars.length ? cars.map((m) => VEHICLES[m].name).join(', ') : 'none'}${c.gift.length ? ' (includes a gift)' : ''}. You can also hire people during the chapter.</p>
        <div class="row-btns">${s.completed.length ? '<button class="btn" data-go="safe">Back to the safehouse</button>' : '<button class="btn" data-go="title">Title screen</button>'}<button class="go" data-go="start">Start chapter</button></div></div>`, 'scroll');
    };
    render();
    this.screen.onclick = (e) => {
      const t = e.target as HTMLElement;
      const p = t.closest<HTMLElement>('[data-pick]')?.dataset.pick;
      if (p) {
        const r = s.roster.find((x) => x.id === p)!;
        if (r.hero) return;
        if (picked.has(p)) picked.delete(p);
        else if (1 + picked.size < c.slots) picked.add(p);
        render();
        return;
      }
      const g = t.closest<HTMLElement>('[data-go]')?.dataset.go;
      if (g === 'safe') this.safehouse();
      if (g === 'title') this.title();
      if (g === 'start') this.play(c, [...picked]);
    };
  }

  play(c: ChapterDef, crew: string[], resume?: WorldSave) {
    const s = this.save!;
    this.hide();
    const world = buildChapterWorld(c, s, crew);
    if (resume) { try { world.restore(resume); } catch { store.removeItem(CHAPTER_KEY); } }
    else store.removeItem(CHAPTER_KEY);
    const saveNow = () => {
      if (world.s.result) return '';
      const hh = Math.floor(world.s.hour), mm = Math.floor((world.s.hour - hh) * 4) * 15;
      const when = `day ${world.s.day}, ${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
      try {
        store.setItem(CHAPTER_KEY, JSON.stringify({ chapter: c.id, crew, when, world: world.save() } satisfies ChapterSave));
        return `Saved (${when}).`;
      } catch { return 'Could not save: the browser storage is full.'; }
    };
    const sess = new LocalSession(world);
    this.game = new Game(this.root, sess, {
      title: `Chapter ${c.num}: ${c.title}`, subtitle: c.district, tip: c.tip, quitLabel: 'Save & quit',
      onSave: saveNow,
      onQuit: () => { saveNow(); this.game?.destroy(); this.game = null; this.title(); },
      onEnd: (won, text) => {
        store.removeItem(CHAPTER_KEY);
        const rep = finishChapter(s, world, c);
        this.persist();
        this.game?.destroy();
        this.game = null;
        this.report(c, won, text, rep);
      },
    });
    void this.game.start();
  }

  report(c: ChapterDef, won: boolean, text: string, rep: ReturnType<typeof finishChapter>) {
    const s = this.save!;
    const last = won && s.chapter >= CHAPTERS.length;
    this.show(`<div class="box">
      <h1>${won ? (last ? 'Debt Paid' : 'Chapter Complete') : 'The End'}</h1>
      <div class="sub">Chapter ${c.num}: ${esc(c.title)}</div>
      <div class="story">${won ? esc(OUTRO[c.id] ?? text) : esc(text)}</div>
      ${won ? `<ul><li>Cash carried forward: ${money(s.cash)} (${rep.earned >= 0 ? '+' : ''}${money(rep.earned)}, incl. ${money(c.reward)} from friends of the family)</li>
        ${rep.xp.map((x) => `<li>${esc(x.name)}: +${x.xp} XP${rep.levelUps.find((l) => l.name === x.name) ? ` — <b class="gold">level ${rep.levelUps.find((l) => l.name === x.name)!.level}!</b>` : ''}</li>`).join('')}
        ${rep.dead.length ? `<li class="hot">Buried: ${rep.dead.map(esc).join(', ')}</li>` : ''}
        ${rep.hired.length ? `<li>Joined the family: ${rep.hired.map(esc).join(', ')}</li>` : ''}</ul>` : ''}
      <div class="row-btns">${won ? `<button class="go" data-go="next">${last ? 'Epilogue' : 'To the safehouse'}</button>` : `<button class="btn" data-go="title">Title screen</button><button class="go" data-go="retry">Try again</button>`}</div></div>`);
    this.backdrop(won ? 'win' : 'lose', 0.85);
    this.screen.onclick = (e) => {
      const g = (e.target as HTMLElement).closest<HTMLElement>('[data-go]')?.dataset.go;
      if (g === 'next') { if (last) this.ending(); else { refreshSafehouseAds(s); this.persist(); this.safehouse(); } }
      if (g === 'retry') this.briefing();
      if (g === 'title') this.title();
    };
  }

  ending() {
    this.show(`<div class="box"><h1>Debt Paid</h1><div class="sub">Port Halloran has a new name to fear</div>
      <div class="story">Victor Kessler's chair is empty and his books are yours. On Foundry Street the bakery lights come back on, and the first loaf of the morning goes to the barber who talked.<br><br>Nobody calls it a robbery anymore.</div>
      <div class="row-btns"><button class="btn" data-go="title">Title screen</button><button class="go" data-go="turf">Play Turf War</button></div></div>`);
    this.screen.onclick = (e) => {
      const g = (e.target as HTMLElement).closest<HTMLElement>('[data-go]')?.dataset.go;
      if (g === 'title') this.title();
      if (g === 'turf') this.turfMenu();
    };
  }

  // ---------- Turf War ----------
  turfMenu(err = '') {
    const name = store.getItem('bg-name') ?? '';
    const code = new URLSearchParams(location.search).get('room') ?? '';
    this.show(`<div class="box"><h2>Turf War</h2><div class="sub">2–4 families, one city, real time</div>
      <p>Every player runs a family with a Don, three gangsters and a car. Take businesses, open rackets, and knock out your rivals by taking their headquarters or killing their Don. You only see what your own people can see.</p>
      ${err ? `<p class="hot">${esc(err)}</p>` : ''}
      <label class="field">Your name <input id="tw-name" maxlength="16" value="${esc(name)}" placeholder="e.g. Rosa"></label>
      <div class="cols"><div><h4>New room</h4>
        <label class="field">AI families <select id="tw-ai"><option value="0">0</option><option value="1" selected>1</option><option value="2">2</option><option value="3">3</option></select></label>
        <label class="field">Length <select id="tw-days"><option value="5">5 days (short)</option><option value="8" selected>8 days</option><option value="12">12 days</option></select></label>
        <button class="go" data-go="create">Create room</button></div>
        <div><h4>Join a room</h4><label class="field">Room code <input id="tw-code" maxlength="5" value="${esc(code)}" placeholder="ABCD" style="text-transform:uppercase"></label><button class="go" data-go="join">Join</button></div></div>
      <p class="mute small">Needs the game server running (npm run dev starts it). Share the room code or the link with your friends.</p>
      <button class="btn" data-go="back">Back</button></div>`);
    this.screen.onclick = async (e) => {
      const g = (e.target as HTMLElement).closest<HTMLElement>('[data-go]')?.dataset.go;
      if (g === 'back') { this.net?.close(); this.net = null; return this.title(); }
      if (g !== 'create' && g !== 'join') return;
      const nm = ($('#tw-name', this.screen) as HTMLInputElement).value.trim() || 'Boss';
      store.setItem('bg-name', nm);
      try {
        if (!this.net) { this.net = new Net(); await this.net.connect(nm); this.net.on((m) => this.onNet(m)); }
        if (g === 'create') this.net.send({ t: 'create', ai: +($('#tw-ai', this.screen) as HTMLSelectElement).value, days: +($('#tw-days', this.screen) as HTMLSelectElement).value });
        else this.net.send({ t: 'join', code: ($('#tw-code', this.screen) as HTMLInputElement).value.trim().toUpperCase() });
      } catch (er) { this.net = null; this.turfMenu((er as Error).message); }
    };
  }
  private lobbyState: { code: string; players: LobbyPlayer[]; ai: number; days: number } | null = null;
  private onNet(m: ServerMsg) {
    if (m.t === 'lobby' && !this.game) { this.lobbyState = m; if (!m.started) this.lobby(); }
    else if (m.t === 'error' && !this.game) this.turfMenu(m.text);
    else if (m.t === 'start') this.startTurf(m.fam, m.layout, m.startHour);
    else if (m.t === 'chat' && this.game) this.game.toast(`${m.from}: ${m.text}`, false, undefined, true);
    else if (m.t === 'votes' && this.game && (m.pause.length || m.skip.length)) this.game.toast(`Votes — pause: ${m.pause.length}/${m.need}, skip: ${m.skip.length}/${m.need}`);
  }
  private lobby() {
    const L = this.lobbyState!;
    const me = L.players.find((p) => p.id === this.net!.id);
    const host = me?.host;
    const link = `${location.origin}${location.pathname}?room=${L.code}`;
    this.show(`<div class="box"><h2>Room ${esc(L.code)}</h2><div class="sub">Turf War lobby</div>
      <p class="mute">Invite link: <a href="${esc(link)}">${esc(link)}</a></p>
      <div class="lobby">${L.players.map((p) => { const f = TURF_FAMILIES.find((x) => x.id === p.fam)!; return `<div class="row"><div class="dot" style="background:${f.color}"></div><div class="info"><b>${esc(p.name)}</b>${p.host ? ' <span class="gold">host</span>' : ''}${p.connected ? '' : ' <span class="hot">(offline)</span>'}<div class="stats">${esc(f.name)}</div></div></div>`; }).join('')}
      ${Array.from({ length: L.ai }, (_, i) => { const f = TURF_FAMILIES[L.players.length + i]; return f ? `<div class="row"><div class="dot" style="background:${f.color}"></div><div class="info"><b>${esc(f.name)}</b> <span class="mute">AI</span></div></div>` : ''; }).join('')}</div>
      <p class="mute">${L.players.length + L.ai} of 4 families · ${L.days} days</p>
      <div class="row-btns"><button class="btn" data-go="leave">Leave</button>${host ? `<button class="go" data-go="start" ${L.players.length + L.ai < 2 ? 'disabled' : ''}>Start the war</button>` : '<span class="mute">Waiting for the host to start…</span>'}</div></div>`);
    this.backdrop('lobby');
    this.screen.onclick = (e) => {
      const g = (e.target as HTMLElement).closest<HTMLElement>('[data-go]')?.dataset.go;
      if (g === 'start') this.net!.send({ t: 'start' });
      if (g === 'leave') { this.net!.send({ t: 'leave' }); this.net!.close(); this.net = null; this.turfMenu(); }
    };
  }
  private startTurf(fam: string, layout: Layout, startHour: number) {
    if (this.game) return;
    this.hide();
    const sess = new NetSession(this.net!, fam, layout, startHour);
    sess.onError = (t) => this.game?.toast(t, false);
    const f = TURF_FAMILIES.find((x) => x.id === fam)!;
    this.game = new Game(this.root, sess, {
      title: 'Turf War', subtitle: `You are the ${f.name}`, quitLabel: 'Leave the match',
      onQuit: () => { this.net?.send({ t: 'leave' }); this.net?.close(); this.net = null; this.title(); },
      onEnd: (won, text) => {
        this.game?.destroy();
        this.game = null;
        this.show(`<div class="box"><h1>${won ? 'The City Is Yours' : 'Defeat'}</h1><div class="story">${esc(text)}</div><div class="row-btns"><button class="go" data-go="title">Title screen</button></div></div>`);
        this.net?.close(); this.net = null;
        this.screen.onclick = (e) => { if ((e.target as HTMLElement).closest('[data-go]')) this.title(); };
      },
    });
    void this.game.start();
  }
}

const OUTRO: Record<string, string> = {
  c1: 'By morning the Doyle men were limping back to Kettle Street. The shopkeepers on Foundry Street lit candles for Sal, and they paid his son.',
  c2: 'Petey Sullivan cried, then talked. The man who fired the shots that night was Mick Doyle.',
  c3: 'The gin flows, the money comes in, and the Kessler trucks give your corner a wide berth. Now you can afford a war.',
  c4: 'Mick Doyle took a long time to fall. In his coat pocket: a crisp Kessler banknote, folded twice.',
  c5: 'Doyle Hall is quiet. In the safe, under the cash, a ledger in a neat hand: "$2,000 — V.K. — for the baker."',
  c6: 'Dot Okafor is free, Kessler\'s money sits in your cellar, and Kessler knows exactly who took it. He is coming.',
  c7: 'Victor Kessler\'s chair is empty and his books are yours. On Foundry Street the bakery lights come back on.',
};
