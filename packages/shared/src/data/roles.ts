import type { Spec, StatKey, WeaponId } from '../types';

export interface RoleDef {
  role: string;
  spec: Spec;
  ranges: Record<StatKey, [number, number]>;
  weapon: WeaponId;
  blurb: string[];
  weight: number;
}

export const ROLES: RoleDef[] = [
  { role: 'Bruiser', spec: 'none', weight: 3, weapon: 'shotgun', ranges: { muscle: [4, 7], aim: [1, 3], charm: [1, 2], stealth: [1, 2] }, blurb: ['Big hands, few words. Breaks things on request.', 'Former dockworker. Lifts crates and grudges.'] },
  { role: 'Gunman', spec: 'none', weight: 3, weapon: 'revolver', ranges: { muscle: [2, 4], aim: [4, 7], charm: [1, 2], stealth: [1, 3] }, blurb: ['Steady aim, quiet afterwards.', 'Won a shooting medal in France. Wants to use it.'] },
  { role: 'Talker', spec: 'none', weight: 2, weapon: 'revolver', ranges: { muscle: [1, 2], aim: [1, 3], charm: [4, 7], stealth: [1, 3] }, blurb: ['Can sell ice in January. Shopkeepers love to pay.', 'Smiles like a priest, collects like a landlord.'] },
  { role: 'Shadow', spec: 'none', weight: 2, weapon: 'revolver', ranges: { muscle: [1, 3], aim: [2, 4], charm: [1, 3], stealth: [4, 7] }, blurb: ['Never seen, never charged. Keeps the heat down.', 'Walks through a crowd like smoke.'] },
  { role: 'Safecracker', spec: 'safecracker', weight: 1, weapon: 'revolver', ranges: { muscle: [1, 2], aim: [1, 3], charm: [1, 3], stealth: [3, 6] }, blurb: ['Fingertips sanded smooth. Listens to tumblers like music.'] },
  { role: 'Arsonist', spec: 'arsonist', weight: 1, weapon: 'revolver', ranges: { muscle: [2, 4], aim: [1, 3], charm: [1, 2], stealth: [3, 5] }, blurb: ['Smells faintly of kerosene. Always.'] },
  { role: 'Hitman', spec: 'hitman', weight: 1, weapon: 'rifle', ranges: { muscle: [2, 4], aim: [5, 8], charm: [1, 2], stealth: [4, 7] }, blurb: ['One name, one shot, no questions.'] },
  { role: 'Card Sharp', spec: 'cardsharp', weight: 1, weapon: 'revolver', ranges: { muscle: [1, 2], aim: [1, 3], charm: [5, 8], stealth: [2, 4] }, blurb: ['Deals from the bottom, hears everything at the table.'] },
  { role: 'Fixer', spec: 'fixer', weight: 1, weapon: 'revolver', ranges: { muscle: [1, 2], aim: [1, 2], charm: [5, 8], stealth: [2, 4] }, blurb: ['Knows every clerk, cop and cousin in town.'] },
];

export const SPEC_INFO: Record<Spec, { name: string; ability: string }> = {
  none: { name: 'Soldier', ability: '' },
  safecracker: { name: 'Safecracker', ability: 'Cracks safes in banks and rival headquarters (at night).' },
  arsonist: { name: 'Arsonist', ability: 'Torches rival buildings. Loud, but very effective.' },
  hitman: { name: 'Hitman', ability: 'Hard to spot. First shot on an unaware target hits three times as hard.' },
  cardsharp: { name: 'Card Sharp', ability: 'Wins money at casinos and gambling dens, and picks up rumours about rival movements.' },
  fixer: { name: 'Fixer', ability: 'Bribes 40% cheaper, bail half price, can spring crew from jail.' },
};
