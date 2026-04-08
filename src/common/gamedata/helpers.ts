import { itemsCodex } from "./codex";
import { referenceKey, type ItemReference } from "./definition";

export function nameWithRarity(item: ItemReference) {
  const entry = itemsCodex.get(referenceKey(item));
  if (!entry) return "Unknown item";
  return `${entry.name} (${entry.rarity})`;
}
