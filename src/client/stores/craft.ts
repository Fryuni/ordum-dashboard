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
import { atom, computed, computedAsync, effect, onMount, type AsyncValue } from "nanostores";
import { persistentAtom } from "@nanostores/persistent";
import { itemIndex, type IndexItem } from "../../common/itemIndex";
import { buildCraftPlan } from "../../common/craft-planner";
import type { ItemReference } from "../../common/gamedata";
import { z } from "zod";
import { $inventory, $inventorySource } from "./craftSource";
import { resubaka } from "../../common/api";
import { ORDUM_MAIN_CLAIM_ID } from "../../common/ordum-types";
import { buildSettlementPlan } from "../../common/settlement-planner";
import { $router } from "./router";

export interface SelectedItem extends ItemReference {
  name: string;
}

export interface TargetItem extends SelectedItem {
  quantity: number;
}

// Search state
export const $searchQuery = atom("");
export const $dropdownOpen = atom(false);

// Selection state
export const $selectedItem = atom<SelectedItem | null>(null);
export const $quantity = atom(1);

const targetSchema = z.array(
  z.object({
    item_id: z.number(),
    item_type: z.enum(["Item", "Cargo"]),
    name: z.string(),
    quantity: z.number(),
  }),
);

// Target items list
export const $targets = persistentAtom<TargetItem[]>("craftItems", [], {
  listen: true,
  encode: JSON.stringify,
  decode: (data) => {
    const res = targetSchema.safeParse(JSON.parse(data));
    return res.success ? res.data : [];
  },
});

// Computed: filtered search results (local, synchronous)
export const $searchResults = computed([$searchQuery], (query) => {
  const q = query.toLowerCase().trim();
  if (q.length < 2) return [];
  return itemIndex
    .filter((i) => i.name.toLowerCase().includes(q))
    .sort((a, b) => {
      const aExact = a.name.toLowerCase() === q ? 0 : 1;
      const bExact = b.name.toLowerCase() === q ? 0 : 1;
      if (aExact !== bExact) return aExact - bExact;
      const aStarts = a.name.toLowerCase().startsWith(q) ? 0 : 1;
      const bStarts = b.name.toLowerCase().startsWith(q) ? 0 : 1;
      if (aStarts !== bStarts) return aStarts - bStarts;
      return a.name.localeCompare(b.name);
    })
    .slice(0, 15);
});

// Computed: can add item?
export const $canAdd = computed($selectedItem, (item) => item !== null);

// ─── Craft Plan (async) ────────────────────────────────────────────────────────

export const $craftPlan = computedAsync(
  [$targets, $inventory],
  (targets, inventory) =>
    !targets.length ? null : buildCraftPlan(targets, inventory),
);

// Re-export the AsyncValue type for components
export type { AsyncValue };

// ─── Actions ───────────────────────────────────────────────────────────────────

export function selectItem(item: IndexItem) {
  $selectedItem.set({
    item_id: item.item_id,
    item_type: item.item_type,
    name: item.name,
  });
  $searchQuery.set(item.name);
  $dropdownOpen.set(false);
}

export function addTarget() {
  const item = $selectedItem.get();
  if (!item) return;
  const qty = $quantity.get() || 1;
  const existing = $targets.get();
  const idx = existing.findIndex(
    (t) => t.item_id === item.item_id && t.item_type === item.item_type,
  );
  if (idx >= 0) {
    $targets.set(
      existing.map((t, i) =>
        i === idx ? { ...t, quantity: t.quantity + qty } : t,
      ),
    );
  } else {
    $targets.set([...existing, { ...item, quantity: qty }]);
  }
  $selectedItem.set(null);
  $searchQuery.set("");
  $quantity.set(1);
}

export function removeTarget(index: number) {
  $targets.set($targets.get().filter((_, i) => i !== index));
}

// Signal atom: increments to notify ItemPicker to focus the quantity input
export const $focusQuantity = atom(0);

export function editTarget(index: number) {
  const target = $targets.get()[index];
  if (!target) return;
  $targets.set($targets.get().filter((_, i) => i !== index));
  $selectedItem.set({
    item_id: target.item_id,
    item_type: target.item_type,
    name: target.name,
  });
  $searchQuery.set(target.name);
  $quantity.set(target.quantity);
  $dropdownOpen.set(false);
  $focusQuantity.set($focusQuantity.get() + 1);
}

export function clearAll() {
  $targets.set([]);
}

export const $shareableUrl = computedAsync([$targets], async (targets) => {
  const shareUrl = new URL(
    typeof window !== "undefined" ? window.location.pathname : "/craft",
    typeof window !== "undefined" ? window.location.href : "https://ordum.fun",
  );

  const compressedBuffer = await new Response(
    new Blob([JSON.stringify(targets)])
      .stream()
      .pipeThrough(new CompressionStream("gzip")),
  ).arrayBuffer();

  const encoded = new Uint8Array(compressedBuffer).toBase64({
    alphabet: "base64url",
    omitPadding: true,
  });

  shareUrl.searchParams.set("targets", encoded);
  return shareUrl;
});

const $loadedTargets = atom(false);

const $importedTargets = computedAsync($router, async (route): Promise<TargetItem[] | undefined> => {
  if (route?.route !== 'craft') {
    $loadedTargets.set(false);
    return;
  };

  const { targets } = route.search;
  if (targets) {
    try {
      const compressed = Uint8Array.fromBase64(targets, {
        alphabet: "base64url",
      });
      const newTargets = await new Response(
        new Blob([compressed])
          .stream()
          .pipeThrough(new DecompressionStream("gzip")),
      ).json();
      return targetSchema.parse(newTargets)
    } catch (error) {
      console.error("Could not set plan.");
    }
  }

  const fromSettlement = route.search.from === "settlement";
  const tier = parseInt(route.search.tier || "0");

  if (fromSettlement && tier > 0) {
    try {
      // Auto-select the main claim inventory when coming from settlement
      $inventorySource.set(ORDUM_MAIN_CLAIM_ID);
      const claim = await resubaka.getClaim(ORDUM_MAIN_CLAIM_ID);
      const currentTier = claim.tier ?? 1;
      const learnedIds = new Set<number>(claim.learned_upgrades ?? []);
      const supplies = claim.supplies ?? 0;

      const plans = buildSettlementPlan(
        currentTier,
        learnedIds,
        supplies,
        new Map(),
      );
      const targetPlan = plans.find((p) => p.tier === tier);

      if (targetPlan) {
        let initialItems: TargetItem[] = [];
        for (const item of targetPlan.all_items_needed) {
          if (item.deficit > 0) {
            initialItems.push({
              ...item,
              name: item.name,
              quantity: item.deficit,
            });
          }
        }
        return initialItems;
      }
    } catch (e) {
      console.error("Failed to build plan:", e);
    }
  }
})

onMount($targets, () => effect([$importedTargets, $loadedTargets], (newTargets, loadedTargets) => {
  if (newTargets.state !== 'loaded' || newTargets.changing) return;
  if (newTargets.value) {
    if (!loadedTargets) {
      $loadedTargets.set(true);
      $targets.set(newTargets.value);
    }
  }
}));
