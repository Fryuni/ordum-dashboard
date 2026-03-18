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
import type { JitaPassiveCraft } from "./bitjita-client";
import { referenceKey } from "./gamedata/definition";
import { recipesCodex } from "./gamedata/codex";

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

export function addToInventory(
  inventory: Map<string, ItemPlace[]>,
  itemKey: string,
  itemPlace: ItemPlace,
) {
  const list = inventory.get(itemKey) ?? [];
  if (!list.length) inventory.set(itemKey, list);

  const existing = list.find((ip) => ip.name === itemPlace.name);
  if (existing) {
    existing.quantity += itemPlace.quantity;
  } else {
    list.push(itemPlace);
  }
}

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
    const recipe = recipesCodex.get(craft.recipeId);
    if (!recipe) continue;

    const completed = Math.floor(craft.progress / craft.actionsRequiredPerItem);
    const remaining = craft.craftCount - completed;

    const items = [
      ...recipe.inputs.map(({ quantity, ...item }) => ({
        item,
        quantity: quantity * remaining,
        verb: "consumed",
      })),
      ...recipe.outputs.map(({ quantity, ...item }) => ({
        item,
        quantity: quantity * completed,
        verb: "crafted",
      })),
    ];

    for (const { item, quantity, verb } of items) {
      addToInventory(inventory, referenceKey(item), {
        name: `Being ${verb} by "${craft.ownerUsername}"`,
        quantity: quantity,
      });
    }
  }
}

/**
 * Add completed passive craft outputs (looms, smelters, farms) to an inventory map.
 * Each passive craft has a `craftedItem` array with the finished items.
 */
export function addPassiveCraftsToInventory(
  inventory: Map<string, ItemPlace[]>,
  passiveCrafts: JitaPassiveCraft[],
): void {
  for (const craft of passiveCrafts) {
    const recipe = recipesCodex.get(craft.recipeId);
    if (!recipe) continue;

    if (craft.status !== "complete") {
      for (const input of recipe.inputs) {
        addToInventory(inventory, referenceKey(input), {
          name: `Being consumed in "${craft.buildingName}"`,
          quantity: input.quantity,
        });
      }
      continue;
    }

    for (const output of recipe.outputs) {
      addToInventory(inventory, referenceKey(output), {
        name: `Completed in "${craft.buildingName}"`,
        quantity: output.quantity,
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

  const [
    { craftResults: completedCrafts },
    { craftResults: ongoingCrafts },
    claimMembers,
  ] = await Promise.all([
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
    jita.getClaimMembers(claimId),
  ]);

  const crafts =
    jitaCraftSchema.safeParse([...completedCrafts, ...ongoingCrafts]).data ??
    [];

  addCraftsToInventory(inventory, crafts);

  // Fetch passive crafts (looms, smelters, farms) for all claim members
  // and include only those belonging to this claim
  const passiveResults = await Promise.all(
    (claimMembers.members ?? []).map((m) =>
      jita
        .getPlayerPassiveCrafts(m.playerEntityId)
        .then((r) => r.craftResults)
        .catch(() => []),
    ),
  );

  const claimPassiveCrafts = passiveResults
    .flat()
    .filter((c) => c.claimEntityId === claimId);

  addPassiveCraftsToInventory(inventory, claimPassiveCrafts);

  return inventory;
}
