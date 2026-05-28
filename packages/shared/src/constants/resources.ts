// Single source of truth for all resource types.
// To add a resource: add it here, then run `pnpm typecheck` to find all gaps.
// See CLAUDE.md — "How to Add a Resource Type"

export const ResourceType = {
  // Placeholder stubs — full resource graph TBD (requires design session)
  PLACEHOLDER_RAW: 'PLACEHOLDER_RAW',
  PLACEHOLDER_REFINED: 'PLACEHOLDER_REFINED',
  FEED: 'FEED', // Vehicle fuel — always required regardless of resource graph
} as const;

export type ResourceType = (typeof ResourceType)[keyof typeof ResourceType];
