import type { RegionId } from './regions.js';
import type { VehicleType } from './vehicles.js';
import type { WorkerTier } from './workers.js';
import type { ResourceType } from './resources.js';
import type { BuildingType } from './buildings.js';

export const ENTITY_NAMES = {
  realm: 'Realm',
  empire: 'Empire',
  region: 'Region',
  exchange: 'Exchange',
  keep: 'Keep',
  district: 'District',
  plot: 'Plot',
  buildingSlot: 'Building Slot',
  building: 'Building',
  caravan: 'Caravan',
  guild: 'Guild',
  worker: 'Worker',
} as const;

export const REGION_NAMES: Record<RegionId, string> = {
  CENTRAL:    'Central Region',
  EXTRACTION: 'Extraction Region',
  FARMING:    'Farming Region',
  CRAFTING:   'Crafting Region',
};

export const VEHICLE_NAMES: Record<VehicleType, string> = {
  CART:    'Cart',
  WAGON:   'Wagon',
  COURIER: 'Courier',
};

export const WORKER_TIER_NAMES: Record<WorkerTier, string> = {
  T1: 'Labourer',
  T2: 'Tradesman',
  T3: 'Technician',
};

export const RESOURCE_NAMES: Record<ResourceType, string> = {
  IRON_ORE: 'Iron Ore', COPPER_ORE: 'Copper Ore', TIN_ORE: 'Tin Ore',
  COAL: 'Coal', LIMESTONE: 'Limestone', SAND: 'Sand', WOOD: 'Wood', WATER: 'Water',
  GRAIN: 'Grain', VEGETABLES: 'Vegetables', COTTON: 'Cotton', COWS: 'Cows',
  HIDE: 'Hide', FERTILIZER: 'Fertilizer', MULES: 'Mules', HORSES: 'Horses', FEED: 'Feed',
  IRON_BARS: 'Iron Bars', COPPER_BARS: 'Copper Bars', BRONZE_BARS: 'Bronze Bars', CHARCOAL: 'Charcoal',
  BRICKS: 'Bricks', MORTAR: 'Mortar', TIMBER_FRAME: 'Timber Frame', SCAFFOLDING: 'Scaffolding',
  PLANKS: 'Planks', NAILS: 'Nails',
  RATIONS: 'Rations', DRINKING_WATER: 'Drinking Water', ALE: 'Ale',
  LEATHER: 'Leather', CLOTH: 'Cloth', PARCHMENT: 'Parchment', OVERALLS: 'Overalls',
  TOOLS: 'Tools', WHEELS: 'Wheels',
  BASIC_RESEARCH: 'Basic Research',
};

export const BUILDING_NAMES: Record<BuildingType, string> = {
  MINING_CAMP: 'Mining Camp', QUARRY: 'Quarry', LOGGING_CAMP: 'Logging Camp', WELL: 'Well',
  FARM: 'Farm', PASTURE: 'Pasture', RANCH: 'Ranch',
  SMITH: 'Smith',
  BUILDERS_YARD: "Builder's Yard", PERMIT_OFFICE: 'Permit Office',
  KITCHEN: 'Kitchen', PUB: 'Pub',
  TEXTILE_MILL: 'Textile Mill',
  WORKSHOP: 'Workshop',
  STUDY: 'Study',
  WAREHOUSE: 'Warehouse', HOUSING: 'Housing',
};

export const CHANNEL_NAMES = {
  GLOBAL: 'Global', GUILD: 'Guild', REGION: 'Region',
} as const;
