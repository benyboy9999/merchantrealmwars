import { z } from 'zod';
import raw from './gamedata.json' with { type: 'json' };

// ── Zod schema — validates at module load, crashes with a clear message if data is wrong ──

const CostSchema = z.object({ resource: z.string(), quantity: z.number().int().positive() });

const ResourceSchema = z.object({
  name:     z.string(),
  weightKg: z.number().positive(),
});

const BuildingSchema = z.object({
  name:                   z.string(),
  tier:                   z.union([z.literal(1), z.literal(2), z.literal(3)]),
  workerCostPerLevel:     z.number().int().min(0),
  constructionCost:       z.array(CostSchema),
  housingCapacityPerLevel: z.number().int().optional(),
  storageCapacityPerLevel: z.number().int().optional(),
});

const RecipeSchema = z.object({
  key:          z.string(),
  category:     z.enum(['EXTRACTION', 'FARMING', 'METALLURGY', 'CONSTRUCTION', 'FOOD', 'CRAFTING', 'ALCHEMY', 'RESEARCH', 'COMBAT']),
  timeMinutes:  z.number().positive(),
  reqTech:      z.number().int().min(0),
  buildingType: z.string(),
  output:       z.string(),
  outputQty:    z.number().positive(),
  inputs:       z.array(CostSchema),
});

const WorkerNeedSchema = z.object({
  resource:         z.string(),
  quantityPerCycle: z.number().positive(),
  necessary:        z.boolean(),
});

const GameDataSchema = z.object({
  resources:   z.record(ResourceSchema),
  buildings:   z.record(BuildingSchema),
  recipes:     z.array(RecipeSchema),
  animals:     z.record(z.object({ name: z.string(), capacityKg: z.number().positive() })),
  workerTiers: z.record(z.object({ name: z.string(), needs: z.array(WorkerNeedSchema) })),
  regions:     z.record(z.object({ name: z.string(), bonusType: z.string(), guildControllable: z.boolean() })),
  techLevelCosts: z.array(z.object({ resource: z.string(), quantity: z.number().int().positive() })),
  starterBonus:   z.array(z.object({ maxDaysAge: z.number().int().positive(), speedMultiplier: z.number().positive() })),
  constants:   z.object({
    keepBaseStorageKg:        z.number(),
    warehouseStoragePerLevel: z.number().int(),
    housingWorkersPerLevel:   z.number().int(),
    defaultWorkersPerLevel:   z.number().int(),
    muleCapacityKg:           z.number(),
    consumptionCycleMinutes:  z.number().positive(),
    maxBuildingSlots:         z.number().int(),
    defaultBuildingSlots:     z.number().int(),
    slotUnlockResource:       z.string(),
    keepFoundingCost:         z.array(CostSchema),
    buildingDecayPerCycle:        z.number().positive(),
    buildingDurabilityThreshold:  z.number().min(0).max(100),
    buildingDurabilityFloor:      z.number().min(0).max(100),
    overheadThreshold:        z.number().int().positive(),
    overheadPenaltyPerUnit:   z.number().positive(),
    overheadMaxMultiplier:    z.number().min(1),
    overheadWeightT1:         z.number().int().positive(),
    overheadWeightT2:         z.number().int().positive(),
    overheadWeightT3:         z.number().int().positive(),
  }),
});

export const gamedata = GameDataSchema.parse(raw);

// ── Derived TypeScript types — update automatically when you add keys to gamedata.json ──

export type ResourceType  = keyof typeof raw.resources;
export type BuildingType  = keyof typeof raw.buildings;
export type RegionId      = keyof typeof raw.regions;
export type WorkerTier    = keyof typeof raw.workerTiers;

// Enum-like objects so existing code using ResourceType.WOOD, BuildingType.MINING_CAMP etc. still works
export const ResourceType  = Object.fromEntries(Object.keys(raw.resources).map(k  => [k, k])) as { [K in ResourceType]:  K };
export const BuildingType  = Object.fromEntries(Object.keys(raw.buildings).map(k  => [k, k])) as { [K in BuildingType]:  K };
export const RegionId      = Object.fromEntries(Object.keys(raw.regions).map(k    => [k, k])) as { [K in RegionId]:      K };
export const WorkerTier    = Object.fromEntries(Object.keys(raw.workerTiers).map(k => [k, k])) as { [K in WorkerTier]:   K };

export type RegionBonusType = typeof raw.regions[RegionId]['bonusType'];
export const RegionBonusType = Object.fromEntries(
  [...new Set(Object.values(raw.regions).map(r => r.bonusType))].map(t => [t, t])
) as Record<RegionBonusType, RegionBonusType>;

