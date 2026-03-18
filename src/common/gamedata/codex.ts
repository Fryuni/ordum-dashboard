import type { ItemEntry, CraftRecipe, ExtractionRecipe } from "./definition";
import encodedCodex from "./codex.json";
import { unflatten } from "devalue";

const codex = unflatten(encodedCodex as any[]);

export const itemsCodex: Map<string, ItemEntry> = codex.items;
export const recipesCodex: Map<number, CraftRecipe> = codex.recipes;
export const extractionsCodex: Map<number, ExtractionRecipe> =
  codex.extractions;
