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
import { useStore } from "@nanostores/preact";
import { useCallback, useRef, useState } from "preact/hooks";
import {
  $warData,
  $claimSearchQuery,
  $claimSearchResults,
  $claimSearchLoading,
  $trackedClaimIdList,
  addTrackedClaim,
  removeTrackedClaim,
  searchClaims,
  type WarClaimInfo,
} from "../stores/war";

export default function WarPage() {
  const warDataAsync = useStore($warData);
  const trackedIds = useStore($trackedClaimIdList);

  if (warDataAsync.state === "loading") {
    return (
      <div class="loading-container">
        <div class="spinner-wrap">
          <div class="spinner" />
          <span class="loading-text">Loading war data...</span>
        </div>
      </div>
    );
  }

  if (warDataAsync.state === "failed") {
    return (
      <div class="error-banner">
        <span class="error-icon">⚠</span>
        <span>{String(warDataAsync.error)}</span>
      </div>
    );
  }

  const warData = warDataAsync.value;
  if (!warData) {
    return (
      <div class="loading-container">
        <div class="spinner-wrap">
          <div class="spinner" />
          <span class="loading-text">Loading war data...</span>
        </div>
      </div>
    );
  }

  const empireTotals = aggregateTotals(warData.empireClaims);
  const trackedTotals = aggregateTotals(warData.trackedClaims);

  return (
    <>
      <div class="page-header">
        <h1>War Tracker</h1>
        <p class="subtitle">
          Empire claims vs. tracked rivals &middot; Last updated:{" "}
          {new Date(warData.fetchedAt).toLocaleString("en-US", {
            dateStyle: "medium",
            timeStyle: "short",
          })}
        </p>
      </div>

      {/* Summary comparison */}
      {warData.trackedClaims.length > 0 && (
        <div class="war-summary">
          <SummaryColumn
            label="Ordum Empire"
            totals={empireTotals}
            count={warData.empireClaims.length}
            accent="var(--accent-3)"
          />
          <div class="war-vs">VS</div>
          <SummaryColumn
            label="Tracked Rivals"
            totals={trackedTotals}
            count={warData.trackedClaims.length}
            accent="var(--red)"
          />
        </div>
      )}

      {/* Stat bars */}
      {warData.trackedClaims.length > 0 && (
        <div class="war-comparison-bars">
          <ComparisonBar
            label="Members"
            empire={empireTotals.members}
            rival={trackedTotals.members}
          />
          <ComparisonBar
            label="Tiles"
            empire={empireTotals.tiles}
            rival={trackedTotals.tiles}
          />
          <ComparisonBar
            label="Supplies"
            empire={empireTotals.supplies}
            rival={trackedTotals.supplies}
          />
          <ComparisonBar
            label="Treasury"
            empire={empireTotals.treasury}
            rival={trackedTotals.treasury}
          />
        </div>
      )}

      {/* Add tracked claims */}
      <ClaimSearch
        trackedIds={trackedIds}
        empireClaimIds={warData.empireClaims.map((c) => c.entityId)}
      />

      {/* Claims tables side by side */}
      <div class="war-tables">
        <div class="war-table-section">
          <h2 class="war-table-title war-empire-title">Empire Claims</h2>
          <ClaimsTable claims={warData.empireClaims} showRemove={false} />
        </div>
        <div class="war-table-section">
          <h2 class="war-table-title war-rival-title">Tracked Rivals</h2>
          {warData.trackedClaims.length === 0 ? (
            <div class="empty-state">
              <span class="empty-icon">🔍</span>
              <p>No rivals tracked yet. Search for claims above to add them.</p>
            </div>
          ) : (
            <ClaimsTable claims={warData.trackedClaims} showRemove={true} />
          )}
        </div>
      </div>
    </>
  );
}

function aggregateTotals(claims: WarClaimInfo[]) {
  let members = 0;
  let tiles = 0;
  let supplies = 0;
  let treasury = 0;
  let maxTier = 0;
  for (const c of claims) {
    members += c.memberCount;
    tiles += c.numTiles;
    supplies += c.supplies;
    treasury += c.treasury;
    if (c.tier && c.tier > maxTier) maxTier = c.tier;
  }
  return { members, tiles, supplies, treasury, maxTier };
}

