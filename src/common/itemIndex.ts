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
import { gd, type ItemReference } from "./gamedata";

export interface IndexItem extends ItemReference {
  tier: number;
  name: string;
  tag: string;
}

const itemIndex: IndexItem[] = [];

for (const item of gd.items.values()) {
  if (item.compendium_entry && item.name) {
    itemIndex.push({
      item_id: item.id,
      item_type: "Item",
      name: `${item.name} (${item.rarity})`,
      tier: item.tier,
      tag: item.tag,
    });
  }
}
for (const item of gd.cargo.values()) {
  if (item.name) {
    itemIndex.push({
      item_id: item.id,
      item_type: "Cargo",
      name: `${item.name} (${item.rarity})`,
      tier: item.tier,
      tag: item.tag,
    });
  }
}

export { itemIndex };

// ─── Item Search Helper ────────────────────────────────────────────────────────

export interface ItemSearchResult extends ItemReference {
  name: string;
  tier: number;
  tag: string;
}

export function searchItems(query: string, limit = 20): ItemSearchResult[] {
  const q = query.toLowerCase();
  const results: ItemSearchResult[] = [];

  for (const [id, item] of gd.items) {
    if (item.name.toLowerCase().includes(q)) {
      results.push({
        item_id: id,
        item_type: "Item",
        name: item.name,
        tier: item.tier,
        tag: item.tag,
      });
    }
    if (results.length >= limit * 2) break;
  }

  for (const [id, c] of gd.cargo) {
    if (c.name.toLowerCase().includes(q)) {
      results.push({
        item_id: id,
        item_type: "Cargo",
        name: c.name,
        tier: c.tier,
        tag: c.tag,
      });
    }
    if (results.length >= limit * 2) break;
  }

  return results
    .sort((a, b) => {
      const aExact = a.name.toLowerCase() === q ? 0 : 1;
      const bExact = b.name.toLowerCase() === q ? 0 : 1;
      if (aExact !== bExact) return aExact - bExact;
      const aStarts = a.name.toLowerCase().startsWith(q) ? 0 : 1;
      const bStarts = b.name.toLowerCase().startsWith(q) ? 0 : 1;
      if (aStarts !== bStarts) return aStarts - bStarts;
      return a.name.localeCompare(b.name);
    })
    .slice(0, limit);
}
