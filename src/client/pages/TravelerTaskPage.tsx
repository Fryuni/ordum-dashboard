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
import { useState } from "preact/hooks";
import InventorySourcePicker from "../components/craft/InventorySourcePicker";
import PlanCard from "../components/craft/PlanCard";
import { $player } from "../stores/craftSource";
import {
  $travelerTasks,
  $travelerTargets,
  $travelerCraftPlan,
  type TravelerTaskInfo,
} from "../stores/travelerTask";

function TaskList({ tasks }: { tasks: TravelerTaskInfo[] }) {
  // Group by traveler
  const byTraveler = new Map<string, TravelerTaskInfo[]>();
  for (const t of tasks) {
    const group = byTraveler.get(t.travelerName) ?? [];
    group.push(t);
    byTraveler.set(t.travelerName, group);
  }

  return (
    <div class="traveler-task-list">
      {Array.from(byTraveler.entries()).map(([name, group]) => (
        <div key={name} class="traveler-group">
          <h4 class="traveler-name">🧳 {name}</h4>
          <div class="traveler-tasks-grid">
            {group.map((task) => (
              <div key={task.taskId} class="traveler-task-card">
                <div class="task-description">{task.description}</div>
                <div class="task-meta">
                  <span class="task-skill">{task.skillName}</span>
                </div>
                <div class="task-items">
                  {task.requiredItems.map((ri) => (
                    <span
                      key={`${ri.item_type}:${ri.item_id}`}
                      class="task-item-badge"
                    >
                      {ri.quantity}× {ri.name}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function CollapsibleTaskList({ tasks }: { tasks: TravelerTaskInfo[] }) {
  const [open, setOpen] = useState(false);

  return (
    <div class="collapsible-section">
      <button
        type="button"
        class="collapsible-header"
        onClick={() => setOpen(!open)}
      >
        <span class="collapsible-arrow">{open ? "▾" : "▸"}</span>
        <span>
          {tasks.length} open task{tasks.length !== 1 ? "s" : ""}
        </span>
      </button>
      {open && <TaskList tasks={tasks} />}
    </div>
  );
}

export default function TravelerTaskPage() {
  const player = useStore($player);
  const travelerTasks = useStore($travelerTasks);
  const travelerTargets = useStore($travelerTargets);
  const craftPlan = useStore($travelerCraftPlan);

  const tasks =
    travelerTasks.state === "loaded" ? (travelerTasks.value ?? []) : [];
  const targets =
    travelerTargets.state === "loaded" ? (travelerTargets.value ?? []) : [];
  const hasTargets = targets.length > 0;
  const isLoadingTasks =
    travelerTasks.state === "loading" || travelerTargets.state === "loading";
  const isLoadingPlan = craftPlan.state === "loading";
  const hasPlan = craftPlan.state === "loaded" && craftPlan.value;

  return (
    <>
      <div class="header">
        <h1>🧳 Traveler's Tasks</h1>
        <p class="subtitle">
          Calculate crafting trees for your open traveler task requirements
        </p>
      </div>

      <div class="planner-card">
        <InventorySourcePicker />
      </div>

      {!player && (
        <div class="empty-state">
          <span class="empty-icon">👤</span>
          <p>Select a player to see their open traveler tasks</p>
        </div>
      )}

      {player && isLoadingTasks && (
        <div class="loading-container">
          <div class="spinner-wrap">
            <div class="spinner" />
            <span class="loading-text">Loading traveler tasks…</span>
          </div>
        </div>
      )}

      {player && !isLoadingTasks && tasks.length === 0 && (
        <div class="empty-state">
          <span class="empty-icon">✅</span>
          <p>No open traveler tasks for {player}</p>
        </div>
      )}

      {tasks.length > 0 && <CollapsibleTaskList tasks={tasks} />}

      {hasTargets && isLoadingPlan && (
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

      {hasPlan && (
        <div class="results">
          <PlanCard plan={craftPlan.value!} />
        </div>
      )}
    </>
  );
}
