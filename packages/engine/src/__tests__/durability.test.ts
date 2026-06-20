import { describe, it, expect } from 'vitest';
import { calculateDurabilityFactor, calculateRepairCost } from '../production/durability.js';

const THRESHOLD = 80;

describe('calculateDurabilityFactor', () => {
  it('returns 1.0 at or above the penalty threshold', () => {
    expect(calculateDurabilityFactor(100, THRESHOLD)).toBe(1);
    expect(calculateDurabilityFactor(80,  THRESHOLD)).toBe(1);
    expect(calculateDurabilityFactor(95,  THRESHOLD)).toBe(1);
  });

  it('returns a linear fraction below the threshold', () => {
    expect(calculateDurabilityFactor(40, THRESHOLD)).toBeCloseTo(0.5);
    expect(calculateDurabilityFactor(60, THRESHOLD)).toBeCloseTo(0.75);
  });

  it('returns the correct factor at the durability floor (50%)', () => {
    // 50 / 80 = 0.625
    expect(calculateDurabilityFactor(50, THRESHOLD)).toBeCloseTo(0.625);
  });
});

describe('calculateRepairCost', () => {
  const baseCost = [
    { resource: 'CONSTRUCTION_KIT', quantity: 56 },
    { resource: 'COBBLESTONE',      quantity: 24 },
  ];

  it('returns empty array when building is at full health', () => {
    expect(calculateRepairCost(baseCost, 10, 100)).toHaveLength(0);
  });

  it('matches the spec example: level 10 at 90% health', () => {
    // missing 10% → 56×10×0.10 = 56, 24×10×0.10 = 24
    const cost = calculateRepairCost(baseCost, 10, 90);
    expect(cost).toEqual([
      { resource: 'CONSTRUCTION_KIT', quantity: 56 },
      { resource: 'COBBLESTONE',      quantity: 24 },
    ]);
  });

  it('scales with building level', () => {
    // level 1 at 90% → 56×1×0.10 = 5.6 → ceiled to 6
    const cost = calculateRepairCost(baseCost, 1, 90);
    expect(cost.find(c => c.resource === 'CONSTRUCTION_KIT')?.quantity).toBe(6);
  });

  it('repairs from floor (50%) cost 50% of full construction cost × level', () => {
    const cost = calculateRepairCost(baseCost, 10, 50);
    // 56×10×0.50 = 280, 24×10×0.50 = 120
    expect(cost).toEqual([
      { resource: 'CONSTRUCTION_KIT', quantity: 280 },
      { resource: 'COBBLESTONE',      quantity: 120 },
    ]);
  });

  it('ceils fractional quantities', () => {
    const oddCost = [{ resource: 'STONE', quantity: 7 }];
    // level 1 at 90% → 7×1×0.10 = 0.7 → ceiled to 1
    const cost = calculateRepairCost(oddCost, 1, 90);
    expect(cost[0]?.quantity).toBe(1);
  });
});
