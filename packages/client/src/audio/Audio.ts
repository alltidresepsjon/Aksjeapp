// Synthesised sound effects and a small jazz loop, all with Web Audio (no sound files needed).
// Recorded sounds and music in /assets/audio/<name>.mp3 are used when present (see CREDITS.md);
// the synthesised versions are the fallback.

import { store } from '../ui/storage';
import type { WeaponId } from '@bg/shared';

export class AudioEngine {
  ctx: AudioContext | null = null;
  private master!: GainNode;
  private sfxBus!: GainNode;
  private musicBus!: GainNode;
  private noise!: AudioBuffer;
  private files = new Map<string, AudioBuffer | null>();
  private musicTimer = 0;
  private nextBar = 0;
  private bar = 0;
  private night = false;
  private lastShot = 0;
  volume = { sfx: 0.8, music: 0.45 };

  constructor() {
    try {
      const v = JSON.parse(store.getItem('bg-volume') ?? 'null');
      if (v) this.volume = v;
    } catch { /* ignore */ }
  }

  /** Must be called from a user gesture (browsers block audio before that). */
  unlock() {
    if (this.ctx) { void this.ctx.resume(); return; }
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.connect(this.ctx.destination);
    this.sfxBus = this.ctx.createGain();
    this.musicBus = this.ctx.createGain();
    this.sfxBus.connect(this.master);
    this.musicBus.connect(this.master);
    this.applyVolume();
    const len = this.ctx.sampleRate;
    this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    for (const n of ['shot-revolver', 'shot-dual', 'shot-shotgun', 'shot-tommy', 'shot-rifle', 'siren', 'engine']) void this.tryLoad(n);
    for (const n of ['music-day', 'music-day-2', 'music-night']) void this.tryLoad(n).then(() => this.maybeStartTracks());
  }
  applyVolume() {
    if (!this.ctx) return;
    this.sfxBus.gain.value = this.volume.sfx;
    this.musicBus.gain.value = this.volume.music * 0.5;
    store.setItem('bg-volume', JSON.stringify(this.volume));
  }
  private async tryLoad(name: string) {
    try {
      const r = await fetch(`${import.meta.env.BASE_URL}assets/audio/${name}.mp3`);
      if (!r.ok || !(r.headers.get('content-type') ?? '').includes('audio')) { this.files.set(name, null); return; }
      this.files.set(name, await this.ctx!.decodeAudioData(await r.arrayBuffer()));
    } catch { this.files.set(name, null); }
  }
  private playFile(name: string, vol: number, rate = 1): boolean {
    const buf = this.files.get(name);
    if (!buf || !this.ctx) return false;
    const s = this.ctx.createBufferSource();
    s.buffer = buf;
    s.playbackRate.value = rate;
    const g = this.ctx.createGain(); g.gain.value = vol;
    s.connect(g).connect(this.sfxBus);
    s.start();
    return true;
  }

