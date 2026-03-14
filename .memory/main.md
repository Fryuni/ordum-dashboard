# Ordum Dashboard — Project Roadmap

## Purpose

Dashboard for the Ordum empire in Bitcraft. A Bun-native fullstack app with a Preact SPA client, talking to the [bitcraft-hub](https://github.com/ResuBaka/bitcraft-hub) Rust API server at `https://craft-api.resubaka.dev`.

## Current State

**Architecture**: Direct Bun HTTP server with HTML imports for automatic client bundling.

- **Entrypoint**: `src/server.ts` — `Bun.serve()` with `routes` for SPA (`/*`), server endpoints (`/api/empire`, `/api/settlement`), and API proxy (`/api/*`)
- **Client**: Preact SPA with `@nanostores/router` for routing, nanostores for state
- **No separate build scripts** — Bun's HTML import handles TSX/CSS bundling automatically
- **Dev**: `bun --hot src/server.ts` (HMR, on-demand bundling)
- **Build**: `bun build --target=bun --minify --outdir=dist src/server.ts`
- **Production**: `cd dist && bun run server.js` (self-contained, no node_modules needed)

**Code layout**:
```
src/server.ts              — Bun.serve entrypoint (HTML import, API routes, proxy)
src/client/                — Preact SPA
  index.html               — HTML entry (references client.tsx + styles.css)
  client.tsx               — Preact render entry
  App.tsx                  — Root component with router
  styles.css               — All global styles
  components/              — UI components (StatCard, ResourceTable, MembersTable, TierPlan, craft/*, group-craft/*)
  pages/                   — Page components (Dashboard, Settlement, Craft, GroupCraft)
  stores/                  — Nanostores (router, craft, craftSource)
  util-store.ts            — Page activity and update timer
src/server/                — Server-only code
  api-server.ts            — Cached BitcraftApiClient (@croct/cache + ohash)
  ordum-data.ts            — Empire data fetcher (builds ClaimSummary/EmpireSummary)
src/common/                — Shared code (neither client nor server specific)
  bitcraft-api-client.ts   — Auto-generated REST + WebSocket client (33 endpoints)
  api.ts                   — Plain (uncached) client instance
  ordum-types.ts           — Shared types (EmpireSummary, ClaimSummary, ResourceItem, MemberInfo, etc.)
  gamedata.ts              — Static game data parser/indexer (items, recipes, techs, etc.)
  craft-planner.ts         — Recursive recipe resolver
  settlement-planner.ts    — Settlement tier upgrade calculator
  claim-inventory.ts       — Claim building inventory builder
  itemIndex.ts             — Item search index
  lazy.ts                  — Lazy/LazyKeyed utilities (replaces @inox-tools/utils)
  topological-sort.ts      — Generic topological sort (Tarjan SCC + Kahn)
```

**Four pages**:
1. **Dashboard** (`/`) — empire overview: stats, building/player/tool resources, members. Data fetched client-side from `/api/empire`.
2. **Settlement** (`/settlement`) — tier timeline, upgrade requirements, item availability. Data fetched from `/api/settlement`.
3. **Craft Planner** (`/craft`) — recursive crafting tree calculator with player inventory awareness.
4. **Empire Craft** (`/group-craft`) — same as craft planner but using claim building storage.

## Key Decisions

- **Bun-native (no framework)**: Replaced Astro with direct `Bun.serve()` + HTML imports. Single tool for server, bundling, and HMR.
- **Preact SPA with @nanostores/router**: Client-side routing replaces Astro's file-based pages.
- **Server/client code split**: `@croct/cache` (uses Node `crypto` via `node-object-hash`) isolated to `src/server/api-server.ts`. Client uses plain `BitcraftApiClient`.
- **Shared types in ordum-types.ts**: Extracted from `ordum-data.ts` so client can import types without pulling in server dependencies.
- **`src/common/lazy.ts`**: Minimal replacement for `@inox-tools/utils/lazy` (Lazy.wrap, LazyKeyed.wrap/of).
- **nanostores `computedAsync`** from `Fryuni/nanostores#async-compute` for async derived stores.
- Entity IDs use **string form** in API URLs (exceed `Number.MAX_SAFE_INTEGER`).
- Skip "Package"/"Unpack"/"Recraft" recipes in craft planner to avoid cycles.
- Ordum City claim ID: `"1224979098661645606"`.
- Dashboard/Settlement pages fetch data from server endpoints (`/api/empire`, `/api/settlement`) rather than server-rendering.

## Milestones

- [x] REST API client generator
- [x] WebSocket live-data client
- [x] Empire resource dashboard
- [x] Game data download + update script
- [x] Settlement planner (tiers 1-10, tier-upgrade-only)
- [x] Craft planner with recursive recipe resolution
- [x] Group Craft planner with claim inventory
- [x] Settlement → Group Craft integration (pre-populated deficit items)
- [x] Migrate from Svelte to Preact (TSX)
- [x] Adopt computedAsync for async state management
- [x] **Rewrite: Astro → Bun server + Preact SPA** (HTML imports, @nanostores/router)
- [x] **Reorganize: src/client + src/server + src/common structure**
- [ ] Add other empire claims (need claim IDs from user)
- [ ] Live updates via WebSocket
