# Artemis — Claude Code Operating Manual

This file is the source of truth for how to work on this codebase. Read it before making any changes.

---

## Entity Naming (canonical — use these everywhere)

| Code term | In-game display name | Description |
|---|---|---|
| `realm` | **Realm** | The entire game world / server |
| `empire` | **Empire** | A single player's economic entity |
| `region` | **Region** | One of the 4 locations (CENTRAL / EXTRACTION / FARMING / CRAFTING) |
| `exchange` | **Exchange** | The trading market within each Region |
| `keep` | **Keep** | A player's physical base, built on a Plot |
| `plot` | **Plot** | A parcel of land within a Region |
| `buildingSlot` | **Building Slot** | A slot inside a Keep where a Building is constructed |
| `building` | **Building** | A production facility (Farm, Mine, Mill, Forge, etc.) |
| `caravan` | **Caravan** | A transport unit (Cart / Wagon / Courier vehicle types) |
| `guild` | **Guild** | A player organisation |
| `worker` | **Worker** | Tiered labour unit (T1, T2, …) |

**All player-facing display strings must come from `packages/shared/src/constants/theme.ts`.
Never hardcode display names anywhere else.**

---

## Package Architecture

```
packages/
├── shared/    ← imported by client, server, engine
├── engine/    ← imports shared only (pure functions — ZERO I/O)
├── server/    ← imports shared + engine (owns all DB, HTTP, WebSocket I/O)
└── client/    ← imports shared only (no engine, no server imports)
```

These boundaries are enforced by ESLint (`import/no-cycle`, `no-restricted-imports`).
**Violations will fail CI.**

### What goes where
- **shared**: TypeScript types, Zod schemas, enums, constants, display names
- **engine**: Pure game maths — production calculations, market matching, consumption penalties, caravan timing. Functions are `(state, config) => result`. No side effects.
- **server**: Everything that touches the outside world — database (Prisma), HTTP routes (Express), WebSocket (Socket.io), scheduled jobs (node-cron)
- **client**: React UI, Zustand stores, TanStack Query hooks, Socket.io client

---

## Commands

Run from the repo root:

```bash
pnpm dev              # Start all services (requires Docker for postgres)
pnpm test             # Run all Vitest tests
pnpm typecheck        # TypeScript check across all packages
pnpm lint             # ESLint across all packages
pnpm build            # Production build (all packages, in dependency order)
pnpm format           # Prettier format

pnpm db:migrate       # Run pending Prisma migrations
pnpm db:seed          # Seed dev database with test data
pnpm db:studio        # Open Prisma Studio (DB browser)
```

Docker shortcuts:
```bash
docker-compose up -d                        # Start dev services (postgres)
docker-compose -f docker-compose.prod.yml up --build -d  # Start prod
```

---

## How to Add a Feature

Follow this order every time:

1. **DB schema** — edit `packages/server/prisma/schema.prisma`, then run `pnpm db:migrate`
2. **Shared types** — add TypeScript interfaces to `packages/shared/src/types/`
3. **Shared schemas** — add Zod schemas to `packages/shared/src/schemas/` for API validation
4. **Engine logic** (if pure maths) — add to `packages/engine/src/<domain>/` with Vitest tests
5. **Server service** — business logic in `packages/server/src/services/<domain>.ts`
6. **Server route** — Express handler in `packages/server/src/api/<domain>/`
7. **Client feature** — UI + hooks in `packages/client/src/features/<domain>/`

---

## How to Add a Resource Type

Resource types are the single source of truth for the entire economy.

1. Edit `packages/shared/src/constants/resources.ts` — add to the `ResourceType` enum
2. Run `pnpm typecheck` — TypeScript will surface every place that needs updating
3. Add the display name to `packages/shared/src/constants/theme.ts`
4. Add production/consumption data when implementing the resource graph

**Never hardcode resource strings anywhere. Always reference `ResourceType.TIMBER` etc.**

## How to Add a Building Type

