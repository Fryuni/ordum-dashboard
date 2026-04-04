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
  $contributionClaim,
  $contributionPlayer,
  $claimMembers,
  $contributionData,
  type ContributionData,
  type ContributionItemMeta,
} from "../stores/contribution";

import { gd } from "../../common/gamedata";

function parseItemKey(key: string): {
  type: string;
  id: number;
  idStr: string;
} {
  const parts = key.split(":");
  return { type: parts[0] ?? "", id: Number(parts[1]), idStr: parts[1] ?? "" };
}

function itemName(
  key: string,
  apiItems: Record<string, ContributionItemMeta>,
): string {
  const { type, id, idStr } = parseItemKey(key);
  const meta = apiItems[idStr];
  if (meta?.name) return meta.name;
  if (type === "Item") return gd.items.get(id)?.name ?? `Item #${id}`;
  return gd.cargo.get(id)?.name ?? `Cargo #${id}`;
}

function itemTier(
  key: string,
  apiItems: Record<string, ContributionItemMeta>,
): number {
  const { type, id, idStr } = parseItemKey(key);
  const meta = apiItems[idStr];
  if (meta?.tier != null) return meta.tier;
  if (type === "Item") return gd.items.get(id)?.tier ?? 0;
  return gd.cargo.get(id)?.tier ?? 0;
}

function formatTier(tier: number): string {
  return tier >= 0 ? `T${tier}` : "TX";
}

function formatValue(value: number): string {
  if (value === 0) return "-";
  return Math.round(value).toLocaleString();
}

type SortColumn =
  | "name"
  | "tier"
  | "net"
  | "deposited"
  | "withdrawn"
  | "unitValue"
  | "totalValue";

interface RowData {
  key: string;
  name: string;
  tier: number;
  net: number;
  deposited: number;
  withdrawn: number;
  unitValue: number;
  totalValue: number;
}

