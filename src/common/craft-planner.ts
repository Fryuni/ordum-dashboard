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
 * Craft Planner
 *
 * Given a list of target items and a player's current inventory,
 * recursively resolves the full crafting tree down to raw (gathered)
 * materials, showing every step needed.
 *
 * Performance: uses an incremental ledger so balance queries are O(1) per
 * key and the hot loop never clones the inventory map (which can have
 * thousands of entries). Branch exploration forks small maps only.
 */

import { topologicalSort } from "./topological-sort";
import {
  extractionsCodex,
  itemsCodex,
  recipeSelectionsCodex,
  recipesCodex,
} from "./gamedata/codex";
import {
  parseReferenceKey,
  referenceKey,
  type CraftRecipe,
  type ItemEntry,
  type ItemReference,
  type ItemStack,
  type ItemType,
} from "./gamedata/definition";
import {
  canMeetSkillRequirements,
  canMeetToolRequirements,
  type PlayerCapabilities,
} from "./player-capabilities";

// ─── Rarity Helpers ────────────────────────────────────────────────────────────

const RARITY_RANK: Record<string, number> = {
  Common: 0,
  Uncommon: 1,
  Rare: 2,
  Epic: 3,
  Legendary: 4,
  Mythic: 5,
};

function effectiveOutputPerCraft(
  recipe: CraftRecipe,
  targetKey: string,
): number {
  const targetItem = itemsCodex.get(targetKey);
  if (!targetItem) {
    return (
      recipe.outputs.find((s) => referenceKey(s) === targetKey)?.quantity || 1
    );
  }

  const targetRank = RARITY_RANK[targetItem.rarity] ?? -1;

  let totalQuantity = 0;
  let foundTarget = false;
  for (const output of recipe.outputs) {
    const outputKey = referenceKey(output);
    const outputItem = itemsCodex.get(outputKey);
    if (!outputItem) continue;

    if (
      outputItem.name === targetItem.name &&
      (RARITY_RANK[outputItem.rarity] ?? -1) >= targetRank
    ) {
      totalQuantity += output.quantity;
      if (outputKey === targetKey) foundTarget = true;
    }
  }

  if (!foundTarget || totalQuantity <= 0) {
    return (
      recipe.outputs.find((s) => referenceKey(s) === targetKey)?.quantity || 1
    );
  }

  return totalQuantity;
}

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface CraftTarget extends ItemReference {
  quantity: number;
}

export interface StepInput {
  item: ItemEntry;
  quantity_per_craft: number;
  available: number;
  is_raw: boolean;
}

export interface StepOutput {
  item: ItemEntry;
  quantity_per_craft: number;
}

export interface CraftStep {
  craft_count: number;
  effort_per_craft: number;
  recipe_id: number;
  recipe_name: string;
  building_type: string;
  building_tier: number;
  skill_requirements: { skill: string; level: number }[];
  tool_requirements: { tool: string; level: number }[];
  inputs: StepInput[];
  outputs: StepOutput[];
  depth: number;
  missing_skill: boolean;
  missing_tool: boolean;
}

export interface RawMaterial {
  item_id: number;
  item_type: ItemType;
  name: string;
  tier: number;
  tag: string;
  total_needed: number;
  likely_effort: number;
  available: number;
  source: string;
  skill_requirements: { skill: string; level: number }[];
  tool_requirements: { tool: string; level: number }[];
  resource_sources: string[];
  missing_skill: boolean;
  missing_tool: boolean;
}

export interface FulfilledItem extends ItemReference {
  name: string;
  quantity: number;
}

export interface CraftPlan {
  steps: CraftStep[];
  raw_materials: RawMaterial[];
  already_have: FulfilledItem[];
}

// ─── Constants ─────────────────────────────────────────────────────────────────

const MAX_DEPTH = 450;

// ─── Main Function ─────────────────────────────────────────────────────────────

function computePlayerTier(capabilities?: PlayerCapabilities): number {
  if (!capabilities) return 10;
  let tier = 10;
  if (capabilities.hasSkillData) {
    for (const level of capabilities.skills.values()) {
      tier = Math.min(tier, Math.floor(level / 10));
    }
  }
  if (capabilities.hasToolData) {
    for (const t of capabilities.maxToolTiers.values()) {
      tier = Math.min(tier, t);
    }
  }
  return Math.max(0, Math.min(tier, 10));
}

