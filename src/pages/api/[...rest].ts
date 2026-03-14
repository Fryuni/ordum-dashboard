import type { APIRoute } from "astro";
import { API_BASE_URL } from "../../lib/api";
import { AdaptedCache, LruCache, SharedInFlightCache, StaleWhileRevalidateCache, type CacheProvider } from "@croct/cache";
import { hash } from "ohash";

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

async function makeRequest(req: RequestDescription): Promise<ResponseDescription> {
  const res = await fetch(req.url, {
    method: req.method,
    body: req.body ? JSON.stringify(req.body) : null,
  });
  const body = await res.text();
  return {
    status: res.status,
    statusText: res.statusText,
    contentType: res.headers.get('Content-Type')!,
    body,
  }
}

const apiCache: CacheProvider<RequestDescription, ResponseDescription> = AdaptedCache.transformKeys(
  new SharedInFlightCache(
    new StaleWhileRevalidateCache({
      freshPeriod: 20,
      cacheProvider: LruCache.ofCapacity(1 << 15),
    }),
  ),
  hash,
);

export const ALL: APIRoute = async (ctx) => {
  const originalUrl = new URL(ctx.request.url);
  const newUrl = new URL(`${API_BASE_URL}/${ctx.params.rest}`);
  newUrl.search = originalUrl.search;

  const req: RequestDescription = {
    url: newUrl.toString(),
    method: ctx.request.method,
    body: ctx.request.method !== 'GET' ? await ctx.request.json() : null,
  }

  const res = await apiCache.get(req, makeRequest);

  return new Response(res.body, {
    status: res.status,
    statusText: res.statusText,
    headers: {
      "Content-Type": res.contentType
    },
  });
};