1. Edit `packages/shared/src/constants/buildings.ts` — add to `BuildingType` enum
2. Add display name and description to `packages/shared/src/constants/theme.ts`
3. Add production recipe to `packages/engine/src/production/recipes.ts` (once resource graph is finalised)
4. Run `pnpm typecheck` to find gaps

## How to Add a Vehicle Type

1. Edit `packages/shared/src/constants/vehicles.ts` — add to `VehicleType` enum
2. Add stats (speed, capacity, fuelCost) to `packages/engine/src/caravan/vehicleStats.ts`
3. Add display name to `packages/shared/src/constants/theme.ts`

---

## Conventions

### Files
- `kebab-case` for all file and folder names
- `PascalCase` for React components and TypeScript interfaces/types
- `camelCase` for functions, variables, methods
- `SCREAMING_SNAKE_CASE` for constants and enum values

### TypeScript
- `strict: true` is non-negotiable — no `any`, no `@ts-ignore` without a comment explaining why
- Use `type` imports: `import type { Foo } from '...'`
- Derive types from Zod schemas where possible: `type Foo = z.infer<typeof FooSchema>`
- Prefer `const` assertions for lookup objects

### Database
- **Always** use the Prisma client from `packages/server/src/db/client.ts`
- **Never** write raw SQL unless Prisma cannot express it (and document why)
- All schema changes go through migrations — never `db push` in staging/prod

### WebSocket events
- **Always** use constants from `packages/shared/src/constants/ws-events.ts`
- **Never** inline event name strings

### Secrets & config
- All config comes from environment variables
- Env vars are validated by Zod at server startup (`packages/server/src/config/index.ts`)
- If a required env var is missing, the server crashes immediately with a clear error
- `.env.dev` (committed) contains safe dev defaults — no real secrets
- **Never commit `.env`, `.env.staging`, or `.env.production`**

### Engine purity rule
- Every function in `packages/engine/` must be pure: same input → same output, no side effects
- Every engine function must have at least one Vitest test in `packages/engine/src/__tests__/`
- If you find yourself wanting to call Prisma from the engine, stop — move the logic to a server service

---

## Tick System

The economy runs on server ticks (`TICK_INTERVAL_SECONDS` env var — 30s dev, 300s prod).

Tick phases (in order):
1. **Upkeep** — deduct building maintenance materials; mark buildings dormant if unmet
2. **Production** — compute output for all non-dormant buildings
3. **Consumption** — calculate worker consumption; apply stacking penalties for unmet needs
4. **Caravans** — advance in-transit caravans; deliver arrived cargo
5. **Exchange** — match buy/sell orders; settle trades
6. **Tax** — collect and distribute regional tax
7. **Broadcast** — emit `TICK_COMPLETE` to connected players via Socket.io

Orchestrated by `packages/server/src/jobs/tick-job.ts`.
Engine functions handle the maths; server services handle DB reads/writes.

---

## TBD Systems (do not implement until design is finalised)

The following require a dedicated design session with the user before implementation:

- **Resource graph** — full production chains, building recipes, upkeep costs, worker tier consumables
- **Specialisation trees** — branch names, node bonuses, recipe unlocks, cost curves
- **Region control mechanism** — the weekly contestable resource sink
- **Leaderboard metrics** — scoring formula and display
- **Caravan upgrade details** — upgrade types and stat modifiers
- **Housing tier names** — naming for T1/T2/… housing
- **Public API scope** — which endpoints, rate limits

When a TBD system is ready to implement, update this file with the decisions before writing any code.

---

## Dev Environment

```
localhost:5173  → Vite client (React app)
localhost:3000  → Express server (API + WebSocket)
localhost:5432  → PostgreSQL (via Docker)
```

First-time setup:
```bash
docker-compose up -d        # Start postgres
pnpm install                # Install all dependencies
pnpm db:migrate             # Run migrations
pnpm db:seed                # Seed with test data
pnpm dev                    # Start client + server with hot reload
```

Reset dev environment:
```bash
./scripts/reset-dev.sh
```
