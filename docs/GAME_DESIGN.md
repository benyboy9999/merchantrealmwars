# Project Scaffolding: Merchant Realms (Medieval Fantasy Economy Game)

## Context

A browser-based persistent multiplayer economy game with a medieval/fantasy theme. Greenfield project in `/Users/kieran/merchant-realms`. Claude Code does most development. The scaffolding must maximise Claude's ability to work safely long-term, and enforce strict dev/staging/prod separation so testing never impacts live players.

This plan covers:
1. **The Game Design Document (GDD)** — all locked design decisions, to be written to `docs/GAME_DESIGN.md`
2. **Entity naming** — final in-game terminology used throughout the codebase
3. **The technical scaffolding plan** — project structure and implementation steps

---

# Part 1: Entity Naming (canonical — used in all code, DB, and UI)

| Code term | In-game name | Description |
|---|---|---|
| `realm` | **Realm** | The entire game world / server |
| `empire` | **Empire** | A single player's economic entity |
| `region` | **Region** | One of the 4 locations in the Realm |
| `exchange` | **Exchange** | The trading market within each Region |
| `keep` | **Keep** | A player's physical base, built on a Plot |
| `plot` | **Plot** | A parcel of land within a Region; Keeps are built on Plots |
| `buildingSlot` | **Building Slot** | A slot inside a Keep where a Building can be constructed |
| `building` | **Building** | A production facility (Farm, Mine, Mill, Forge, etc.) |
| `caravan` | **Caravan** | A transport unit; comprises individual vehicles (Cart/Wagon/Courier) |
| `guild` | **Guild** | A player organisation |
| `worker` | **Worker** | Tiered labour unit (T1, T2, …); not skill-based |
| `housing` | **TBD per tier** | Worker accommodation; name depends on tier (defined with resource graph) |

All display strings must use this table as the source of truth. Never hardcode display names outside `shared/constants/theme.ts`.

---

# Part 2: Game Design Document (GDD)

*Written to `docs/GAME_DESIGN.md` on scaffolding.*

## One-line pitch
A persistent browser-based economy game where players build production Empires across a medieval Realm, compete via complex supply chains and player-driven trade at regional Exchanges, and earn status through wealth and Guild dominance.

## Core Loop
1. Build Keeps on Plots in Regions → assign Workers → fill Building Slots with production Buildings
2. Process raw resources through production chains
3. Transport goods between Keeps and Regions via Caravans
4. Trade on regional Exchanges (buy low, sell high, arbitrage between Regions)
5. Feed your Workers daily to maintain production efficiency
6. Donate to your Guild, contest Region control, climb the leaderboard

---

## World Structure

### The Four Regions
| Region | Bonus | Guild-Controllable |
|---|---|---|
| **Central Region** | None — balanced, medium efficiency | No — permanently neutral |
| **Extraction Region** | Bonus to mining/logging/raw resource output | Yes |
| **Farming Region** | Bonus to agricultural and livestock output | Yes |
| **Crafting Region** | Bonus to processing speed and refined goods output | Yes |

- All players start in the **Central Region**
- Each Region has its own **Exchange** (market)
- Exchanges are **not isolated** — players can buy/sell across all Regions
- Price differences between Regions create natural arbitrage opportunities

### Plots & Keeps
- Each Region contains multiple **Plots** with different resource or location bonuses
- Plots are **non-exclusive** — multiple players can build a Keep on the same Plot simultaneously
- A Plot's bonus applies to all players with a Keep there
- Each Keep has a fixed number of **Building Slots** (expandable via upgrades — TBD)
- Players can have Keeps in multiple Regions

---

## Economy

### Currency
- **Gold** is the single currency
- Gold enters the economy through **NPC buy orders** at the Exchanges (NPCs buy basic goods at fixed prices)
- NPC orders stimulate the early economy before player-to-player trade is liquid
- As the player economy matures, player orders outcompete NPC prices naturally
- Gold exits via taxes, Guild upgrades, and other sinks (see below)

### Exchanges
- Each Region has a local Exchange (order book)
- Players can view and fill orders across all Regions
- Transport cost and time create natural price differentials
- Market structure: **limit order book** — both **buy orders** (bid at a price) and **sell orders** (ask at a price)
- Orders match when a buy price meets a sell price
- Public API endpoint planned: `GET /api/public/v1/exchange/orders` (scope TBD)

