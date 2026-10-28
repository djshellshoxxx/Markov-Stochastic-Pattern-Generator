import { createServer as httpServer } from "node:http";
import { createServer as httpsServer } from "node:https";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { WebSocketServer } from "ws";
export function createRelay(
  link,
  {
    port = 20808,
    host = "127.0.0.1",
    origins = ["https://djshellshoxxx.github.io", "http://localhost:5173"],
    tls,
  } = {},
) {
  const handler = (_req, res) => {
    res.writeHead(200, { "Content-Type": "text/plain" });
    res.end("MARKOV Ableton Link relay\n");
  };
  const server = tls ? httpsServer(tls, handler) : httpServer(handler);
  const wss = new WebSocketServer({
    server,
    maxPayload: 1024,
    verifyClient: ({ origin }) => origins.includes(origin),
  });
  wss.on("connection", (socket) => {
    let last = 0;
    socket.on("message", (data) => {
      const now = performance.now();
      if (now - last < 20) return;
      last = now;
      try {
        const m = JSON.parse(data.toString());
        if (m.type !== "sync" || !Number.isFinite(m.sent)) return;
        socket.send(
          JSON.stringify({
            type: "sync",
            sent: m.sent,
            beat: link.getBeat(),
            bpm: link.getTempo(),
            peers: link.getNumPeers(),
          }),
        );
      } catch {
        /* Invalid packets are ignored; the client times out. */
      }
    });
  });
  server.listen(port, host);
  return {
    server,
    wss,
    close: async () => {
      for (const client of wss.clients) client.terminate();
      await new Promise((resolve) => wss.close(resolve));
      await new Promise((resolve) => server.close(resolve));
    },
  };
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  try {
    const { AbletonLink } = await import("@ktamas77/abletonlink");
    const link = new AbletonLink(120);
    link.enable(true);
    const origins = (
      process.env.ALLOWED_ORIGINS ??
      "https://djshellshoxxx.github.io,http://localhost:5173"
    )
      .split(",")
      .map((s) => s.trim());
    const tls =
      process.env.TLS_CERT && process.env.TLS_KEY
        ? {
            cert: readFileSync(process.env.TLS_CERT),
            key: readFileSync(process.env.TLS_KEY),
          }
        : undefined;
    const relay = createRelay(link, {
      port: Number(process.env.PORT ?? 20808),
      origins,
      tls,
    });
    console.log(
      `Link relay: ${tls ? "wss" : "ws"}://localhost:${process.env.PORT ?? 20808}`,
    );
    if (!tls)
      console.log(
        "For the HTTPS GitHub Pages app, configure TLS_CERT and TLS_KEY with a trusted localhost certificate.",
      );
    async function shutdown() {
      link.enable(false);
      await relay.close();
      process.exit(0);
    }
    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);
  } catch (error) {
    console.error(
      "Unable to start the native Ableton Link relay:",
      error.message,
    );
    process.exitCode = 1;
  }
}
