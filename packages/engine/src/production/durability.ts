export interface RepairCostItem {
  resource: string;
  quantity: number;
}

/**
 * Returns the production speed multiplier for a building based on its current health.
 * No penalty at or above threshold. Below threshold: linear ramp down to 0 at health=0.
 */
export function calculateDurabilityFactor(health: number, threshold: number): number {
  if (health >= threshold) return 1;
  return health / threshold;
}

/**
 * Returns the materials recovered when demolishing a building.
 * Recovery = constructionCost × level × (health / 100), floored to whole numbers.
 * Items with 0 quantity are omitted.
 */
export function calculateDemolishReturn(
  constructionCost: RepairCostItem[],
  buildingLevel: number,
  currentHealth: number,
): RepairCostItem[] {
  const fraction = Math.max(0, currentHealth) / 100;
  return constructionCost
    .map(({ resource, quantity }) => ({
      resource,
      quantity: Math.floor(quantity * buildingLevel * fraction),
    }))
    .filter((item) => item.quantity > 0);
}

/**
 * Returns the resources needed to repair a building to 100% health.
 * Cost = constructionCost × buildingLevel × (missingHealthFraction).
 * Quantities are ceiled to whole numbers.
 */
export function calculateRepairCost(
  constructionCost: RepairCostItem[],
  buildingLevel: number,
  currentHealth: number,
): RepairCostItem[] {
  const missingFraction = (100 - currentHealth) / 100;
  if (missingFraction <= 0) return [];
  return constructionCost.map(({ resource, quantity }) => ({
    resource,
    quantity: Math.ceil(quantity * buildingLevel * missingFraction),
  }));
}
