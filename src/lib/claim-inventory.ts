/**
 * Build an inventory map from claim API data, excluding personal bank storage.
 *
 * Town Banks, Ancient Banks, and Lost Items Chests are personal storage
 * buildings — their contents belong to individual players, not the claim.
 */

/** Building description IDs for bank buildings (personal storage) */
const BANK_BUILDING_IDS = new Set([
  985246037,  // Town Bank
  1615467546, // Ancient Bank
  969744821,  // Lost Items Chest
]);

/**
 * Build a Map<"ItemType:id", quantity> from a claim's API response,
 * using inventory_locations (which has per-building detail) to exclude banks.
 *
 * Includes: building storage (non-bank) + online/offline player inventories.
 */
export function buildClaimInventory(claim: any): Map<string, number> {
  const inventory = new Map<string, number>();

  // Building inventories — use inventory_locations for building-level filtering
  const buildingLocs = (claim.inventory_locations as any)?.buildings ?? [];
  for (const loc of buildingLocs) {
    const key = `${loc.item_type ?? "Item"}:${loc.item_id}`;
    let total = 0;
    for (const l of loc.locations ?? []) {
      // Skip bank buildings
      if (BANK_BUILDING_IDS.has(l.building_description_id)) continue;
      total += l.quantity ?? 0;
    }
    if (total > 0) {
      inventory.set(key, (inventory.get(key) ?? 0) + total);
    }
  }

  // Player inventories (online + offline)
  for (const section of ["players", "players_offline"]) {
    const playerInv = (claim.inventorys as any)?.[section] ?? [];
    for (const item of playerInv) {
      const key = `${item.item_type ?? "Item"}:${item.item_id}`;
      inventory.set(key, (inventory.get(key) ?? 0) + (item.quantity ?? 0));
    }
  }

  return inventory;
}
