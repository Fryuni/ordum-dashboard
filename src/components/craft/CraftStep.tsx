import type { CraftStep as Step } from "../../lib/craft-planner";

export default function CraftStep({ step }: { step: Step }) {
  const nameParts = [...step.outputs, ...step.inputs].map((c) => c.name);
  const firstOutput = step.outputs[0];
  return !firstOutput ? (
    <div class="error-banner">
      <span class="error-icon">⚠</span>
      <span>No output defined for step!</span>
    </div>
  ) : (
    <div class="timeline-step">
      <div class="timeline-node">{step.depth + 1}</div>
      <div class="timeline-card">
        <div class="step-header">
          <span class="step-title">
            {step.outputs.length > 1
              ? step.recipe_name.replace(/\{(\d+)\}/g, (_, index) => {
                  return nameParts[Number.parseInt(index, 10)] || `#${index}`;
                })
              : firstOutput.name}
          </span>
          <span class="step-qty">
            ×{step.craft_count} craft{step.craft_count > 1 ? "s" : ""} →{" "}
            {step.craft_count * firstOutput.quantity_per_craft} output
          </span>
          <div class="badges">
            {step.building_type && (
              <span class="badge">
                🏠 {step.building_type}
                {step.building_tier ? " T" + step.building_tier : ""}
              </span>
            )}
            {(step.skill_requirements || []).map((s) => (
              <span class="badge" key={s.skill}>
                ⚡ {s.skill} Lv{s.level}
              </span>
            ))}
            {(step.tool_requirements || []).map((t) => (
              <span class="badge" key={t.tool}>
                🔧 {t.tool}
              </span>
            ))}
          </div>
        </div>
        <div class="input-grid">
          {step.inputs.map((inp) => {
            const total = inp.quantity_per_craft * step.craft_count;
            const available = inp.available || 0;
            const deficit = Math.max(0, total - available);
            const d = deficit > 0;
            return (
              <div class={`input-card ${d ? "deficit" : "ok"}`} key={inp.name}>
                <span class="input-name">{inp.name}</span>
                <span class={`input-qty ${d ? "deficit" : "ok"}`}>
                  {available} / {total}
                  {d ? ` (need ${deficit})` : ""}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
