import RawMaterials from "./RawMaterials";
import CraftingSteps from "./CraftingSteps";
import type { CraftPlan } from "../../lib/craft-planner";

interface Props {
  plan: CraftPlan;
  allDoneMessage?: string;
}

export default function PlanCard({
  plan,
  allDoneMessage = "✅ You already have everything needed!",
}: Props) {
  return (
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
        <div class="all-done">{allDoneMessage}</div>
      )}
    </div>
  );
}