export function buildCraftPlan(
  targets: CraftTarget[],
  inventory: Map<string, number>,
  capabilities?: PlayerCapabilities,
): CraftPlan {
  try {
    const playerTier = computePlayerTier(capabilities);
    const builder = new PlanBuilder(
      (key) => inventory.get(key) ?? 0,
      capabilities,
    );
    for (const t of targets) builder.addTarget(t);
    solve(builder, 1, playerTier);
    return builder.finalize(inventory, capabilities);
  } catch (error) {
    console.error("Failed to build craft plan:", error);
    throw error;
  }
}

export function buildPartialPlan(
  targets: CraftTarget[],
  inventory: Map<string, number>,
  initialDepth = 1,
  capabilities?: PlayerCapabilities,
): PlanBuilder {
  const playerTier = computePlayerTier(capabilities);
  const builder = new PlanBuilder(
    (key) => inventory.get(key) ?? 0,
    capabilities,
  );
  for (const t of targets) builder.addTarget(t);
  solve(builder, initialDepth, playerTier);
  return builder;
}

// ─── Solver ───────────────────────────────────────────────────────────────────

function solve(
  builder: PlanBuilder,
  startDepth: number,
  playerTier: number,
): void {
  let depth = startDepth;
  let target: CraftTarget | null;

  while ((target = builder.nextUnfulfilled()) !== null) {
    depth++;

    if (depth > MAX_DEPTH || !Number.isSafeInteger(target.quantity)) {
      builder.addRaw(target.item_type, target.item_id, target.quantity);
      continue;
    }

    const targetKey = referenceKey(target);
    const itemEntry = itemsCodex.get(targetKey);

    if (!itemEntry || itemEntry.crafted_from.length === 0) {
      builder.addRaw(target.item_type, target.item_id, target.quantity);
      continue;
    }

    // Use precomputed recipe selection when available.
    const selectedId =
      recipeSelectionsCodex.get(targetKey)?.[Math.min(playerTier, 10)];
    const recipe =
      selectedId != null
        ? recipesCodex.get(selectedId)
        : itemEntry.crafted_from.length === 1
          ? recipesCodex.get(itemEntry.crafted_from[0]!)
          : null;

    if (recipe) {
      const outputPerCraft = effectiveOutputPerCraft(recipe, targetKey);
      builder.addRecipe(recipe, target.quantity / outputPerCraft, depth);
      continue;
    }

    // Fallback: dynamic branch evaluation for items not in selections.
    let cheapestBranch: PlanBuilder | null = null;
    let cheapestEffort = Infinity;

    for (const recipeId of itemEntry.crafted_from) {
      const candidate = recipesCodex.get(recipeId)!;
      const outputPerCraft = effectiveOutputPerCraft(candidate, targetKey);
      const branch = builder.branchBuilder();
      branch.addRecipe(candidate, target.quantity / outputPerCraft, depth);
      solve(branch, depth, playerTier);
      const effort = branch.totalEffort();
      if (effort < cheapestEffort) {
        cheapestEffort = effort;
        cheapestBranch = branch;
      }
    }

    if (cheapestBranch) {
      builder.mergeFrom(cheapestBranch);
    }
  }
}

// ─── PlanBuilder ──────────────────────────────────────────────────────────────

type InventoryLookup = (key: string) => number;

class PlanBuilder {
  private readonly getInventory: InventoryLookup;
  private readonly capabilities: PlayerCapabilities | undefined;

  // Accumulated delta from the initial inventory. Positive = produced/gathered,
  // negative = consumed. Only keys that have been touched are stored.
  private ledger = new Map<string, number>();

  // Items with a net-negative balance: key → deficit (positive number).
  private queue = new Map<string, number>();

  // Recipes committed to the plan.
  private recipes = new Map<
    number,
    { recipe: CraftRecipe; craftCount: number; depth: number }
  >();

  // Raw materials committed to the plan.
  private rawMaterials = new Map<string, ItemStack>();

  constructor(
    getInventory: InventoryLookup,
    capabilities?: PlayerCapabilities,
  ) {
    this.getInventory = getInventory;
    this.capabilities = capabilities;
  }

  private balance(key: string): number {
    return this.getInventory(key) + (this.ledger.get(key) ?? 0);
  }

