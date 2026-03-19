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
 */

import { topologicalSort } from "./topological-sort";
import { extractionsCodex, itemsCodex, recipesCodex } from "./gamedata/codex";
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
  /** True if the player lacks the skill level for this recipe */
  missing_skill: boolean;
  /** True if the player lacks the tool tier for this recipe */
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
  /** True if the player lacks the skill level for extraction */
  missing_skill: boolean;
  /** True if the player lacks the tool tier for extraction */
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

export function buildCraftPlan(
  targets: CraftTarget[],
  inventory: Map<string, number>,
  capabilities?: PlayerCapabilities,
): CraftPlan {
  try {
    const plan = buildPartialPlan(targets, inventory, 1, capabilities);
    return plan.finalize(capabilities);
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
): PartialPlan {
  const plan = PartialPlan.empty(inventory, capabilities);

  for (const t of targets) {
    plan.addTarget(t);
  }

  let depth = initialDepth;

  // Use delta() from the start so inventory is checked before resolving recipes.
  // delta() subtracts targets from inventory, returning only unfulfilled items.
  for (
    let next = plan.delta(), [target, ...otherTargets] = next.targets;
    ;
    next = plan.delta(), [target, ...otherTargets] = next.targets
  ) {
    depth++;
    if (!target) return plan;

    if (depth > MAX_DEPTH) {
      plan.addRaw(target.item_type, target.item_id, target.quantity);
      continue;
    }

    if (!Number.isSafeInteger(target.quantity)) {
      plan.addRaw(target.item_type, target.item_id, target.quantity);
      continue;
    }

    const key = referenceKey(target);

    const itemEntry = itemsCodex.get(key);
    if (!itemEntry) {
      plan.addRaw(target.item_type, target.item_id, target.quantity);
      continue;
    }

    if (itemEntry.crafted_from.length === 0) {
      plan.addRaw(target.item_type, target.item_id, target.quantity);
      continue;
    }
    if (itemEntry.crafted_from.length === 1) {
      const recipe = recipesCodex.get(itemEntry.crafted_from[0]!)!;
      const outputPerCraft =
        recipe.outputs.find((stack) => referenceKey(stack) === key)?.quantity ||
        1;

      plan.addRecipe(recipe, target.quantity / outputPerCraft, depth);

      continue;
    }

    const branches = itemEntry.crafted_from.map((recipeId) => {
      const recipe = recipesCodex.get(recipeId)!;
      const outputPerCraft =
        recipe.outputs.find((stack) => referenceKey(stack) === key)?.quantity ||
        1;
      const branchPlan = PartialPlan.empty(next.inventory, capabilities);

      branchPlan.addRecipe(recipe, target.quantity / outputPerCraft, depth);

      const branchNext = branchPlan.delta();
      if (branchNext.targets.length === 0) return branchPlan;
      branchPlan.addSubplan(
        buildPartialPlan(
          branchNext.targets,
          branchNext.inventory,
          depth + 1,
          capabilities,
        ),
      );
      return branchPlan;
    });

    const easiestPlan = branches.sort(
      (a, b) => a.totalEffort() - b.totalEffort(),
    )[0]!;
    plan.addSubplan(easiestPlan);
  }
}

class PartialPlan {
  targets = new Map<string, CraftTarget>();
  recipes = new Map<
    number,
    {
      recipe: CraftRecipe;
      quantity: number;
      depth: number;
    }
  >();
  rawMaterials = new Map<string, ItemStack>();

  private constructor(
    private inventory: ReadonlyMap<string, number>,
    private capabilities: PlayerCapabilities | undefined,
  ) {}

  static empty(
    inventory: ReadonlyMap<string, number>,
    capabilities?: PlayerCapabilities,
  ): PartialPlan {
    return new this(inventory, capabilities);
  }

  clone(): PartialPlan {
    const other = PartialPlan.empty(this.inventory, this.capabilities);
    other.targets = new Map(
      this.targets.entries().map(([k, v]) => [k, { ...v }]),
    );
    other.recipes = new Map(
      this.recipes.entries().map(([k, v]) => [k, { ...v }]),
    );
    other.rawMaterials = new Map(
      this.rawMaterials.entries().map(([k, v]) => [k, { ...v }]),
    );
    return other;
  }

  addTarget(target: CraftTarget) {
    const key = referenceKey(target);
    const existing = this.targets.get(key);
    if (existing) {
      existing.quantity += target.quantity;
    } else {
      this.targets.set(key, target);
    }
  }

  addRecipe(recipe: CraftRecipe, quantity: number, depth: number) {
    const existing = this.recipes.get(recipe.id);
    if (existing) {
      existing.quantity += Math.ceil(quantity);
      existing.depth = Math.max(existing.depth, depth);
    } else {
      this.recipes.set(recipe.id, { recipe, quantity, depth });
    }
  }

  addRaw(itemType: ItemType, itemId: number, quantity: number) {
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
  }

  addSubplan(other: PartialPlan) {
    for (const { recipe, quantity, depth } of other.recipes.values()) {
      this.addRecipe(recipe, quantity, depth);
    }
    for (const material of other.rawMaterials.values()) {
      this.addRaw(material.item_type, material.item_id, material.quantity);
    }
  }

  delta(): {
    inventory: Map<string, number>;
    targets: CraftTarget[];
  } {
    const inv = new Map(this.inventory);
    const add = (key: string, n: number) => {
      inv.set(key, (inv.get(key) ?? 0) + n);
    };

    for (const [key, { quantity }] of this.targets.entries()) {
      add(key, -quantity);
    }

    for (const { recipe, quantity } of this.recipes.values()) {
      for (const input of recipe.inputs) {
        add(referenceKey(input), -Math.ceil(quantity * input.quantity));
      }
      for (const output of recipe.outputs) {
        add(referenceKey(output), Math.ceil(quantity * output.quantity));
      }
    }

    for (const [key, { quantity }] of this.rawMaterials.entries()) {
      add(key, Math.ceil(quantity));
    }

    const result = {
      inventory: new Map<string, number>(),
      targets: [] as CraftTarget[],
    };

    for (const [key, value] of inv.entries()) {
      if (value < 0) {
        result.targets.push({
          ...parseReferenceKey(key),
          quantity: Math.ceil(-value),
        });
      } else if (value > 0) {
        result.inventory.set(key, value);
      }
    }

    return result;
  }

  totalEffort(): number {
    let totalEffort = 0;
    for (const { recipe, quantity } of this.recipes.values()) {
      let effort = quantity * recipe.effort;
      if (
        !canMeetSkillRequirements(this.capabilities, recipe.requiredSkills) ||
        !canMeetToolRequirements(this.capabilities, recipe.requiredTool)
      ) {
        effort *= 100;
      }
      totalEffort += effort;
    }
    for (const material of this.rawMaterials.values()) {
      const key = referenceKey(material);
      const item = itemsCodex.get(key)!;
      const quantitiesPerStrike = item.extracted_from.map((recipeId) => {
        const recipe = extractionsCodex.get(recipeId)!;
        const selfItem = recipe.outputs.find(
          (output) => referenceKey(output) === key,
        )!;
        return selfItem.quantity;
      });
      const averageQuantityPerStrike =
        quantitiesPerStrike.length === 0
          ? 1
          : quantitiesPerStrike.reduce((a, b) => a + b) /
            quantitiesPerStrike.length;
      let effort = material.quantity / averageQuantityPerStrike;
      // Apply 100x penalty if any extraction recipe is unavailable
      const anyExtractionUnavailable = item.extracted_from.some((recipeId) => {
        const recipe = extractionsCodex.get(recipeId)!;
        return (
          !canMeetSkillRequirements(this.capabilities, recipe.requiredSkills) ||
          !canMeetToolRequirements(this.capabilities, recipe.requiredTool)
        );
      });
      if (anyExtractionUnavailable) {
        effort *= 100;
      }
      totalEffort += effort;
    }
    return totalEffort;
  }

  finalize(capabilities?: PlayerCapabilities): CraftPlan {
    const available = new Map(this.inventory);
    const totalNeeded = new Map<string, number>();
    const plan: CraftPlan = {
      steps: [],
      already_have: [],
      raw_materials: [],
    };

    for (const { recipe, quantity, depth } of this.recipes.values()) {
      plan.steps.push({
        craft_count: Math.ceil(quantity),
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
          const needed = Math.ceil(stack.quantity * quantity);
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

    // Topological sort: a step must come after all steps that produce its inputs.
    // Uses the generic topologicalSort which handles cycles via Tarjan's SCC.
    plan.steps = topologicalSort(plan.steps, (a, b) => {
      // Does a produce something b needs? → a before b
      for (const out of a.outputs) {
        for (const inp of b.inputs) {
          if (inp.item === out.item) return "a->b";
        }
      }
      // Does b produce something a needs? → b before a
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
      const totalAvailable = this.inventory.get(key) ?? 0;
      const needed = totalNeeded.get(key) ?? Math.ceil(material.quantity);
      const used = Math.max(0, Math.min(totalAvailable, needed));
      available.set(key, totalAvailable - needed);

      const item = itemsCodex.get(key)!;
      const quantitiesPerStrike = item.extracted_from.map((recipeId) => {
        const recipe = extractionsCodex.get(recipeId)!;
        const selfItem = recipe.outputs.find(
          (output) => referenceKey(output) === key,
        )!;
        return selfItem.quantity;
      });
      const averageQuantityPerStrike =
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
        likely_effort: Math.ceil(material.quantity / averageQuantityPerStrike),
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
          quantity: this.inventory.get(inputKey) ?? 0,
        });
      }
    }

    return plan;
  }
}
