import type { CraftStep as Step } from "../../lib/craft-planner";
import CraftStep from "./CraftStep";

export default function CraftingSteps({ steps }: { steps: Step[] }) {
  if (steps.length === 0) return null;

  return (
    <div class="timeline-section">
      <h4>📋 Crafting Steps</h4>
      <div class="timeline">
        {steps.map((step, i) => (
          <CraftStep key={i} step={step} />
        ))}
      </div>
    </div>
  );
}
