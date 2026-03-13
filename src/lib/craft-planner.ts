/**
 * Craft Planner
 *
 * Given a list of target items and a player's current inventory,
 * recursively resolves the full crafting tree down to raw (gathered)
 * materials, showing every step needed.
 */

import { LazyKeyed } from "@inox-tools/utils/lazy";
import type {
  GameData,
  GameCraftingRecipe,
  ItemType,
  ItemReference,
} from "./gamedata";
import { topologicalSort } from "./topological-sort";
import {
  getItemName,
  getItemInfo,
  getSkillName,
  getToolTypeName,
  getBuildingTypeName,
  gd,
  referenceKey,
  parseReferenceKey,
  realItemStack,
} from "./gamedata";

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface CraftTarget extends ItemReference {
  quantity: number;
}

export interface StepInput extends ItemReference {
  name: string;
  quantity_per_craft: number;
  available: number;
  is_raw: boolean;
}

export interface StepOutput extends ItemReference {
  name: string;
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
}

export interface RawMaterialSource {
  resource_name: string;
  amount_per_stamina: number;
  verb: string;
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
  resource_sources: RawMaterialSource[];
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

const MAX_DEPTH = 150;

/** Recipe name patterns to skip (packaging/unpackaging creates cycles) */
function shouldSkipRecipe(recipe: GameCraftingRecipe): boolean {
  const name = recipe.name.toLowerCase();
  return name.startsWith("unpack ") || name.startsWith("package ");
}

// ─── Main Function ─────────────────────────────────────────────────────────────

export function buildCraftPlan(
  targets: CraftTarget[],
  inventory: Map<string, number>,
): CraftPlan {
  const plan = buildPartialPlan(targets, inventory);
  return plan.finalize();
}

const subRecipes = LazyKeyed.of((key) =>
  [
    ...(gd.get().recipesByOutput.get(key) ?? []).map((r) => {
      const quantity =
        r.crafted_item_stacks.find((item) => referenceKey(item) === key)
          ?.quantity ?? 1;

      return { recipe: r, outputPerCraft: quantity };
    }),
    ...(gd.get().recipesByResolvedOutput.get(key) ?? []),
  ].filter((r) => !shouldSkipRecipe(r.recipe)),
);

export function buildPartialPlan(
  targets: CraftTarget[],
  inventory: Map<string, number>,
  initialDepth = 1,
): PartialPlan {
  const plan = PartialPlan.empty(inventory);

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

    const recipes = subRecipes.get(key);

    if (recipes.length === 0) {
      plan.addRaw(target.item_type, target.item_id, target.quantity);
      continue;
    }
    if (recipes.length === 1) {
      const { recipe, outputPerCraft } = recipes[0]!;

      plan.addRecipe(recipe, target.quantity / outputPerCraft, depth);

      continue;
    }

    const branches = recipes.map(({ recipe, outputPerCraft }) => {
      const branchPlan = PartialPlan.empty(next.inventory);

      branchPlan.addRecipe(recipe, target.quantity / outputPerCraft, depth);

      const branchNext = branchPlan.delta();
      if (branchNext.targets.length === 0) return branchPlan;
      branchPlan.addSubplan(
        buildPartialPlan(branchNext.targets, branchNext.inventory, depth + 1),
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
      recipe: GameCraftingRecipe;
      quantity: number;
      depth: number;
    }
  >();
  rawMaterials = new Map<
    string,
    {
      itemType: ItemType;
      itemId: number;
      quantity: number;
    }
  >();

  private constructor(private inventory: ReadonlyMap<string, number>) {}

  static empty(inventory: ReadonlyMap<string, number>): PartialPlan {
    return new this(inventory);
  }

  clone(): PartialPlan {
    const other = PartialPlan.empty(this.inventory);
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

  addRecipe(recipe: GameCraftingRecipe, quantity: number, depth: number) {
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
      this.rawMaterials.set(key, { itemType, itemId, quantity });
    }
  }

  addSubplan(other: PartialPlan) {
    for (const { recipe, quantity, depth } of other.recipes.values()) {
      this.addRecipe(recipe, quantity, depth);
    }
    for (const { itemType, itemId, quantity } of other.rawMaterials.values()) {
      this.addRaw(itemType, itemId, quantity);
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
      for (const item of recipe.consumed_item_stacks) {
        add(
          referenceKey(item),
          -Math.ceil(quantity * item.quantity * (item.consumption_chance ?? 1)),
        );
      }
      for (const item of realItemStack(recipe.crafted_item_stacks)) {
        add(
          referenceKey(item),
          Math.ceil(quantity * item.quantity * (item.consumption_chance ?? 1)),
        );
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
      totalEffort += quantity * recipe.stamina_requirement;
    }
    for (const { itemType, itemId, quantity } of this.rawMaterials.values()) {
      const extractionInfo = getExtractionInfo(itemType, itemId);
      const averageProbability =
        extractionInfo.resource_sources.length === 0
          ? 1
          : extractionInfo.resource_sources
              .map((s) => s.amount_per_stamina)
              .reduce((a, b) => a + b) / extractionInfo.resource_sources.length;
      totalEffort += quantity / averageProbability;
    }
    return totalEffort;
  }

  finalize(): CraftPlan {
    const available = new Map(this.inventory);
    const totalNeeded = new Map<string, number>();
    const plan: CraftPlan = {
      steps: [],
      already_have: [],
      raw_materials: [],
    };

    for (const { recipe, quantity, depth } of this.recipes.values()) {
      const buildingReq = recipe.building_requirement;
      plan.steps.push({
        craft_count: Math.ceil(quantity),
        effort_per_craft: recipe.stamina_requirement,
        recipe_id: recipe.id,
        recipe_name: recipe.name,
        building_type: buildingReq
          ? getBuildingTypeName(buildingReq.building_type)
          : "Any",
        building_tier: buildingReq?.tier ?? 0,
        skill_requirements: recipe.level_requirements.map((r) => ({
          skill: getSkillName(r.skill_id),
          level: r.level,
        })),
        tool_requirements: recipe.tool_requirements.map((r) => ({
          tool: getToolTypeName(r.tool_type),
          level: r.level,
        })),
        inputs: recipe.consumed_item_stacks.map((item): StepInput => {
          const itemKey = referenceKey(item);
          const totalAvailable = available.get(itemKey) ?? 0;
          const needed = Math.ceil(item.quantity * quantity);
          const used = Math.max(
            0,
            Math.min(Math.floor(totalAvailable), needed),
          );
          available.set(itemKey, totalAvailable - needed);
          totalNeeded.set(itemKey, (totalNeeded.get(itemKey) ?? 0) + needed);

          return {
            item_id: item.item_id,
            item_type: item.item_type,
            __item_key: itemKey,
            name: getItemName(item.item_type, item.item_id),
            quantity_per_craft: Math.floor(item.quantity),
            available: used,
            is_raw: this.rawMaterials.has(referenceKey(item)),
          };
        }),
        outputs: realItemStack(recipe.crafted_item_stacks).map(
          (item): StepOutput => ({
            item_id: item.item_id,
            item_type: item.item_type,
            quantity_per_craft: item.quantity,
            name: getItemName(item.item_type, item.item_id),
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
        const key = referenceKey(out);
        for (const inp of b.inputs) {
          if (referenceKey(inp) === key) return "a->b";
        }
      }
      // Does b produce something a needs? → b before a
      for (const out of b.outputs) {
        const key = referenceKey(out);
        for (const inp of a.inputs) {
          if (referenceKey(inp) === key) return "b->a";
        }
      }
      return null;
    });

    plan.steps.forEach((step, i, s) => {
      step.depth = s.length - i - 1;
    });

    for (const [
      key,
      { itemType, itemId, quantity },
    ] of this.rawMaterials.entries()) {
      const totalAvailable = this.inventory.get(key) ?? 0;
      const needed = totalNeeded.get(key) ?? Math.ceil(quantity);
      const used = Math.max(0, Math.min(totalAvailable, needed));
      available.set(key, totalAvailable - needed);

      const info = getItemInfo(itemType, itemId);
      const extractionInfo = getExtractionInfo(itemType, itemId);
      const averageProbability =
        extractionInfo.resource_sources.length === 0
          ? 1
          : extractionInfo.resource_sources
              .map((s) => s.amount_per_stamina)
              .reduce((a, b) => a + b) / extractionInfo.resource_sources.length;
      plan.raw_materials.push({
        item_id: itemId,
        item_type: itemType,
        name: info.name,
        tier: info.tier,
        tag: info.tag,
        likely_effort: Math.ceil(quantity / averageProbability),
        available: used,
        total_needed: needed,
        source: extractionInfo.source,
        skill_requirements: extractionInfo.skill_requirements,
        tool_requirements: extractionInfo.tool_requirements,
        resource_sources: extractionInfo.resource_sources,
      });
    }

    for (const inputKey of totalNeeded.keys()) {
      const remaining = available.get(inputKey) ?? 0;
      if (remaining >= 0) {
        const item = parseReferenceKey(inputKey);
        plan.already_have.push({
          ...item,
          name: getItemName(item.item_type, item.item_id),
          quantity: this.inventory.get(inputKey) ?? 0,
        });
      }
    }

    return plan;
  }
}

const extractionInfo = LazyKeyed.of((key) => {
  const { item_type, item_id } = parseReferenceKey(key);
  return getExtractionInfoInner(item_type, item_id);
});

function getExtractionInfo(itemType: ItemType, itemId: number) {
  return extractionInfo.get(`${itemType}:${itemId}`);
}

function getExtractionInfoInner(
  itemType: ItemType,
  itemId: number,
): {
  source: string;
  skill_requirements: { skill: string; level: number }[];
  tool_requirements: { tool: string; level: number }[];
  resource_sources: RawMaterialSource[];
} {
  const key = `${itemType}:${itemId}`;
  const extractions = gd.get().extractionByOutput.get(key);
  if (!extractions || extractions.length === 0) {
    return {
      source: "Obtain",
      skill_requirements: [],
      tool_requirements: [],
      resource_sources: [],
    };
  }

  // Use the first extraction recipe for skill/tool info (they're usually the same across all sources)
  const first = extractions[0]!;
  const source = first.verb_phrase || "Gather";
  const skill_requirements = first.level_requirements.map((r) => ({
    skill: getSkillName(r.skill_id),
    level: r.level,
  }));
  const tool_requirements = first.tool_requirements.map((t) => ({
    tool: getToolTypeName(t.tool_type),
    level: t.level,
  }));

  // Collect all unique world resource sources
  const seen = new Set<number>();
  const resource_sources: RawMaterialSource[] = [];
  for (const e of extractions) {
    if (seen.has(e.resource_id)) continue;
    seen.add(e.resource_id);
    const res = gd.get().resources.get(e.resource_id);
    if (res) {
      const realItemAmount = e.extracted_item_stacks
        .flatMap(({ item_stack, probability }) =>
          realItemStack([item_stack], probability),
        )
        .filter(
          (item_stack) =>
            item_stack.item_type === itemType && item_stack.item_id === itemId,
        )
        .map((p) => p.quantity)
        .reduce((a, b) => a + b);

      resource_sources.push({
        resource_name: res.name,
        verb: e.verb_phrase || "Gather",
        amount_per_stamina: realItemAmount,
      });
    }
  }

  return { source, skill_requirements, tool_requirements, resource_sources };
}

// ─── Item Search Helper ────────────────────────────────────────────────────────

export interface ItemSearchResult {
  item_id: number;
  item_type: ItemType;
  name: string;
  tier: number;
  tag: string;
}

export function searchItems(query: string, limit = 20): ItemSearchResult[] {
  const q = query.toLowerCase();
  const results: ItemSearchResult[] = [];

  for (const [id, item] of gd.get().items) {
    if (item.name.toLowerCase().includes(q)) {
      results.push({
        item_id: id,
        item_type: "Item",
        name: item.name,
        tier: item.tier,
        tag: item.tag,
      });
    }
    if (results.length >= limit * 2) break;
  }

  for (const [id, c] of gd.get().cargo) {
    if (c.name.toLowerCase().includes(q)) {
      results.push({
        item_id: id,
        item_type: "Cargo",
        name: c.name,
        tier: c.tier,
        tag: c.tag,
      });
    }
    if (results.length >= limit * 2) break;
  }

  return results
    .sort((a, b) => {
      const aExact = a.name.toLowerCase() === q ? 0 : 1;
      const bExact = b.name.toLowerCase() === q ? 0 : 1;
      if (aExact !== bExact) return aExact - bExact;
      const aStarts = a.name.toLowerCase().startsWith(q) ? 0 : 1;
      const bStarts = b.name.toLowerCase().startsWith(q) ? 0 : 1;
      if (aStarts !== bStarts) return aStarts - bStarts;
      return a.name.localeCompare(b.name);
    })
    .slice(0, limit);
}
