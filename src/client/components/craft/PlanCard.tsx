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
import { useState, useMemo, useEffect } from "preact/hooks";
import { useStore } from "@nanostores/preact";
import { useConvexAuth } from "convex/react";
import RawMaterials from "./RawMaterials";
import CraftingSteps from "./CraftingSteps";
import type { CraftPlan } from "../../../common/craft-planner";
import {
  $effectiveInventory,
  ignoreItemFromHave,
} from "../../stores/craftSource";
import { $playerCapabilities } from "../../stores/playerCapabilities";
import { referenceKey } from "../../../common/gamedata/definition";
import { nameWithRarity } from "../../../common/gamedata/helpers";

interface Props {
  plan: CraftPlan;
  allDoneMessage?: string;
}

export default function PlanCard({
  plan,
  allDoneMessage = "✅ You already have everything needed!",
}: Props) {
  const inventory = useStore($effectiveInventory);
  const { isAuthenticated } = useConvexAuth();
  const capabilitiesAsync = useStore($playerCapabilities);
  const capabilities =
    capabilitiesAsync.state === "ready" ? capabilitiesAsync.value : undefined;
  const [nameFilter, setNameFilter] = useState("");
  const [debouncedName, setDebouncedName] = useState("");
  const [tierFilter, setTierFilter] = useState("");
  const [skillFilter, setSkillFilter] = useState("");
  const [inInventoryOnly, setInInventoryOnly] = useState(false);
  const [canPerformOnly, setCanPerformOnly] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedName(nameFilter), 150);
    return () => clearTimeout(t);
  }, [nameFilter]);

  const canPerformSupported =
    !!capabilities && (capabilities.hasSkillData || capabilities.hasToolData);

  const hasFilters =
    debouncedName.trim().length > 0 ||
    tierFilter !== "" ||
    skillFilter !== "" ||
    inInventoryOnly ||
    (canPerformOnly && canPerformSupported);

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

  // Collect all unique skill names from raw materials + crafting steps
  const availableSkills = useMemo(() => {
    const skills = new Set<string>();
    for (const s of plan.steps ?? []) {
      for (const sr of s.skill_requirements ?? []) skills.add(sr.skill);
    }
    for (const r of plan.raw_materials ?? []) {
      for (const sr of r.skill_requirements ?? []) skills.add(sr.skill);
    }
    return [...skills].sort();
  }, [plan]);

  const nameQ = nameFilter.toLowerCase().trim();
  const tierQ = tierFilter !== "" ? parseInt(tierFilter) : null;
  const applyCanPerform = canPerformOnly && canPerformSupported;

  const filteredRaw = useMemo(() => {
    if (!hasFilters) return plan.raw_materials ?? [];
    // Raw materials always need gathering — by construction they can't be
    // fully satisfied by inventory, so this filter hides them entirely.
    if (inInventoryOnly) return [];
    return (plan.raw_materials ?? []).filter((r) => {
      if (nameQ && !r.name.toLowerCase().includes(nameQ)) return false;
      if (tierQ !== null && r.tier !== tierQ) return false;
      if (
        skillFilter &&
        !r.skill_requirements.some((s) => s.skill === skillFilter)
      )
        return false;
      if (applyCanPerform && (r.missing_skill || r.missing_tool)) return false;
      return true;
    });
  }, [
    plan.raw_materials,
    nameQ,
    tierQ,
    skillFilter,
    inInventoryOnly,
    applyCanPerform,
    hasFilters,
  ]);

  const filteredSteps = useMemo(() => {
    if (!hasFilters) return plan.steps ?? [];
    return (plan.steps ?? []).filter((s) => {
      const names = [
        s.recipe_name,
        ...s.inputs.map((i) => i.item.name),
        ...s.outputs.map((o) => o.item.name),
      ];
      if (nameQ && !names.some((n) => n.toLowerCase().includes(nameQ)))
        return false;
      const matchTier =
        tierQ === null ||
        s.building_tier === tierQ ||
        s.outputs.some((i) => i.item.tier === tierQ);
      if (!matchTier) return false;
      if (
        skillFilter &&
        !s.skill_requirements.some((sr) => sr.skill === skillFilter)
      )
        return false;
      if (inInventoryOnly) {
        const allFromInventory = s.inputs.every((inp) => {
          const total = inp.quantity_per_craft * s.craft_count;
          return (inp.available_from_inventory || 0) >= total;
        });
        if (!allFromInventory) return false;
      }
      if (applyCanPerform && (s.missing_skill || s.missing_tool)) return false;
      return true;
    });
  }, [
    plan.steps,
    nameQ,
    tierQ,
    skillFilter,
    inInventoryOnly,
    applyCanPerform,
    hasFilters,
  ]);

  const filteredHave = useMemo(() => {
    if (!hasFilters) return plan.already_have ?? [];
    return (plan.already_have ?? [])
      .filter((item) => {
        if (nameQ && !item.name.toLowerCase().includes(nameQ)) return false;
        return true;
      })
      .sort((a, b) => a.name.localeCompare(b.name));
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
          {availableSkills.length > 0 && (
            <div class="plan-filter-group">
              <span class="filter-icon">⚡</span>
              <select
                class="plan-filter-select"
                value={skillFilter}
                onChange={(e) =>
                  setSkillFilter((e.target as HTMLSelectElement).value)
                }
              >
                <option value="">All skills</option>
                {availableSkills.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
          )}
          <label
            class="plan-filter-toggle"
            title="Only show steps whose inputs are fully covered by your inventory"
          >
            <input
              type="checkbox"
              checked={inInventoryOnly}
              onChange={(e) =>
                setInInventoryOnly((e.target as HTMLInputElement).checked)
              }
            />
            <span>📦 In inventory</span>
          </label>
          {canPerformSupported && (
            <label
              class="plan-filter-toggle"
              title="Only show steps the selected player can perform (no skill or tool warnings)"
            >
              <input
                type="checkbox"
                checked={canPerformOnly}
                onChange={(e) =>
                  setCanPerformOnly((e.target as HTMLInputElement).checked)
                }
              />
              <span>✅ Can perform</span>
            </label>
          )}
        </div>
      )}

      {filteredHave.length > 0 && (
        <div class="already-have">
          <h4>✅ Already Have</h4>
          <div class="have-chips">
            {filteredHave.map((item) => {
              const key = referenceKey(item);
              const places = inventory.get(key);
              return (
                <span class="have-chip" key={key}>
                  {nameWithRarity(item)}{" "}
                  <strong>×{item.quantity.toFixed(0)}</strong>
                  {isAuthenticated && (
                    <button
                      type="button"
                      class="have-chip-remove"
                      title="Ignore this item in the planner"
                      onClick={(e) => {
                        e.stopPropagation();
                        ignoreItemFromHave(key);
                      }}
                    >
                      ✕
                    </button>
                  )}
                  {places && places.length > 0 && (
                    <div class="have-chip-tooltip">
                      <div class="sources-header">Found in</div>
                      <ul class="sources-list">
                        {places.map((p) => (
                          <li key={p.name}>
                            <span>{p.name}</span>
                            <span class="source-qty">
                              ×{p.quantity.toFixed(0)}
                            </span>
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
      <CraftingSteps
        steps={filteredSteps}
        capabilities={capabilities}
        inventory={inventory}
      />

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
