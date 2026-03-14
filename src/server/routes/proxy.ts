import * as path from "node:path";
import {
  AdaptedCache,
  LruCache,
  SharedInFlightCache,
  StaleWhileRevalidateCache,
  type CacheProvider,
} from "@croct/cache";
import { hash } from "ohash";
import { makeRoutes } from "../type-helpers";

// ─── API Proxy Cache ───────────────────────────────────────────────────────────

interface RequestDescription {
  url: string;
  method: string;
  body?: unknown;
}

interface ResponseDescription {
  status: number;
  statusText: string;
  contentType: string;
  body: string;
}

async function makeRequest(
  req: RequestDescription,
): Promise<ResponseDescription> {
  const res = await fetch(req.url, {
    method: req.method,
    body: req.body ? JSON.stringify(req.body) : null,
  });
  const body = JSON.parse(await res.text(), (_key, value, ctx) =>
    typeof value === "number" &&
    !ctx.source.includes(".") &&
    !Number.isSafeInteger(value)
      ? ctx.source
      : value,
  );
  return {
    status: res.status,
    statusText: res.statusText,
    contentType: res.headers.get("Content-Type") ?? "application/json",
    body: JSON.stringify(body),
  };
}

const makeApiCache = (): CacheProvider<
  RequestDescription,
  ResponseDescription
> =>
  AdaptedCache.transformKeys(
    new SharedInFlightCache(
      new StaleWhileRevalidateCache({
        freshPeriod: 20,
        cacheProvider: LruCache.ofCapacity(1 << 15),
      }),
    ),
    hash,
  );

const resubakaCache = makeApiCache();
const jitaCache = makeApiCache();

export const proxyRoutes = makeRoutes({
  "/jita/:*": async (request) => {
    const url = new URL(request.url);
    const rest = url.pathname.slice("/jita/".length);
    const newUrl = new URL(`https://bitjita.com/${rest}`);
    newUrl.search = url.search;

    const req: RequestDescription = {
      url: newUrl.toString(),
      method: request.method,
      body:
        request.method !== "GET"
          ? await request.json().catch(() => null)
          : undefined,
    };

    try {
      const res = await jitaCache.get(req, makeRequest);
      return new Response(res.body, {
        status: res.status,
        statusText: res.statusText,
        headers: { "Content-Type": res.contentType },
      });
    } catch (error) {
      console.error("API proxy error:", error);
      return Response.json({ error: "API proxy error" }, { status: 502 });
    }
  },

  // API Proxy — forward /api/* to upstream
  "/resubaka/*": async (request) => {
    const url = new URL(request.url);
    const rest = url.pathname.slice("/resubaka/".length);
    const newUrl = new URL(`https://craft-api.resubaka.dev/${rest}`);
    newUrl.search = url.search;

    const req: RequestDescription = {
      url: newUrl.toString(),
      method: request.method,
      body:
        request.method !== "GET"
          ? await request.json().catch(() => null)
          : undefined,
    };

    try {
      const res = await resubakaCache.get(req, makeRequest);
      return new Response(res.body, {
        status: res.status,
        statusText: res.statusText,
        headers: { "Content-Type": res.contentType },
      });
    } catch (error) {
      console.error("API proxy error:", error);
      return Response.json({ error: "API proxy error" }, { status: 502 });
    }
  },
});