// ── Named constants (same names as before — zero import changes needed elsewhere) ──

export const RESOURCE_NAMES = Object.fromEntries(
  Object.entries(gamedata.resources).map(([k, v]) => [k, v.name])
) as Record<ResourceType, string>;

export const RESOURCE_WEIGHT = Object.fromEntries(
  Object.entries(gamedata.resources).map(([k, v]) => [k, v.weightKg])
) as Record<ResourceType, number>;

export const BUILDING_NAMES = Object.fromEntries(
  Object.entries(gamedata.buildings).map(([k, v]) => [k, v.name])
) as Record<BuildingType, string>;

export const BUILDING_TIER = Object.fromEntries(
  Object.entries(gamedata.buildings).map(([k, v]) => [k, v.tier])
) as Record<BuildingType, 1 | 2 | 3>;

export const BUILDING_CONSTRUCTION_COSTS = Object.fromEntries(
  Object.entries(gamedata.buildings).map(([k, v]) => [k, v.constructionCost])
) as Record<BuildingType, Array<{ resource: string; quantity: number }>>;

export const BUILDING_WORKER_COST = Object.fromEntries(
  Object.entries(gamedata.buildings).map(([k, v]) => [k, v.workerCostPerLevel])
) as Record<BuildingType, number>;

// Per-building housing capacity — only housing building types have a value here
export const HOUSING_CAPACITY_PER_LEVEL = Object.fromEntries(
  Object.entries(gamedata.buildings)
    .filter(([, v]) => v.housingCapacityPerLevel !== undefined)
    .map(([k, v]) => [k, v.housingCapacityPerLevel!]),
) as Partial<Record<BuildingType, number>>;

export const OVERHEAD_CONSTANTS = {
  threshold:      gamedata.constants.overheadThreshold,
  penaltyPerUnit: gamedata.constants.overheadPenaltyPerUnit,
  maxMultiplier:  gamedata.constants.overheadMaxMultiplier,
} as const;

export const OVERHEAD_TIER_WEIGHTS: Record<WorkerTier, number> = {
  T1: gamedata.constants.overheadWeightT1,
  T2: gamedata.constants.overheadWeightT2,
  T3: gamedata.constants.overheadWeightT3,
};

export const DURABILITY_CONSTANTS = {
  decayPerCycle: gamedata.constants.buildingDecayPerCycle,
  threshold:     gamedata.constants.buildingDurabilityThreshold,
  floor:         gamedata.constants.buildingDurabilityFloor,
} as const;

export const WORKERS_PER_LEVEL:     number = gamedata.constants.defaultWorkersPerLevel;
export const HOUSING_BASE_CAPACITY: number = gamedata.constants.housingWorkersPerLevel;
export const WAREHOUSE_BASE_CAPACITY: number = gamedata.constants.warehouseStoragePerLevel;
export const KEEP_BASE_STORAGE:     number = gamedata.constants.keepBaseStorageKg;
export const MULE_CAPACITY_KG:           number = gamedata.constants.muleCapacityKg;
export const KEEP_FOUNDING_COST = gamedata.constants.keepFoundingCost;
export const KEEP_MAX_BUILDING_SLOTS:    number = gamedata.constants.maxBuildingSlots;
export const KEEP_DEFAULT_BUILDING_SLOTS: number = gamedata.constants.defaultBuildingSlots;
export const KEEP_SLOT_UNLOCK_RESOURCE: ResourceType = gamedata.constants.slotUnlockResource as ResourceType;

export const REGION_NAMES = Object.fromEntries(
  Object.entries(gamedata.regions).map(([k, v]) => [k, v.name])
) as Record<RegionId, string>;

export const REGION_METADATA = Object.fromEntries(
  Object.entries(gamedata.regions).map(([k, v]) => [k, { bonusType: v.bonusType as RegionBonusType, guildControllable: v.guildControllable }])
) as Record<RegionId, { bonusType: RegionBonusType; guildControllable: boolean }>;

// ── Region DB IDs — single source of truth for integer PK assignment ─────────
// Region.id in the database is an integer. These constants map region codes to
// their assigned IDs. The seed uses these to create Region rows with explicit IDs.
export const REGION_IDS = {
  CENTRAL: 1,
  NE:      2,
  NW:      3,
  SW:      4,
  SE:      5,
} as const;

export const REGION_CODE_BY_ID: Record<number, RegionId> = Object.fromEntries(
  Object.entries(REGION_IDS).map(([code, id]) => [id, code as RegionId])
);

