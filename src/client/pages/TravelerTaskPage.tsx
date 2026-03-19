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
import { useState, useEffect, useRef } from "preact/hooks";
import InventorySourcePicker from "../components/craft/InventorySourcePicker";
import PlanCard from "../components/craft/PlanCard";
import {
  $travelerTasks,
  $travelerTargets,
  $travelerCraftPlan,
  $travelerTasksExpiration,
  $selectedTravelers,
  toggleTraveler,
  soloTraveler,
  type TravelerTaskInfo,
} from "../stores/travelerTask";
import { $player } from "../stores/player";

interface TaskListProps {
  tasks: TravelerTaskInfo[];
  selected: Set<number>;
}

function TaskList({ tasks, selected }: TaskListProps) {
  // Group by traveler
  const byTraveler = new Map<
    number,
    { name: string; tasks: TravelerTaskInfo[] }
  >();
  for (const t of tasks) {
    const group = byTraveler.get(t.travelerId);
    if (group) {
      group.tasks.push(t);
    } else {
      byTraveler.set(t.travelerId, { name: t.travelerName, tasks: [t] });
    }
  }

  return (
    <div class="traveler-task-list">
      {Array.from(byTraveler.entries()).map(([id, { name, tasks: group }]) => {
        const checked = selected.has(id);
        return (
          <div
            key={id}
            class={`traveler-group${checked ? "" : " traveler-group--excluded"}`}
          >
            <h4 class="traveler-name">
              <label class="traveler-checkbox-label">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggleTraveler(id)}
                />
                <span>🧳 {name}</span>
              </label>
              <button
                type="button"
                class="solo-traveler-btn"
                title={`Show only ${name}`}
                onClick={() => soloTraveler(id)}
              >
                ◎
              </button>
            </h4>
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
        );
      })}
    </div>
  );
}

function ResetCountdown() {
  const expiration = useStore($travelerTasksExpiration);
  const [remaining, setRemaining] = useState("");
  const intervalRef = useRef<ReturnType<typeof setInterval>>(null);

  const expirationSecs =
    expiration.state === "loaded" ? expiration.value : null;

  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);

    if (!expirationSecs) {
      setRemaining("");
      return;
    }

    function update() {
      const now = Math.floor(Date.now() / 1000);
      const diff = expirationSecs! - now;
      if (diff <= 0) {
        setRemaining("Tasks have reset!");
        return;
      }
      const h = Math.floor(diff / 3600);
      const m = Math.floor((diff % 3600) / 60);
      const s = diff % 60;
      setRemaining(
        `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`,
      );
    }

    update();
    intervalRef.current = setInterval(update, 1000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [expirationSecs]);

  if (!remaining) return null;

  return (
    <div class="reset-countdown">
      <span class="countdown-label">⏳ Resets in</span>
      <span class="countdown-value">{remaining}</span>
    </div>
  );
}

function CollapsibleTaskList({
  tasks,
  selected,
}: {
  tasks: TravelerTaskInfo[];
  selected: Set<number>;
}) {
  const [open, setOpen] = useState(false);

  // Count unique travelers and how many are selected
  const travelerIds = new Set(tasks.map((t) => t.travelerId));
  const selectedCount = [...travelerIds].filter((id) =>
    selected.has(id),
  ).length;
  const allSelected = selectedCount === travelerIds.size;

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
          {!allSelected &&
            ` (${selectedCount}/${travelerIds.size} travelers selected)`}
        </span>
      </button>
      {open && <TaskList tasks={tasks} selected={selected} />}
    </div>
  );
}

export default function TravelerTaskPage() {
  const player = useStore($player);
  const travelerTasks = useStore($travelerTasks);
  const travelerTargets = useStore($travelerTargets);
  const craftPlan = useStore($travelerCraftPlan);
  const selectedTravelers = useStore($selectedTravelers);

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
        <div class="traveler-config-row">
          <InventorySourcePicker />
          <ResetCountdown />
        </div>
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

      {tasks.length > 0 && (
        <CollapsibleTaskList tasks={tasks} selected={selectedTravelers} />
      )}

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
