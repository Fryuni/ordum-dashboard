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
import { memo } from "preact/compat";
import type { CraftStep as Step } from "../../../common/craft-planner";
import { nameWithRarity } from "../../../common/gamedata/helpers";
import type { PlayerCapabilities } from "../../../common/player-capabilities";

function CraftStep({
  step,
  capabilities,
}: {
  step: Step;
  capabilities?: PlayerCapabilities;
}) {
  const firstOutput = step.outputs[0];
  return !firstOutput ? (
    <div class="error-banner">
      <span class="error-icon">⚠</span>
      <span>No output defined for step!</span>
    </div>
  ) : (
    <div
      class={`timeline-step ${step.missing_skill || step.missing_tool ? "step-unavailable" : ""}`}
    >
      <div class="timeline-node">{step.depth + 1}</div>
      <div class="timeline-card">
        <div class="step-header">
          <span class="step-title">{step.recipe_name}</span>
          <span class="step-qty">
            ×{step.craft_count} craft{step.craft_count > 1 ? "s" : ""} →{" "}
            {(step.craft_count * firstOutput.quantity_per_craft).toFixed(0)}{" "}
            output
          </span>
          <div class="badges">
            {step.building_type && (
              <span class="badge">
                🏠 {step.building_type}
                {step.building_tier ? " T" + step.building_tier : ""}
              </span>
            )}
            {(step.skill_requirements || []).map((s) => {
              const playerLevel = capabilities?.hasSkillData
                ? (capabilities.skills.get(s.skill) ?? 0)
                : undefined;
              const isMissing =
                playerLevel !== undefined && playerLevel < s.level;
              return (
                <span
                  class={`badge ${isMissing ? "badge-warning" : ""}`}
                  key={s.skill}
                >
                  ⚡ {s.skill} Lv{s.level}
                  {isMissing && (
                    <span class="badge-tooltip">
                      Your {s.skill} is Lv{playerLevel}, need Lv{s.level}
                    </span>
                  )}
                </span>
              );
            })}
            {(step.tool_requirements || []).map((t) => {
              const playerTier = capabilities?.hasToolData
                ? (capabilities.maxToolTiers.get(t.tool) ?? 0)
                : undefined;
              const isMissing =
                playerTier !== undefined && playerTier < t.level;
              return (
                <span
                  class={`badge ${isMissing ? "badge-warning" : ""}`}
                  key={t.tool}
                >
                  🔧 {t.tool}
                  {isMissing && (
                    <span class="badge-tooltip">
                      {playerTier === 0
                        ? `You don't have a ${t.tool} (need T${t.level})`
                        : `Your best ${t.tool} is T${playerTier}, need T${t.level}`}
                    </span>
                  )}
                </span>
              );
            })}
          </div>
        </div>
        <div class="input-grid">
          {step.inputs.map((inp) => {
            const total = inp.quantity_per_craft * step.craft_count;
            const available = inp.available || 0;
            const fromInventory = inp.available_from_inventory || 0;
            const fromPlan = Math.max(0, available - fromInventory);
            const shortfall = Math.max(0, total - available);
            const state =
              fromInventory >= total
                ? "ok"
                : fromInventory > 0
                  ? "partial"
                  : "deficit";
            const planLabel = inp.is_raw ? "to gather" : "from earlier step";
            return (
              <div class={`input-card ${state}`} key={inp.item.name}>
                <span class="input-name">{nameWithRarity(inp.item)}</span>
                <div class="input-qty-group">
                  <span class={`input-qty ${state}`}>
                    {fromInventory.toFixed(0)} / {total.toFixed(0)}
                    {shortfall > 0 ? ` (short ${shortfall.toFixed(0)})` : ""}
                  </span>
                  {fromPlan > 0 && (
                    <span class="input-breakdown">
                      plus {fromPlan.toFixed(0)} {planLabel}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default memo(CraftStep);
