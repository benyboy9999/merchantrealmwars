export const VehicleType = {
  CART: 'CART',
  WAGON: 'WAGON',
  COURIER: 'COURIER',
} as const;

export type VehicleType = (typeof VehicleType)[keyof typeof VehicleType];

export const CaravanStatus = {
  IN_TRANSIT: 'IN_TRANSIT',
  ARRIVED: 'ARRIVED',
  CANCELLED: 'CANCELLED',
} as const;

export type CaravanStatus = (typeof CaravanStatus)[keyof typeof CaravanStatus];

export const CaravanLocationType = {
  KEEP: 'KEEP',
  EXCHANGE: 'EXCHANGE',
} as const;

export type CaravanLocationType = (typeof CaravanLocationType)[keyof typeof CaravanLocationType];
