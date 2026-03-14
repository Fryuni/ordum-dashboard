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
import { persistentAtom } from "@nanostores/persistent";
import { computedAsync } from "nanostores";
import { $updateTimer } from "../util-store";
import { api } from "../../common/api";
import { buildClaimInventory } from "../../common/claim-inventory";
import { ORDUM_MAIN_CLAIM_ID } from "../../common/ordum-types";

// Player name for craft plan
export const $player = persistentAtom<string>("playerName", "");

export const $claim = persistentAtom<string>("claimName", "");

const $playerInfo = computedAsync([$player, $updateTimer], async (player) => {
  if (!player) return null;

  const page = await api.listPlayers({
    search: player,
    page: 1,
    per_page: 5,
  });
  return page.players.find((p) => p.username === player) ?? null;
});

const $playerInventory = computedAsync($playerInfo, async (player) => {
  const inventory = new Map<string, number>();
  if (player) {
    try {
      const invData = await api.findInventoryByOwnerEntityId(player.entity_id);
      for (const inv of invData.inventorys ?? []) {
        for (const pocket of inv.pockets ?? []) {
          const p = pocket as any;
          if (p?.contents) {
            const c = p.contents;
            const key = `${c.item_type ?? "Item"}:${c.item_id}`;
            inventory.set(key, (inventory.get(key) ?? 0) + (c.quantity ?? 1));
          }
        }
      }
    } catch {
      // Continue without player data
    }
  }
  return inventory;
});

const $claimInventory = computedAsync($updateTimer, () =>
  buildClaimInventory(ORDUM_MAIN_CLAIM_ID),
);

/**
 * Inventory source depends on the current page path.
 * /craft → player inventory; /group-craft → claim inventory.
 * This is re-evaluated when the module is imported client-side.
 */
export function getInventoryStore() {
  if (typeof window !== "undefined" && window.location.pathname === "/craft") {
    return $playerInventory;
  }
  return $claimInventory;
}

export const $inventory =
  typeof window === "undefined" ? $claimInventory : getInventoryStore();
