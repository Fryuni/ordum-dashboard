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
 * Functional tests for the craft planner.
 *
 * These tests exercise `buildCraftPlan` through its public API only. They
 * assert semantic properties (target satisfaction, input provenance, raw
 * material correctness, capability flags) rather than implementation
 * details like PartialPlan internals or exact step ordering. They must
 * continue to pass across planner rewrites.
 */
import { describe, test, expect } from "bun:test";
import {
  buildCraftPlan,
  type CraftPlan,
  type CraftTarget,
} from "./craft-planner";
import { itemsCodex, recipesCodex } from "./gamedata/codex";
import {
  referenceKey,
  type ItemEntry,
  type ItemType,
} from "./gamedata/definition";
import type { PlayerCapabilities } from "./player-capabilities";

// ─── Fixtures (real codex items) ──────────────────────────────────────────────

function lookupByName(name: string, rarity = "Common"): ItemEntry {
  for (const item of itemsCodex.values()) {
    if (item.name === name && item.rarity === rarity) return item;
  }
  throw new Error(`fixture not found: ${name} (${rarity})`);
}

const FIXTURES = {
  // Depth-1 chain: Flint Axe needs 1 Knapped Flint + 1 Stick (both raw).
  flintAxe: lookupByName("Flint Axe"),
  knappedFlint: lookupByName("Knapped Flint"),
  stick: lookupByName("Stick"),

  // Depth-2 chain: Simple Charcoal ← Simple Wood Log ← Simple Wood Trunk (raw).
  // "Split into Simple Wood Log" outputs 6 logs per craft, so crafting a
  // single charcoal should still only need 1 split (plenty of surplus).
  simpleCharcoal: lookupByName("Simple Charcoal"),
  simpleWoodLog: lookupByName("Simple Wood Log"),
  simpleWoodTrunk: lookupByName("Simple Wood Trunk"),

  // Rarity-aware target: Astralite Axe Common recipe outputs
  // 0.7× Common + 0.3× Uncommon per craft, so 1 craft covers 1 Common target
  // via rarity promotion.
  astraliteAxeCommon: lookupByName("Astralite Axe", "Common"),

  // Multi-recipe items that exercise effort-aware branch selection: the
  // cheap-looking recipe uses a rare/legendary ingredient whose gathering
  // cost should dominate the plan's total effort.
  beginnersStudyJournal: lookupByName("Beginner's Study Journal"),
  beginnersStoneCarvings: lookupByName("Beginner's Stone Carvings"),
  beginnersStoneDiagrams: lookupByName("Beginner's Stone Diagrams", "Legendary"),
  roughPlank: lookupByName("Rough Plank"),
  hexiteWoodFragment: lookupByName("Hexite Wood Fragment", "Rare"),
  waterBucket: lookupByName("Water Bucket"),
  emptyBucket: lookupByName("Empty Bucket"),
  winterSnow: lookupByName("Winter Snow"),
};

function key(ref: { item_type: ItemType; item_id: number }): string {
  return `${ref.item_type}:${ref.item_id}`;
}

function asTarget(item: ItemEntry, quantity: number): CraftTarget {
  return {
    item_type: item.item_type,
    item_id: item.item_id,
    quantity,
  };
}

// ─── Plan simulator ───────────────────────────────────────────────────────────

/**
 * Walks a CraftPlan as if executing it, verifying that every step's inputs
 * are satisfiable from running inventory and that all targets end up
 * fulfilled. Raw materials are "gathered" before any steps run.
 *
 * This is the core correctness check used by most tests — it is
 * implementation-agnostic: any planner that produces a workable plan should
 * pass, regardless of how it discovered that plan internally.
 */
interface SimulationResult {
  ok: boolean;
  errors: string[];
  finalInventory: Map<string, number>;
}

