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
import type {
  ResourceItem,
  ResourceWithLocations,
} from "../../common/ordum-types";
import { useState, useRef, useCallback } from "preact/hooks";

interface Props {
  title: string;
  resources: (ResourceItem | ResourceWithLocations)[];
  showLocations?: boolean;
  id: string;
}

export default function ResourceTable({
  title,
  resources,
  showLocations = false,
  id,
}: Props) {
  const [search, setSearch] = useState("");
  const [tierFilter, setTierFilter] = useState("");
  const [tagFilter, setTagFilter] = useState("");
  const [sortCol, setSortCol] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const allTags = [
    ...new Set(resources.map((r) => r.tag).filter(Boolean)),
  ].sort();
  const allTiers = [...new Set(resources.map((r) => r.tier))].sort(
    (a, b) => a - b,
  );

  let filtered = resources.filter((r) => {
    if (search && !r.name.toLowerCase().includes(search.toLowerCase()))
      return false;
    if (tierFilter && r.tier !== Number(tierFilter)) return false;
    if (tagFilter && r.tag !== tagFilter) return false;
    return true;
  });

  if (sortCol) {
    filtered = [...filtered].sort((a, b) => {
      let cmp = 0;
      if (sortCol === "name") cmp = a.name.localeCompare(b.name);
      else if (sortCol === "quantity") cmp = a.quantity - b.quantity;
      else if (sortCol === "tier") cmp = a.tier - b.tier;
      return sortDir === "asc" ? cmp : -cmp;
    });
  }

  const handleSort = useCallback(
    (col: string) => {
      if (sortCol === col) {
        setSortDir((d) => (d === "asc" ? "desc" : "asc"));
      } else {
        setSortCol(col);
        setSortDir("asc");
      }
    },
    [sortCol],
  );

  return (
    <div class="resource-section" id={id}>
      <div class="section-header">
        <h3>{title}</h3>
        <span class="badge">
          {resources.length} types ·{" "}
          {resources.reduce((s, r) => s + r.quantity, 0).toLocaleString()} total
        </span>
      </div>

      <div class="filters">
        <div class="search-input-wrapper">
          <span class="search-icon">🔍</span>
          <input
            type="text"
            class="search-input custom-input"
            placeholder="Search resources..."
            value={search}
            onInput={(e) => setSearch((e.target as HTMLInputElement).value)}
          />
        </div>
        <select
          class="tier-filter custom-select"
          value={tierFilter}
          onChange={(e) => setTierFilter((e.target as HTMLSelectElement).value)}
        >
          <option value="">All Tiers</option>
          {allTiers.map((t) => (
            <option key={t} value={String(t)}>
              Tier {t}
            </option>
          ))}
        </select>
        <select
          class="tag-filter custom-select"
          value={tagFilter}
          onChange={(e) => setTagFilter((e.target as HTMLSelectElement).value)}
        >
          <option value="">All Tags</option>
          {allTags.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </div>

      <div class="table-wrapper">
        <table class="resource-table modern-table">
          <thead>
            <tr>
              <th class="sortable" onClick={() => handleSort("name")}>
                Name ↕
              </th>
              <th class="sortable num" onClick={() => handleSort("quantity")}>
                Qty ↕
              </th>
              <th class="sortable num" onClick={() => handleSort("tier")}>
                Tier ↕
              </th>
              <th>Tag</th>
              <th>Rarity</th>
              {showLocations && <th>Locations</th>}
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => {
              const locs =
                "locations" in r ? (r as ResourceWithLocations).locations : [];
              return (
                <tr key={`${r.item_type}-${r.item_id}`}>
                  <td class="item-name">
                    <span
                      class={`rarity-dot rarity-${(r.rarity ?? "Common").toLowerCase()}`}
                    />
                    {r.name}
                  </td>
                  <td class="num font-mono">{r.quantity.toLocaleString()}</td>
                  <td class="num tier-cell">
                    <span class={`tier-badge tier-${r.tier}`}>T{r.tier}</span>
                  </td>
                  <td class="tag-cell">
                    <span class="tag-pill">{r.tag}</span>
                  </td>
                  <td class="rarity-cell">{r.rarity ?? "—"}</td>
                  {showLocations && (
                    <td class="locations-cell">
                      {locs.length > 0 && (
                        <details class="loc-details">
                          <summary>
                            {locs.length} location{locs.length > 1 ? "s" : ""}
                          </summary>
                          <ul class="location-list">
                            {locs.map((l, li) => (
                              <li key={li}>
                                <span
                                  class={`loc-type loc-${l.owner_type.toLowerCase()}`}
                                >
                                  {l.owner_type === "Building" ? "🏠" : "👤"}
                                </span>
                                <span class="loc-name">
                                  {l.building_name ??
                                    l.owner_name ??
                                    l.owner_type}
                                </span>
                                <span class="loc-qty font-mono">
                                  ×{l.quantity}
                                </span>
                              </li>
                            ))}
                          </ul>
                        </details>
                      )}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
