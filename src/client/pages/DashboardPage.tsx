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
import { useState, useEffect } from "preact/hooks";
import type { EmpireSummary } from "../../common/ordum-types";
import StatCard from "../components/StatCard";
import ResourceTable from "../components/ResourceTable";
import MembersTable from "../components/MembersTable";

export default function DashboardPage() {
  const [empire, setEmpire] = useState<EmpireSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/empire")
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then(setEmpire)
      .catch((e) => setError(String(e)));
  }, []);

  if (error) {
    return (
      <div class="error-banner">
        <span class="error-icon">⚠</span>
        <span>{error}</span>
      </div>
    );
  }

  if (!empire) {
    return (
      <div class="loading-container">
        <div class="spinner-wrap">
          <div class="spinner" />
          <span class="loading-text">Loading empire data…</span>
        </div>
      </div>
    );
  }

  const mainClaim = empire.claims[0];

  return (
    <>
      <div class="page-header">
        <h1>👑 Ordum Empire</h1>
        <p class="subtitle">
          Last updated:{" "}
          {new Date(empire.fetched_at).toLocaleString("en-US", {
            dateStyle: "medium",
            timeStyle: "short",
          })}{" "}
          · {empire.claims.length} claim{empire.claims.length > 1 ? "s" : ""}
        </p>
      </div>

      <div class="stats-grid">
        <StatCard
          label="Total Members"
          value={empire.totals.total_members}
          icon="👥"
          accent="var(--accent)"
        />
        <StatCard
          label="Online Now"
          value={empire.totals.online_members}
          icon="🟢"
          accent="var(--accent-3)"
        />
        <StatCard
          label="Buildings"
          value={empire.totals.total_buildings}
          icon="🏠"
          accent="var(--accent-2)"
        />
        <StatCard
          label="Building Resources"
          value={empire.totals.total_building_resource_count}
          icon="📦"
          accent="var(--accent-4)"
        />
        <StatCard
          label="Player Resources"
          value={empire.totals.total_player_resource_count}
          icon="🎒"
          accent="var(--accent)"
        />
        <StatCard
          label="Resource Types"
          value={
            empire.totals.total_building_resource_types +
            empire.totals.total_player_resource_types
          }
          icon="📋"
          accent="var(--accent-2)"
        />
        <StatCard
          label="Tools"
          value={empire.totals.total_tool_count}
          icon="⛏️"
          accent="var(--accent-3)"
        />
        <StatCard
          label="Treasury"
          value={mainClaim ? mainClaim.treasury : "—"}
          icon="💰"
          accent="var(--accent-4)"
        />
      </div>

      {empire.claims.map((c, i) => (
        <ClaimSection key={c.entity_id} claim={c} index={i} />
      ))}

      {empire.claims.length > 1 && <EmpireTotals empire={empire} />}
    </>
  );
}

function ClaimSection({
  claim: c,
  index: i,
}: {
  claim: EmpireSummary["claims"][0];
  index: number;
}) {
  const [activeTab, setActiveTab] = useState("buildings");

  return (
    <div class="claim-section">
      <div class="claim-bar">
        <div class="claim-title-area">
          <span class="claim-icon">{i === 0 ? "👑" : "🏰"}</span>
          <h2 class="claim-name">{c.name}</h2>
          <span class="tier-badge-label">Tier {c.tier ?? "?"}</span>
        </div>
        <div class="claim-meta">
          <div class="meta-item">
            🗺️ <span>{c.region}</span>
          </div>
          <div class="meta-item">
            📦 <span>{c.supplies.toLocaleString()} supplies</span>
          </div>
          <div class="meta-item">
            💰 <span>{c.treasury.toLocaleString()} gold</span>
          </div>
          <div class="meta-item">
            🧱 <span>{c.num_tiles.toLocaleString()} tiles</span>
          </div>
          <div class="meta-item">
            🏠 <span>{c.building_count} buildings</span>
          </div>
          <div class="meta-item">
            👥 <span>{c.member_count} members</span>
          </div>
        </div>
      </div>

      <div class="tabs-container">
        <div class="tabs">
          {(
            [
              ["buildings", "🏠", "Building Storage"],
              ["players", "🎒", "Player Inventory"],
              ["tools", "⛏️", "Tools"],
              ["members", "👥", "Members"],
            ] as const
          ).map(([key, icon, label]) => (
            <button
              key={key}
              class={`tab-btn ${activeTab === key ? "active" : ""}`}
              onClick={() => setActiveTab(key)}
            >
              <span class="tab-icon">{icon}</span> {label}
            </button>
          ))}
        </div>
      </div>

      {activeTab === "buildings" && (
        <ResourceTable
          title="Building Storage"
          resources={c.building_resources}
          showLocations={true}
          id={`building-res-${i}`}
        />
      )}
      {activeTab === "players" && (
        <>
          <ResourceTable
            title="Online Player Inventory"
            resources={c.player_resources}
            showLocations={true}
            id={`player-res-${i}`}
          />
          <div style={{ height: 16 }} />
          <ResourceTable
            title="Offline Player Inventory"
            resources={c.player_offline_resources}
            showLocations={true}
            id={`offline-res-${i}`}
          />
        </>
      )}
      {activeTab === "tools" && (
        <>
          <ResourceTable
            title="Online Player Tools"
            resources={c.tool_resources}
            id={`tools-online-${i}`}
          />
          <div style={{ height: 16 }} />
          <ResourceTable
            title="Offline Player Tools"
            resources={c.tool_offline_resources}
            id={`tools-offline-${i}`}
          />
        </>
      )}
      {activeTab === "members" && (
        <MembersTable members={c.members} claimName={c.name} />
      )}
    </div>
  );
}

function EmpireTotals({ empire }: { empire: EmpireSummary }) {
  const [activeTab, setActiveTab] = useState("buildings");

  return (
    <div class="claim-section">
      <div class="claim-bar empire-bar">
        <div class="claim-title-area">
          <span class="claim-icon">🌐</span>
          <h2 class="claim-name">Empire-Wide Totals</h2>
        </div>
      </div>

      <div class="tabs-container">
        <div class="tabs">
          {(
            [
              ["buildings", "🏠", "All Building Resources"],
              ["players", "🎒", "All Player Resources"],
              ["tools", "⛏️", "All Tools"],
            ] as const
          ).map(([key, icon, label]) => (
            <button
              key={key}
              class={`tab-btn ${activeTab === key ? "active" : ""}`}
              onClick={() => setActiveTab(key)}
            >
              <span class="tab-icon">{icon}</span> {label}
            </button>
          ))}
        </div>
      </div>

      {activeTab === "buildings" && (
        <ResourceTable
          title="All Building Resources (Empire)"
          resources={empire.all_building_resources}
          id="empire-building-res"
        />
      )}
      {activeTab === "players" && (
        <ResourceTable
          title="All Player Resources (Empire)"
          resources={empire.all_player_resources}
          id="empire-player-res"
        />
      )}
      {activeTab === "tools" && (
        <ResourceTable
          title="All Tools (Empire)"
          resources={empire.all_tool_resources}
          id="empire-tool-res"
        />
      )}
    </div>
  );
}
