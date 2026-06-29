import { describe, it, expect } from 'vitest';
import { calculateUpgradeCost } from '../production/upgrade-cost.js';

const BASE_COST = [
  { resource: 'CONSTRUCTION_KIT', quantity: 8 },
  { resource: 'COBBLESTONE',      quantity: 12 },
];

describe('calculateUpgradeCost', () => {
  it('returns a copy of construction cost at level 1', () => {
    const result = calculateUpgradeCost(BASE_COST, 1);
    expect(result).toEqual(BASE_COST);
    expect(result).not.toBe(BASE_COST);
  });

  it('returns the same cost at every level (placeholder behaviour)', () => {
    const level1 = calculateUpgradeCost(BASE_COST, 1);
    const level4 = calculateUpgradeCost(BASE_COST, 4);
    expect(level1).toEqual(level4);
  });

  it('returns empty array for a free building', () => {
    expect(calculateUpgradeCost([], 1)).toEqual([]);
  });
});
