// Small street furniture: hydrants, mailboxes, newsstands, benches, barrels, crates, trash cans.

import { canvas, css } from '../iso';
import { SPRITE_RES } from './sprites';

export type PropKind = 'hydrant' | 'mailbox' | 'newsstand' | 'bench' | 'barrels' | 'crates' | 'trash' | 'clock';

export interface PropArt { cv: HTMLCanvasElement; ax: number; ay: number }

function shadow(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number) {
  ctx.fillStyle = 'rgba(0,0,0,0.32)';
  ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, 7); ctx.fill();
}

export function propArt(kind: PropKind): PropArt {
  const W = 40, H = 56;
  const [cv, ctx] = canvas(W * SPRITE_RES, H * SPRITE_RES);
  ctx.scale(SPRITE_RES, SPRITE_RES);
  const cx = 20, gy = 50;
  switch (kind) {
    case 'hydrant':
      shadow(ctx, cx, gy, 6, 2.5);
      ctx.fillStyle = '#b8302a'; ctx.fillRect(cx - 3.5, gy - 13, 7, 13);
      ctx.fillStyle = '#d84a3a'; ctx.beginPath(); ctx.ellipse(cx, gy - 13, 4, 2.5, 0, 0, 7); ctx.fill();
      ctx.fillStyle = '#8a2420'; ctx.fillRect(cx - 6, gy - 9, 12, 3);
      ctx.fillStyle = '#e8c060'; ctx.fillRect(cx - 1, gy - 17, 2, 3);
      break;
    case 'mailbox':
      shadow(ctx, cx, gy, 7, 3);
      ctx.fillStyle = '#2a4a8a'; ctx.fillRect(cx - 5, gy - 18, 10, 14);
      ctx.beginPath(); ctx.ellipse(cx, gy - 18, 5, 3, 0, Math.PI, 0); ctx.fill();
      ctx.fillStyle = '#1a2a5a'; ctx.fillRect(cx + 2, gy - 18, 3, 14);
      ctx.fillStyle = '#d8d0c0'; ctx.fillRect(cx - 3.5, gy - 14, 5, 1.5);
      ctx.fillStyle = '#1a1a1a'; ctx.fillRect(cx - 4, gy - 4, 1.5, 4); ctx.fillRect(cx + 2.5, gy - 4, 1.5, 4);
      break;
    case 'newsstand':
      shadow(ctx, cx, gy, 15, 5);
      ctx.fillStyle = '#4a3a2a'; ctx.fillRect(cx - 12, gy - 20, 24, 20);
      ctx.fillStyle = '#3a2a1e'; ctx.fillRect(cx + 4, gy - 20, 8, 20);
      ctx.fillStyle = '#2f5a3a'; ctx.beginPath(); ctx.moveTo(cx - 15, gy - 20); ctx.lineTo(cx + 15, gy - 20); ctx.lineTo(cx + 12, gy - 27); ctx.lineTo(cx - 12, gy - 27); ctx.closePath(); ctx.fill();
      for (let i = 0; i < 4; i++) { ctx.fillStyle = ['#e9e1cc', '#d8cfb8', '#c23a2a', '#e9e1cc'][i]; ctx.fillRect(cx - 10 + i * 4, gy - 16, 3, 5); }
      ctx.fillStyle = '#e9e1cc'; ctx.font = '700 4px "Libre Franklin"'; ctx.textAlign = 'center'; ctx.fillText('HERALD', cx - 2, gy - 22.5);
      break;
    case 'bench':
      shadow(ctx, cx, gy, 14, 4);
      ctx.fillStyle = '#5a3a22';
      ctx.save(); ctx.translate(cx, gy - 7); ctx.transform(1, 0.5, 0, 1, 0, 0);
      ctx.fillRect(-12, -2, 24, 3); ctx.fillRect(-12, -8, 24, 2.5);
      ctx.fillStyle = '#1a1a1a'; ctx.fillRect(-11, 1, 1.5, 6); ctx.fillRect(9.5, 1, 1.5, 6);
      ctx.restore();
      break;
    case 'barrels':
      shadow(ctx, cx, gy, 13, 4);
      for (const [dx, dy] of [[-6, 0], [5, 2], [0, -3]] as const) {
        const x = cx + dx, y = gy + dy - 1;
        ctx.fillStyle = '#6a4a2a'; ctx.fillRect(x - 5, y - 13, 10, 13);
        ctx.fillStyle = '#7a5a36'; ctx.beginPath(); ctx.ellipse(x, y - 13, 5, 2.2, 0, 0, 7); ctx.fill();
        ctx.fillStyle = '#2a2a2a'; ctx.fillRect(x - 5, y - 10, 10, 1.2); ctx.fillRect(x - 5, y - 4, 10, 1.2);
      }
      break;
    case 'crates':
      shadow(ctx, cx, gy, 14, 4);
      for (const [dx, dy, h] of [[-6, 0, 10], [6, 1, 10], [0, -9, 9]] as const) {
        const x = cx + dx, y = gy + dy;
        ctx.fillStyle = css(0x9a7a4a);
        ctx.fillRect(x - 6, y - h, 12, h);
        ctx.fillStyle = css(0x7a5a32); ctx.fillRect(x + 1, y - h, 5, h);
        ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.strokeRect(x - 6, y - h, 12, h);
      }
      break;
    case 'trash':
      shadow(ctx, cx, gy, 6, 2.5);
      ctx.fillStyle = '#5a5e62'; ctx.fillRect(cx - 4.5, gy - 12, 9, 12);
      ctx.fillStyle = '#7a7e82'; ctx.beginPath(); ctx.ellipse(cx, gy - 12, 5, 2.2, 0, 0, 7); ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.3)'; for (let x = -3; x <= 3; x += 2) { ctx.beginPath(); ctx.moveTo(cx + x, gy - 11); ctx.lineTo(cx + x, gy - 1); ctx.stroke(); }
      break;
    case 'clock':
      shadow(ctx, cx, gy, 5, 2);
      ctx.fillStyle = '#1d2a22'; ctx.fillRect(cx - 1.5, gy - 34, 3, 34);
      ctx.fillStyle = '#1d2a22'; ctx.beginPath(); ctx.arc(cx, gy - 38, 6, 0, 7); ctx.fill();
      ctx.fillStyle = '#efe4c8'; ctx.beginPath(); ctx.arc(cx, gy - 38, 4.5, 0, 7); ctx.fill();
      ctx.strokeStyle = '#1a1a1a'; ctx.lineWidth = 0.8; ctx.beginPath(); ctx.moveTo(cx, gy - 38); ctx.lineTo(cx, gy - 41.5); ctx.moveTo(cx, gy - 38); ctx.lineTo(cx + 2.5, gy - 37); ctx.stroke();
      break;
  }
  return { cv, ax: cx / W, ay: gy / H };
}
