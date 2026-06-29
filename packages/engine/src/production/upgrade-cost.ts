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

/**
 * Returns the new health % after upgrading a building by one level.
 *
 * Health represents structural integrity as a fraction of total materials invested:
 *   newHealth = (currentHealth × currentLevel + 100) / (currentLevel + 1)
 *
 * The incoming level of fresh construction (100%) is blended with the existing
 * levels at their current health. This means upgrading never resets durability —
 * it dilutes damage across the larger total structure.
 *
 * When upgrade costs become non-linear, this should be weighted by relative cost:
 *   newHealth = (currentHealth × totalExistingCost + 100 × newLevelCost)
 *               / (totalExistingCost + newLevelCost)
 * For now, flat cost per level means each level has equal weight.
 *
 * Result is clamped to [0, 100] and rounded to two decimal places.
 */
export function calculateUpgradeHealth(currentHealth: number, currentLevel: number): number {
  const blended = (currentHealth * currentLevel + 100) / (currentLevel + 1);
  return Math.round(Math.min(100, Math.max(0, blended)) * 100) / 100;
}
