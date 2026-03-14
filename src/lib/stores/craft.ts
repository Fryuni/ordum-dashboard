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
import { atom, computed, computedAsync, type AsyncValue } from "nanostores";
import { persistentAtom } from "@nanostores/persistent";
import { itemIndex, type IndexItem } from "../itemIndex";
import { buildCraftPlan } from "../craft-planner";
import type { ItemReference } from "../gamedata";
import { z } from "astro/zod";
import { $inventory } from "./craftSource";

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

const targetItemSchema = z.array(
  z.looseObject({
    item_id: z.number(),
    item_type: z.enum(["Item", "Cargo"]),
    name: z.string(),
    quantity: z.number(),
  }),
);

// Target items list
export const $targets = persistentAtom("craftItems", [], {
  listen: true,
  encode: JSON.stringify,
  decode: (data) => {
    const res = targetItemSchema.safeParse(JSON.parse(data));
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

/**
 * The craft plan result, computed asynchronously from $craftRequest.
 * Value type follows the AsyncValue pattern from nanostores:
 *   { state: 'loading' } | { state: 'loaded', value, changing } | { state: 'failed', error, changing }
 */
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
