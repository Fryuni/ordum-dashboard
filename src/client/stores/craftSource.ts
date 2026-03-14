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
import { jita, resubaka } from "../../common/api";
import { buildClaimInventory } from "../../common/claim-inventory";
import type { EmpireClaimInfo } from "../../common/ordum-types";

// ─── Inventory Source ──────────────────────────────────────────────────────────

/**
 * Inventory source: "player" uses the selected player's inventory,
 * any other string is a claim entity ID.
 */
export const $inventorySource = persistentAtom<string>(
  "craftInventorySource",
  "player",
);

// Player name — always visible regardless of source
export const $player = persistentAtom<string>("playerName", "");

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

const $playerInfo = computedAsync($player, async (player) => {
  if (!player) return null;

  const page = await resubaka.listPlayers({
    search: player,
    page: 1,
    per_page: 5,
  });
  return page.players.find((p) => p.username === player) ?? null;
});

const $playerInventory = computedAsync(
  [$playerInfo, $updateTimer],
  async (player) => {
    const inventory = new Map<string, number>();
    if (player) {
      try {
        const invData = await resubaka.findInventoryByOwnerEntityId(
          player.entity_id,
        );
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
    if (!claimId) return new Map<string, number>();
    return buildClaimInventory(claimId);
  },
);

// ─── Combined Inventory ────────────────────────────────────────────────────────

/**
 * The active inventory based on the selected source.
 * When using a claim, returns the claim's building inventory.
 * When using player, returns the player's personal inventory.
 */
export const $inventory = computed(
  [$inventorySource, $playerInventory, $claimInventory],
  (source, playerInv, claimInv) => {
    if (source === "player") {
      return playerInv ?? new Map<string, number>();
    }
    return claimInv ?? new Map<string, number>();
  },
);
