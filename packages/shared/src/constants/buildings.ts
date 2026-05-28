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

// Base warehouse weight capacity at level 1 (multiplied by level)
export const WAREHOUSE_BASE_CAPACITY = 500;

// Base Keep storage capacity (before any warehouses)
export const KEEP_BASE_STORAGE = 200;
