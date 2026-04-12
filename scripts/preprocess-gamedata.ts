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
import {
  referenceKey,
  type CraftRecipe,
  type ExtractionRecipe,
  type ItemEntry,
  type ItemReference,
  type ItemStack,
} from "../src/common/gamedata/definition";
import * as path from "node:path";
import * as devalue from "devalue";

const rootDir = path.dirname(import.meta.dirname);
const gamedataDir = path.join(rootDir, "gamedata");
const encodedCodexFile = path.join(
  rootDir,
  "src",
  "common",
  "gamedata",
  "codex.json",
);
const codexFile = path.join(rootDir, "src", "common", "gamedata", "codex.ts");

async function readDescFile(name: string, count?: number): Promise<any[]> {
  const content = await Bun.file(
    path.join(gamedataDir, `${name}_desc.json`),
  ).json();
  if (count === undefined) return content;
  return content.slice(0, count);
}

function removeFalsy<T extends Record<any, any>>(
  value: T,
  ...keys: (keyof T)[]
): T {
  return Object.fromEntries(
    Object.entries(value).filter(([k, v]) => !keys.includes(k as any) || !!v),
  ) as T;
}

const items = new Map<string, ItemEntry>();
const recipes = new Map<number, CraftRecipe>();
const extractions = new Map<number, ExtractionRecipe>();

const itemListItems = new Map<string, number>();

for (const item of await readDescFile("item")) {
  const key = `Item:${item.id}`;
  if (item.item_list_id) {
    itemListItems.set(key, item.item_list_id);
  } else {
    items.set(
      key,
      removeFalsy(
        {
          item_type: "Item",
          item_id: item.id.toFixed(0),
          name: item.name,
          description: item.description,
          tag: item.tag,
          tier: item.tier,
          rarity: item.rarity,
          crafted_from: [],
          crafted_into: [],
          extracted_from: [],
        },
        "description",
        "tag",
      ),
    );
  }
}

for (const item of await readDescFile("cargo")) {
  items.set(
    `Cargo:${item.id}`,
    removeFalsy(
      {
        item_type: "Cargo",
        item_id: item.id.toFixed(0),
        name: item.name,
        description: item.description,
        tag: item.tag,
        tier: item.tier,
        rarity: item.rarity,
        crafted_from: [],
        crafted_into: [],
        extracted_from: [],
      },
      "description",
      "tag",
    ),
  );
}

interface RawItemStack extends ItemReference {
  quantity: number;
}

type ItemList =
  | ItemStack[]
  | {
      rawItems: RawItemStack[];
    };

const itemLists = new Map<number, ItemList>();

for (const list of await readDescFile("item_list")) {
  itemLists.set(list.id, {
    rawItems: (list.possibilities as any[])
      .map(({ probability, items }: any): RawItemStack[] =>
        items.map((item: any) => ({
          ...item,
          quantity: item.quantity * probability,
        })),
      )
      .flat(1),
  });
}

function collapseStack(stacks: ItemStack[]): ItemStack[] {
  const mapped: Record<string, ItemStack> = {};
  for (const stack of stacks) {
    const key = referenceKey(stack);
    const itemStack = (mapped[key] ??= { ...stack, quantity: 0 });
    itemStack.quantity += stack.quantity;
  }
  return Object.values(mapped);
}

function resolveItemStack(input: RawItemStack[]): ItemStack[] {
  const resolved = input
    .map((rawStack): ItemStack[] => {
      const key = referenceKey(rawStack);
      const realItem = items.get(key);
      if (realItem)
        return [
          {
            item_type: realItem.item_type,
            item_id: realItem.item_id,
            quantity: rawStack.quantity,
          },
        ];

      const itemListId = itemListItems.get(key);
      if (!itemListId)
        throw new Error(
          `Reference "${key}" is neither an item or an item list.`,
        );

      const itemList = itemLists.get(itemListId);
      if (!itemList)
        throw new Error(
          `Reference "${key}" points to an item list that doesn't exist.`,
        );

      if (Array.isArray(itemList)) return itemList;

      const nestedResolved = resolveItemStack(itemList.rawItems);
      itemLists.set(itemListId, nestedResolved);
      return nestedResolved;
    })
    .flat(1);
  return collapseStack(resolved);
}

const buildingTypes = new Map<number, string>(
  (await readDescFile("building_type")).map(
    (building: { id: number; name: string }) => [building.id, building.name],
  ),
);
const skills = new Map<number, string>(
  (await readDescFile("skill")).map((skill: { id: number; name: string }) => [
    skill.id,
    skill.name,
  ]),
);
const toolTypes = new Map<number, string>(
  (await readDescFile("tool_type")).map(
    (tool: { id: number; name: string }) => [tool.id, tool.name],
  ),
);

/** Recipe name patterns to skip (packaging/unpackaging creates cycles) */
function shouldSkipRecipe(recipe: { name: string }): boolean {
  const name = recipe.name.toLowerCase();
  return name.startsWith("unpack ") || name.startsWith("recraft ");
}

