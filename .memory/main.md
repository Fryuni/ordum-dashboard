# Ordum Dashboard — Project Roadmap

## Purpose
Dashboard/tooling project for Bitcraft game data, built around a generated TypeScript API client that talks to the [bitcraft-hub](https://github.com/ResuBaka/bitcraft-hub) Rust API server at `https://craft-api.resubaka.dev`.

## Current State
- **Full API client complete**: `generate-api-client.ts` fetches Rust source from GitHub, parses routes/structs/enums, and emits `src/bitcraft-api-client.ts`:
  - 33 REST endpoints with typed params and responses
  - 26 WebSocket message types as a typed discriminated union
  - `BitcraftApiClient` (REST) and `BitcraftLiveClient` (WebSocket) classes
  - Zero TypeScript strict-mode errors
- **Tested against production**: Both REST and WebSocket verified against live server.

## Key Decisions Made
- Generator fetches live from GitHub (not hard-coded) — run `bun run generate-api-client.ts` to re-generate
- Bracket-aware Rust parser handles nested generics, module-path types, cross-module handler resolution
- Entity `Model` types emitted as typed interfaces (e.g. `PlayerStateModel`, `ActionStateModel`)
- Deduplication keeps shortest path when multiple routes alias the same handler; colliding handler names disambiguated via path
- WebSocket client uses typed `subscribe<T>()` with discriminated union for compile-time safety
- Auto-reconnect with topic re-subscription on reconnect
- Bun as runtime

## Milestones
- [x] REST API client generator (33 endpoints, 46 types)
- [x] WebSocket live-data client (26 message types, typed subscribe/unsubscribe)
- [x] TypeScript strict-mode clean
- [x] Tested against production
- [ ] Full dashboard UI

## Architecture
- `generate-api-client.ts` → parses GitHub source → emits `src/bitcraft-api-client.ts`
- `test-api-client.ts` → smoke test (needs `BITCRAFT_API_URL` env var)
- API server: `https://craft-api.resubaka.dev`
