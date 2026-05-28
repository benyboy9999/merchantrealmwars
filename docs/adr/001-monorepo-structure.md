# ADR 001 — Monorepo with 4 packages

**Status**: Accepted

## Decision

Use a pnpm workspace monorepo with four packages: `shared`, `engine`, `server`, `client`.

## Rationale

- **Module boundaries are enforced** — the engine literally cannot import the database; ESLint fails if it tries. This prevents accidental coupling.
- **Single source of truth** — types defined in `shared` are the same object used by client and server. No copy-paste drift.
- **Engine is isolated and testable** — all game maths live in a package with zero I/O dependencies. Unit tests run in milliseconds against pure functions.
- **Claude Code friendliness** — clear boundaries reduce ambiguity about where new code belongs. Every future request maps to a specific package.

## Trade-offs

- Initial setup is more complex than a flat repo.
- Contributors must understand pnpm workspaces.
- Mitigated by CLAUDE.md and CONTRIBUTING.md documentation.
