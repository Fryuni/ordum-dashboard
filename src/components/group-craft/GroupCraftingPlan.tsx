import { useStore } from "@nanostores/preact";
import { $groupCraftPlan, $groupTargets } from "../../lib/group-craft-store";
import PlanCard from "../craft/PlanCard";

export default function GroupCraftingPlan() {
  const craftPlan = useStore($groupCraftPlan);
  const targets = useStore($groupTargets);

  const hasTargets = targets.length > 0;
  const isLoading = craftPlan.state === "loading";
  const hasPlan = craftPlan.state === "loaded" && craftPlan.value;

  return (
    <>
      {hasTargets && isLoading && (
        <div class="loading-container">
          <div class="spinner-wrap">
            <div class="spinner" />
            <span class="loading-text">Computing craft plan…</span>
          </div>
        </div>
      )}

      {craftPlan.state === "failed" && (
        <div class="error-banner">
          <span class="error-icon">⚠</span>
          <span>{String(craftPlan.error)}</span>
        </div>
      )}

      {hasPlan &&
        (() => {
          const results = craftPlan.value!;
          return (
            <div class={`results ${isLoading ? "faded" : ""}`}>
              <div class="player-context">
                🏰 Using <strong>Ordum Claim</strong> building storage
                <span class="inv-count">
                  📦 {results.inventory_size} item types
                </span>
              </div>

              <PlanCard
                plan={results.plan}
                allDoneMessage="✅ The claim already has everything needed!"
              />
            </div>
          );
        })()}
    </>
  );
}
