# Ordum Dashboard — Project Roadmap

## Purpose

Dashboard for the Ordum empire in Bitcraft. A Preact SPA on Cloudflare Workers, with the BitJita API as the sole data source.
- **BitJita**: `https://bitjita.com` — game data API (77 endpoints)
- **Live**: `https://ordum.fun`

## Current State

**Architecture**: Cloudflare Workers (Hono) + Preact SPA (Vite) + Cloudflare D1 (storage audit).

- **Worker**: `src/worker.ts` — Hono app with API routes and `/jita/*` proxy to BitJita
- **Client**: Preact SPA with `@nanostores/router` for routing, nanostores for state
- **Build**: Vite builds client to `dist/client/`, Wrangler bundles worker
- **Storage**: KV for API cache, D1 (`ordum-storage-audit`) for storage audit log persistence
- **Dev**: `bun dev` — runs Vite (HMR on :4321, proxies API to :8787) + Wrangler (:8787) concurrently
- **Deploy**: `bun run deploy` or GitHub Actions CI

**Code layout**:
```
src/worker.ts              — Cloudflare Worker entry (Hono app)
src/client/                — Preact SPA
  pages/                   — Page components (Dashboard, Settlement, Craft, TravelerTask, Construction, Contribution, StorageAudit)
  stores/                  — Nanostores (router, craft, craftSource, player, travelerTask, contribution)
  components/              — UI components
src/server/                — Server-only code
  api-server.ts            — Cached BitJitaClient (@croct/cache + ohash)
  ordum-data.ts            — Empire data fetcher
  contribution.ts          — Per-player contribution tracker (KV-backed)
  storage-audit.ts         — Storage audit: D1 ingestion + query
src/common/                — Shared code
schema.sql                 — D1 schema for storage audit
wrangler.toml              — CF Workers config (KV + D1 bindings)
```

**Seven pages**:
1. **Dashboard** (`/`) — empire overview
2. **Settlement** (`/settlement`) — tier upgrade planning
3. **Construction** (`/construction`) — active construction projects
4. **Craft Planner** (`/craft`) — recursive crafting calculator
5. **Traveler Tasks** (`/traveler-task`) — task viewing
6. **Contribution** (`/contribution`) — per-player deposit/withdrawal totals
7. **Storage Audit** (`/storage-audit`) — full item movement log with chart, filters, pagination

## Key Decisions

- **Cloudflare Workers**: Hono for routing, CF asset binding for SPA serving.
- **Preact SPA with @nanostores/router**: Client-side routing.
- **BitJita-only API**: Single upstream: `https://bitjita.com`.
- **D1 for Storage Audit**: Persistent log cache. Incremental ingestion per-building (storage buildings only, 64 of 510 total). Each API request ingests up to 5 pages from BitJita for stale buildings, then queries D1 for paginated/filtered results.
- **Storage Audit ingestion strategy**: Round-robin over claim's storage buildings. Track `newest_log_id` per building in `storage_fetch_state` table. 60s cooldown per building. Fetches newest-first, stops at cursor. Client auto-refreshes while `ingesting: true`.
- Entity IDs use **string form** in API URLs (exceed `Number.MAX_SAFE_INTEGER`).
- Ordum City claim ID: `"1224979098661645606"`.

## Milestones

- [x] BitJita API client generator (77 endpoints)
- [x] Empire resource dashboard
- [x] Settlement planner (tiers 1-10)
- [x] Craft planner with recursive recipe resolution
- [x] Migrate to Cloudflare Workers + Vite
- [x] CI/CD via GitHub Actions → Cloudflare Workers
- [x] Construction page
- [x] Contribution tracker (per-player)
- [x] **Storage Audit page** — D1-backed log cache, per-building ingestion, chart + paginated table with claim/player/item filters
- [ ] Add other empire claims (need claim IDs from user)
- [ ] Live updates via WebSocket
