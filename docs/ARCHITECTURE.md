# Architecture

## Package map

```
packages/shared   → TypeScript types, Zod schemas, all enums, display names
packages/engine   → Pure game logic (no I/O). Called by server during ticks.
packages/server   → Express API + Socket.io. Owns the DB, all I/O.
packages/client   → React SPA. Talks to server via HTTP and WebSocket.
```

## Data flow — tick

```
node-cron
  └─ tickJob.ts
      ├─ 1. Upkeep     DB read → engine.upkeep.calculate()  → DB write
      ├─ 2. Production DB read → engine.production.compute() → DB write
      ├─ 3. Consumption DB read → engine.consumption.calculate() → DB write
      ├─ 4. Caravans   DB read → advance timers → DB write
      ├─ 5. Exchange   DB read → engine.economy.matchOrders() → DB write
      ├─ 6. Tax        DB read → distribute → DB write
      └─ 7. Broadcast  io.emit(TICK_COMPLETE, perPlayerDiffs)
```

## Data flow — player action

```
Client → POST /api/exchange/orders
  └─ Express route handler
      └─ Validate (Zod schema from @merchant-realms/shared)
      └─ Service layer (business logic)
      └─ Prisma → PostgreSQL
      └─ JSON response
```

## Real-time (WebSocket)

- Client authenticates socket with JWT on connect
- Server joins client to rooms: `player:<id>`, `global`, `guild:<id>`, `region:<id>`
- Tick broadcast: `TICK_COMPLETE` → all connected clients
- Chat: `CHAT_MESSAGE` → room-scoped
- All event names from `shared/constants/ws-events.ts`

## Environment separation

| Env | Trigger | DB | Tick |
|---|---|---|---|
| dev | `pnpm dev` | localhost:5432 (Docker) | 30s |
| staging | push to `staging` branch | staging DB (VPS) | 5min |
| prod | push to `main` branch | prod DB (VPS) | 5min |

Staging and prod run on the same VPS as separate Docker Compose projects (`merchant-realms` vs `merchant-realms-staging`).
