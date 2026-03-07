/**
 * Patches known issues in the BitCraft_Bindings submodules that prevent
 * the code from loading at runtime (e.g. duplicate exports).
 *
 * Run after `git submodule update --init` or any bindings update.
 */
import * as path from 'node:path';

const ROOT = path.dirname(import.meta.dirname);
const BINDINGS = ['global', 'region'] as const;

for (const binding of BINDINGS) {
  const indexPath = path.join(ROOT, 'bitcraft-bindings', binding, 'src', 'index.ts');
  let src: string;
  try {
    src = await Bun.file(indexPath).text();
  } catch {
    console.warn(`Skipping ${binding}: ${indexPath} not found`);
    continue;
  }

  const lines = src.split('\n');
  let patched = false;

  // Fix: duplicate `export { X }` lines — keep the first occurrence, remove later ones.
  const seenExports = new Set<string>();
  const filtered = lines.filter((line, i) => {
    const m = line.match(/^export \{ (\w+) \}/);
    if (m) {
      if (seenExports.has(m[1]!)) {
        console.log(`  [${binding}] Removed duplicate export: ${m[1]} (line ${i + 1})`);
        patched = true;
        return false;
      }
      seenExports.add(m[1]!);
    }
    return true;
  });

  // Remove orphaned imports whose export was removed
  // (e.g. `import { X } from "./*_reducer.ts"` when `export { X }` was deduped)
  const finalLines = filtered.filter((line, i) => {
    const m = line.match(/^import \{ (\w+) \} from "\.\/.*_reducer\.ts"/);
    if (m && !seenExports.has(m[1]!)) {
      // This import's export was the one that got removed — check if there's
      // no remaining export for this name
      const hasExport = filtered.some(l => l === `export { ${m[1]} };`);
      if (!hasExport) {
        console.log(`  [${binding}] Removed orphaned import: ${m[1]} (line ${i + 1})`);
        patched = true;
        return false;
      }
    }
    return true;
  });

  if (patched) {
    await Bun.file(indexPath).write(finalLines.join('\n'));
    console.log(`  [${binding}] Patched index.ts`);
  } else {
    console.log(`  [${binding}] No patches needed`);
  }
}
