export interface LinkSnapshot {
  beat: number;
  bpm: number;
  peers: number;
  at: number;
}
export class LinkClient {
  socket?: WebSocket;
  timer?: ReturnType<typeof setInterval>;
  lastMessage = 0;
  onSnapshot = (_snapshot: LinkSnapshot) => {};
  onStatus = (_message: string, _connected: boolean) => {};
  connect(url: string) {
    this.disconnect();
    const parsed = new URL(url);
    if (!["ws:", "wss:"].includes(parsed.protocol))
      throw new Error("Use a ws:// or wss:// relay URL.");
    const socket = (this.socket = new WebSocket(parsed.href));
    this.lastMessage = performance.now();
    socket.onopen = () => {
      this.onStatus("Relay connected; waiting for Link timing…", false);
      const poll = () => {
        if (performance.now() - this.lastMessage > 3000) {
          this.disconnect();
          this.onStatus("Link relay timed out.", false);
          return;
        }
        if (socket.readyState === WebSocket.OPEN)
          socket.send(
            JSON.stringify({
              type: "sync",
              sent: performance.timeOrigin + performance.now(),
            }),
          );
      };
      poll();
      this.timer = setInterval(poll, 100);
    };
    socket.onmessage = (event) => {
      try {
        const m = JSON.parse(event.data),
          now = performance.timeOrigin + performance.now();
        if (
          m.type !== "sync" ||
          ![m.sent, m.beat, m.bpm, m.peers].every(Number.isFinite) ||
          m.bpm < 30 ||
          m.bpm > 300 ||
          now - m.sent < 0 ||
          now - m.sent > 1000
        )
          return;
        this.lastMessage = performance.now();
        this.onSnapshot({
          beat: m.beat,
          bpm: m.bpm,
          peers: m.peers,
          at: (now + m.sent) / 2,
        });
        this.onStatus(
          `Link connected · ${m.peers} peer${m.peers === 1 ? "" : "s"}`,
          true,
        );
      } catch {
        /* Ignore malformed relay data. */
      }
    };
    socket.onerror = () =>
      this.onStatus(
        "Relay unavailable. Check its address, TLS certificate, and local network access.",
        false,
      );
    socket.onclose = () => {
      clearInterval(this.timer);
      this.onStatus("Link disconnected", false);
    };
  }
  disconnect() {
    clearInterval(this.timer);
    if (this.socket) {
      this.socket.onclose = null;
      this.socket.onerror = null;
      this.socket.onmessage = null;
      this.socket.onopen = null;
      this.socket.close();
    }
    this.socket = undefined;
    this.onStatus("Link disconnected", false);
  }
}