### Taxes
- Each Region collects tax (likely a % of Exchange transactions — rate TBD)
- Central Region: tax → game treasury (economic sink)
- Outer Regions: 50% → controlling Guild treasury, 50% → game treasury

---

## Workers & Housing

### Worker Tiers
- Workers are **tiered** (T1, T2, T3, …), not skill-based
- T1 Workers can operate any T1 Building (Farm, Mine, Mill, etc.)
- T2 Workers can operate T2 Buildings (more advanced production), need T2 Housing, consume higher-tier goods
- Each tier requires its own Housing type (names TBD with resource graph)
- A Keep must have the correct Housing tier before Workers of that tier can be assigned

### Daily Consumption (per tick)
- Each Worker tier has **necessary** and **optional** consumable needs
- **Necessary**: unmet → stacking production penalty on that Worker
- **Optional**: met → stacking production bonus on that Worker
- Consumption scales with empire size — larger Empires feed proportionally more Workers (**natural anti-domination mechanic**)
- Penalties clear immediately when consumption is met again

### Consumption Failure
- Each unmet necessary consumable applies a **stacking production penalty**
- Multiple unmet needs stack additively (no binary on/off)
- No permanent Worker loss — penalties are always recoverable

---

## Transport & Caravans

### Mechanic
- Resources do **not** teleport between Keeps, Exchanges, or Regions
- Players own **Caravans** — independent entities that travel between Keeps and Exchanges
- Moving goods requires: a Caravan, fuel (FEED), and time (distance-based arrival delay)
- Players can own multiple Caravans simultaneously
- **In-transit cargo is unavailable** until the Caravan arrives at its destination
- **Caravans can be cancelled** — cargo returns to origin Keep (not lost)

### Routes
Caravans can travel between any combination of:
- Keep → Keep (same or different Region)
- Keep → Exchange (to list or deposit goods)
- Exchange → Keep (after purchasing from Exchange)

### Vehicle Types (within a Caravan)
| Vehicle | Speed | Capacity | Notes |
|---|---|---|---|
| Cart | Slow | Light | Cheap, early-game |
| Wagon | Medium | Heavy | Primary trade workhorse |
| Courier | Fast | Very light | High-value, low-weight cargo |

### Vehicle Mechanics
- **Modular upgrades**: Players can purchase goods to upgrade their Caravan (speed, capacity, fuel efficiency — detail TBD)
- **Fuel**: Each trip consumes FEED (grain-derived) — permanent economic sink and demand driver for Farming Region
- **Durability**: Degrades per trip; repair requires IRON + LUMBER

---

## Guilds

### Purpose
- Social and economic organisation layer
- Members receive **50% of tax** collected in any Region the Guild controls
- Guild membership provides passive bonuses to members (specifics TBD)

### Guild Upgrades
- Guilds are upgraded by members donating resources to the Guild treasury
- Higher Guild level = better member bonuses
- Donated resources are permanently consumed (**economic sink**)

### Region Control
- The 3 outer Regions can each be controlled by one Guild at a time
- Control resets **weekly** — designed to be contestable so no single Guild permanently dominates
- **Control mechanism: TBD** — must be a resource sink, not combat; must have anti-monopoly properties
- Ideas: sustained weekly contribution, diminishing returns for multi-week holders, open challenge window

---

## Leaderboard & Status

- Leaderboard position and status are the primary long-term motivations
- No win condition — the game is persistent
- **Leaderboard metrics: TBD** — likely candidates: total gold wealth, trade volume, guild rank, production output, or a composite score
- Progression phases: survival (early) → optimisation (mid) → dominance (late)

---

## Buildings — Upkeep
- All Buildings require ongoing **construction materials** as upkeep each tick to remain operational
- If upkeep materials are not available in the Keep's ResourceLedger, the Building goes **dormant** (stops producing)
- Building resumes automatically when upkeep materials are resupplied
- Specific materials per building type defined with resource graph (TBD)

---

## Specialisation System

