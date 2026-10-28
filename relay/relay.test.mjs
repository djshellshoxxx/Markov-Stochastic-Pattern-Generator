import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import WebSocket from "ws";
import { createRelay } from "./server.mjs";
test("relay returns timing snapshots and rejects unapproved origins", async () => {
  const relay = createRelay(
    { getBeat: () => 12.25, getTempo: () => 128, getNumPeers: () => 2 },
    { port: 0, origins: ["http://localhost:5173"] },
  );
  await once(relay.server, "listening");
  try {
    const url = `ws://127.0.0.1:${relay.server.address().port}`;
    const client = new WebSocket(url, { origin: "http://localhost:5173" });
    await once(client, "open");
    const reply = once(client, "message");
    client.send(JSON.stringify({ type: "sync", sent: 1200 }));
    assert.deepEqual(JSON.parse((await reply)[0].toString()), {
      type: "sync",
      sent: 1200,
      beat: 12.25,
      bpm: 128,
      peers: 2,
    });
    client.close();
    await once(client, "close");
    const denied = new WebSocket(url, { origin: "https://untrusted.example" });
    const [error] = await once(denied, "error");
    assert.match(error.message, /401/);
  } finally {
    await relay.close();
  }
});
