# Ordum Dashboard

A web dashboard for the **Ordum** empire in [Bitcraft](https://bitcraftonline.com/), providing resource tracking, settlement planning, and crafting tools.

Built with [Astro](https://astro.build/) + [Preact](https://preactjs.com/) and powered by live data from the [bitcraft-hub](https://github.com/ResuBaka/bitcraft-hub) API.

## Features

### 📊 Empire Dashboard (`/`)

Overview of the Ordum empire's resources across all claims:

- Building storage inventory (excluding personal bank storage)
- Player inventories (online + offline)
- Tool inventories
- Member list with skills, permissions, and inventory details
- Searchable, sortable, and filterable tables

### 🏰 Settlement Planner (`/settlement`)

Track settlement upgrade progress across tiers 1–10:

- Visual timeline showing completed, active, and upcoming tiers
- Item requirements for the next tier upgrade with progress bars
- Available vs required quantities from claim building storage
- One-click link to the Empire Craft Planner with missing items pre-filled

### ⚒️ Craft Planner (`/craft`)

Calculate full crafting trees from raw materials:

- Search 7,000+ items and cargo by name
- Recursive recipe resolution down to raw (gathered) materials
- Handles recipe cycles (packaging, farming loops) gracefully
- Topologically sorted crafting steps — dependencies always come first
- Player inventory-aware: shows what you already have
- Filter results by item name or tier

### 🏰 Empire Craft Planner (`/group-craft`)

Same crafting UI as the Craft Planner, but uses the **Ordum claim's building storage** as inventory instead of a player's personal inventory. Useful for planning what the empire needs to craft collectively.

## Tech Stack

| Layer      | Technology                                                                                 |
| ---------- | ------------------------------------------------------------------------------------------ |
| Framework  | [Astro 6](https://astro.build/) (SSR, `@astrojs/node`)                                     |
| UI         | [Preact](https://preactjs.com/) (TSX)                                                      |
| State      | [nanostores](https://github.com/nanostores/nanostores) with `computedAsync`                |
| Runtime    | [Bun](https://bun.sh/)                                                                     |
| API        | Auto-generated TypeScript client (33 REST + 26 WebSocket endpoints)                        |
| Game Data  | Static JSON from [BitCraft_GameData](https://github.com/BitCraftToolBox/BitCraft_GameData) |
| Styling    | Vanilla CSS with custom properties                                                         |
| Formatting | [Prettier](https://prettier.io/)                                                           |

## Getting Started

### Prerequisites

- [Bun](https://bun.sh/) v1.3+

### Installation

```bash
git clone https://github.com/user/ordum-dashboard.git
cd ordum-dashboard
bun install
```

### Update Game Data

Download the latest game data files (items, recipes, buildings, etc.):

```bash
./scripts/update-gamedata.sh
```

### Development

```bash
bun dev
```

The dashboard is served at `http://localhost:4321`.

### Production Build

```bash
bun run build
bun run preview
```

## Project Structure

```
gamedata/                               — Static game data JSON files (7K items, 7K recipes, etc.)
scripts/
  update-gamedata.sh                    — Download game data from GitHub
  generate-api-client.ts                — Generate TypeScript API client from server
  add-license-headers.ts                — Add GPL-3.0 headers to source files
src/
  bitcraft-api-client.ts                — Auto-generated API client (REST + WebSocket)
  actions/index.ts                      — Astro Actions: searchItems, craftPlan, groupCraftPlan
  lib/
    gamedata.ts                         — Game data parser and indexer
    ordum-data.ts                       — Live API data fetcher for Ordum claims
    claim-inventory.ts                  — Claim inventory builder (excludes bank storage)
    settlement-planner.ts               — Settlement tier upgrade calculator
    craft-planner.ts                    — Recursive crafting recipe resolver
    craft-store.ts                      — Nanostores for craft planner (player inventory)
    group-craft-store.ts                — Nanostores for empire craft planner (claim inventory)
    topological-sort.ts                 — Generic topological sort (Tarjan SCC + Kahn's)
  pages/
    index.astro                         — Empire dashboard
    settlement.astro                    — Settlement planner
    craft.astro                         — Player craft planner
    group-craft.astro                   — Empire craft planner
  components/
    craft/                              — Craft planner Preact components
    group-craft/                        — Empire craft planner Preact components
    TierPlan.astro                      — Settlement tier card
    ResourceTable.astro                 — Filterable resource table
    MembersTable.astro                  — Member list with skills
    StatCard.astro                      — KPI stat card
  layouts/Layout.astro                  — App shell with sidebar navigation
  styles/craft.css                      — Shared craft planner styles
```

## Configuration

The Ordum empire's claim IDs are configured in `src/lib/ordum-data.ts`:

```typescript
export const ORDUM_MAIN_CLAIM_ID = "1224979098661645606";

export const EMPIRE_CLAIM_IDS: { id: string; name: string }[] = [
  { id: "1224979098661645606", name: "Ordum City" },
  // Add other claims here
];
```

> **Note:** Entity IDs use string form because they exceed `Number.MAX_SAFE_INTEGER`.

The API server URL is also configured there:

```typescript
export const API_BASE_URL = "https://craft-api.resubaka.dev";
```

## Scripts

| Command                                      | Description                         |
| -------------------------------------------- | ----------------------------------- |
| `bun dev`                                    | Start development server            |
| `bun run build`                              | Production build                    |
| `bun run preview`                            | Preview production build            |
| `bun test`                                   | Run unit tests                      |
| `bunx prettier -w .`                         | Format all source files             |
| `bun scripts/add-license-headers.ts`         | Add GPL-3.0 headers to source files |
| `bun scripts/add-license-headers.ts --check` | Check for missing headers (CI)      |
| `./scripts/update-gamedata.sh`               | Download latest game data           |
| `bun scripts/generate-api-client.ts`         | Regenerate API client from server   |

## License

This project is licensed under the **GNU General Public License v3.0** — see the [LICENSE](LICENSE) file for details.

Copyright (C) 2026 Luiz Ferraz
