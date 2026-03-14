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
 * Ordum Dashboard — Bun HTTP Server
 *
 * Serves the SPA via HTML import (automatic bundling),
 * server-side data endpoints, and an API proxy.
 */
import homepage from "./client/index.html";
import { fetchEmpireData } from "./server/ordum-data";
import { ORDUM_MAIN_CLAIM_ID } from "./server/ordum-data";
import { serverResubaka, serverJita } from "./server/api-server";
import { ORDUM_EMPIRE_NAME } from "./common/ordum-types";
import { buildClaimInventory } from "./common/claim-inventory";
import { buildSettlementPlan } from "./common/settlement-planner";
import { gd } from "./common/gamedata";
import {
  AdaptedCache,
  LruCache,
  SharedInFlightCache,
  StaleWhileRevalidateCache,
  type CacheProvider,
} from "@croct/cache";
import { hash } from "ohash";
import { proxyRoutes } from "./server/routes/proxy";

const API_BASE_URL = "https://craft-api.resubaka.dev";
const PORT = parseInt(process.env.PORT ?? "4321", 10);
const HOST = process.env.HOST ?? "0.0.0.0";
const isDev = process.env.NODE_ENV !== "production";

// ─── Server ────────────────────────────────────────────────────────────────────

Bun.serve({
  port: PORT,
  hostname: HOST,
  development: isDev,

  routes: {
    ...proxyRoutes,

    // SPA — all non-API routes serve the HTML (Bun bundles the TSX/CSS automatically)
    "/*": homepage,

    // Server-side data endpoints
    "/api/empire": {
      async GET() {
        try {
          const empire = await fetchEmpireData();
          return Response.json(empire);
        } catch (e) {
          console.error("Failed to fetch empire data:", e);
          return Response.json({ error: String(e) }, { status: 500 });
        }
      },
    },

    "/api/empire-claims": {
      async GET() {
        try {
          // Look up the Ordum empire by name via BitJita
          const empires = await serverJita.listEmpires({
            q: ORDUM_EMPIRE_NAME,
          });
          const empire = (empires.empires as any[]).find(
            (e: any) =>
              e.name?.toLowerCase() === ORDUM_EMPIRE_NAME.toLowerCase(),
          );
          if (!empire) {
            return Response.json(
              { error: "Empire not found" },
              { status: 404 },
            );
          }

          const claimsData = await serverJita.getEmpireClaims(empire.entityId);
          const claims = (claimsData.claims as any[]).map((c: any) => ({
            id: c.entityId,
            name: c.name,
          }));

          return Response.json({ claims });
        } catch (e) {
          console.error("Failed to fetch empire claims:", e);
          return Response.json({ error: String(e) }, { status: 500 });
        }
      },
    },

    "/api/settlement": {
      async GET() {
        try {
          const claim = await serverResubaka.getClaim(ORDUM_MAIN_CLAIM_ID);
          const currentTier = claim.tier ?? 1;
          const supplies = claim.supplies ?? 0;
          const learnedIds = new Set<number>(claim.learned_upgrades ?? []);
          const claimName = claim.name ?? "Unknown Claim";
          const inventory = await buildClaimInventory(ORDUM_MAIN_CLAIM_ID);
          const plans = buildSettlementPlan(
            currentTier,
            learnedIds,
            supplies,
            inventory,
          );

          return Response.json({
            currentTier,
            supplies,
            learnedCount: learnedIds.size,
            totalTechs: gd.claimTechs.length,
            claimName,
            plans,
          });
        } catch (e) {
          console.error("Failed to fetch settlement data:", e);
          return Response.json({ error: String(e) }, { status: 500 });
        }
      },
    },
  },

  fetch(_request) {
    return new Response("Not Found", { status: 404 });
  },
});

console.log(`🚀 Ordum Dashboard running at http://${HOST}:${PORT}`);
