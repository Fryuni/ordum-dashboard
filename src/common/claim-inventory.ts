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
 * Add crafting outputs to an inventory map.
 * All outputs are added at the full craft count regardless of progress.
 */
export function addCraftsToInventory(
  inventory: Map<string, ItemPlace[]>,
  crafts: JitaCraft[],
): void {
  for (const craft of crafts) {
    const recipe = recipesCodex.get(craft.recipeId);
    if (!recipe) continue;

    const isComplete = craft.progress >= craft.totalActionsRequired;
    const place = isComplete ? "Crafted" : "Being crafted";

    for (const output of recipe.outputs) {
      addToInventory(inventory, referenceKey(output), {
        name: place,
        quantity: output.quantity * craft.craftCount,
      });
    }
  }
}

/**
 * Add passive craft outputs (looms, smelters, farms) to an inventory map.
 * Passive crafts are treated as already completed — outputs are always added.
 */
export function addPassiveCraftsToInventory(
  inventory: Map<string, ItemPlace[]>,
  passiveCrafts: JitaPassiveCraft[],
): void {
  for (const craft of passiveCrafts) {
    const recipe = recipesCodex.get(craft.recipeId);
    if (!recipe) continue;

    const place = craft.status === "complete" ? "Crafted" : "Being crafted";

    for (const output of recipe.outputs) {
      addToInventory(inventory, referenceKey(output), {
        name: place,
        quantity: output.quantity,
      });
    }
  }
}
