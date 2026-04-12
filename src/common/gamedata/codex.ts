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
export const recipeSelectionsCodex: Map<string, number[]> = new Map(
  (codex as any).recipeSelections ?? [],
);
