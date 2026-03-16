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