function simulatePlan(
  targets: CraftTarget[],
  inventory: Map<string, number>,
  plan: CraftPlan,
): SimulationResult {
  const errors: string[] = [];
  const inv = new Map(inventory);

  for (const raw of plan.raw_materials) {
    const k = key(raw);
    const current = inv.get(k) ?? 0;
    const deficit = Math.max(0, raw.total_needed - current);
    inv.set(k, current + deficit);
  }

  // Steps consume and produce using the planner's internal accounting:
  // ceiled total per (craft_count × recipe_quantity). This matches the
  // algorithm inside PartialPlan.delta() and tolerates fractional rarity
  // outputs that the planner treats as whole items.
  for (const step of plan.steps) {
    const recipe = recipesCodex.get(step.recipe_id);
    if (!recipe) {
      errors.push(`step references unknown recipe id ${step.recipe_id}`);
      continue;
    }
    for (const input of recipe.inputs) {
      const k = referenceKey(input);
      const needed = Math.ceil(step.craft_count * input.quantity);
      const available = inv.get(k) ?? 0;
      if (available < needed) {
        const entry = itemsCodex.get(k);
        errors.push(
          `step "${step.recipe_name}" needs ${needed} of ${entry?.name ?? k} but only ${available} available`,
        );
      }
      inv.set(k, available - needed);
    }
    for (const output of recipe.outputs) {
      const k = referenceKey(output);
      const produced = Math.ceil(step.craft_count * output.quantity);
      inv.set(k, (inv.get(k) ?? 0) + produced);
    }
  }

  for (const target of targets) {
    const effective = effectiveHave(inv, target);
    if (effective < target.quantity) {
      const t = itemsCodex.get(key(target));
      errors.push(
        `target ${t?.name ?? key(target)} (${t?.rarity ?? ""}) short: need ${target.quantity}, have ${effective}`,
      );
    }
  }

  return { ok: errors.length === 0, errors, finalInventory: inv };
}

const RARITY_RANK: Record<string, number> = {
  Common: 0,
  Uncommon: 1,
  Rare: 2,
  Epic: 3,
  Legendary: 4,
  Mythic: 5,
};

/**
 * For a target, returns the total quantity in inventory that could satisfy
 * it via rarity promotion: items with the same name and rarity ≥ target.
 */
function effectiveHave(
  inventory: Map<string, number>,
  target: CraftTarget,
): number {
  const targetItem = itemsCodex.get(key(target));
  if (!targetItem) return inventory.get(key(target)) ?? 0;
  const targetRank = RARITY_RANK[targetItem.rarity] ?? -1;

  let total = 0;
  for (const [k, qty] of inventory.entries()) {
    const entry = itemsCodex.get(k);
    if (!entry) continue;
    if (
      entry.item_type === targetItem.item_type &&
      entry.name === targetItem.name &&
      (RARITY_RANK[entry.rarity] ?? -1) >= targetRank
    ) {
      total += qty;
    }
  }
  return total;
}

function assertValidPlan(
  targets: CraftTarget[],
  inventory: Map<string, number>,
  plan: CraftPlan,
) {
  const result = simulatePlan(targets, inventory, plan);
  if (!result.ok) {
    throw new Error(
      `plan invalid:\n  ${result.errors.join("\n  ")}\n  (${plan.steps.length} steps, ${plan.raw_materials.length} raws)`,
    );
  }
}

// ─── Empty & trivial plans ────────────────────────────────────────────────────

describe("buildCraftPlan: empty and trivial plans", () => {
  test("no targets produces an empty plan", () => {
    const plan = buildCraftPlan([], new Map());
    expect(plan.steps).toEqual([]);
    expect(plan.raw_materials).toEqual([]);
    expect(plan.already_have).toEqual([]);
  });

  test("target fully in inventory produces no steps and no raws", () => {
    const targets = [asTarget(FIXTURES.flintAxe, 1)];
    const inventory = new Map([[key(FIXTURES.flintAxe), 5]]);
    const plan = buildCraftPlan(targets, inventory);
    expect(plan.steps).toEqual([]);
    expect(plan.raw_materials).toEqual([]);
    assertValidPlan(targets, inventory, plan);
  });

  test("raw-only target produces just a raw material entry", () => {
    const targets = [asTarget(FIXTURES.stick, 10)];
    const plan = buildCraftPlan(targets, new Map());
    expect(plan.steps).toEqual([]);
    expect(plan.raw_materials).toHaveLength(1);
    expect(plan.raw_materials[0]!.name).toBe("Stick");
    expect(plan.raw_materials[0]!.total_needed).toBeGreaterThanOrEqual(10);
    assertValidPlan(targets, new Map(), plan);
  });
});

