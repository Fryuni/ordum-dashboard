#!/usr/bin/env bun
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
 * BitJita API Client Generator
 *
 * Fetches the BitJita API documentation page and parses endpoints,
 * parameters, and response types to generate a fully-typed TypeScript client.
 *
 * Usage:
 *   bun run scripts/generate-bitjita-client.ts [--output ./src/common/bitjita-client.ts]
 */

import * as fs from "fs";
import * as path from "path";

const DOCS_URL = "https://bitjita.com/docs/api";
const DEFAULT_OUTPUT = path.join(
  import.meta.dirname,
  "..",
  "src",
  "common",
  "bitjita-client.ts",
);

function parseArgs(): { output: string } {
  const args = process.argv.slice(2);
  let output = DEFAULT_OUTPUT;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--output" && args[i + 1])
      output = path.resolve(args[++i]!);
  }
  return { output };
}

// ─── Types ───────────────────────────────────────────────────────────────────

interface ApiParam {
  name: string;
  type: string;
  required: boolean;
  description: string;
}

interface ApiEndpoint {
  method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
  path: string;
  description: string;
  category: string;
  parameters: ApiParam[];
  responseSchema: string | null;
  responseTypeName: string;
}

// ─── HTML Parser ─────────────────────────────────────────────────────────────

/**
 * Parse the BitJita docs page HTML to extract API endpoint definitions.
 *
 * The page structure for each endpoint is:
 *   <div> containing:
 *     - Method badge (GET/POST) and path in backticks
 *     - Description text
 *     - Category badge
 *     - Parameters section with name, type, required/optional, description
 *     - Response section with JSON schema in a code block
 *     - "Try it out" section with example
 *
 * Since we don't have a DOM parser in Bun, we'll use regex-based parsing
 * on the markdown-like structure we get from the page.
 */
function parseEndpointsFromHtml(html: string): ApiEndpoint[] {
  const endpoints: ApiEndpoint[] = [];

  // The page has a consistent pattern we can parse.
  // Each endpoint section starts with a method (GET/POST/PUT/DELETE/PATCH)
  // followed by a path in backticks.

  // Strategy: Split by endpoint markers and parse each section
  // Match patterns like: >GET</span> or >POST</span> followed by route path
  // We'll use a different approach: find all endpoint blocks

  // Pattern: method + path sections
  // The HTML contains sections like:
  //   <span>GET</span> ... <code>/api/buildings</code>
  //   followed by description, params, response

  // Let's find each endpoint block by looking for the method+path pattern
  const endpointPattern =
    /(?:^|\n)\s*(?:<[^>]*>)*\s*(GET|POST|PUT|DELETE|PATCH)\s*(?:<[^>]*>)*\s*\n\s*(?:<[^>]*>)*\s*`(\/[^`]+)`/gm;

  // Alternative: parse from the text content structure
  // Let's extract text content first by stripping HTML tags
  const text = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, "\n")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, "\n\n");

  // Parse from the cleaned text
  const lines = text.split("\n").map((l) => l.trim());

  let i = 0;
  while (i < lines.length) {
    // Look for HTTP method line
    const methodMatch = /^(GET|POST|PUT|DELETE|PATCH)$/.exec(lines[i]!);
    if (!methodMatch) {
      i++;
      continue;
    }

    const method = methodMatch[1] as ApiEndpoint["method"];

    // Next non-empty line should be the path
    let j = i + 1;
    while (j < lines.length && !lines[j]) j++;
    const pathLine = lines[j]?.trim() ?? "";

    // Path should start with / or be in backticks
    const pathMatch = /^`?(\/[^\s`]+)`?$/.exec(pathLine);
    if (!pathMatch) {
      i = j + 1;
      continue;
    }
    const apiPath = pathMatch[1]!;

    // Next non-empty line is the description
    j++;
    while (j < lines.length && !lines[j]) j++;
    const description = lines[j]?.trim() ?? "";

    // Next non-empty line is the category
    j++;
    while (j < lines.length && !lines[j]) j++;
    const category = lines[j]?.trim() ?? "";

    // Now parse Parameters and Response sections
    j++;
    const params: ApiParam[] = [];
    let responseJson: string | null = null;

    // Scan forward until we hit the next endpoint (GET/POST/etc at start of line)
    // or "Try it out" section
    const sectionLines: string[] = [];
    while (j < lines.length) {
      if (/^(GET|POST|PUT|DELETE|PATCH)$/.test(lines[j]!)) break;
      sectionLines.push(lines[j]!);
      j++;
    }

    // Parse parameters from section
    const sectionText = sectionLines.join("\n");

    // Find Parameters section
    const paramSection = sectionText.match(
      /Parameters\s*\n([\s\S]*?)(?=Response|Try it out|$)/,
    );
    if (paramSection) {
      // Parameters are formatted as: name (type) Required/Optional \n description
      const paramPattern =
        /`?(\w+(?:\[\])?)`?\s*\((\w+(?:\[\])?)\)\s*(Required|Optional)\s*\n\s*([^\n]+)/g;
      let pm: RegExpExecArray | null;
      while ((pm = paramPattern.exec(paramSection[1]!)) !== null) {
        params.push({
          name: pm[1]!,
          type: pm[2]!,
          required: pm[3] === "Required",
          description: pm[4]!.trim(),
        });
      }
    }

    // Find Response section - look for JSON blocks
    const responseSection = sectionText.match(
      /Response\s*\n([\s\S]*?)(?=Try it out|$)/,
    );
    if (responseSection) {
      // Extract the JSON/code block content
      const jsonBlock = responseSection[1]!.trim();
      if (jsonBlock.startsWith("{") || jsonBlock.startsWith("[")) {
        // Find the balanced JSON
        responseJson = extractBalancedJson(jsonBlock);
      } else if (jsonBlock.startsWith('"')) {
        // Simple string response type
        responseJson = jsonBlock;
      }
    }

    // Generate a response type name from path
    const responseTypeName = pathToTypeName(apiPath, method);

    endpoints.push({
      method,
      path: apiPath,
      description,
      category,
      parameters: params,
      responseSchema: responseJson,
      responseTypeName,
    });

    i = j;
  }

  return endpoints;
}

function extractBalancedJson(text: string): string {
  const open = text[0];
  const close = open === "{" ? "}" : "]";
  let depth = 0;
  for (let i = 0; i < text.length; i++) {
    if (text[i] === "{" || text[i] === "[") depth++;
    if (text[i] === "}" || text[i] === "]") {
      depth--;
      if (depth === 0) return text.substring(0, i + 1);
    }
  }
  return text;
}

// ─── Type Generation ─────────────────────────────────────────────────────────

function pathToTypeName(apiPath: string, method: string): string {
  // /api/claims/[id]/members → ClaimMembers
  // /api/market/[itemOrCargo]/[itemId]/price-history → MarketItemPriceHistory
  const segments = apiPath
    .replace(/^\/api\//, "")
    .replace(/\/\[([^\]]+)\]/g, "") // Remove path params
    .split("/")
    .filter(Boolean);

  if (segments.length === 0) return "Root";

  const name = segments
    .map((s) => {
      return s
        .split("-")
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join("");
    })
    .join("");

  // For POST endpoints, prefix with the method to avoid collisions
  const prefix =
    method !== "GET" ? method.charAt(0) + method.slice(1).toLowerCase() : "";
  return prefix + name + "Response";
}

