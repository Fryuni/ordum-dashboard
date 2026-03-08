#!/usr/bin/env bun
/**
 * Quick smoke test for the generated Bitcraft Hub API client.
 *
 * Usage:
 *   BITCRAFT_API_URL=http://localhost:3000 bun run test-api-client.ts
 */

import { BitcraftApiClient, type PlayersResponse } from "./src/bitcraft-api-client";

const baseUrl = process.env.BITCRAFT_API_URL;
if (!baseUrl) {
  console.error("Error: set BITCRAFT_API_URL (e.g. http://localhost:3000)");
  process.exit(1);
}

const client = new BitcraftApiClient({ baseUrl, timeout: 10_000 });

console.log(`Testing Bitcraft API client against ${baseUrl}\n`);

try {
  const res: PlayersResponse = await client.listPlayers({
    page: 1,
    per_page: 10,
    online: true,
  });

  console.log(`✅ listPlayers returned successfully`);
  console.log(`   Total online players: ${res.total}`);
  console.log(`   Page ${res.page}, showing ${res.players.length} of ${res.perPage} per page\n`);

  for (const p of res.players) {
    const status = p.signed_in ? "🟢 online" : "⚪ offline";
    console.log(`   ${status}  ${p.username}  (id: ${p.entity_id})`);
  }
} catch (err) {
  console.error("❌ Request failed:", err);
  process.exit(1);
}