  private adjust(key: string, delta: number): void {
    const newLedger = (this.ledger.get(key) ?? 0) + delta;
    if (newLedger === 0) {
      this.ledger.delete(key);
    } else {
      this.ledger.set(key, newLedger);
    }

    const bal = this.getInventory(key) + newLedger;
    if (bal < 0) {
      this.queue.set(key, Math.ceil(-bal));
    } else {
      this.queue.delete(key);
    }
  }

  addTarget(target: CraftTarget): void {
    this.adjust(referenceKey(target), -target.quantity);
  }

  addRecipe(recipe: CraftRecipe, quantity: number, depth: number): void {
    const craftCount = Math.ceil(quantity);
    const existing = this.recipes.get(recipe.id);

    if (existing) {
      const oldCount = existing.craftCount;
      existing.craftCount += craftCount;
      existing.depth = Math.max(existing.depth, depth);

      for (const input of recipe.inputs) {
        const oldDemand = Math.ceil(oldCount * input.quantity);
        const newDemand = Math.ceil(existing.craftCount * input.quantity);
        this.adjust(referenceKey(input), -(newDemand - oldDemand));
      }
      for (const output of recipe.outputs) {
        const oldProd = Math.ceil(oldCount * output.quantity);
        const newProd = Math.ceil(existing.craftCount * output.quantity);
        this.adjust(referenceKey(output), newProd - oldProd);
      }
    } else {
      this.recipes.set(recipe.id, { recipe, craftCount, depth });
      for (const input of recipe.inputs) {
        this.adjust(
          referenceKey(input),
          -Math.ceil(craftCount * input.quantity),
        );
      }
      for (const output of recipe.outputs) {
        this.adjust(
          referenceKey(output),
          Math.ceil(craftCount * output.quantity),
        );
      }
    }
  }

  addRaw(itemType: ItemType, itemId: number, quantity: number): void {
    const key = `${itemType}:${itemId}`;
    const existing = this.rawMaterials.get(key);
    if (existing) {
      existing.quantity += quantity;
    } else {
      if (!itemsCodex.has(key)) return;
      this.rawMaterials.set(key, {
        item_type: itemType,
        item_id: itemId,
        quantity,
      });
    }
    this.adjust(key, quantity);
  }

  nextUnfulfilled(): CraftTarget | null {
    for (const [key, deficit] of this.queue) {
      return { ...parseReferenceKey(key), quantity: deficit };
    }
    return null;
  }

  branchBuilder(): PlanBuilder {
    return new PlanBuilder(
      (key) => Math.max(0, this.balance(key)),
      this.capabilities,
    );
  }

  mergeFrom(branch: PlanBuilder): void {
    for (const { recipe, craftCount, depth } of branch.recipes.values()) {
      this.addRecipe(recipe, craftCount, depth);
    }
    for (const material of branch.rawMaterials.values()) {
      this.addRaw(material.item_type, material.item_id, material.quantity);
    }
  }

  totalEffort(): number {
    let total = 0;
    for (const { recipe, craftCount } of this.recipes.values()) {
      let effort = craftCount * recipe.effort;
      if (
        !canMeetSkillRequirements(this.capabilities, recipe.requiredSkills) ||
        !canMeetToolRequirements(this.capabilities, recipe.requiredTool)
      ) {
        effort *= 100;
      }
      total += effort;
    }
    for (const material of this.rawMaterials.values()) {
      const key = referenceKey(material);
      const item = itemsCodex.get(key)!;
      const quantitiesPerStrike = item.extracted_from.map((recipeId) => {
        const recipe = extractionsCodex.get(recipeId)!;
        return recipe.outputs.find((output) => referenceKey(output) === key)!
          .quantity;
      });
      const avgPerStrike =
        quantitiesPerStrike.length === 0
          ? 1
          : quantitiesPerStrike.reduce((a, b) => a + b) /
            quantitiesPerStrike.length;
      let effort = material.quantity / avgPerStrike;
      const anyUnavailable = item.extracted_from.some((recipeId) => {
        const recipe = extractionsCodex.get(recipeId)!;
        return (
          !canMeetSkillRequirements(this.capabilities, recipe.requiredSkills) ||
          !canMeetToolRequirements(this.capabilities, recipe.requiredTool)
        );
      });
      if (anyUnavailable) effort *= 100;
      total += effort;
    }
    return total;
  }

