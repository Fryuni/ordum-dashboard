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
 * Ordum Dashboard — Cloudflare Worker
 *
 * Handles API routes and proxies to BitJita.
 * Static assets (SPA) are served by Cloudflare's asset binding.
 */
import { Hono } from "hono";
import { fetchEmpireData } from "./server/ordum-data";
import { ORDUM_MAIN_CLAIM_ID } from "./server/ordum-data";
import { buildCache, createServerJita } from "./server/api-server";
import { ORDUM_EMPIRE_NAME } from "./common/ordum-types";
import type { CacheProvider } from "@croct/cache";
import { buildClaimInventory } from "./common/claim-inventory";
import { buildSettlementPlan } from "./common/settlement-planner";
import { gd } from "./common/gamedata";
import { fetchContribution } from "./server/contribution";
import type BitJitaClient from "./common/bitjita-client";

type Bindings = {
  ASSETS: Fetcher;
  jita_api_cache: KVNamespace;
};

type Variables = {
  jita: BitJitaClient;
};

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>();

// ─── Middleware: create a KV-backed API client per-isolate ───────────────────

let cachedJita: BitJitaClient | null = null;
let proxyCache: CacheProvider<any, any> | null = null;

app.use("*", async (c, next) => {
  if (cachedJita === null) {
    cachedJita = createServerJita(c.env.jita_api_cache);
    proxyCache = buildCache(c.env.jita_api_cache, 5);
  }
  c.set("jita", cachedJita);
  return next();
});

// ─── API Routes ────────────────────────────────────────────────────────────────

app.get("/api/empire", async (c) => {
  try {
    const empire = await fetchEmpireData(c.get("jita"));
    return c.json(empire);
  } catch (e) {
    console.error("Failed to fetch empire data:", e);
    return c.json({ error: String(e) }, 500);
  }
});

app.get("/api/empire-claims", async (c) => {
  try {
    const jita = c.get("jita");
    const empires = await jita.listEmpires({ q: ORDUM_EMPIRE_NAME });
    const empire = (empires.empires as any[]).find(
      (e: any) => e.name?.toLowerCase() === ORDUM_EMPIRE_NAME.toLowerCase(),
    );
    if (!empire) {
      return c.json({ error: "Empire not found" }, 404);
    }

    const claimsData = await jita.getEmpireClaims(empire.entityId);
    const claims = (claimsData.claims as any[]).map((cl: any) => ({
      id: cl.entityId,
      name: cl.name,
    }));

    return c.json({ claims });
  } catch (e) {
    console.error("Failed to fetch empire claims:", e);
    return c.json({ error: String(e) }, 500);
  }
});

app.get("/api/settlement", async (c) => {
  try {
    const jita = c.get("jita");
    const claimId = c.req.query("claim") || ORDUM_MAIN_CLAIM_ID;
    const { claim } = await jita.getClaim(claimId);
    const currentTier = claim.tier ?? 1;
    const supplies = Number(claim.supplies) || 0;
    const learnedIds = new Set<number>(
      (claim.researchedTechs ?? []).map((t: any) => Number(t.id)),
    );
    const claimName = claim.name ?? "Unknown Claim";
    const rawInventory = await buildClaimInventory(claimId);
    // Convert ItemPlace[] map to totals map for the settlement planner
    const inventory = new Map<string, number>();
    for (const [key, places] of rawInventory) {
      inventory.set(
        key,
        places.reduce((sum, p) => sum + p.quantity, 0),
      );
    }
    const plans = buildSettlementPlan(
      currentTier,
      learnedIds,
      supplies,
      inventory,
    );

    return c.json({
      currentTier,
      supplies,
      learnedCount: learnedIds.size,
      totalTechs: gd.claimTechs.length,
      claimName,
      plans,
    });
  } catch (e) {
    console.error("Failed to fetch settlement data:", e);
    return c.json({ error: String(e) }, 500);
  }
});

