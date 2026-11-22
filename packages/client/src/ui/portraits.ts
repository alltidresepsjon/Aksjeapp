// Small painted-style portraits drawn in code, one per person (replaced by imported portrait-*.png when present).

import type { Unit } from '@bg/shared';

const cache = new Map<string, string>();
const SKIN = ['#e0b898', '#c89a78', '#9a6a4a', '#6a4a32', '#d8a888'];
const HAIR = ['#1a1410', '#3a2a1a', '#5a3a22', '#2a2a2a', '#8a6a4a', '#b0b0a8'];

function rnd(seed: number) {
  let s = (seed * 2654435761) >>> 0 || 1;
  return () => { s = (s * 1103515245 + 12345) >>> 0; return s / 4294967296; };
}

/** A data: URL portrait for a person. */
export function portrait(u: Pick<Unit, 'id' | 'name' | 'hero' | 'boss' | 'cop'> & { fam: string }, color: string, size = 96): string {
  const key = `${u.name}|${color}|${size}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const r = rnd([...u.name].reduce((a, c) => a * 31 + c.charCodeAt(0), 7));
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d')!;
  const S = size / 96;
  g.scale(S, S);
  // background: a warm vignette tinted by the family colour
  const bg = g.createRadialGradient(48, 40, 10, 48, 48, 70);
  bg.addColorStop(0, '#5a4a38'); bg.addColorStop(1, '#1a1612');
  g.fillStyle = bg; g.fillRect(0, 0, 96, 96);
  g.fillStyle = color; g.globalAlpha = 0.25; g.fillRect(0, 0, 96, 96); g.globalAlpha = 1;
  const skin = u.cop ? SKIN[0] : SKIN[Math.floor(r() * SKIN.length)];
  const coat = u.cop ? '#2a3a6a' : shade(color, 0.55);
  // shoulders and coat
  g.fillStyle = coat;
  g.beginPath(); g.moveTo(8, 96); g.quadraticCurveTo(14, 66, 48, 64); g.quadraticCurveTo(82, 66, 88, 96); g.fill();
  g.fillStyle = '#e8e2d4'; g.beginPath(); g.moveTo(40, 66); g.lineTo(48, 84); g.lineTo(56, 66); g.fill();
  g.fillStyle = u.boss || u.hero ? '#c9a23a' : '#6a1a1a'; g.fillRect(46.5, 68, 3, 18);
  // neck and face
  g.fillStyle = skin; g.fillRect(41, 54, 14, 12);
  g.beginPath(); g.ellipse(48, 44, 15, 18, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = shade(skin, 0.8); g.beginPath(); g.ellipse(56, 46, 5, 12, 0, 0, Math.PI * 2); g.fill();
  // eyes, brows, mouth
  g.fillStyle = '#1a1410';
  g.fillRect(40, 42, 4, 2.4); g.fillRect(52, 42, 4, 2.4);
  g.fillStyle = HAIR[Math.floor(r() * HAIR.length)];
  g.fillRect(38, 38, 8, 2); g.fillRect(50, 38, 8, 2);
  if (r() < 0.4) { g.fillRect(41, 52, 14, 2.5); } // moustache
  g.fillStyle = shade(skin, 0.6); g.fillRect(44, 56, 8, 1.6);
  // hat
  const hat = u.cop ? '#1a2240' : u.hero ? '#d8d0c0' : r() < 0.5 ? '#1a1a1a' : shade(color, 0.35);
  g.fillStyle = hat;
  g.beginPath(); g.ellipse(48, 30, 26, 6, 0, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.moveTo(32, 30); g.quadraticCurveTo(34, 12, 48, 12); g.quadraticCurveTo(62, 12, 64, 30); g.fill();
  g.fillStyle = u.boss ? '#c9a23a' : 'rgba(0,0,0,0.35)'; g.fillRect(33, 25, 30, 4);
  // frame
  g.strokeStyle = u.hero || u.boss ? '#d8b25a' : 'rgba(0,0,0,0.6)'; g.lineWidth = 3; g.strokeRect(1.5, 1.5, 93, 93);
  const url = c.toDataURL();
  cache.set(key, url);
  return url;
}

function shade(hex: string, f: number): string {
  const n = parseInt(hex.replace('#', ''), 16);
  const c = (v: number) => Math.max(0, Math.min(255, Math.round(v * f)));
  return `rgb(${c((n >> 16) & 255)},${c((n >> 8) & 255)},${c(n & 255)})`;
}

/** Ten-point stat as five stars (half stars for odd values). */
export function stars(v: number, label = ''): string {
  const full = Math.floor(v / 2), half = v % 2;
  return `<span class="stars" title="${label}${label ? ' ' : ''}${v}/10">${'★'.repeat(full)}${half ? '<span class="half">★</span>' : ''}<span class="off">${'★'.repeat(5 - full - half)}</span></span>`;
}

export function statStars(s: { muscle: number; aim: number; charm: number; stealth: number }): string {
  return `<span class="statstars"><span>💪${stars(s.muscle, 'Muscle')}</span><span>🎯${stars(s.aim, 'Aim')}</span><span>🗣${stars(s.charm, 'Charm')}</span><span>🥷${stars(s.stealth, 'Stealth')}</span></span>`;
}
