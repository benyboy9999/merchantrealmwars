import { describe, it, expect } from 'vitest';
import { calculateConsumption, calculateOverheadFactor } from '../consumption/index.js';
import { ResourceType, WorkerTier } from '@merchant-realms/shared';

describe('calculateConsumption', () => {
  it('returns no penalty when all necessary needs are met', () => {
    const result = calculateConsumption(
      [
        {
          tier: WorkerTier.T1,
          count: 10,
          needs: [
            { resourceType: ResourceType.BASIC_RATION, quantityPerWorker: 1, isNecessary: true },
          ],
        },
      ],
      [{ resourceType: ResourceType.BASIC_RATION, available: 100 }],
    );

    expect(result.penaltyFactor).toBe(1);
    expect(result.unmetNecessary).toHaveLength(0);
    expect(result.resourcesConsumed).toEqual([
      { resourceType: ResourceType.BASIC_RATION, quantity: 10 },
    ]);
  });

  it('applies a 15% penalty per unmet necessary need', () => {
    const result = calculateConsumption(
      [
        {
          tier: WorkerTier.T1,
          count: 10,
          needs: [
            { resourceType: ResourceType.BASIC_RATION, quantityPerWorker: 1, isNecessary: true },
          ],
        },
      ],
      [{ resourceType: ResourceType.BASIC_RATION, available: 0 }],
    );

    expect(result.penaltyFactor).toBeCloseTo(0.85);
    expect(result.unmetNecessary).toContain(ResourceType.BASIC_RATION);
  });

  it('stacks penalties for multiple unmet necessary needs', () => {
    const result = calculateConsumption(
      [
        {
          tier: WorkerTier.T1,
          count: 5,
          needs: [
            { resourceType: ResourceType.BASIC_RATION, quantityPerWorker: 1, isNecessary: true },
            { resourceType: ResourceType.BASIC_ANIMAL_FEED, quantityPerWorker: 1, isNecessary: true },
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

  describe('calculateOverheadFactor', () => {
    const THRESHOLD = 2000;
    const PENALTY   = 0.0001;
    const MAX       = 3;

    it('returns 1.0 when workforce is at or below threshold', () => {
      expect(calculateOverheadFactor(0,    THRESHOLD, PENALTY, MAX)).toBe(1);
      expect(calculateOverheadFactor(1999, THRESHOLD, PENALTY, MAX)).toBe(1);
      expect(calculateOverheadFactor(2000, THRESHOLD, PENALTY, MAX)).toBe(1);
    });

    it('increases consumption proportionally above threshold', () => {
      // 2000 excess × 0.0001 = 0.2 increase → 1.2×
      expect(calculateOverheadFactor(4000, THRESHOLD, PENALTY, MAX)).toBeCloseTo(1.2);
      // 8000 excess × 0.0001 = 0.8 increase → 1.8×
      expect(calculateOverheadFactor(10000, THRESHOLD, PENALTY, MAX)).toBeCloseTo(1.8);
    });

    it('caps at maxMultiplier regardless of workforce size', () => {
      expect(calculateOverheadFactor(9999999, THRESHOLD, PENALTY, MAX)).toBe(MAX);
    });
  });

  describe('multi-tier consumption', () => {
    it('consumes resources from both T1 and T2 groups independently', () => {
      const result = calculateConsumption(
        [
          {
            tier: WorkerTier.T1,
            count: 10,
            needs: [{ resourceType: ResourceType.BASIC_RATION, quantityPerWorker: 1, isNecessary: true }],
          },
          {
            tier: WorkerTier.T2,
            count: 5,
            needs: [{ resourceType: ResourceType.FINE_RATIONS, quantityPerWorker: 1, isNecessary: true }],
          },
        ],
        [
          { resourceType: ResourceType.BASIC_RATION, available: 100 },
          { resourceType: ResourceType.FINE_RATIONS, available: 100 },
        ],
      );

      expect(result.penaltyFactor).toBe(1);
      expect(result.unmetNecessary).toHaveLength(0);
      expect(result.resourcesConsumed).toEqual(
        expect.arrayContaining([
          { resourceType: ResourceType.BASIC_RATION, quantity: 10 },
          { resourceType: ResourceType.FINE_RATIONS, quantity: 5 },
        ]),
      );
    });

    it('applies penalty when a higher tier necessary need is unmet, even if T1 is fully met', () => {
      const result = calculateConsumption(
        [
          {
            tier: WorkerTier.T1,
            count: 10,
            needs: [{ resourceType: ResourceType.BASIC_RATION, quantityPerWorker: 1, isNecessary: true }],
          },
          {
            tier: WorkerTier.T2,
            count: 5,
            needs: [{ resourceType: ResourceType.FINE_RATIONS, quantityPerWorker: 1, isNecessary: true }],
          },
        ],
        [
          { resourceType: ResourceType.BASIC_RATION, available: 100 },
          { resourceType: ResourceType.FINE_RATIONS, available: 0 },
        ],
      );

      expect(result.penaltyFactor).toBeCloseTo(0.85);
      expect(result.unmetNecessary).toContain(ResourceType.FINE_RATIONS);
    });

    it('T1 consumption depletes the shared pool before T2 tries to draw from the same resource', () => {
      // Both tiers need BASIC_RATION; T1 uses all of it
      const result = calculateConsumption(
        [
          {
            tier: WorkerTier.T1,
            count: 10,
            needs: [{ resourceType: ResourceType.BASIC_RATION, quantityPerWorker: 1, isNecessary: true }],
          },
          {
            tier: WorkerTier.T2,
            count: 5,
            needs: [{ resourceType: ResourceType.BASIC_RATION, quantityPerWorker: 1, isNecessary: true }],
          },
        ],
        [{ resourceType: ResourceType.BASIC_RATION, available: 10 }],
      );

      // T1 consumes all 10; T2 finds 0 remaining → penalty
      expect(result.penaltyFactor).toBeCloseTo(0.85);
      expect(result.unmetNecessary).toContain(ResourceType.BASIC_RATION);
      const ration = result.resourcesConsumed.find(r => r.resourceType === ResourceType.BASIC_RATION);
      expect(ration?.quantity).toBe(10);
    });

    it('accumulates bonus from optional needs met across multiple tiers', () => {
      const result = calculateConsumption(
        [
          {
            tier: WorkerTier.T1,
            count: 5,
            needs: [{ resourceType: ResourceType.ALE, quantityPerWorker: 1, isNecessary: false }],
          },
          {
            tier: WorkerTier.T2,
            count: 5,
            needs: [{ resourceType: ResourceType.COFFEE, quantityPerWorker: 1, isNecessary: false }],
          },
        ],
        [
          { resourceType: ResourceType.ALE, available: 100 },
          { resourceType: ResourceType.COFFEE, available: 100 },
        ],
      );

      // 2 optional needs met → 1.10 bonus
      expect(result.bonusFactor).toBeCloseTo(1.10);
      expect(result.metOptional).toContain(ResourceType.ALE);
      expect(result.metOptional).toContain(ResourceType.COFFEE);
    });
  });
});
