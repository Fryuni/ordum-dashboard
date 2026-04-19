/**
 * Copyright (C) 2026 Luiz Ferraz
 *
 * This file is part of Ordum Dashboard.
 *
 * Ordum Dashboard is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */
import { useStore } from "@nanostores/preact";
import { persistentAtom } from "@nanostores/persistent";
import { useEffect, useState } from "preact/hooks";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { $targets } from "../../stores/craft";
import {
  $planSearchQuery,
  getCurrentPlanPayload,
  loadPlanAction,
  type PresetPlan,
  type SavedPlan,
} from "../../stores/savedPlans";
import { $playerInfo } from "../../stores/player";

const LIST_PAGE_SIZE = 100;

const $savedPlansCollapsed = persistentAtom<boolean>(
  "ui:savedPlansCollapsed",
  false,
  {
    encode: (v) => (v ? "1" : "0"),
    decode: (v) => v === "1",
  },
);

function formatUpdatedAt(ms: number): string {
  const d = new Date(ms);
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function SavedPlansPanel() {
  const playerInfo = useStore($playerInfo);
  const targets = useStore($targets);
  const search = useStore($planSearchQuery);
  const collapsed = useStore($savedPlansCollapsed);
  const myPlans = useQuery(api.craftPlans.listMine, {
    search: search.trim() || undefined,
  });
  const presets = useQuery(api.craftPlans.listPresets, {});

  const [nameInput, setNameInput] = useState("");
  const [flash, setFlash] = useState<{
    kind: "ok" | "error";
    text: string;
  } | null>(null);
  const [searchInput, setSearchInput] = useState(search);

  const savePlan = useMutation(api.craftPlans.savePlan);
  const deletePlan = useMutation(api.craftPlans.deletePlan);

  // Debounce the search input (150 ms) to avoid resubscribing on every keystroke.
  useEffect(() => {
    if (searchInput === $planSearchQuery.get()) return;
    const t = setTimeout(() => $planSearchQuery.set(searchInput), 150);
    return () => clearTimeout(t);
  }, [searchInput]);

  const canSave = targets.length > 0 && nameInput.trim().length > 0;

  async function handleSave() {
    const name = nameInput.trim();
    if (!name || targets.length === 0) return;
    try {
      const payload = getCurrentPlanPayload();
      await savePlan({ name, ...payload });
      setNameInput("");
      setFlash({ kind: "ok", text: `Saved "${name}"` });
    } catch (err) {
      setFlash({
        kind: "error",
        text: err instanceof Error ? err.message : String(err),
      });
    }
    setTimeout(() => setFlash(null), 3000);
  }

  async function handleDelete(plan: SavedPlan) {
    if (!confirm(`Delete plan "${plan.name}"?`)) return;
    try {
      await deletePlan({ planId: plan._id });
    } catch (err) {
      setFlash({
        kind: "error",
        text: err instanceof Error ? err.message : String(err),
      });
      setTimeout(() => setFlash(null), 3000);
    }
  }

  function handleLoad(plan: SavedPlan | PresetPlan) {
    loadPlanAction(plan);
  }

  const isLoadingPlans = myPlans === undefined;
  const plans: SavedPlan[] = myPlans ?? [];
  const presetList: PresetPlan[] = presets ?? [];

  if (collapsed) {
    return (
      <aside class="saved-plans-panel collapsed">
        <button
          type="button"
          class="saved-plans-toggle"
          onClick={() => $savedPlansCollapsed.set(false)}
          aria-label="Expand saved plans"
          title="Expand saved plans"
        >
          «
        </button>
        <div class="saved-plans-collapsed-label">Saved Plans</div>
      </aside>
    );
  }

  return (
    <aside class="saved-plans-panel">
      <div class="saved-plans-header">
        <h3 class="saved-plans-heading">Saved Plans</h3>
        <button
          type="button"
          class="saved-plans-toggle"
          onClick={() => $savedPlansCollapsed.set(true)}
          aria-label="Collapse saved plans"
          title="Collapse saved plans"
        >
          »
        </button>
      </div>

      <div class="saved-plans-save">
        <input
          type="text"
          class="saved-plans-input"
          placeholder="Plan name…"
          value={nameInput}
          onInput={(e) => setNameInput((e.target as HTMLInputElement).value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && canSave) handleSave();
          }}
        />
        <button
          type="button"
          class="btn btn-primary"
          onClick={handleSave}
          disabled={!canSave}
          title={
            targets.length === 0
              ? "Add at least one target to save"
              : !nameInput.trim()
                ? "Enter a name to save"
                : "Save current plan"
          }
        >
          Save
        </button>
      </div>

      {flash && (
        <div
          class={
            flash.kind === "ok"
              ? "saved-plans-flash ok"
              : "saved-plans-flash error"
          }
        >
          {flash.text}
        </div>
      )}

      <div class="saved-plans-search">
        <input
          type="text"
          class="saved-plans-input"
          placeholder="Search my plans…"
          value={searchInput}
          onInput={(e) => setSearchInput((e.target as HTMLInputElement).value)}
        />
      </div>

      <div class="saved-plans-section">
        <h4 class="saved-plans-subheading">My Plans</h4>
        {isLoadingPlans && <p class="saved-plans-empty">Loading…</p>}
        {!isLoadingPlans && plans.length === 0 && (
          <p class="saved-plans-empty">
            {search.trim()
              ? "No plans match your search."
              : "No saved plans yet."}
          </p>
        )}
        {plans.length > 0 && (
          <ul class="saved-plans-list">
            {plans.map((plan) => (
              <li key={plan._id} class="saved-plans-row">
                <div class="saved-plans-row-main">
                  <span class="saved-plans-row-name">{plan.name}</span>
                  <span class="saved-plans-row-time">
                    {formatUpdatedAt(plan.updatedAt)}
                  </span>
                </div>
                <div class="saved-plans-row-actions">
                  <button
                    type="button"
                    class="btn btn-secondary btn-small"
                    onClick={() => handleLoad(plan)}
                  >
                    Load
                  </button>
                  <button
                    type="button"
                    class="btn btn-danger btn-small"
                    onClick={() => handleDelete(plan)}
                  >
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
        {plans.length === LIST_PAGE_SIZE && (
          <p class="saved-plans-hint">
            Showing first {LIST_PAGE_SIZE} — refine your search to see more.
          </p>
        )}
      </div>

      {presetList.length > 0 && (
        <div class="saved-plans-section">
          <h4 class="saved-plans-subheading">Presets</h4>
          <ul class="saved-plans-list">
            {presetList.map((preset, i) => (
              <li key={`${preset.name}-${i}`} class="saved-plans-row">
                <div class="saved-plans-row-main">
                  <span class="saved-plans-row-name">{preset.name}</span>
                </div>
                <div class="saved-plans-row-actions">
                  <button
                    type="button"
                    class="btn btn-secondary btn-small"
                    onClick={() => handleLoad(preset)}
                  >
                    Load
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </aside>
  );
}
