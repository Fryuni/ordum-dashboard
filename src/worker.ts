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
 * Ordum Dashboard — BitJita Proxy (Cloudflare Worker)
 *
 * A standalone proxy that forwards /jita/* requests to bitjita.com with
 * BigInt-safe JSON parsing.  Deployed independently from the static client.
 *
 * The static client is configured to reach this proxy via VITE_PROXY_URL.
 */
import { Hono } from "hono";
import { cors } from "hono/cors";

const app = new Hono();

// Allow any origin — the proxy carries no auth and only forwards public data.
app.use("/*", cors());

// ─── BitJita Proxy ─────────────────────────────────────────────────────────────

/** Fetch from upstream BitJita and return the BigInt-safe parsed body. */
async function fetchUpstream(url: string, method: string, body?: string) {
  const upstream = await fetch(url, {
    method,
    headers: { Accept: "application/json" },
    body: method !== "GET" ? body : undefined,
  });

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
    const body = await fetchUpstream(target, c.req.method, await c.req.text());
    return c.json(body);
  } catch (error) {
    console.error("API proxy error:", error);
    return c.json({ error: "API proxy error" }, 502);
  }
});

export default {
  fetch: app.fetch,
};
