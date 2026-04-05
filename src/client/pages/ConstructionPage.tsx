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
import { useState, useEffect, useMemo } from "preact/hooks";
import { useStore } from "@nanostores/preact";
import type { TargetItem } from "../stores/craft";
import {
  $empireClaims,
  $empireClaimsLoading,
  $empireCapitalClaimId,
  fetchEmpireClaims,
} from "../stores/craftSource";
import { $router } from "../stores/router";
import { convexAction } from "../convex";
import { api } from "../../../convex/_generated/api";
import { gd } from "../../common/gamedata";

async function openCraftPlanner(targets: TargetItem[]) {
  const compressedBuffer = await new Response(
    new Blob([JSON.stringify(targets)])
      .stream()
      .pipeThrough(new CompressionStream("gzip")),
  ).arrayBuffer();

  const encoded = new Uint8Array(compressedBuffer).toBase64({
    alphabet: "base64url",
    omitPadding: true,
  });

  $router.open(`/craft?targets=${encoded}`);
}

interface MaterialRequirement {
  item_type: "Item" | "Cargo";
  item_id: number;
  name: string;
  icon: string;
  tier: number;
  tag: string;
  quantity_required: number;
  quantity_deposited: number;
  fulfilled: boolean;
}

interface ConstructionProject {
  entity_id: string;
  building_name: string;
  construction_recipe_id: number;
  recipe_name: string;
  requirements: MaterialRequirement[];
  total_required: number;
  total_deposited: number;
  progress_pct: number;
}

interface ConstructionData {
  projects: ConstructionProject[];
}