  finalize(
    inventory: ReadonlyMap<string, number>,
    capabilities?: PlayerCapabilities,
  ): CraftPlan {
    const available = new Map(inventory);
    const totalNeeded = new Map<string, number>();
    const plan: CraftPlan = {
      steps: [],
      already_have: [],
      raw_materials: [],
    };

    for (const { recipe, craftCount, depth } of this.recipes.values()) {
      plan.steps.push({
        craft_count: craftCount,
        effort_per_craft: recipe.effort,
        recipe_id: recipe.id,
        recipe_name: recipe.name,
        building_type: recipe.buildingType,
        building_tier: recipe.requiredBuildingTier,
        skill_requirements: recipe.requiredSkills,
        tool_requirements: recipe.requiredTool,
        missing_skill: !canMeetSkillRequirements(
          capabilities,
          recipe.requiredSkills,
        ),
        missing_tool: !canMeetToolRequirements(
          capabilities,
          recipe.requiredTool,
        ),
        inputs: recipe.inputs.map((stack): StepInput => {
          const itemKey = referenceKey(stack);
          const totalAvailable = available.get(itemKey) ?? 0;
          const needed = Math.ceil(stack.quantity * craftCount);
          const used = Math.max(
            0,
            Math.min(Math.floor(totalAvailable), needed),
          );
          available.set(itemKey, totalAvailable - needed);
          totalNeeded.set(itemKey, (totalNeeded.get(itemKey) ?? 0) + needed);

          return {
            item: itemsCodex.get(itemKey)!,
            quantity_per_craft: Math.floor(stack.quantity),
            available: used,
            is_raw: this.rawMaterials.has(itemKey),
          };
        }),
        outputs: recipe.outputs.map(
          (stack): StepOutput => ({
            item: itemsCodex.get(referenceKey(stack))!,
            quantity_per_craft: stack.quantity,
          }),
        ),
        depth,
      });
    }

    plan.steps = topologicalSort(plan.steps, (a, b) => {
      for (const out of a.outputs) {
        for (const inp of b.inputs) {
          if (inp.item === out.item) return "a->b";
        }
      }
      for (const out of b.outputs) {
        for (const inp of a.inputs) {
          if (inp.item === out.item) return "b->a";
        }
      }
      return null;
    });

    plan.steps.forEach((step, i, s) => {
      step.depth = s.length - i - 1;
    });

    for (const [key, material] of this.rawMaterials.entries()) {
      const totalAvailable = inventory.get(key) ?? 0;
      const needed = totalNeeded.get(key) ?? Math.ceil(material.quantity);
      const used = Math.max(0, Math.min(totalAvailable, needed));
      available.set(key, totalAvailable - needed);

      const item = itemsCodex.get(key)!;
      const quantitiesPerStrike = item.extracted_from.map((recipeId) => {
        const recipe = extractionsCodex.get(recipeId)!;
        return recipe.outputs.find((output) => referenceKey(output) === key)!
          .quantity;
      });
      const avgPerStrike =
        quantitiesPerStrike.length === 0
          ? 1
          : quantitiesPerStrike.reduce((a, b) => a + b) /
            quantitiesPerStrike.length;
      const firstExtraction = extractionsCodex.get(item.extracted_from[0]!);
      plan.raw_materials.push({
        item_id: item.item_id,
        item_type: item.item_type,
        name: item.name,
        tier: item.tier,
        tag: item.tag || "",
        likely_effort: Math.ceil(material.quantity / avgPerStrike),
        available: used,
        total_needed: needed,
        source: firstExtraction?.verb || "Obtain",
        skill_requirements: firstExtraction?.requiredSkills ?? [],
        tool_requirements: firstExtraction?.requiredTool ?? [],
        missing_skill: firstExtraction
          ? !canMeetSkillRequirements(
              capabilities,
              firstExtraction.requiredSkills,
            )
          : false,
        missing_tool: firstExtraction
          ? !canMeetToolRequirements(capabilities, firstExtraction.requiredTool)
          : false,
        resource_sources: item.extracted_from.map(
          (recipe) => extractionsCodex.get(recipe)!.name,
        ),
      });
    }

    for (const inputKey of totalNeeded.keys()) {
      const remaining = available.get(inputKey) ?? 0;
      if (remaining >= 0) {
        const item = itemsCodex.get(inputKey)!;
        plan.already_have.push({
          item_type: item.item_type,
          item_id: item.item_id,
          name: item.name,
          quantity: inventory.get(inputKey) ?? 0,
        });
      }
    }

    return plan;
  }
}
