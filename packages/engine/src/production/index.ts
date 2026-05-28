import type { ResourceType, BuildingType, WorkerTier } from '@artemis/shared';

export interface FacilityState {
  buildingType: BuildingType;
  tier: number;
  workerCount: number;
  workerTier: WorkerTier;
  isActive: boolean;
  isDormant: boolean;
}

export interface ProductionInput {
  resourceType: ResourceType;
  quantityRequired: number;
  available: number;
}

export interface ProductionOutput {
  resourceType: ResourceType;
  quantity: number;
}

export interface ProductionResult {
  outputs: ProductionOutput[];
  inputsConsumed: ProductionOutput[];
  efficiencyFactor: number; // 0–1, affected by worker penalties
}

export interface ProductionConfig {
  regionBonus: number; // multiplier e.g. 1.5 for bonus region
  workerPenaltyFactor: number; // 0–1 from consumption system
  workerBonusFactor: number; // >=1 from optional consumption
}

/**
 * Compute the production output for a single facility in one tick.
 * Pure function — no DB calls, no side effects.
 */
export function computeProduction(
  facility: FacilityState,
  _inputs: ProductionInput[],
  config: ProductionConfig,
): ProductionResult {
  if (!facility.isActive || facility.isDormant || facility.workerCount === 0) {
    return { outputs: [], inputsConsumed: [], efficiencyFactor: 0 };
  }

  const efficiency = config.workerPenaltyFactor * config.workerBonusFactor * config.regionBonus;

  // Recipe resolution is a stub until the resource graph is finalised.
  // Real implementation: look up recipe by buildingType + tier, multiply by workers * efficiency.
  return {
    outputs: [],
    inputsConsumed: [],
    efficiencyFactor: Math.min(1, efficiency),
  };
}
