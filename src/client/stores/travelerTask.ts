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
import { computed, computedAsync } from "nanostores";
import { jita } from "../../common/api";
import { getItemName, getSkillName } from "../../common/gamedata";
import { buildCraftPlan } from "../../common/craft-planner";
import { $inventoryTotals } from "./craftSource";
import { $playerInfo } from "./player";

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
  4: "Brumgar",
  5: "Jasper",
  6: "Alesi",
  7: "Fern",
};

function getNpcName(travelerId: number): string {
  return TRAVELER_NAMES[travelerId] ?? `Traveler #${travelerId}`;
}

// ─── Traveler Tasks ────────────────────────────────────────────────────────────

/** All traveler tasks for the selected player */
export const $travelerTasks = computedAsync($playerInfo, async (playerInfo) => {
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
      name: getItemName(ri.item_type === "cargo" ? "Cargo" : "Item", ri.item_id),
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
});

/** Traveler tasks expiration timestamp (seconds since epoch) */
export const $travelerTasksExpiration = computedAsync(
  $playerInfo,
  async (playerInfo): Promise<number | null> => {
    if (!playerInfo) return null;
    const data = await jita.getPlayerTravelerTasks(playerInfo.entityId);
    return data.expirationTimestamp ?? null;
  },
);

/** Targets derived from open traveler tasks — used to compute the craft plan */
export const $travelerTargets = computedAsync(
  $travelerTasks,
  async (
    tasks,
  ): Promise<
    {
      item_id: number;
      item_type: "Item" | "Cargo";
      name: string;
      quantity: number;
    }[]
  > => {
    if (!tasks || tasks.length === 0) return [];

    // Merge all required items across all open tasks
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
    return buildCraftPlan(targets, inventory);
  },
);