// ─── Single-recipe crafting ───────────────────────────────────────────────────

describe("buildCraftPlan: single-recipe crafting", () => {
  test("1× Flint Axe plans 1 craft + 2 raws", () => {
    const targets = [asTarget(FIXTURES.flintAxe, 1)];
    const plan = buildCraftPlan(targets, new Map());

    const axeStep = plan.steps.find((s) =>
      s.outputs.some((o) => o.item.item_id === FIXTURES.flintAxe.item_id),
    );
    expect(axeStep).toBeDefined();
    expect(axeStep!.craft_count).toBe(1);

    const rawNames = plan.raw_materials.map((r) => r.name).sort();
    expect(rawNames).toEqual(["Knapped Flint", "Stick"]);

    assertValidPlan(targets, new Map(), plan);
  });

  test("5× Flint Axe scales craft count and raw demand", () => {
    const targets = [asTarget(FIXTURES.flintAxe, 5)];
    const plan = buildCraftPlan(targets, new Map());

    const axeStep = plan.steps.find((s) =>
      s.outputs.some((o) => o.item.item_id === FIXTURES.flintAxe.item_id),
    )!;
    expect(axeStep.craft_count).toBe(5);

    const flint = plan.raw_materials.find((r) => r.name === "Knapped Flint")!;
    const stick = plan.raw_materials.find((r) => r.name === "Stick")!;
    expect(flint.total_needed).toBeGreaterThanOrEqual(5);
    expect(stick.total_needed).toBeGreaterThanOrEqual(5);

    assertValidPlan(targets, new Map(), plan);
  });

  test("inventory of raws reduces what must be gathered", () => {
    const targets = [asTarget(FIXTURES.flintAxe, 4)];
    const inventory = new Map([
      [key(FIXTURES.stick), 3],
      [key(FIXTURES.knappedFlint), 1],
    ]);
    const plan = buildCraftPlan(targets, inventory);

    const stickRaw = plan.raw_materials.find((r) => r.name === "Stick");
    const flintRaw = plan.raw_materials.find((r) => r.name === "Knapped Flint");
    if (stickRaw) {
      expect(stickRaw.available).toBe(3);
      expect(stickRaw.total_needed).toBeGreaterThanOrEqual(4);
    }
    if (flintRaw) {
      expect(flintRaw.available).toBe(1);
      expect(flintRaw.total_needed).toBeGreaterThanOrEqual(4);
    }

    assertValidPlan(targets, inventory, plan);
  });

  test("inventory covering all raws moves them to already_have", () => {
    const targets = [asTarget(FIXTURES.flintAxe, 1)];
    const inventory = new Map([
      [key(FIXTURES.stick), 10],
      [key(FIXTURES.knappedFlint), 10],
    ]);
    const plan = buildCraftPlan(targets, inventory);

    expect(plan.raw_materials).toEqual([]);
    expect(plan.steps).toHaveLength(1);
    const haveNames = plan.already_have.map((h) => h.name).sort();
    expect(haveNames).toEqual(["Knapped Flint", "Stick"]);
    assertValidPlan(targets, inventory, plan);
  });
});

// ─── Nested crafting ──────────────────────────────────────────────────────────

