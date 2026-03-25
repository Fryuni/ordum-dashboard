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
import { useState, useEffect, useMemo, useCallback } from "preact/hooks";
import { useStore } from "@nanostores/preact";
import {
  $empireClaims,
  $empireClaimsLoading,
  fetchEmpireClaims,
} from "../stores/craftSource";
import {
  $inventorySearchClaim,
  $inventorySearchData,
  type InventorySearchItem,
} from "../stores/inventorySearch";
import { ORDUM_MAIN_CLAIM_ID } from "../../common/ordum-types";

type SortColumn = "name" | "tier" | "quantity";

export default function InventorySearchPage() {
  const [search, setSearch] = useState("");
  const [sortCol, setSortCol] = useState<SortColumn | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const claims = useStore($empireClaims);
  const claimsLoading = useStore($empireClaimsLoading);
  const selectedClaim = useStore($inventorySearchClaim);
  const dataAsync = useStore($inventorySearchData);

  const data = dataAsync.state === "ready" ? dataAsync.value : null;
  const loading = dataAsync.state === "loading";
  const error = dataAsync.state === "failed" ? String(dataAsync.error) : null;

  useEffect(() => {
    fetchEmpireClaims();
  }, []);

  const handleSort = useCallback(
    (col: SortColumn) => {
      if (sortCol === col) {
        setSortDir((d) => (d === "asc" ? "desc" : "asc"));
      } else {
        setSortCol(col);
        setSortDir(col === "name" ? "asc" : "desc");
      }
    },
    [sortCol],
  );

  const rows = useMemo((): InventorySearchItem[] => {
    if (!data) return [];

    let result = [...data.items];

    const q = search.toLowerCase().trim();
    if (q) {
      result = result.filter((r) => r.name.toLowerCase().includes(q));
    }

    if (sortCol) {
      result.sort((a, b) => {
        let cmp = 0;
        if (sortCol === "name") cmp = a.name.localeCompare(b.name);
        else if (sortCol === "tier") cmp = a.tier - b.tier;
        else if (sortCol === "quantity")
          cmp = a.totalQuantity - b.totalQuantity;
        return sortDir === "asc" ? cmp : -cmp;
      });
    }

    return result;
  }, [data, search, sortCol, sortDir]);

  return (
    <>
      <div class="page-header">
        <h1>Inventory Search</h1>
        <p class="subtitle">
          Search and browse all items stored in a claim's buildings
        </p>
      </div>

      <div class="planner-card">
        <div class="form-row">
          <div class="input-group source-select-container">
            <label for="inventory-search-claim">Claim</label>
            <select
              id="inventory-search-claim"
              class="source-select"
              value={selectedClaim}
              onChange={(e) =>
                $inventorySearchClaim.set((e.target as HTMLSelectElement).value)
              }
            >
              {claimsLoading && claims.length === 0 && (
                <option disabled>Loading claims...</option>
              )}
              {claims.map((claim) => (
                <option key={claim.id} value={claim.id}>
                  {claim.name}
                </option>
              ))}
              {!claimsLoading && claims.length === 0 && (
                <option value={ORDUM_MAIN_CLAIM_ID}>Ordum City</option>
              )}
            </select>
          </div>
        </div>
      </div>

      {error ? (
        <div class="error-banner">
          <span class="error-icon">!</span>
          <span>{error}</span>
        </div>
      ) : loading ? (
        <div class="loading-container">
          <div class="spinner-wrap">
            <div class="spinner" />
            <span class="loading-text">Loading inventory...</span>
          </div>
        </div>
      ) : data ? (
        <>
          {/* Search filter */}
          <div class="planner-card" style="margin-bottom: 12px">
            <input
              type="text"
              class="custom-input"
              style="padding-left: 12px"
              placeholder="Search items..."
              value={search}
              onInput={(e) => setSearch((e.target as HTMLInputElement).value)}
            />
          </div>

          <div class="table-wrapper">
            <table class="modern-table">
              <thead>
                <tr>
                  {(
                    [
                      { col: "name", label: "Item", style: "" },
                      {
                        col: "tier",
                        label: "Tier",
                        style: "text-align: center",
                      },
                      {
                        col: "quantity",
                        label: "Quantity",
                        style: "text-align: right",
                      },
                    ] as { col: SortColumn; label: string; style: string }[]
                  ).map(({ col, label, style }) => (
                    <th
                      key={col}
                      class="sortable"
                      style={style}
                      onClick={() => handleSort(col)}
                    >
                      {label}{" "}
                      {sortCol === col
                        ? sortDir === "asc"
                          ? "\u25B2"
                          : "\u25BC"
                        : "\u2195"}
                    </th>
                  ))}
                  <th>Storage Locations</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 && (
                  <tr>
                    <td
                      colSpan={4}
                      style="text-align: center; color: var(--text-muted); padding: 24px"
                    >
                      {search
                        ? "No items match your search"
                        : "No items found in this claim"}
                    </td>
                  </tr>
                )}
                {rows.map((row) => (
                  <tr key={row.key}>
                    <td>
                      <span
                        class={`rarity-dot rarity-${(row.rarity ?? "Common").toLowerCase()}`}
                      />
                      {row.name}
                    </td>
                    <td style="text-align: center">
                      <span class={`tier-badge tier-${row.tier}`}>
                        T{row.tier}
                      </span>
                    </td>
                    <td style="text-align: right" class="font-mono">
                      {row.totalQuantity.toLocaleString()}
                    </td>
                    <td class="locations-cell">
                      {row.locations.length > 0 && (
                        <details class="loc-details">
                          <summary>
                            {row.locations.length} location
                            {row.locations.length > 1 ? "s" : ""}
                          </summary>
                          <ul class="location-list">
                            {row.locations.map((loc, li) => (
                              <li key={li}>
                                <span class="loc-type loc-building">
                                  {loc.name === "Crafted" ||
                                  loc.name === "Being crafted"
                                    ? "\u2692\uFE0F"
                                    : "\uD83C\uDFE0"}
                                </span>
                                <span class="loc-name">{loc.name}</span>
                                <span class="loc-region">
                                  {data.regionName}
                                </span>
                                <span class="loc-qty font-mono">
                                  x{loc.quantity.toLocaleString()}
                                </span>
                              </li>
                            ))}
                          </ul>
                        </details>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style="text-align: center; color: var(--text-muted); font-size: 0.85rem; margin-top: 12px">
            {rows.length} item{rows.length !== 1 ? "s" : ""} shown
            {search ? ` (filtered from ${data.items.length})` : ""}
          </div>
        </>
      ) : null}
    </>
  );
}
