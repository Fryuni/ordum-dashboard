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
import StatCard from "../components/StatCard";
import { convexSub } from "../stores/convexSub";
import { api } from "../../../convex/_generated/api";
import { computedAsync } from "@nanostores/async";
import { computed } from "nanostores";

const $dashboardData = convexSub(
  [],
  api.empireData.getDashboardData,
  () => ({}),
);

const $onlineUsersAsync = computedAsync($dashboardData, async (data) => {
  // TODO: Find an efficient way to get the number of online players.
  //   BitJita has it on the UI, but not on the API:
  //   https://bitjita.com/empires/379564/overview
  return null;
});

const $onlineUsers = computed($onlineUsersAsync, (data) =>
  data.state === "ready" ? data.value : null,
);

export default function DashboardPage() {
  const dataState = useStore($dashboardData);
  const onlineCount = useStore($onlineUsers);

  if (dataState.state === "failed") {
    return (
      <div class="error-banner">
        <span class="error-icon">⚠</span>
        <span>{String(dataState.error)}</span>
      </div>
    );
  }

  if (dataState.state === "loading") {
    return (
      <div class="loading-container">
        <div class="spinner-wrap">
          <div class="spinner" />
          <span class="loading-text">Loading empire data…</span>
        </div>
      </div>
    );
  }

  const empire = dataState.value;

  return (
    <>
      <div class="page-header">
        <h1>👑 Ordum Empire</h1>
        <p class="subtitle">
          {empire.synced_at
            ? `Last synced: ${new Date(empire.synced_at).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}`
            : "Syncing…"}{" "}
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
          value={onlineCount ?? "…"}
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
          label="Hexite Reserve"
          value={empire.hexite_reserve}
          icon="💎"
          accent="var(--accent-4)"
        />
        <StatCard
          label="Total Land"
          value={empire.totals.total_tiles}
          icon="🧱"
          accent="var(--accent-2)"
        />
        <StatCard
          label="Treasury"
          value={empire.claims.reduce(
            (s: number, c: { treasury: number }) => s + c.treasury,
            0,
          )}
          icon="💰"
          accent="var(--accent-4)"
        />
      </div>

      {empire.claims.map((c: any) => (
        <ClaimSection
          key={c.entity_id}
          claim={c}
          isCapital={String(c.entity_id) === empire.capital_claim_entity_id}
        />
      ))}
    </>
  );
}

function ClaimSection({
  claim: c,
  isCapital,
}: {
  claim: {
    entity_id: string;
    name: string;
    region: string;
    tier: number | null;
    supplies: number;
    treasury: number;
    num_tiles: number;
    building_count: number;
    member_count: number;
  };
  isCapital: boolean;
}) {
  return (
    <div class="claim-section">
      <div class="claim-bar">
        <div class="claim-title-area">
          <span class="claim-icon">{isCapital ? "👑" : "🏰"}</span>
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
    </div>
  );
}
