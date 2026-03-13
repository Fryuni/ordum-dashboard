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
