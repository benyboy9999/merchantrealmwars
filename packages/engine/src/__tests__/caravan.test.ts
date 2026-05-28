import { describe, it, expect } from 'vitest';
import { calculateTravelTime, calculateTravelCost } from '../caravan/index.js';

describe('calculateTravelTime', () => {
  it('calculates arrival time for a cart', () => {
    const departure = new Date('2024-01-01T00:00:00Z');
    const result = calculateTravelTime(
      { vehicleType: 'CART', distanceUnits: 10 },
      departure,
    );

    expect(result.travelSeconds).toBe(10); // 10 units / 1 unit/sec
    expect(result.arrivalTimestamp.getTime()).toBe(departure.getTime() + 10_000);
  });

  it('couriers travel faster than carts', () => {
    const departure = new Date('2024-01-01T00:00:00Z');
    const cartResult = calculateTravelTime({ vehicleType: 'CART', distanceUnits: 30 }, departure);
    const courierResult = calculateTravelTime({ vehicleType: 'COURIER', distanceUnits: 30 }, departure);

    expect(courierResult.travelSeconds).toBeLessThan(cartResult.travelSeconds);
  });

  it('applies speed multiplier from upgrades', () => {
    const departure = new Date('2024-01-01T00:00:00Z');
    const base = calculateTravelTime({ vehicleType: 'CART', distanceUnits: 10 }, departure);
    const upgraded = calculateTravelTime(
      { vehicleType: 'CART', distanceUnits: 10, speedMultiplier: 2 },
      departure,
    );

    expect(upgraded.travelSeconds).toBeLessThan(base.travelSeconds);
  });
});

describe('calculateTravelCost', () => {
  it('returns canAfford=true when fuel is sufficient', () => {
    const result = calculateTravelCost({ vehicleType: 'CART', distanceUnits: 10 }, 100);
    expect(result.canAfford).toBe(true);
    expect(result.feedRequired).toBeGreaterThan(0);
  });

  it('returns canAfford=false when fuel is insufficient', () => {
    const result = calculateTravelCost({ vehicleType: 'CART', distanceUnits: 100 }, 0);
    expect(result.canAfford).toBe(false);
  });

  it('wagons consume more fuel per unit than carts', () => {
    const cartCost = calculateTravelCost({ vehicleType: 'CART', distanceUnits: 10 }, 1000);
    const wagonCost = calculateTravelCost({ vehicleType: 'WAGON', distanceUnits: 10 }, 1000);
    expect(wagonCost.feedRequired).toBeGreaterThan(cartCost.feedRequired);
  });
});
