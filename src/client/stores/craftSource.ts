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
import { resubaka } from "../../common/api";
import { buildClaimInventory, type ItemPlace } from "../../common/claim-inventory";
import type { EmpireClaimInfo } from "../../common/ordum-types";
import { $playerInfo } from "./player";

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
        const invData = await resubaka.findInventoryByOwnerEntityId(
          player.entity_id,
        );
        for (const inv of invData.inventorys ?? []) {
          const invName = inv.nickname ?? "Backpack";
          for (const pocket of inv.pockets ?? []) {
            const p = pocket as any;
            if (p?.contents) {
              const c = p.contents;
              const key = `${c.item_type ?? "Item"}:${c.item_id}`;
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

/**
 * Unwrap a value that may be a raw value or an AsyncValue from computedAsync.
 * When a computedAsync store is used as input to a plain computed,
 * .get() returns the AsyncValue wrapper rather than the resolved value.
 */
function unwrapAsync<T>(value: unknown, fallback: T): T {
  if (value instanceof Map) return value as T;
  if (value && typeof value === "object" && "state" in value) {
    const av = value as { state: string; value?: T };
    if (av.state === "loaded" && av.value !== undefined) return av.value;
  }
  return fallback;
}

const emptyInventory = new Map<string, ItemPlace[]>();

/**
 * The detailed inventory with item locations.
 * Each item key maps to an array of ItemPlace entries recording
 * where the item can be found and how many are at each location.
 */
export const $inventory = computed(
  [$inventorySource, $playerInventory, $claimInventory],
  (source, playerInv, claimInv) => {
    if (source === "player") {
      return unwrapAsync(playerInv, emptyInventory);
    }
    return unwrapAsync(claimInv, emptyInventory);
  },
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
