# unify-craft-ui

**Purpose:** Merge CraftPage and GroupCraftPage into a single unified craft page with inventory source selector

---

## Commit d9bf1b4d | 2026-03-14T22:06:29.366Z

### Branch Purpose

Merge CraftPage and GroupCraftPage into a single unified craft page with an inventory source selector (player inventory or claim dropdown).

### Previous Progress Summary

Initial commit.

### This Commit's Contribution

- Unified the crafting experience by merging `GroupCraftPage` into `CraftPage`, removing the dedicated `/group-craft` route in favor of a persistent source selector.
- Introduced `$inventorySource` persistent atom in `craftSource.ts` to manage switching between player inventory and specific claim inventories.
- Added `/api/empire-claims` server endpoint to dynamically fetch the Ordum empire's claims from BitJita, improving reliability over hardcoded lists.
- Implemented `InventorySourcePicker` component, providing a unified UI for selecting the inventory context (Player or Claim).
- Updated `SettlementPage` "Craft Missing Items" links to target the unified `/craft` route while auto-selecting the relevant claim inventory.
- Simplified state management by removing the route-dependent `selectorAtom` and `$routeName` logic.
- Cleaned up the codebase by deleting `GroupCraftPage.tsx` and `GroupCraftConfiguration.tsx`.

---

## Commit c17db5d1 | 2026-03-15T01:32:15.762Z

### Branch Purpose

Merge player and claim crafting into a unified experience with empire-wide inventory awareness and automated planning for settlement and traveler requirements.

### Previous Progress Summary

Unified the crafting experience by merging `GroupCraftPage` into a single `CraftPage` with a persistent `$inventorySource` selector, replacing route-based state management. Added a dynamic `/api/empire-claims` endpoint to fetch claim data from BitJita and integrated the `SettlementPage` with a claim selector that preserves context when navigating to the planner.

### This Commit's Contribution

- Refactored inventory stores to track item locations: `$playerInventory` and `$claimInventory` now produce `Map<string, ItemPlace[]>` to distinguish between items held in player inventory and those in specific claim containers.
- Introduced `$inventoryTotals` as a computed store that flattens location-aware data into the simple `Map<string, number>` format required by `buildCraftPlan`.
- Created an `unwrapAsync` helper to cleanly handle `computedAsync` values inside standard `computed` stores, reducing boilerplate for handling loading/failed states.
- Implemented the Traveler's Task page, which fetches open tasks from the API and leverages the unified crafting engine to calculate requirements for all pending items.
- Enhanced `PlanCard` to show inventory location tooltips on "Already have" chips, providing immediate feedback on where required items are currently stored.

---

## Commit 70df7198 | 2026-03-16T21:10:54.027Z

### Branch Purpose

Unify the crafting experience into a single interface with location-aware inventory tracking and replace the legacy Resubaka API with the BitJita API for all game data.

### Previous Progress Summary

Unified the player and claim crafting interfaces into a single `CraftPage` using a persistent `$inventorySource` selector. Refactored the inventory system to track specific item locations (e.g., which chest or backpack) and implemented styled tooltips to display this breakdown in the planner. Added a dedicated Traveler’s Tasks page and integrated settlement planning to auto-populate the crafting engine with deficit requirements.

### This Commit's Contribution

- Completed the transition to BitJita API by removing all Resubaka API usage, the server-side proxy route, and the `CachedResubaka` client.
- Implemented a fully typed BitJita client based on API probing, adding structures for `JitaPlayerDetail`, `JitaClaimDetail`, `JitaClaimBuildingInventory`, and `JitaTravelerTask`.
- Mapped legacy Resubaka endpoints to BitJita equivalents: `listPlayers` (search → q), `findPlayerById` → `getPlayer`, and `getClaim` (now synthesized from multiple BitJita calls for research and members).
- Refactored inventory fetching to use `getPlayerInventories` and `getClaimInventories`, mapping the numeric `itemType` (0=Item, 1=Cargo) to the local domain model.
- Updated the settlement endpoint to handle the new `ItemPlace[]` inventory format, ensuring correct deficit calculation for claim-based crafting.
- Streamlined traveler task management by using BitJita's inline task descriptions, removing the need for separate NPC data lookups.
- Retained `resubaka-client.ts` as a non-imported reference file to assist with any future mapping needs during the transition.