export const WORKER_TIER_NAMES = Object.fromEntries(
  Object.entries(gamedata.workerTiers).map(([k, v]) => [k, v.name])
) as Record<WorkerTier, string>;

export const WORKER_TIERS_ORDERED: WorkerTier[] = ['T1', 'T2', 'T3'];

// ── Worker consumption ───────────────────────────────────────────────────────

export interface WorkerNeed {
  resourceType: ResourceType;
  quantityPerCycle: number;
  isNecessary: boolean;
}

export const BASE_CYCLE_SECONDS: number = gamedata.constants.consumptionCycleMinutes * 60;

export const WORKER_NEEDS: Record<WorkerTier, WorkerNeed[]> = Object.fromEntries(
  Object.entries(gamedata.workerTiers).map(([tier, data]) => [
    tier,
    data.needs.map((n) => ({
      resourceType:     n.resource as ResourceType,
      quantityPerCycle: n.quantityPerCycle,
      isNecessary:      n.necessary,
    })),
  ]),
) as Record<WorkerTier, WorkerNeed[]>;

export const T1_WORKER_NEEDS: WorkerNeed[] = WORKER_NEEDS['T1'] ?? [];

// ── Recipe types and lookups ─────────────────────────────────────────────────

export type RecipeCategory = 'EXTRACTION' | 'FARMING' | 'METALLURGY' | 'CONSTRUCTION' | 'FOOD' | 'CRAFTING' | 'ALCHEMY' | 'RESEARCH' | 'COMBAT';

export interface RecipeInput {
  resource: ResourceType;
  quantity: number;
}

export interface Recipe {
  key:          string;
  category:     RecipeCategory;
  timeMinutes:  number;
  reqTech:      number;
  buildingType: BuildingType;
  output:       ResourceType;
  outputQty:    number;
  inputs:       RecipeInput[];
}

export const ALL_RECIPES: Recipe[] = gamedata.recipes as Recipe[];

export const RECIPES_BY_BUILDING: Record<string, Recipe[]> = ALL_RECIPES.reduce<Record<string, Recipe[]>>((acc, r) => {
  (acc[r.buildingType] ??= []).push(r);
  return acc;
}, {});

export const RECIPE_BY_KEY: Record<string, Recipe> = ALL_RECIPES.reduce<Record<string, Recipe>>((acc, r) => {
  acc[r.key] = r;
  return acc;
}, {});

// ── Tech & starter bonus ─────────────────────────────────────────────────────

export interface TechLevelCost { resource: ResourceType; quantity: number; }

export const TECH_LEVEL_COSTS: TechLevelCost[] = gamedata.techLevelCosts.map(c => ({
  resource: c.resource as ResourceType,
  quantity: c.quantity,
}));

export interface StarterBonusTier { maxDaysAge: number; speedMultiplier: number; }

export const STARTER_BONUS_TIERS: StarterBonusTier[] = gamedata.starterBonus;

export function getStarterSpeedMultiplier(empireAgeDays: number): number {
  for (const tier of STARTER_BONUS_TIERS) {
    if (empireAgeDays <= tier.maxDaysAge) return tier.speedMultiplier;
  }
  return 1;
}

// ── Caravan / vehicle types (code contracts — not in JSON) ───────────────────

export const CaravanStatus = { IDLE: 'IDLE', IN_TRANSIT: 'IN_TRANSIT' } as const;
export type CaravanStatus = (typeof CaravanStatus)[keyof typeof CaravanStatus];

export const CaravanLocationType = { KEEP: 'KEEP', EXCHANGE: 'EXCHANGE', PLOT: 'PLOT' } as const;
export type CaravanLocationType = (typeof CaravanLocationType)[keyof typeof CaravanLocationType];

export const VehicleType = { CART: 'CART', WAGON: 'WAGON', COURIER: 'COURIER' } as const;
export type VehicleType = (typeof VehicleType)[keyof typeof VehicleType];

// ── Entity / channel display names (UI strings) ──────────────────────────────

export const ENTITY_NAMES = {
  realm: 'Realm', empire: 'Empire', region: 'Region', exchange: 'Exchange',
  keep: 'Keep', plot: 'Plot', buildingSlot: 'Building Slot', building: 'Building',
  caravan: 'Caravan', guild: 'Guild', worker: 'Worker',
} as const;

export const CHANNEL_NAMES = { GLOBAL: 'Global', GUILD: 'Guild', REGION: 'Region' } as const;
