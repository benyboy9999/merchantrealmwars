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

// ── Building type DB IDs — single source of truth ────────────────────────────
// Building.buildingTypeId in the database is an integer.
// These constants map BuildingType codes to their assigned IDs.
export const BUILDING_TYPE_IDS: Record<BuildingType, number> = {
  MINING_CAMP:           1,
  QUARRY:                2,
  WELL:                  3,
  FARM:                  4,
  PASTURE:               5,
  RANCH:                 6,
  HYDROPONICS_LAB:       7,
  BLACKSMITH:            8,
  SMELTER:               9,
  FORGE:                 10,
  ALCHEMY_TENT:          11,
  APOTHECARY:            12,
  ALCHEMIST_LAB:         13,
  KITCHEN:               14,
  PUB:                   15,
  RESTAURANT:            16,
  DISTILLERY:            17,
  GRAND_KITCHEN:         18,
  TEXTILE_MILL:          19,
  WORKSHOP:              20,
  ATELIER:               21,
  BUILDERS_YARD:         22,
  CONSTRUCTION_WORKSHOP: 23,
  MASTER_BUILDERS_YARD:  24,
  PERMIT_OFFICE:         25,
  STUDY:                 26,
  SCRIPTORIUM:           27,
  UNIVERSITY:            28,
  ARMOURY:               29,
  SIEGE_WORKS:           30,
  WAR_FORGE:             31,
  WAREHOUSE:             32,
  HOUSING:               33,
  TENEMENTS:             34,
  MANOR:                 35,
} as const;

export const BUILDING_TYPE_BY_ID: Record<number, BuildingType> = Object.fromEntries(
  Object.entries(BUILDING_TYPE_IDS).map(([code, id]) => [id, code as BuildingType])
);

// ── Recipe DB IDs — single source of truth ───────────────────────────────────
// ProductionOrder.recipeId and ProductionTask.recipeId in the database are integers.
export type RecipeKey = (typeof raw.recipes)[number]['key'];

export const RECIPE_IDS: Record<RecipeKey, number> = {
  mine_iron_ore:         1,
  mine_copper_ore:       2,
  mine_aluminium_ore:    3,
  mine_raw_coal:         4,
  quarry_limestone:      5,
  quarry_sand:           6,
  quarry_stone:          7,
  quarry_salt:           8,
  quarry_crystal:        9,
  well_water:            10,
  farm_grain:            11,
  farm_grain_fert:       12,
  farm_vegetables:       13,
  farm_vegetables_fert:  14,
  farm_cotton:           15,
  farm_cotton_fert:      16,
  farm_oak:              17,
  farm_oak_fert:         18,
  farm_sugar_beets:      19,
  farm_sugar_beets_fert: 20,
  farm_fruit:            21,
  farm_fruit_fert:       22,
  pasture_mule:          23,
  pasture_horse:         24,
  ranch_cow:             25,
  ranch_chicken:         26,
  ranch_hide:            27,
  ranch_milk:            28,
  ranch_meat_cow:        29,
  ranch_egg:             30,
  ranch_meat_chicken:    31,
  hydro_coffee_beans:    32,
  hydro_walnut:          33,
  alch_coal:             34,
  alch_flux:             35,
  alch_fertilizer:       36,
  alch_sugar:            37,
  alch_dye:              38,
  alch_tar:              39,
  apoth_walnut_oil:      40,
  apoth_medicine:        41,
  apoth_reagent:         42,
  lab_advanced_reagent:  43,
  lab_elixir:            44,
  smith_iron_bar:        45,
  smith_copper_bar:      46,
  smith_aluminium_bar:   47,
  smith_glass:           48,
  smith_wire:            49,
  smith_pipe:            50,
  smelt_steel_bar:       51,
  smelt_cast_iron:       52,
  smelt_brass_bar:       53,
  smelt_steel_plate:     54,
  forge_masterwork_steel: 55,
  kitchen_basic_ration:  56,
  kitchen_animal_feed:   57,
  kitchen_flour:         58,
  kitchen_cheese:        59,
  pub_drinking_water:    60,
  pub_ale:               61,
  rest_fine_rations:     62,
  rest_pie:              63,
  rest_filtered_water:   64,
  rest_coffee:           65,
  dist_wine:             66,
  dist_spirits:          67,
  gk_feast:              68,
  gk_field_rations:      69,
  mill_leather:          70,
  mill_cloth:            71,
  mill_parchment:        72,
  mill_overalls:         73,
  mill_canvas:           74,
  mill_fine_cloth:       75,
  mill_fine_leather:     76,
  ws_oak_planks:         77,
  ws_rope:               78,
  ws_screws:             79,
  ws_tools:              80,
  ws_furniture:          81,
  ws_wheels:             82,
  ws_filter:             83,
  ws_saddle:             84,
  ws_pannier:            85,
  ws_walnut_planks:      86,
  ws_advanced_tools:     87,
  ws_rebar:              88,
  ws_truss:              89,
  ws_fine_furniture:     90,
  ws_cart:               91,
  ws_wagon:              92,
  atelier_fine_instruments: 93,
  atelier_luxury_goods:  94,
  atelier_masterwork_tools: 95,
  build_mortar:          96,
  build_cobblestone:     97,
  build_construction_kit: 98,
  build_amenities:       99,
  cw_reinforced_concrete: 100,
  cw_stone_block:        101,
  cw_advanced_kit:       102,
  cw_advanced_amenities: 103,
  mb_steel_frame:        104,
  mb_precision_fittings: 105,
  mb_master_kit:         106,
  mb_master_amenities:   107,
  permit_basic:          108,
  permit_t2:             109,
  permit_t3:             110,
  permit_t4:             111,
  study_basic_research:  112,
  script_advanced_research: 113,
  uni_expert_research:   114,
  uni_master_research:   115,
  arm_spear:             116,
  arm_bow:               117,
  arm_battering_ram:     118,
  arm_siege_writ:        119,
  sw_steel_sword:        120,
  sw_crossbow:           121,
  sw_ballista:           122,
  wf_elite_weapon:       123,
  wf_siege_equipment:    124,
} as const;

export const RECIPE_BY_ID: Record<number, RecipeKey> = Object.fromEntries(
  Object.entries(RECIPE_IDS).map(([key, id]) => [id, key as RecipeKey])
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