for (const rawRecipe of await readDescFile("crafting_recipe")) {
  if (shouldSkipRecipe(rawRecipe)) continue;
  const inputs = resolveItemStack(rawRecipe.consumed_item_stacks);
  const outputs = resolveItemStack(rawRecipe.crafted_item_stacks);
  const nameParts = [...outputs, ...inputs].map(
    (c) => items.get(referenceKey(c))!.name,
  );
  const name = (rawRecipe.name as string).replace(/\{(\d+)\}/g, (_, index) => {
    return nameParts[Number.parseInt(index, 10)] || `#${index}`;
  });
  const recipe: CraftRecipe = {
    id: rawRecipe.id,
    name,
    inputs: inputs,
    outputs: outputs,
    effort: rawRecipe.actions_required,
    passive: rawRecipe.is_passive,
    buildingType:
      buildingTypes.get(rawRecipe.building_requirement.building_type) || "Any",
    requiredBuildingTier: rawRecipe.building_requirement.tier || 0,
    requiredSkills: (rawRecipe.level_requirements as any[]).map(
      ({ skill_id, level }) => ({
        skill: skills.get(skill_id) || "Unknown skill",
        level,
      }),
    ),
    requiredTool: (rawRecipe.tool_requirements as any[]).map(
      ({ tool_type, level }) => ({
        tool: toolTypes.get(tool_type) || "Unknown tool",
        level,
      }),
    ),
  };

  recipes.set(recipe.id, recipe);
  inputs.forEach((input) => {
    items.get(referenceKey(input))!.crafted_into.push(recipe.id);
  });
  outputs.forEach((output) => {
    items.get(referenceKey(output))!.crafted_from.push(recipe.id);
  });
}

const resources = new Map<number, string>(
  (await readDescFile("resource")).map(
    (resource: { id: number; name: string }) => [resource.id, resource.name],
  ),
);

for (const rawRecipe of await readDescFile("extraction_recipe")) {
  const outputs = resolveItemStack(
    (rawRecipe.extracted_item_stacks as any[]).map(
      ({ probability, item_stack }: any): RawItemStack => ({
        ...item_stack,
        quantity: item_stack.quantity * probability,
      }),
    ),
  );
  const recipe: ExtractionRecipe = {
    id: rawRecipe.id,
    verb: rawRecipe.verb_phrase,
    name: resources.get(rawRecipe.resource_id) || "Unknown resource",
    outputs: outputs,
    requiredSkills: (rawRecipe.level_requirements as any[]).map(
      ({ skill_id, level }) => ({
        skill: skills.get(skill_id) || "Unknown skill",
        level,
      }),
    ),
    requiredTool: (rawRecipe.tool_requirements as any[]).map(
      ({ tool_type, level }) => ({
        tool: toolTypes.get(tool_type) || "Unknown tool",
        level,
      }),
    ),
  };

  extractions.set(recipe.id, recipe);
  outputs.forEach((output) => {
    items.get(referenceKey(output))!.extracted_from.push(recipe.id);
  });
}

// Build tool items codex: maps item_id → { toolType name, tier }
// tool_desc.json fields: id, item_id, tool_type, level (= tier), power
const toolItems = new Map<
  number,
  { item_id: number; name: string; toolType: string; tier: number }
>();
const rawToolsData: {
  id: number;
  item_id: number;
  tool_type: number;
  level: number;
  power: number;
}[] = await readDescFile("tool");
const rawToolTypesData: { id: number; name: string }[] =
  await readDescFile("tool_type");
const toolTypeNames = new Map<number, string>(
  rawToolTypesData.map((tt) => [tt.id, tt.name]),
);

for (const tool of rawToolsData) {
  const itemEntry = items.get(`Item:${tool.item_id}`);
  toolItems.set(tool.item_id, {
    item_id: tool.item_id,
    name: itemEntry?.name ?? `Tool #${tool.id}`,
    toolType: toolTypeNames.get(tool.tool_type) || "Unknown tool",
    tier: tool.level,
  });
}

console.log(`${items.size} items`);
console.log(`${itemLists.size} item lists`);
console.log(`${recipes.size} craft recipes`);
console.log(`${extractions.size} extraction recipes`);
console.log(`${toolItems.size} tool items`);

// ─── Precompute recipe selections per tier ────────────────────────────────────

const RARITY_RANK: Record<string, number> = {
  Common: 0,
  Uncommon: 1,
  Rare: 2,
  Epic: 3,
  Legendary: 4,
  Mythic: 5,
};

function computeRecipeTier(recipe: CraftRecipe): number {
  let tier = recipe.requiredBuildingTier;
  for (const s of recipe.requiredSkills)
    tier = Math.max(tier, Math.floor(s.level / 10));
  for (const t of recipe.requiredTool) tier = Math.max(tier, t.level);
  return tier;
}