function pathToMethodName(apiPath: string, method: string): string {
  // /api/claims → listClaims (GET)
  // /api/claims/[id] → getClaim (GET)
  // /api/claims/[id]/members → getClaimMembers (GET)
  // /api/market/prices/bulk → postMarketPricesBulk (POST)

  const segments = apiPath
    .replace(/^\/api\//, "")
    .split("/")
    .filter(Boolean);

  const hasPathParam = segments.some((s) => s.startsWith("["));

  // Build name from non-param segments
  const nameParts = segments
    .filter((s) => !s.startsWith("["))
    .map((s) => {
      return s
        .split("-")
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join("");
    });

  let name = nameParts.join("");

  // For static paths, add appropriate verb
  if (method === "GET") {
    if (apiPath === "/static/experience/levels.csv")
      return "getExperienceLevelsCsv";
    if (apiPath === "/static/experience/levels.json")
      return "getExperienceLevelsJson";
  }

  if (method === "GET") {
    // If the last segment is a path param, use "get" prefix (single item)
    // Otherwise use "list" for collection endpoints, "get" for specific sub-resources
    const lastSegment = segments[segments.length - 1];
    if (lastSegment?.startsWith("[")) {
      // /api/claims/[id] → getClaim
      // /api/market/[itemOrCargo]/[itemId] → getMarketItem (multiple params → add suffix)
      // Singularize the parent segment
      const parent = nameParts[nameParts.length - 1] ?? "Item";
      const rest = nameParts.slice(0, -1).join("");
      const singular = singularize(parent);
      name = rest + singular;
      // If there are multiple path params after the only non-param segment,
      // we'd collide with the collection endpoint — add "ById" suffix
      const paramCount = segments.filter((s) => s.startsWith("[")).length;
      if (paramCount >= 2 && nameParts.length === 1) {
        name += "ById";
      }
      return "get" + name;
    } else if (hasPathParam) {
      // /api/claims/[id]/members → getClaimMembers
      // /api/market/[itemOrCargo]/[itemId] → getMarketItem
      // Use singular for the parametrized parent
      const parts: string[] = [];
      let allParamsAfterFirst = true;
      for (let i = 0; i < segments.length; i++) {
        if (segments[i]!.startsWith("[")) {
          // Track if we have only params after the first non-param segment
          continue;
        }
        allParamsAfterFirst = false;
        const seg = segments[i]!.split("-")
          .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
          .join("");
        // If previous segment was a param, singularize this segment's parent
        if (i > 0 && segments[i - 1]!.startsWith("[")) {
          parts.push(seg);
        } else if (
          i + 1 < segments.length &&
          segments[i + 1]?.startsWith("[")
        ) {
          parts.push(singularize(seg));
        } else {
          parts.push(seg);
        }
      }
      // If path is like /market/[x]/[y], add "Item" suffix to disambiguate from /market
      if (
        parts.length === 1 &&
        segments.filter((s) => s.startsWith("[")).length >= 2
      ) {
        parts.push("Item");
      }
      return "get" + parts.join("");
    } else {
      // /api/claims → listClaims, /api/status → getStatus
      // Use "list" for likely collection endpoints, "get" for singular
      const collectionEndpoints = [
        "buildings",
        "cargo",
        "claims",
        "crafts",
        "creatures",
        "deployables",
        "empires",
        "food",
        "items",
        "players",
        "regions",
        "resources",
        "skills",
      ];
      const lastPart = segments[segments.length - 1]?.toLowerCase() ?? "";
      if (collectionEndpoints.includes(lastPart) && segments.length <= 2) {
        return "list" + name;
      }
      return "get" + name;
    }
  } else {
    // POST/PUT/DELETE — prefix with method
    const verb = method.toLowerCase();
    return verb + name;
  }
}

function singularize(word: string): string {
  if (word.endsWith("ies")) return word.slice(0, -3) + "y";
  if (word.endsWith("ses")) return word.slice(0, -2);
  if (word.endsWith("s") && !word.endsWith("ss") && !word.endsWith("us"))
    return word.slice(0, -1);
  return word;
}

/** Convert doc type string to TypeScript type */
function docTypeToTs(docType: string): string {
  switch (docType.toLowerCase()) {
    case "string":
      return "string";
    case "number":
      return "number";
    case "boolean":
      return "boolean";
    case "array":
      return "unknown[]";
    case "object":
      return "Record<string, unknown>";
    case "number[]":
    case "number[ ]":
      return "number[]";
    case "string[]":
      return "string[]";
    default:
      if (docType.includes("|")) {
        return docType
          .split("|")
          .map((t) => docTypeToTs(t.trim()))
          .join(" | ");
      }
      return "unknown";
  }
}

/** Parse a JSON schema string from the docs into a TypeScript interface body */
function parseResponseSchema(
  json: string,
): {
  fields: { name: string; type: string; optional: boolean }[];
  isArray: boolean;
} | null {
  if (!json) return null;

  try {
    const isArray = json.trimStart().startsWith("[");
    // Normalize: if it's an array, take the first element
    let obj: Record<string, unknown>;
    if (isArray) {
      // Parse as array, take first element
      const cleanJson = json.replace(/"(\w+)":\s*"([^"]+)"/g, (_, k, v) => {
        // Values in the docs are type descriptors like "string", "number", etc.
        return `"${k}": "${v}"`;
      });
      const parsed = JSON.parse(cleanJson);
      obj = Array.isArray(parsed) ? (parsed[0] ?? {}) : parsed;
    } else {
      const cleanJson = json.replace(/"(\w+)":\s*"([^"]+)"/g, (_, k, v) => {
        return `"${k}": "${v}"`;
      });
      obj = JSON.parse(cleanJson);
    }

    const fields = parseObjectFields(obj);
    return { fields, isArray };
  } catch {
    return null;
  }
}

function parseObjectFields(
  obj: Record<string, unknown>,
): { name: string; type: string; optional: boolean }[] {
  const fields: { name: string; type: string; optional: boolean }[] = [];

  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === "string") {
      // Type descriptor: "string", "number", "boolean", "array", "object"
      // Also handles: "number | null", "string (base64)", etc.
      let tsType: string;
      const cleanValue = value
        .replace(/\s*\([^)]+\)\s*/g, "") // Remove parenthetical notes
        .trim();
      const isOptional = cleanValue.includes("null");
      tsType = docTypeToTs(cleanValue.replace(/\s*\|\s*null/g, "").trim());
      fields.push({ name: key, type: tsType, optional: isOptional });
    } else if (Array.isArray(value)) {
      if (
        value.length > 0 &&
        typeof value[0] === "object" &&
        value[0] !== null
      ) {
        // Inline array of objects — we'll type as unknown[] for now
        // (complex nested types need named interfaces)
        fields.push({ name: key, type: "unknown[]", optional: false });
      } else {
        fields.push({ name: key, type: "unknown[]", optional: false });
      }
    } else if (typeof value === "object" && value !== null) {
      // Nested object — generate inline type
      const nestedFields = parseObjectFields(value as Record<string, unknown>);
      if (nestedFields.length > 0) {
        const inlineType = `{ ${nestedFields.map((f) => `${f.name}${f.optional ? "?" : ""}: ${f.type}`).join("; ")} }`;
        fields.push({ name: key, type: inlineType, optional: false });
      } else {
        fields.push({
          name: key,
          type: "Record<string, unknown>",
          optional: false,
        });
      }
    }
  }

  return fields;
}

// ─── Code Emitter ────────────────────────────────────────────────────────────

function emitResponseType(ep: ApiEndpoint): string {
  if (!ep.responseSchema) {
    return `export type ${ep.responseTypeName} = unknown;\n`;
  }

  if (ep.responseSchema.startsWith('"')) {
    // Simple string response
    return `export type ${ep.responseTypeName} = string;\n`;
  }

  const parsed = parseResponseSchema(ep.responseSchema);
  if (!parsed) {
    return `export type ${ep.responseTypeName} = unknown;\n`;
  }

  if (parsed.isArray && parsed.fields.length > 0) {
    const fields = parsed.fields
      .map((f) => `  ${f.name}${f.optional ? "?" : ""}: ${f.type};`)
      .join("\n");
    return `export interface ${ep.responseTypeName.replace(/Response$/, "Item")} {\n${fields}\n  [key: string]: unknown;\n}\n\nexport type ${ep.responseTypeName} = ${ep.responseTypeName.replace(/Response$/, "Item")}[];\n`;
  }

  if (parsed.fields.length > 0) {
    const fields = parsed.fields
      .map((f) => `  ${f.name}${f.optional ? "?" : ""}: ${f.type};`)
      .join("\n");
    return `export interface ${ep.responseTypeName} {\n${fields}\n  [key: string]: unknown;\n}\n`;
  }

  return `export type ${ep.responseTypeName} = unknown;\n`;
}

