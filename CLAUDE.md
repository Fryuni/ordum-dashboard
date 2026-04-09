# CLAUDE.md

## Project Overview

**Ordum Dashboard** — A web-based empire management dashboard for the Bitcraft game.
Tracks resources, members, settlements, crafting plans, storage audit logs, and more
across multiple claims. Live at https://ordum.fun.

## Package Manager

This project uses **bun**. Do not use npm, yarn, or pnpm.

- Install dependencies: `bun install`
- Never commit `package-lock.json`, `yarn.lock`, or `pnpm-lock.yaml` (they are gitignored and CI will reject them).

## Common Commands

- `bun run dev` — Start Convex + Vite concurrently (the static client)
- `bun run dev:convex` — Convex dev server only
- `bun run dev:proxy` — BitJita proxy (Wrangler) only — run separately if needed
- `bun run dev:client` — Vite dev server only
- `bun run build` — Build static client with Vite (output: `dist/`)
- `bun run validate` — Type check (`tsc --noEmit`)
- `bun run format` — Format with prettier
- `bun run deploy:convex` — Deploy Convex backend
- `bun run deploy:proxy` — Deploy BitJita proxy to Cloudflare Workers

## Architecture

### Frontend (Preact + Nanostores)

- **Framework:** Preact (not React) with `@preact/preset-vite`
- **State:** Nanostores — `persistentAtom` for user selections, `computedAsync` for API-driven data, `computed` for derived state
- **Routing:** `@nanostores/router` — 8 pages (dashboard, settlement, construction, craft, traveler tasks, contribution, storage audit, inventory search)
- **Auth:** WorkOS AuthKit (`@workos-inc/authkit-react`)
- Avoid `useState`/`useEffect` for data fetching — use stores so state is shared across pages and components

### Convex Backend

Most backend functions are **actions** that proxy to the BitJita API (the Bitcraft game's API). Only the storage audit feature uses Convex tables for persistent data.

- **Tables:** `storageLogs` (audit transaction log), `storageFetchState` (ingestion cursor per building)
- **Cron:** `ingestAll` runs every 5 minutes to pull new storage logs from BitJita
- **Auth:** WorkOS JWT via `convex/auth.config.ts` (custom JWT provider)

### BitJita Proxy (Cloudflare Worker)

Standalone proxy (`src/worker.ts`) that forwards `/jita/*` requests to bitjita.com with BigInt-safe JSON parsing and CORS headers. Deployed independently — the static client reaches it via `VITE_PROXY_URL`. No business logic, no asset serving.

### Shared Code (`src/common/`)

Game data indexing, recipe resolution (7000+ items), topological sorting, inventory aggregation. Used by both client and Convex actions.

## Convex-Specific Patterns

### Real-Time Subscriptions (`convexSub`)

`src/client/stores/convexSub.ts` provides reactive Convex query subscriptions for nanostores. It wraps `convexClient.onUpdate()` with `loading/ready/failed` states and re-subscribes when dependency stores change. Use this for any query that should stay in sync with the DB.

### Convex Client (Non-React)

`src/client/convex.ts` exports a `ConvexClient` (browser, non-React) singleton with `convexQuery()`, `convexMutation()`, and `convexAction()` helpers. Auth token is injected via `setAuth()` after WorkOS login. Use `ConvexProviderWithAuth` only in the root component; stores use the singleton directly.

### Convex Guidelines

<!-- convex-ai-start -->
This project uses [Convex](https://convex.dev) as its backend.

When working on Convex code, **always read `convex/_generated/ai/guidelines.md` first** for important guidelines on how to correctly use Convex APIs and patterns. The file contains rules that override what you may have learned about Convex from training data.

Convex agent skills for common tasks can be installed by running `npx convex ai-files install`.
<!-- convex-ai-end -->