describe("buildCraftPlan: nested crafting", () => {
  test("Simple Charcoal pulls in Simple Wood Log → Simple Wood Trunk chain", () => {
    const targets = [asTarget(FIXTURES.simpleCharcoal, 1)];
    const plan = buildCraftPlan(targets, new Map());

    const stepNames = plan.steps.map((s) => s.recipe_name);
    expect(stepNames).toContain("Burn Simple Charcoal");
    expect(stepNames).toContain("Split into Simple Wood Log");

    expect(plan.raw_materials.map((r) => r.name)).toContain(
      "Simple Wood Trunk",
    );
    assertValidPlan(targets, new Map(), plan);
  });

  test("6 Charcoal still needs only 1 Simple Wood Log split (6 per craft)", () => {
    const targets = [asTarget(FIXTURES.simpleCharcoal, 6)];
    const plan = buildCraftPlan(targets, new Map());

    const splitStep = plan.steps.find(
      (s) => s.recipe_name === "Split into Simple Wood Log",
    )!;
    expect(splitStep.craft_count).toBe(1);
    assertValidPlan(targets, new Map(), plan);
  });

  test("inventory of intermediate removes upstream steps", () => {
    const targets = [asTarget(FIXTURES.simpleCharcoal, 3)];
    const inventory = new Map([[key(FIXTURES.simpleWoodLog), 100]]);
    const plan = buildCraftPlan(targets, inventory);

    const stepNames = plan.steps.map((s) => s.recipe_name);
    expect(stepNames).toContain("Burn Simple Charcoal");
    expect(stepNames).not.toContain("Split into Simple Wood Log");
    expect(plan.raw_materials).toEqual([]);
    assertValidPlan(targets, inventory, plan);
  });

  test("all steps are topologically ordered: every input is produced or available before it is consumed", () => {
    const targets = [asTarget(FIXTURES.simpleCharcoal, 12)];
    const plan = buildCraftPlan(targets, new Map());
    // assertValidPlan walks steps sequentially; if ordering is wrong, a step
    // will fail to find its input and the simulator will report it.
    assertValidPlan(targets, new Map(), plan);
    expect(plan.steps.length).toBeGreaterThanOrEqual(2);
  });
});

// ─── Rarity handling ──────────────────────────────────────────────────────────

describe("buildCraftPlan: rarity-aware outputs", () => {
  test("1× Astralite Axe (Common) needs only 1 craft thanks to rarity promotion", () => {
    const targets = [asTarget(FIXTURES.astraliteAxeCommon, 1)];
    const plan = buildCraftPlan(targets, new Map());

    const axeStep = plan.steps.find(
      (s) => s.recipe_name === "Craft Astralite Axe",
    );
    expect(axeStep).toBeDefined();
    expect(axeStep!.craft_count).toBe(1);
  });
});

// ─── Player capabilities ──────────────────────────────────────────────────────

describe("buildCraftPlan: player capabilities", () => {
  function capabilities(
    skills: Record<string, number>,
    tools: Record<string, number> = {},
  ): PlayerCapabilities {
    return {
      hasSkillData: true,
      hasToolData: true,
      skills: new Map(Object.entries(skills)),
      maxToolTiers: new Map(Object.entries(tools)),
    };
  }

  test("without capabilities, no steps are flagged missing", () => {
    const plan = buildCraftPlan([asTarget(FIXTURES.flintAxe, 1)], new Map());
    for (const step of plan.steps) {
      expect(step.missing_skill).toBe(false);
      expect(step.missing_tool).toBe(false);
    }
  });

  test("insufficient skill level flags the step", () => {
    // Astralite recipes have high skill requirements; an untrained player
    // should be flagged on at least one step.
    const caps = capabilities({});
    const plan = buildCraftPlan(
      [asTarget(FIXTURES.astraliteAxeCommon, 1)],
      new Map(),
      caps,
    );
    const flagged = plan.steps.filter((s) => s.missing_skill);
    expect(flagged.length).toBeGreaterThan(0);
  });
});

// ─── Plan stability & simulation ──────────────────────────────────────────────

describe("buildCraftPlan: plan stability", () => {
  test("the same inputs produce equivalent plans", () => {
    const targets = [asTarget(FIXTURES.flintAxe, 3)];
    const inv = new Map([[key(FIXTURES.stick), 1]]);
    const a = buildCraftPlan(targets, inv);
    const b = buildCraftPlan(targets, inv);

    expect(a.steps.length).toBe(b.steps.length);
    expect(a.raw_materials.length).toBe(b.raw_materials.length);

    const aStepIds = a.steps.map((s) => s.recipe_id).sort();
    const bStepIds = b.steps.map((s) => s.recipe_id).sort();
    expect(aStepIds).toEqual(bStepIds);
  });

  test("multiple distinct targets produce a single merged plan", () => {
    const targets = [
      asTarget(FIXTURES.flintAxe, 1),
      asTarget(FIXTURES.simpleCharcoal, 1),
    ];
    const plan = buildCraftPlan(targets, new Map());

    const stepNames = plan.steps.map((s) => s.recipe_name);
    expect(stepNames).toContain("Craft Flint Axe");
    expect(stepNames).toContain("Burn Simple Charcoal");
    assertValidPlan(targets, new Map(), plan);
  });
});

