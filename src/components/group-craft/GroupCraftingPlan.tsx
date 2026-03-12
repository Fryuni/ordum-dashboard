import { useStore } from "@nanostores/preact";
import { $groupCraftPlan, $groupTargets } from "../../lib/group-craft-store";
import RawMaterials from "../craft/RawMaterials";
import CraftingSteps from "../craft/CraftingSteps";

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
          const plan = results.plan;
          return (
            <div class={`results ${isLoading ? "faded" : ""}`}>
              <div class="player-context">
                🏰 Using <strong>Ordum Claim</strong> building storage
                <span class="inv-count">
                  📦 {results.inventory_size} item types
                </span>
              </div>

              <div class="plan-card">
                {plan.already_have?.length > 0 && (
                  <div class="already-have">
                    <h4>✅ Already Have</h4>
                    <div class="have-chips">
                      {plan.already_have.map((item: any) => (
                        <span class="have-chip" key={item.name}>
                          {item.name} <strong>×{item.quantity}</strong>
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <RawMaterials materials={plan.raw_materials ?? []} />
                <CraftingSteps steps={plan.steps ?? []} />

                {!plan.steps?.length && !plan.raw_materials?.length && (
                  <div class="all-done">
                    ✅ The claim already has everything needed!
                  </div>
                )}
              </div>
            </div>
          );
        })()}
    </>
  );
}
