export const WorkerTier = {
  T1: 'T1',
  T2: 'T2',
  T3: 'T3',
} as const;

export type WorkerTier = (typeof WorkerTier)[keyof typeof WorkerTier];

export const WORKER_TIERS_ORDERED: WorkerTier[] = [
  WorkerTier.T1,
  WorkerTier.T2,
  WorkerTier.T3,
];
