import type { APIRoute } from "astro";
import { API_BASE_URL } from "../../lib/api";

export const ALL: APIRoute = async (ctx) => {
  const requestUrl = new URL(ctx.request.url);
  const newUrl = new URL(requestUrl.pathname, API_BASE_URL);
  console.log("Proxying to:", newUrl.toString());
  const res = await fetch(newUrl, {
    method: ctx.request.method,
    body: ctx.request.body,
  });

  return new Response(res.body, {
    status: res.status,
    statusText: res.statusText,
    headers: {
      "Content-Type": res.headers.get("Content-Type")!,
    },
  });
};
