import { Play, Square, Radio, Volume2, AudioLines } from "lucide-react";
import { useRef } from "react";
import { useStore } from "../state/store";
import { start, stop } from "../engine/runtime";
import { clamp } from "../engine/math";
export function Transport() {
  const config = useStore((s) => s.project.config),
    playing = useStore((s) => s.playing),
    step = useStore((s) => s.step);
  const configure = useStore((s) => s.configure),
    taps = useRef<number[]>([]);
  function tap() {
    const now = performance.now();
    taps.current = taps.current.filter((t) => now - t < 2500).slice(-5);
    taps.current.push(now);
    if (taps.current.length > 1)
      configure({
        bpm: Math.round(
          clamp(
            (60000 * (taps.current.length - 1)) / (now - taps.current[0]),
            30,
            300,
          ),
        ),
      });
  }
  return (
    <section className="transport" aria-label="Transport">
      <div className="transport-buttons">
        <button
          className={`play-button ${playing ? "playing" : ""}`}
          onClick={() => (playing ? stop() : void start())}
          aria-label={playing ? "Stop playback" : "Start playback"}
        >
          {playing ? (
            <Square size={17} fill="currentColor" />
          ) : (
            <Play size={18} fill="currentColor" />
          )}
          {playing ? "Stop" : config.sync === "midi" ? "Arm" : "Play"}
        </button>
        <button
          className="icon-button panic"
          onClick={stop}
          title="Stop and send all notes off"
          aria-label="Panic — all notes off"
        >
          <Square size={16} />
        </button>
      </div>
      <div className="tempo">
        <label>
          <span className="eyebrow">TEMPO</span>
          <div>
            <input
              aria-label="Tempo BPM"
              type="number"
              min="30"
              max="300"
              step="1"
              value={Math.round(config.bpm * 10) / 10}
              disabled={config.sync !== "internal"}
              onChange={(e) =>
                configure({ bpm: clamp(Number(e.target.value), 30, 300) })
              }
            />
            <small>BPM</small>
          </div>
        </label>
        <button
          className="subtle-button"
          disabled={config.sync !== "internal"}
          onClick={tap}
        >
          TAP
        </button>
      </div>
      <div className="transport-position">
        <span className="eyebrow">POSITION</span>
        <span className="position">
          {String(Math.floor(Math.max(0, step) / 16) + 1).padStart(2, "0")}
          <b>:</b>
          {String(Math.floor((Math.max(0, step) % 16) / 4) + 1).padStart(
            2,
            "0",
          )}
          <b>:</b>
          {(Math.max(0, step) % 4) + 1}
        </span>
      </div>
      <div className="clock-label">
        <Radio size={15} />
        <span>
          {config.sync === "internal"
            ? "Internal clock"
            : config.sync === "midi"
              ? "MIDI clock"
              : "Ableton Link"}
          <small>{playing ? "TRANSPORT ACTIVE" : "READY TO EXPLORE"}</small>
        </span>
      </div>
      <label className="monitor">
        <input
          type="checkbox"
          checked={config.monitor}
          onChange={(e) => configure({ monitor: e.target.checked })}
        />
        <AudioLines size={17} />
        <span>Monitor</span>
      </label>
      <label className="master-volume">
        <Volume2 size={17} />
        <input
          aria-label="Monitor volume"
          type="range"
          min="0"
          max="0.8"
          step="0.01"
          value={config.volume}
          onChange={(e) => configure({ volume: Number(e.target.value) })}
        />
      </label>
    </section>
  );
}
