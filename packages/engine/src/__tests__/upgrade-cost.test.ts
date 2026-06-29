import { describe, it, expect } from 'vitest';
import { calculateUpgradeCost, calculateUpgradeHealth } from '../production/upgrade-cost.js';

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

describe('calculateUpgradeHealth', () => {
  it('matches the worked example: Lv3 at 80% → Lv4 = 85%', () => {
    // (80 × 3 + 100) / 4 = 340 / 4 = 85
    expect(calculateUpgradeHealth(80, 3)).toBe(85);
  });

  it('upgrading a fully healthy building stays at 100%', () => {
    expect(calculateUpgradeHealth(100, 1)).toBe(100);
    expect(calculateUpgradeHealth(100, 10)).toBe(100);
  });

  it('upgrading a damaged building dilutes the damage without fully recovering it', () => {
    // Lv1 at 50% → Lv2: (50 + 100) / 2 = 75%
    expect(calculateUpgradeHealth(50, 1)).toBe(75);
  });

  it('result is always clamped between 0 and 100', () => {
    const result = calculateUpgradeHealth(0, 1);
    expect(result).toBeGreaterThanOrEqual(0);
    expect(result).toBeLessThanOrEqual(100);
  });
});