export default function ConstructionPage() {
  const [data, setData] = useState<ConstructionData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedClaim, setSelectedClaim] = useState("");
  const claims = useStore($empireClaims);
  const claimsLoading = useStore($empireClaimsLoading);
  const capitalClaimId = useStore($empireCapitalClaimId);

  useEffect(() => {
    fetchEmpireClaims();
  }, []);

  // Default to capital claim once loaded
  useEffect(() => {
    if (!selectedClaim && capitalClaimId) setSelectedClaim(capitalClaimId);
  }, [capitalClaimId]);

  useEffect(() => {
    if (!selectedClaim) return;
    setData(null);
    setError(null);
    convexAction(api.construction.getConstruction, { claimId: selectedClaim })
      .then((raw: any) => {
        // Build item/cargo lookup dicts
        const itemsDict: Record<string, any> = {};
        for (const item of raw.constructionItems ?? []) {
          if (!itemsDict[String(item.id)]) itemsDict[String(item.id)] = item;
        }
        const cargosDict: Record<string, any> = {};
        for (const cargo of raw.constructionCargos ?? []) {
          if (!cargosDict[String(cargo.id)]) cargosDict[String(cargo.id)] = cargo;
        }

        // Build construction recipe index
        const recipeIndex = new Map<number, (typeof gd.constructionRecipes)[0]>();
        for (const r of gd.constructionRecipes) {
          recipeIndex.set(r.id, r);
        }

        const projects = (raw.projects ?? []).map((project: any) => {
          const recipe = recipeIndex.get(project.constructionRecipeId);
          const depositedItems: Record<string, number> = {};
          for (const pocket of project.inventory ?? []) {
            if (!pocket.contents) continue;
            const itemType = pocket.contents.item_type === "cargo" ? "Cargo" : "Item";
            const key = `${itemType}:${pocket.contents.item_id}`;
            depositedItems[key] = (depositedItems[key] ?? 0) + (pocket.contents.quantity ?? 0);
          }

          const requirements = [
            ...(recipe?.consumed_item_stacks ?? []).map((s) => {
              const key = `Item:${s.item_id}`;
              const info = itemsDict[String(s.item_id)];
              const deposited = depositedItems[key] ?? 0;
              return {
                item_type: "Item" as const,
                item_id: s.item_id,
                name: info?.name ?? gd.items.get(s.item_id)?.name ?? `Item #${s.item_id}`,
                icon: info?.iconAssetName ?? "",
                tier: info?.tier ?? gd.items.get(s.item_id)?.tier ?? 0,
                tag: info?.tag ?? gd.items.get(s.item_id)?.tag ?? "",
                quantity_required: s.quantity,
                quantity_deposited: deposited,
                fulfilled: deposited >= s.quantity,
              };
            }),
            ...(recipe?.consumed_cargo_stacks ?? []).map((s) => {
              const key = `Cargo:${s.item_id}`;
              const info = cargosDict[String(s.item_id)];
              const deposited = depositedItems[key] ?? 0;
              return {
                item_type: "Cargo" as const,
                item_id: s.item_id,
                name: info?.name ?? gd.cargo.get(s.item_id)?.name ?? `Cargo #${s.item_id}`,
                icon: info?.iconAssetName ?? "",
                tier: info?.tier ?? gd.cargo.get(s.item_id)?.tier ?? 0,
                tag: info?.tag ?? gd.cargo.get(s.item_id)?.tag ?? "",
                quantity_required: s.quantity,
                quantity_deposited: deposited,
                fulfilled: deposited >= s.quantity,
              };
            }),
          ];

          const totalRequired = requirements.reduce((s, r) => s + r.quantity_required, 0);
          const totalDeposited = requirements.reduce(
            (s, r) => s + Math.min(r.quantity_deposited, r.quantity_required),
            0,
          );

          return {
            entity_id: project.entityId ?? project.entity_id ?? "",
            building_name:
              project.buildingNickname ??
              project.buildingName ??
              recipe?.name ??
              "Unknown Building",
            construction_recipe_id: project.constructionRecipeId,
            recipe_name: recipe?.name ?? "Unknown Recipe",
            requirements,
            total_required: totalRequired,
            total_deposited: totalDeposited,
            progress_pct:
              totalRequired > 0
                ? Math.round((totalDeposited / totalRequired) * 100)
                : 0,
          };
        });

        setData({ projects });
      })
      .catch((e) => setError(String(e)));
  }, [selectedClaim]);

  function handleClaimChange(e: Event) {
    setSelectedClaim((e.target as HTMLSelectElement).value);
  }

  if (error) {
    return (
      <div class="error-banner">
        <span class="error-icon">⚠</span>
        <span>{error}</span>
      </div>
    );
  }

  return (
    <>
      <div class="page-header">
        <h1>🏗️ Construction Tracker</h1>
        <p class="subtitle">
          Track buildings under construction and what materials are still needed
        </p>
      </div>

      <div class="planner-card">
        <div class="form-row">
          <div class="input-group source-select-container">
            <label for="construction-claim">Claim</label>
            <select
              id="construction-claim"
              class="source-select"
              value={selectedClaim}
              onChange={handleClaimChange}
            >
              {claimsLoading && claims.length === 0 && (
                <option disabled>Loading claims…</option>
              )}
              {claims.map((claim) => (
                <option key={claim.id} value={claim.id}>
                  🏰 {claim.name}
                </option>
              ))}
              {!selectedClaim && (
                <option value="" disabled>
                  Loading claims…
                </option>
              )}
            </select>
          </div>
        </div>
      </div>

      {!data ? (
        <div class="loading-container">
          <div class="spinner-wrap">
            <div class="spinner" />
            <span class="loading-text">Loading construction data…</span>
          </div>
        </div>
      ) : data.projects.length === 0 ? (
        <div class="empty-state">
          <span class="empty-icon">🏗️</span>
          <p>No buildings are currently under construction in this claim.</p>
        </div>
      ) : (
        <>
          <div class="kpi-row">
            <div class="kpi-card">
              <div class="kpi-label">Active Projects</div>
              <div class="kpi-value text-accent">{data.projects.length}</div>
            </div>
            <div class="kpi-card">
              <div class="kpi-label">Fully Supplied</div>
              <div class="kpi-value">
                <span class="text-green">
                  {data.projects.filter((p) => p.progress_pct === 100).length}
                </span>
                <span class="kpi-muted"> / {data.projects.length}</span>
              </div>
            </div>
            <div class="kpi-card">
              <div class="kpi-label">Avg. Progress</div>
              <div class="kpi-value">
                {Math.round(
                  data.projects.reduce((s, p) => s + p.progress_pct, 0) /
                    data.projects.length,
                )}
                %
              </div>
            </div>
          </div>

          <div class="plans-container">
            {data.projects.map((project) => (
              <ProjectCard key={project.entity_id} project={project} />
            ))}
          </div>
        </>
      )}
    </>
  );
}

