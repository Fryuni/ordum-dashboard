#!/usr/bin/env bun
/**
 * Bitcraft Hub API Client Generator
 *
 * Fetches the Rust API source from GitHub, parses routes and types,
 * and generates a fully-typed TypeScript API client.
 *
 * Usage:
 *   bun run generate-api-client.ts [--output ./src/bitcraft-api-client.ts] [--branch main]
 */

import * as fs from "fs";
import * as path from "path";

// ─── Configuration ───────────────────────────────────────────────────────────

const REPO_OWNER = "ResuBaka";
const REPO_NAME = "bitcraft-hub";
const API_SRC_PATH = "rust/api-server/api/src";
const DEFAULT_BRANCH = "main";
const DEFAULT_OUTPUT = path.join(import.meta.dirname, '..', "src", "bitcraft-api-client.ts");

// Modules that only contain internal/websocket/event logic, not HTTP routes
const SKIP_MODULES = new Set([
  "websocket",
  "reducer_event_handler",
  "config",
  "cargo_desc",
  "claim_tech_desc",
  "claim_tech_state",
  "collectible_desc",
  "crafting_recipe_desc",
  "deployable_state",
  "item_list_desc",
  "location_state",
  "locations",
  "mobile_entity_state",
  "npc_desc",
  "player_state", // sub-modules only, but get_routes is in mod.rs - keep if it has routes
  "resource_desc",
  "skill_descriptions",
  "traveler_task_desc",
  "traveler_task_state",
  "user_state",
  "vault_state",
]);

// Struct names that are internal and should not be emitted as API types
const SKIP_STRUCTS = new Set([
  "Cli",
  "Commands",
  "ServerInstance",
  "AppState",
  "ClientsState",
  "WebSocketMessages",
  "RankingSystem",
  "Leaderboard",
  "LeaderboardEntry",
  "BucketDistribution",
  "QueryWebsocketOptions",
  "Config",
]);

function parseArgs(): { output: string; branch: string } {
  const args = process.argv.slice(2);
  let output = DEFAULT_OUTPUT;
  let branch = DEFAULT_BRANCH;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--output" && args[i + 1]) output = path.resolve(args[++i]);
    else if (args[i] === "--branch" && args[i + 1]) branch = args[++i];
  }
  return { output, branch };
}

// ─── GitHub Fetcher ──────────────────────────────────────────────────────────

function rawUrl(branch: string, filePath: string): string {
  return `https://raw.githubusercontent.com/${REPO_OWNER}/${REPO_NAME}/${branch}/${filePath}`;
}

async function fetchFile(branch: string, filePath: string): Promise<string | null> {
  const res = await fetch(rawUrl(branch, filePath));
  return res.ok ? res.text() : null;
}

