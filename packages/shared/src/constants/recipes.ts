import { ResourceType, BuildingType } from '@merchant-realms/shared';

export interface RecipeInput {
  resource: ResourceType;
  quantity: number;
}

export interface Recipe {
  key: string;                      // unique — used in ProductionOrder.recipeKey
  buildingType: BuildingType;
  output: ResourceType;
  outputQty: number;                // base output per tick at level 1 with full workers
  inputs: RecipeInput[];
}

const r = ResourceType;
const b = BuildingType;

export const ALL_RECIPES: Recipe[] = [
  // ── Mining Camp ────────────────────────────────────────────────────────────
  { key: 'IRON_ORE',    buildingType: b.MINING_CAMP, output: r.IRON_ORE,    outputQty: 10, inputs: [] },
  { key: 'COPPER_ORE',  buildingType: b.MINING_CAMP, output: r.COPPER_ORE,  outputQty: 10, inputs: [] },
  { key: 'TIN_ORE',     buildingType: b.MINING_CAMP, output: r.TIN_ORE,     outputQty:  8, inputs: [] },
  { key: 'COAL',        buildingType: b.MINING_CAMP, output: r.COAL,        outputQty: 10, inputs: [] },

  // ── Quarry ─────────────────────────────────────────────────────────────────
  { key: 'LIMESTONE',   buildingType: b.QUARRY, output: r.LIMESTONE, outputQty: 10, inputs: [] },
  { key: 'SAND',        buildingType: b.QUARRY, output: r.SAND,      outputQty: 10, inputs: [] },

  // ── Logging Camp ──────────────────────────────────────────────────────────
  { key: 'WOOD',        buildingType: b.LOGGING_CAMP, output: r.WOOD, outputQty: 12, inputs: [] },

  // ── Well ──────────────────────────────────────────────────────────────────
  { key: 'WATER',       buildingType: b.WELL, output: r.WATER, outputQty: 15, inputs: [] },

  // ── Farm ──────────────────────────────────────────────────────────────────
  { key: 'GRAIN',      buildingType: b.FARM, output: r.GRAIN,      outputQty: 8, inputs: [{ resource: r.WATER, quantity: 3 }] },
  { key: 'VEGETABLES', buildingType: b.FARM, output: r.VEGETABLES, outputQty: 6, inputs: [{ resource: r.WATER, quantity: 2 }] },
  { key: 'COTTON',     buildingType: b.FARM, output: r.COTTON,     outputQty: 5, inputs: [{ resource: r.WATER, quantity: 2 }] },
  // Fertiliser-boosted alternates (higher output, extra input)
  { key: 'GRAIN_FERT',      buildingType: b.FARM, output: r.GRAIN,      outputQty: 14, inputs: [{ resource: r.WATER, quantity: 3 }, { resource: r.FERTILIZER, quantity: 1 }] },
  { key: 'VEGETABLES_FERT', buildingType: b.FARM, output: r.VEGETABLES, outputQty: 10, inputs: [{ resource: r.WATER, quantity: 2 }, { resource: r.FERTILIZER, quantity: 1 }] },
  { key: 'COTTON_FERT',     buildingType: b.FARM, output: r.COTTON,     outputQty:  8, inputs: [{ resource: r.WATER, quantity: 2 }, { resource: r.FERTILIZER, quantity: 1 }] },

  // ── Pasture ───────────────────────────────────────────────────────────────
  { key: 'MULES', buildingType: b.PASTURE, output: r.MULES, outputQty: 1, inputs: [{ resource: r.GRAIN, quantity: 3 }, { resource: r.WATER, quantity: 2 }] },
  { key: 'HORSES',buildingType: b.PASTURE, output: r.HORSES,outputQty: 1, inputs: [{ resource: r.GRAIN, quantity: 4 }, { resource: r.WATER, quantity: 2 }] },
  { key: 'FEED',  buildingType: b.PASTURE, output: r.FEED,  outputQty: 5, inputs: [{ resource: r.VEGETABLES, quantity: 2 }, { resource: r.WATER, quantity: 2 }] },

  // ── Ranch ─────────────────────────────────────────────────────────────────
  { key: 'COWS',       buildingType: b.RANCH, output: r.COWS,       outputQty: 1, inputs: [{ resource: r.WATER, quantity: 2 }, { resource: r.GRAIN, quantity: 3 }] },
  { key: 'HIDE',       buildingType: b.RANCH, output: r.HIDE,       outputQty: 2, inputs: [{ resource: r.COWS, quantity: 1 }] },
  { key: 'FERTILIZER', buildingType: b.RANCH, output: r.FERTILIZER, outputQty: 3, inputs: [{ resource: r.COWS, quantity: 1 }] },

  // ── Smith ─────────────────────────────────────────────────────────────────
  { key: 'IRON_BARS_COAL',     buildingType: b.SMITH, output: r.IRON_BARS,   outputQty: 4, inputs: [{ resource: r.IRON_ORE,   quantity: 5 }, { resource: r.COAL,     quantity: 3 }] },
  { key: 'IRON_BARS_CHAR',     buildingType: b.SMITH, output: r.IRON_BARS,   outputQty: 3, inputs: [{ resource: r.IRON_ORE,   quantity: 5 }, { resource: r.CHARCOAL, quantity: 5 }] },
  { key: 'COPPER_BARS_COAL',   buildingType: b.SMITH, output: r.COPPER_BARS, outputQty: 4, inputs: [{ resource: r.COPPER_ORE, quantity: 5 }, { resource: r.COAL,     quantity: 3 }] },
  { key: 'COPPER_BARS_CHAR',   buildingType: b.SMITH, output: r.COPPER_BARS, outputQty: 3, inputs: [{ resource: r.COPPER_ORE, quantity: 5 }, { resource: r.CHARCOAL, quantity: 5 }] },
  { key: 'BRONZE_BARS_COAL',   buildingType: b.SMITH, output: r.BRONZE_BARS, outputQty: 3, inputs: [{ resource: r.COPPER_ORE, quantity: 4 }, { resource: r.TIN_ORE, quantity: 4 }, { resource: r.COAL,     quantity: 3 }] },
  { key: 'BRONZE_BARS_CHAR',   buildingType: b.SMITH, output: r.BRONZE_BARS, outputQty: 2, inputs: [{ resource: r.COPPER_ORE, quantity: 4 }, { resource: r.TIN_ORE, quantity: 4 }, { resource: r.CHARCOAL, quantity: 5 }] },
  { key: 'CHARCOAL',           buildingType: b.SMITH, output: r.CHARCOAL,    outputQty: 4, inputs: [{ resource: r.WOOD, quantity: 5 }] },

  // ── Workshop ──────────────────────────────────────────────────────────────
  { key: 'PLANKS', buildingType: b.WORKSHOP, output: r.PLANKS, outputQty: 6, inputs: [{ resource: r.WOOD,      quantity: 4 }] },
  { key: 'NAILS',  buildingType: b.WORKSHOP, output: r.NAILS,  outputQty: 8, inputs: [{ resource: r.IRON_BARS, quantity: 2 }] },
  { key: 'TOOLS',  buildingType: b.WORKSHOP, output: r.TOOLS,  outputQty: 4, inputs: [{ resource: r.IRON_BARS, quantity: 3 }, { resource: r.PLANKS, quantity: 2 }] },
  { key: 'WHEELS', buildingType: b.WORKSHOP, output: r.WHEELS, outputQty: 2, inputs: [{ resource: r.IRON_BARS, quantity: 2 }, { resource: r.PLANKS, quantity: 3 }] },

  // ── Builder's Yard ────────────────────────────────────────────────────────
  { key: 'BRICKS',       buildingType: b.BUILDERS_YARD, output: r.BRICKS,       outputQty: 6, inputs: [{ resource: r.LIMESTONE, quantity: 4 }, { resource: r.WATER, quantity: 2 }] },
  { key: 'MORTAR',       buildingType: b.BUILDERS_YARD, output: r.MORTAR,       outputQty: 4, inputs: [{ resource: r.SAND,      quantity: 3 }, { resource: r.LIMESTONE, quantity: 2 }, { resource: r.WATER, quantity: 2 }] },
  { key: 'TIMBER_FRAME', buildingType: b.BUILDERS_YARD, output: r.TIMBER_FRAME, outputQty: 2, inputs: [{ resource: r.PLANKS,    quantity: 4 }, { resource: r.NAILS, quantity: 3 }] },
  { key: 'SCAFFOLDING',  buildingType: b.BUILDERS_YARD, output: r.SCAFFOLDING,  outputQty: 1, inputs: [{ resource: r.IRON_BARS, quantity: 2 }, { resource: r.NAILS, quantity: 4 }, { resource: r.PLANKS, quantity: 3 }] },

  // ── Kitchen ───────────────────────────────────────────────────────────────
  { key: 'RATIONS', buildingType: b.KITCHEN, output: r.RATIONS, outputQty: 5, inputs: [{ resource: r.GRAIN, quantity: 4 }, { resource: r.VEGETABLES, quantity: 3 }] },

  // ── Pub ───────────────────────────────────────────────────────────────────
  { key: 'DRINKING_WATER', buildingType: b.PUB, output: r.DRINKING_WATER, outputQty: 4, inputs: [{ resource: r.WATER, quantity: 2 }] },
  { key: 'ALE',            buildingType: b.PUB, output: r.ALE,            outputQty: 3, inputs: [{ resource: r.WATER, quantity: 2 }, { resource: r.GRAIN, quantity: 2 }] },

  // ── Textile Mill ─────────────────────────────────────────────────────────
  { key: 'LEATHER',   buildingType: b.TEXTILE_MILL, output: r.LEATHER,   outputQty: 3, inputs: [{ resource: r.HIDE,    quantity: 2 }] },
  { key: 'CLOTH',     buildingType: b.TEXTILE_MILL, output: r.CLOTH,     outputQty: 4, inputs: [{ resource: r.COTTON,  quantity: 3 }] },
  { key: 'PARCHMENT', buildingType: b.TEXTILE_MILL, output: r.PARCHMENT, outputQty: 3, inputs: [{ resource: r.LEATHER, quantity: 2 }] },
  { key: 'OVERALLS',  buildingType: b.TEXTILE_MILL, output: r.OVERALLS,  outputQty: 2, inputs: [{ resource: r.LEATHER, quantity: 2 }, { resource: r.CLOTH, quantity: 2 }] },

  // ── Study ─────────────────────────────────────────────────────────────────
  { key: 'BASIC_RESEARCH', buildingType: b.STUDY, output: r.BASIC_RESEARCH, outputQty: 2, inputs: [{ resource: r.PARCHMENT, quantity: 3 }] },
];

// Fast lookup indexes
export const RECIPES_BY_BUILDING = ALL_RECIPES.reduce<Record<string, Recipe[]>>((acc, r) => {
  (acc[r.buildingType] ??= []).push(r);
  return acc;
}, {});

export const RECIPE_BY_KEY = ALL_RECIPES.reduce<Record<string, Recipe>>((acc, r) => {
  acc[r.key] = r;
  return acc;
}, {});
