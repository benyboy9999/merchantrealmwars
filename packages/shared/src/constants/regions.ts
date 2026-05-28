export const RegionId = {
  CENTRAL: 'CENTRAL',
  EXTRACTION: 'EXTRACTION',
  FARMING: 'FARMING',
  CRAFTING: 'CRAFTING',
} as const;

export type RegionId = (typeof RegionId)[keyof typeof RegionId];

export const RegionBonusType = {
  NONE: 'NONE',
  EXTRACTION: 'EXTRACTION',
  FARMING: 'FARMING',
  CRAFTING: 'CRAFTING',
} as const;

export type RegionBonusType = (typeof RegionBonusType)[keyof typeof RegionBonusType];

export const REGION_METADATA: Record<
  RegionId,
  { bonusType: RegionBonusType; guildControllable: boolean }
> = {
  [RegionId.CENTRAL]: { bonusType: RegionBonusType.NONE, guildControllable: false },
  [RegionId.EXTRACTION]: { bonusType: RegionBonusType.EXTRACTION, guildControllable: true },
  [RegionId.FARMING]: { bonusType: RegionBonusType.FARMING, guildControllable: true },
  [RegionId.CRAFTING]: { bonusType: RegionBonusType.CRAFTING, guildControllable: true },
};
