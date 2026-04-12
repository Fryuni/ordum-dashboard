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
import { atom, computed, effect, onMount } from "nanostores";
import { computedAsync } from "@nanostores/async";
import { jita } from "../../common/api";
import { getItemName, getSkillName } from "../../common/gamedata";
import { buildCraftPlanAsync } from "../workers/craftPlannerClient";
import { $inventoryTotals } from "./craftSource";
import { $playerInfo } from "./player";
import { $updateTimer } from "../util-store";

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface TravelerTaskInfo {
  travelerId: number;
  travelerName: string;
  taskId: number;
  description: string;
  skillName: string;
  completed: boolean;
  requiredItems: {
    item_id: number;
    item_type: "Item" | "Cargo";
    name: string;
    quantity: number;
  }[];
}

// ─── NPC Names ─────────────────────────────────────────────────────────────────

/** Known traveler NPCs — fixed game characters */
const TRAVELER_NAMES: Record<number, string> = {
  1: "Rumbagh",
  2: "Svim",
  3: "Heimlich",
  5: "Brico",
  6: "Alesi",
  7: "Ramparte",
};

function getNpcName(travelerId: number): string {
  return TRAVELER_NAMES[travelerId] ?? `Traveler #${travelerId}`;
}

// ─── Traveler Tasks ────────────────────────────────────────────────────────────

/** All traveler tasks for the selected player (refreshes with update timer) */
export const $travelerTasks = computedAsync(
  [$playerInfo, $updateTimer],
  async (playerInfo) => {
    if (!playerInfo) return [];

    const data = await jita.getPlayerTravelerTasks(playerInfo.entityId);

    const tasks: TravelerTaskInfo[] = [];
    for (const task of data.tasks) {
      if (task.completed) continue; // skip completed tasks

      const requiredItems = (task.requiredItems ?? []).map((ri) => ({
        item_id: ri.item_id,
        item_type: (ri.item_type === "cargo" ? "Cargo" : "Item") as
          | "Item"
          | "Cargo",
        name: getItemName(
          ri.item_type === "cargo" ? "Cargo" : "Item",
          ri.item_id,
        ),
        quantity: ri.quantity,
      }));

      tasks.push({
        travelerId: task.travelerId,
        travelerName: getNpcName(task.travelerId),
        taskId: task.taskId,
        description: task.description ?? "",
        skillName: getSkillName(task.rewardedExperience?.skill_id ?? 0),
        completed: false,
        requiredItems,
      });
    }

    return tasks;
  },
);

/** Traveler tasks expiration timestamp (seconds since epoch) */
export const $travelerTasksExpiration = computedAsync(
  [$playerInfo, $updateTimer],
  async (playerInfo): Promise<number | null> => {
    if (!playerInfo) return null;
    const data = await jita.getPlayerTravelerTasks(playerInfo.entityId);
    return data.expirationTimestamp ?? null;
  },
);

// ─── Traveler Selection ────────────────────────────────────────────────────────

/** Set of selected traveler IDs — only these are included in the craft plan */
export const $selectedTravelers = atom<Set<number>>(new Set());

/** Auto-select all travelers when the task list changes */
onMount($selectedTravelers, () => {
  let lastAvailable = new Set<number>();
  return $travelerTasks.subscribe((tasks) => {
    if (tasks.state !== "ready" || !tasks.value) return;
    const ids = new Set(tasks.value.map((t) => t.travelerId));
    // Only auto-set if the available traveler set changed (new load / player switch)
    if (
      ids.size !== lastAvailable.size ||
      [...ids].some((id) => !lastAvailable.has(id))
    ) {
      lastAvailable = ids;
      $selectedTravelers.set(ids);
    }
  });
});

export function toggleTraveler(travelerId: number) {
  const current = $selectedTravelers.get();
  const next = new Set(current);
  if (next.has(travelerId)) {
    next.delete(travelerId);
  } else {
    next.add(travelerId);
  }
  $selectedTravelers.set(next);
}

export function soloTraveler(travelerId: number) {
  $selectedTravelers.set(new Set([travelerId]));
}

// ─── Filtered Targets ──────────────────────────────────────────────────────────

/** Targets derived from open traveler tasks — filtered by selected travelers */
export const $travelerTargets = computedAsync(
  [$travelerTasks, $selectedTravelers],
  async (
    tasks,
    selected,
  ): Promise<
    {
      item_id: number;
      item_type: "Item" | "Cargo";
      name: string;
      quantity: number;
    }[]
  > => {
    if (!tasks || tasks.length === 0) return [];

    // Merge required items only from selected travelers
    const merged = new Map<
      string,
      {
        item_id: number;
        item_type: "Item" | "Cargo";
        name: string;
        quantity: number;
      }
    >();

    for (const task of tasks) {
      if (!selected.has(task.travelerId)) continue;
      for (const ri of task.requiredItems) {
        const key = `${ri.item_type}:${ri.item_id}`;
        const existing = merged.get(key);
        if (existing) {
          existing.quantity += ri.quantity;
        } else {
          merged.set(key, { ...ri });
        }
      }
    }

    return Array.from(merged.values());
  },
);

/** Craft plan for all traveler task items */
export const $travelerCraftPlan = computedAsync(
  [$travelerTargets, $inventoryTotals],
  (targets, inventory) => {
    if (!targets || targets.length === 0) return null;
    return buildCraftPlanAsync(targets, inventory);
  },
);