function ProjectCard({ project }: { project: ConstructionProject }) {
  const missingItems = project.requirements.filter((r) => !r.fulfilled);
  const fulfilledItems = project.requirements.filter((r) => r.fulfilled);
  const progressDeg = `${(project.progress_pct / 100) * 360}deg`;
  const isDone = project.progress_pct === 100;

  const missingTargets: TargetItem[] = useMemo(
    () =>
      missingItems.map((r) => ({
        item_id: r.item_id,
        item_type: r.item_type,
        name: r.name,
        quantity: r.quantity_required - r.quantity_deposited,
      })),
    [missingItems],
  );

  return (
    <div class={`tier-plan ${isDone ? "tier-completed" : "tier-active"}`}>
      <div class="tier-header">
        <div class="tier-header-left">
          <div
            class={`circular-progress ${isDone ? "progress-done" : ""}`}
            style={{ "--p": progressDeg } as any}
          >
            <span>{project.progress_pct}%</span>
          </div>
          <div>
            <h3 class="tier-title">
              {project.building_name}
              {missingTargets.length > 0 && (
                <button
                  type="button"
                  class="btn btn-small btn-secondary"
                  style={{ marginLeft: "8px", fontSize: "0.75rem" }}
                  onClick={() => openCraftPlanner(missingTargets)}
                  title="Plan all missing materials in Craft Planner"
                >
                  ⚒️ Plan All
                </button>
              )}
            </h3>
            {project.recipe_name !== project.building_name && (
              <p class="tier-subtitle text-muted">{project.recipe_name}</p>
            )}
          </div>
        </div>
        {isDone && <span class="badge-done">✓ Fully Supplied</span>}
      </div>

      {missingItems.length > 0 && (
        <div
          class="summary-section"
          style={{ marginTop: 0, paddingTop: 0, borderTop: "none" }}
        >
          <h4
            style={{
              fontSize: "0.9rem",
              marginBottom: "12px",
              color: "var(--red)",
            }}
          >
            Still Needed ({missingItems.length} material
            {missingItems.length !== 1 ? "s" : ""})
          </h4>
          <div class="req-grid">
            {missingItems.map((req) => (
              <RequirementRow
                key={`${req.item_type}:${req.item_id}`}
                req={req}
              />
            ))}
          </div>
        </div>
      )}

      {fulfilledItems.length > 0 && (
        <details class="loc-details" style={{ marginTop: "12px" }}>
          <summary>
            {fulfilledItems.length} material
            {fulfilledItems.length !== 1 ? "s" : ""} fully deposited
          </summary>
          <div class="req-grid" style={{ marginTop: "8px" }}>
            {fulfilledItems.map((req) => (
              <RequirementRow
                key={`${req.item_type}:${req.item_id}`}
                req={req}
              />
            ))}
          </div>
        </details>
      )}
    </div>
  );
}

function RequirementRow({ req }: { req: MaterialRequirement }) {
  const pct = Math.min(
    100,
    req.quantity_required > 0
      ? (req.quantity_deposited / req.quantity_required) * 100
      : 100,
  );
  const deficit = Math.max(0, req.quantity_required - req.quantity_deposited);

  return (
    <div class={`req-card ${req.fulfilled ? "req-fulfilled" : "req-missing"}`}>
      <div class="req-top">
        <div class="req-name-area">
          {req.tier > 0 && (
            <span class={`tier-badge tier-${req.tier}`}>T{req.tier}</span>
          )}
          <span class="req-name">{req.name}</span>
          {req.tag && <span class="tag-pill">{req.tag}</span>}
          {deficit > 0 && (
            <button
              type="button"
              class="btn btn-small btn-secondary"
              style={{
                marginLeft: "4px",
                fontSize: "0.7rem",
                padding: "1px 6px",
              }}
              onClick={() =>
                openCraftPlanner([
                  {
                    item_id: req.item_id,
                    item_type: req.item_type,
                    name: req.name,
                    quantity: deficit,
                  },
                ])
              }
              title={`Plan ${req.name} in Craft Planner`}
            >
              ⚒️
            </button>
          )}
        </div>
        <span class="req-fraction">
          {req.quantity_deposited.toLocaleString()} /{" "}
          {req.quantity_required.toLocaleString()}
          {deficit > 0 && (
            <span
              class="text-red"
              style={{ marginLeft: "8px", fontSize: "0.8rem" }}
            >
              (-{deficit.toLocaleString()})
            </span>
          )}
        </span>
      </div>
      <div class="progress-bar-bg">
        <div class="progress-bar-fill" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
