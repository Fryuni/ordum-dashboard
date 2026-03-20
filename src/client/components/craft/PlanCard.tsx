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
import { useState, useMemo } from "preact/hooks";
import { useStore } from "@nanostores/preact";
import RawMaterials from "./RawMaterials";
import CraftingSteps from "./CraftingSteps";
import type { CraftPlan } from "../../../common/craft-planner";
import { $inventory } from "../../stores/craftSource";
import { $playerCapabilities } from "../../stores/playerCapabilities";
import { referenceKey } from "../../../common/gamedata/definition";

interface Props {
  plan: CraftPlan;
  allDoneMessage?: string;
}

export default function PlanCard({
  plan,
  allDoneMessage = "✅ You already have everything needed!",
}: Props) {
  const inventory = useStore($inventory);
  const capabilitiesAsync = useStore($playerCapabilities);
  const capabilities =
    capabilitiesAsync.state === "ready" ? capabilitiesAsync.value : undefined;
  const [nameFilter, setNameFilter] = useState("");
  const [tierFilter, setTierFilter] = useState("");

  const hasFilters = nameFilter.trim().length > 0 || tierFilter !== "";

  // Collect all unique tiers from raw materials + step outputs
  const availableTiers = useMemo(() => {
    const tiers = new Set<number>();
    for (const r of plan.raw_materials ?? []) tiers.add(r.tier);
    for (const s of plan.steps ?? []) {
      for (const o of s.outputs) {
        // outputs don't have tier, but inputs reference items that do
      }
    }
    // Also gather from step building_tier
    for (const s of plan.steps ?? []) {
      if (s.building_tier > 0) tiers.add(s.building_tier);
    }
    // Raw materials are the primary tier source
    return [...tiers].sort((a, b) => a - b);
  }, [plan]);

  const nameQ = nameFilter.toLowerCase().trim();
  const tierQ = tierFilter !== "" ? parseInt(tierFilter) : null;

  const filteredRaw = useMemo(() => {
    if (!hasFilters) return plan.raw_materials ?? [];
    return (plan.raw_materials ?? []).filter((r) => {
      if (nameQ && !r.name.toLowerCase().includes(nameQ)) return false;
      if (tierQ !== null && r.tier !== tierQ) return false;
      return true;
    });
  }, [plan.raw_materials, nameQ, tierQ, hasFilters]);

  const filteredSteps = useMemo(() => {
    if (!hasFilters) return plan.steps ?? [];
    return (plan.steps ?? []).filter((s) => {
      const names = [
        s.recipe_name,
        ...s.inputs.map((i) => i.item.name),
        ...s.outputs.map((o) => o.item.name),
      ];
      const matchName =
        !nameQ || names.some((n) => n.toLowerCase().includes(nameQ));
      const matchTier =
        tierQ === null ||
        s.building_tier === tierQ ||
        s.outputs.some((i) => {
          return i.item.tier === tierQ;
        });
      return matchName && matchTier;
    });
  }, [plan.steps, plan.raw_materials, nameQ, tierQ, hasFilters]);

  const filteredHave = useMemo(() => {
    if (!hasFilters) return plan.already_have ?? [];
    return (plan.already_have ?? []).filter((item) => {
      if (nameQ && !item.name.toLowerCase().includes(nameQ)) return false;
      return true;
    });
  }, [plan.already_have, nameQ, hasFilters]);

  const isEmpty = !plan.steps?.length && !plan.raw_materials?.length;

  return (
    <div class="plan-card">
      {!isEmpty && (
        <div class="plan-filters">
          <div class="plan-filter-group">
            <span class="filter-icon">🔍</span>
            <input
              type="text"
              class="plan-filter-input"
              placeholder="Filter by name..."
              value={nameFilter}
              onInput={(e) =>
                setNameFilter((e.target as HTMLInputElement).value)
              }
            />
          </div>
          <div class="plan-filter-group">
            <span class="filter-icon">🏷️</span>
            <select
              class="plan-filter-select"
              value={tierFilter}
              onChange={(e) =>
                setTierFilter((e.target as HTMLSelectElement).value)
              }
            >
              <option value="">All tiers</option>
              {availableTiers.map((t) => (
                <option key={t} value={String(t)}>
                  Tier {t === -1 ? "X" : t}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      {filteredHave.length > 0 && (
        <div class="already-have">
          <h4>✅ Already Have</h4>
          <div class="have-chips">
            {filteredHave.map((item: any) => {
              const key = referenceKey(item);
              const places = inventory.get(key);
              return (
                <span class="have-chip" key={item.name}>
                  {item.name} <strong>×{item.quantity.toFixed(0)}</strong>
                  {places && places.length > 0 && (
                    <div class="have-chip-tooltip">
                      <div class="sources-header">Found in</div>
                      <ul class="sources-list">
                        {places.map((p) => (
                          <li key={p.name}>
                            <span>{p.name}</span>
                            <span class="source-qty">×{p.quantity}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </span>
              );
            })}
          </div>
        </div>
      )}

      <RawMaterials materials={filteredRaw} capabilities={capabilities} />
      <CraftingSteps steps={filteredSteps} capabilities={capabilities} />

      {isEmpty && <div class="all-done">{allDoneMessage}</div>}

      {hasFilters &&
        !filteredRaw.length &&
        !filteredSteps.length &&
        !filteredHave.length &&
        !isEmpty && (
          <div class="no-filter-results">
            No items match the current filters
          </div>
        )}
    </div>
  );
}