  private burst(t: number, dur: number, freq: number, q: number, vol: number, type: BiquadFilterType = 'bandpass') {
    const c = this.ctx!;
    const src = c.createBufferSource();
    src.buffer = this.noise;
    const f = c.createBiquadFilter();
    f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = c.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(f).connect(g).connect(this.sfxBus);
    src.start(t, Math.random() * 0.5, dur + 0.05);
  }
  private tone(t: number, freq: number, dur: number, vol: number, type: OscillatorType = 'sine', bus?: GainNode, glide?: number) {
    const c = this.ctx!;
    const o = c.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (glide) o.frequency.exponentialRampToValueAtTime(glide, t + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(bus ?? this.sfxBus);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  shot(w: WeaponId, vol: number) {
    if (!this.ctx || vol < 0.03) return;
    const now = this.ctx.currentTime;
    if (now - this.lastShot < 0.02) return;
    this.lastShot = now;
    const name = 'shot-' + w;
    if (this.playFile(name, vol * (w === 'tommy' ? 0.75 : 0.9), 0.9 + Math.random() * 0.2)) return;
    if (w === 'shotgun') { this.burst(now, 0.35, 700, 0.6, vol * 0.9, 'lowpass'); this.tone(now, 110, 0.18, vol * 0.5, 'triangle', undefined, 40); }
    else if (w === 'tommy') { this.burst(now, 0.07, 1800, 1.2, vol * 0.45); this.tone(now, 160, 0.05, vol * 0.25, 'square', undefined, 80); }
    else if (w === 'rifle') { this.burst(now, 0.4, 2400, 0.7, vol * 0.8); this.burst(now + 0.05, 0.5, 600, 0.5, vol * 0.3, 'lowpass'); }
    else if (w === 'fists') { this.burst(now, 0.06, 300, 1, vol * 0.4, 'lowpass'); }
    else { this.burst(now, 0.18, 1500, 0.9, vol * 0.7); this.tone(now, 140, 0.1, vol * 0.3, 'triangle', undefined, 60); }
  }
  siren(vol = 0.5) {
    if (!this.ctx) return;
    if (this.playFile('siren', vol)) return;
    const t = this.ctx.currentTime;
    for (let i = 0; i < 4; i++) this.tone(t + i * 0.45, i % 2 ? 660 : 880, 0.42, vol * 0.18, 'sawtooth');
  }
  cash() {
    if (!this.ctx) return;
    if (this.playFile('cash', 0.6)) return;
    const t = this.ctx.currentTime;
    this.tone(t, 1568, 0.25, 0.18, 'triangle');
    this.tone(t + 0.07, 2093, 0.35, 0.15, 'triangle');
    this.burst(t, 0.12, 5000, 2, 0.06, 'highpass');
  }
  engine(vol = 0.5) { this.playFile('engine', vol, 0.95 + Math.random() * 0.1); }
  click() { if (this.ctx) this.tone(this.ctx.currentTime, 900, 0.05, 0.06, 'square'); }
  alert() { if (!this.ctx) return; const t = this.ctx.currentTime; this.tone(t, 523, 0.15, 0.12, 'square'); this.tone(t + 0.16, 392, 0.22, 0.12, 'square'); }
  fanfare() { if (!this.ctx) return; const t = this.ctx.currentTime; [523, 659, 784, 1047].forEach((f, i) => this.tone(t + i * 0.12, f, 0.4, 0.12, 'triangle')); }
  death() { if (!this.ctx) return; const t = this.ctx.currentTime; this.tone(t, 220, 0.6, 0.08, 'sine', undefined, 90); }
  fire() { if (!this.ctx) return; const t = this.ctx.currentTime; this.burst(t, 1.5, 400, 0.4, 0.25, 'lowpass'); }

  // ---------- music: walking bass, brushes, comping piano ----------
  private tracks: { day: AudioBufferSourceNode | null; night: AudioBufferSourceNode | null; dayGain: GainNode | null; nightGain: GainNode | null } = { day: null, night: null, dayGain: null, nightGain: null };
  private wantMusic = false;
  private dayIdx = 0;
  private maybeStartTracks() {
    if (!this.wantMusic || !this.ctx || this.tracks.dayGain) return;
    const day = this.files.get('music-day'), night = this.files.get('music-night');
    if (!day || !night) return;
    clearInterval(this.musicTimer); this.musicTimer = 0;
    const c = this.ctx;
    this.tracks.dayGain = c.createGain(); this.tracks.nightGain = c.createGain();
    this.tracks.dayGain.connect(this.musicBus); this.tracks.nightGain.connect(this.musicBus);
    this.tracks.dayGain.gain.value = this.night ? 0 : 1;
    this.tracks.nightGain.gain.value = this.night ? 1 : 0;
    const startDay = () => {
      const list = [this.files.get('music-day'), this.files.get('music-day-2')].filter((b): b is AudioBuffer => !!b);
      const src = c.createBufferSource();
      src.buffer = list[this.dayIdx++ % list.length];
      src.connect(this.tracks.dayGain!);
      src.onended = () => { if (this.tracks.day === src && this.wantMusic) startDay(); };
      src.start();
      this.tracks.day = src;
    };
    startDay();
    const n = c.createBufferSource();
    n.buffer = night; n.loop = true; n.connect(this.tracks.nightGain); n.start();
    this.tracks.night = n;
  }
  private crossfade() {
    if (!this.ctx || !this.tracks.dayGain) return;
    const t = this.ctx.currentTime;
    this.tracks.dayGain.gain.cancelScheduledValues(t);
    this.tracks.nightGain!.gain.cancelScheduledValues(t);
    this.tracks.dayGain.gain.setTargetAtTime(this.night ? 0 : 1, t, 1.5);
    this.tracks.nightGain!.gain.setTargetAtTime(this.night ? 1 : 0, t, 1.5);
  }
  startMusic() {
    this.wantMusic = true;
    if (this.ctx && this.files.get('music-day') && this.files.get('music-night')) { this.maybeStartTracks(); return; }
    if (!this.ctx || this.musicTimer) return;
    this.nextBar = this.ctx.currentTime + 0.1;
    this.musicTimer = window.setInterval(() => this.schedule(), 200);
  }
  stopMusic() {
    this.wantMusic = false;
    clearInterval(this.musicTimer); this.musicTimer = 0;
    try { this.tracks.day?.stop(); this.tracks.night?.stop(); } catch { /* already stopped */ }
    this.tracks.dayGain?.disconnect(); this.tracks.nightGain?.disconnect();
    this.tracks = { day: null, night: null, dayGain: null, nightGain: null };
  }
  setNight(n: boolean) { this.night = n; this.crossfade(); }
  private schedule() {
    const c = this.ctx!;
    while (this.nextBar < c.currentTime + 0.6) { this.playBar(this.nextBar); this.nextBar += this.night ? 2.6 : 2.2; this.bar++; }
  }
  private playBar(t: number) {
    const beat = (this.night ? 2.6 : 2.2) / 4;
    // ii-V-I-VI in F (day) / D minor blues-ish (night)
    const prog = this.night
      ? [[50, 53, 57, 60], [55, 58, 62, 65], [50, 53, 57, 60], [57, 61, 64, 67]]
      : [[55, 58, 62, 65], [48, 52, 55, 58], [53, 57, 60, 64], [50, 54, 57, 60]];
    const ch = prog[this.bar % prog.length];
    const hz = (m: number) => 440 * Math.pow(2, (m - 69) / 12);
    const bass = [ch[0] - 12, ch[1] - 12, ch[2] - 12, ch[1] - 11];
    for (let i = 0; i < 4; i++) {
      this.tone(t + i * beat, hz(bass[i]), beat * 0.9, 0.22, 'triangle', this.musicBus);
      // brushes, swung
      this.musicNoise(t + i * beat, 0.09, 0.05);
      this.musicNoise(t + i * beat + beat * 0.66, 0.05, 0.03);
    }
    for (const off of [beat * 1.66, beat * 3]) for (const n of ch.slice(1)) this.tone(t + off, hz(n), beat * 0.7, 0.05, 'sine', this.musicBus);
    if (this.bar % 2 === 1) {
      const mel = ch[3] + 12 + [0, 2, -1, 3][this.bar % 4];
      this.tone(t + beat * 0.5, hz(mel), beat * 1.2, 0.06, 'triangle', this.musicBus);
      this.tone(t + beat * 2.2, hz(mel - 3), beat * 0.9, 0.05, 'triangle', this.musicBus);
    }
  }
  private musicNoise(t: number, dur: number, vol: number) {
    const c = this.ctx!;
    const src = c.createBufferSource(); src.buffer = this.noise;
    const f = c.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 6000;
    const g = c.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(f).connect(g).connect(this.musicBus);
    src.start(t, Math.random() * 0.5, dur + 0.02);
  }
}

export const audio = new AudioEngine();
