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
import { computed } from "nanostores";
import { computedAsync } from "@nanostores/async";
import { $updateTimer } from "../util-store";
import { jita } from "../../common/api";
import { api } from "../../../convex/_generated/api";
import {
  addCraftsToInventory,
  addPassiveCraftsToInventory,
  addToInventory,
  aggregateClaimBuildings,
  type AggregatedClaimItem,
  type ItemPlace,
} from "../../common/claim-inventory";
import { recipesCodex } from "../../common/gamedata/codex";
import { referenceKey } from "../../common/gamedata/definition";
import type { EmpireClaimInfo } from "../../common/ordum-types";
import { $playerInfo } from "./player";
import { convexSub } from "./convexSub";

// ─── Inventory Sources (multi-select) ─────────────────────────────────────────

/**
 * Selected inventory source keys. Each entry is one of:
 * - "player"           — backpack + deployables + player crafts
 * - "equipment"        — toolbelt + worn armor/accessories (all presets)
 * - "bank:<claimId>"   — Town Bank / Ancient Bank at a specific claim
 * - "house-storage"    — storage buildings (chests, bins, stockpiles) across all claims
 * - "claim:<claimId>"  — non-storage claim building inventory + claim crafts
 */
export const $inventorySources = persistentAtom<string[]>(
  "craftInventorySources",
  ["player"],
  { encode: JSON.stringify, decode: JSON.parse },
);

export function toggleSource(key: string) {
  const current = $inventorySources.get();
  if (current.includes(key)) {
    $inventorySources.set(current.filter((k) => k !== key));
  } else {
    $inventorySources.set([...current, key]);
  }
}

export function setSourcesForClaim(claimId: string) {
  $inventorySources.set([`claim:${claimId}`]);
}

export function clearSources() {
  $inventorySources.set([]);
}

// ─── Empire Claims (subscription-based) ──────────────────────────────────���─────

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

// ─── Player Inventory (categorized) ──────────────────────────────────────────

const BANK_NAME_RE = /\bbank\b/i;
const TOOLBELT_NAME_RE = /\btoolbelt\b/i;

export interface CategorizedPlayerInventory {
  personal: Map<string, ItemPlace[]>;
  equipment: Map<string, ItemPlace[]>;
  houseStorage: Map<string, ItemPlace[]>;
  banks: Map<string, Map<string, ItemPlace[]>>;
  /** claimEntityId → display label for each bank, e.g. "Town Bank (Aldebaran)" */
  bankLabels: Map<string, string>;
}

