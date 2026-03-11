import { atom, computed, computedAsync, type AsyncValue } from 'nanostores';
import { persistentAtom } from '@nanostores/persistent';
import { actions } from 'astro:actions';

export interface IndexItem {
  id: number;
  t: 'Item' | 'Cargo';
  n: string;
  tier: number;
  tag: string;
}

export interface SelectedItem {
  id: number;
  type: 'Item' | 'Cargo';
  name: string;
}

export interface TargetItem extends SelectedItem {
  quantity: number;
}

// The full item index (set once from server data)
export const $itemIndex = atom<IndexItem[]>([]);

// Search state
export const $searchQuery = atom('');
export const $highlightIndex = atom(-1);
export const $dropdownOpen = atom(false);

// Selection state
export const $selectedItem = atom<SelectedItem | null>(null);
export const $quantity = atom(1);

// Target items list
export const $targets = persistentAtom<TargetItem[]>('craftItems', [], {
  listen: true,
  encode: JSON.stringify,
  decode: JSON.parse,
});

// Player name for craft plan
export const $player = persistentAtom('playerName', '');

// Computed: filtered search results (local, synchronous)
export const $searchResults = computed([$searchQuery, $itemIndex], (query, index) => {
  const q = query.toLowerCase().trim();
  if (q.length < 2) return [];
  return index
    .filter(i => i.n.toLowerCase().includes(q))
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
});

// Computed: can add item?
export const $canAdd = computed($selectedItem, (item) => item !== null);

// Computed: can calculate?
export const $canCalculate = computed($targets, (targets) => targets.length > 0);

// ─── Craft Plan (async) ────────────────────────────────────────────────────────

/**
 * A "trigger" atom: bump this to fire off a craft plan request.
 * The value is the serialized request params, or null if nothing requested yet.
 */
const $craftRequest = computed([$player, $targets], (player, t) => ({
  player,
  items: t,
}));

/**
 * The craft plan result, computed asynchronously from $craftRequest.
 * Value type follows the AsyncValue pattern from nanostores:
 *   { state: 'loading' } | { state: 'loaded', value, changing } | { state: 'failed', error, changing }
 */
export const $craftPlan = computedAsync($craftRequest, async (request) => {
  if (!request) return null;

  const { data, error } = await actions.craftPlan(request);
  if (error) {
    throw new Error(error.message);
  }
  return data;
});

// Re-export the AsyncValue type for components
export type { AsyncValue };

// ─── Actions ───────────────────────────────────────────────────────────────────

export function selectItem(item: IndexItem) {
  $selectedItem.set({ id: item.id, type: item.t, name: item.n });
  $searchQuery.set(item.n);
  $dropdownOpen.set(false);
  $highlightIndex.set(-1);
}

export function addTarget() {
  const item = $selectedItem.get();
  if (!item) return;
  const qty = $quantity.get() || 1;
  $targets.set([...$targets.get(), { ...item, quantity: qty }]);
  $selectedItem.set(null);
  $searchQuery.set('');
  $quantity.set(1);
  $highlightIndex.set(-1);
}

export function removeTarget(index: number) {
  $targets.set($targets.get().filter((_, i) => i !== index));
}

export function clearAll() {
  $targets.set([]);
}

export function calculate() {
  const t = $targets.get();
  if (t.length === 0) return;
}
