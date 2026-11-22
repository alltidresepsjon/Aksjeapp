import type { Command, FamId, MapData, ViewState } from '@bg/shared';

export interface Session {
  readonly isNet: boolean;
  readonly fam: FamId;
  readonly map: MapData;
  /** Latest state to draw. */
  view(): ViewState;
  /** Fog bitmap (1 = visible) or null when there is no fog. */
  vis(): Uint8Array | null;
  /** Interpolated position of a unit or vehicle (smooths network snapshots). */
  lerpPos(id: number, x: number, y: number): { x: number; y: number };
  command(cmd: Command): string | null;
  speed: number;
  paused: boolean;
  skipping: boolean;
  setSpeed(n: number): void;
  togglePause(): void;
  skip(): void;
  update(dtReal: number): void;
  destroy(): void;
  onError?: (text: string) => void;
}
