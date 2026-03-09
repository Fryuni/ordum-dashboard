# Ordum Dashboard — Project Roadmap

## Purpose
Dashboard for the Ordum empire in Bitcraft, built with Astro + the generated TypeScript API client talking to the [bitcraft-hub](https://github.com/ResuBaka/bitcraft-hub) Rust API server at `https://craft-api.resubaka.dev`.

## Current State
- **Full API client**: `src/bitcraft-api-client.ts` — 33 REST endpoints, 26 WebSocket message types
- **Game data**: 14 static JSON files in `gamedata/` from BitCraftToolBox/BitCraft_GameData (7K items, 7K recipes, 146 claim techs)
- **Three working pages**:
  1. **Dashboard** (`/`) — empire resource overview: buildings, player inventories, tools, members with skills
  2. **Settlement Planner** (`/settlement`) — shows all researches needed per tier, items required vs available in claim storage
  3. **Craft Planner** (`/craft`) — item search + full recursive crafting tree from raw materials, player inventory-aware
- **API routes**: `/api/search-items`, `/api/craft-plan` for client-side interactivity
- **Astro server mode** with `@astrojs/node` adapter

## Key Files
```
scripts/update-gamedata.sh       — downloads game data from GitHub
src/bitcraft-api-client.ts       — auto-generated API client (REST + WebSocket)
src/lib/gamedata.ts              — game data parser/indexer
src/lib/ordum-data.ts            — live API data fetcher for Ordum claims
src/lib/settlement-planner.ts    — settlement upgrade requirement calculator
src/lib/craft-planner.ts         — recursive recipe resolver (handles cycles)
src/pages/index.astro            — main dashboard
src/pages/settlement.astro       — settlement planner page
src/pages/craft.astro            — craft planner page
src/pages/api/                   — API routes for craft planner
src/components/                  — ResourceTable, MembersTable, StatCard, TierPlan
```

## Key Decisions
- Entity IDs use **string form** in API URLs (exceed `Number.MAX_SAFE_INTEGER`)
- Skip "Package"/"Unpack" recipes in craft planner to avoid cycles
- Max recipe resolution depth: 15
- Ordum City claim ID: `"1224979098661645606"` — empire claims configurable in `EMPIRE_CLAIM_IDS`
- Bun as runtime, Astro 6 beta

## Milestones
- [x] REST API client generator
- [x] WebSocket live-data client
- [x] Empire resource dashboard
- [x] Game data download + update script
- [x] Settlement planner
- [x] Craft planner with recursive recipe resolution
- [ ] Add other empire claims (need claim IDs from user)
- [ ] Live updates via WebSocket
