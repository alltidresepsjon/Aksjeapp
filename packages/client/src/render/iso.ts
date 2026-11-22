// Isometric projection helpers. World units are tiles; one tile is TW×TH pixels on screen.

export const TW = 64;
export const TH = 32;
export const FLOOR_H = 20;

export function toScreen(x: number, y: number): { x: number; y: number } {
  return { x: (x - y) * (TW / 2), y: (x + y) * (TH / 2) };
}
export function toWorld(sx: number, sy: number): { x: number; y: number } {
  const a = sx / (TW / 2), b = sy / (TH / 2);
  return { x: (a + b) / 2, y: (b - a) / 2 };
}

export function hex(c: string): number {
  return parseInt(c.replace('#', ''), 16);
}
export function rgb(n: number): [number, number, number] {
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
export function css(n: number, a = 1): string {
  const [r, g, b] = rgb(n);
  return a >= 1 ? `rgb(${r},${g},${b})` : `rgba(${r},${g},${b},${a})`;
}
export function shade(n: number, f: number): number {
  const [r, g, b] = rgb(n);
  const c = (v: number) => Math.max(0, Math.min(255, Math.round(f >= 1 ? v + (255 - v) * (f - 1) : v * f)));
  return (c(r) << 16) | (c(g) << 8) | c(b);
}
export function mix(a: number, b: number, t: number): number {
  const A = rgb(a), B = rgb(b);
  const c = (i: number) => Math.round(A[i] + (B[i] - A[i]) * t);
  return (c(0) << 16) | (c(1) << 8) | c(2);
}
export function mul(a: number, b: number): number {
  const A = rgb(a), B = rgb(b);
  return (Math.round((A[0] * B[0]) / 255) << 16) | (Math.round((A[1] * B[1]) / 255) << 8) | Math.round((A[2] * B[2]) / 255);
}

/** Tiny deterministic random for art generation. */
export function artRng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function canvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.ceil(w));
  c.height = Math.max(1, Math.ceil(h));
  return [c, c.getContext('2d')!];
}