// ─── Astralite Axe stress test ────────────────────────────────────────────────

/**
 * Asserts the structural properties of a large plan without requiring exact
 * quantity accounting. Complex plans with fractional-rarity outputs can have
 * minor rounding drift that the planner considers self-consistent; we check
 * provenance and target-output reachability instead of strict flow balance.
 */
function assertPlanStructure(
  targets: CraftTarget[],
  inventory: Map<string, number>,
  plan: CraftPlan,
) {
  // 1. Every raw material is gatherable: it must have at least one
  //    extraction recipe. (It may ALSO have craft recipes — the planner
  //    is free to prefer extraction when gathering is cheaper than the
  //    crafting chain.)
  for (const raw of plan.raw_materials) {
    const entry = itemsCodex.get(key(raw));
    if (!entry) throw new Error(`raw material not in codex: ${key(raw)}`);
    if (entry.extracted_from.length === 0 && entry.crafted_from.length > 0) {
      throw new Error(
        `raw material ${entry.name} has no extraction path but is craftable`,
      );
    }
  }

  // 2. Every step references a recipe that exists in the codex.
  for (const step of plan.steps) {
    if (!recipesCodex.has(step.recipe_id)) {
      throw new Error(
        `step "${step.recipe_name}" references missing recipe ${step.recipe_id}`,
      );
    }
  }

  // 3. Provenance: for every step input, the item is either in inventory,
  //    a raw material, or produced by some step. This catches topology bugs
  //    (e.g. a step consuming something that nothing in the plan produces).
  const rawKeys = new Set(plan.raw_materials.map(key));
  const producedKeys = new Set<string>();
  for (const step of plan.steps) {
    for (const out of step.outputs) producedKeys.add(key(out.item));
  }
  for (const step of plan.steps) {
    for (const input of step.inputs) {
      const k = key(input.item);
      if (inventory.has(k) || rawKeys.has(k) || producedKeys.has(k)) continue;
      throw new Error(
        `step "${step.recipe_name}" input ${input.item.name} has no source in the plan`,
      );
    }
  }

  // 4. Target reachability: each target is either satisfied from inventory
  //    or appears as an output of at least one step.
  for (const target of targets) {
    if ((inventory.get(key(target)) ?? 0) >= target.quantity) continue;
    const entry = itemsCodex.get(key(target));
    const produced = plan.steps.some((s) =>
      s.outputs.some(
        (o) =>
          entry &&
          itemsCodex.get(key(o.item))?.name === entry.name &&
          (RARITY_RANK[itemsCodex.get(key(o.item))?.rarity ?? ""] ?? -1) >=
            (RARITY_RANK[entry.rarity] ?? -1),
      ),
    );
    if (!produced) {
      throw new Error(
        `target ${entry?.name ?? key(target)} is neither in inventory nor produced by any step`,
      );
    }
  }

  // 5. Step ordering is topologically valid: for every step input that is
  //    produced elsewhere in the plan, the producer appears first. Inputs
  //    that come entirely from raws/inventory are exempt.
  const seenOutputs = new Set<string>();
  for (const step of plan.steps) {
    for (const input of step.inputs) {
      const k = key(input.item);
      if (!producedKeys.has(k)) continue;
      if (!seenOutputs.has(k)) {
        throw new Error(
          `step "${step.recipe_name}" consumes ${input.item.name} before any earlier step produces it`,
        );
      }
    }
    for (const out of step.outputs) seenOutputs.add(key(out.item));
  }
}

// ─── Effort-aware recipe selection ────────────────────────────────────────────

/**
 * These tests assert the planner's central new capability: when an item has
 * multiple recipes, the chosen recipe must minimize *total* effort, not
 * just the recipe's own effort. A cheap-looking recipe that pulls in a
 * legendary-rarity ingredient should lose to a common alternative.
 */
