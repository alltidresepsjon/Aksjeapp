import type { WeaponId } from '../types';

export interface Weapon {
  id: WeaponId;
  name: string;
  /** Range in tiles. */
  range: number;
  /** Damage per hit at point blank. */
  dmg: number;
  /** Seconds between shots. */
  cd: number;
  /** Base hit chance before aim, distance and cover. */
  acc: number;
  mag: number;
  reload: number;
  /** Heat multiplier when fired, also how far the noise carries. */
  noise: number;
  price: number;
  /** Damage drops with distance (shotgun). */
  falloff: boolean;
  desc: string;
}

export const WEAPONS: Record<WeaponId, Weapon> = {
  fists: { id: 'fists', name: 'Bare Knuckles', range: 0.9, dmg: 6, cd: 0.8, acc: 0.8, mag: 99, reload: 0, noise: 0.2, price: 0, falloff: false, desc: 'Better than nothing. Barely.' },
  revolver: { id: 'revolver', name: 'Revolver', range: 5, dmg: 15, cd: 0.9, acc: 0.72, mag: 6, reload: 2, noise: 1, price: 60, falloff: false, desc: 'Reliable six-shooter. Fair range, fair punch.' },
  dual: { id: 'dual', name: 'Twin Pistols', range: 4.5, dmg: 11, cd: 0.42, acc: 0.58, mag: 14, reload: 2.4, noise: 1.3, price: 180, falloff: false, desc: 'A pistol in each hand. Lots of lead, little finesse.' },
  shotgun: { id: 'shotgun', name: 'Pump Shotgun', range: 3.2, dmg: 32, cd: 1.3, acc: 0.88, mag: 5, reload: 2.6, noise: 1.7, price: 220, falloff: true, desc: 'Devastating up close. Useless across the street.' },
  tommy: { id: 'tommy', name: 'Tommy Gun', range: 5.5, dmg: 8, cd: 0.12, acc: 0.42, mag: 50, reload: 3.2, noise: 3, price: 650, falloff: false, desc: 'The Chicago typewriter. Shreds a crowd; the whole city hears it.' },
  rifle: { id: 'rifle', name: 'Hunting Rifle', range: 9.5, dmg: 36, cd: 2.2, acc: 0.82, mag: 5, reload: 3, noise: 1.8, price: 380, falloff: false, desc: 'Reaches down the block. Slow, but one shot is often enough.' },
};

export const WEAPON_LIST: WeaponId[] = ['revolver', 'dual', 'shotgun', 'tommy', 'rifle'];
