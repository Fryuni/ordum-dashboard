import { useState, useMemo } from "preact/hooks";
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
        ...s.inputs.map((i) => i.name),
        ...s.outputs.map((o) => o.name),
      ];
      const matchName =
        !nameQ || names.some((n) => n.toLowerCase().includes(nameQ));
      const matchTier =
        tierQ === null ||
        s.building_tier === tierQ ||
        s.inputs.some((i) => {
          // Check item tier via raw materials as a proxy
          const raw = (plan.raw_materials ?? []).find(
            (r) => r.item_id === i.item_id && r.item_type === i.item_type,
          );
          return raw?.tier === tierQ;
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

  const isEmpty =
    !plan.steps?.length && !plan.raw_materials?.length;

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
                  Tier {t}
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
            {filteredHave.map((item: any) => (
              <span class="have-chip" key={item.name}>
                {item.name} <strong>×{item.quantity}</strong>
              </span>
            ))}
          </div>
        </div>
      )}

      <RawMaterials materials={filteredRaw} />
      <CraftingSteps steps={filteredSteps} />

      {isEmpty && <div class="all-done">{allDoneMessage}</div>}

      {hasFilters &&
        !filteredRaw.length &&
        !filteredSteps.length &&
        !filteredHave.length &&
        !isEmpty && (
          <div class="no-filter-results">No items match the current filters</div>
        )}
    </div>
  );
}
