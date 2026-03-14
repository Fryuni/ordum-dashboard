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
