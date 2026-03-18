import type { ItemEntry, CraftRecipe, ExtractionRecipe } from "./definition";
import codex from "./codex.json";

export const itemsCodex: Map<string, ItemEntry> = new Map((codex as any).items);
export const recipesCodex: Map<number, CraftRecipe> = new Map(
  (codex as any).recipes,
);
export const extractionsCodex: Map<number, ExtractionRecipe> = new Map(
  (codex as any).extractions,
);
