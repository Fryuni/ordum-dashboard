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
import { useMemo } from "preact/hooks";
import { useStore } from "@nanostores/preact";
import { persistentAtom } from "@nanostores/persistent";
import TierPlanCard from "../components/TierPlan";
import { buildSettlementPlan } from "../../common/settlement-planner";
import { gd } from "../../common/gamedata";
import {
  $empireClaims,
  $empireClaimsLoading,
  useCapitalAsDefault,
} from "../stores/craftSource";
import { convexSub } from "../stores/convexSub";
import { api } from "../../../convex/_generated/api";

const $settlementClaim = persistentAtom<string>("settlementClaim", "");
useCapitalAsDefault($settlementClaim);

const $settlementData = convexSub(
  [$settlementClaim],
  api.empireData.getSettlementData,
  (claimId) => (claimId ? { claimId } : null),
);

export default function SettlementPage() {
  const claims = useStore($empireClaims);
  const claimsLoading = useStore($empireClaimsLoading);
  const selectedClaim = useStore($settlementClaim);
  const dataState = useStore($settlementData);

  const data = useMemo(() => {
    if (dataState.state !== "ready" || !dataState.value) return null;
    const raw = dataState.value as {
      currentTier: number;
      supplies: number;
      learnedCount: number;
      claimName: string;
      learnedIds: number[];
      inventory: Record<string, number>;
    };
    const learnedIds = new Set<number>(raw.learnedIds);
    const inventory = new Map<string, number>(
      Object.entries(raw.inventory as Record<string, number>),
    );
    const plans = buildSettlementPlan(
      raw.currentTier,
      learnedIds,
      raw.supplies,
      inventory,
    );
    return {
      currentTier: raw.currentTier,
      supplies: raw.supplies,
      learnedCount: raw.learnedCount,
      totalTechs: gd.claimTechs.length,
      claimName: raw.claimName,
      plans,
    };
  }, [dataState]);

  function handleClaimChange(e: Event) {
    $settlementClaim.set((e.target as HTMLSelectElement).value);
  }

  if (dataState.state === "failed") {
    return (
      <div class="error-banner">
        <span class="error-icon">⚠</span>
        <span>{String(dataState.error)}</span>
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
                <option value="" disabled>
                  Loading claims…
                </option>
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