### Overview
- Players can invest in **specialisation trees** to gain production bonuses and unlock advanced recipes
- Specialisation is Empire-level (applies to all of a player's Keeps)
- Trees are broad domain areas (exact names TBD with resource graph, e.g. Extraction, Agriculture, Crafting, Commerce, Logistics, Leadership)

### Mechanics
- Each upgrade in a tree grants: production efficiency bonuses and/or recipe unlocks for advanced Buildings
- **Non-linear cost**: each successive upgrade within the same tree costs progressively more (e.g. exponential resource cost)
- This makes maxing all trees prohibitively expensive — players must make meaningful choices about where to specialise
- Trade-off: deep specialist vs broad generalist

### DB Shape
- `SpecialisationTree` — id, name, description
- `SpecialisationNode` — id, treeId, level, bonusDescription, recipeUnlocks (JSON), cost (JSON resource map)
- `EmpireSpecialisation` — id, empireId, nodeId, acquiredAt

---

## Chat
- In-game real-time chat via Socket.io
- Channels: **Global** (all players), **Guild** (members only), **Region** (players in same Region), **Direct** (private messages TBD)
- Messages are persisted in the database with a retention window (e.g. 30 days)
- `ChatMessage` — id, senderId, channelType (GLOBAL/GUILD/REGION/DIRECT), channelId (guildId/regionId/null), content, sentAt

---

## Economic Sinks (resources/gold permanently destroyed)
1. Daily Worker consumption (goods destroyed each tick)
2. Caravan fuel (FEED consumed per trip)
3. Vehicle durability repair (IRON + LUMBER consumed)
4. Building upkeep materials (consumed each tick per active Building)
5. Guild upgrade donations (resources consumed)
6. Region tax treasury share (gold destroyed)
7. Specialisation upgrade costs (resources consumed)
8. *(Possible)* Exchange listing fees

---

## Public API
- A public read-only API will be available at `/api/public/v1/`
- Rate-limited; no authentication required
- Intended for player-built tools: economy trackers, arbitrage calculators, production planners
- **Scope TBD** — to be decided before that system is built

---

## TBD (must resolve before implementing those systems)
- **Resource graph** — full production chains, Worker tier consumables, Building types, upkeep materials — requires dedicated design session with user
- **Specialisation tree names and structure** — branches, node bonuses, recipe unlocks — part of resource graph session
- **Housing names per tier** — part of resource graph session
- **Caravan upgrade details** — what goods upgrade which stats, upgrade tiers
- **Region control mechanism** — contestable weekly control; anti-monopoly properties
- **Leaderboard metrics** — what is scored, how composite score works
- **Tax rate** — percentage, what triggers it
- **Guild passive bonuses** — beyond tax share
- **Building Slot expansion** — how Keeps gain more slots
- **Public API scope** — which endpoints, what data, rate limits
- **Chat Direct Messages** — scope and moderation

---

# Part 3: Technical Scaffolding Plan

## Tech Stack

| Layer | Choice | Notes |
|---|---|---|
| Monorepo | pnpm workspaces | Enforced module boundaries |
| Frontend | React + TypeScript + Vite + TailwindCSS | Most popular; massive community |
| State | Zustand + TanStack Query | Lightweight, well-documented |
| Backend | Node.js + TypeScript + Express | Most familiar Node framework |
| Real-time | Socket.io | Industry standard for multiplayer |
| Database | PostgreSQL + Prisma ORM | Type-safe, reliable |
| Sessions | PostgreSQL (Redis deferred) | Add Redis when genuinely needed |
| Testing | Vitest | Fast, TypeScript-native |
| CI/CD | GitHub Actions | Free tier sufficient |
| Infrastructure | Docker Compose + Nginx | Consistent environments |

**All tools are 100% free and open source.**

---

## Module Boundary Rules

```
shared  ← imported by client, server, engine (no game imports of its own)
engine  ← imports shared only (pure functions — no DB, network, or filesystem)
server  ← imports shared + engine (owns all I/O: DB, HTTP, WebSockets)
client  ← imports shared only (no engine imports — all logic stays server-side)
```

Enforced in CLAUDE.md and linted via eslint-import-resolver. Violations fail CI.

---

## Directory Tree

```
merchant-realms/
├── packages/
│   ├── client/
│   │   ├── src/
│   │   │   ├── components/            # Reusable UI primitives (Button, Modal…)
│   │   │   ├── features/              # Domain modules — each owns its UI, hooks, types
│   │   │   │   ├── exchange/          # Exchange/market UI (buy + sell orders)
│   │   │   │   ├── empire/            # Empire overview, resource ledger
│   │   │   │   ├── keep/              # Keep management, building slots
│   │   │   │   ├── guild/             # Guild UI
│   │   │   │   ├── caravan/           # Caravan dispatch, upgrades, tracking
│   │   │   │   ├── specialisation/    # Specialisation tree UI
│   │   │   │   ├── chat/              # Chat channels (global, guild, region)
│   │   │   │   └── map/               # Region map view
│   │   │   ├── hooks/
│   │   │   ├── stores/                # Zustand stores
│   │   │   ├── services/              # Typed API client + WebSocket client
│   │   │   ├── pages/                 # Route-level components
│   │   │   └── main.tsx
│   │   ├── index.html
│   │   ├── vite.config.ts
│   │   ├── tailwind.config.ts
│   │   └── package.json
│   │
│   ├── server/
│   │   ├── src/
│   │   │   ├── api/
│   │   │   │   ├── auth/
│   │   │   │   ├── empire/
│   │   │   │   ├── keep/
│   │   │   │   ├── exchange/
│   │   │   │   ├── guild/
│   │   │   │   ├── caravan/
│   │   │   │   ├── specialisation/
│   │   │   │   ├── chat/
│   │   │   │   └── public/            # Public API namespace (/api/public/v1/)
│   │   │   ├── services/              # Business logic (DB reads → engine → DB writes)
│   │   │   ├── jobs/
│   │   │   │   ├── tickJob.ts         # Master tick orchestrator
│   │   │   │   ├── consumptionJob.ts  # Worker consumption phase
│   │   │   │   ├── caravanJob.ts      # Caravan delivery phase
│   │   │   │   └── controlJob.ts      # Weekly Region control reset
│   │   │   ├── ws/                    # Socket.io event handlers
│   │   │   ├── db/                    # Prisma client singleton
│   │   │   ├── config/                # Env validation (Zod — startup crash on bad config)
│   │   │   ├── middleware/            # Auth, error handling, rate limiting
│   │   │   └── app.ts
│   │   ├── prisma/
│   │   │   ├── schema.prisma
│   │   │   └── migrations/
│   │   └── package.json
│   │
│   ├── engine/                        # Pure game logic — zero I/O
│   │   ├── src/
│   │   │   ├── economy/               # Exchange matching (buy+sell orders), price discovery
│   │   │   ├── production/            # Building output calculations per tier
│   │   │   ├── consumption/           # Worker consumption needs, penalty stacking
│   │   │   ├── upkeep/                # Building upkeep calculations, dormancy logic
│   │   │   ├── specialisation/        # Bonus calculations from specialisation trees
│   │   │   ├── caravan/               # Travel time, fuel cost, durability loss
│   │   │   ├── tick/                  # Full tick pipeline orchestration
│   │   │   └── index.ts
│   │   ├── src/__tests__/             # Vitest — required for all engine functions
│   │   └── package.json
│   │
│   └── shared/
│       ├── src/
│       │   ├── types/                 # TypeScript interfaces (Empire, Keep, Worker…)
│       │   ├── schemas/               # Zod schemas — API contracts + runtime validation
│       │   ├── constants/
│       │   │   ├── regions.ts         # RegionId enum (CENTRAL/EXTRACTION/FARMING/CRAFTING)
│       │   │   ├── resources.ts       # ResourceType enum — single source of truth
│       │   │   ├── buildings.ts       # BuildingType enum
│       │   │   ├── vehicles.ts        # VehicleType enum (CART/WAGON/COURIER)
│       │   │   ├── workers.ts         # WorkerTier enum (T1/T2/…)
│       │   │   ├── wsEvents.ts        # WebSocket event name constants
│       │   │   └── theme.ts           # All player-facing display names (single source of truth)
│       │   └── index.ts
│       └── package.json
│
├── infrastructure/
│   ├── nginx/nginx.conf               # /api → server; /socket.io → server; / → static
│   └── postgres/init.sql
│
├── .github/workflows/
│   ├── ci.yml                         # Typecheck + lint + test on every PR
│   └── deploy.yml                     # SSH deploy to VPS on merge to main
│
├── docs/
│   ├── GAME_DESIGN.md                 # The GDD above (living document)
│   ├── ARCHITECTURE.md                # System overview, data flow
│   ├── CONTRIBUTING.md                # How to add features, run tests, contribute
│   └── adr/
│       └── 001-monorepo-structure.md
│
├── scripts/
│   ├── seed.ts                        # Seed dev DB (test player, empire, keep, NPC orders)
│   └── reset-dev.sh                   # Tear down + rebuild dev environment
│
├── docker-compose.yml                 # Dev: postgres + server (hot reload) + client (HMR)
├── docker-compose.prod.yml            # Prod: postgres + server (compiled) + nginx
├── .env.example                       # All env vars documented with descriptions
├── .env.dev                           # Dev defaults (committed — no secrets)
├── .gitignore
├── .eslintrc.json
├── .prettierrc
├── tsconfig.base.json                 # Shared TS config (strict: true)
├── vitest.config.ts
├── pnpm-workspace.yaml
├── package.json                       # Root scripts only
└── CLAUDE.md                          # Claude Code operating manual
```

---

## Initial Database Schema (Prisma)

```prisma
// Auth
Player         — id, username, email, passwordHash, createdAt, lastActiveAt
RefreshToken   — id, playerId, token, expiresAt

// World (seeded, not player-created)
Region         — id, name (CENTRAL/EXTRACTION/FARMING/CRAFTING), bonusType
Plot           — id, regionId, name, bonusDescription, x, y

// Player economy
Empire         — id, playerId, name, goldBalance, createdAt
Keep           — id, empireId, plotId, name, buildingSlotCount, createdAt
BuildingSlot   — id, keepId, slotIndex, building (nullable FK)
Building       — id, keepId, slotId, buildingType, tier, isActive
Housing        — id, keepId, tier (T1/T2/…), capacity, workerCount
ResourceLedger — id, keepId, resourceType, quantity, updatedAt

// Workers
Worker         — id, keepId, housingId, tier, assignedBuildingId (nullable)
ConsumptionLog — id, empireId, tickId, resourceType, required, actual, penaltyApplied

// Transport
Vehicle        — id, empireId, vehicleType, fuelLevel, durability
CaravanUpgrade — id, vehicleId, upgradeType, appliedAt
Caravan        — id, vehicleId, originType (KEEP/EXCHANGE), originId,
                  destType (KEEP/EXCHANGE), destId, resourceType, quantity,
                  departedAt, arrivesAt, status (IN_TRANSIT/ARRIVED/CANCELLED)

// Exchange
MarketOrder    — id, empireId (null = NPC), regionId, orderType (BUY/SELL),
                  resourceType, quantity, pricePerUnit, fulfilledQty, status, createdAt
MarketTrade    — id, buyOrderId, sellOrderId, quantity, pricePerUnit, tradedAt

// Guilds
Guild          — id, name, leaderId, level, goldBalance, createdAt
GuildMember    — id, guildId, playerId, role (LEADER/OFFICER/MEMBER), joinedAt
RegionControl  — id, guildId, regionId, weekNumber, controlStart, controlEnd

// Specialisation
SpecialisationTree — id, name, description
SpecialisationNode — id, treeId, level, bonusDescription, recipeUnlocks (JSON), cost (JSON)
EmpireSpecialisation — id, empireId, nodeId, acquiredAt

// Chat
ChatMessage    — id, senderId, channelType (GLOBAL/GUILD/REGION), channelId (nullable),
                  content, sentAt

// System
GameTick       — id, tickNumber, processedAt, durationMs
TaxCollection  — id, regionId, tickId, totalAmount, guildShare, treasuryShare
BuildingUpkeepLog — id, buildingId, tickId, required (JSON), actual (JSON), dormant
```

---

## Tick Architecture

Tick interval: **30s (dev)** / **5min (prod)**

Each tick, orchestrated by `server/src/jobs/tickJob.ts`:
1. **Upkeep** — `engine.upkeep.calculate()` per Building → deduct materials; mark dormant if unmet
2. **Production** — `engine.production.compute()` per active (non-dormant) Building → update ResourceLedger
3. **Consumption** — `engine.consumption.calculate()` per Empire → apply Worker penalties, write ConsumptionLog
4. **Caravans** — advance in-transit Caravans; deliver arrived cargo → update ResourceLedger
5. **Exchange** — `engine.economy.matchOrders()` → match buy+sell orders, write MarketTrade rows, update gold
6. **Tax** — calculate Exchange tax → distribute to Guild treasury and game treasury
7. **Broadcast** — emit `TICK_COMPLETE` via Socket.io with per-player state diffs

Engine functions are **pure**: `(state, config) => result`. No DB calls. Fully unit-testable.

Separate scheduled jobs:
- `controlJob.ts` — runs weekly, resets Region control and evaluates new controller

---

## Environment Strategy

| | Dev | Prod |
|---|---|---|
| Server | `tsx watch` hot reload | Compiled TypeScript |
| Client | Vite HMR | Pre-built static via Nginx |
| Tick interval | 30 seconds | 5 minutes |
| Debug endpoints | Yes (`/debug/tick`, `/debug/reset`) | No |
| Logging | Verbose | Structured JSON to files |
| SSL | No | Yes (Nginx terminates) |

Staging = prod config + `.env.staging` + separate DB, deployed as `merchant-realms-staging` Docker Compose project on same VPS.

---

## CI/CD

**`ci.yml`** (every PR):
1. `pnpm install`
2. `pnpm typecheck` (all packages)
3. `pnpm lint`
4. `pnpm test` (Vitest — all engine unit tests must pass)

**`deploy.yml`** (merge to `main`):
1. SSH to VPS
2. `git pull origin main`
3. `pnpm --filter client build`
4. `docker-compose -f docker-compose.prod.yml up --build -d`
5. `docker exec merchant-realms-server npx prisma migrate deploy`

---

## CLAUDE.md Key Sections

- **Architecture map** — package ownership, module boundary rules
- **Entity naming table** — the canonical names from Part 1 above
- **Commands**: `pnpm dev`, `pnpm test`, `pnpm typecheck`, `pnpm build`, `pnpm db:migrate`, `pnpm db:seed`
- **How to add a feature** — schema → shared types/schemas → engine (if pure logic + tests) → server service → server route → client feature folder
- **How to add a resource type** — edit `shared/constants/resources.ts` only; TypeScript surfaces all downstream gaps
- **How to add a building type** — edit `shared/constants/buildings.ts` only
- **Display names rule** — all player-facing strings must come from `shared/constants/theme.ts`; never hardcode
- **DB access rule** — always via `packages/server/src/db/client.ts`; never raw SQL
- **WebSocket events** — always use constants from `shared/constants/wsEvents.ts`; never inline strings
- **No secrets in code** — all config via env vars, validated by Zod at startup
- **Engine purity rule** — engine functions must be pure and have Vitest unit tests

---

## Implementation Steps

1. Root config: `package.json`, `pnpm-workspace.yaml`, `tsconfig.base.json`, `.eslintrc.json`, `.prettierrc`, `.gitignore`, `.env.example`, `.env.dev`
2. `CLAUDE.md` — full operating manual (entity naming table, module rules, commands, conventions)
3. `shared` package — region/resource/building/vehicle/worker-tier/wsEvent constants + theme.ts, Zod schemas, TypeScript types
4. `engine` package — tick pipeline, production/consumption/caravan/exchange stubs + Vitest tests
5. `server` package — Express app, Prisma schema + initial migration, Zod config validation, tick/caravan/control job stubs, Socket.io, auth routes, NPC order seeding logic
6. `client` package — Vite + React + Tailwind bootstrap, typed API client stub, feature folder stubs (exchange, empire, keep, guild, caravan, map), Socket.io client
7. `docker-compose.yml` (dev) + `docker-compose.prod.yml` (prod)
8. `infrastructure/nginx/nginx.conf`
9. `.github/workflows/ci.yml` + `deploy.yml`
10. `docs/GAME_DESIGN.md` (GDD above), `ARCHITECTURE.md`, `CONTRIBUTING.md`
11. `scripts/seed.ts` + `reset-dev.sh`

---

## Verification

- `pnpm install` — resolves all workspace deps with no errors
- `pnpm typecheck` — zero TypeScript errors across all packages
- `pnpm test` — all engine unit tests pass
- `pnpm dev` — client on `:5173`, server on `:3000`, postgres in Docker
- Visit `localhost:5173` — React app loads, WebSocket connects
- `pnpm db:seed` — creates test Player, Empire, Keep, and NPC Exchange orders