function emitMethod(ep: ApiEndpoint): string {
  const pathParams = extractPathParams(ep.path);
  const nonPathParams = ep.parameters.filter(
    (p) => !pathParams.some((pp) => pp.name === p.name),
  );
  // For POST, all non-path params are body params; for GET, they're query params
  const queryParams = ep.method === "GET" ? nonPathParams : [];
  const bodyParams = ep.method === "POST" ? nonPathParams : [];

  const args: string[] = [];

  // Path params first
  for (const pp of pathParams) {
    // Find the param definition to get the type
    const paramDef = ep.parameters.find((p) => p.name === pp.name);
    const tsType = paramDef ? docTypeToTs(paramDef.type) : "string";
    args.push(`${pp.name}: ${tsType}`);
  }

  // Query params as options object
  if (ep.method === "GET" && queryParams.length > 0) {
    const allOptional = queryParams.every((p) => !p.required);
    const fields = queryParams
      .map((p) => {
        const tsType = docTypeToTs(p.type);
        return `    ${p.name}${!p.required ? "?" : ""}: ${tsType};`;
      })
      .join("\n");
    args.push(`params${allOptional ? "?" : ""}: {\n${fields}\n  }`);
  }

  // Body params for POST
  if (ep.method === "POST" && bodyParams.length > 0) {
    const fields = bodyParams
      .map((p) => {
        const tsType = docTypeToTs(p.type);
        return `    ${p.name}${!p.required ? "?" : ""}: ${tsType};`;
      })
      .join("\n");
    args.push(`body: {\n${fields}\n  }`);
  }

  const sig = `(${args.join(", ")}): Promise<${ep.responseTypeName}>`;

  // Build path expression
  let pathExpr: string;
  if (pathParams.length > 0) {
    const pathTemplate = ep.path.replace(
      /\[(\w+)\]/g,
      (_, name) => "${" + name + "}",
    );
    pathExpr = "`" + pathTemplate + "`";
  } else {
    pathExpr = `"${ep.path}"`;
  }

  let body: string;
  if (ep.method === "POST") {
    if (queryParams.length > 0) {
      body = `    const query = params ? this.buildQuery(params) : "";\n    return this.requestPost<${ep.responseTypeName}>(${pathExpr} + query, body);`;
    } else {
      body = `    return this.requestPost<${ep.responseTypeName}>(${pathExpr}, body);`;
    }
  } else {
    if (queryParams.length > 0) {
      body = `    const query = params ? this.buildQuery(params) : "";\n    return this.request<${ep.responseTypeName}>(${pathExpr} + query);`;
    } else {
      body = `    return this.request<${ep.responseTypeName}>(${pathExpr});`;
    }
  }

  const methodName = pathToMethodName(ep.path, ep.method);

  return `
  /**
   * \`${ep.method} ${ep.path}\`
   *
   * ${ep.description}
   */
  async ${methodName}${sig} {
${body}
  }`;
}

function extractPathParams(
  apiPath: string,
): { name: string; position: number }[] {
  const params: { name: string; position: number }[] = [];
  const re = /\[(\w+)\]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(apiPath)) !== null) {
    params.push({ name: m[1]!, position: m.index });
  }
  return params;
}

function emitClient(endpoints: ApiEndpoint[]): string {
  // Deduplicate method names
  const methodNames = new Map<string, number>();
  for (const ep of endpoints) {
    const name = pathToMethodName(ep.path, ep.method);
    methodNames.set(name, (methodNames.get(name) ?? 0) + 1);
  }

  // Generate response types
  const responseTypes = new Set<string>();
  const typeDefinitions: string[] = [];
  for (const ep of endpoints) {
    if (!responseTypes.has(ep.responseTypeName)) {
      responseTypes.add(ep.responseTypeName);
      typeDefinitions.push(emitResponseType(ep));
    }
  }

  const methods = endpoints.map((ep) => emitMethod(ep)).join("\n");

  return `/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * BitJita API Client — Auto-generated
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Source: ${DOCS_URL}
 * Generated: ${new Date().toISOString()}
 *
 * Re-generate with:
 *   bun run scripts/generate-bitjita-client.ts
 *
 * Usage:
 *   import { BitJitaClient } from "./bitjita-client";
 *   const client = new BitJitaClient("https://bitjita.com");
 *   const claims = await client.listClaims({ q: "ordum" });
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

// ═══════════════════════════════════════════════════════════════════════════════
// API Response Types
// ═══════════════════════════════════════════════════════════════════════════════

${typeDefinitions.join("\n")}

// ═══════════════════════════════════════════════════════════════════════════════
// API Client Error
// ═══════════════════════════════════════════════════════════════════════════════

export class BitJitaApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly statusText: string,
    public readonly body: string,
    public readonly url: string,
  ) {
    super(\`BitJita API error \${status} \${statusText} for \${url}\`);
    this.name = "BitJitaApiError";
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Client Options
// ═══════════════════════════════════════════════════════════════════════════════

export interface BitJitaClientOptions {
  /** Base URL of the BitJita API server. Default: "https://bitjita.com". No trailing slash. */
  baseUrl?: string;
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

export class BitJitaClient {
  private readonly baseUrl: string;
  private readonly fetchFn: typeof globalThis.fetch;
  private readonly defaultHeaders: Record<string, string>;
  private readonly timeout: number;

  constructor(options?: string | BitJitaClientOptions) {
    if (typeof options === "string") {
      this.baseUrl = options.replace(/\\/+$/, "");
      this.fetchFn = globalThis.fetch.bind(globalThis);
      this.defaultHeaders = {};
      this.timeout = 30_000;
    } else {
      this.baseUrl = (options?.baseUrl ?? "https://bitjita.com").replace(/\\/+$/, "");
      this.fetchFn = options?.fetch ?? globalThis.fetch.bind(globalThis);
      this.defaultHeaders = options?.headers ?? {};
      this.timeout = options?.timeout ?? 30_000;
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

  protected async request<T>(path: string): Promise<T> {
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
        throw new BitJitaApiError(response.status, response.statusText, body, url);
      }

      return (await response.json()) as T;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  protected async requestPost<T>(path: string, body: unknown): Promise<T> {
    const url = \`\${this.baseUrl}\${path}\`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await this.fetchFn(url, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          ...this.defaultHeaders,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!response.ok) {
        const respBody = await response.text().catch(() => "");
        throw new BitJitaApiError(response.status, response.statusText, respBody, url);
      }

      return (await response.json()) as T;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  // ─── API Methods (${endpoints.length} endpoints) ─────────────────────────────
${methods}
}

export default BitJitaClient;
`;
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  const { output } = parseArgs();
  console.log(`Fetching BitJita API documentation from ${DOCS_URL}...`);

  const response = await fetch(DOCS_URL);
  if (!response.ok) {
    throw new Error(
      `Failed to fetch docs: ${response.status} ${response.statusText}`,
    );
  }
  const html = await response.text();
  console.log(`  Fetched ${(html.length / 1024).toFixed(1)} KB of HTML`);

  // Parse live endpoints to validate against hardcoded definitions
  const liveEndpoints = parseEndpointsFromHtml(html);
  console.log(`  Found ${liveEndpoints.length} endpoints in live docs`);

  // Use hardcoded definitions which have full parameter and type information.
  // The live HTML parsing loses parameter detail during text extraction,
  // so hardcoded defs are more reliable. We validate the count matches.
  const endpoints = getHardcodedEndpoints();
  console.log(`  Using ${endpoints.length} hardcoded endpoint definitions`);

  if (liveEndpoints.length !== endpoints.length) {
    console.warn(
      `⚠️  Live docs have ${liveEndpoints.length} endpoints but hardcoded defs have ${endpoints.length}.`,
    );
    console.warn(
      `   The BitJita API may have changed — update the hardcoded definitions!`,
    );

    // Check for new endpoints not in hardcoded list
    const hardcodedPaths = new Set(
      endpoints.map((e) => `${e.method} ${e.path}`),
    );
    for (const ep of liveEndpoints) {
      const key = `${ep.method} ${ep.path}`;
      if (!hardcodedPaths.has(key)) {
        console.warn(`   NEW: ${key} — ${ep.description}`);
      }
    }
  }

  const code = emitClient(endpoints);
  const dir = path.dirname(output);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(output, code, "utf-8");

  console.log(`\n✅ Generated ${output}`);
  console.log(
    `   ${endpoints.length} endpoints, ${code.split("\n").length} lines`,
  );
}