const $categorizedPlayerInventory = computedAsync(
  [$playerInfo, $updateTimer],
  async (player) => {
    const personal = new Map<string, ItemPlace[]>();
    const equipment = new Map<string, ItemPlace[]>();
    const houseStorage = new Map<string, ItemPlace[]>();
    const banks = new Map<string, Map<string, ItemPlace[]>>();
    const bankLabels = new Map<string, string>();

    if (!player)
      return { personal, equipment, houseStorage, banks, bankLabels };

    try {
      const [
        invData,
        { craftResults: completedCrafts },
        { craftResults: ongoingCrafts },
        passiveCrafts,
        activeEquipment,
        equipmentPresets,
      ] = await Promise.all([
        jita.getPlayerInventories(player.entityId),
        jita.listCrafts({ playerEntityId: player.entityId, completed: true }),
        jita.listCrafts({ playerEntityId: player.entityId, completed: false }),
        jita.getPlayerPassiveCrafts(player.entityId),
        jita.getPlayerEquipment(player.entityId),
        jita.getPlayerEquipmentPresets(player.entityId),
      ]);

      for (const inv of invData.inventories ?? []) {
        const rawName = inv.inventoryName ?? inv.buildingName ?? null;
        const isBank = rawName !== null && BANK_NAME_RE.test(rawName);

        // Determine which category this inventory belongs to
        let target: Map<string, ItemPlace[]>;
        let placeName: string;

        if (isBank && inv.claimEntityId) {
          // Bank → per-claim bucket
          let bankInv = banks.get(inv.claimEntityId);
          if (!bankInv) {
            bankInv = new Map();
            banks.set(inv.claimEntityId, bankInv);
          }
          target = bankInv;
          // Include claim name in place name so tooltips identify which bank
          placeName = inv.claimName
            ? `${rawName} (${inv.claimName})`
            : rawName!;
          // Store label for the checkbox UI
          if (!bankLabels.has(inv.claimEntityId)) {
            bankLabels.set(inv.claimEntityId, placeName);
          }
        } else if (rawName !== null && TOOLBELT_NAME_RE.test(rawName)) {
          // Toolbelt → equipment
          target = equipment;
          placeName = "Toolbelt";
        } else if (rawName === null || !inv.claimEntityId) {
          // Backpack (null name) or deployable (no claim) → personal
          target = personal;
          placeName = rawName ?? "Backpack";
        } else {
          // Claim building (has claimEntityId, not bank/chest) → skip
          // These items are covered by the claim inventory subscription
          continue;
        }

        for (const pocket of inv.pockets ?? []) {
          if (pocket?.contents) {
            const c = pocket.contents;
            const itemType = c.itemType === 1 ? "Cargo" : "Item";
            const key = `${itemType}:${c.itemId}`;
            const qty = c.quantity ?? 1;
            addToInventory(target, key, { name: placeName, quantity: qty });
          }
        }
      }

      // Add equipped items: active equipment + all preset slots
      const allEquipmentSlots: unknown[] = [
        ...(activeEquipment.equipment ?? []),
        ...(equipmentPresets.presets ?? []).flatMap(
          (p) => p.equipmentSlots ?? [],
        ),
      ];
      for (const entry of allEquipmentSlots) {
        const slot = entry as { item?: Record<string, unknown> | null };
        if (!slot.item) continue;
        const itemId = slot.item.id;
        if (typeof itemId !== "number") continue;
        const key = `Item:${itemId}`;
        const qty =
          typeof slot.item.quantity === "number" ? slot.item.quantity : 1;
        addToInventory(equipment, key, { name: "Equipped", quantity: qty });
      }

      // Add house storage (chests inside the player's house)
      try {
        const houses = (await jita.getPlayerHousing(player.entityId)) as Array<{
          buildingEntityId?: string;
        }>;
        if (Array.isArray(houses)) {
          const details = await Promise.all(
            houses
              .filter((h) => h.buildingEntityId)
              .map((h) =>
                jita.getPlayersHousing(player.entityId, h.buildingEntityId!),
              ),
          );
          for (const house of details) {
            for (const inv of house.inventories ?? []) {
              const storageInv = inv as {
                buildingName?: string;
                buildingNickname?: string | null;
                inventory?: Array<{
                  contents?: {
                    item_id: number;
                    item_type: string;
                    quantity: number;
                  } | null;
                }>;
              };
              const label =
                storageInv.buildingNickname ??
                storageInv.buildingName ??
                "House Storage";
              for (const pocket of storageInv.inventory ?? []) {
                if (!pocket.contents) continue;
                const c = pocket.contents;
                const itemType = c.item_type === "cargo" ? "Cargo" : "Item";
                const key = `${itemType}:${c.item_id}`;
                addToInventory(houseStorage, key, {
                  name: label,
                  quantity: c.quantity,
                });
              }
            }
          }
        }
      } catch (error) {
        console.error("Failed to retrieve house storage:", error);
      }

      // Add crafts to personal inventory
      try {
        const { jitaCraftSchema } =
          await import("../../common/claim-inventory");
        const crafts = jitaCraftSchema.parse([
          ...completedCrafts,
          ...ongoingCrafts,
        ]);
        addCraftsToInventory(personal, crafts);
      } catch (error) {
        console.error("Failed to parse player crafts:", error);
      }

      addPassiveCraftsToInventory(personal, passiveCrafts.craftResults);
    } catch (error) {
      console.error("Failed to retrieve player inventory:", error);
    }

    return { personal, equipment, houseStorage, banks, bankLabels };
  },
);

/** Equipped items only — used by playerCapabilities to determine active tool tiers */
export const $equippedItems = computed(
  $categorizedPlayerInventory,
  (state): Map<string, ItemPlace[]> =>
    state.state === "ready" ? state.value.equipment : new Map(),
);

// ─── Selected Claim Inventories (live-polled from BitJita) ──────────────────

// Stable comma-joined key so identical selections dedupe (nanostores compares
// with ===) and don't retrigger fetches when unrelated sources toggle.
const $selectedClaimIdsKey = computed($inventorySources, (sources) => {
  const ids: string[] = [];
  for (const source of sources) {
    if (source.startsWith("claim:")) {
      ids.push(source.slice("claim:".length));
    }
  }
  ids.sort();
  return ids.join(",");
});

interface SelectedClaimInventory {
  claimId: string;
  items: AggregatedClaimItem[];
  crafts: Array<{
    recipeId: number;
    craftCount: number;
    progress: number;
    totalActionsRequired: number;
    isPassive: boolean;
  }>;
}

