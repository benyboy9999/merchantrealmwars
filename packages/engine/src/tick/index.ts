// Tick pipeline orchestration types.
// The actual tick runner lives in packages/server/src/jobs/tick-job.ts
// and calls these pure engine functions after loading state from the DB.

export interface TickConfig {
  tickNumber: number;
  regionBonusMultiplier: Record<string, number>; // regionId → multiplier
}

export interface TickSummary {
  tickNumber: number;
  buildingsDormant: number;
  resourcesProduced: number;
  resourcesConsumed: number;
  tradesMatched: number;
  caravansDelivered: number;
  durationMs: number;
}
