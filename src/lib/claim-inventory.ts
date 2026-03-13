/**
 * Copyright (C) 2026 Luiz Ferraz
 *
 * This file is part of Ordum Dashboard.
 *
 * Ordum Dashboard is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * Ordum Dashboard is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with Ordum Dashboard. If not, see <https://www.gnu.org/licenses/>.
 */
/**
 * Build an inventory map from claim API data, excluding personal storage.
 *
 * Town Banks, Ancient Banks, and Lost Items Chests are personal storage
 * buildings — their contents belong to individual players, not the claim.
 * Player pocket inventories are also personal, not claim property.
 */

/** Building description IDs for bank buildings (personal storage) */
export const BANK_BUILDING_IDS = new Set([
  985246037, // Town Bank
  1615467546, // Ancient Bank
  969744821, // Lost Items Chest
]);

/**
 * Build a Map<"ItemType:id", quantity> from a claim's API response,
 * using only claim building storage (non-bank). Player inventories are excluded
 * since those items belong to individual players, not the claim.
 */
export function buildClaimInventory(claim: any): Map<string, number> {
  const inventory = new Map<string, number>();

  // Building inventories — use inventory_locations for building-level filtering
  const buildingLocs = (claim.inventory_locations as any)?.buildings ?? [];
  for (const loc of buildingLocs) {
    const key = `${loc.item_type ?? "Item"}:${loc.item_id}`;
    let total = 0;
    for (const l of loc.locations ?? []) {
      // Skip bank buildings (personal storage)
      if (BANK_BUILDING_IDS.has(l.building_description_id)) continue;
      total += l.quantity ?? 0;
    }
    if (total > 0) {
      inventory.set(key, (inventory.get(key) ?? 0) + total);
    }
  }

  return inventory;
}
