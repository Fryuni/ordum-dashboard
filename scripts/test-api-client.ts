#!/usr/bin/env bun
/**
 * Quick smoke test for the generated Bitcraft Hub API client (REST + WebSocket).
 *
 * Usage:
 *   BITCRAFT_API_URL=https://craft-api.resubaka.dev bun run test-api-client.ts
 */

import {
  BitcraftApiClient,
  BitcraftLiveClient,
  type PlayersResponse,
  type WebSocketMessageType,
} from "./src/bitcraft-api-client";

const baseUrl = process.env.BITCRAFT_API_URL;
if (!baseUrl) {
  console.error(
    "Error: set BITCRAFT_API_URL (e.g. https://craft-api.resubaka.dev)",
  );
  process.exit(1);
}

// ─── REST Test ───────────────────────────────────────────────────────────────

const client = new BitcraftApiClient({ baseUrl, timeout: 10_000 });

console.log(`Testing Bitcraft API client against ${baseUrl}\n`);
console.log("── REST ──────────────────────────────────────────");

try {
  const res: PlayersResponse = await client.listPlayers({
    page: 1,
    per_page: 10,
    online: true,
  });

  console.log(`✅ listPlayers returned successfully`);
  console.log(`   Total online players: ${res.total}`);
  console.log(
    `   Page ${res.page}, showing ${res.players.length} of ${res.perPage} per page\n`,
  );

  for (const p of res.players) {
    const status = p.signed_in ? "🟢 online" : "⚪ offline";
    console.log(`   ${status}  ${p.username}  (id: ${p.entity_id})`);
  }
} catch (err) {
  console.error("❌ REST request failed:", err);
  process.exit(1);
}

// ─── WebSocket Test ──────────────────────────────────────────────────────────

console.log("\n── WebSocket ─────────────────────────────────────");

const live = new BitcraftLiveClient({
  baseUrl,
  encoding: "Json",
  autoReconnect: false,
});

let messageCount = 0;

await new Promise<void>((resolve) => {
  const timeout = setTimeout(() => {
    console.log(`\n   Received ${messageCount} message(s) in 8 seconds`);
    live.disconnect();
    resolve();
  }, 8_000);

  live.onOpen = () => {
    console.log("✅ WebSocket connected\n");

    // Subscribe to a broad topic to catch some live traffic
    live.subscribe(
      "PlayerState",
      "player_state.0",
      (content) => {
        messageCount++;
        if (messageCount <= 5) {
          console.log(`   📡 PlayerState: entity_id=${content?.entity_id}`);
        } else if (messageCount === 6) {
          console.log(`   ... (more messages arriving)`);
        }
      },
      "test-player-state",
    );

    // Also listen for any raw messages to demonstrate the hook
    live.onRawMessage = (msg) => {
      if (messageCount === 0) {
        console.log(`   First raw message type: ${msg.t}`);
      }
    };
  };

  live.onError = () => {
    console.log(
      "⚠️  WebSocket error (server may not have live updates enabled)",
    );
    clearTimeout(timeout);
    live.disconnect();
    resolve();
  };

  live.onClose = (event) => {
    if (!live.isConnected && messageCount === 0) {
      console.log(`   WebSocket closed (code: ${event.code})`);
      clearTimeout(timeout);
      resolve();
    }
  };

  live.connect();
});

console.log("\n✅ All tests complete");