function localEffectiveOutput(recipe: CraftRecipe, targetKey: string): number {
  const targetItem = items.get(targetKey);
  if (!targetItem) {
    return (
      recipe.outputs.find((s) => referenceKey(s) === targetKey)?.quantity || 1
    );
  }
  const targetRank = RARITY_RANK[targetItem.rarity] ?? -1;
  let total = 0;
  let found = false;
  for (const output of recipe.outputs) {
    const outItem = items.get(referenceKey(output));
    if (
      outItem &&
      outItem.name === targetItem.name &&
      (RARITY_RANK[outItem.rarity] ?? -1) >= targetRank
    ) {
      total += output.quantity;
      if (referenceKey(output) === targetKey) found = true;
    }
  }
  if (!found || total <= 0) {
    return (
      recipe.outputs.find((s) => referenceKey(s) === targetKey)?.quantity || 1
    );
  }
  return total;
}

function chainEffort(
  itemKey: string,
  playerTier: number,
  memo: Map<string, number>,
): number {
  const cached = memo.get(itemKey);
  if (cached !== undefined) return cached;

  const item = items.get(itemKey);
  if (!item) {
    memo.set(itemKey, 0);
    return 0;
  }

  if (item.crafted_from.length === 0) {
    let effort = 1;
    for (const rid of item.extracted_from) {
      const ext = extractions.get(rid);
      if (!ext) continue;
      let extTier = 0;
      for (const s of ext.requiredSkills)
        extTier = Math.max(extTier, Math.floor(s.level / 10));
      for (const t of ext.requiredTool) extTier = Math.max(extTier, t.level);
      if (extTier > playerTier) {
        effort = 100;
        break;
      }
    }
    memo.set(itemKey, effort);
    return effort;
  }

  // Guard against cycles
  memo.set(itemKey, Infinity);

  let best = Infinity;
  for (const recipeId of item.crafted_from) {
    const recipe = recipes.get(recipeId)!;
    const recipeTier = computeRecipeTier(recipe);
    const penalty = recipeTier > playerTier ? 100 : 1;
    let effort = recipe.effort * penalty;
    const outputPerCraft = localEffectiveOutput(recipe, itemKey);
    for (const input of recipe.inputs) {
      effort +=
        (input.quantity / outputPerCraft) *
        chainEffort(referenceKey(input), playerTier, memo);
    }
    best = Math.min(best, effort);
  }

  memo.set(itemKey, best);
  return best;
}

// For each multi-recipe item, select the cheapest recipe at each tier 0-10.
const recipeSelections = new Map<string, number[]>();
let multiCount = 0;

for (const [itemKey, item] of items.entries()) {
  if (item.crafted_from.length <= 1) continue;
  multiCount++;

  const selections: number[] = [];
  for (let tier = 0; tier <= 10; tier++) {
    const memo = new Map<string, number>();
    let bestId = item.crafted_from[0]!;
    let bestEffort = Infinity;
    for (const recipeId of item.crafted_from) {
      const recipe = recipes.get(recipeId)!;
      const recipeTier = computeRecipeTier(recipe);
      const penalty = recipeTier > tier ? 100 : 1;
      let effort = recipe.effort * penalty;
      const outputPerCraft = localEffectiveOutput(recipe, itemKey);
      for (const input of recipe.inputs) {
        effort +=
          (input.quantity / outputPerCraft) *
          chainEffort(referenceKey(input), tier, memo);
      }
      if (effort < bestEffort) {
        bestEffort = effort;
        bestId = recipeId;
      }
    }
    selections.push(bestId);
  }

  recipeSelections.set(itemKey, selections);
}

console.log(
  `${multiCount} multi-recipe items → ${recipeSelections.size} recipe selections`,
);

// ─── Write codex ──────────────────────────────────────────────────────────────

await Bun.file(encodedCodexFile).write(
  JSON.stringify({
    items: Array.from(items.entries()),
    recipes: Array.from(recipes.entries()),
    extractions: Array.from(extractions.entries()),
    toolItems: Array.from(toolItems.entries()),
    recipeSelections: Array.from(recipeSelections.entries()),
  }),
);

await Bun.file(codexFile).write(
  `
import type { ItemEntry, CraftRecipe, ExtractionRecipe, ToolItemEntry } from "./definition";
import codex from "./codex.json";

export const itemsCodex: Map<string, ItemEntry> = new Map((codex as any).items);
export const recipesCodex: Map<number, CraftRecipe> = new Map((codex as any).recipes);
export const extractionsCodex: Map<number, ExtractionRecipe> = new Map((codex as any).extractions);
export const toolItemsCodex: Map<number, ToolItemEntry> = new Map((codex as any).toolItems ?? []);
export const recipeSelectionsCodex: Map<string, number[]> = new Map((codex as any).recipeSelections ?? []);
`.trim(),
);
