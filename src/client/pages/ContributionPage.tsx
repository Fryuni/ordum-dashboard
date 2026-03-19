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
import { useState, useEffect, useMemo } from "preact/hooks";
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
import { ORDUM_MAIN_CLAIM_ID } from "../../common/ordum-types";
import type { ContributionLogEntry } from "../../server/contribution";
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
  if (meta?.tier) return meta.tier;
  if (type === "Item") return gd.items.get(id)?.tier ?? 0;
  return gd.cargo.get(id)?.tier ?? 0;
}

export default function ContributionPage() {
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());

  const claims = useStore($empireClaims);
  const claimsLoading = useStore($empireClaimsLoading);
  const selectedClaim = useStore($contributionClaim);
  const selectedPlayer = useStore($contributionPlayer);
  const membersAsync = useStore($claimMembers);
  const dataAsync = useStore($contributionData);

  const members =
    membersAsync.state === "loaded" ? (membersAsync.value ?? []) : [];
  const data: ContributionData | null =
    dataAsync.state === "loaded" ? (dataAsync.value ?? null) : null;
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
    // If the selected player isn't in the new members list, clear it
    if (
      membersAsync.state === "loaded" &&
      selectedPlayer &&
      !members.find((m) => m.playerEntityId === selectedPlayer)
    ) {
      $contributionPlayer.set("");
    }
  }, [membersAsync.state, selectedClaim]);

  // Sort aggregate entries by absolute net quantity descending
  const sortedAggregate = useMemo(() => {
    if (!data) return [];
    return Object.entries(data.aggregate)
      .filter(([, qty]) => qty !== 0)
      .sort(([, a], [, b]) => Math.abs(b) - Math.abs(a));
  }, [data]);

  // Group logs by item key
  const logsByItem = useMemo(() => {
    if (!data) return new Map<string, ContributionLogEntry[]>();
    const map = new Map<string, ContributionLogEntry[]>();
    for (const log of data.logs) {
      const arr = map.get(log.itemKey) ?? [];
      arr.push(log);
      map.set(log.itemKey, arr);
    }
    return map;
  }, [data]);

  // All item keys that have either aggregate or logs
  const allItemKeys = useMemo(() => {
    const keys = new Set<string>();
    if (data) {
      for (const key of Object.keys(data.aggregate)) {
        if (data.aggregate[key] !== 0) keys.add(key);
      }
      for (const key of logsByItem.keys()) {
        keys.add(key);
      }
    }
    return [...keys].sort((a, b) => {
      const absA = Math.abs(data?.aggregate[a] ?? 0);
      const absB = Math.abs(data?.aggregate[b] ?? 0);
      return absB - absA;
    });
  }, [data, logsByItem]);

  function toggleItem(key: string) {
    setExpandedItems((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

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
              {!claimsLoading && claims.length === 0 && (
                <option value={ORDUM_MAIN_CLAIM_ID}>Ordum City</option>
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
                {sortedAggregate
                  .filter(([, q]) => q > 0)
                  .reduce((s, [, q]) => s + q, 0)
                  .toLocaleString()}
              </div>
            </div>
            <div class="kpi-card">
              <div class="kpi-label">Items Withdrawn</div>
              <div class="kpi-value" style="color: var(--red)">
                {Math.abs(
                  sortedAggregate
                    .filter(([, q]) => q < 0)
                    .reduce((s, [, q]) => s + q, 0),
                ).toLocaleString()}
              </div>
            </div>
            <div class="kpi-card">
              <div class="kpi-label">Distinct Items</div>
              <div class="kpi-value text-accent">{sortedAggregate.length}</div>
            </div>
          </div>

          {/* Contribution table with expandable log rows */}
          <div class="table-wrapper">
            <table class="modern-table">
              <thead>
                <tr>
                  <th style="width: 40%">Item</th>
                  <th style="width: 10%; text-align: center">Tier</th>
                  <th style="width: 20%; text-align: right">
                    Net Contribution
                  </th>
                  <th style="width: 15%; text-align: right">Deposited</th>
                  <th style="width: 15%; text-align: right">Withdrawn</th>
                </tr>
              </thead>
              <tbody>
                {allItemKeys.length === 0 && (
                  <tr>
                    <td
                      colSpan={5}
                      style="text-align: center; color: var(--text-muted); padding: 24px"
                    >
                      No contribution data found for {playerName}
                    </td>
                  </tr>
                )}
                {allItemKeys.map((key) => {
                  const net = data.aggregate[key] ?? 0;
                  const logs = logsByItem.get(key) ?? [];
                  const deposited = logs
                    .filter((l) => l.action === "deposit")
                    .reduce((s, l) => s + l.quantity, 0);
                  const withdrawn = logs
                    .filter((l) => l.action === "withdraw")
                    .reduce((s, l) => s + l.quantity, 0);
                  const expanded = expandedItems.has(key);

                  return (
                    <>
                      <tr
                        key={key}
                        onClick={() => logs.length > 0 && toggleItem(key)}
                        style={logs.length > 0 ? "cursor: pointer" : undefined}
                      >
                        <td>
                          {logs.length > 0 && (
                            <span class="contrib-expand-icon">
                              {expanded ? "\u25BC" : "\u25B6"}
                            </span>
                          )}
                          {itemName(key, data.items)}
                        </td>
                        <td style="text-align: center">
                          T{itemTier(key, data.items)}
                        </td>
                        <td
                          style={`text-align: right; font-weight: 700; color: ${net > 0 ? "var(--green)" : net < 0 ? "var(--red)" : "var(--text-muted)"}`}
                        >
                          {net > 0 ? "+" : ""}
                          {net.toLocaleString()}
                        </td>
                        <td style="text-align: right; color: var(--green)">
                          {deposited > 0
                            ? `+${deposited.toLocaleString()}`
                            : "-"}
                        </td>
                        <td style="text-align: right; color: var(--red)">
                          {withdrawn > 0
                            ? `-${withdrawn.toLocaleString()}`
                            : "-"}
                        </td>
                      </tr>
                      {expanded &&
                        logs.map((log) => (
                          <tr key={log.id} class="contrib-log-row">
                            <td style="padding-left: 32px; color: var(--text-muted); font-size: 0.8rem">
                              {log.buildingName}
                            </td>
                            <td />
                            <td
                              style={`text-align: right; font-size: 0.85rem; color: ${log.action === "deposit" ? "var(--green)" : "var(--red)"}`}
                            >
                              {log.action === "deposit" ? "+" : "-"}
                              {log.quantity.toLocaleString()}
                            </td>
                            <td
                              colSpan={2}
                              style="text-align: right; color: var(--text-muted); font-size: 0.75rem"
                            >
                              {new Date(log.timestamp).toLocaleString()}
                            </td>
                          </tr>
                        ))}
                    </>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      ) : null}
    </>
  );
}