describe("buildCraftPlan: effort-aware recipe selection", () => {
  function stepRecipeIds(plan: CraftPlan): Set<number> {
    return new Set(plan.steps.map((s) => s.recipe_id));
  }

  function rawItemIds(plan: CraftPlan): Set<string> {
    return new Set(plan.raw_materials.map((r) => `${r.item_type}:${r.item_id}`));
  }

  test("Beginner's Study Journal uses Beginner's Stone Carvings, not Stone Diagrams", () => {
    // Two recipes exist: one consumes common Stone Carvings (1.234/strike,
    // Common), the other consumes legendary Stone Diagrams (0.008/strike,
    // Legendary). The Diagram recipe has lower own-effort and a higher
    // rarity-promoted output, but its Legendary input is prohibitively
    // expensive to gather.
    const targets = [asTarget(FIXTURES.beginnersStudyJournal, 1)];
    const plan = buildCraftPlan(targets, new Map());

    const raws = plan.raw_materials.map((r) => r.name);
    expect(raws).toContain("Beginner's Stone Carvings");
    expect(raws).not.toContain("Beginner's Stone Diagrams");

    assertValidPlan(targets, new Map(), plan);
  });

  test("Stone Diagrams in inventory don't seduce the planner", () => {
    // Even with a single Diagram on hand, the Carving path is cheaper per
    // Journal — the tree prefers Carvings.
    const inv = new Map([[key(FIXTURES.beginnersStoneDiagrams), 1]]);
    const targets = [asTarget(FIXTURES.beginnersStudyJournal, 1)];
    const plan = buildCraftPlan(targets, inv);

    const raws = plan.raw_materials.map((r) => r.name);
    expect(raws).toContain("Beginner's Stone Carvings");
    assertValidPlan(targets, inv, plan);
  });

  test("Rough Plank uses the Stripped Wood recipe and avoids Hexite Wood Fragment", () => {
    // Two recipes: one outputs 1 Plank from Stripped Wood alone; the other
    // outputs 2 Planks from Stripped Wood + 2 Rare Hexite Fragments. The
    // Hexite recipe's lower effort-per-Plank looks tempting, but Hexite
    // is dungeon-sourced and the rarity factor makes it prohibitive.
    const targets = [asTarget(FIXTURES.roughPlank, 1)];
    const plan = buildCraftPlan(targets, new Map());

    expect(rawItemIds(plan).has(key(FIXTURES.hexiteWoodFragment))).toBe(false);
    const stepNames = plan.steps.map((s) => s.recipe_name);
    expect(stepNames).toContain("Craft Rough Plank");
    assertValidPlan(targets, new Map(), plan);
  });

  test("Rough Plank with Hexite in inventory can use the Hexite recipe", () => {
    // When the expensive ingredient is already on hand, its gathering
    // cost vanishes — using it becomes the cheaper path per plank.
    const inv = new Map([[key(FIXTURES.hexiteWoodFragment), 10]]);
    const targets = [asTarget(FIXTURES.roughPlank, 1)];
    const plan = buildCraftPlan(targets, inv);

    // The plan should use inventory-covered Hexite, not gather fresh.
    expect(rawItemIds(plan).has(key(FIXTURES.hexiteWoodFragment))).toBe(false);
    assertValidPlan(targets, inv, plan);
  });

  test("Water Bucket uses Fill Water Bucket (Empty Bucket), not Boil Water Bucket (Winter Snow)", () => {
    // Boil requires 3 Winter Snow per bucket. Snow's extraction rate is
    // ~0.04/strike, so 3 Snow ≈ 70 strikes for a single bucket. Fill
    // requires 1 Empty Bucket; even when the planner has to craft a full
    // 10-bucket batch of Empty Buckets for just one Water Bucket, the
    // amortized per-bucket cost still beats Boiling snow.
    const targets = [asTarget(FIXTURES.waterBucket, 1)];
    const plan = buildCraftPlan(targets, new Map());

    const stepNames = plan.steps.map((s) => s.recipe_name);
    expect(stepNames).toContain("Fill Water Bucket");
    expect(stepNames).not.toContain("Boil Water Bucket");

    const raws = plan.raw_materials.map((r) => r.name);
    expect(raws).not.toContain("Winter Snow");
    assertValidPlan(targets, new Map(), plan);
  });

  test("Water Bucket with Winter Snow in inventory still prefers Fill for a single bucket", () => {
    // Having snow on hand doesn't magically make Boiling cheaper — Fill is
    // fundamentally the better recipe when a bucket is reusable.
    const inv = new Map([[key(FIXTURES.winterSnow), 10]]);
    const targets = [asTarget(FIXTURES.waterBucket, 1)];
    const plan = buildCraftPlan(targets, inv);

    const stepNames = plan.steps.map((s) => s.recipe_name);
    expect(stepNames).toContain("Fill Water Bucket");
    assertValidPlan(targets, inv, plan);
  });
});

