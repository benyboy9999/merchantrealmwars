import type { VehicleType, ResourceType } from '@merchant-realms/shared';

export interface VehicleStats {
  speedUnitsPerSecond: number;
  capacityUnits: number;
  fuelCostPerUnit: number; // FEED consumed per distance unit
  durabilityLossPerTrip: number; // 0–100
}

// Base stats per vehicle type. Upgrades modify these multiplicatively.
export const BASE_VEHICLE_STATS: Record<VehicleType, VehicleStats> = {
  CART: {
    speedUnitsPerSecond: 1,
    capacityUnits: 50,
    fuelCostPerUnit: 0.5,
    durabilityLossPerTrip: 5,
  },
  WAGON: {
    speedUnitsPerSecond: 0.7,
    capacityUnits: 200,
    fuelCostPerUnit: 1.2,
    durabilityLossPerTrip: 8,
  },
  COURIER: {
    speedUnitsPerSecond: 3,
    capacityUnits: 20,
    fuelCostPerUnit: 0.8,
    durabilityLossPerTrip: 3,
  },
};

export interface TravelTimeParams {
  vehicleType: VehicleType;
  distanceUnits: number;
  speedMultiplier?: number; // from upgrades
}

export interface TravelCostParams {
  vehicleType: VehicleType;
  distanceUnits: number;
  fuelEfficiencyMultiplier?: number; // from upgrades
}

export interface TravelTimeResult {
  travelSeconds: number;
  arrivalTimestamp: Date;
}

export interface TravelCostResult {
  feedRequired: number;
  durabilityLost: number;
  canAfford: boolean;
  currentFuel: number;
}

/**
 * Calculate travel time for a caravan dispatch.
 * Pure function — no side effects.
 */
export function calculateTravelTime(
  params: TravelTimeParams,
  departureTime: Date,
): TravelTimeResult {
  const stats = BASE_VEHICLE_STATS[params.vehicleType];
  const effectiveSpeed = stats.speedUnitsPerSecond * (params.speedMultiplier ?? 1);
  const travelSeconds = Math.ceil(params.distanceUnits / effectiveSpeed);
  const arrivalTimestamp = new Date(departureTime.getTime() + travelSeconds * 1000);

  return { travelSeconds, arrivalTimestamp };
}

/**
 * Calculate the fuel and durability cost for a trip.
 * Pure function — no side effects.
 */
export function calculateTravelCost(
  params: TravelCostParams,
  currentFuel: number,
): TravelCostResult {
  const stats = BASE_VEHICLE_STATS[params.vehicleType];
  const feedRequired = Math.ceil(
    params.distanceUnits * stats.fuelCostPerUnit * (1 / (params.fuelEfficiencyMultiplier ?? 1)),
  );
  const durabilityLost = stats.durabilityLossPerTrip;

  return {
    feedRequired,
    durabilityLost,
    canAfford: currentFuel >= feedRequired,
    currentFuel,
  };
}

export type { ResourceType };
