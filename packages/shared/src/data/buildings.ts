import type { BType, Racket } from '../types';

export interface BTypeDef {
  name: string;
  /** Legal income per day when owned (paid hourly during opening hours). */
  income: number;
  /** Price to buy legally from an independent owner (0 = not for sale). */
  price: number;
  /** Can host a racket behind its front. */
  front: boolean;
  /** Can be extorted / taken over at all. */
  business: boolean;
  floors: [number, number];
  icon: string;
  /** Visual style key used by the client art generator. */
  look: string;
}

export const BTYPES: Record<BType, BTypeDef> = {
  hq: { name: 'Headquarters', income: 60, price: 0, front: false, business: true, floors: [3, 4], icon: '★', look: 'hq' },
  bakery: { name: 'Bakery', income: 45, price: 380, front: true, business: true, floors: [1, 3], icon: '🥖', look: 'shop' },
  barber: { name: 'Barbershop', income: 45, price: 360, front: true, business: true, floors: [1, 3], icon: '💈', look: 'shop' },
  laundry: { name: 'Laundry', income: 50, price: 400, front: true, business: true, floors: [2, 4], icon: '🧺', look: 'shop' },
  pawn: { name: 'Pawn & Guns', income: 60, price: 480, front: false, business: true, floors: [2, 4], icon: '🔫', look: 'shop' },
  diner: { name: 'Diner', income: 55, price: 420, front: true, business: true, floors: [1, 2], icon: '☕', look: 'diner' },
  tailor: { name: 'Tailor', income: 50, price: 400, front: true, business: true, floors: [2, 4], icon: '🧵', look: 'shop' },
  grocer: { name: 'Grocery', income: 50, price: 380, front: true, business: true, floors: [1, 3], icon: '🍎', look: 'shop' },
  garage: { name: 'Garage', income: 70, price: 650, front: true, business: true, floors: [1, 1], icon: '🔧', look: 'garage' },
  warehouse: { name: 'Warehouse', income: 70, price: 700, front: true, business: true, floors: [1, 3], icon: '📦', look: 'warehouse' },
  club: { name: 'Jazz Club', income: 120, price: 1100, front: false, business: true, floors: [2, 3], icon: '🎷', look: 'club' },
  casino: { name: 'Casino', income: 160, price: 0, front: false, business: true, floors: [3, 4], icon: '🎲', look: 'club' },
  hotel: { name: 'Hotel', income: 110, price: 1300, front: true, business: true, floors: [5, 7], icon: '🛎', look: 'hotel' },
  bank: { name: 'Savings Bank', income: 0, price: 0, front: false, business: false, floors: [3, 3], icon: '🏦', look: 'bank' },
  precinct: { name: 'Police Precinct', income: 0, price: 0, front: false, business: false, floors: [3, 3], icon: '🚔', look: 'precinct' },
  cityhall: { name: 'City Hall', income: 0, price: 0, front: false, business: false, floors: [4, 4], icon: '🏛', look: 'civic' },
  courthouse: { name: 'Courthouse', income: 0, price: 0, front: false, business: false, floors: [3, 3], icon: '⚖', look: 'civic' },
  church: { name: 'Church', income: 0, price: 0, front: false, business: false, floors: [3, 3], icon: '✝', look: 'church' },
  pier: { name: 'Smugglers\' Pier', income: 30, price: 500, front: false, business: true, floors: [1, 1], icon: '⚓', look: 'pier' },
  tenement: { name: 'Tenement', income: 0, price: 0, front: false, business: false, floors: [3, 6], icon: '🏠', look: 'tenement' },
  park: { name: 'Park', income: 0, price: 0, front: false, business: false, floors: [0, 0], icon: '🌳', look: 'park' },
  plaza: { name: 'Square', income: 0, price: 0, front: false, business: false, floors: [0, 0], icon: '⛲', look: 'plaza' },
  water: { name: 'Harbor', income: 0, price: 0, front: false, business: false, floors: [0, 0], icon: '🌊', look: 'water' },
};

export interface RacketDef { name: string; income: number; setup: number; desc: string; needsStock: boolean }

/** Night income per day for rackets (paid hourly between 20:00 and 04:00). */
export const RACKETS: Record<Racket, RacketDef> = {
  speakeasy: { name: 'Speakeasy', income: 260, setup: 300, desc: 'Back-room bar. Needs crates of liquor, sells them at night.', needsStock: true },
  still: { name: 'Distillery', income: 60, setup: 400, desc: 'Bathtub gin, brewed in the basement. Makes 3 crates a night.', needsStock: false },
  gambling: { name: 'Gambling Den', income: 220, setup: 350, desc: 'Dice and cards behind the curtain. No supply needed.', needsStock: false },
};

export const OFFICIALS = {
  precinct: { cost: 220, days: 2, who: 'precinct captain', effect: 'Heat −40 for the whole crew, no raids or manhunts for 2 days.' },
  cityhall: { cost: 400, days: 3, who: 'alderman', effect: 'Legal purchases 30% cheaper and fewer raids for 3 days.' },
  courthouse: { cost: 320, days: 3, who: 'judge', effect: 'Everyone in jail released now; bail waived for 3 days.' },
} as const;

const SHOP_NAMES: Partial<Record<BType, string[]>> = {
  bakery: ["{p}'s Bakery", 'Golden Crust Bakery', 'Morning Loaf', 'Halloran Bread Co.'],
  barber: ["{p}'s Barbershop", 'Sharp & Sons Barbers', 'The Close Shave', 'Mercer Tonsorial'],
  laundry: ['Lucky Wash Laundry', "{p}'s Laundry", 'Steam & Starch', 'Snow White Laundry'],
  pawn: ["{p}'s Pawn & Guns", 'Second Chance Pawn', 'Harbor Loans & Arms'],
  diner: ["{p}'s Diner", 'The Blue Plate', 'Night Owl Diner', 'Corner Coffee Counter'],
  tailor: ["{p} & Co. Tailors", 'Fine Cut Tailoring', 'The Pinstripe'],
  grocer: ["{p}'s Grocery", 'Fresh Market', 'Five-Cent Grocer'],
  garage: ["{p}'s Garage", 'Halloran Motor Works', 'Dockside Auto'],
  warehouse: ['Pier Street Storage', 'Halloran Freight', 'Consolidated Crates', 'Lakeside Cold Store'],
  club: ['The Blue Heron', 'Velvet Lantern', 'The Gilded Cage', 'Club Midnight'],
  casino: ['Lucky Seven', 'The Ace of Clubs', 'Golden Wheel'],
  hotel: ['Hotel Majestic', 'The Halloran Arms', 'Grand Lakeview'],
  bank: ['First Halloran Savings', 'Lakeshore Trust'],
  church: ["St. Brendan's", "Our Lady of the Harbor"],
  tenement: ['Tenements'],
  pier: ['Pier 9'],
};

export function shopName(type: BType, proprietor: string, i: number): string {
  const list = SHOP_NAMES[type];
  if (!list) return BTYPES[type].name;
  return list[i % list.length].replace('{p}', proprietor);
}