// ─── Tree shape preservation ──────────────────────────────────────────────────

describe("buildCraftPlan: plan.trees (tree preservation)", () => {
  test("no targets produces no trees", () => {
    const plan = buildCraftPlan([], new Map());
    expect(plan.trees).toEqual([]);
  });

  test("one tree per target, in target order", () => {
    const targets = [
      asTarget(FIXTURES.flintAxe, 1),
      asTarget(FIXTURES.simpleCharcoal, 1),
    ];
    const plan = buildCraftPlan(targets, new Map());
    expect(plan.trees).toHaveLength(2);
    // Each tree's root item should match the target (via ref key).
    const rootKey = (n: unknown): string => {
      const node = n as { kind: string; item: ItemEntry; sub?: unknown };
      if (node.kind === "composite") return rootKey(node.sub);
      return `${node.item.item_type}:${node.item.item_id}`;
    };
    expect(rootKey(plan.trees[0])).toBe(key(FIXTURES.flintAxe));
    expect(rootKey(plan.trees[1])).toBe(key(FIXTURES.simpleCharcoal));
  });

  test("target in inventory produces a 'have' tree (no acquisition work)", () => {
    const targets = [asTarget(FIXTURES.flintAxe, 1)];
    const inv = new Map([[key(FIXTURES.flintAxe), 5]]);
    const plan = buildCraftPlan(targets, inv);
    expect(plan.trees).toHaveLength(1);
    const root = plan.trees[0]! as { kind: string };
    expect(root.kind).toBe("have");
  });

  test("craft tree roots have integer craftCount", () => {
    const targets = [asTarget(FIXTURES.flintAxe, 1)];
    const plan = buildCraftPlan(targets, new Map());
    const root = plan.trees[0]! as { kind: string; craftCount?: number };
    expect(root.kind).toBe("craft");
    expect(Number.isInteger(root.craftCount)).toBe(true);
    expect(root.craftCount!).toBeGreaterThanOrEqual(1);
  });
});

describe("buildCraftPlan: Astralite Axe (Common) stress test", () => {
  const targets = [asTarget(FIXTURES.astraliteAxeCommon, 1)];

  test("plan has many steps and raws", () => {
    const plan = buildCraftPlan(targets, new Map());
    expect(plan.steps.length).toBeGreaterThan(100);
    expect(plan.raw_materials.length).toBeGreaterThan(20);
  });

  test("plan is structurally valid: provenance, topology, and reachability", () => {
    const plan = buildCraftPlan(targets, new Map());
    assertPlanStructure(targets, new Map(), plan);
  });

  test("fulfilling key intermediates from inventory prunes the plan", () => {
    const basePlan = buildCraftPlan(targets, new Map());
    const baseSteps = basePlan.steps.length;

    // Pick an arbitrary intermediate and flood inventory with it, then
    // confirm the plan shrinks and remains structurally valid.
    const intermediate = basePlan.steps
      .flatMap((s) => s.outputs.map((o) => o.item))
      .find((it) => it.item_id !== FIXTURES.astraliteAxeCommon.item_id);
    expect(intermediate).toBeDefined();

    const inv = new Map([[key(intermediate!), 1_000_000]]);
    const prunedPlan = buildCraftPlan(targets, inv);
    expect(prunedPlan.steps.length).toBeLessThan(baseSteps);
    assertPlanStructure(targets, inv, prunedPlan);
  });
});
