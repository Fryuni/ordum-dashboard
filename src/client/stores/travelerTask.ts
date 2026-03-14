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
import { atom, computed, computedAsync } from "nanostores";
import { resubaka } from "../../common/api";
import { getItemName, getSkillName } from "../../common/gamedata";
import type { ItemReference } from "../../common/gamedata";
import { buildCraftPlan } from "../../common/craft-planner";
import { $player, $inventory } from "./craftSource";

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

// ─── Cached reference data ─────────────────────────────────────────────────────

let npcCache: Record<number, { name: string }> | null = null;
let taskDescCache: Record<
  number,
  {
    description: string;
    skill_id: number;
    required_items: { item_id: number; quantity: number; item_type: string }[];
  }
> | null = null;

async function getNpcs() {
  if (!npcCache) {
    const raw = await resubaka.getNpcAll();
    npcCache = {};
    for (const [id, npc] of Object.entries(raw)) {
      npcCache[Number(id)] = { name: (npc as any).name ?? `NPC #${id}` };
    }
  }
  return npcCache;
}

async function getTaskDescs() {
  if (!taskDescCache) {
    const raw = await resubaka.getTravelerTasks();
    taskDescCache = {};
    for (const [id, task] of Object.entries(raw)) {
      taskDescCache[Number(id)] = task as any;
    }
  }
  return taskDescCache;
}

// ─── Player lookup ─────────────────────────────────────────────────────────────

const $playerInfo = computedAsync($player, async (player) => {
  if (!player || player.trim().length < 2) return null;

  const page = await resubaka.listPlayers({
    search: player,
    page: 1,
    per_page: 5,
  });
  return page.players.find((p) => p.username === player) ?? null;
});

// ─── Traveler Tasks ────────────────────────────────────────────────────────────

/** All traveler tasks for the selected player */
export const $travelerTasks = computedAsync(
  $playerInfo,
  async (playerInfo): Promise<TravelerTaskInfo[]> => {
    if (!playerInfo) return [];

    const [playerData, npcs, taskDescs] = await Promise.all([
      resubaka.findPlayerById(playerInfo.entity_id),
      getNpcs(),
      getTaskDescs(),
    ]);

    const tasks: TravelerTaskInfo[] = [];
    const travelerTasks = playerData.traveler_tasks ?? {};

    for (const [travelerId, taskStates] of Object.entries(travelerTasks)) {
      const tid = Number(travelerId);
      const travelerName = npcs[tid]?.name ?? `Traveler #${tid}`;

      for (const state of taskStates as any[]) {
        if (state.completed) continue; // skip completed tasks

        const desc = taskDescs[state.task_id];
        if (!desc) continue;

        const requiredItems = (desc.required_items ?? []).map((ri: any) => ({
          item_id: ri.item_id,
          item_type: (ri.item_type ?? "Item") as "Item" | "Cargo",
          name: getItemName(ri.item_type ?? "Item", ri.item_id),
          quantity: ri.quantity,
        }));

        tasks.push({
          travelerId: tid,
          travelerName,
          taskId: state.task_id,
          description: desc.description ?? "",
          skillName: getSkillName(desc.skill_id),
          completed: false,
          requiredItems,
        });
      }
    }

    return tasks;
  },
);

/** Targets derived from open traveler tasks — used to compute the craft plan */
export const $travelerTargets = computedAsync(
  $travelerTasks,
  async (tasks): Promise<
    { item_id: number; item_type: "Item" | "Cargo"; name: string; quantity: number }[]
  > => {
    if (!tasks || tasks.length === 0) return [];

    // Merge all required items across all open tasks
    const merged = new Map<
      string,
      { item_id: number; item_type: "Item" | "Cargo"; name: string; quantity: number }
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
  [$travelerTargets, $inventory],
  (targets, inventory) => {
    if (!targets || targets.length === 0) return null;
    return buildCraftPlan(targets, inventory);
  },
);
