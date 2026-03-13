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
import { actions } from "astro:actions";
import { $updateTimer } from "./util-store";

export interface IndexItem {
  id: number;
  t: "Item" | "Cargo";
  n: string;
  tier: number;
  tag: string;
}

export interface SelectedItem {
  id: number;
  type: "Item" | "Cargo";
  name: string;
}

export interface TargetItem extends SelectedItem {
  quantity: number;
}

// The full item index (set once from server data)
export const $groupItemIndex = atom<IndexItem[]>([]);

// Search state
export const $groupSearchQuery = atom("");
export const $groupHighlightIndex = atom(-1);
export const $groupDropdownOpen = atom(false);

// Selection state
export const $groupSelectedItem = atom<SelectedItem | null>(null);
export const $groupQuantity = atom(1);

// Target items list
export const $groupTargets = persistentAtom<TargetItem[]>(
  "groupCraftItems",
  [],
  {
    listen: true,
    encode: JSON.stringify,
    decode: JSON.parse,
  },
);

// Computed: filtered search results (local, synchronous)
export const $groupSearchResults = computed(
  [$groupSearchQuery, $groupItemIndex],
  (query, index) => {
    const q = query.toLowerCase().trim();
    if (q.length < 2) return [];
    return index
      .filter((i) => i.n.toLowerCase().includes(q))
      .sort((a, b) => {
        const aExact = a.n.toLowerCase() === q ? 0 : 1;
        const bExact = b.n.toLowerCase() === q ? 0 : 1;
        if (aExact !== bExact) return aExact - bExact;
        const aStarts = a.n.toLowerCase().startsWith(q) ? 0 : 1;
        const bStarts = b.n.toLowerCase().startsWith(q) ? 0 : 1;
        if (aStarts !== bStarts) return aStarts - bStarts;
        return a.n.localeCompare(b.n);
      })
      .slice(0, 15);
  },
);

// Computed: can add item?
export const $groupCanAdd = computed(
  $groupSelectedItem,
  (item) => item !== null,
);

// ─── Craft Plan (async) ────────────────────────────────────────────────────────

/** Derived request object — recomputes whenever targets change. */
export const $groupCraftRequest = computed(
  [$groupTargets, $updateTimer],
  (t) => ({
    items: t,
  }),
);

/**
 * The group craft plan result, computed asynchronously.
 * Uses the Ordum claim inventory instead of a player's inventory.
 */
export const $groupCraftPlan = computedAsync(
  $groupCraftRequest,
  async (request) => {
    if (!request.items.length) return null;

    const { data, error } = await actions.groupCraftPlan(request);
    if (error) {
      throw new Error(error.message);
    }
    return data;
  },
);

export type { AsyncValue };

// ─── Actions ───────────────────────────────────────────────────────────────────

export function groupSelectItem(item: IndexItem) {
  $groupSelectedItem.set({ id: item.id, type: item.t, name: item.n });
  $groupSearchQuery.set(item.n);
  $groupDropdownOpen.set(false);
  $groupHighlightIndex.set(-1);
}

export function groupAddTarget() {
  const item = $groupSelectedItem.get();
  if (!item) return;
  const qty = $groupQuantity.get() || 1;
  const existing = $groupTargets.get();
  const idx = existing.findIndex(
    (t) => t.id === item.id && t.type === item.type,
  );
  if (idx >= 0) {
    $groupTargets.set(
      existing.map((t, i) =>
        i === idx ? { ...t, quantity: t.quantity + qty } : t,
      ),
    );
  } else {
    $groupTargets.set([...existing, { ...item, quantity: qty }]);
  }
  $groupSelectedItem.set(null);
  $groupSearchQuery.set("");
  $groupQuantity.set(1);
  $groupHighlightIndex.set(-1);
}

export function groupRemoveTarget(index: number) {
  $groupTargets.set($groupTargets.get().filter((_, i) => i !== index));
}

// Signal atom: increments to notify GroupItemPicker to focus the quantity input
export const $groupFocusQuantity = atom(0);

export function groupEditTarget(index: number) {
  const target = $groupTargets.get()[index];
  if (!target) return;
  $groupTargets.set($groupTargets.get().filter((_, i) => i !== index));
  $groupSelectedItem.set({
    id: target.id,
    type: target.type,
    name: target.name,
  });
  $groupSearchQuery.set(target.name);
  $groupQuantity.set(target.quantity);
  $groupDropdownOpen.set(false);
  $groupHighlightIndex.set(-1);
  $groupFocusQuantity.set($groupFocusQuantity.get() + 1);
}

export function groupClearAll() {
  $groupTargets.set([]);
}

/**
 * Set targets programmatically (e.g., from settlement planner link).
 */
export function groupSetTargets(targets: TargetItem[]) {
  $groupTargets.set(targets);
}
