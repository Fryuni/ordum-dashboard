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
import { describe, test, expect } from "bun:test";
import { topologicalSort } from "./topological-sort";

describe("topologicalSort", () => {
  test("empty list", () => {
    const result = topologicalSort([], () => null);
    expect(result).toEqual([]);
  });

  test("single element", () => {
    const result = topologicalSort(["a"], () => null);
    expect(result).toEqual(["a"]);
  });

  test("no constraints preserves original order", () => {
    const result = topologicalSort(["a", "b", "c"], () => null);
    expect(result).toEqual(["a", "b", "c"]);
  });

  test("simple linear chain: a -> b -> c", () => {
    const order: Record<string, number> = { a: 0, b: 1, c: 2 };
    const result = topologicalSort(["c", "a", "b"], (a, b) => {
      if (order[a]! < order[b]!) return "a->b";
      if (order[b]! < order[a]!) return "b->a";
      return null;
    });
    expect(result.indexOf("a")).toBeLessThan(result.indexOf("b"));
    expect(result.indexOf("b")).toBeLessThan(result.indexOf("c"));
  });

  test("reverse input is correctly sorted", () => {
    const items = [5, 4, 3, 2, 1];
    const result = topologicalSort(items, (a, b) => {
      if (a < b) return "a->b";
      if (b < a) return "b->a";
      return null;
    });
    expect(result).toEqual([1, 2, 3, 4, 5]);
  });

  test("diamond dependency: a -> b, a -> c, b -> d, c -> d", () => {
    type Step = { name: string; deps: string[] };
    const steps: Step[] = [
      { name: "d", deps: ["b", "c"] },
      { name: "b", deps: ["a"] },
      { name: "c", deps: ["a"] },
      { name: "a", deps: [] },
    ];
    const result = topologicalSort(steps, (a, b) => {
      if (b.deps.includes(a.name)) return "a->b";
      if (a.deps.includes(b.name)) return "b->a";
      return null;
    });
    const names = result.map((s) => s.name);
    expect(names.indexOf("a")).toBeLessThan(names.indexOf("b"));
    expect(names.indexOf("a")).toBeLessThan(names.indexOf("c"));
    expect(names.indexOf("b")).toBeLessThan(names.indexOf("d"));
    expect(names.indexOf("c")).toBeLessThan(names.indexOf("d"));
  });

  test("simple cycle: a -> b -> a groups them together", () => {
    const result = topologicalSort(["a", "b"], (a, b) => {
      // a -> b and b -> a (cycle)
      if (a === "a" && b === "b") return "a->b";
      if (a === "b" && b === "a") return "a->b";
      return null;
    });
    // Both should be present, order within cycle is by original position
    expect(result).toHaveLength(2);
    expect(result).toContain("a");
    expect(result).toContain("b");
  });

  test("cycle with external dependency: x -> [a <-> b] -> y", () => {
    // x must come before a and b (which form a cycle), y must come after
    const items = ["y", "b", "a", "x"];
    const result = topologicalSort(items, (a, b) => {
      // x -> a, x -> b
      if (a === "x" && (b === "a" || b === "b")) return "a->b";
      if (b === "x" && (a === "a" || a === "b")) return "b->a";
      // a <-> b (cycle)
      if (a === "a" && b === "b") return "a->b";
      if (a === "b" && b === "a") return "a->b";
      // a -> y, b -> y
      if ((a === "a" || a === "b") && b === "y") return "a->b";
      if ((b === "a" || b === "b") && a === "y") return "b->a";
      return null;
    });
    expect(result.indexOf("x")).toBeLessThan(result.indexOf("a"));
    expect(result.indexOf("x")).toBeLessThan(result.indexOf("b"));
    expect(result.indexOf("a")).toBeLessThan(result.indexOf("y"));
    expect(result.indexOf("b")).toBeLessThan(result.indexOf("y"));
  });

  test("independent groups maintain original order", () => {
    // Two independent chains: 1->2->3, 4->5->6
    const items = [3, 6, 1, 4, 2, 5];
    const result = topologicalSort(items, (a, b) => {
      // Chain 1: 1->2->3
      if (a === 1 && b === 2) return "a->b";
      if (a === 2 && b === 3) return "a->b";
      if (a === 1 && b === 3) return "a->b";
      // Chain 2: 4->5->6
      if (a === 4 && b === 5) return "a->b";
      if (a === 5 && b === 6) return "a->b";
      if (a === 4 && b === 6) return "a->b";
      // Reverse
      if (b === 1 && a === 2) return "b->a";
      if (b === 2 && a === 3) return "b->a";
      if (b === 1 && a === 3) return "b->a";
      if (b === 4 && a === 5) return "b->a";
      if (b === 5 && a === 6) return "b->a";
      if (b === 4 && a === 6) return "b->a";
      return null;
    });
    expect(result.indexOf(1)).toBeLessThan(result.indexOf(2));
    expect(result.indexOf(2)).toBeLessThan(result.indexOf(3));
    expect(result.indexOf(4)).toBeLessThan(result.indexOf(5));
    expect(result.indexOf(5)).toBeLessThan(result.indexOf(6));
  });

  test("crafting scenario: raw -> intermediate -> final", () => {
    interface CraftStep {
      name: string;
      inputs: string[];
      outputs: string[];
    }
    const steps: CraftStep[] = [
      { name: "make ring", inputs: ["sapphire", "ingot"], outputs: ["ring"] },
      { name: "cut gem", inputs: ["uncut"], outputs: ["sapphire"] },
      { name: "forge", inputs: ["molten"], outputs: ["ingot"] },
      { name: "smelt", inputs: ["ore", "wood"], outputs: ["molten"] },
    ];
    const result = topologicalSort(steps, (a, b) => {
      // a produces something b needs → a before b
      for (const out of a.outputs) {
        if (b.inputs.includes(out)) return "a->b";
      }
      for (const out of b.outputs) {
        if (a.inputs.includes(out)) return "b->a";
      }
      return null;
    });
    const names = result.map((s) => s.name);
    expect(names.indexOf("cut gem")).toBeLessThan(names.indexOf("make ring"));
    expect(names.indexOf("smelt")).toBeLessThan(names.indexOf("forge"));
    expect(names.indexOf("forge")).toBeLessThan(names.indexOf("make ring"));
  });

  test("does not mutate input array", () => {
    const input = [3, 1, 2];
    const copy = [...input];
    topologicalSort(input, (a, b) => {
      if (a < b) return "a->b";
      if (b < a) return "b->a";
      return null;
    });
    expect(input).toEqual(copy);
  });

  test("large cycle is handled without error", () => {
    // All items in a single big cycle: 0->1->2->...->9->0
    const items = Array.from({ length: 10 }, (_, i) => i);
    const result = topologicalSort(items, (a, b) => {
      if ((a + 1) % 10 === b) return "a->b";
      if ((b + 1) % 10 === a) return "b->a";
      return null;
    });
    expect(result).toHaveLength(10);
    expect(new Set(result).size).toBe(10);
  });
});
