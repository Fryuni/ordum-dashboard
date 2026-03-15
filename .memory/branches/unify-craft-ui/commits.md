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
