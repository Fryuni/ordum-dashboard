import { persistentAtom } from "@nanostores/persistent";
import { computedAsync } from "nanostores";
import { resubaka } from "../../common/api";
import { $updateTimer } from "../util-store";

// Player name — always visible regardless of source
export const $player = persistentAtom<string>("playerName", "");

export const $playerInfo = computedAsync($player, async (player) => {
  if (!player) return null;

  const page = await resubaka.listPlayers({
    search: player,
    page: 1,
    per_page: 5,
  });
  return page.players.find((p) => p.username === player) ?? null;
});

export const $playerData = computedAsync(
  [$playerInfo, $updateTimer],
  (info) => info && resubaka.findPlayerById(info.entity_id),
);
