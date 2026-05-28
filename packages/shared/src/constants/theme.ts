// Single source of truth for all player-facing display names.
// Never hardcode display strings anywhere else in the codebase.

import type { RegionId } from './regions.js';
import type { VehicleType } from './vehicles.js';
import type { WorkerTier } from './workers.js';

export const ENTITY_NAMES = {
  realm: 'Realm',
  empire: 'Empire',
  region: 'Region',
  exchange: 'Exchange',
  keep: 'Keep',
  plot: 'Plot',
  buildingSlot: 'Building Slot',
  building: 'Building',
  caravan: 'Caravan',
  guild: 'Guild',
  worker: 'Worker',
} as const;

export const REGION_NAMES: Record<RegionId, string> = {
  CENTRAL: 'Central Region',
  EXTRACTION: 'Extraction Region',
  FARMING: 'Farming Region',
  CRAFTING: 'Crafting Region',
};

export const VEHICLE_NAMES: Record<VehicleType, string> = {
  CART: 'Cart',
  WAGON: 'Wagon',
  COURIER: 'Courier',
};

export const WORKER_TIER_NAMES: Record<WorkerTier, string> = {
  T1: 'Labourer',        // Housing name TBD — placeholder
  T2: 'Craftsman',       // Housing name TBD — placeholder
  T3: 'Master',          // Housing name TBD — placeholder
};

export const CHANNEL_NAMES = {
  GLOBAL: 'Global',
  GUILD: 'Guild',
  REGION: 'Region',
} as const;
