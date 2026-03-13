#!/usr/bin/env bun
/**
 * Add GPL-3.0 copyright headers to source files.
 *
 * Usage: bun scripts/add-license-headers.ts [--check]
 *
 * --check  Don't modify files, just report which ones are missing headers.
 *          Exits with code 1 if any files are missing headers.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { globSync } from "node:fs";
import { relative } from "node:path";

const YEAR = new Date().getFullYear();
const AUTHOR = "Luiz Ferraz";
const PROJECT = "Ordum Dashboard";

const HEADER_LINES = [
  `Copyright (C) ${YEAR} ${AUTHOR}`,
  ``,
  `This file is part of ${PROJECT}.`,
  ``,
  `${PROJECT} is free software: you can redistribute it and/or modify`,
  `it under the terms of the GNU General Public License as published by`,
  `the Free Software Foundation, either version 3 of the License, or`,
  `(at your option) any later version.`,
  ``,
  `${PROJECT} is distributed in the hope that it will be useful,`,
  `but WITHOUT ANY WARRANTY; without even the implied warranty of`,
  `MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the`,
  `GNU General Public License for more details.`,
  ``,
  `You should have received a copy of the GNU General Public License`,
  `along with ${PROJECT}. If not, see <https://www.gnu.org/licenses/>.`,
];

// Comment style per file extension
const COMMENT_STYLES: Record<
  string,
  { start: string; line: string; end: string }
> = {
  ts: { start: "/**", line: " *", end: " */" },
  tsx: { start: "/**", line: " *", end: " */" },
  js: { start: "/**", line: " *", end: " */" },
  mjs: { start: "/**", line: " *", end: " */" },
  css: { start: "/**", line: " *", end: " */" },
  astro: { start: "/**", line: " *", end: " */" },
};

function buildHeader(ext: string): string {
  const style = COMMENT_STYLES[ext];
  if (!style) return "";

  const lines = [style.start];
  for (const l of HEADER_LINES) {
    lines.push(l ? `${style.line} ${l}` : style.line);
  }
  lines.push(style.end);
  return lines.join("\n") + "\n";
}

// Signature to detect existing headers (first meaningful line of the notice)
const SIGNATURE = `Copyright (C)`;

function hasHeader(content: string): boolean {
  // Check the first 30 lines for the copyright signature
  const head = content.split("\n").slice(0, 30).join("\n");
  return head.includes(SIGNATURE);
}

/**
 * Detect and strip an old-style HTML copyright comment from an .astro file.
 * Returns the content without the header, or null if no HTML header was found.
 */
function stripHtmlCopyrightHeader(content: string): string | null {
  const match = content.match(/^<!--[\s\S]*?Copyright \(C\)[\s\S]*?-->\n?/);
  if (!match) return null;
  return content.slice(match[0].length);
}

// ─── Main ──────────────────────────────────────────────────────────────────────

const checkOnly = process.argv.includes("--check");

const globs = [
  "src/**/*.ts",
  "src/**/*.tsx",
  "src/**/*.js",
  "src/**/*.mjs",
  "src/**/*.css",
  "src/**/*.astro",
  "scripts/**/*.ts",
  "scripts/**/*.sh",
];

// Exclude test files and generated files
const excludes = [
  "src/bitcraft-api-client.ts", // auto-generated
];

const files: string[] = [];
for (const pattern of globs) {
  const glob = new Bun.Glob(pattern);
  for (const f of glob.scanSync(".")) {
    if (!excludes.includes(f) && !f.includes("node_modules")) {
      files.push(f);
    }
  }
}

// Deduplicate and sort
const uniqueFiles = [...new Set(files)].sort();

let missing = 0;
let updated = 0;

for (const file of uniqueFiles) {
  const content = readFileSync(file, "utf-8");

  const ext = file.split(".").pop() ?? "";
  const rel = relative(process.cwd(), file);

  // For .astro files, check if there's an old HTML-style header that needs migrating
  if (ext === "astro") {
    const stripped = stripHtmlCopyrightHeader(content);
    if (stripped !== null) {
      // Has an old HTML header — migrate it to JS comment inside frontmatter
      missing++;
      if (checkOnly) {
        console.log(`  MIGRATE: ${rel}`);
        continue;
      }
      const header = buildHeader(ext);
      if (stripped.startsWith("---")) {
        const newline = stripped.indexOf("\n");
        const rest = stripped.slice(newline + 1);
        writeFileSync(file, "---\n" + header + rest);
      } else {
        writeFileSync(file, "---\n" + header + "---\n" + stripped);
      }
      updated++;
      console.log(`  MIGRATED: ${rel}`);
      continue;
    }
  }

  if (hasHeader(content)) continue;

  missing++;

  // Shell scripts
  if (ext === "sh") {
    const header =
      [
        `# ${HEADER_LINES[0]}`,
        ...HEADER_LINES.slice(1).map((l) => (l ? `# ${l}` : "#")),
      ].join("\n") + "\n";

    if (checkOnly) {
      console.log(`  MISSING: ${rel}`);
      continue;
    }

    // Preserve shebang
    if (content.startsWith("#!")) {
      const newline = content.indexOf("\n");
      const shebang = content.slice(0, newline + 1);
      const rest = content.slice(newline + 1);
      writeFileSync(file, shebang + "\n" + header + "\n" + rest);
    } else {
      writeFileSync(file, header + "\n" + content);
    }
    updated++;
    console.log(`  UPDATED: ${rel}`);
    continue;
  }

  const header = buildHeader(ext);
  if (!header) {
    console.log(`  SKIP (unknown ext): ${rel}`);
    continue;
  }

  if (checkOnly) {
    console.log(`  MISSING: ${rel}`);
    continue;
  }

  // For .astro files, place the JS comment inside the frontmatter fence
  // so that Prettier doesn't move it below the frontmatter.
  if (ext === "astro") {
    if (content.startsWith("---")) {
      // Insert after the opening ---
      const newline = content.indexOf("\n");
      const rest = content.slice(newline + 1);
      writeFileSync(file, "---\n" + header + rest);
    } else {
      // No frontmatter — wrap in one
      writeFileSync(file, "---\n" + header + "---\n" + content);
    }
  } else if (content.startsWith("#!")) {
    const newline = content.indexOf("\n");
    const shebang = content.slice(0, newline + 1);
    const rest = content.slice(newline + 1);
    writeFileSync(file, shebang + header + "\n" + rest);
  } else {
    writeFileSync(file, header + content);
  }
  updated++;
  console.log(`  UPDATED: ${rel}`);
}

console.log(
  `\n${uniqueFiles.length} files scanned, ${missing} missing headers${checkOnly ? "" : `, ${updated} updated`}.`,
);

if (checkOnly && missing > 0) {
  process.exit(1);
}
