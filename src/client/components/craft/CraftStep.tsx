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
import type { CraftStep as Step } from "../../../common/craft-planner";

export default function CraftStep({ step }: { step: Step }) {
  const firstOutput = step.outputs[0];
  const hasWarning = step.missing_skill || step.missing_tool;
  return !firstOutput ? (
    <div class="error-banner">
      <span class="error-icon">⚠</span>
      <span>No output defined for step!</span>
    </div>
  ) : (
    <div class={`timeline-step ${hasWarning ? "step-unavailable" : ""}`}>
      <div class="timeline-node">{step.depth + 1}</div>
      <div class="timeline-card">
        <div class="step-header">
          <span class="step-title">
            {step.outputs.length > 1 ? step.recipe_name : firstOutput.item.name}
          </span>
          <span class="step-qty">
            ×{step.craft_count} craft{step.craft_count > 1 ? "s" : ""} →{" "}
            {(step.craft_count * firstOutput.quantity_per_craft).toFixed(0)}{" "}
            output
          </span>
          <div class="badges">
            {hasWarning && (
              <span class="badge badge-warning" title="You lack the required skill level or tool tier for this recipe">
                ⚠ Unavailable
              </span>
            )}
            {step.building_type && (
              <span class="badge">
                🏠 {step.building_type}
                {step.building_tier ? " T" + step.building_tier : ""}
              </span>
            )}
            {(step.skill_requirements || []).map((s) => (
              <span class={`badge ${step.missing_skill ? "badge-warning" : ""}`} key={s.skill}>
                ⚡ {s.skill} Lv{s.level}
              </span>
            ))}
            {(step.tool_requirements || []).map((t) => (
              <span class={`badge ${step.missing_tool ? "badge-warning" : ""}`} key={t.tool}>
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
              <div
                class={`input-card ${d ? "deficit" : "ok"}`}
                key={inp.item.name}
              >
                <span class="input-name">{inp.item.name}</span>
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
