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
import type { TierPlan } from "../../common/settlement-planner";

interface Props {
  plan: TierPlan;
  isNextTier: boolean;
  currentTier: number;
}

export default function TierPlanCard({ plan, isNextTier, currentTier }: Props) {
  const suppliesOk = plan.supplies_available >= plan.total_supplies_needed;
  const isDone = plan.tier <= currentTier;

  let totalReq = 0;
  let totalAvail = 0;
  for (const item of plan.all_items_needed) {
    totalReq += item.total_required;
    totalAvail += Math.min(item.total_available, item.total_required);
  }
  const percentDone =
    totalReq > 0 ? Math.round((totalAvail / totalReq) * 100) : isDone ? 100 : 0;

  const cardClass = isDone
    ? "tier-completed"
    : isNextTier
      ? "tier-active"
      : "tier-future";

  return (
    <div class={`tier-plan ${cardClass}`} id={`tier-${plan.tier}`}>
      <div class="tier-header">
        <div class="tier-header-left">
          <div
            class={`circular-progress ${isDone ? "progress-done" : ""}`}
            style={{ "--p": `${isDone ? 100 : percentDone}%` } as any}
          >
            <span>{isDone ? "✓" : `T${plan.tier}`}</span>
          </div>
          <div>
            <h3 class="tier-title">
              Tier {plan.tier}
              {isDone && <span class="badge-done">Complete</span>}
            </h3>
            {!isDone && plan.total_supplies_needed > 0 && (
              <p class="tier-subtitle">
                <span
                  class={`supplies-status ${suppliesOk ? "text-green" : "text-red"}`}
                >
                  📦 {plan.total_supplies_needed.toLocaleString()} supplies
                  needed
                  {!suppliesOk &&
                    ` (need ${(plan.total_supplies_needed - plan.supplies_available).toLocaleString()} more)`}
                </span>
              </p>
            )}
          </div>
        </div>
        {isNextTier && plan.all_items_needed.some((i) => i.deficit > 0) && (
          <a
            href={`/craft?from=settlement&tier=${plan.tier}`}
            class="btn-group-craft"
          >
            ⚒️ Craft Missing Items
          </a>
        )}
      </div>

      {/* Tier Upgrade Banner */}
      {plan.tier_upgrade && !isDone && (
        <div
          class={`upgrade-banner ${plan.tier_upgrade.already_researched ? "banner-done" : "banner-pending"}`}
        >
          <div class="banner-header">
            <div class="banner-title-area">
              <div class="banner-icon">⭐</div>
              <div>
                <h4 class="banner-title">{plan.tier_upgrade.tech.name}</h4>
                <span class="banner-subtitle">Tier Upgrade</span>
              </div>
            </div>
            <div class="banner-cost">
              📦 {plan.tier_upgrade.supplies_cost.toLocaleString()}
            </div>
          </div>

          {!plan.tier_upgrade.already_researched && (
            <div class="req-grid">
              {plan.tier_upgrade.items
                .sort((a, b) => a.tier - b.tier || a.name.localeCompare(b.name))
                .map((item) => {
                  const pct = Math.min(
                    100,
                    (item.quantity_available / item.quantity_required) * 100,
                  );
                  return (
                    <div
                      key={`${item.item_type}-${item.item_id}`}
                      class={`req-card ${item.fulfilled ? "req-fulfilled" : "req-missing"}`}
                    >
                      <div class="req-top">
                        <div class="req-name-area">
                          <span class={`tier-badge tier-${item.tier}`}>
                            T{item.tier}
                          </span>
                          <span class="req-name">{item.name}</span>
                        </div>
                        <span class="req-fraction">
                          <span
                            class={
                              item.quantity_available >= item.quantity_required
                                ? "text-green"
                                : "text-red"
                            }
                          >
                            {item.quantity_available.toLocaleString()}
                          </span>
                          <span class="text-muted">
                            {" "}
                            / {item.quantity_required.toLocaleString()}
                          </span>
                        </span>
                      </div>
                      <div class="progress-bar-bg">
                        <div
                          class="progress-bar-fill"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </div>
      )}

      {/* Summary Table */}
      {!isDone && plan.all_items_needed.length > 0 && (
        <div class="summary-section">
          <h4 class="summary-title">
            📋 Items Needed to Advance to Tier {plan.tier}
          </h4>
          <div class="table-wrapper">
            <table class="modern-table">
              <thead>
                <tr>
                  <th>Item</th>
                  <th class="num">Available</th>
                  <th class="num">Required</th>
                  <th class="num">Status</th>
                </tr>
              </thead>
              <tbody>
                {plan.all_items_needed.map((item) => (
                  <tr
                    key={`${item.item_type}-${item.item_id}`}
                    class={item.deficit > 0 ? "row-deficit" : "row-ok"}
                  >
                    <td>
                      <div class="flex-align">
                        <span class={`tier-badge tier-${item.tier}`}>
                          T{item.tier}
                        </span>
                        <span class="item-name">{item.name}</span>
                      </div>
                    </td>
                    <td class="num font-mono">
                      {item.total_available.toLocaleString()}
                    </td>
                    <td class="num font-mono">
                      {item.total_required.toLocaleString()}
                    </td>
                    <td class="num font-mono">
                      {item.deficit > 0 ? (
                        <span class="text-red">
                          Need {item.deficit.toLocaleString()}
                        </span>
                      ) : (
                        <span class="text-green">✅ Done</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
