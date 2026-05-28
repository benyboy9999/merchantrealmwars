// Single source of truth for all building types.
// To add a building: add it here, then run `pnpm typecheck` to find all gaps.
// See CLAUDE.md — "How to Add a Building Type"

export const BuildingType = {
  // Placeholder stubs — full building list TBD (requires resource graph design session)
  PLACEHOLDER_T1: 'PLACEHOLDER_T1',
  PLACEHOLDER_T2: 'PLACEHOLDER_T2',
} as const;

export type BuildingType = (typeof BuildingType)[keyof typeof BuildingType];

export const BuildingTier = {
  T1: 1,
  T2: 2,
  T3: 3,
} as const;

export type BuildingTier = (typeof BuildingTier)[keyof typeof BuildingTier];
