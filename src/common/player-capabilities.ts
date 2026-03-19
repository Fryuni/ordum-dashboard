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
 * Player Capabilities
 *
 * Represents what a player can do: their skill levels and
 * the maximum tier of each tool type they possess.
 * Used by the craft planner to penalize recipes the player
 * cannot currently craft.
 */

export interface PlayerCapabilities {
  /** Skill name → player's level in that skill */
  skills: ReadonlyMap<string, number>;
  /** Tool type name → maximum tier the player has */
  maxToolTiers: ReadonlyMap<string, number>;
}

export function canMeetSkillRequirements(
  capabilities: PlayerCapabilities | undefined,
  requirements: ReadonlyArray<{ skill: string; level: number }>,
): boolean {
  if (!capabilities) return true;
  return requirements.every(
    (req) => (capabilities.skills.get(req.skill) ?? 0) >= req.level,
  );
}

export function canMeetToolRequirements(
  capabilities: PlayerCapabilities | undefined,
  requirements: ReadonlyArray<{ tool: string; level: number }>,
): boolean {
  if (!capabilities) return true;
  return requirements.every(
    (req) => (capabilities.maxToolTiers.get(req.tool) ?? 0) >= req.level,
  );
}
