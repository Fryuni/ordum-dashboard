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
import { serverJita } from "./server/api-server";
import { ORDUM_EMPIRE_NAME } from "./common/ordum-types";
import { buildClaimInventory } from "./common/claim-inventory";
import { buildSettlementPlan } from "./common/settlement-planner";
import { gd } from "./common/gamedata";

type Bindings = {
  ASSETS: Fetcher;
};

const app = new Hono<{ Bindings: Bindings }>();

// ─── API Routes ────────────────────────────────────────────────────────────────

app.get("/api/empire", async (c) => {
  try {
    const empire = await fetchEmpireData();
    return c.json(empire);
  } catch (e) {
    console.error("Failed to fetch empire data:", e);
    return c.json({ error: String(e) }, 500);
  }
});

app.get("/api/empire-claims", async (c) => {
  try {
    const empires = await serverJita.listEmpires({ q: ORDUM_EMPIRE_NAME });
    const empire = (empires.empires as any[]).find(
      (e: any) => e.name?.toLowerCase() === ORDUM_EMPIRE_NAME.toLowerCase(),
    );
    if (!empire) {
      return c.json({ error: "Empire not found" }, 404);
    }

    const claimsData = await serverJita.getEmpireClaims(empire.entityId);
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
    const claimId = c.req.query("claim") || ORDUM_MAIN_CLAIM_ID;
    const { claim } = await serverJita.getClaim(claimId);
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

// ─── BitJita Proxy ─────────────────────────────────────────────────────────────

app.all("/jita/*", async (c) => {
  const url = new URL(c.req.url);
  const rest = url.pathname.slice("/jita/".length);
  const newUrl = new URL(`https://bitjita.com/${rest}`);
  newUrl.search = url.search;

  try {
    const upstream = await fetch(newUrl.toString(), {
      method: c.req.method,
      headers: { Accept: "application/json" },
      body: c.req.method !== "GET" ? await c.req.text() : undefined,
    });

    // Parse and re-serialize to handle BigInt safety (matching original behavior)
    const text = await upstream.text();
    const body = JSON.parse(text, (_key, value, ctx) =>
      typeof value === "number" &&
      !(ctx as any).source.includes(".") &&
      !Number.isSafeInteger(value)
        ? (ctx as any).source
        : value,
    );

    return c.json(body, upstream.status as any);
  } catch (error) {
    console.error("API proxy error:", error);
    return c.json({ error: "API proxy error" }, 502);
  }
});

export default app;
