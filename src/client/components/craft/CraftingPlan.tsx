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
import { useStore } from "@nanostores/preact";
import { $craftPlan, $targets } from "../../stores/craft";
import {
  $virtualInventory,
  clearVirtualInventory,
} from "../../stores/craftSource";
import PlanCard from "./PlanCard";

export default function CraftingPlan() {
  const craftPlan = useStore($craftPlan);
  const targets = useStore($targets);
  const virtualInventory = useStore($virtualInventory);

  const hasTargets = targets.length > 0;
  const isLoading = craftPlan.state === "loading";
  const hasPlan = craftPlan.state === "ready" && craftPlan.value;
  const ignoredCount = virtualInventory.size;

  return (
    <>
      {ignoredCount > 0 && (
        <div class="info-banner">
          <span class="info-banner-icon">ℹ️</span>
          <span class="info-banner-text">
            Ignoring {ignoredCount} item{ignoredCount === 1 ? "" : "s"} from
            your inventory.
          </span>
          <button
            type="button"
            class="info-banner-action"
            onClick={clearVirtualInventory}
          >
            Reset
          </button>
        </div>
      )}

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
            <div class="results">
              <PlanCard plan={results} />
            </div>
          );
        })()}
    </>
  );
}
