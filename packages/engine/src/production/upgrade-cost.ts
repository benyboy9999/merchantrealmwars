export interface UpgradeCostItem {
  resource: string;
  quantity: number;
}

/**
 * Returns the resources required to upgrade a building from currentLevel to currentLevel+1.
 *
 * TODO: Replace with non-linear scaling once the resource graph design is finalised.
 *       Currently returns the flat construction cost at every level — intentional placeholder.
 *       See CLAUDE.md "TBD Systems" for the design discussion.
 */
export function calculateUpgradeCost(
  constructionCost: UpgradeCostItem[],
  _currentLevel: number,
): UpgradeCostItem[] {
  return constructionCost.map(({ resource, quantity }) => ({ resource, quantity }));
}
