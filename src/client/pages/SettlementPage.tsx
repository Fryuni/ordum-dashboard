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
import TierPlanCard from "../components/TierPlan";
import type { TierPlan } from "../../common/settlement-planner";

interface SettlementData {
  currentTier: number;
  supplies: number;
  learnedCount: number;
  totalTechs: number;
  claimName: string;
  plans: TierPlan[];
}

export default function SettlementPage() {
  const [data, setData] = useState<SettlementData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/settlement")
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then(setData)
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

  if (!data) {
    return (
      <div class="loading-container">
        <div class="spinner-wrap">
          <div class="spinner" />
          <span class="loading-text">Loading settlement data…</span>
        </div>
      </div>
    );
  }

  const { currentTier, supplies, learnedCount, totalTechs, claimName, plans } =
    data;

  return (
    <>
      <div class="page-header">
        <h1>🏰 Settlement Planner</h1>
        <p class="subtitle">
          Track research requirements and item availability for {claimName}
        </p>
      </div>

      <div class="kpi-row">
        <div class="kpi-card">
          <div class="kpi-label">Current Tier</div>
          <div class="kpi-value text-accent">{currentTier}</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">Available Supplies</div>
          <div class="kpi-value">{supplies.toLocaleString()}</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">Techs Researched</div>
          <div class="kpi-value">
            {learnedCount}
            <span class="kpi-muted"> / {totalTechs}</span>
          </div>
        </div>
      </div>

      <div class="timeline-nav-container">
        <div class="timeline-nav">
          {plans.map((p) => (
            <a
              key={p.tier}
              href={`#tier-${p.tier}`}
              class={`tl-node ${p.tier <= currentTier ? "tl-done" : p.tier === currentTier + 1 ? "tl-active" : "tl-future"}`}
            >
              <span class="tl-circle">
                {p.tier <= currentTier ? "✓" : p.tier}
              </span>
              <span class="tl-label">Tier {p.tier}</span>
            </a>
          ))}
        </div>
      </div>

      <div class="plans-container">
        {plans
          .filter((p) => p.tier === currentTier + 1)
          .map((plan) => (
            <TierPlanCard
              key={plan.tier}
              plan={plan}
              isNextTier={true}
              currentTier={currentTier}
            />
          ))}
      </div>
    </>
  );
}
