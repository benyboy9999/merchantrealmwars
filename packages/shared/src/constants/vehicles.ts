export const VehicleType = {
  CART: 'CART',
  WAGON: 'WAGON',
  COURIER: 'COURIER',
} as const;

export type VehicleType = (typeof VehicleType)[keyof typeof VehicleType];

export const CaravanStatus = {
  IDLE: 'IDLE',
  IN_TRANSIT: 'IN_TRANSIT',
} as const;

export type CaravanStatus = (typeof CaravanStatus)[keyof typeof CaravanStatus];

export const CaravanLocationType = {
  KEEP: 'KEEP',
  EXCHANGE: 'EXCHANGE',
  PLOT: 'PLOT',
} as const;

export type CaravanLocationType = (typeof CaravanLocationType)[keyof typeof CaravanLocationType];

// Capacity in kg per mule. 1 mule = 100 kg.
export const MULE_CAPACITY_KG = 100;
