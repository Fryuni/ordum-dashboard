import type {
  ItemEntry,
  CraftRecipe,
  ExtractionRecipe,
  ToolItemEntry,
} from "./definition";
import codex from "./codex.json";

export const itemsCodex: Map<string, ItemEntry> = new Map((codex as any).items);
export const recipesCodex: Map<number, CraftRecipe> = new Map(
  (codex as any).recipes,
);
export const extractionsCodex: Map<number, ExtractionRecipe> = new Map(
  (codex as any).extractions,
);
export const toolItemsCodex: Map<number, ToolItemEntry> = new Map(
  (codex as any).toolItems ?? [],
);