/**
 * Per-claim inventory and active crafts, fetched directly from BitJita on
 * demand. Re-runs when the selected claims change and on the shared update
 * timer so the planner reflects in-game changes within seconds instead of
 * waiting for a Convex cron sync.
 */
const $allClaimInventoriesData = computedAsync(
  [$selectedClaimIdsKey, $updateTimer],
  async (key): Promise<SelectedClaimInventory[]> => {
    if (!key) return [];
    const claimIds = key.split(",");

    return Promise.all(
      claimIds.map(async (claimId): Promise<SelectedClaimInventory> => {
        try {
          const [invData, completedCrafts, ongoingCrafts] = await Promise.all([
            jita.getClaimInventories(claimId),
            jita.listCrafts({ claimEntityId: claimId, completed: true }),
            jita.listCrafts({ claimEntityId: claimId, completed: false }),
          ]);

          const items = aggregateClaimBuildings(invData.buildings ?? []);
          const crafts = [
            ...completedCrafts.craftResults,
            ...ongoingCrafts.craftResults,
          ].map((c) => ({
            recipeId: c.recipeId,
            craftCount: c.craftCount ?? 1,
            progress: c.progress ?? 0,
            totalActionsRequired: c.totalActionsRequired ?? 0,
            isPassive: false,
          }));

          return { claimId, items, crafts };
        } catch (error) {
          console.error(
            `Failed to fetch BitJita data for claim ${claimId}:`,
            error,
          );
          return { claimId, items: [], crafts: [] };
        }
      }),
    );
  },
);

// ─── Available Sources (for UI) ─────────────────────────────��────────────────

export interface InventorySourceOption {
  key: string;
  label: string;
  icon: string;
  group: "player" | "claim";
}

export const $availableSources = computed(
  [$categorizedPlayerInventory, $empireClaims],
  (playerAsync, claims): InventorySourceOption[] => {
    const sources: InventorySourceOption[] = [];

    // Player personal is always available
    sources.push({
      key: "player",
      label: "Player Inventory",
      icon: "\uD83D\uDC64",
      group: "player",
    });

    // Equipment, bank, and house storage options appear once player data loads
    if (playerAsync.state === "ready") {
      const inv = playerAsync.value;
      if (inv.equipment.size > 0) {
        sources.push({
          key: "equipment",
          label: "Equipment & Toolbelt",
          icon: "\uD83D\uDEE1\uFE0F",
          group: "player",
        });
      }
      Array.from(inv.bankLabels.entries())
        .sort((a, b) => a[1].localeCompare(b[1]))
        .forEach(([claimId, label]) => {
          sources.push({
            key: `bank:${claimId}`,
            label,
            icon: "\uD83C\uDFE6",
            group: "player",
          });
        });
      if (inv.houseStorage.size > 0) {
        sources.push({
          key: "house-storage",
          label: "House Storage",
          icon: "\uD83D\uDCE6",
          group: "player",
        });
      }
    }

    // One checkbox per empire claim
    claims
      .toSorted((a, b) => a.name.localeCompare(b.name))
      .forEach((claim) => {
        sources.push({
          key: `claim:${claim.id}`,
          label: claim.name,
          icon: "\uD83C\uDFF0",
          group: "claim",
        });
      });

    return sources;
  },
);

// ─── Combined Inventory ────────────────────────────────────────────────────────

function mergeInto(
  target: Map<string, ItemPlace[]>,
  source: Map<string, ItemPlace[]>,
) {
  for (const [key, places] of source) {
    for (const place of places) {
      addToInventory(target, key, place);
    }
  }
}