function SummaryColumn({
  label,
  totals,
  count,
  accent,
}: {
  label: string;
  totals: ReturnType<typeof aggregateTotals>;
  count: number;
  accent: string;
}) {
  return (
    <div class="war-summary-col" style={{ "--summary-accent": accent } as any}>
      <div class="war-summary-label">{label}</div>
      <div class="war-summary-stats">
        <div class="war-summary-stat">
          <span class="war-stat-value">{count}</span>
          <span class="war-stat-label">Claims</span>
        </div>
        <div class="war-summary-stat">
          <span class="war-stat-value">{totals.members.toLocaleString()}</span>
          <span class="war-stat-label">Members</span>
        </div>
        <div class="war-summary-stat">
          <span class="war-stat-value">{totals.tiles.toLocaleString()}</span>
          <span class="war-stat-label">Tiles</span>
        </div>
        <div class="war-summary-stat">
          <span class="war-stat-value">{totals.supplies.toLocaleString()}</span>
          <span class="war-stat-label">Supplies</span>
        </div>
        <div class="war-summary-stat">
          <span class="war-stat-value">{totals.treasury.toLocaleString()}</span>
          <span class="war-stat-label">Treasury</span>
        </div>
      </div>
    </div>
  );
}

function ComparisonBar({
  label,
  empire,
  rival,
}: {
  label: string;
  empire: number;
  rival: number;
}) {
  const total = empire + rival;
  if (total === 0) return null;
  const empirePct = (empire / total) * 100;
  const rivalPct = (rival / total) * 100;

  return (
    <div class="war-bar-row">
      <span class="war-bar-label">{label}</span>
      <div class="war-bar-values">
        <span class="war-bar-empire-val">{empire.toLocaleString()}</span>
        <div class="war-bar-track">
          <div class="war-bar-empire" style={{ width: `${empirePct}%` }} />
          <div class="war-bar-rival" style={{ width: `${rivalPct}%` }} />
        </div>
        <span class="war-bar-rival-val">{rival.toLocaleString()}</span>
      </div>
    </div>
  );
}

function ClaimSearch({
  trackedIds,
  empireClaimIds,
}: {
  trackedIds: string[];
  empireClaimIds: string[];
}) {
  const searchResults = useStore($claimSearchResults);
  const searchLoading = useStore($claimSearchLoading);
  const [query, setQuery] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleInput = useCallback((e: Event) => {
    const value = (e.target as HTMLInputElement).value;
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      $claimSearchQuery.set(value);
      searchClaims(value);
    }, 300);
  }, []);

  const handleAdd = useCallback((claimId: string) => {
    addTrackedClaim(claimId);
  }, []);

  return (
    <div class="war-search-section">
      <h3>Track a Rival Claim</h3>
      <div class="war-search-input-wrap">
        <input
          type="text"
          class="custom-input"
          placeholder="Search claims by name..."
          value={query}
          onInput={handleInput}
        />
        {searchLoading && <div class="spinner war-search-spinner" />}
      </div>
      {searchResults.length > 0 && (
        <div class="war-search-results">
          {searchResults.map((cl) => {
            const isTracked = trackedIds.includes(cl.entityId);
            const isEmpire = empireClaimIds.includes(cl.entityId);
            return (
              <div key={cl.entityId} class="war-search-result">
                <div class="war-search-result-info">
                  <span class="war-search-result-name">{cl.name}</span>
                  <span class="war-search-result-meta">
                    {cl.regionName}
                    {cl.tier ? ` · T${cl.tier}` : ""}
                    {cl.empireName ? ` · ${cl.empireName}` : ""}
                  </span>
                </div>
                {isEmpire ? (
                  <span class="war-badge war-badge-empire">Empire</span>
                ) : isTracked ? (
                  <span class="war-badge war-badge-tracked">Tracked</span>
                ) : (
                  <button
                    class="btn btn-small btn-primary"
                    onClick={() => handleAdd(cl.entityId)}
                  >
                    Track
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ClaimsTable({
  claims,
  showRemove,
}: {
  claims: WarClaimInfo[];
  showRemove: boolean;
}) {
  return (
    <table class="modern-table">
      <thead>
        <tr>
          <th>Claim</th>
          <th>Region</th>
          <th>Tier</th>
          <th>Members</th>
          <th>Tiles</th>
          <th>Supplies</th>
          <th>Treasury</th>
          {showRemove && <th />}
        </tr>
      </thead>
      <tbody>
        {claims.map((c) => (
          <tr key={c.entityId}>
            <td>
              <div class="war-claim-name">
                {c.name}
                {c.empireName && !c.isEmpire && (
                  <span class="war-empire-tag">{c.empireName}</span>
                )}
              </div>
            </td>
            <td>{c.regionName}</td>
            <td>
              {c.tier ? <span class="tier-badge-label">T{c.tier}</span> : "—"}
            </td>
            <td>{c.memberCount}</td>
            <td>{c.numTiles.toLocaleString()}</td>
            <td>{c.supplies.toLocaleString()}</td>
            <td>{c.treasury.toLocaleString()}</td>
            {showRemove && (
              <td>
                <button
                  class="btn btn-small war-btn-remove"
                  onClick={() => removeTrackedClaim(c.entityId)}
                  title="Stop tracking"
                >
                  ✕
                </button>
              </td>
            )}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
