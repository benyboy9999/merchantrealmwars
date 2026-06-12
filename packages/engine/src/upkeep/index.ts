import type { ResourceType, BuildingType } from '@merchant-realms/shared';

export interface UpkeepRequirement {
  resourceType: ResourceType;
  quantityPerTick: number;
}

export interface BuildingUpkeepState {
  buildingId: string;
  buildingType: BuildingType;
  tier: number;
}

export interface UpkeepAvailability {
  resourceType: ResourceType;
  available: number;
}

export interface UpkeepResult {
  buildingId: string;
  isDormant: boolean; // true if upkeep could not be met
  resourcesConsumed: Array<{ resourceType: ResourceType; quantity: number }>;
}

/**
 * Determine whether a building's upkeep can be met and what resources are consumed.
 * If upkeep cannot be met, building goes dormant (stops producing).
 * Pure function — no side effects.
 */
export function calculateUpkeep(
  building: BuildingUpkeepState,
  _requirements: UpkeepRequirement[],
  available: UpkeepAvailability[],
): UpkeepResult {
  // Stub until resource graph finalises upkeep costs per building type.
  // Real implementation: look up requirements by buildingType + tier,
  // check availability, deduct, return dormant=true if any requirement unmet.
  void building;
  void available;

  return {
    buildingId: building.buildingId,
    isDormant: false,
    resourcesConsumed: [],
  };
}
