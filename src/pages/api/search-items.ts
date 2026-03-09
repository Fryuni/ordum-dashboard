import type { APIRoute } from "astro";
import { loadGameData } from "../../lib/gamedata";
import { searchItems } from "../../lib/craft-planner";

const gd = loadGameData();

export const GET: APIRoute = ({ url }) => {
  const q = url.searchParams.get("q") ?? "";
  if (q.length < 2) {
    return new Response(JSON.stringify([]), { headers: { "Content-Type": "application/json" } });
  }
  const results = searchItems(gd, q, 20);
  return new Response(JSON.stringify(results), { headers: { "Content-Type": "application/json" } });
};