export const $inventory = computed(
  [$inventorySources, $categorizedPlayerInventory, $allClaimInventoriesData],
  (sources, playerAsync, claimDataAsync) => {
    const merged = new Map<string, ItemPlace[]>();
    const sourceSet = new Set(sources);

    // Player categories
    if (playerAsync.state === "ready") {
      const inv = playerAsync.value;

      if (sourceSet.has("player")) {
        mergeInto(merged, inv.personal);
      }

      if (sourceSet.has("equipment")) {
        mergeInto(merged, inv.equipment);
      }

      for (const [claimId, bankInv] of inv.banks) {
        if (sourceSet.has(`bank:${claimId}`)) {
          mergeInto(merged, bankInv);
        }
      }

      if (sourceSet.has("house-storage")) {
        mergeInto(merged, inv.houseStorage);
      }
    }

    // Claim inventories
    if (claimDataAsync.state === "ready") {
      for (const claim of claimDataAsync.value) {
        if (!sourceSet.has(`claim:${claim.claimId}`)) continue;

        // Add building items
        for (const item of claim.items) {
          for (const loc of item.locations) {
            addToInventory(merged, item.key, {
              name: loc.name,
              quantity: loc.quantity,
            });
          }
        }

        // Add craft outputs (resolved client-side via recipesCodex)
        for (const craft of claim.crafts) {
          const recipe = recipesCodex.get(craft.recipeId);
          if (!recipe) continue;

          if (craft.isPassive) {
            const place =
              craft.progress >= craft.totalActionsRequired
                ? "Crafted"
                : "Being crafted";
            for (const output of recipe.outputs) {
              addToInventory(merged, referenceKey(output), {
                name: place,
                quantity: output.quantity,
              });
            }
          } else {
            const isComplete = craft.progress >= craft.totalActionsRequired;
            const place = isComplete ? "Crafted" : "Being crafted";
            for (const output of recipe.outputs) {
              addToInventory(merged, referenceKey(output), {
                name: place,
                quantity: output.quantity * craft.craftCount,
              });
            }
          }
        }
      }
    }

    return merged;
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

// ─── Virtual Inventory (manual adjustments) ────────────────────────────────────

/**
 * User-controlled adjustments layered on top of the real inventory.
 * Keys match referenceKey() ("Item:id" / "Cargo:id"); place quantities are
 * signed so negatives cancel real stock (pretend you don't have it) and
 * positives pretend you do. Merged with `$inventory` into `$effectiveInventory`.
 */
export const $virtualInventory = persistentAtom<Map<string, ItemPlace[]>>(
  "craftVirtualInventory",
  new Map(),
  {
    encode: (m) => JSON.stringify([...m]),
    decode: (s) => {
      try {
        const entries = JSON.parse(s) as Array<[string, ItemPlace[]]>;
        return new Map(entries);
      } catch (error) {
        console.warn("Failed to decode virtual inventory, resetting:", error);
        return new Map();
      }
    },
  },
);

function mergeInventories(
  real: Map<string, ItemPlace[]>,
  virtual: Map<string, ItemPlace[]>,
): Map<string, ItemPlace[]> {
  const result = new Map<string, ItemPlace[]>();
  const keys = new Set<string>([...real.keys(), ...virtual.keys()]);
  for (const key of keys) {
    const byName = new Map<string, number>();
    for (const p of real.get(key) ?? []) {
      byName.set(p.name, (byName.get(p.name) ?? 0) + p.quantity);
    }
    for (const p of virtual.get(key) ?? []) {
      byName.set(p.name, (byName.get(p.name) ?? 0) + p.quantity);
    }
    const places: ItemPlace[] = [];
    for (const [name, qty] of byName) {
      if (qty > 0) places.push({ name, quantity: qty });
    }
    if (places.length > 0) result.set(key, places);
  }
  return result;
}

/** Inventory after applying virtual adjustments. Consumed by the planner and pill UI. */
export const $effectiveInventory = computed(
  [$inventory, $virtualInventory],
  (real, virtual) => mergeInventories(real, virtual),
);

/** Flattened effective totals — replaces `$inventoryTotals` as the planner input. */
export const $effectiveInventoryTotals = computed(
  $effectiveInventory,
  (inv) => {
    const totals = new Map<string, number>();
    for (const [key, places] of inv) {
      let total = 0;
      for (const p of places) total += p.quantity;
      totals.set(key, total);
    }
    return totals;
  },
);

/**
 * Snapshot the current real inventory and push its exact negative into the
 * virtual layer, zeroing out `$effectiveInventory` for every currently-held
 * item. Overwrites any prior virtual state.
 */
export function setVirtualFromScratch() {
  const real = $inventory.get();
  const snapshot = new Map<string, ItemPlace[]>();
  for (const [key, places] of real) {
    snapshot.set(
      key,
      places.map((p) => ({ name: p.name, quantity: -p.quantity })),
    );
  }
  $virtualInventory.set(snapshot);
}

/**
 * Remove one item from the "Already Have" section by cancelling each of its
 * real places. Additive so a second click after the real inventory grows keeps
 * the pill hidden.
 */
export function ignoreItemFromHave(key: string) {
  const real = $inventory.get().get(key);
  if (!real || real.length === 0) return;
  const current = $virtualInventory.get();
  const next = new Map(current);
  const existing = next.get(key) ?? [];
  const additions = real.map((p) => ({ name: p.name, quantity: -p.quantity }));
  next.set(key, [...existing, ...additions]);
  $virtualInventory.set(next);
}

export function clearVirtualInventory() {
  $virtualInventory.set(new Map());
}
