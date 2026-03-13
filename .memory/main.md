# Ordum Dashboard — Project Roadmap

## Purpose

Dashboard for the Ordum empire in Bitcraft, built with Astro + the generated TypeScript API client talking to the [bitcraft-hub](https://github.com/ResuBaka/bitcraft-hub) Rust API server at `https://craft-api.resubaka.dev`.

## Current State

- **Full API client**: `src/bitcraft-api-client.ts` — 33 REST endpoints, 26 WebSocket message types
- **Game data**: 14 static JSON files in `gamedata/` from BitCraftToolBox/BitCraft_GameData (7K items, 7K recipes, 146 claim techs)
- **Four working pages**:
  1. **Dashboard** (`/`) — empire resource overview: buildings, player inventories, tools, members with skills
  2. **Settlement Planner** (`/settlement`) — tiers 1-10 timeline, shows only TierUpgrade requirements per tier, items sorted by tier; "Craft Missing Items" button links to Group Craft with deficit items pre-populated
  3. **Craft Planner** (`/craft`) — item search + full recursive crafting tree from raw materials, player inventory-aware
  4. **Group Craft Planner** (`/group-craft`) — same UI as craft planner but uses Ordum claim's combined inventory (buildings + all players); supports pre-populated items from settlement planner via URL params
- **Astro Actions** (`src/actions/index.ts`) — type-safe server endpoints: `searchItems`, `craftPlan`, `groupCraftPlan`
- **nanostores with computedAsync** — using `Fryuni/nanostores#async-compute` (PR #383) for async derived stores
- **Preact** for interactive components (migrated from Svelte)
- **Astro server mode** with `@astrojs/node` adapter

## Key Files

```
scripts/update-gamedata.sh              — downloads game data from GitHub
src/bitcraft-api-client.ts              — auto-generated API client (REST + WebSocket)
src/lib/gamedata.ts                     — game data parser/indexer
src/lib/ordum-data.ts                   — live API data fetcher for Ordum claims
src/lib/settlement-planner.ts           — settlement upgrade requirement calculator (tiers 1-10, tier-upgrade-only)
src/lib/craft-planner.ts               — recursive recipe resolver (handles cycles)
src/lib/craft-store.ts                  — nanostores for craft planner state (uses computedAsync)
src/lib/group-craft-store.ts            — nanostores for group craft planner (claim inventory)
src/actions/index.ts                    — Astro actions: searchItems, craftPlan, groupCraftPlan
src/pages/index.astro                   — main dashboard
src/pages/settlement.astro              — settlement planner page
src/pages/craft.astro                   — craft planner page
src/pages/group-craft.astro             — group craft planner page (claim inventory)
src/components/craft/                   — split craft planner components (Preact TSX):
  CraftConfiguration.tsx                — config block (player + item picker + item list + buttons)
  PlayerPicker.tsx                      — typeahead player search dropdown
  ItemPicker.tsx                        — item search with dropdown + quantity input
  ItemList.tsx                          — target item chips with remove
  CraftingPlan.tsx                      — results display (player context + plan cards)
  RawMaterials.tsx                      — raw material grid with progress bars
  CraftingSteps.tsx                     — timeline wrapper for craft steps
  CraftStep.tsx                         — single crafting step with inputs grid
src/components/group-craft/             — group craft planner components (Preact TSX):
  GroupCraftConfiguration.tsx           — config block (claim context + item picker + list)
  GroupItemPicker.tsx                   — item search (wired to group store)
  GroupItemList.tsx                     — target item chips (wired to group store)
  GroupCraftingPlan.tsx                 — results display (reuses RawMaterials + CraftingSteps)
  GroupCraftInit.tsx                    — invisible init component for URL param pre-population
src/components/                         — ResourceTable, MembersTable, StatCard, TierPlan
```

## Workflow

- **Run `bunx prettier -w .` before every commit** to ensure consistent formatting
- **Always `git commit` after completing each objective** the user gives

## Key Decisions

- Entity IDs use **string form** in API URLs (exceed `Number.MAX_SAFE_INTEGER`)
- Skip "Package"/"Unpack" recipes in craft planner to avoid cycles
- Max recipe resolution depth: 15
- Ordum City claim ID: `"1224979098661645606"` — empire claims configurable in `EMPIRE_CLAIM_IDS`
- Bun as runtime, Astro 6 beta
- **nanostores `computedAsync`** replaces manual `$loading`/`$error` atoms — craft plan is an `AsyncValue<T>` store derived from a `$craftRequest` trigger atom
- **Astro Actions** replace `/api/` routes — provides type-safe server functions with Zod validation
- **Component decomposition**: CraftPlanner split into 8 focused components for maintainability
- **Preact over Svelte**: TSX files > separate `.svelte` filetype; nanostores via `@nanostores/preact` `useStore()` hook
- **Settlement planner shows only TierUpgrade** requirements per tier (not all researches) for cleaner UX
- **Group craft planner** uses separate `group-craft-store.ts` with own persistent atoms (`groupCraftItems` key) to avoid conflicts with individual craft planner

## Milestones

- [x] REST API client generator
- [x] WebSocket live-data client
- [x] Empire resource dashboard
- [x] Game data download + update script
- [x] Settlement planner
- [x] Craft planner with recursive recipe resolution
- [x] Migrate to Astro actions (type-safe server endpoints)
- [x] Split CraftPlanner into focused sub-components
- [x] Adopt computedAsync for async state management
- [x] Migrate from Svelte to Preact (TSX)
- [x] Settlement planner: tiers 1-10, tier-upgrade-only, tier-sorted items
- [x] Group Craft planner with claim inventory
- [x] Settlement → Group Craft integration (pre-populated deficit items)
- [ ] Add other empire claims (need claim IDs from user)
- [ ] Live updates via WebSocket