export default function ContributionPage() {
  const [search, setSearch] = useState("");
  const [sortCol, setSortCol] = useState<SortColumn | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const claims = useStore($empireClaims);
  const claimsLoading = useStore($empireClaimsLoading);
  const selectedClaim = useStore($contributionClaim);
  const selectedPlayer = useStore($contributionPlayer);
  const membersAsync = useStore($claimMembers);
  const dataAsync = useStore($contributionData);

  const members =
    membersAsync.state === "ready" ? (membersAsync.value ?? []) : [];
  const data: ContributionData | null =
    dataAsync.state === "ready" ? (dataAsync.value ?? null) : null;
  const loading =
    dataAsync.state === "loading" || membersAsync.state === "loading";
  const error =
    dataAsync.state === "failed"
      ? String(dataAsync.error)
      : membersAsync.state === "failed"
        ? String(membersAsync.error)
        : null;

  useEffect(() => {
    fetchEmpireClaims();
  }, []);

  // Reset player selection when claim changes
  useEffect(() => {
    if (
      membersAsync.state === "ready" &&
      selectedPlayer &&
      !members.find((m) => m.playerEntityId === selectedPlayer)
    ) {
      $contributionPlayer.set("");
    }
  }, [membersAsync.state, selectedClaim]);

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

  // Build row data, apply search filter, then sort
  const rows = useMemo((): RowData[] => {
    if (!data) return [];

    // Collect all item keys that appear in either deposited or withdrawn
    const allKeys = new Set<string>([
      ...Object.keys(data.deposited),
      ...Object.keys(data.withdrawn),
    ]);

    let result = [...allKeys]
      .map((key): RowData => {
        const dep = data.deposited[key] ?? 0;
        const wth = data.withdrawn[key] ?? 0;
        const net = dep - wth;
        const unitValue = data.prices[key] ?? 0;
        return {
          key,
          name: itemName(key, data.items),
          tier: itemTier(key, data.items),
          net,
          deposited: dep,
          withdrawn: wth,
          unitValue,
          totalValue: net * unitValue,
        };
      })
      .filter((r) => r.deposited !== 0 || r.withdrawn !== 0);

    // Search filter
    const q = search.toLowerCase().trim();
    if (q) {
      result = result.filter((r) => r.name.toLowerCase().includes(q));
    }

    // Sort
    if (sortCol) {
      result.sort((a, b) => {
        let cmp = 0;
        if (sortCol === "name") cmp = a.name.localeCompare(b.name);
        else if (sortCol === "tier") cmp = a.tier - b.tier;
        else if (sortCol === "net") cmp = a.net - b.net;
        else if (sortCol === "deposited") cmp = a.deposited - b.deposited;
        else if (sortCol === "withdrawn") cmp = a.withdrawn - b.withdrawn;
        else if (sortCol === "unitValue") cmp = a.unitValue - b.unitValue;
        else if (sortCol === "totalValue") cmp = a.totalValue - b.totalValue;
        return sortDir === "asc" ? cmp : -cmp;
      });
    } else {
      // Default: sort by absolute net descending
      result.sort((a, b) => Math.abs(b.net) - Math.abs(a.net));
    }

    return result;
  }, [data, search, sortCol, sortDir]);

  // KPI totals computed from rows (which are already filtered by search)
  const totalDeposited = useMemo(
    () => rows.reduce((s, r) => s + r.deposited, 0),
    [rows],
  );
  const totalWithdrawn = useMemo(
    () => rows.reduce((s, r) => s + r.withdrawn, 0),
    [rows],
  );
  const netValue = useMemo(
    () => rows.reduce((s, r) => s + r.totalValue, 0),
    [rows],
  );

  if (error) {
    return (
      <div class="error-banner">
        <span class="error-icon">!</span>
        <span>{error}</span>
      </div>
    );
  }

  const playerName =
    members.find((m) => m.playerEntityId === selectedPlayer)?.userName ??
    "Player";

  return (
    <>
      <div class="page-header">
        <h1>Contribution Tracker</h1>
        <p class="subtitle">
          Track what each player has deposited and withdrawn from claim storage
        </p>
      </div>

      <div class="planner-card">
        <div class="form-row">
          <div class="input-group source-select-container">
            <label for="contribution-claim">Claim</label>
            <select
              id="contribution-claim"
              class="source-select"
              value={selectedClaim}
              onChange={(e) =>
                $contributionClaim.set((e.target as HTMLSelectElement).value)
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
              {!selectedClaim && (
                <option value="" disabled>
                  Loading claims…
                </option>
              )}
            </select>
          </div>

          <div class="input-group source-select-container">
            <label for="contribution-player">Player</label>
            <select
              id="contribution-player"
              class="source-select"
              value={selectedPlayer}
              onChange={(e) =>
                $contributionPlayer.set((e.target as HTMLSelectElement).value)
              }
            >
              <option value="">-- Select a player --</option>
              {members.map((m) => (
                <option key={m.playerEntityId} value={m.playerEntityId}>
                  {m.userName}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {!selectedPlayer ? (
        <div class="loading-container">
          <span class="loading-text">
            Select a player to view contributions
          </span>
        </div>
      ) : loading ? (
        <div class="loading-container">
          <div class="spinner-wrap">
            <div class="spinner" />
            <span class="loading-text">Loading contribution data...</span>
          </div>
        </div>
      ) : data ? (
        <>
          {/* KPI summary */}
          <div class="kpi-row">
            <div class="kpi-card">
              <div class="kpi-label">Items Deposited</div>
              <div class="kpi-value" style="color: var(--green)">
                {totalDeposited.toLocaleString()}
              </div>
            </div>
            <div class="kpi-card">
              <div class="kpi-label">Items Withdrawn</div>
              <div class="kpi-value" style="color: var(--red)">
                {totalWithdrawn.toLocaleString()}
              </div>
            </div>
            <div class="kpi-card">
              <div class="kpi-label">Net Value</div>
              <div
                class="kpi-value"
                style={`color: ${netValue > 0 ? "var(--green)" : netValue < 0 ? "var(--red)" : "var(--text-muted)"}`}
              >
                {netValue > 0 ? "+" : ""}
                {Math.round(netValue).toLocaleString()}
              </div>
            </div>
            <div class="kpi-card">
              <div class="kpi-label">Distinct Items</div>
              <div class="kpi-value text-accent">{rows.length}</div>
            </div>
          </div>

          {/* Search */}
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

          {/* Contribution table */}
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
                      { col: "net", label: "Net", style: "text-align: right" },
                      {
                        col: "deposited",
                        label: "Deposited",
                        style: "text-align: right",
                      },
                      {
                        col: "withdrawn",
                        label: "Withdrawn",
                        style: "text-align: right",
                      },
                      {
                        col: "unitValue",
                        label: "Value",
                        style: "text-align: right",
                      },
                      {
                        col: "totalValue",
                        label: "Net Value",
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
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 && (
                  <tr>
                    <td
                      colSpan={7}
                      style="text-align: center; color: var(--text-muted); padding: 24px"
                    >
                      {search
                        ? "No items match your search"
                        : `No contribution data found for ${playerName}`}
                    </td>
                  </tr>
                )}
                {rows.map((row) => (
                  <tr key={row.key}>
                    <td>{row.name}</td>
                    <td style="text-align: center">
                      <span class={`tier-badge tier-${row.tier}`}>
                        {formatTier(row.tier)}
                      </span>
                    </td>
                    <td
                      style={`text-align: right; font-weight: 700; color: ${row.net > 0 ? "var(--green)" : row.net < 0 ? "var(--red)" : "var(--text-muted)"}`}
                    >
                      {row.net > 0 ? "+" : ""}
                      {row.net.toLocaleString()}
                    </td>
                    <td style="text-align: right; color: var(--green)">
                      {row.deposited > 0
                        ? `+${row.deposited.toLocaleString()}`
                        : "-"}
                    </td>
                    <td style="text-align: right; color: var(--red)">
                      {row.withdrawn > 0
                        ? `-${row.withdrawn.toLocaleString()}`
                        : "-"}
                    </td>
                    <td style="text-align: right; color: var(--text-muted)">
                      {row.unitValue > 0 ? formatValue(row.unitValue) : "-"}
                    </td>
                    <td
                      style={`text-align: right; font-weight: 700; color: ${row.totalValue > 0 ? "var(--green)" : row.totalValue < 0 ? "var(--red)" : "var(--text-muted)"}`}
                    >
                      {row.totalValue !== 0
                        ? `${row.totalValue > 0 ? "+" : ""}${formatValue(row.totalValue)}`
                        : "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : null}
    </>
  );
}
