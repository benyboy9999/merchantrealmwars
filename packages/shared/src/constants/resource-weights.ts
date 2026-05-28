import type { ResourceType } from './resources.js';

// Weight per unit. Used to calculate Keep storage usage.
// Heavier goods are harder to stockpile — creates strategic storage trade-offs.
export const RESOURCE_WEIGHT: Record<ResourceType, number> = {
  // Raw heavy
  IRON_ORE:     1.0,
  COPPER_ORE:   1.0,
  TIN_ORE:      1.0,
  COAL:         0.8,
  LIMESTONE:    1.0,
  SAND:         0.8,
  WOOD:         0.6,
  WATER:        0.5,

  // Agricultural light
  GRAIN:        0.1,
  VEGETABLES:   0.2,
  COTTON:       0.2,
  COWS:         3.0,
  HIDE:         0.3,
  FERTILIZER:   0.3,
  MULES:        4.0,
  HORSES:       5.0,
  FEED:         0.2,

  // Processed metals — heavy
  IRON_BARS:    1.5,
  COPPER_BARS:  1.5,
  BRONZE_BARS:  1.8,
  CHARCOAL:     0.4,

  // Construction materials
  BRICKS:       1.2,
  MORTAR:       0.8,
  TIMBER_FRAME: 1.0,
  SCAFFOLDING:  1.5,
  PLANKS:       0.5,
  NAILS:        0.3,

  // Food & drink
  RATIONS:        0.1,
  DRINKING_WATER: 0.1,
  ALE:            0.15,

  // Textiles — light
  LEATHER:   0.3,
  CLOTH:     0.1,
  PARCHMENT: 0.05,
  OVERALLS:  0.1,

  // Tools
  TOOLS:  0.1,
  WHEELS: 0.8,

  // Research (weightless)
  BASIC_RESEARCH: 0.01,
};
