# Ordum Dashboard — Project Roadmap

## Purpose

Dashboard for the Ordum empire in Bitcraft. A Preact SPA on Cloudflare Workers, with the BitJita API as the sole data source.
- **BitJita**: `https://bitjita.com` — game data API (77 endpoints)
- **Live**: `https://ordum.fun`

## Current State

**Architecture**: Cloudflare Workers (Hono) + Preact SPA (Vite).

- **Worker**: `src/worker.ts` — Hono app with API routes (`/api/empire`, `/api/empire-claims`, `/api/settlement`) and `/jita/*` proxy to BitJita
- **Client**: Preact SPA with `@nanostores/router` for routing, nanostores for state
- **Build**: Vite builds client to `dist/client/`, Wrangler bundles worker
- **Static assets**: CF Workers asset binding with `not_found_handling = "single-page-application"`
- **Dev**: `bun dev` — runs Vite (HMR on :4321, proxies API to :8787) + Wrangler (:8787) concurrently
- **Deploy**: `bun run deploy` or GitHub Actions CI
- **Worker size**: ~1.1MB gzipped (includes 20MB of game data JSON, compresses well)

**Code layout**:
```
src/worker.ts              — Cloudflare Worker entry (Hono app)
src/client/                — Preact SPA
  index.html               — HTML entry (references client.tsx + styles.css)
  client.tsx               — Preact render entry
  App.tsx                  — Root component with router
  styles.css               — All global styles
  components/              — UI components (StatCard, ResourceTable, MembersTable, TierPlan, craft/*)
  pages/                   — Page components (Dashboard, Settlement, Craft, TravelerTask)
  stores/                  — Nanostores (router, craft, craftSource, player, travelerTask)
  util-store.ts            — Page activity and update timer
src/server/                — Server-only code
  api-server.ts            — Cached BitJitaClient (@croct/cache + ohash)
  ordum-data.ts            — Empire data fetcher (builds ClaimSummary/EmpireSummary)
src/common/                — Shared code (neither client nor server specific)
  bitjita-client.ts        — Auto-generated BitJita REST client (77 endpoints)
  api.ts                   — Client-side BitJitaClient (uses /jita proxy in browser)
  ordum-types.ts           — Shared types and constants
  gamedata.ts              — Static game data parser/indexer (items, recipes, techs, etc.)
  craft-planner.ts         — Recursive recipe resolver
  settlement-planner.ts    — Settlement tier upgrade calculator
  claim-inventory.ts       — Claim building inventory builder
  itemIndex.ts             — Item search index
  lazy.ts                  — Lazy/LazyKeyed utilities
  topological-sort.ts      — Generic topological sort (Tarjan SCC + Kahn)
wrangler.toml              — Cloudflare Workers configuration
vite.config.ts             — Vite client build configuration
.github/workflows/deploy.yml — CI/CD: build + deploy to CF Workers
```

**Four pages**:
1. **Dashboard** (`/`) — empire overview: stats, building resources, members. Data from `/api/empire`.
2. **Settlement** (`/settlement`) — tier timeline, upgrade requirements, item availability. Data from `/api/settlement`.
3. **Craft Planner** (`/craft`) — recursive crafting tree calculator with inventory awareness (player or claim).
4. **Traveler Tasks** (`/traveler-task`) — traveler task viewing with craft planning integration.

## Key Decisions

- **Cloudflare Workers**: Migrated from Bun-native server. Hono for routing, CF asset binding for SPA serving.
- **Vite for client build**: Replaced Bun's HTML imports with Vite + @preact/preset-vite for standard tooling.
- **`run_worker_first`**: Only `/api/*` and `/jita/*` routes invoke the worker; all other routes go to static assets with SPA fallback.
- **Preact SPA with @nanostores/router**: Client-side routing.
- **Server/client code split**: `@croct/cache` isolated to `src/server/api-server.ts`. Client uses plain `BitJitaClient`.
- **BitJita-only API**: Removed all Resubaka API usage. Single upstream: `https://bitjita.com`.
- **Shared types in ordum-types.ts**: Client can import types without pulling in server dependencies.
- **nanostores `computedAsync`** from `Fryuni/nanostores#async-compute` for async derived stores.
- Entity IDs use **string form** in API URLs (exceed `Number.MAX_SAFE_INTEGER`).
- Skip "Package"/"Unpack"/"Recraft" recipes in craft planner to avoid cycles.
- Ordum City claim ID: `"1224979098661645606"`.

## Milestones

- [x] BitJita API client generator (77 endpoints)
- [x] Empire resource dashboard
- [x] Game data download + update script
- [x] Settlement planner (tiers 1-10)
- [x] Craft planner with recursive recipe resolution
- [x] Settlement → Craft integration (pre-populated deficit items)
- [x] Inventory stores with item location tracking (ItemPlace[])
- [x] Migrate from Svelte to Preact (TSX)
- [x] Rewrite: Astro → Bun server + Preact SPA
- [x] Transition to BitJita-only API (removed Resubaka)
- [x] **Migrate to Cloudflare Workers + Vite** (from Bun server)
- [x] **CI/CD via GitHub Actions → Cloudflare Workers**
- [ ] Add other empire claims (need claim IDs from user)
- [ ] Live updates via WebSocket
