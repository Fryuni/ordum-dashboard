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

/**
 * Player Capabilities Store
 *
 * Derives the player's skill levels and max tool tiers from
 * the BitJita player data and inventory, for use by the craft planner.
 */

import { computedAsync } from "@nanostores/async";
import { $playerData } from "./player";
import { $equippedItems } from "./craftSource";
import { jita } from "../../common/api";
import { toolItemsCodex } from "../../common/gamedata/codex";
import type { PlayerCapabilities } from "../../common/player-capabilities";

// ─── Experience Level Table ─────────────────────────────────────────────────────

/** Cached XP thresholds: sorted array of { level, xp } */
let xpThresholds: { level: number; xp: number }[] | undefined;

async function getXpThresholds(): Promise<
  { level: number; xp: number }[] | undefined
> {
  if (xpThresholds !== undefined) return xpThresholds;
  try {
    const data = await jita.getExperienceLevelsJson();
    // The API returns an array of { level, xp }
    const arr = Array.isArray(data) ? data : [data];
    xpThresholds = arr.sort((a, b) => a.level - b.level);
    return xpThresholds;
  } catch {
    // Don't cache failures so we retry next time
    return undefined;
  }
}

function xpToLevel(
  xp: number,
  thresholds: { level: number; xp: number }[],
): number {
  let level = 0;
  for (const t of thresholds) {
    if (xp >= t.xp) level = t.level;
    else break;
  }
  return level;
}

// ─── Player Capabilities (async computed) ───────────────────────────────────────

export const $playerCapabilities = computedAsync(
  [$playerData, $equippedItems],
  async (playerData, equipped): Promise<PlayerCapabilities | undefined> => {
    if (!playerData) return undefined;

    // Build skill levels
    const skills = new Map<string, number>();
    const thresholds = await getXpThresholds();
    const hasSkillData =
      !!thresholds &&
      thresholds.length > 0 &&
      !!playerData.experience?.length &&
      !!playerData.skillMap;

    if (hasSkillData) {
      for (const exp of playerData.experience) {
        const skillDesc = playerData.skillMap[String(exp.skill_id)];
        if (skillDesc) {
          const level = xpToLevel(exp.quantity, thresholds);
          skills.set(skillDesc.name, level);
        }
      }
    }

    // Build max tool tiers from equipped items (toolbelt + armor)
    const hasToolData = toolItemsCodex.size > 0;
    const maxToolTiers = new Map<string, number>();
    if (hasToolData && equipped instanceof Map) {
      for (const [key] of equipped) {
        // key format is "Item:123" or "Cargo:123"
        const [itemType, idStr] = key.split(":", 2);
        if (itemType !== "Item") continue;
        const itemId = parseInt(idStr!, 10);
        const toolInfo = toolItemsCodex.get(itemId);
        if (toolInfo) {
          const current = maxToolTiers.get(toolInfo.toolType) ?? 0;
          if (toolInfo.tier > current) {
            maxToolTiers.set(toolInfo.toolType, toolInfo.tier);
          }
        }
      }
    }

    return { skills, maxToolTiers, hasSkillData, hasToolData };
  },
);
