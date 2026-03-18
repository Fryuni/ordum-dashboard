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
import { atom, computed, computedAsync } from "nanostores";
import { $updateTimer } from "../util-store";
import { jita } from "../../common/api";
import {
  addCraftsToInventory,
  addPassiveCraftsToInventory,
  buildClaimInventory,
  jitaCraftSchema,
  type ItemPlace,
} from "../../common/claim-inventory";
import type { EmpireClaimInfo } from "../../common/ordum-types";
import { $playerInfo } from "./player";
import { asyncDefaultValue, selectorAtom } from "./utils";

// ─── Inventory Source ──────────────────────────────────────────────────────────

/**
 * Inventory source: "player" uses the selected player's inventory,
 * any other string is a claim entity ID.
 */
export const $inventorySource = persistentAtom<string>(
  "craftInventorySource",
  "player",
);

// ─── Empire Claims ─────────────────────────────────────────────────────────────

/** Fetched list of empire claims from the server */
export const $empireClaims = atom<EmpireClaimInfo[]>([]);
export const $empireClaimsLoading = atom(false);

/** Fetch empire claims from the /api/empire-claims endpoint */
export async function fetchEmpireClaims() {
  if ($empireClaims.get().length > 0) return; // already loaded
  $empireClaimsLoading.set(true);
  try {
    const res = await fetch("/api/empire-claims");
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    $empireClaims.set(data.claims ?? []);
  } catch (e) {
    console.error("Failed to fetch empire claims:", e);
  } finally {
    $empireClaimsLoading.set(false);
  }
}

/** The currently selected claim name (for display) */
export const $selectedClaimName = computed(
  [$inventorySource, $empireClaims],
  (source, claims) => {
    if (source === "player") return null;
    return claims.find((c) => c.id === source)?.name ?? "Unknown Claim";
  },
);

// ─── Player Inventory ──────────────────────────────────────────────────────────

const $playerInventory = computedAsync(
  [$playerInfo, $updateTimer],
  async (player) => {
    const inventory = new Map<string, ItemPlace[]>();
    if (player) {
      try {
        const [
          invData,
          { craftResults: completedCrafts },
          { craftResults: ongoingCrafts },
          passiveCrafts,
        ] = await Promise.all([
          jita.getPlayerInventories(player.entityId),
          jita.listCrafts({ playerEntityId: player.entityId, completed: true }),
          jita.listCrafts({
            playerEntityId: player.entityId,
            completed: false,
          }),
          jita.getPlayerPassiveCrafts(player.entityId),
        ]);

        for (const inv of invData.inventories ?? []) {
          const invName = inv.inventoryName ?? inv.buildingName ?? "Backpack";
          for (const pocket of inv.pockets ?? []) {
            if (pocket?.contents) {
              const c = pocket.contents;
              // BitJita uses numeric itemType: 0 = Item, 1 = Cargo
              const itemType = c.itemType === 1 ? "Cargo" : "Item";
              const key = `${itemType}:${c.itemId}`;
              const qty = c.quantity ?? 1;
              const places = inventory.get(key) ?? [];
              const existing = places.find((pl) => pl.name === invName);
              if (existing) {
                existing.quantity += qty;
              } else {
                places.push({ name: invName, quantity: qty });
              }
              inventory.set(key, places);
            }
          }
        }

        try {
          // Add items being crafted by this player (active crafts)
          const crafts = jitaCraftSchema.parse([
            ...completedCrafts,
            ...ongoingCrafts,
          ]);
          addCraftsToInventory(inventory, crafts);
        } catch (error) {
          console.error("Failed to parse player crafts:", error);
        }

        // Add completed passive crafts (looms, smelters, farms)
        addPassiveCraftsToInventory(inventory, passiveCrafts.craftResults);
      } catch (error) {
        console.error("Failed to retrieve player inventory:", error);
      }
    }
    return inventory;
  },
);

// ─── Claim Inventory ───────────────────────────────────────────────────────────

/** The claim ID to fetch inventory for (null when using player source) */
const $activeClaimId = computed($inventorySource, (source) =>
  source === "player" ? null : source,
);

const $claimInventory = computedAsync(
  [$activeClaimId, $updateTimer],
  async (claimId) => {
    if (!claimId) return new Map<string, ItemPlace[]>();
    return buildClaimInventory(claimId);
  },
);

// ─── Combined Inventory ────────────────────────────────────────────────────────

const $emptyInventory = atom(new Map<string, ItemPlace[]>());

export const $inventory = selectorAtom(
  $inventorySource,
  { player: asyncDefaultValue($playerInventory, $emptyInventory) },
  asyncDefaultValue($claimInventory, $emptyInventory),
);

/**
 * Flattened inventory totals for the craft planner.
 * Collapses ItemPlace[] into a single total quantity per item key.
 */
export const $inventoryTotals = computed($inventory, (inv) => {
  const totals = new Map<string, number>();
  if (!(inv instanceof Map)) return totals;
  for (const [key, places] of inv) {
    let total = 0;
    for (const p of places) total += p.quantity;
    totals.set(key, total);
  }
  return totals;
});
