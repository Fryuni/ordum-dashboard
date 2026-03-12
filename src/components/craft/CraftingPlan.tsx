import { useStore } from "@nanostores/preact";
import { $craftPlan, $targets } from "../../lib/craft-store";
import PlanCard from "./PlanCard";

export default function CraftingPlan() {
  const craftPlan = useStore($craftPlan);
  const targets = useStore($targets);

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
              {results.player && (
                <div class="player-context">
                  👤 Player: <strong>{results.player.username}</strong>
                  {results.player.signed_in ? (
                    <span class="online">● Online</span>
                  ) : (
                    <span class="offline">○ Offline</span>
                  )}
                  <span class="inv-count">
                    🎒 {results.inventory_size} item types
                  </span>
                </div>
              )}

              <PlanCard plan={results.plan} />
            </div>
          );
        })()}
    </>
  );
}
