# Contributing

## First-time setup

```bash
# 1. Install pnpm if not already installed
curl -fsSL https://get.pnpm.io/install.sh | sh -

# 2. Install dependencies
pnpm install

# 3. Start the database
docker-compose up -d

# 4. Run migrations and seed
pnpm db:migrate
pnpm db:seed

# 5. Start dev servers
pnpm dev
```

Open `http://localhost:5173` for the client and `http://localhost:3000` for the API.

## Before opening a PR

```bash
pnpm typecheck   # must pass
pnpm lint        # must pass
pnpm test        # must pass
```

## Branching

- `main` — production. Direct pushes blocked.
- `staging` — staging environment. Merges here auto-deploy to staging VPS.
- Feature branches: `feat/<short-description>`
- Bug fixes: `fix/<short-description>`

## Adding features

See **CLAUDE.md** for the step-by-step checklist. Every feature follows the same order:
schema → shared types → engine (if logic) → server service → server route → client feature folder.

## TBD systems

Several game systems are not yet implemented and are waiting for design decisions.
See the **TBD** section in CLAUDE.md before starting work on those areas.
Do not implement TBD systems without first completing the design session noted there.
