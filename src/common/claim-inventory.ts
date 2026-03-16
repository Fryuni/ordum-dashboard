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

import z from "zod";
import { jita } from "./api";
import { gd, realItemStack, referenceKey } from "./gamedata";

/** Building description IDs for bank buildings (personal storage) */
export const BANK_BUILDING_IDS = new Set([
  985246037, // Town Bank
  1615467546, // Ancient Bank
  969744821, // Lost Items Chest
]);

export interface ItemPlace {
  name: string;
  quantity: number;
}

export const jitaCraftSchema = z.array(
  z.object({
    recipeId: z.int(),
    buildingName: z.string(),
    actionsRequiredPerItem: z.int(),
    craftCount: z.int(),
    progress: z.int(),
    totalActionsRequired: z.int(),
    ownerEntityId: z.string(),
    ownerUsername: z.string(),
  }),
);

export type JitaCraft = z.infer<typeof jitaCraftSchema>[number];

/**
 * Add crafting-in-progress items to an inventory map.
 * For each craft, consumed items (remaining) and crafted items (completed)
 * are added with descriptive labels.
 */
export function addCraftsToInventory(
  inventory: Map<string, ItemPlace[]>,
  crafts: JitaCraft[],
): void {
  for (const craft of crafts) {
    const recipe = gd.recipesById.get(craft.recipeId);
    if (!recipe) continue;

    const completed = Math.floor(craft.progress / craft.actionsRequiredPerItem);
    const remaining = craft.craftCount - completed;

    const items = [
      ...realItemStack(recipe.consumed_item_stacks, remaining).map((item) => ({
        item,
        verb: "consumed",
      })),
      ...realItemStack(recipe.crafted_item_stacks, completed).map((item) => ({
        item,
        verb: "crafted",
      })),
    ];

    for (const { item, verb } of items) {
      const key = referenceKey(item);
      const list = inventory.get(key) ?? [];
      if (!list.length) inventory.set(key, list);
      list.push({
        name: `Being ${verb} by "${craft.ownerUsername}"`,
        quantity: item.quantity,
      });
    }
  }
}

/**
 * Build a Map<"ItemType:id", ItemPlace[]> from a claim's API response,
 * using only claim building storage (non-bank). Player inventories are excluded
 * since those items belong to individual players, not the claim.
 *
 * Each ItemPlace records the building name and the quantity found there.
 */
export async function buildClaimInventory(
  claimId: string,
): Promise<Map<string, ItemPlace[]>> {
  const [{ claim: claimDetail }, claimInv] = await Promise.all([
    jita.getClaim(claimId),
    jita.getClaimInventories(claimId),
  ]);

  const inventory = new Map<string, ItemPlace[]>();

  // Building inventories from BitJita claim inventories endpoint
  for (const building of claimInv.buildings ?? []) {
    // Skip bank buildings (personal storage)
    if (BANK_BUILDING_IDS.has(building.buildingDescriptionId)) continue;

    const buildingLabel =
      building.buildingNickname ?? building.buildingName ?? "Unknown Building";

    for (const pocket of building.inventory ?? []) {
      if (!pocket.contents) continue;
      const c = pocket.contents;
      const itemType = c.item_type === "cargo" ? "Cargo" : "Item";
      const key = `${itemType}:${c.item_id}`;
      const qty = c.quantity ?? 0;
      if (qty <= 0) continue;

      const places = inventory.get(key) ?? [];
      const existing = places.find((p) => p.name === buildingLabel);
      if (existing) {
        existing.quantity += qty;
      } else {
        places.push({ name: buildingLabel, quantity: qty });
      }
      inventory.set(key, places);
    }
  }

  const [{ craftResults: completedCrafts }, { craftResults: ongoingCrafts }] =
    await Promise.all([
      jita.listCrafts({
        claimEntityId: claimDetail.entityId,
        regionId: claimDetail.regionId,
        completed: true,
      }),
      jita.listCrafts({
        claimEntityId: claimDetail.entityId,
        regionId: claimDetail.regionId,
        completed: false,
      }),
    ]);

  const crafts =
    jitaCraftSchema.safeParse([...completedCrafts, ...ongoingCrafts]).data ??
    [];

  addCraftsToInventory(inventory, crafts);

  return inventory;
}
