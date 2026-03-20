# Ordum Dashboard — Project Roadmap

## Purpose

Dashboard for the Ordum empire in Bitcraft. A Preact SPA on Cloudflare Workers, with the BitJita API as the sole data source.
- **BitJita**: `https://bitjita.com` — game data API (77 endpoints)
- **Live**: `https://ordum.fun`

## Current State

**Architecture**: Cloudflare Workers (Hono) + Preact SPA (Vite) + Cloudflare D1 (storage audit).

- **Worker**: `src/worker.ts` — Hono app with API routes, `/jita/*` proxy to BitJita, and cron-triggered ingestion
- **Client**: Preact SPA with `@nanostores/router` for routing, nanostores for state
- **Build**: Vite builds client to `dist/client/`, Wrangler bundles worker
- **Storage**: KV for API cache, D1 (`ordum-storage-audit`) for storage audit log persistence
- **Cron**: Every 5 min, ingests storage logs from BitJita into D1 (up to 10 rounds per invocation)
- **Dev**: `bun dev` — runs Vite (HMR on :4321, proxies API to :8787) + Wrangler (:8787) concurrently
- **Deploy**: `bun run deploy` or GitHub Actions CI

**Code layout**:
```
src/worker.ts              — Cloudflare Worker entry (Hono app + scheduled handler)
src/client/                — Preact SPA
  pages/                   — Page components (Dashboard, Settlement, Craft, TravelerTask, Construction, Contribution, StorageAudit)
  stores/                  — Nanostores (router, craft, craftSource, player, travelerTask, contribution, storageAudit)
  components/              — UI components
src/server/                — Server-only code
  storage-audit.ts         — Storage audit: D1 ingestion (ingestLogs) + query (queryStorageAudit)
  contribution.ts          — Per-player contribution tracker (KV-backed)
  api-server.ts            — Cached BitJitaClient
src/common/                — Shared code
schema.sql                 — D1 schema for storage audit
wrangler.toml              — CF Workers config (KV + D1 bindings + cron trigger)
```

**Seven pages**:
1. **Dashboard** (`/`) — empire overview
2. **Settlement** (`/settlement`) — tier upgrade planning
3. **Construction** (`/construction`) — active construction projects
4. **Craft Planner** (`/craft`) — recursive crafting calculator
5. **Traveler Tasks** (`/traveler-task`) — task viewing
6. **Contribution** (`/contribution`) — per-player deposit/withdrawal totals
7. **Storage Audit** (`/storage-audit`) — full item movement log with candlestick chart, filters, pagination, sync button

## Key Decisions

- **Always use nanostores for client state**: `persistentAtom` for user selections, `computedAsync` for API-driven data, `computed` for derived state. Avoid `useState`/`useEffect` for data fetching. Local `useState` only for small UI details.
- **Consolidate useStore calls**: Multiple `useStore` subscriptions in one component can cause DOM duplication in Preact due to independent setTimeout-batched re-renders. Combine related stores into a single `computed` view store (e.g. `$auditView`).
- **Cron for ingestion**: Storage audit ingestion runs via Cloudflare cron trigger (every 5 min), not on the request path. `GET /api/storage-audit` is a pure D1 read — always fast. On-demand sync via `POST /api/storage-audit/ingest`.
- **Storage Audit ingestion strategy**: Round-robin over claim's storage buildings (~64 with storage). Track `newest_log_id` per building in `storage_fetch_state`. 60s cooldown. Fetches newest-first, stops at cursor. Up to 5 buildings × 5 pages per invocation; cron does 10 rounds.
- **BitJita-only API**: Single upstream: `https://bitjita.com`.
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
- [x] **Storage Audit page** — D1-backed log cache, cron ingestion, hourly candlestick chart, paginated table with claim/player/item filters, on-demand sync button
- [ ] Add other empire claims (need claim IDs from user)
- [ ] Live updates via WebSocket
