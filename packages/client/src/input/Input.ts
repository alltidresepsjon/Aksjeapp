// Pointer, touch and keyboard input: pan with drag, pinch/wheel zoom, tap, long-press and right-click.

export interface InputHandlers {
  tap(x: number, y: number, mods: { shift: boolean }): void;
  secondary(x: number, y: number): void;
  pan(dx: number, dy: number): void;
  zoom(factor: number, x: number, y: number): void;
  box?(x0: number, y0: number, x1: number, y1: number): void;
  boxMode(): boolean;
  boxPreview?(r: { x0: number; y0: number; x1: number; y1: number } | null): void;
}

export class Input {
  private pts = new Map<number, { x: number; y: number; sx: number; sy: number; t: number }>();
  private dragging = false;
  private pinchD = 0;
  private longTimer = 0;
  private longFired = false;
  private boxing = false;
  private off: (() => void)[] = [];

  constructor(private el: HTMLElement, private h: InputHandlers) {
    const on = <K extends keyof HTMLElementEventMap>(t: K, f: (e: HTMLElementEventMap[K]) => void, o?: AddEventListenerOptions) => {
      el.addEventListener(t, f as EventListener, o);
      this.off.push(() => el.removeEventListener(t, f as EventListener));
    };
    on('contextmenu', (e) => e.preventDefault());
    on('pointerdown', (e) => this.down(e));
    on('pointermove', (e) => this.move(e));
    on('pointerup', (e) => this.up(e));
    on('pointercancel', (e) => { this.pts.delete(e.pointerId); this.reset(); });
    on('wheel', (e) => { e.preventDefault(); this.h.zoom(Math.exp(-e.deltaY * 0.0015), e.offsetX, e.offsetY); }, { passive: false });
  }
  private local(e: PointerEvent) { const r = this.el.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }
  private reset() { this.dragging = false; this.pinchD = 0; clearTimeout(this.longTimer); this.boxing = false; this.h.boxPreview?.(null); }
  private down(e: PointerEvent) {
    this.el.setPointerCapture(e.pointerId);
    const p = this.local(e);
    this.pts.set(e.pointerId, { x: p.x, y: p.y, sx: p.x, sy: p.y, t: performance.now() });
    if (e.button === 2) return;
    if (this.pts.size === 2) {
      clearTimeout(this.longTimer);
      const [a, b] = [...this.pts.values()];
      this.pinchD = Math.hypot(a.x - b.x, a.y - b.y);
      this.dragging = true;
      this.boxing = false;
      return;
    }
    this.longFired = false;
    this.boxing = this.h.boxMode() || (e.shiftKey && e.pointerType === 'mouse');
    clearTimeout(this.longTimer);
    if (e.pointerType !== 'mouse') {
      this.longTimer = window.setTimeout(() => {
        if (!this.dragging && this.pts.size === 1 && !this.boxing) { this.longFired = true; const q = this.pts.values().next().value!; this.h.secondary(q.x, q.y); navigator.vibrate?.(15); }
      }, 480);
    }
  }
  private move(e: PointerEvent) {
    const q = this.pts.get(e.pointerId);
    if (!q) return;
    const p = this.local(e);
    const dx = p.x - q.x, dy = p.y - q.y;
    q.x = p.x; q.y = p.y;
    if (this.pts.size === 2) {
      const [a, b] = [...this.pts.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (this.pinchD > 0) this.h.zoom(d / this.pinchD, (a.x + b.x) / 2, (a.y + b.y) / 2);
      this.pinchD = d;
      this.h.pan(dx / 2, dy / 2);
      return;
    }
    if (!this.dragging && Math.hypot(p.x - q.sx, p.y - q.sy) > 9) { this.dragging = true; clearTimeout(this.longTimer); }
    if (!this.dragging) return;
    if (this.boxing) this.h.boxPreview?.({ x0: q.sx, y0: q.sy, x1: p.x, y1: p.y });
    else this.h.pan(dx, dy);
  }
  private up(e: PointerEvent) {
    const q = this.pts.get(e.pointerId);
    this.pts.delete(e.pointerId);
    clearTimeout(this.longTimer);
    if (!q) return;
    if (this.pts.size > 0) { this.pinchD = 0; return; }
    if (e.button === 2 && !this.dragging) { this.h.secondary(q.x, q.y); this.reset(); return; }
    if (this.boxing && this.dragging) { this.h.box?.(q.sx, q.sy, q.x, q.y); this.reset(); return; }
    if (!this.dragging && !this.longFired) this.h.tap(q.x, q.y, { shift: e.shiftKey });
    this.reset();
  }
  destroy() { for (const f of this.off) f(); }
}
