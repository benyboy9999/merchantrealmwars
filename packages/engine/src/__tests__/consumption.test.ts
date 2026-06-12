import { describe, it, expect } from 'vitest';
import { calculateConsumption } from '../consumption/index.js';
import { ResourceType, WorkerTier } from '@merchant-realms/shared';

describe('calculateConsumption', () => {
  it('returns no penalty when all necessary needs are met', () => {
    const result = calculateConsumption(
      [
        {
          tier: WorkerTier.T1,
          count: 10,
          needs: [
            { resourceType: ResourceType.RATIONS, quantityPerWorker: 1, isNecessary: true },
          ],
        },
      ],
      [{ resourceType: ResourceType.RATIONS, available: 100 }],
    );

    expect(result.penaltyFactor).toBe(1);
    expect(result.unmetNecessary).toHaveLength(0);
    expect(result.resourcesConsumed).toEqual([
      { resourceType: ResourceType.RATIONS, quantity: 10 },
    ]);
  });

  it('applies a 15% penalty per unmet necessary need', () => {
    const result = calculateConsumption(
      [
        {
          tier: WorkerTier.T1,
          count: 10,
          needs: [
            { resourceType: ResourceType.RATIONS, quantityPerWorker: 1, isNecessary: true },
          ],
        },
      ],
      [{ resourceType: ResourceType.RATIONS, available: 0 }],
    );

    expect(result.penaltyFactor).toBeCloseTo(0.85);
    expect(result.unmetNecessary).toContain(ResourceType.RATIONS);
  });

  it('stacks penalties for multiple unmet necessary needs', () => {
    const result = calculateConsumption(
      [
        {
          tier: WorkerTier.T1,
          count: 5,
          needs: [
            { resourceType: ResourceType.RATIONS, quantityPerWorker: 1, isNecessary: true },
            { resourceType: ResourceType.FEED, quantityPerWorker: 1, isNecessary: true },
          ],
        },
      ],
      [],
    );

    expect(result.penaltyFactor).toBeCloseTo(0.7); // 1 - 2 * 0.15
    expect(result.unmetNecessary).toHaveLength(2);
  });

  it('applies a 5% bonus per met optional need', () => {
    const result = calculateConsumption(
      [
        {
          tier: WorkerTier.T1,
          count: 5,
          needs: [
            {
              resourceType: ResourceType.ALE,
              quantityPerWorker: 1,
              isNecessary: false,
            },
          ],
        },
      ],
      [{ resourceType: ResourceType.ALE, available: 100 }],
    );

    expect(result.bonusFactor).toBeCloseTo(1.05);
    expect(result.metOptional).toContain(ResourceType.ALE);
  });

  it('caps bonus factor at 1.5', () => {
    const needs = Array.from({ length: 20 }, (_, i) => ({
      resourceType: ResourceType.ALE,
      quantityPerWorker: 1,
      isNecessary: false,
    }));

    const result = calculateConsumption(
      [{ tier: WorkerTier.T1, count: 1, needs }],
      [{ resourceType: ResourceType.ALE, available: 1000 }],
    );

    expect(result.bonusFactor).toBeLessThanOrEqual(1.5);
  });

  it('does not apply penalty for unmet optional needs', () => {
    const result = calculateConsumption(
      [
        {
          tier: WorkerTier.T1,
          count: 5,
          needs: [
            {
              resourceType: ResourceType.ALE,
              quantityPerWorker: 1,
              isNecessary: false,
            },
          ],
        },
      ],
      [],
    );

    expect(result.penaltyFactor).toBe(1);
    expect(result.bonusFactor).toBe(1);
  });

  it('handles empty worker list', () => {
    const result = calculateConsumption([], []);
    expect(result.penaltyFactor).toBe(1);
    expect(result.bonusFactor).toBe(1);
    expect(result.resourcesConsumed).toHaveLength(0);
  });
});
