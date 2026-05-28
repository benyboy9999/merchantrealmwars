import type { ResourceType, WorkerTier } from '@artemis/shared';

export interface ConsumptionNeed {
  resourceType: ResourceType;
  quantityPerWorker: number;
  isNecessary: boolean; // false = optional (bonus if met, no penalty if not)
}

export interface WorkerGroupState {
  tier: WorkerTier;
  count: number;
  needs: ConsumptionNeed[];
}

export interface ResourceAvailability {
  resourceType: ResourceType;
  available: number;
}

export interface ConsumptionResult {
  resourcesConsumed: Array<{ resourceType: ResourceType; quantity: number }>;
  penaltyFactor: number; // 0–1 multiplier applied to production (1 = no penalty)
  bonusFactor: number;   // >=1 multiplier applied to production (1 = no bonus)
  unmetNecessary: ResourceType[];
  metOptional: ResourceType[];
}

/**
 * Calculate worker consumption for one tick and derive production modifiers.
 * Each unmet necessary need applies a stacking penalty.
 * Each met optional need applies a stacking bonus.
 * Pure function — no side effects.
 */
export function calculateConsumption(
  workers: WorkerGroupState[],
  available: ResourceAvailability[],
): ConsumptionResult {
  const availabilityMap = new Map(available.map((a) => [a.resourceType, a.available]));
  const consumed: Map<ResourceType, number> = new Map();
  const unmetNecessary: ResourceType[] = [];
  const metOptional: ResourceType[] = [];

  for (const group of workers) {
    const totalWorkers = group.count;
    for (const need of group.needs) {
      const required = need.quantityPerWorker * totalWorkers;
      const avail = availabilityMap.get(need.resourceType) ?? 0;

      if (avail >= required) {
        consumed.set(need.resourceType, (consumed.get(need.resourceType) ?? 0) + required);
        availabilityMap.set(need.resourceType, avail - required);
        if (!need.isNecessary) metOptional.push(need.resourceType);
      } else if (need.isNecessary) {
        // Consume what's available, mark as unmet
        consumed.set(need.resourceType, (consumed.get(need.resourceType) ?? 0) + avail);
        availabilityMap.set(need.resourceType, 0);
        unmetNecessary.push(need.resourceType);
      }
      // Optional unmet: no penalty, no consumption
    }
  }

  // Each unmet necessary need reduces penalty factor by 15% (stacking)
  const penaltyFactor = Math.max(0, 1 - unmetNecessary.length * 0.15);
  // Each met optional need adds 5% bonus (stacking, capped at +50%)
  const bonusFactor = Math.min(1.5, 1 + metOptional.length * 0.05);

  return {
    resourcesConsumed: Array.from(consumed.entries()).map(([resourceType, quantity]) => ({
      resourceType,
      quantity,
    })),
    penaltyFactor,
    bonusFactor,
    unmetNecessary,
    metOptional,
  };
}
