// Specialisation tree bonus calculation.
// Tree structure and node definitions are TBD (requires resource graph design session).
// See CLAUDE.md — TBD Systems.

export interface SpecialisationBonus {
  productionMultiplier: number;  // e.g. 1.1 = 10% faster
  consumptionReduction: number;  // e.g. 0.9 = 10% less consumption
  unlockedRecipes: string[];     // BuildingType keys unlocked by this node
}

export interface EmpireSpecialisationState {
  acquiredNodeIds: string[];
}

/**
 * Compute the aggregate bonuses from all acquired specialisation nodes.
 * Pure function — no side effects.
 * Stub until specialisation tree is designed.
 */
export function computeSpecialisationBonuses(
  _state: EmpireSpecialisationState,
  _allNodes: Array<{ id: string; bonus: SpecialisationBonus }>,
): SpecialisationBonus {
  return {
    productionMultiplier: 1,
    consumptionReduction: 1,
    unlockedRecipes: [],
  };
}
