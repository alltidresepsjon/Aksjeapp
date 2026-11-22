import type { VModel } from '../types';

export interface VehicleDef {
  id: VModel;
  name: string;
  seats: number;
  cargo: number;
  speed: number;
  hp: number;
  price: number;
  desc: string;
}

export const VEHICLES: Record<VModel, VehicleDef> = {
  roadster: { id: 'roadster', name: 'Roadster', seats: 2, cargo: 2, speed: 6.2, hp: 120, price: 450, desc: 'Fast two-seater. Good for getaways.' },
  sedan: { id: 'sedan', name: 'Touring Sedan', seats: 4, cargo: 4, speed: 5.2, hp: 170, price: 600, desc: 'Four seats, wide windows: made for drive-bys.' },
  truck: { id: 'truck', name: 'Delivery Truck', seats: 2, cargo: 14, speed: 3.8, hp: 220, price: 700, desc: '"Fresh Bread" on the side, fourteen crates of gin in the back.' },
  armored: { id: 'armored', name: 'Armored Limousine', seats: 4, cargo: 2, speed: 4.4, hp: 420, price: 1600, desc: 'Steel plates and bulletproof glass.' },
};

export const VEHICLE_LIST: VModel[] = ['roadster', 'sedan', 'truck', 'armored'];