async function fetchModuleNames(branch: string): Promise<string[]> {
  const url = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${API_SRC_PATH}?ref=${branch}`;
  const res = await fetch(url, { headers: { Accept: "application/vnd.github.v3+json" } });
  if (!res.ok) throw new Error(`Failed to list ${API_SRC_PATH}: ${res.status}`);
  const items: { name: string; type: string }[] = (await res.json()) as any;
  return items.filter((i) => i.type === "dir").map((i) => i.name);
}

// ─── Bracket-Aware Utilities ─────────────────────────────────────────────────

/** Find the matching close bracket starting after the open bracket at `start`. */
function findMatchingBracket(
  src: string,
  start: number,
  open = "{",
  close = "}"
): number {
  let depth = 1;
  for (let i = start + 1; i < src.length; i++) {
    if (src[i] === open) depth++;
    else if (src[i] === close) { depth--; if (depth === 0) return i; }
  }
  return -1;
}

/** Extract the balanced content of a generic: given "HashMap<K, V>" returns "K, V" */
function extractGenericInner(typeStr: string): string | null {
  const lt = typeStr.indexOf("<");
  if (lt === -1) return null;
  let depth = 1;
  for (let i = lt + 1; i < typeStr.length; i++) {
    if (typeStr[i] === "<") depth++;
    if (typeStr[i] === ">") { depth--; if (depth === 0) return typeStr.substring(lt + 1, i); }
  }
  return null;
}

/** Split on commas at depth 0 (respecting <> and ()). */
function splitTopLevel(s: string, sep = ","): string[] {
  const parts: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < s.length; i++) {
    if (s[i] === "<" || s[i] === "(") depth++;
    if (s[i] === ">" || s[i] === ")") depth--;
    if (s[i] === sep && depth === 0) {
      parts.push(s.substring(start, i).trim());
      start = i + 1;
    }
  }
  parts.push(s.substring(start).trim());
  return parts.filter(Boolean);
}

/** Extract the body between the first `{` and its matching `}` starting from a position in `src`. */
function extractBracedBody(src: string, from: number): string | null {
  const openIdx = src.indexOf("{", from);
  if (openIdx === -1) return null;
  const closeIdx = findMatchingBracket(src, openIdx);
  if (closeIdx === -1) return null;
  return src.substring(openIdx + 1, closeIdx);
}

// ─── Rust Type Parser ────────────────────────────────────────────────────────

/** Read a full Rust type starting at `pos` in `line`, stopping at `,` or end-of-line at depth 0. */
function readRustType(line: string, pos: number): string {
  let depth = 0;
  let end = pos;
  for (; end < line.length; end++) {
    const c = line[end];
    if (c === "<" || c === "(") depth++;
    if (c === ">" || c === ")") depth--;
    if (depth === 0 && (c === "," || c === "\n")) break;
    if (depth < 0) break; // hit an outer closing bracket
  }
  return line.substring(pos, end).trim().replace(/,$/, "").trim();
}

// ─── Rust Source Parsers ─────────────────────────────────────────────────────

interface ParsedRoute {
  httpMethod: string;
  path: string;
  handlerName: string;
}

interface ParsedHandler {
  name: string;
  returnType: string;
  pathParamType: string | null;
  pathParamName: string | null;
  queryParamType: string | null;
}

interface ParsedField {
  name: string;
  rustType: string;
  serdeRename: string | null;
}

interface ParsedStruct {
  name: string;
  fields: ParsedField[];
  isEnum: boolean;
  enumVariants: { name: string; innerType: string | null }[];
  serdeTag: string | null;
  serdeUntagged: boolean;
}

interface ParsedQueryStruct {
  name: string;
  fields: { name: string; rustType: string; optional: boolean }[];
}

interface ParsedRouteWithModule extends ParsedRoute {
  moduleName?: string;
}

function parseRoutes(src: string, prefix = ""): ParsedRoute[] {
  return parseRoutesWithModule(src, prefix);
}

function parseRoutesWithModule(src: string, prefix = ""): ParsedRouteWithModule[] {
  const routes: ParsedRouteWithModule[] = [];
  const re = /\.route\(\s*"([^"]+)"\s*,\s*axum_codec::routing::(get|post|put|delete|patch)\(([^)]+)\)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src)) !== null) {
    const handler = m[3].trim();
    const parts = handler.split("::");
    const handlerName = parts.pop()!;
    // If handler is module::fn_name, capture the module name
    const moduleName = parts.length > 0 ? parts[0] : undefined;

    routes.push({
      httpMethod: m[2].toUpperCase(),
      path: prefix + m[1],
      handlerName,
      moduleName,
    });
  }
  return routes;
}

function parseHandlers(src: string): ParsedHandler[] {
  const handlers: ParsedHandler[] = [];
  // Find `async fn name(` — then read arguments up to `)` respecting brackets, then `->` return type
  const fnRe = /(?:pub(?:\(crate\))?\s+)?async\s+fn\s+(\w+)\s*\(/g;
  let m: RegExpExecArray | null;

  while ((m = fnRe.exec(src)) !== null) {
    const name = m[1];
    const argsStart = m.index + m[0].length;

    // Find the matching ) for the argument list
    let depth = 1;
    let argsEnd = argsStart;
    for (; argsEnd < src.length && depth > 0; argsEnd++) {
      if (src[argsEnd] === "(") depth++;
      if (src[argsEnd] === ")") depth--;
    }
    const args = src.substring(argsStart, argsEnd - 1);

    // Find `->` and then the return type up to the `{`
    const afterArgs = src.substring(argsEnd, Math.min(argsEnd + 500, src.length));
    const arrowIdx = afterArgs.indexOf("->");
    if (arrowIdx === -1) continue;

    const retStart = arrowIdx + 2;
    const braceIdx = afterArgs.indexOf("{", retStart);
    if (braceIdx === -1) continue;
    const retRaw = afterArgs.substring(retStart, braceIdx).trim();

    // Extract return type from axum_codec::Codec<T>
    let returnType = "unknown";
    const codecIdx = retRaw.indexOf("Codec<");
    if (codecIdx !== -1) {
      const start = codecIdx + "Codec<".length;
      const inner = extractGenericInner(retRaw.substring(codecIdx));
      if (inner) returnType = inner;
    }

    // Extract Path<Type>
    let pathParamType: string | null = null;
    let pathParamName: string | null = null;
    const pathMatch = /Path\((\w+)\)\s*:\s*Path<(\w+)>/.exec(args);
    if (pathMatch) {
      pathParamName = pathMatch[1];
      pathParamType = pathMatch[2];
    }

    // Extract Query<Type>
    let queryParamType: string | null = null;
    const queryMatch = /Query\(\w+\)\s*:\s*Query<(\w+)>/.exec(args);
    if (queryMatch) queryParamType = queryMatch[1];
    // Also handle: query: axum::extract::Query<Type>
    const queryMatch2 = /axum::extract::Query<(\w+)>/.exec(args);
    if (!queryParamType && queryMatch2) queryParamType = queryMatch2[1];

    handlers.push({ name, returnType, pathParamType, pathParamName, queryParamType });
  }
  return handlers;
}

function parseStructFields(body: string): ParsedField[] {
  const fields: ParsedField[] = [];
  const lines = body.split("\n");

  let pendingRename: string | null = null;
  for (const rawLine of lines) {
    const line = rawLine.trim();

    // Capture #[serde(rename = "...")]
    const renameMatch = /serde\(rename\s*=\s*"([^"]+)"\)/.exec(line);
    if (renameMatch) {
      pendingRename = renameMatch[1];
      // If this line is ONLY the attribute, continue to the next line for the field
      if (!line.match(/^\s*(?:pub\s+)?\w+\s*:/)) continue;
    }

    // Match: [pub] field_name: Type,
    // Many Deserialize-only structs (query params) have non-pub fields
    const fieldMatch = /^(?:pub(?:\(crate\))?\s+)?(\w+)\s*:\s*(.+)/.exec(line);
    if (fieldMatch) {
      const fieldName = fieldMatch[1];
      // Skip Rust keywords that look like field matches inside macro/impl blocks
      if (["fn", "let", "mut", "use", "self", "super", "crate", "type", "impl", "mod", "async", "await", "return", "if", "else", "match", "for", "while", "loop"].includes(fieldName)) {
        pendingRename = null;
        continue;
      }
      const typeRaw = readRustType(fieldMatch[2], 0);
      fields.push({
        name: fieldName,
        rustType: typeRaw,
        serdeRename: pendingRename,
      });
      pendingRename = null;
    } else {
      // Not a field line — reset pending rename unless it's a comment/attr
      if (!line.startsWith("#") && !line.startsWith("//") && !line.startsWith("///") && line !== "") {
        pendingRename = null;
      }
    }
  }
  return fields;
}

function parseStructs(src: string): ParsedStruct[] {
  const structs: ParsedStruct[] = [];

  // ── Structs ──
  // Find `struct Name {` with optional attributes before it
  const structRe = /((?:\s*#\[[^\]]*\]\s*)*)(?:pub(?:\(crate\))?\s+)?struct\s+(\w+)\s*\{/g;
  let m: RegExpExecArray | null;
  while ((m = structRe.exec(src)) !== null) {
    const attrs = m[1] || "";
    const name = m[2];
    const bodyStart = m.index + m[0].length - 1; // position of {
    const body = extractBracedBody(src, bodyStart);
    if (body === null) continue;
    if (SKIP_STRUCTS.has(name)) continue;

    const fields = parseStructFields(body);
    structs.push({
      name,
      fields,
      isEnum: false,
      enumVariants: [],
      serdeTag: null,
      serdeUntagged: false,
    });
  }

  // ── Enums ──
  const enumRe = /((?:\s*#\[[^\]]*\]\s*)*)(?:pub(?:\(crate\))?\s+)?enum\s+(\w+)\s*\{/g;
  while ((m = enumRe.exec(src)) !== null) {
    const attrs = m[1] || "";
    const name = m[2];
    if (SKIP_STRUCTS.has(name)) continue;

    const bodyStart = m.index + m[0].length - 1;
    const body = extractBracedBody(src, bodyStart);
    if (body === null) continue;

    const serdeUntagged = /serde\(untagged\)/.test(attrs);
    const tagMatch = /serde\(tag\s*=\s*"([^"]+)"\)/.exec(attrs);
    const serdeTag = tagMatch ? tagMatch[1] : null;

    const variants: { name: string; innerType: string | null }[] = [];
    // Match: VariantName(Type) or VariantName { ... } or just VariantName,
    const varRe = /(\w+)\s*(?:\(([^)]*)\)|(\{[^}]*\}))?/g;
    let vm: RegExpExecArray | null;
    while ((vm = varRe.exec(body)) !== null) {
      const vName = vm[1];
      // Skip Rust keywords that might match
      if (["pub", "fn", "let", "mut", "use", "crate", "self", "super"].includes(vName)) continue;
      const innerType = vm[2]?.trim() || null;
      variants.push({ name: vName, innerType });
    }

    structs.push({
      name,
      fields: [],
      isEnum: true,
      enumVariants: variants,
      serdeTag,
      serdeUntagged,
    });
  }

  return structs;
}

function parseQueryStructs(src: string, handlers: ParsedHandler[]): ParsedQueryStruct[] {
  const queryTypeNames = new Set(
    handlers.map((h) => h.queryParamType).filter(Boolean) as string[]
  );
  const structs = parseStructs(src);
  const result: ParsedQueryStruct[] = [];

  for (const s of structs) {
    if (s.isEnum) continue;
    if (!queryTypeNames.has(s.name) && !s.name.endsWith("Params") && !s.name.endsWith("Query")) continue;

    const fields = s.fields.map((f) => {
      const isOption = f.rustType.startsWith("Option<");
      const inner = isOption ? extractGenericInner(f.rustType) ?? f.rustType : f.rustType;
      return { name: f.serdeRename || f.name, rustType: inner, optional: isOption };
    });
    result.push({ name: s.name, fields });
  }
  return result;
}

// ─── Router Setup from lib.rs ────────────────────────────────────────────────

function parseLibRouterSetup(libSrc: string): {
  merges: string[];
  nests: { prefix: string; routerName: string }[];
} {
  const merges: string[] = [];
  const nests: { prefix: string; routerName: string }[] = [];

  const mergeRe = /\.merge\((\w+)::get_routes\(\)\)/g;
  let m: RegExpExecArray | null;
  while ((m = mergeRe.exec(libSrc)) !== null) merges.push(m[1]);

  const nestRe = /\.nest\(\s*"([^"]+)"\s*,\s*(\w+)\s*\)/g;
  while ((m = nestRe.exec(libSrc)) !== null) {
    nests.push({ prefix: m[1], routerName: m[2] });
  }

  return { merges, nests };
}

/** Find routes built into inline routers in lib.rs (e.g. desc_router). */
function parseInlineRouters(libSrc: string): Map<string, ParsedRoute[]> {
  const result = new Map<string, ParsedRoute[]>();
  // Pattern: let name = Router::new() .route(...)...;
  const routerRe = /let\s+(\w+)\s*=\s*Router::new\(\)([\s\S]*?)(?:;\s*$)/gm;
  let m: RegExpExecArray | null;
  while ((m = routerRe.exec(libSrc)) !== null) {
    const routerName = m[1];
    const routerBody = m[2];
    result.set(routerName, parseRoutes(routerBody));
  }
  return result;
}

// ─── Rust → TypeScript Type Mapping ──────────────────────────────────────────

const RUST_PRIMITIVES: Record<string, string> = {
  i8: "number", i16: "number", i32: "number", i64: "number",
  u8: "number", u16: "number", u32: "number", u64: "number",
  usize: "number", isize: "number",
  f32: "number", f64: "number",
  bool: "boolean",
  String: "string", str: "string",
  Value: "unknown",
  Identity: "string",
};

function rustTypeToTs(rustType: string, knownStructs: Set<string>): string {
  let t = rustType.trim().replace(/^::/, "");

  // Option<T> → T | null
  if (t.startsWith("Option<")) {
    const inner = extractGenericInner(t);
    if (inner) return `${rustTypeToTs(inner, knownStructs)} | null`;
  }

  // Vec<T> → T[]
  if (t.startsWith("Vec<")) {
    const inner = extractGenericInner(t);
    if (inner) {
      const mapped = rustTypeToTs(inner, knownStructs);
      return mapped.includes("|") ? `(${mapped})[]` : `${mapped}[]`;
    }
  }

  // HashMap / BTreeMap / DashMap
  const mapPrefixes = ["HashMap<", "BTreeMap<", "dashmap::DashMap<", "DashMap<"];
  for (const prefix of mapPrefixes) {
    if (t.startsWith(prefix) || t.includes(prefix)) {
      const inner = extractGenericInner(t);
      if (inner) {
        const parts = splitTopLevel(inner);
        if (parts.length >= 2) {
          return `Record<${rustTypeToTs(parts[0], knownStructs)}, ${rustTypeToTs(parts.slice(1).join(", "), knownStructs)}>`;
        }
      }
    }
  }

  // Tuple: (T1, T2) → [T1, T2]
  if (t.startsWith("(") && t.endsWith(")")) {
    const inner = t.slice(1, -1);
    const parts = splitTopLevel(inner);
    if (parts.length > 1) {
      return `[${parts.map((p) => rustTypeToTs(p, knownStructs)).join(", ")}]`;
    }
  }

  // Primitives
  if (RUST_PRIMITIVES[t]) return RUST_PRIMITIVES[t];

  // Module-qualified types: entity::foo::Model, entity::foo::Bar, etc.
  if (t.includes("::")) {
    const segments = t.split("::");
    const last = segments[segments.length - 1];
    // entity::*::Model → use module name to disambiguate or just emit as Record<string, unknown>
    if (last === "Model") {
      // Try to make a descriptive name: entity::player_state::Model → PlayerStateModel
      if (segments.length >= 2) {
        const modPart = segments[segments.length - 2];
        const camel = modPart.split("_").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join("");
        return camel + "Model";
      }
      return "Record<string, unknown>";
    }
    // For other qualified types, use the last segment
    if (RUST_PRIMITIVES[last]) return RUST_PRIMITIVES[last];
    if (knownStructs.has(last)) return last;
    // PascalCase the last segment as a type name
    return last;
  }

  // Known struct
  if (knownStructs.has(t)) return t;

  return t;
}

// ─── Endpoint Construction ───────────────────────────────────────────────────

interface Endpoint {
  name: string;
  httpMethod: string;
  path: string;
  pathParams: { name: string; tsType: string }[];
  queryParams: { name: string; tsType: string; optional: boolean }[];
  returnType: string;
  handlerName: string;
  module: string;
}

function buildEndpoint(
  route: ParsedRoute,
  handler: ParsedHandler | null,
  queryStructs: ParsedQueryStruct[],
  knownStructs: Set<string>
): Endpoint {
  // Path params
  const pathParams: { name: string; tsType: string }[] = [];
  const ppRe = /\{(\w+)\}/g;
  let pp: RegExpExecArray | null;
  while ((pp = ppRe.exec(route.path)) !== null) {
    let tsType = "number";
    if (handler?.pathParamType) {
      tsType = handler.pathParamType === "String" || handler.pathParamType === "str" ? "string" : "number";
    }
    pathParams.push({ name: pp[1], tsType });
  }

  // Query params
  const queryParams: { name: string; tsType: string; optional: boolean }[] = [];
  if (handler?.queryParamType) {
    const qs = queryStructs.find((q) => q.name === handler.queryParamType);
    if (qs) {
      for (const f of qs.fields) {
        queryParams.push({
          name: f.name,
          tsType: rustTypeToTs(f.rustType, knownStructs),
          optional: f.optional,
        });
      }
    }
  }

  // Return type
  const returnType = handler
    ? rustTypeToTs(handler.returnType, knownStructs)
    : "unknown";

  // Method name from handler name (snake_case → camelCase)
  const name = handler
    ? handler.name.replace(/_(\w)/g, (_, c) => c.toUpperCase())
    : routeToMethodName(route.httpMethod, route.path);

  return {
    name,
    httpMethod: route.httpMethod,
    path: route.path,
    pathParams,
    queryParams,
    returnType,
    handlerName: handler?.name ?? route.handlerName,
    module: (route as ParsedRouteWithModule).moduleName ?? "",
  };
}

function routeToMethodName(method: string, routePath: string): string {
  let cleaned = routePath
    .replace(/^\/api\/bitcraft\//, "/")
    .replace(/\{(\w+)\}/g, "By$1")
    // Remove redundant verb segments in paths like /recipes/get_all
    .replace(/\/get_all$/, "")
    .replace(/\/get_/, "/")
    .replace(/\/all$/, "");

  const segments = cleaned.split("/").filter(Boolean);
  if (segments.length === 0) segments.push("root");

  const camel = segments
    .map((s, i) => {
      const c = s.replace(/_(\w)/g, (_, ch) => ch.toUpperCase());
      return i === 0 ? c : c.charAt(0).toUpperCase() + c.slice(1);
    })
    .join("");

  const verb = method === "GET" ? "get" : method.toLowerCase();
  // Avoid stuttering like "getGetAll" — if the camel already starts with the verb, don't prefix
  const camelLower = camel.charAt(0).toLowerCase() + camel.slice(1);
  if (camelLower.startsWith(verb)) {
    return camelLower;
  }
  return verb + camel.charAt(0).toUpperCase() + camel.slice(1);
}

function deduplicateEndpoints(endpoints: Endpoint[]): Endpoint[] {
  // Multiple routes can point to the same handler (e.g. /houses and /api/bitcraft/houses).
  // Group duplicate paths, keeping the one with the better (more specific) return type.
  // Then for the same handler, keep the shortest path.

  // Step 1: Group by path, keep the one with a real return type
  const byPath = new Map<string, Endpoint>();
  for (const ep of endpoints) {
    const pathKey = `${ep.httpMethod}:${ep.path}`;
    const existing = byPath.get(pathKey);
    if (!existing) {
      byPath.set(pathKey, ep);
    } else if (existing.returnType === "unknown" && ep.returnType !== "unknown") {
      byPath.set(pathKey, ep);
    }
  }

  // Step 2: For endpoints sharing the same handler (aliases), keep the shortest path
  const byHandler = new Map<string, Endpoint>();
  for (const ep of byPath.values()) {
    const key = `${ep.httpMethod}:${ep.module}::${ep.handlerName}`;
    const existing = byHandler.get(key);
    if (!existing || ep.path.length < existing.path.length) {
      byHandler.set(key, ep);
    }
  }

  // Step 3: Deduplicate by method name in the generated client
  // When names collide, derive from path instead
  const byName = new Map<string, Endpoint>();
  for (const ep of byHandler.values()) {
    if (!byName.has(ep.name)) {
      byName.set(ep.name, ep);
    } else {
      // Rename this endpoint using its path for a unique descriptive name
      ep.name = routeToMethodName(ep.httpMethod, ep.path);
      // If still collides, append module
      if (byName.has(ep.name) && ep.module) {
        const mod = ep.module.replace(/_(\w)/g, (_, c) => c.toUpperCase());
        ep.name = ep.name + mod.charAt(0).toUpperCase() + mod.slice(1);
      }
      byName.set(ep.name, ep);
    }
  }

  // Also rename the first one if it ended up with a generic name like "getAll" or "meta"
  const genericNames = ["getAll", "meta", "getItems", "getRecipesGetAll"];
  for (const [name, ep] of byName) {
    if (genericNames.includes(name)) {
      const better = routeToMethodName(ep.httpMethod, ep.path);
      if (better !== name && !byName.has(better)) {
        byName.delete(name);
        ep.name = better;
        byName.set(better, ep);
      }
    }
  }

  return [...byName.values()];
}

// ─── Code Emitter ────────────────────────────────────────────────────────────

function emitStructType(s: ParsedStruct, knownStructs: Set<string>): string {
  if (s.isEnum) {
    if (s.serdeUntagged) {
      // Union of variant inner types
      const types = s.enumVariants
        .map((v) => v.innerType ? rustTypeToTs(v.innerType, knownStructs) : v.name)
        .filter((t) => t !== "unknown");
      return `export type ${s.name} = ${types.join(" | ") || "unknown"};\n`;
    }
    if (s.serdeTag) {
      const variants = s.enumVariants.map(
        (v) => `{ ${s.serdeTag}: "${v.name}" }`
      );
      return `export type ${s.name} = ${variants.join(" | ")};\n`;
    }
    // Simple string enum
    const variants = s.enumVariants.map((v) => `"${v.name}"`);
    return `export type ${s.name} = ${variants.join(" | ") || "string"};\n`;
  }

  if (s.fields.length === 0) {
    return `export interface ${s.name} {\n  [key: string]: unknown;\n}\n`;
  }

  const fields = s.fields.map((f) => {
    const tsName = f.serdeRename || f.name;
    const isOpt = f.rustType.startsWith("Option<");
    const tsType = rustTypeToTs(f.rustType, knownStructs);
    return `  ${tsName}${isOpt ? "?" : ""}: ${tsType};`;
  });

  return `export interface ${s.name} {\n${fields.join("\n")}\n  [key: string]: unknown;\n}\n`;
}

function emitQueryParamsType(qs: ParsedQueryStruct, knownStructs: Set<string>): string {
  const fields = qs.fields.map((f) => {
    const tsType = rustTypeToTs(f.rustType, knownStructs);
    return `  ${f.name}${f.optional ? "?" : ""}: ${tsType};`;
  });
  return `export interface ${qs.name} {\n${fields.join("\n")}\n}\n`;
}

function emitMethod(ep: Endpoint): string {
  const params: string[] = [];

  for (const p of ep.pathParams) params.push(`${p.name}: ${p.tsType}`);

  if (ep.queryParams.length > 0) {
    const allOpt = ep.queryParams.every((p) => p.optional);
    const fields = ep.queryParams
      .map((p) => `    ${p.name}${p.optional ? "?" : ""}: ${p.tsType};`)
      .join("\n");
    params.push(`params${allOpt ? "?" : ""}: {\n${fields}\n  }`);
  }

  const sig = `(${params.join(", ")}): Promise<${ep.returnType}>`;

  let pathExpr: string;
  if (ep.pathParams.length > 0) {
    pathExpr = "`" + ep.path.replace(/\{(\w+)\}/g, (_, n) => "${" + n + "}") + "`";
  } else {
    pathExpr = `"${ep.path}"`;
  }

  const body = ep.queryParams.length > 0
    ? `    const query = params ? this.buildQuery(params) : "";\n    return this.request<${ep.returnType}>(${pathExpr} + query);`
    : `    return this.request<${ep.returnType}>(${pathExpr});`;

  return `
  /**
   * \`${ep.httpMethod} ${ep.path}\`
   */
  async ${ep.name}${sig} {
${body}
  }`;
}

// ─── WebSocket Message Parser ─────────────────────────────────────────────────

interface WsVariant {
  /** Variant name, e.g. "PlayerState" */
  name: string;
  /** TypeScript type of the content payload, or null if no payload */
  contentType: string | null;
  /** Topic strings this variant publishes to (from topics() match arm) */
  topics: string[];
}

function parseWebSocketMessages(src: string): WsVariant[] {
  // Find the WebSocketMessages enum body
  const enumMatch = /enum\s+WebSocketMessages\s*\{/g.exec(src);
  if (!enumMatch) return [];

  const bodyStart = enumMatch.index + enumMatch[0].length - 1;
  const body = extractBracedBody(src, bodyStart);
  if (!body) return [];

  const variants: WsVariant[] = [];
  // Match variants like:
  //   PlayerState(entity::player_state::Model),
  //   Experience { experience: u64, level: u64, ... },
  //   ListSubscribedTopics,
  const lines = body.split("\n");
  let i = 0;
  while (i < lines.length) {
    const line = lines[i].trim();
    // Skip comments, attributes, empty lines
    if (!line || line.startsWith("//") || line.startsWith("#")) { i++; continue; }

    // Tuple variant: Name(Type) or Name(Type1, Type2),
    const tupleMatch = /^(\w+)\(([^)]+)\)\s*,?/.exec(line);
    if (tupleMatch) {
      const name = tupleMatch[1];
      const rawInner = tupleMatch[2].trim();
      // Multi-field tuples like (String, u64) → wrap as a Rust tuple type
      const parts = splitTopLevel(rawInner);
      const rustType = parts.length > 1 ? `(${rawInner})` : rawInner;
      // Skip control-flow variants
      if (!["Subscribe", "Unsubscribe", "ListSubscribedTopics", "SubscribedTopics", "Message"].includes(name)) {
        variants.push({ name, contentType: rustType, topics: [] });
      }
      i++; continue;
    }

    // Struct variant: Name { field: Type, ... },
    const structMatch = /^(\w+)\s*\{/.exec(line);
    if (structMatch) {
      const name = structMatch[1];
      // Collect lines until closing }
      let braceContent = "";
      let depth = 0;
      for (let j = i; j < lines.length; j++) {
        for (const ch of lines[j]) {
          if (ch === "{") depth++;
          if (ch === "}") depth--;
        }
        braceContent += lines[j] + "\n";
        if (depth <= 0) { i = j + 1; break; }
      }
      if (!["Subscribe", "Unsubscribe", "ListSubscribedTopics", "SubscribedTopics", "Message"].includes(name)) {
        // Parse fields from the brace content
        const fields: { name: string; type: string }[] = [];
        const fieldRe = /(\w+)\s*:\s*([^,\n}]+)/g;
        let fm: RegExpExecArray | null;
        while ((fm = fieldRe.exec(braceContent)) !== null) {
          if (!["pub", "fn", "let"].includes(fm[1])) {
            fields.push({ name: fm[1], type: fm[2].trim() });
          }
        }
        variants.push({ name, contentType: `{struct:${name}}`, topics: [] });
        // Store the fields for later TS emission
        (variants[variants.length - 1] as any)._fields = fields;
      }
      continue;
    }

    // Simple variant: Name,
    const simpleMatch = /^(\w+)\s*,?$/.exec(line);
    if (simpleMatch) {
      const name = simpleMatch[1];
      if (!["Subscribe", "Unsubscribe", "ListSubscribedTopics", "SubscribedTopics", "Message"].includes(name)) {
        variants.push({ name, contentType: null, topics: [] });
      }
    }
    i++;
  }

  // Now parse the topics() method to associate topic strings with variants
  const topicsMatch = /fn\s+topics\s*\(\s*&self\s*\)\s*->\s*Option<Vec<\(String,\s*Option<i64>\)>>\s*\{/g.exec(src);
  if (topicsMatch) {
    const topicsBodyStart = src.indexOf("{", topicsMatch.index + topicsMatch[0].length - 1);
    const topicsBody = extractBracedBody(src, topicsBodyStart);
    if (topicsBody) {
      // For each variant, find the match arm and extract topic strings
      for (const v of variants) {
        // Match: WebSocketMessages::VariantName(... | { ... }) => Some(vec![("topic_name", ...)])
        const armRe = new RegExp(`WebSocketMessages::${v.name}[^=]*=>\\s*Some\\(vec!\\[([^\\]]+)\\]`, "s");
        const armMatch = armRe.exec(topicsBody);
        if (armMatch) {
          const topicStrs = armMatch[1].matchAll(/"([^"]+)"/g);
          for (const tm of topicStrs) {
            if (!v.topics.includes(tm[1])) v.topics.push(tm[1]);
          }
        }
      }
    }
  }

  return variants;
}

function emitWebSocketTypes(variants: WsVariant[], knownStructs: Set<string>): string {
  const lines: string[] = [];

  // Emit inline struct types for struct variants
  for (const v of variants) {
    if (v.contentType?.startsWith("{struct:")) {
      const fields: { name: string; type: string }[] = (v as any)._fields || [];
      const tsFields = fields
        .map((f) => `  ${f.name}: ${rustTypeToTs(f.type, knownStructs)};`)
        .join("\n");
      lines.push(`export interface WsMsg${v.name} {\n${tsFields}\n}\n`);
    }
  }

  // Emit the discriminated union
  const unionMembers = variants.map((v) => {
    let contentType: string;
    if (!v.contentType) {
      contentType = "undefined";
    } else if (v.contentType.startsWith("{struct:")) {
      contentType = `WsMsg${v.name}`;
    } else {
      contentType = rustTypeToTs(v.contentType, knownStructs);
    }
    return `  | { t: "${v.name}"; c: ${contentType} }`;
  });
  lines.push(`export type WebSocketMessage =\n${unionMembers.join("\n")};\n`);

  // Emit the message type string literal
  lines.push(`export type WebSocketMessageType = WebSocketMessage["t"];\n`);

  // Emit a helper to extract the content type for a given message type
  lines.push(`export type WebSocketMessageContent<T extends WebSocketMessageType> =`);
  lines.push(`  Extract<WebSocketMessage, { t: T }>["c"];\n`);

  // Emit known topic names
  const allTopics = new Set<string>();
  for (const v of variants) {
    for (const t of v.topics) allTopics.add(t);
  }
  if (allTopics.size > 0) {
    lines.push(`/** Known WebSocket topic names. Use with subscribe(). */`);
    lines.push(`export type WebSocketTopic =`);
    lines.push(`  ${[...allTopics].map((t) => `"${t}"`).join(" | ")};\n`);
  }

  return lines.join("\n");
}

function emitLiveClient(): string {
  return `
// ═══════════════════════════════════════════════════════════════════════════════
// Live Data Client (WebSocket)
// ═══════════════════════════════════════════════════════════════════════════════

export interface BitcraftLiveClientOptions {
  /** Base URL (http/https). Will be converted to ws/wss automatically. */
  baseUrl: string;
  /** Encoding to request from the server. Default: "Json". */
  encoding?: "Json" | "Toml" | "Yaml" | "MessagePack";
  /** Auto-reconnect on disconnect. Default: true. */
  autoReconnect?: boolean;
  /** Reconnect delay in ms. Default: 5000. */
  reconnectDelay?: number;
  /** Max reconnect attempts. Default: 10. 0 = infinite. */
  maxReconnectAttempts?: number;
}

type MessageHandler<T extends WebSocketMessageType = WebSocketMessageType> =
  (content: WebSocketMessageContent<T>) => void;

export class BitcraftLiveClient {
  private ws: WebSocket | null = null;
  private readonly wsUrl: string;
  private readonly encoding: string;
  private readonly autoReconnect: boolean;
  private readonly reconnectDelay: number;
  private readonly maxReconnectAttempts: number;
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private intentionallyClosed = false;

  private handlers = new Map<string, Map<string, MessageHandler<any>>>();
  private subscribedTopics = new Set<string>();

  /** Fires on connection open. */
  onOpen: (() => void) | null = null;
  /** Fires on connection close. */
  onClose: ((event: CloseEvent) => void) | null = null;
  /** Fires on connection error. */
  onError: ((event: Event) => void) | null = null;
  /** Fires on every raw message (before dispatch). */
  onRawMessage: ((message: WebSocketMessage) => void) | null = null;

  constructor(options: BitcraftLiveClientOptions) {
    const base = options.baseUrl.replace(/\\/+$/, "");
    const wsBase = base.replace(/^http/, "ws");
    this.encoding = options.encoding ?? "Json";
    this.wsUrl = \`\${wsBase}/websocket?encoding=\${this.encoding}\`;
    this.autoReconnect = options.autoReconnect ?? true;
    this.reconnectDelay = options.reconnectDelay ?? 5000;
    this.maxReconnectAttempts = options.maxReconnectAttempts ?? 10;
  }

  /** Current connection state. */
  get readyState(): number {
    return this.ws?.readyState ?? WebSocket.CLOSED;
  }

  get isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  /** Open the WebSocket connection. */
  connect(): void {
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }
    this.intentionallyClosed = false;
    this.ws = new WebSocket(this.wsUrl);

    this.ws.onopen = () => {
      this.reconnectAttempts = 0;
      // Re-subscribe to all previously subscribed topics
      if (this.subscribedTopics.size > 0) {
        this.send({ t: "Subscribe", c: { topics: [...this.subscribedTopics] } });
      }
      this.onOpen?.();
    };

    this.ws.onclose = (event) => {
      this.onClose?.(event);
      if (!this.intentionallyClosed && this.autoReconnect) {
        this.scheduleReconnect();
      }
    };

    this.ws.onerror = (event) => {
      this.onError?.(event);
    };

    this.ws.onmessage = (event) => {
      this.handleMessage(event);
    };
  }

  /** Close the connection. */
  disconnect(): void {
    this.intentionallyClosed = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.ws?.close();
    this.ws = null;
  }

  /**
   * Subscribe to a topic and register a typed handler for a message type.
   *
   * @param messageType  The WebSocket message type to listen for (e.g. "PlayerState")
   * @param topics       Topic string(s) to subscribe to (e.g. "player_state.12345")
   * @param handler      Callback receiving the typed message content
   * @param handlerId    Unique ID for this handler (for later removal)
   */
  subscribe<T extends WebSocketMessageType>(
    messageType: T,
    topics: string | string[],
    handler: (content: WebSocketMessageContent<T>) => void,
    handlerId: string,
  ): void {
    // Register handler
    if (!this.handlers.has(messageType)) {
      this.handlers.set(messageType, new Map());
    }
    this.handlers.get(messageType)!.set(handlerId, handler as MessageHandler<any>);

    // Track and send subscription
    const topicList = typeof topics === "string" ? [topics] : topics;
    const newTopics: string[] = [];
    for (const t of topicList) {
      if (!this.subscribedTopics.has(t)) {
        this.subscribedTopics.add(t);
        newTopics.push(t);
      }
    }
    if (newTopics.length > 0 && this.isConnected) {
      this.send({ t: "Subscribe", c: { topics: newTopics } });
    }
  }

  /**
   * Unsubscribe from topics and remove a handler.
   */
  unsubscribe<T extends WebSocketMessageType>(
    messageType: T,
    topics: string | string[],
    handlerId: string,
  ): void {
    const handlerMap = this.handlers.get(messageType);
    if (handlerMap) {
      handlerMap.delete(handlerId);
      if (handlerMap.size === 0) this.handlers.delete(messageType);
    }

    const topicList = typeof topics === "string" ? [topics] : topics;
    for (const topic of topicList) {
      this.subscribedTopics.delete(topic);
      if (this.isConnected) {
        this.send({ t: "Unsubscribe", c: { topic } });
      }
    }
  }

  /**
   * Register a handler for a message type without subscribing to any topic.
   * Useful for messages that arrive on already-subscribed topics.
   */
  on<T extends WebSocketMessageType>(
    messageType: T,
    handler: (content: WebSocketMessageContent<T>) => void,
    handlerId: string,
  ): void {
    if (!this.handlers.has(messageType)) {
      this.handlers.set(messageType, new Map());
    }
    this.handlers.get(messageType)!.set(handlerId, handler as MessageHandler<any>);
  }

  /** Remove a specific handler by type and ID. */
  off(messageType: WebSocketMessageType, handlerId: string): void {
    const handlerMap = this.handlers.get(messageType);
    if (handlerMap) {
      handlerMap.delete(handlerId);
      if (handlerMap.size === 0) this.handlers.delete(messageType);
    }
  }

  /** List currently subscribed topic strings. */
  getSubscribedTopics(): string[] {
    return [...this.subscribedTopics];
  }

  /** Request the server to list our subscribed topics. */
  listServerTopics(): void {
    if (this.isConnected) {
      this.send({ t: "ListSubscribedTopics" });
    }
  }

  // ─── Internals ───────────────────────────────────────────────

  private send(msg: Record<string, unknown>): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }

  private handleMessage(event: MessageEvent): void {
    let message: WebSocketMessage | undefined;
    try {
      if (typeof event.data === "string") {
        message = JSON.parse(event.data) as WebSocketMessage;
      }
      // For MessagePack/binary, users should bring their own decoder
      // and set onRawMessage or override handleMessage.
    } catch {
      return;
    }
    if (!message || !message.t) return;

    this.onRawMessage?.(message);

    const handlerMap = this.handlers.get(message.t);
    if (handlerMap) {
      const content = "c" in message ? (message as any).c : undefined;
      for (const handler of handlerMap.values()) {
        try { handler(content); } catch { /* user handler error */ }
      }
    }
  }

  private scheduleReconnect(): void {
    if (this.maxReconnectAttempts > 0 && this.reconnectAttempts >= this.maxReconnectAttempts) {
      return;
    }
    this.reconnectAttempts++;
    this.reconnectTimer = setTimeout(() => {
      this.connect();
    }, this.reconnectDelay);
  }
}
`;
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  const { output, branch } = parseArgs();
  console.log(`Fetching Bitcraft Hub API source (branch: ${branch})...`);

  // 1. Fetch lib.rs
  const libSrc = await fetchFile(branch, `${API_SRC_PATH}/lib.rs`);
  if (!libSrc) throw new Error("Failed to fetch lib.rs");

  // 2. Discover module directories
  const moduleDirs = await fetchModuleNames(branch);
  console.log(`  Found ${moduleDirs.length} modules`);

  // 3. Fetch all module source files in parallel
  const moduleSources = new Map<string, string>();
  await Promise.all(
    moduleDirs.map(async (mod) => {
      const src = await fetchFile(branch, `${API_SRC_PATH}/${mod}/mod.rs`);
      if (src) moduleSources.set(mod, src);
    })
  );
  console.log(`  Fetched ${moduleSources.size} module source files`);

  // 4. Parse lib.rs router setup
  const { merges, nests } = parseLibRouterSetup(libSrc);
  const inlineRouters = parseInlineRouters(libSrc);

  // 5. Collect all structs, query structs, and endpoints
  const allStructs: ParsedStruct[] = [];
  const allQueryStructs: ParsedQueryStruct[] = [];
  const allEndpoints: Endpoint[] = [];

  // Collect known struct names first (two passes: collect names, then resolve types)
  const knownStructNames = new Set<string>();

  // Parse all structs from all sources to build the name set
  const libStructs = parseStructs(libSrc);
  for (const s of libStructs) knownStructNames.add(s.name);

  for (const [_, modSrc] of moduleSources) {
    for (const s of parseStructs(modSrc)) knownStructNames.add(s.name);
  }

  // Also add synthetic Model types for entity modules
  const entityModelTypes = [
    "PlayerStateModel", "MobileEntityStateModel", "ClaimStateModel",
    "ClaimTileStateModel", "ClaimMemberStateModel", "ClaimLocalStateModel",
    "BuildingStateModel", "BuildingDescModel", "BuildingNicknameStateModel",
    "InventoryModel", "InventoryChangelogModel", "ItemDescModel", "CargoDescModel",
    "CraftingRecipeModel", "ClaimTechDescModel", "ItemListDescModel",
    "SkillDescModel", "LocationModel", "TradeOrderModel",
    "DeployableStateModel", "AuctionListingStateModel",
    "TravelerTaskDescModel", "NpcDescModel", "PlayerActionStateModel",
    "PlayerUsernameStateModel", "PlayerHousingStateModel",
    "PermissionStateModel", "PortalStateModel", "LocationStateModel",
    "ExtractionRecipeDescModel", "VaultStateCollectiblesModel",
    "TravelerTaskStateModel",
    "ActionStateModel",
  ];
  for (const t of entityModelTypes) knownStructNames.add(t);

  // Now do the real parse
  allStructs.push(...libStructs.filter((s) => !SKIP_STRUCTS.has(s.name)));

  // Build a map of all module handlers and query structs for cross-module resolution
  const moduleHandlersMap = new Map<string, ParsedHandler[]>();
  const moduleQueryStructsMap = new Map<string, ParsedQueryStruct[]>();
  for (const [modName, modSrc] of moduleSources) {
    const handlers = parseHandlers(modSrc);
    moduleHandlersMap.set(modName, handlers);
    moduleQueryStructsMap.set(modName, parseQueryStructs(modSrc, handlers));
  }

  /** Resolve a handler by name, optionally scoped to a module. */
  function resolveHandler(handlerName: string, moduleName?: string): { handler: ParsedHandler | null; queryStructs: ParsedQueryStruct[] } {
    // If module is specified, look there first
    if (moduleName) {
      const modHandlers = moduleHandlersMap.get(moduleName);
      const h = modHandlers?.find((h) => h.name === handlerName) || null;
      if (h) return { handler: h, queryStructs: moduleQueryStructsMap.get(moduleName) || [] };
    }
    // Fallback: search all modules
    for (const [mod, handlers] of moduleHandlersMap) {
      const h = handlers.find((h) => h.name === handlerName);
      if (h) return { handler: h, queryStructs: moduleQueryStructsMap.get(mod) || [] };
    }
    // Check lib handlers
    const libHandler = libHandlers.find((h) => h.name === handlerName);
    return { handler: libHandler || null, queryStructs: libQS };
  }

  // Process lib.rs top-level routes
  const libRoutes = parseRoutesWithModule(libSrc);
  const libHandlers = parseHandlers(libSrc);
  const libQS = parseQueryStructs(libSrc, libHandlers);
  allQueryStructs.push(...libQS);

  for (const route of libRoutes) {
    const { handler, queryStructs: qs } = resolveHandler(route.handlerName, route.moduleName);
    allEndpoints.push(buildEndpoint(route, handler, qs, knownStructNames));
  }

  // Process inline routers with nest prefixes
  for (const nest of nests) {
    const inlineRoutes = inlineRouters.get(nest.routerName);
    if (inlineRoutes) {
      for (const route of inlineRoutes) {
        const prefixed = { ...route, path: nest.prefix + route.path };
        const { handler, queryStructs: qs } = resolveHandler(route.handlerName, route.moduleName);
        allEndpoints.push(buildEndpoint(prefixed, handler, qs, knownStructNames));
      }
    }
  }

  // Process each module
  for (const [modName, modSrc] of moduleSources) {
    const hasGetRoutes = modSrc.includes("fn get_routes()");
    const isMerged = merges.includes(modName);
    const hasRoutes = modSrc.includes(".route(");
    if (!hasGetRoutes && !isMerged && !hasRoutes) continue;

    const routes = parseRoutesWithModule(modSrc);
    if (routes.length === 0) continue;

    const handlers = moduleHandlersMap.get(modName) || [];
    const structs = parseStructs(modSrc).filter((s) => !SKIP_STRUCTS.has(s.name));
    const queryStructs = moduleQueryStructsMap.get(modName) || [];

    allStructs.push(...structs);
    allQueryStructs.push(...queryStructs);

    for (const route of routes) {
      // Set module name for routes within the module (they don't have a module:: qualifier)
      if (!route.moduleName) route.moduleName = modName;
      const handler = handlers.find((h) => h.name === route.handlerName);
      allEndpoints.push(buildEndpoint(route, handler || null, queryStructs, knownStructNames));
    }
  }

  // 6. Deduplicate
  const endpoints = deduplicateEndpoints(allEndpoints);

  const seenStructs = new Set<string>();
  const dedupedStructs: ParsedStruct[] = [];
  for (const s of allStructs) {
    if (!seenStructs.has(s.name)) { seenStructs.add(s.name); dedupedStructs.push(s); }
  }
  const seenQS = new Set<string>();
  const dedupedQS: ParsedQueryStruct[] = [];
  for (const qs of allQueryStructs) {
    if (!seenQS.has(qs.name)) { seenQS.add(qs.name); dedupedQS.push(qs); }
  }

  console.log(`  Parsed ${endpoints.length} unique endpoints`);
  console.log(`  Parsed ${dedupedStructs.length} type definitions`);

  // 7. Parse WebSocket message types from the websocket module and lib.rs
  const wsSrc = moduleSources.get("websocket") || "";
  const wsVariants = parseWebSocketMessages(libSrc + "\n" + wsSrc);
  console.log(`  Parsed ${wsVariants.length} WebSocket message types`);

  // 8. Generate output
  const code = emitClient(endpoints, dedupedStructs, dedupedQS, knownStructNames, branch, wsVariants);
  const dir = path.dirname(output);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(output, code, "utf-8");

  console.log(`\n✅ Generated ${output}`);
  console.log(`   ${endpoints.length} endpoints, ${dedupedStructs.length} types, ${code.split("\n").length} lines`);
}

function emitClient(
  endpoints: Endpoint[],
  structs: ParsedStruct[],
  queryStructs: ParsedQueryStruct[],
  knownStructs: Set<string>,
  branch: string,
  wsVariants: WsVariant[] = [],
): string {
  // Emit entity Model type aliases as opaque interfaces
  const modelAliases = `
// Entity model types — opaque types for database models referenced by the API.
// These represent rows from the backing database; fields vary by table.

export interface PlayerStateModel { entity_id: number; [key: string]: unknown; }
export interface MobileEntityStateModel { entity_id: number; location_x: number; location_y: number; location_z: number; chunk_index: number; dimension: number; region: string; [key: string]: unknown; }
export interface ClaimStateModel { entity_id: number; name: string; [key: string]: unknown; }
export interface ClaimTileStateModel { claim_id: number; [key: string]: unknown; }
export interface ClaimMemberStateModel { entity_id: number; player_entity_id: number; claim_entity_id: number; user_name: string; [key: string]: unknown; }
export interface ClaimLocalStateModel { entity_id: number; [key: string]: unknown; }
export interface BuildingStateModel { entity_id: number; claim_entity_id: number; building_description_id: number; direction_index: number; constructed_by_player_entity_id: number; [key: string]: unknown; }
export interface BuildingDescModel { id: number; name: string; description: string; [key: string]: unknown; }
export interface BuildingNicknameStateModel { entity_id: number; nickname: string; [key: string]: unknown; }
export interface InventoryModel { entity_id: number; pockets: unknown[]; inventory_index: number; cargo_index: number; owner_entity_id: number; player_owner_entity_id: number; [key: string]: unknown; }
export interface InventoryChangelogModel { [key: string]: unknown; }
export interface ItemDescModel { id: number; name: string; description: string; tier: number; tags: string[]; icon_asset_name: string; [key: string]: unknown; }
export interface CargoDescModel { id: number; name: string; description: string; tier: number; tags: string[]; icon_asset_name: string; [key: string]: unknown; }
export interface CraftingRecipeModel { id: number; name: string; [key: string]: unknown; }
export interface ClaimTechDescModel { id: number; name: string; [key: string]: unknown; }
export interface ItemListDescModel { id: number; name: string; [key: string]: unknown; }
export interface SkillDescModel { id: number; name: string; [key: string]: unknown; }
export interface LocationModel { entity_id: number; [key: string]: unknown; }
export interface TradeOrderModel { entity_id: number; [key: string]: unknown; }
export interface DeployableStateModel { entity_id: number; [key: string]: unknown; }
export interface AuctionListingStateModel { item_type: string; item_id: number; [key: string]: unknown; }
export interface TravelerTaskDescModel { id: number; [key: string]: unknown; }
export interface NpcDescModel { id: number; [key: string]: unknown; }
export interface PlayerActionStateModel { entity_id: number; [key: string]: unknown; }
export interface PlayerUsernameStateModel { entity_id: number; username: string; [key: string]: unknown; }
export interface TravelerTaskStateModel { [key: string]: unknown; }
export interface ExtractionRecipeDescModel { id: number; [key: string]: unknown; }
export interface VaultStateCollectiblesModel { [key: string]: unknown; }
export interface ResolvedInventory { entity_id: number; pockets: unknown[]; inventory_index: number; cargo_index: number; owner_entity_id: number; player_owner_entity_id: number; nickname: string | null; claim: ClaimStateModel | null; [key: string]: unknown; }
export interface PlayerStateMerged { entity_id: number; time_played: number; session_start_timestamp: number; time_signed_in: number; sign_in_timestamp: number; signed_in: boolean; username: string; [key: string]: unknown; }
export interface AuctionListingState { item_type: string; item_id: number; [key: string]: unknown; }
export interface ExpendedRefrence { item_id: number; item_type: string; quantity: number; name: string; icon_asset_name: string; [key: string]: unknown; }
export interface PlayerLeaderboardResponse { [category: string]: unknown; }
export interface ItemExpended { [key: string]: unknown; }
export interface TeleportLocation { [key: string]: unknown; }
export interface Timestamp { seconds: number; microseconds: number; }
export interface ProbabilisticItemStack { item_id: number; quantity_min: number; quantity_max: number; probability: number; }
export interface ToolRequirement { tool_tag: string; durability_cost: number; }
export interface Location { x: number; y: number; z: number; }
export type ItemType = "Item" | "Cargo";
export interface VaultStateCollectibleWithDesc { [key: string]: unknown; }
export interface ApiResponse { id: number; name: string; description: string; count: number; [key: string]: unknown; }
export interface ActionStateModel { owner_entity_id: number; entity_id: number; [key: string]: unknown; }
`;

  // Query param structs use `?:` (optional) instead of `| null`, so emit them
  // separately and exclude from the main type section.
  const queryStructNames = new Set(queryStructs.map((qs) => qs.name));
  const typeSection = structs
    .filter((s) => !queryStructNames.has(s.name))
    .map((s) => emitStructType(s, knownStructs))
    .join("\n");
  const querySection = queryStructs
    .map((qs) => emitQueryParamsType(qs, knownStructs))
    .join("\n");
  const methodsSection = endpoints.map((ep) => emitMethod(ep)).join("\n");

  return `/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * Bitcraft Hub API Client — Auto-generated
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Source: https://github.com/${REPO_OWNER}/${REPO_NAME}/tree/${branch}/${API_SRC_PATH}
 * Generated: ${new Date().toISOString()}
 *
 * Re-generate with:
 *   bun run generate-api-client.ts
 *
 * Usage:
 *   import { BitcraftApiClient } from "./bitcraft-api-client";
 *   const client = new BitcraftApiClient("https://bitcraft-hub.example.com");
 *   const players = await client.listPlayers({ page: 1, per_page: 20 });
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

// ═══════════════════════════════════════════════════════════════════════════════
// Entity Model Types
// ═══════════════════════════════════════════════════════════════════════════════
${modelAliases}

// ═══════════════════════════════════════════════════════════════════════════════
// API Response / Request Types (parsed from Rust source)
// ═══════════════════════════════════════════════════════════════════════════════

${typeSection}

// ─── Query Parameter Types ────────────────────────────────────────────────────

${querySection}

// ═══════════════════════════════════════════════════════════════════════════════
// API Client Error
// ═══════════════════════════════════════════════════════════════════════════════

export class BitcraftApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly statusText: string,
    public readonly body: string,
    public readonly url: string,
  ) {
    super(\`Bitcraft API error \${status} \${statusText} for \${url}\`);
    this.name = "BitcraftApiError";
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Client Options
// ═══════════════════════════════════════════════════════════════════════════════

export interface BitcraftApiClientOptions {
  /** Base URL of the Bitcraft Hub API server. No trailing slash. */
  baseUrl: string;
  /** Custom fetch implementation. Defaults to globalThis.fetch. */
  fetch?: typeof globalThis.fetch;
  /** Default headers for every request. */
  headers?: Record<string, string>;
  /** Request timeout in milliseconds. Default: 30000. */
  timeout?: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// API Client
// ═══════════════════════════════════════════════════════════════════════════════

export class BitcraftApiClient {
  private readonly baseUrl: string;
  private readonly fetchFn: typeof globalThis.fetch;
  private readonly defaultHeaders: Record<string, string>;
  private readonly timeout: number;

  constructor(baseUrlOrOptions: string | BitcraftApiClientOptions) {
    if (typeof baseUrlOrOptions === "string") {
      this.baseUrl = baseUrlOrOptions.replace(/\\/+$/, "");
      this.fetchFn = globalThis.fetch.bind(globalThis);
      this.defaultHeaders = {};
      this.timeout = 30_000;
    } else {
      this.baseUrl = baseUrlOrOptions.baseUrl.replace(/\\/+$/, "");
      this.fetchFn = baseUrlOrOptions.fetch ?? globalThis.fetch.bind(globalThis);
      this.defaultHeaders = baseUrlOrOptions.headers ?? {};
      this.timeout = baseUrlOrOptions.timeout ?? 30_000;
    }
  }

  private buildQuery(params: Record<string, unknown>): string {
    const parts: string[] = [];
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null) {
        parts.push(\`\${encodeURIComponent(key)}=\${encodeURIComponent(String(value))}\`);
      }
    }
    return parts.length > 0 ? \`?\${parts.join("&")}\` : "";
  }

  private async request<T>(path: string): Promise<T> {
    const url = \`\${this.baseUrl}\${path}\`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await this.fetchFn(url, {
        method: "GET",
        headers: { Accept: "application/json", ...this.defaultHeaders },
        signal: controller.signal,
      });

      if (!response.ok) {
        const body = await response.text().catch(() => "");
        throw new BitcraftApiError(response.status, response.statusText, body, url);
      }

      return (await response.json()) as T;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  // ─── API Methods (${endpoints.length} endpoints) ─────────────────────────────
${methodsSection}
}

// ═══════════════════════════════════════════════════════════════════════════════
// WebSocket Message Types (parsed from Rust WebSocketMessages enum)
// ═══════════════════════════════════════════════════════════════════════════════

${wsVariants.length > 0 ? emitWebSocketTypes(wsVariants, knownStructs) : "// No WebSocket messages found"}

${emitLiveClient()}

export default BitcraftApiClient;
`;
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
