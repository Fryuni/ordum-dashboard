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
import { persistentAtom } from "@nanostores/persistent";
import { computedAsync } from "nanostores";
import { jita } from "../../common/api";
import { $updateTimer } from "../util-store";

// Player name — always visible regardless of source
export const $player = persistentAtom<string>("playerName", "");

export const $playerInfo = computedAsync($player, async (player) => {
  if (!player) return null;

  const page = await jita.listPlayers({ q: player });
  return page.players.find((p) => p.username === player) ?? null;
});

export const $playerData = computedAsync(
  [$playerInfo, $updateTimer],
  (info) => info && jita.getPlayer(info.entityId).then((r) => r.player),
);
