/**
 * Generic topological sort with cycle handling.
 *
 * Uses Tarjan's SCC algorithm to identify cycles, then Kahn's algorithm
 * on the condensed DAG of strongly connected components.
 *
 * @param list      Items to sort
 * @param compareFn For each pair (a, b), return:
 *                  - `'a->b'` if a must come before b
 *                  - `'b->a'` if b must come before a
 *                  - `null`   if no ordering constraint
 * @returns A new array in topological order. Items within a cycle are
 *          grouped together in their original relative order.
 */
export function topologicalSort<T>(
  list: T[],
  compareFn: (a: T, b: T) => "a->b" | "b->a" | null,
): T[] {
  const n = list.length;
  if (n <= 1) return [...list];

  // Build adjacency sets from pairwise comparisons
  const adj: Set<number>[] = Array.from({ length: n }, () => new Set());
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const result = compareFn(list[i]!, list[j]!);
      switch (result) {
        case "a->b":
          adj[i]!.add(j);
          break;
        case "b->a":
          adj[j]!.add(i);
          break;
      }
    }
  }

  // Tarjan's SCC algorithm
  const sccOf = new Array<number>(n).fill(-1);
  const sccs: number[][] = [];
  {
    let index = 0;
    const stack: number[] = [];
    const onStack = new Array<boolean>(n).fill(false);
    const indices = new Array<number>(n).fill(-1);
    const lowlinks = new Array<number>(n).fill(-1);

    function strongconnect(v: number) {
      indices[v] = lowlinks[v] = index++;
      stack.push(v);
      onStack[v] = true;

      for (const w of adj[v]!) {
        if (indices[w] === -1) {
          strongconnect(w);
          lowlinks[v] = Math.min(lowlinks[v]!, lowlinks[w]!);
        } else if (onStack[w]!) {
          lowlinks[v] = Math.min(lowlinks[v]!, indices[w]!);
        }
      }

      if (lowlinks[v] === indices[v]) {
        const scc: number[] = [];
        let w: number;
        do {
          w = stack.pop()!;
          onStack[w] = false;
          sccOf[w] = sccs.length;
          scc.push(w);
        } while (w !== v);
        sccs.push(scc);
      }
    }

    for (let i = 0; i < n; i++) {
      if (indices[i] === -1) strongconnect(i);
    }
  }

  // Build condensed DAG over SCCs
  const sccCount = sccs.length;
  const sccAdj: Set<number>[] = Array.from(
    { length: sccCount },
    () => new Set(),
  );
  const sccInDeg = new Array<number>(sccCount).fill(0);

  for (let i = 0; i < n; i++) {
    for (const j of adj[i]!) {
      const si = sccOf[i]!;
      const sj = sccOf[j]!;
      if (si !== sj && !sccAdj[si]!.has(sj)) {
        sccAdj[si]!.add(sj);
        sccInDeg[sj]!++;
      }
    }
  }

  // Kahn's algorithm on the condensed DAG
  const sccOrder: number[] = [];
  const sccQueue: number[] = [];
  for (let i = 0; i < sccCount; i++) {
    if (sccInDeg[i] === 0) sccQueue.push(i);
  }

  while (sccQueue.length > 0) {
    // Stable: dequeue the first ready SCC (lowest index among peers)
    sccQueue.sort((a, b) => a - b);
    const si = sccQueue.shift()!;
    sccOrder.push(si);

    for (const sj of sccAdj[si]!) {
      sccInDeg[sj]!--;
      if (sccInDeg[sj] === 0) sccQueue.push(sj);
    }
  }

  // Flatten: for each SCC in topological order, emit its members
  // preserving their original relative order from the input list.
  const result: T[] = [];
  for (const si of sccOrder) {
    const members = sccs[si]!.sort((a, b) => a - b);
    for (const idx of members) {
      result.push(list[idx]!);
    }
  }

  return result;
}
