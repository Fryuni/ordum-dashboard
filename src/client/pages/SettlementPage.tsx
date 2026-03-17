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
import { useStore } from "@nanostores/preact";
import TierPlanCard from "../components/TierPlan";
import type { TierPlan } from "../../common/settlement-planner";
import {
  $empireClaims,
  $empireClaimsLoading,
  fetchEmpireClaims,
} from "../stores/craftSource";
import type { EmpireClaimInfo } from "../../common/ordum-types";
import { ORDUM_MAIN_CLAIM_ID } from "../../common/ordum-types";

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
  const [selectedClaim, setSelectedClaim] = useState(ORDUM_MAIN_CLAIM_ID);
  const claims = useStore($empireClaims);
  const claimsLoading = useStore($empireClaimsLoading);

  // Fetch empire claims on mount
  useEffect(() => {
    fetchEmpireClaims();
  }, []);

  // Fetch settlement data when claim changes
  useEffect(() => {
    setData(null);
    setError(null);
    fetch(`/api/settlement?claim=${encodeURIComponent(selectedClaim)}`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then(setData)
      .catch((e) => setError(String(e)));
  }, [selectedClaim]);

  function handleClaimChange(e: Event) {
    setSelectedClaim((e.target as HTMLSelectElement).value);
  }

  if (error) {
    return (
      <div class="error-banner">
        <span class="error-icon">⚠</span>
        <span>{error}</span>
      </div>
    );
  }

  return (
    <>
      <div class="page-header">
        <h1>🏰 Settlement Planner</h1>
        <p class="subtitle">
          Track research requirements and item availability for your claims
        </p>
      </div>

      <div class="planner-card">
        <div class="form-row">
          <div class="input-group source-select-container">
            <label for="settlement-claim">Claim</label>
            <select
              id="settlement-claim"
              class="source-select"
              value={selectedClaim}
              onChange={handleClaimChange}
            >
              {claimsLoading && claims.length === 0 && (
                <option disabled>Loading claims…</option>
              )}
              {claims.map((claim) => (
                <option key={claim.id} value={claim.id}>
                  🏰 {claim.name}
                </option>
              ))}
              {!claimsLoading && claims.length === 0 && (
                <option value={ORDUM_MAIN_CLAIM_ID}>🏰 Ordum City</option>
              )}
            </select>
          </div>
        </div>
      </div>

      {!data ? (
        <div class="loading-container">
          <div class="spinner-wrap">
            <div class="spinner" />
            <span class="loading-text">Loading settlement data…</span>
          </div>
        </div>
      ) : (
        <>
          <div class="kpi-row">
            <div class="kpi-card">
              <div class="kpi-label">Current Tier</div>
              <div class="kpi-value text-accent">{data.currentTier}</div>
            </div>
            <div class="kpi-card">
              <div class="kpi-label">Available Supplies</div>
              <div class="kpi-value">{data.supplies.toLocaleString()}</div>
            </div>
            <div class="kpi-card">
              <div class="kpi-label">Techs Researched</div>
              <div class="kpi-value">
                {data.learnedCount}
                <span class="kpi-muted"> / {data.totalTechs}</span>
              </div>
            </div>
          </div>

          <div class="timeline-nav-container">
            <div class="timeline-nav">
              {data.plans.map((p) => (
                <a
                  key={p.tier}
                  href={`#tier-${p.tier}`}
                  class={`tl-node ${p.tier <= data.currentTier ? "tl-done" : p.tier === data.currentTier + 1 ? "tl-active" : "tl-future"}`}
                >
                  <span class="tl-circle">
                    {p.tier <= data.currentTier ? "✓" : p.tier}
                  </span>
                  <span class="tl-label">Tier {p.tier}</span>
                </a>
              ))}
            </div>
          </div>

          <div class="plans-container">
            {data.plans
              .filter((p) => p.tier === data.currentTier + 1)
              .map((plan) => (
                <TierPlanCard
                  key={plan.tier}
                  plan={plan}
                  isNextTier={true}
                  currentTier={data.currentTier}
                  claimId={selectedClaim}
                />
              ))}
          </div>
        </>
      )}
    </>
  );
}