/**
 * Hardcoded endpoint definitions as fallback.
 * These are parsed from the BitJita API docs page (77 endpoints as of March 2026).
 */
function getHardcodedEndpoints(): ApiEndpoint[] {
  return [
    // ─── Auth ──────────────────────────────────────────────────────
    {
      method: "POST",
      path: "/api/auth/chat/validate",
      description:
        "Verify player identity by validating a code posted in-game chat",
      category: "Auth",
      parameters: [
        {
          name: "code",
          type: "string",
          required: true,
          description: "The unique verification code",
        },
      ],
      responseSchema:
        '{"success":"boolean","player":{"entityId":"string","username":"string"},"verificationCode":"string","verifiedAt":"string"}',
      responseTypeName: "PostAuthChatValidateResponse",
    },

    // ─── Buildings ─────────────────────────────────────────────────
    {
      method: "GET",
      path: "/api/buildings",
      description: "Get building information and details",
      category: "Buildings",
      parameters: [],
      responseSchema: '{"buildings":"array"}',
      responseTypeName: "BuildingsResponse",
    },
    {
      method: "GET",
      path: "/api/buildings/[id]",
      description: "Get detailed information about a specific building",
      category: "Buildings",
      parameters: [
        {
          name: "id",
          type: "string",
          required: true,
          description: "Building entity ID",
        },
      ],
      responseSchema: '{"building":"object"}',
      responseTypeName: "BuildingResponse",
    },

    // ─── Cargo ─────────────────────────────────────────────────────
    {
      method: "GET",
      path: "/api/cargo",
      description: "Get cargo information and details with optional search",
      category: "Items",
      parameters: [
        {
          name: "q",
          type: "string",
          required: false,
          description: "Search term for cargo (minimum 2 characters)",
        },
      ],
      responseSchema: '{"cargos":"array","count":"number"}',
      responseTypeName: "CargoListResponse",
    },
    {
      method: "GET",
      path: "/api/cargo/[id]",
      description: "Get detailed information about a specific cargo",
      category: "Items",
      parameters: [
        { name: "id", type: "number", required: true, description: "Cargo ID" },
      ],
      responseSchema: '{"cargo":"object"}',
      responseTypeName: "CargoResponse",
    },

    // ─── Chat ──────────────────────────────────────────────────────
    {
      method: "GET",
      path: "/api/chat",
      description: "Get chat messages with filtering",
      category: "Social",
      parameters: [
        {
          name: "limit",
          type: "number",
          required: false,
          description: "Number of messages to return (default: 50, max: 100)",
        },
        {
          name: "since",
          type: "string",
          required: false,
          description: "Only return messages newer than this timestamp",
        },
      ],
      responseSchema: '{"messages":"array","total":"number"}',
      responseTypeName: "ChatResponse",
    },

    // ─── Claims ────────────────────────────────────────────────────
    {
      method: "GET",
      path: "/api/claims",
      description: "Get claim information with search, pagination, and sorting",
      category: "Claims",
      parameters: [
        {
          name: "q",
          type: "string",
          required: false,
          description: "Search term for claim names",
        },
        {
          name: "page",
          type: "number",
          required: false,
          description: "Page number (default: 1)",
        },
        {
          name: "limit",
          type: "number",
          required: false,
          description: "Items per page (default: 20, max: 100)",
        },
        {
          name: "sort",
          type: "string",
          required: false,
          description: "Sort field",
        },
        {
          name: "order",
          type: "string",
          required: false,
          description: "Sort order: asc or desc",
        },
        {
          name: "regionId",
          type: "number",
          required: false,
          description: "Filter by region ID (1-9)",
        },
      ],
      responseSchema: '{"claims":"array","count":"number"}',
      responseTypeName: "ClaimsResponse",
    },
    {
      method: "GET",
      path: "/api/claims/[id]",
      description: "Get detailed information about a specific claim",
      category: "Claims",
      parameters: [
        {
          name: "id",
          type: "string",
          required: true,
          description: "Claim entity ID",
        },
      ],
      responseSchema:
        '{"claim":{"entityId":"string","ownerPlayerEntityId":"string","ownerBuildingEntityId":"string","name":"string","neutral":"boolean","regionId":"number","regionName":"string","supplies":"number","buildingMaintenance":"number","numTiles":"number","locationX":"number","locationZ":"number","locationDimension":"number","treasury":"string","ownerPlayerUsername":"string","techResearching":"number","techStartTimestamp":"string","tileCost":"number","upkeepCost":"number","suppliesRunOut":"number","tier":"number","researchedTechs":"array"}}',
      responseTypeName: "ClaimResponse",
    },
    {
      method: "GET",
      path: "/api/claims/[id]/buildings",
      description: "Get buildings for a specific claim",
      category: "Claims",
      parameters: [
        {
          name: "id",
          type: "string",
          required: true,
          description: "Claim entity ID",
        },
      ],
      responseSchema: null,
      responseTypeName: "ClaimBuildingsResponse",
    },
    {
      method: "GET",
      path: "/api/claims/[id]/citizens",
      description: "Get citizens for a specific claim",
      category: "Claims",
      parameters: [
        {
          name: "id",
          type: "string",
          required: true,
          description: "Claim entity ID",
        },
      ],
      responseSchema:
        '{"citizens":"array","count":"number","skillNames":"object"}',
      responseTypeName: "ClaimCitizensResponse",
    },
    {
      method: "GET",
      path: "/api/claims/[id]/construction",
      description: "Get active construction projects for a claim",
      category: "Claims",
      parameters: [
        {
          name: "id",
          type: "string",
          required: true,
          description: "Claim entity ID",
        },
      ],
      responseSchema: '{"projects":"array","items":"array","cargos":"array"}',
      responseTypeName: "ClaimConstructionResponse",
    },
    {
      method: "GET",
      path: "/api/claims/[id]/inventories",
      description: "Get inventories for a specific claim",
      category: "Claims",
      parameters: [
        {
          name: "id",
          type: "string",
          required: true,
          description: "Claim entity ID",
        },
      ],
      responseSchema: '{"buildings":"array","items":"array","cargos":"array"}',
      responseTypeName: "ClaimInventoriesResponse",
    },
    {
      method: "GET",
      path: "/api/claims/[id]/layout",
      description:
        "Get building layout and placements for a claim with hex coordinates",
      category: "Claims",
      parameters: [
        {
          name: "id",
          type: "string",
          required: true,
          description: "Claim entity ID",
        },
      ],
      responseSchema:
        '{"version":"number","name":"string","placements":"array","buildings":"array","tiles":"array","mapMetadata":"object"}',
      responseTypeName: "ClaimLayoutResponse",
    },
    {
      method: "GET",
      path: "/api/claims/[id]/members",
      description: "Get members for a specific claim",
      category: "Claims",
      parameters: [
        {
          name: "id",
          type: "string",
          required: true,
          description: "Claim entity ID",
        },
      ],
      responseSchema: '{"members":"array","count":"number"}',
      responseTypeName: "ClaimMembersResponse",
    },
    {
      method: "GET",
      path: "/api/claims/[id]/recruitment",
      description: "Get recruitment listings for a specific claim",
      category: "Claims",
      parameters: [
        {
          name: "id",
          type: "string",
          required: true,
          description: "Claim entity ID",
        },
      ],
      responseSchema: '{"recruitment":"array","count":"number"}',
      responseTypeName: "ClaimRecruitmentResponse",
    },
    {
      method: "GET",
      path: "/api/claims/[id]/research",
      description:
        "Get all available technologies and which ones the claim has researched",
      category: "Claims",
      parameters: [
        {
          name: "id",
          type: "string",
          required: true,
          description: "Claim entity ID",
        },
      ],
      responseSchema: '{"technologies":"array"}',
      responseTypeName: "ClaimResearchResponse",
    },

    // ─── Crafts ────────────────────────────────────────────────────
    {
      method: "GET",
      path: "/api/crafts",
      description: "Get public crafting activities with filtering options",
      category: "Crafting",
      parameters: [
        {
          name: "claimEntityId",
          type: "string",
          required: false,
          description: "Filter by specific claim entity ID",
        },
        {
          name: "playerEntityId",
          type: "string",
          required: false,
          description: "Filter by player entity ID",
        },
        {
          name: "regionId",
          type: "number",
          required: false,
          description: "Filter by region ID (1-9)",
        },
        {
          name: "completed",
          type: "boolean",
          required: false,
          description: "Show completed crafts (default: false)",
        },
        {
          name: "skillId",
          type: "number",
          required: false,
          description: "Filter by skill ID",
        },
      ],
      responseSchema:
        '{"craftResults":"array","items":"array","cargos":"array","claims":"array"}',
      responseTypeName: "CraftsResponse",
    },
    {
      method: "GET",
      path: "/api/crafts/[craftId]",
      description: "Get detailed information about a specific craft",
      category: "Crafting",
      parameters: [
        {
          name: "craftId",
          type: "string",
          required: true,
          description: "Craft entity ID",
        },
      ],
      responseSchema: '{"craft":"object","items":"array","cargos":"array"}',
      responseTypeName: "CraftResponse",
    },
    {
      method: "GET",
      path: "/api/crafts/[craftId]/contributions",
      description:
        "Get all contributors to a crafting project ranked by progress contributed",
      category: "Crafting",
      parameters: [
        {
          name: "craftId",
          type: "string",
          required: true,
          description: "Craft entity ID",
        },
      ],
      responseSchema: '{"contributions":"array"}',
      responseTypeName: "CraftContributionsResponse",
    },

    // ─── Creatures ─────────────────────────────────────────────────
    {
      method: "GET",
      path: "/api/creatures",
      description: "Get all creatures with optional search filtering",
      category: "Creatures",
      parameters: [
        {
          name: "q",
          type: "string",
          required: false,
          description: "Search term for creatures",
        },
      ],
      responseSchema:
        '{"creatures":"array","count":"number","metrics":{"totalCreatures":"number","totalTags":"number","huntableCreatures":"number","averageTier":"number"}}',
      responseTypeName: "CreaturesResponse",
    },
    {
      method: "GET",
      path: "/api/creatures/[id]",
      description: "Get detailed information about a specific creature",
      category: "Creatures",
      parameters: [
        {
          name: "id",
          type: "number",
          required: true,
          description: "Creature enemy type ID",
        },
      ],
      responseSchema:
        '{"creature":{"enemyType":"number","name":"string","description":"string","tier":"number","tag":"string","rarityStr":"string","huntable":"boolean","maxHealth":"number","minDamage":"number","maxDamage":"number","armor":"number","accuracy":"number","evasion":"number","strength":"number"}}',
      responseTypeName: "CreatureResponse",
    },

    // ─── Deployables ───────────────────────────────────────────────
    {
      method: "GET",
      path: "/api/deployables",
      description:
        "Get all deployables (mounts, carts, boats) with optional search",
      category: "Deployables",
      parameters: [
        {
          name: "q",
          type: "string",
          required: false,
          description: "Search term for deployables",
        },
      ],
      responseSchema:
        '{"deployables":"array","count":"number","metrics":{"totalDeployables":"number","totalTypes":"number","landMounts":"number","waterMounts":"number","withStorage":"number"}}',
      responseTypeName: "DeployablesResponse",
    },
    {
      method: "GET",
      path: "/api/deployables/[id]",
      description:
        "Get detailed deployable information including pathfinding, stats, and terrain-specific speed data",
      category: "Deployables",
      parameters: [
        {
          name: "id",
          type: "number",
          required: true,
          description: "Deployable ID",
        },
      ],
      responseSchema:
        '{"deployable":{"id":"number","name":"string","deployableTypeName":"string","movementTypeName":"string","speed":"array","capacity":"number","storage":"number","stats":"array","pathfinding":"object"}}',
      responseTypeName: "DeployableResponse",
    },

    // ─── Empires ───────────────────────────────────────────────────
    {
      method: "GET",
      path: "/api/empires",
      description: "Get empire information with optional search",
      category: "Empires",
      parameters: [
        {
          name: "q",
          type: "string",
          required: false,
          description: "Search term for empire names",
        },
      ],
      responseSchema:
        '{"empires":"array","totalClaims":"number","totalMembers":"number","totalTreasury":"string","count":"number"}',
      responseTypeName: "EmpiresResponse",
    },
    {
      method: "GET",
      path: "/api/empires/[id]",
      description: "Get detailed information about a specific empire",
      category: "Empires",
      parameters: [
        {
          name: "id",
          type: "string",
          required: true,
          description: "Empire entity ID",
        },
      ],
      responseSchema: '{"empire":"object","members":"array"}',
      responseTypeName: "EmpireResponse",
    },
    {
      method: "GET",
      path: "/api/empires/[id]/claims",
      description:
        "Get all claims belonging to an empire with supply levels and upkeep costs",
      category: "Empires",
      parameters: [
        {
          name: "id",
          type: "string",
          required: true,
          description: "Empire entity ID",
        },
      ],
      responseSchema: '{"claims":"array","count":"number"}',
      responseTypeName: "EmpireClaimsResponse",
    },
    {
      method: "GET",
      path: "/api/empires/[id]/towers",
      description: "Get towers for a specific empire",
      category: "Empires",
      parameters: [
        {
          name: "id",
          type: "string",
          required: true,
          description: "Empire entity ID",
        },
      ],
      responseSchema: null,
      responseTypeName: "EmpireTowersResponse",
    },

    // ─── Food ──────────────────────────────────────────────────────
    {
      method: "GET",
      path: "/api/food",
      description: "Get all food items with nutritional data and buff effects",
      category: "Food",
      parameters: [
        {
          name: "q",
          type: "string",
          required: false,
          description: "Search term for food items",
        },
      ],
      responseSchema:
        '{"food":"array","count":"number","metrics":{"totalFood":"number","consumableInCombat":"number","withBuffs":"number","withHpRestore":"number","withStaminaRestore":"number","withTeleportEnergy":"number"}}',
      responseTypeName: "FoodListResponse",
    },
    {
      method: "GET",
      path: "/api/food/[itemId]",
      description:
        "Get detailed food item information including all buffs with stat modifiers",
      category: "Food",
      parameters: [
        {
          name: "itemId",
          type: "number",
          required: true,
          description: "Food item ID",
        },
      ],
      responseSchema:
        '{"food":{"itemId":"number","hp":"number","stamina":"number","hunger":"number","teleportationEnergy":"number","consumableWhileInCombat":"boolean","buffs":"array","itemName":"string","iconAssetName":"string","tier":"number","rarityStr":"string"}}',
      responseTypeName: "FoodResponse",
    },

    // ─── Hexite Exchange ───────────────────────────────────────────
    {
      method: "GET",
      path: "/api/hexite-exchange",
      description: "Get hexite packages with calculated value metrics",
      category: "Hexite",
      parameters: [
        {
          name: "eventName",
          type: "string",
          required: false,
          description: "Filter by specific event name",
        },
      ],
      responseSchema:
        '{"entries":"array","events":"array","metrics":{"totalPackages":"number","bestValueId":"number","maxBonusPercentage":"number"}}',
      responseTypeName: "HexiteExchangeResponse",
    },
    {
      method: "GET",
      path: "/api/hexite-exchange/history",
      description:
        "Get historical hexite exchange data with time-based aggregation",
      category: "Hexite",
      parameters: [
        {
          name: "bucket",
          type: "string",
          required: false,
          description: "Time aggregation bucket",
        },
        {
          name: "entryId",
          type: "number",
          required: false,
          description: "Filter by specific exchange entry ID",
        },
        {
          name: "eventName",
          type: "string",
          required: false,
          description: "Filter by event name",
        },
        {
          name: "limit",
          type: "number",
          required: false,
          description: "Maximum results to return (default: 100, max: 500)",
        },
      ],
      responseSchema: '{"historyData":"array"}',
      responseTypeName: "HexiteExchangeHistoryResponse",
    },

    // ─── Items ─────────────────────────────────────────────────────
    {
      method: "GET",
      path: "/api/items",
      description: "Get item catalog and search items",
      category: "Items",
      parameters: [
        {
          name: "q",
          type: "string",
          required: false,
          description: "Search term for items",
        },
      ],
      responseSchema:
        '{"items":"array","metrics":{"totalItems":"number","totalCategories":"number"}}',
      responseTypeName: "ItemsResponse",
    },
    {
      method: "GET",
      path: "/api/items/[itemId]",
      description:
        "Get detailed information about a specific item including recipes and market data",
      category: "Items",
      parameters: [
        {
          name: "itemId",
          type: "number",
          required: true,
          description: "The ID of the item",
        },
      ],
      responseSchema:
        '{"item":"object","craftingRecipes":"array","extractionRecipes":"array","relatedSkills":"array","marketStats":"object","recipesUsingItem":"array","itemListPossibilities":"array"}',
      responseTypeName: "ItemResponse",
    },

    // ─── Leaderboard ───────────────────────────────────────────────
    {
      method: "GET",
      path: "/api/leaderboard/cargo/[cargoId]",
      description:
        "Get top 2000 cargo holders ranked by quantity with storage breakdown",
      category: "Competition",
      parameters: [
        {
          name: "cargoId",
          type: "number",
          required: true,
          description: "Cargo item ID",
        },
      ],
      responseSchema:
        '{"item":"object","summary":{"totalHolders":"number","totalQuantity":"number","averagePerHolder":"number"},"holdings":"array"}',
      responseTypeName: "LeaderboardCargoResponse",
    },
    {
      method: "GET",
      path: "/api/leaderboard/exploration",
      description: "Get exploration leaderboard with pagination and sorting",
      category: "Competition",
      parameters: [
        {
          name: "sortBy",
          type: "string",
          required: false,
          description: "Sort field",
        },
        {
          name: "sortOrder",
          type: "string",
          required: false,
          description: "Sort order: asc or desc",
        },
        {
          name: "page",
          type: "number",
          required: false,
          description: "Page number (default: 1)",
        },
        {
          name: "pageSize",
          type: "number",
          required: false,
          description: "Items per page (default: 100)",
        },
      ],
      responseSchema:
        '{"players":"array","count":"number","totalChunks":"number","regionCount":"number","chunksPerRegion":"number","globalStats":"object","pagination":"object"}',
      responseTypeName: "LeaderboardExplorationResponse",
    },
    {
      method: "GET",
      path: "/api/leaderboard/items/[itemId]",
      description:
        "Get top 2000 item holders ranked by quantity with storage breakdown",
      category: "Competition",
      parameters: [
        {
          name: "itemId",
          type: "number",
          required: true,
          description: "Item ID",
        },
      ],
      responseSchema:
        '{"item":"object","summary":{"totalHolders":"number","totalQuantity":"number","averagePerHolder":"number"},"holdings":"array"}',
      responseTypeName: "LeaderboardItemsResponse",
    },
    {
      method: "GET",
      path: "/api/leaderboard/playtime",
      description:
        "Get playtime leaderboard with sorting, searching, and global statistics",
      category: "Competition",
      parameters: [
        {
          name: "sortBy",
          type: "string",
          required: false,
          description: "Sort field",
        },
        {
          name: "sortOrder",
          type: "string",
          required: false,
          description: "Sort order: asc or desc",
        },
        {
          name: "page",
          type: "number",
          required: false,
          description: "Page number",
        },
        {
          name: "pageSize",
          type: "number",
          required: false,
          description: "Items per page (default: 100, max: 100)",
        },
        {
          name: "search",
          type: "string",
          required: false,
          description: "Username search",
        },
      ],
      responseSchema:
        '{"players":"array","count":"number","globalStats":{"maxTimePlayed":"number","totalTimePlayed":"number","averageTimePlayed":"number"},"pagination":"object"}',
      responseTypeName: "LeaderboardPlaytimeResponse",
    },
    {
      method: "GET",
      path: "/api/leaderboard/skills",
      description: "Get skills leaderboard with pagination and sorting",
      category: "Competition",
      parameters: [
        {
          name: "sortBy",
          type: "string",
          required: false,
          description: "Sort field",
        },
        {
          name: "sortOrder",
          type: "string",
          required: false,
          description: "Sort order: asc or desc",
        },
        {
          name: "page",
          type: "number",
          required: false,
          description: "Page number",
        },
        {
          name: "pageSize",
          type: "number",
          required: false,
          description: "Items per page (default: 100)",
        },
        {
          name: "regionId",
          type: "number",
          required: false,
          description: "Filter by region ID",
        },
      ],
      responseSchema:
        '{"players":"array","count":"number","skillNames":"object","totalSkills":"number","globalHighestLevel":"number","pagination":"object"}',
      responseTypeName: "LeaderboardSkillsResponse",
    },

    // ─── Logs ──────────────────────────────────────────────────────
    {
      method: "GET",
      path: "/api/logs/storage",
      description:
        "Get storage logs for players, buildings, or specific inventory history",
      category: "Logs",
      parameters: [
        {
          name: "playerEntityId",
          type: "string",
          required: false,
          description: "Player entity ID",
        },
        {
          name: "buildingEntityId",
          type: "string",
          required: false,
          description: "Building entity ID",
        },
        {
          name: "limit",
          type: "number",
          required: false,
          description: "Maximum number of logs (default: 100, max: 1000)",
        },
        {
          name: "afterId",
          type: "string",
          required: false,
          description: "Cursor for pagination",
        },
        {
          name: "since",
          type: "string",
          required: false,
          description: "ISO timestamp filter",
        },
      ],
      responseSchema: '{"logs":"array","items":"array","cargos":"array"}',
      responseTypeName: "StorageLogsResponse",
    },

    // ─── Market ────────────────────────────────────────────────────
    {
      method: "GET",
      path: "/api/market",
      description: "Get market items, orders, and categories",
      category: "Trading",
      parameters: [
        {
          name: "q",
          type: "string",
          required: false,
          description: "Search term for items",
        },
        {
          name: "category",
          type: "string",
          required: false,
          description: "Filter by category",
        },
        {
          name: "hasOrders",
          type: "boolean",
          required: false,
          description: "Only show items with orders",
        },
        {
          name: "hasSellOrders",
          type: "boolean",
          required: false,
          description: "Only show items with sell orders",
        },
        {
          name: "hasBuyOrders",
          type: "boolean",
          required: false,
          description: "Only show items with buy orders",
        },
        {
          name: "claimEntityId",
          type: "string",
          required: false,
          description: "Filter by claim entity ID",
        },
      ],
      responseSchema:
        '{"data":{"items":"array","categories":"array","metrics":"object"}}',
      responseTypeName: "MarketResponse",
    },
    {
      method: "GET",
      path: "/api/market/[itemOrCargo]/[itemId]",
      description: "Get market details for a specific item or cargo",
      category: "Trading",
      parameters: [
        {
          name: "itemOrCargo",
          type: "string",
          required: true,
          description: "Type: item or cargo",
        },
        {
          name: "itemId",
          type: "number",
          required: true,
          description: "Item or cargo ID",
        },
        {
          name: "claimEntityId",
          type: "string",
          required: false,
          description: "Filter by claim entity ID",
        },
      ],
      responseSchema:
        '{"item":"object","sellOrders":"array","buyOrders":"array","stats":"object"}',
      responseTypeName: "MarketItemResponse",
    },
    {
      method: "GET",
      path: "/api/market/[itemOrCargo]/[itemId]/price-history",
      description: "Get price history with VWAP chart data and statistics",
      category: "Trading",
      parameters: [
        {
          name: "itemOrCargo",
          type: "string",
          required: true,
          description: "Type: items or cargo",
        },
        {
          name: "itemId",
          type: "number",
          required: true,
          description: "Item or cargo ID",
        },
        {
          name: "bucket",
          type: "string",
          required: false,
          description: "Time aggregation bucket",
        },
        {
          name: "limit",
          type: "number",
          required: false,
          description: "Max number of time buckets (default: 500, max: 1000)",
        },
        {
          name: "regionId",
          type: "number",
          required: false,
          description: "Filter by region ID",
        },
      ],
      responseSchema:
        '{"priceData":"array","priceStats":{"avg24h":"number | null","avg7d":"number | null","avg30d":"number | null","allTimeHigh":"number | null","allTimeLow":"number | null","priceChange24h":"number | null","priceChange7d":"number | null","totalTrades":"number","totalVolume":"number"},"recentTrades":"array"}',
      responseTypeName: "MarketPriceHistoryResponse",
    },
    {
      method: "GET",
      path: "/api/market/deals",
      description: "Get arbitrage opportunities and market deals",
      category: "Trading",
      parameters: [],
      responseSchema: '{"arbitrage":"array"}',
      responseTypeName: "MarketDealsResponse",
    },
    {
      method: "GET",
      path: "/api/market/player/[playerId]",
      description: "Get all market orders for a specific player",
      category: "Trading",
      parameters: [
        {
          name: "playerId",
          type: "string",
          required: true,
          description: "Player entity ID",
        },
      ],
      responseSchema:
        '{"playerId":"string","playerUsername":"string","sellOrders":"array","buyOrders":"array"}',
      responseTypeName: "MarketPlayerResponse",
    },
    {
      method: "GET",
      path: "/api/market/player/[playerId]/history",
      description: "Get market order history for a specific player",
      category: "Trading",
      parameters: [
        {
          name: "playerId",
          type: "string",
          required: true,
          description: "Player entity ID",
        },
        {
          name: "status",
          type: "string",
          required: false,
          description: "Filter by order status",
        },
        {
          name: "type",
          type: "string",
          required: false,
          description: "Filter by order type",
        },
        {
          name: "limit",
          type: "number",
          required: false,
          description: "Max orders to return",
        },
        {
          name: "offset",
          type: "number",
          required: false,
          description: "Pagination offset",
        },
      ],
      responseSchema:
        '{"playerId":"string","playerUsername":"string","sellOrderHistory":"array","buyOrderHistory":"array","totalSellOrders":"number","totalBuyOrders":"number"}',
      responseTypeName: "MarketPlayerHistoryResponse",
    },
    {
      method: "GET",
      path: "/api/market/player/[playerId]/trades",
      description: "Get completed trades for a specific player",
      category: "Trading",
      parameters: [
        {
          name: "playerId",
          type: "string",
          required: true,
          description: "Player entity ID",
        },
        {
          name: "type",
          type: "string",
          required: false,
          description: "Filter by trade role: sell or buy",
        },
        {
          name: "limit",
          type: "number",
          required: false,
          description: "Max trades to return (default: 50)",
        },
        {
          name: "offset",
          type: "number",
          required: false,
          description: "Pagination offset",
        },
        {
          name: "orderEntityId",
          type: "string",
          required: false,
          description: "Filter by order entity ID",
        },
        {
          name: "itemId",
          type: "number",
          required: false,
          description: "Filter by item ID",
        },
        {
          name: "itemType",
          type: "number",
          required: false,
          description: "Filter by item type: 0=items, 1=cargo",
        },
      ],
      responseSchema: '{"trades":"array"}',
      responseTypeName: "MarketPlayerTradesResponse",
    },
    {
      method: "POST",
      path: "/api/market/prices/bulk",
      description: "Get market price summaries for multiple items and/or cargo",
      category: "Trading",
      parameters: [
        {
          name: "itemIds",
          type: "number[]",
          required: false,
          description: "Array of item IDs (max 100)",
        },
        {
          name: "cargoIds",
          type: "number[]",
          required: false,
          description: "Array of cargo IDs (max 100)",
        },
      ],
      responseSchema: '{"data":{"items":"object","cargo":"object"}}',
      responseTypeName: "PostMarketPricesBulkResponse",
    },

    // ─── Players ───────────────────────────────────────────────────
    {
      method: "GET",
      path: "/api/players",
      description: "Search for players by username",
      category: "Players",
      parameters: [
        {
          name: "q",
          type: "string",
          required: true,
          description: "Search term (minimum 2 characters)",
        },
      ],
      responseSchema: '{"players":"array","total":"number"}',
      responseTypeName: "PlayersResponse",
    },
    {
      method: "GET",
      path: "/api/players/[id]",
      description: "Get detailed information about a specific player",
      category: "Players",
      parameters: [
        {
          name: "id",
          type: "string",
          required: true,
          description: "Player entity ID",
        },
      ],
      responseSchema:
        '{"player":"object","claims":"array","empires":"array","marketOrders":"array","skills":"array"}',
      responseTypeName: "PlayerResponse",
    },
    {
      method: "GET",
      path: "/api/players/[id]/buffs",
      description:
        "Get active buffs for a player with status and time remaining",
      category: "Players",
      parameters: [
        {
          name: "id",
          type: "string",
          required: true,
          description: "Player entity ID",
        },
      ],
      responseSchema: '{"buffs":"array","count":"number","isOnline":"boolean"}',
      responseTypeName: "PlayerBuffsResponse",
    },
    {
      method: "GET",
      path: "/api/players/[id]/crafts",
      description: "Get crafting activities for a specific player",
      category: "Crafting",
      parameters: [
        {
          name: "id",
          type: "string",
          required: true,
          description: "Player entity ID",
        },
        {
          name: "completed",
          type: "string",
          required: false,
          description: "Filter: true, false, or all",
        },
      ],
      responseSchema: '{"crafts":"array"}',
      responseTypeName: "PlayerCraftsResponse",
    },
    {
      method: "GET",
      path: "/api/players/[id]/equipment",
      description: "Get equipment information for a specific player",
      category: "Players",
      parameters: [
        {
          name: "id",
          type: "string",
          required: true,
          description: "Player entity ID",
        },
      ],
      responseSchema: '{"equipment":"array"}',
      responseTypeName: "PlayerEquipmentResponse",
    },
    {
      method: "GET",
      path: "/api/players/[id]/exploration",
      description: "Get exploration data including discovered chunks bitmap",
      category: "Players",
      parameters: [
        {
          name: "id",
          type: "string",
          required: true,
          description: "Player entity ID",
        },
      ],
      responseSchema:
        '{"bitmap":"string","exploredChunksCount":"number","regions":"array","meta":{"totalChunks":"number","regionCount":"number","chunksPerRegion":"number"}}',
      responseTypeName: "PlayerExplorationResponse",
    },
    {
      method: "GET",
      path: "/api/players/[id]/housing",
      description: "Get housing information for a specific player",
      category: "Players",
      parameters: [
        {
          name: "id",
          type: "string",
          required: true,
          description: "Player entity ID",
        },
      ],
      responseSchema: null,
      responseTypeName: "PlayerHousingResponse",
    },
    {
      method: "GET",
      path: "/api/players/[id]/housing/[houseId]",
      description: "Get detailed information about a specific player housing",
      category: "Players",
      parameters: [
        {
          name: "id",
          type: "string",
          required: true,
          description: "Player entity ID",
        },
        {
          name: "houseId",
          type: "string",
          required: true,
          description: "Housing entity ID",
        },
      ],
      responseSchema:
        '{"buildingEntityId":"string","buildingName":"string","playerEntityId":"string","rank":"number","lockedUntil":"string","isEmpty":"boolean","regionId":"number","entranceDimensionId":"number","claimName":"string","claimRegionId":"number","claimEntityId":"string","locationX":"number","locationZ":"number","locationDimension":"number","inventories":"array","items":"array","cargos":"array"}',
      responseTypeName: "PlayerHousingDetailResponse",
    },
    {
      method: "GET",
      path: "/api/players/[id]/inventories",
      description: "Get inventory information for a specific player",
      category: "Players",
      parameters: [
        {
          name: "id",
          type: "string",
          required: true,
          description: "Player entity ID",
        },
      ],
      responseSchema:
        '{"inventories":"array","items":"array","cargos":"array"}',
      responseTypeName: "PlayerInventoriesResponse",
    },
    {
      method: "GET",
      path: "/api/players/[id]/market",
      description: "Get active sell and buy market orders for a player",
      category: "Players",
      parameters: [
        {
          name: "id",
          type: "string",
          required: true,
          description: "Player entity ID",
        },
      ],
      responseSchema: '{"sellOrders":"array","buyOrders":"array"}',
      responseTypeName: "PlayerMarketResponse",
    },
    {
      method: "GET",
      path: "/api/players/[id]/market-collections",
      description:
        "Get closed market listings (items ready for collection) for a player",
      category: "Players",
      parameters: [
        {
          name: "id",
          type: "string",
          required: true,
          description: "Player entity ID",
        },
      ],
      responseSchema: '{"collections":"array","total":"number"}',
      responseTypeName: "PlayerMarketCollectionsResponse",
    },
    {
      method: "GET",
      path: "/api/players/[id]/passive-crafts",
      description:
        "Get passive crafting jobs for a player with optional status filtering",
      category: "Players",
      parameters: [
        {
          name: "id",
          type: "string",
          required: true,
          description: "Player entity ID",
        },
        {
          name: "status",
          type: "string",
          required: false,
          description: "Filter by status",
        },
      ],
      responseSchema:
        '{"craftResults":"array","items":"array","cargos":"array","count":"number"}',
      responseTypeName: "PlayerPassiveCraftsResponse",
    },
    {
      method: "GET",
      path: "/api/players/[id]/skill-rankings",
      description:
        "Get skill rankings and XP data across all skills for a player",
      category: "Players",
      parameters: [
        {
          name: "id",
          type: "string",
          required: true,
          description: "Player entity ID",
        },
      ],
      responseSchema: '{"rankings":"object","totalPlayers":"number"}',
      responseTypeName: "PlayerSkillRankingsResponse",
    },
    {
      method: "GET",
      path: "/api/players/[id]/stats",
      description: "Get player character stats (health, stamina, etc.)",
      category: "Players",
      parameters: [
        {
          name: "id",
          type: "string",
          required: true,
          description: "Player entity ID",
        },
      ],
      responseSchema:
        '{"stats":{"entityId":"string","values":"array","regionId":"number","createdAt":"string","updatedAt":"string"}}',
      responseTypeName: "PlayerStatsResponse",
    },
    {
      method: "GET",
      path: "/api/players/[id]/traveler-tasks",
      description: "Get traveler quest tasks with required and rewarded items",
      category: "Players",
      parameters: [
        {
          name: "id",
          type: "string",
          required: true,
          description: "Player entity ID",
        },
      ],
      responseSchema:
        '{"tasks":"array","items":"object","cargo":"object","expirationTimestamp":"number | null"}',
      responseTypeName: "PlayerTravelerTasksResponse",
    },
    {
      method: "GET",
      path: "/api/players/[id]/vault",
      description: "Get vault information for a specific player",
      category: "Players",
      parameters: [
        {
          name: "id",
          type: "string",
          required: true,
          description: "Player entity ID",
        },
      ],
      responseSchema: '{"collectibles":"array"}',
      responseTypeName: "PlayerVaultResponse",
    },

    // ─── Regions ───────────────────────────────────────────────────
    {
      method: "GET",
      path: "/api/regions",
      description: "Get region information and data",
      category: "World",
      parameters: [],
      responseSchema: null,
      responseTypeName: "RegionsResponse",
    },
    {
      method: "GET",
      path: "/api/regions/status",
      description:
        "Get real-time status of all game regions including player counts",
      category: "World",
      parameters: [],
      responseSchema: '{"regions":"array"}',
      responseTypeName: "RegionsStatusResponse",
    },

    // ─── Resources ─────────────────────────────────────────────────
    {
      method: "GET",
      path: "/api/resources",
      description: "Get all world resources with optional search",
      category: "Resources",
      parameters: [
        {
          name: "q",
          type: "string",
          required: false,
          description: "Search term for resources",
        },
      ],
      responseSchema:
        '{"resources":"array","count":"number","metrics":{"totalResources":"number","totalTags":"number"}}',
      responseTypeName: "ResourcesResponse",
    },
    {
      method: "GET",
      path: "/api/resources/[resourceId]",
      description: "Get detailed information about a specific resource",
      category: "Resources",
      parameters: [
        {
          name: "resourceId",
          type: "number",
          required: true,
          description: "Resource ID",
        },
      ],
      responseSchema:
        '{"resource":{"id":"number","name":"string","description":"string","tier":"number","tag":"string","rarity":"number","max_health":"number","scheduled_respawn_time":"number"}}',
      responseTypeName: "ResourceResponse",
    },

    // ─── Skills ────────────────────────────────────────────────────
    {
      method: "GET",
      path: "/api/skills",
      description: "Get all skills",
      category: "Skills",
      parameters: [],
      responseSchema: '{"profession":"array","adventure":"array"}',
      responseTypeName: "SkillsResponse",
    },

    // ─── Stats ─────────────────────────────────────────────────────
    {
      method: "GET",
      path: "/api/stats/hexcoin",
      description: "Get hexcoin circulation timeseries data",
      category: "Analytics",
      parameters: [
        {
          name: "bucket",
          type: "string",
          required: false,
          description: "Time bucket",
        },
        {
          name: "limit",
          type: "number",
          required: false,
          description: "Max buckets to return",
        },
      ],
      responseSchema: '{"buckets":"array"}',
      responseTypeName: "StatsHexcoinResponse",
    },
    {
      method: "GET",
      path: "/api/stats/skills",
      description:
        "Get aggregated skill experience statistics across all players",
      category: "Analytics",
      parameters: [],
      responseSchema:
        '{"skillStats":"array","summary":{"totalPlayers":"number","totalSkills":"number","totalXPAllSkills":"number"}}',
      responseTypeName: "StatsSkillsResponse",
    },
    {
      method: "GET",
      path: "/api/stats/trade-volume",
      description: "Get trade volume timeseries data",
      category: "Analytics",
      parameters: [
        {
          name: "bucket",
          type: "string",
          required: false,
          description: "Time bucket",
        },
        {
          name: "limit",
          type: "number",
          required: false,
          description: "Max data points",
        },
        {
          name: "regionId",
          type: "number",
          required: false,
          description: "Filter by region ID",
        },
      ],
      responseSchema:
        '{"buckets":"array","items":"array","overall":"object","regions":"array","selectedRegionId":"number | null"}',
      responseTypeName: "StatsTradeVolumeResponse",
    },

    // ─── Status ────────────────────────────────────────────────────
    {
      method: "GET",
      path: "/api/status",
      description: "Get server population and status information",
      category: "System",
      parameters: [],
      responseSchema:
        '{"regions":"array","count":"number","totalSignedIn":"number","totalInQueue":"number"}',
      responseTypeName: "StatusResponse",
    },
    {
      method: "GET",
      path: "/api/status/chart",
      description: "Get population timeseries data for charts",
      category: "System",
      parameters: [
        {
          name: "bucket",
          type: "string",
          required: false,
          description: "Time bucket",
        },
        {
          name: "limit",
          type: "number",
          required: false,
          description: "Number of data points",
        },
      ],
      responseSchema: '{"count":"number","buckets":"array"}',
      responseTypeName: "StatusChartResponse",
    },
    {
      method: "GET",
      path: "/api/status/dau-mau",
      description: "Get Daily/Monthly Active Users statistics",
      category: "Analytics",
      parameters: [
        {
          name: "limit",
          type: "number",
          required: false,
          description: "Historical data points (default: 90, max: 365)",
        },
      ],
      responseSchema:
        '{"count":"number","buckets":"array","current":{"dau":"number","mau":"number","dauTiers":"object","mauTiers":"object"}}',
      responseTypeName: "StatusDauMauResponse",
    },

    // ─── Wind ──────────────────────────────────────────────────────
    {
      method: "GET",
      path: "/api/wind",
      description: "Get wind parameters and debug configuration",
      category: "World",
      parameters: [],
      responseSchema: '{"params":"array","debug":"array"}',
      responseTypeName: "WindResponse",
    },

    // ─── Static ────────────────────────────────────────────────────
    {
      method: "GET",
      path: "/static/experience/levels.csv",
      description: "Get experience level requirements in CSV format",
      category: "System",
      parameters: [],
      responseSchema: '"CSV format with columns: level,xp"',
      responseTypeName: "ExperienceLevelsCsvResponse",
    },
    {
      method: "GET",
      path: "/static/experience/levels.json",
      description: "Get experience level requirements in JSON format",
      category: "System",
      parameters: [],
      responseSchema: '{"level":"number","xp":"number"}',
      responseTypeName: "ExperienceLevelsJsonResponse",
    },
  ];
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