app.get("/api/construction", async (c) => {
  try {
    const jita = c.get("jita");
    const claimId = c.req.query("claim") || ORDUM_MAIN_CLAIM_ID;
    const [constructionData, claimInv] = await Promise.all([
      jita.getClaimConstruction(claimId),
      jita.getClaimInventories(claimId),
    ]);

    // Build item/cargo lookup dicts
    const itemsDict: Record<string, any> = {};
    for (const item of (constructionData as any).items ?? []) {
      itemsDict[String(item.id)] = item;
    }
    // Also include items from claim inventories for broader coverage
    for (const item of claimInv.items ?? []) {
      if (!itemsDict[String(item.id)]) {
        itemsDict[String(item.id)] = item;
      }
    }
    const cargosDict: Record<string, any> = {};
    for (const cargo of (constructionData as any).cargos ?? []) {
      cargosDict[String(cargo.id)] = cargo;
    }
    for (const cargo of claimInv.cargos ?? []) {
      if (!cargosDict[String(cargo.id)]) {
        cargosDict[String(cargo.id)] = cargo;
      }
    }

    // Build construction recipe index
    const recipeIndex = new Map<number, (typeof gd.constructionRecipes)[0]>();
    for (const r of gd.constructionRecipes) {
      recipeIndex.set(r.id, r);
    }

    // Process each construction project
    const projects = ((constructionData as any).projects ?? []).map(
      (project: any) => {
        const recipe = recipeIndex.get(project.constructionRecipeId);
        const depositedItems: Record<string, number> = {};
        for (const pocket of project.inventory ?? []) {
          if (!pocket.contents) continue;
          const itemType =
            pocket.contents.item_type === "cargo" ? "Cargo" : "Item";
          const key = `${itemType}:${pocket.contents.item_id}`;
          depositedItems[key] =
            (depositedItems[key] ?? 0) + (pocket.contents.quantity ?? 0);
        }

        const requirements = [
          ...(recipe?.consumed_item_stacks ?? []).map((s) => {
            const key = `Item:${s.item_id}`;
            const info = itemsDict[String(s.item_id)];
            const deposited = depositedItems[key] ?? 0;
            return {
              item_type: "Item" as const,
              item_id: s.item_id,
              name:
                info?.name ??
                gd.items.get(s.item_id)?.name ??
                `Item #${s.item_id}`,
              icon: info?.iconAssetName ?? "",
              tier: info?.tier ?? gd.items.get(s.item_id)?.tier ?? 0,
              tag: info?.tag ?? gd.items.get(s.item_id)?.tag ?? "",
              quantity_required: s.quantity,
              quantity_deposited: deposited,
              fulfilled: deposited >= s.quantity,
            };
          }),
          ...(recipe?.consumed_cargo_stacks ?? []).map((s) => {
            const key = `Cargo:${s.item_id}`;
            const info = cargosDict[String(s.item_id)];
            const deposited = depositedItems[key] ?? 0;
            return {
              item_type: "Cargo" as const,
              item_id: s.item_id,
              name:
                info?.name ??
                gd.cargo.get(s.item_id)?.name ??
                `Cargo #${s.item_id}`,
              icon: info?.iconAssetName ?? "",
              tier: info?.tier ?? gd.cargo.get(s.item_id)?.tier ?? 0,
              tag: info?.tag ?? gd.cargo.get(s.item_id)?.tag ?? "",
              quantity_required: s.quantity,
              quantity_deposited: deposited,
              fulfilled: deposited >= s.quantity,
            };
          }),
        ];

        const totalRequired = requirements.reduce(
          (s, r) => s + r.quantity_required,
          0,
        );
        const totalDeposited = requirements.reduce(
          (s, r) => s + Math.min(r.quantity_deposited, r.quantity_required),
          0,
        );

        return {
          entity_id: project.entityId ?? project.entity_id ?? "",
          building_name:
            project.buildingNickname ??
            project.buildingName ??
            recipe?.name ??
            "Unknown Building",
          construction_recipe_id: project.constructionRecipeId,
          recipe_name: recipe?.name ?? "Unknown Recipe",
          requirements,
          total_required: totalRequired,
          total_deposited: totalDeposited,
          progress_pct:
            totalRequired > 0
              ? Math.round((totalDeposited / totalRequired) * 100)
              : 0,
        };
      },
    );

    return c.json({ projects });
  } catch (e) {
    console.error("Failed to fetch construction data:", e);
    return c.json({ error: String(e) }, 500);
  }
});

app.get("/api/contribution", async (c) => {
  try {
    const jita = c.get("jita");
    const claimId = c.req.query("claim") || ORDUM_MAIN_CLAIM_ID;
    const playerEntityId = c.req.query("player");
    if (!playerEntityId) {
      return c.json({ error: "player query parameter is required" }, 400);
    }
    const result = await fetchContribution(
      jita,
      c.env.jita_api_cache,
      claimId,
      playerEntityId,
    );
    return c.json(result);
  } catch (e) {
    console.error("Failed to fetch contribution data:", e);
    return c.json({ error: String(e) }, 500);
  }
});

// ─── BitJita Proxy ─────────────────────────────────────────────────────────────

/** Fetch from upstream BitJita and return the BigInt-safe parsed body. */
async function fetchUpstream(url: string, method: string, body?: string) {
  const upstream = await fetch(url, {
    method,
    headers: { Accept: "application/json" },
    body: method !== "GET" ? body : undefined,
  });

  // Parse and re-serialize to handle BigInt safety (matching original behavior)
  const text = await upstream.text();
  return JSON.parse(text, (_key, value, ctx) =>
    typeof value === "number" &&
    !(ctx as any).source.includes(".") &&
    !Number.isSafeInteger(value)
      ? (ctx as any).source
      : value,
  );
}

app.all("/jita/*", async (c) => {
  const url = new URL(c.req.url);
  const rest = url.pathname.slice("/jita/".length);
  const newUrl = new URL(`https://bitjita.com/${rest}`);
  newUrl.search = url.search;
  const target = newUrl.toString();

  try {
    // Cache GET requests through the SWR proxy cache
    if (c.req.method === "GET" && proxyCache !== null) {
      const body = await proxyCache.get(target, () =>
        fetchUpstream(target, "GET"),
      );
      return c.json(body);
    }

    const body = await fetchUpstream(target, c.req.method, await c.req.text());
    return c.json(body);
  } catch (error) {
    console.error("API proxy error:", error);
    return c.json({ error: "API proxy error" }, 502);
  }
});

export default app;
