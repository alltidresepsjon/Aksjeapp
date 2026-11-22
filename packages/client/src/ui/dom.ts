export const $ = <T extends HTMLElement = HTMLElement>(sel: string, root: ParentNode = document) => root.querySelector(sel) as T;
export const $$ = <T extends HTMLElement = HTMLElement>(sel: string, root: ParentNode = document) => Array.from(root.querySelectorAll(sel)) as T[];

export function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
}
export function money(n: number): string {
  const v = Math.round(n);
  return (v < 0 ? '−$' : '$') + Math.abs(v).toLocaleString('en-US');
}
export function el(html: string): HTMLElement {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild as HTMLElement;
}
export function clock(hour: number): string {
  const h = Math.floor(hour), m = Math.floor((hour - h) * 60 / 15) * 15;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}
/** Only rewrite innerHTML when the content actually changed (keeps buttons stable under fingers). */
export function setHtml(node: HTMLElement, html: string) {
  if ((node as HTMLElement & { _h?: string })._h === html) return;
  (node as HTMLElement & { _h?: string })._h = html;
  node.innerHTML = html;
}
export const statIcons = { muscle: '💪', aim: '🎯', charm: '🗣', stealth: '🥷' } as const;
