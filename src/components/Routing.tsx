import { useEffect, useState } from "react";
import { Cable, Unplug } from "lucide-react";
import { midi, link, setLinkReady, stop } from "../engine/runtime";
import { useStore } from "../state/store";
import type { SyncMode } from "../engine/types";
import { Panel } from "./Controls";
export function Routing() {
  const c = useStore((s) => s.project.config),
    set = useStore((s) => s.configure);
  const [ports, setPorts] = useState(0),
    [busy, setBusy] = useState(false),
    [status, setStatus] = useState("Not connected");
  const [url, setUrl] = useState("wss://localhost:20808"),
    [linkStatus, setLinkStatus] = useState("Relay disconnected"),
    [connected, setConnected] = useState(false);
  useEffect(() => {
    midi.onPorts = () => setPorts((n) => n + 1);
    link.onStatus = (message, ready) => {
      setLinkStatus(message);
      setConnected(ready);
      setLinkReady(ready);
    };
    return () => {
      midi.onPorts = () => {};
      link.onStatus = () => {};
    };
  }, []);
  async function connect() {
    setBusy(true);
    try {
      await midi.connect();
      setStatus("MIDI access enabled");
    } catch (e) {
      setStatus(
        e instanceof Error ? e.message : "MIDI permission was declined.",
      );
    } finally {
      setBusy(false);
    }
  }
  void ports;
  return (
    <Panel
      title="Output & synchronization"
      eyebrow="06 / CONNECTIONS"
      className="routing-panel"
      actions={<Cable size={18} className="muted" />}
    >
      <div className="routing-grid">
        <div>
          <div className="routing-heading">
            <h3>Web MIDI</h3>
            <button
              className="small-button"
              onClick={() => void connect()}
              disabled={busy}
            >
              {busy
                ? "Connecting…"
                : midi.access
                  ? "Refresh devices"
                  : "Enable MIDI"}
            </button>
          </div>
          <p className="helper" role="status">
            {status}
          </p>
          <label className="field-label">
            Output device
            <select
              value={midi.output?.id ?? ""}
              onChange={(e) => {
                stop();
                midi.selectOutput(e.target.value);
                setPorts((n) => n + 1);
              }}
            >
              <option value="">Internal synth only</option>
              {Array.from(midi.access?.outputs.values() ?? []).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          <div className="field-row">
            <label>
              MIDI channel
              <select
                value={c.channel}
                onChange={(e) => set({ channel: Number(e.target.value) })}
              >
                {Array.from({ length: 16 }, (_, i) => (
                  <option key={i} value={i + 1}>
                    {i + 1}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Output delay · ms
              <input
                type="number"
                min="0"
                max="200"
                value={c.midiLatency}
                onChange={(e) =>
                  set({
                    midiLatency: Math.max(
                      0,
                      Math.min(200, Number(e.target.value)),
                    ),
                  })
                }
              />
            </label>
          </div>
        </div>
        <div>
          <div className="routing-heading">
            <h3>Clock source</h3>
            <span className="muted mono">24 PPQN</span>
          </div>
          <label className="field-label">
            Synchronization
            <select
              value={c.sync}
              onChange={(e) =>
                set({ sync: e.target.value as SyncMode, clockOut: false })
              }
            >
              <option value="internal">Internal</option>
              <option value="midi">External MIDI clock</option>
              <option value="link">Ableton Link relay</option>
            </select>
          </label>
          {c.sync === "midi" ? (
            <>
              <label className="field-label">
                Clock input
                <select
                  value={midi.input?.id ?? ""}
                  onChange={(e) => {
                    stop();
                    midi.selectInput(e.target.value);
                    setPorts((n) => n + 1);
                  }}
                >
                  <option value="">Select an input</option>
                  {Array.from(midi.access?.inputs.values() ?? []).map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </label>
              <p className="helper">
                Press Arm, then Start on your hardware or DAW. Start, Stop, and
                Continue are supported.
              </p>
            </>
          ) : (
            <>
              <label className="checkbox-field">
                <input
                  type="checkbox"
                  checked={c.clockOut}
                  onChange={(e) => set({ clockOut: e.target.checked })}
                />
                Send MIDI clock & transport
              </label>
              <p className="helper">
                Clock follows the selected tempo. Swing affects notes, never
                clock pulses.
              </p>
            </>
          )}
        </div>
        <div>
          <div className="routing-heading">
            <h3>Ableton Link</h3>
            <span className={`status-dot ${connected ? "on" : ""}`} />
          </div>
          <label className="field-label">
            Companion relay URL
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="wss://localhost:20808"
            />
          </label>
          <button
            className="small-button relay-button"
            onClick={() => {
              if (connected || link.socket) link.disconnect();
              else
                try {
                  link.connect(url);
                } catch (e) {
                  setLinkStatus(
                    e instanceof Error ? e.message : "Invalid relay URL.",
                  );
                }
            }}
          >
            {connected ? <Unplug size={14} /> : <Cable size={14} />}{" "}
            {connected ? "Disconnect relay" : "Connect relay"}
          </button>
          <p className="helper" role="status">
            {linkStatus}
          </p>
          <a
            className="text-link"
            href="https://github.com/djshellshoxxx/Markov-Stochastic-Pattern-Generator/blob/main/relay/README.md"
            target="_blank"
            rel="noreferrer"
          >
            Relay setup guide ↗
          </a>
        </div>
      </div>
    </Panel>
  );
}
