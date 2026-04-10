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
import { atom, computed } from "nanostores";
import { computedAsync } from "@nanostores/async";
import { $updateTimer } from "../util-store";
import { jita } from "../../common/api";
import { api } from "../../../convex/_generated/api";
import {
  addCraftsToInventory,
  addPassiveCraftsToInventory,
  addToInventory,
  type ItemPlace,
} from "../../common/claim-inventory";
import { recipesCodex } from "../../common/gamedata/codex";
import { referenceKey } from "../../common/gamedata/definition";
import type { EmpireClaimInfo } from "../../common/ordum-types";
import { $playerInfo } from "./player";
import { asyncDefaultValue, selectorAtom } from "./utils";
import { convexSub } from "./convexSub";

// ─── Inventory Source ──────────────────────────────────────────────────────────

/**
 * Inventory source: "player" uses the selected player's inventory,
 * any other string is a claim entity ID.
 */
export const $inventorySource = persistentAtom<string>(
  "craftInventorySource",
  "player",
);

// ─── Empire Claims (subscription-based) ────────────────────────────────────────

const $empireClaimsData = convexSub(
  [],
  api.empireData.getEmpireClaims,
  () => ({}),
);

/** Fetched list of empire claims — reactive via Convex subscription */
export const $empireClaims = computed(
  $empireClaimsData,
  (state): EmpireClaimInfo[] =>
    state.state === "ready" ? state.value.claims : [],
);

/** Whether claims are still loading */
export const $empireClaimsLoading = computed(
  $empireClaimsData,
  (state) => state.state === "loading",
);

/** The capital claim ID as reported by the synced data */
export const $empireCapitalClaimId = computed(
  $empireClaimsData,
  (state): string | null =>
    state.state === "ready" ? state.value.capitalClaimId : null,
);

/**
 * Register a persistent claim store to receive the capital as its default.
 * When the capital claim ID loads and the store is empty, it gets set.
 */
const pendingDefaults: Array<{
  get: () => string | string[];
  set: (v: any) => void;
  isArray: boolean;
}> = [];

export function useCapitalAsDefault(store: {
  get: () => string;
  set: (v: string) => void;
}): void {
  const capital = $empireCapitalClaimId.get();
  if (capital && !store.get()) {
    store.set(capital);
  } else if (!capital) {
    pendingDefaults.push({
      get: store.get.bind(store),
      set: store.set.bind(store),
      isArray: false,
    });
  }
}

export function useCapitalAsDefaultArray(store: {
  get: () => string[];
  set: (v: string[]) => void;
}): void {
  const capital = $empireCapitalClaimId.get();
  if (capital && store.get().length === 0) {
    store.set([capital]);
  } else if (!capital) {
    pendingDefaults.push({
      get: store.get.bind(store),
      set: store.set.bind(store),
      isArray: true,
    });
  }
}

// When capital loads, apply to any pending stores
$empireCapitalClaimId.listen((capitalId) => {
  if (!capitalId) return;
  for (const entry of pendingDefaults) {
    const val = entry.get();
    if (entry.isArray ? (val as string[]).length === 0 : !val) {
      entry.set(entry.isArray ? [capitalId] : capitalId);
    }
  }
  pendingDefaults.length = 0;
});

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
          let invName = inv.inventoryName ?? inv.buildingName ?? "Backpack";
          // Append claim name for bank buildings so each town bank is distinct
          if (inv.claimName && /\bbank\b/i.test(invName)) {
            invName = `${invName} (${inv.claimName})`;
          }
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
          const { jitaCraftSchema } =
            await import("../../common/claim-inventory");
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

// ─── Claim Inventory (subscription-based) ─────────────────────────────────────

/** The claim ID to fetch inventory for (null when using player source) */
const $activeClaimId = computed($inventorySource, (source) =>
  source === "player" ? null : source,
);

/** Building inventories from Convex subscription */
const $claimBuildingInventory = convexSub(
  [$activeClaimId],
  api.empireData.getClaimInventory,
  (claimId) => (claimId ? { claimId } : null),
);

/** Craft data from Convex subscription */
const $claimCraftData = convexSub(
  [$activeClaimId],
  api.empireData.getClaimCrafts,
  (claimId) => (claimId ? { claimId } : null),
);

/**
 * Build claim inventory Map from subscription data.
 * Combines building inventories with craft outputs (resolved via client-side codex).
 */
const $claimInventory = computed(
  [$claimBuildingInventory, $claimCraftData],
  (buildingState, craftState): Map<string, ItemPlace[]> => {
    if (buildingState.state !== "ready") return new Map();

    const inventory = new Map<string, ItemPlace[]>();
    const buildings = buildingState.value;

    // Add building inventories
    for (const item of buildings.items) {
      for (const loc of item.locations) {
        addToInventory(inventory, item.key, {
          name: loc.name,
          quantity: loc.quantity,
        });
      }
    }

    // Add craft outputs (resolved client-side via recipesCodex)
    if (craftState.state === "ready") {
      for (const craft of craftState.value) {
        const recipe = recipesCodex.get(craft.recipeId);
        if (!recipe) continue;

        if (craft.isPassive) {
          const place =
            craft.progress >= craft.totalActionsRequired
              ? "Crafted"
              : "Being crafted";
          for (const output of recipe.outputs) {
            addToInventory(inventory, referenceKey(output), {
              name: place,
              quantity: output.quantity,
            });
          }
        } else {
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
    }

    return inventory;
  },
);

// ─── Combined Inventory ────────────────────────────────────────────────────────

const $emptyInventory = atom(new Map<string, ItemPlace[]>());

export const $inventory = selectorAtom(
  $inventorySource,
  { player: asyncDefaultValue($playerInventory, $emptyInventory) },
  computed($claimInventory, (v) => v),
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
