// In-page replacements for confirm() and alert(), which some embedded browsers block.

import { esc } from './dom';

export function ask(text: string, yes = 'Yes', no = 'Cancel'): Promise<boolean> {
  return new Promise((resolve) => {
    const o = document.createElement('div');
    o.className = 'bg-dialog';
    o.innerHTML = `<div class="modal"><p>${esc(text)}</p><div class="row-btns"><button class="btn" data-r="0">${esc(no)}</button><button class="btn gold" data-r="1">${esc(yes)}</button></div></div>`;
    o.addEventListener('click', (e) => {
      const b = (e.target as HTMLElement).closest<HTMLElement>('[data-r]');
      if (!b) return;
      o.remove();
      resolve(b.dataset.r === '1');
    });
    document.body.appendChild(o);
  });
}

export function notice(text: string): Promise<void> {
  return ask(text, 'OK', '').then(() => undefined);
}
