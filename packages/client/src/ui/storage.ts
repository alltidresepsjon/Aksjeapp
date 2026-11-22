// localStorage/sessionStorage that never throws: some embedded or private browsers refuse storage.
// Falls back to memory so the game still runs (it just forgets on reload).

function make(kind: 'localStorage' | 'sessionStorage') {
  const mem = new Map<string, string>();
  let real: Storage | null = null;
  try { real = window[kind]; const k = '__bg_test'; real.setItem(k, '1'); real.removeItem(k); } catch { real = null; }
  return {
    persistent: !!real,
    getItem(k: string): string | null { try { return real ? real.getItem(k) : mem.get(k) ?? null; } catch { return mem.get(k) ?? null; } },
    setItem(k: string, v: string) { mem.set(k, v); try { real?.setItem(k, v); } catch { /* full or blocked */ } },
    removeItem(k: string) { mem.delete(k); try { real?.removeItem(k); } catch { /* blocked */ } },
  };
}

export const store = make('localStorage');
export const sessionStore = make('sessionStorage');
