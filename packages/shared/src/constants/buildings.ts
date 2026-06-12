export const BuildingType = {
  // T1 — Resource Extraction
  MINING_CAMP:  'MINING_CAMP',
  QUARRY:       'QUARRY',
  LOGGING_CAMP: 'LOGGING_CAMP',
  WELL:         'WELL',

  // T1 — Agriculture
  FARM:    'FARM',
  PASTURE: 'PASTURE',
  RANCH:   'RANCH',

  // T1 — Metallurgy
  SMITH: 'SMITH',

  // T1 — Construction
  BUILDERS_YARD: 'BUILDERS_YARD',
  PERMIT_OFFICE: 'PERMIT_OFFICE',

  // T1 — Food Production
  KITCHEN: 'KITCHEN',
  PUB:     'PUB',

  // T1 — Textiles
  TEXTILE_MILL: 'TEXTILE_MILL',

  // T1 — Manufacturing
  WORKSHOP: 'WORKSHOP',

  // T1 — Research
  STUDY: 'STUDY',

  // Infrastructure (any tier)
  WAREHOUSE: 'WAREHOUSE',
  HOUSING:   'HOUSING',
} as const;

export type BuildingType = (typeof BuildingType)[keyof typeof BuildingType];

// Which tier a building type belongs to — used for construction cost gating
export const BUILDING_TIER: Record<BuildingType, 1 | 2 | 3> = {
  MINING_CAMP:   1, QUARRY:       1, LOGGING_CAMP: 1, WELL:    1,
  FARM:          1, PASTURE:      1, RANCH:        1,
  SMITH:         1,
  BUILDERS_YARD: 1, PERMIT_OFFICE: 1,
  KITCHEN:       1, PUB:          1,
  TEXTILE_MILL:  1,
  WORKSHOP:      1,
  STUDY:         1,
  WAREHOUSE:     1, HOUSING:      1,
};

// Base workers required at level 1 (multiplied by building level)
export const BUILDING_BASE_WORKERS: Record<BuildingType, number> = {
  MINING_CAMP:   4, QUARRY:       4, LOGGING_CAMP: 3, WELL:    1,
  FARM:          3, PASTURE:      2, RANCH:        3,
  SMITH:         3,
  BUILDERS_YARD: 3, PERMIT_OFFICE: 1,
  KITCHEN:       2, PUB:          2,
  TEXTILE_MILL:  3,
  WORKSHOP:      3,
  STUDY:         2,
  WAREHOUSE:     1, HOUSING:      0,
};

// Base housing capacity at level 1 (Housing buildings only, multiplied by level)
export const HOUSING_BASE_CAPACITY = 10;

// Workers consumed per building level (all production buildings, flat rate)
export const WORKERS_PER_LEVEL = 5;

// Base warehouse weight capacity at level 1 (multiplied by level)
export const WAREHOUSE_BASE_CAPACITY = 500;

// Base Keep storage capacity (before any warehouses)
export const KEEP_BASE_STORAGE = 200;

// Resources required in caravan cargo to found a new keep at a plot
export const KEEP_FOUNDING_COST: Array<{ resource: string; quantity: number }> = [
  { resource: 'WOOD',      quantity: 5 },
  { resource: 'LIMESTONE', quantity: 5 },
];

// Construction costs (WOOD + LIMESTONE) for each building type — flat rate for pilot
export const BUILDING_CONSTRUCTION_COSTS: Record<BuildingType, Array<{ resource: string; quantity: number }>> = {
  MINING_CAMP:   [{ resource: 'WOOD', quantity: 5 }, { resource: 'LIMESTONE', quantity: 5 }],
  QUARRY:        [{ resource: 'WOOD', quantity: 5 }, { resource: 'LIMESTONE', quantity: 5 }],
  LOGGING_CAMP:  [{ resource: 'WOOD', quantity: 5 }, { resource: 'LIMESTONE', quantity: 5 }],
  WELL:          [{ resource: 'WOOD', quantity: 5 }, { resource: 'LIMESTONE', quantity: 5 }],
  FARM:          [{ resource: 'WOOD', quantity: 5 }, { resource: 'LIMESTONE', quantity: 5 }],
  PASTURE:       [{ resource: 'WOOD', quantity: 5 }, { resource: 'LIMESTONE', quantity: 5 }],
  RANCH:         [{ resource: 'WOOD', quantity: 5 }, { resource: 'LIMESTONE', quantity: 5 }],
  SMITH:         [{ resource: 'WOOD', quantity: 5 }, { resource: 'LIMESTONE', quantity: 5 }],
  BUILDERS_YARD: [{ resource: 'WOOD', quantity: 5 }, { resource: 'LIMESTONE', quantity: 5 }],
  PERMIT_OFFICE: [{ resource: 'WOOD', quantity: 5 }, { resource: 'LIMESTONE', quantity: 5 }],
  KITCHEN:       [{ resource: 'WOOD', quantity: 5 }, { resource: 'LIMESTONE', quantity: 5 }],
  PUB:           [{ resource: 'WOOD', quantity: 5 }, { resource: 'LIMESTONE', quantity: 5 }],
  TEXTILE_MILL:  [{ resource: 'WOOD', quantity: 5 }, { resource: 'LIMESTONE', quantity: 5 }],
  WORKSHOP:      [{ resource: 'WOOD', quantity: 5 }, { resource: 'LIMESTONE', quantity: 5 }],
  STUDY:         [{ resource: 'WOOD', quantity: 5 }, { resource: 'LIMESTONE', quantity: 5 }],
  WAREHOUSE:     [{ resource: 'WOOD', quantity: 5 }, { resource: 'LIMESTONE', quantity: 5 }],
  HOUSING:       [{ resource: 'WOOD', quantity: 5 }, { resource: 'LIMESTONE', quantity: 5 }],
};
