import type { ResourceType, RecipeInput } from '@merchant-realms/shared';
import { RECIPE_BY_KEY } from './recipes.js';

export { ALL_RECIPES, RECIPES_BY_BUILDING, RECIPE_BY_KEY } from './recipes.js';
export type { Recipe, RecipeInput } from './recipes.js';
export { calculateUpgradeCost } from './upgrade-cost.js';
export type { UpgradeCostItem } from './upgrade-cost.js';

export interface ResourceAvailable {
  resource: ResourceType;
  available: number;
}

export interface ProductionResult {
  produced: { resource: ResourceType; quantity: number } | null;
  consumed: Array<{ resource: ResourceType; quantity: number }>;
  blocked: boolean; // true if inputs were missing
}

/**
 * Attempt to run one tick of a recipe on a single building.
 * Returns what was produced and consumed, or blocked=true if inputs insufficient.
 *
 * level:            building level (multiplies all inputs and outputs)
 * workerFactor:     0–1, from worker staffing (1 = fully staffed)
 * adminBypass:      skip input availability check (admin mode)
 */
export function computeProductionTick(
  recipeKey: string,
  available: ResourceAvailable[],
  level: number,
  workerFactor: number,
  adminBypass: boolean,
): ProductionResult {
  const recipe = RECIPE_BY_KEY[recipeKey];
  if (!recipe) return { produced: null, consumed: [], blocked: true };

  const avMap = new Map(available.map((a) => [a.resource, a.available]));
  const scaledInputs = recipe.inputs.map((inp: RecipeInput) => ({
    resource: inp.resource,
    quantity: inp.quantity * level,
  }));

  if (!adminBypass) {
    for (const inp of scaledInputs) {
      if ((avMap.get(inp.resource) ?? 0) < inp.quantity) {
        return { produced: null, consumed: [], blocked: true };
      }
    }
  }

  const outputQty = recipe.outputQty * level * Math.min(1, workerFactor);

  return {
    produced: { resource: recipe.output, quantity: outputQty },
    consumed: scaledInputs,
    blocked: false,
  };
}
