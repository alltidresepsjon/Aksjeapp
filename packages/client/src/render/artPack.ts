// Optional hand-made art (imported with `npm run art`). Anything missing falls back to the drawings in code.

import { Assets, Texture } from 'pixi.js';

interface Entry { file: string; w: number; h: number }
interface Manifest { version: number; buildings: Record<string, Entry>; people: Record<string, Entry>; cars: Record<string, Entry>; ui: Record<string, Entry> }

export interface ArtPack {
  building(type: string, look: string, size: number, seed: number): Texture | null;
  person(keys: string[], seed: number): Texture | null;
  car(model: string, view: 'front' | 'rear'): Texture | null;
  ui(name: string): string | null;
  empty: boolean;
}

const BASE = '/assets/graphics/';
let cached: Promise<ArtPack> | null = null;

export function loadArtPack(): Promise<ArtPack> {
  if (!cached) cached = load();
  return cached;
}

async function load(): Promise<ArtPack> {
  let m: Manifest | null = null;
  try {
    const r = await fetch(BASE + 'manifest.json', { cache: 'no-cache' });
    if (r.ok && (r.headers.get('content-type') ?? '').includes('json')) m = await r.json();
  } catch { m = null; }
  const tex = new Map<string, Texture>();
  if (m) {
    const all = [...Object.values(m.buildings), ...Object.values(m.people), ...Object.values(m.cars)];
    await Promise.all(all.map(async (e) => {
      try { tex.set(e.file, await Assets.load<Texture>(BASE + e.file)); } catch { /* skip broken file */ }
    }));
  }
  const pick = (group: Record<string, Entry> | undefined, prefix: string, seed: number): Texture | null => {
    if (!group) return null;
    const keys = Object.keys(group).filter((k) => k === prefix || k.startsWith(prefix + '-')).sort();
    if (!keys.length) return null;
    return tex.get(group[keys[seed % keys.length]].file) ?? null;
  };
  return {
    empty: !m || tex.size === 0,
    building: (type, look, size, seed) => pick(m?.buildings, `type-${type}-${size}`, seed) ?? pick(m?.buildings, `${look}-${size}`, seed),
    person: (keys, seed) => { for (const k of keys) { const t = pick(m?.people, k, seed); if (t) return t; } return null; },
    car: (model, view) => pick(m?.cars, `${model}-${view}`, 0),
    ui: (name) => (m?.ui[name] ? BASE + m.ui[name].file : null),
  };
}
