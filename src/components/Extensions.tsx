import { Circle, Square, Download, Undo2, Redo2 } from "lucide-react";
import { useStore } from "../state/store";
import { useCapture, endCapture } from "../state/capture";
import { startRecording } from "../engine/runtime";
import { euclidean } from "../engine/euclidean";
import { midiFile } from "../engine/midi-file";
import { download } from "../engine/download";
import { Panel, Slider } from "./Controls";
export function HistoryButtons() {
  const canUndo = useStore((s) => s.canUndo),
    canRedo = useStore((s) => s.canRedo);
  return (
    <div className="button-pair history-buttons">
      <button
        className="icon-button"
        aria-label="Undo patch edit"
        title="Undo · Ctrl/Cmd+Z"
        disabled={!canUndo}
        onClick={() => useStore.getState().undo()}
      >
        <Undo2 size={16} />
      </button>
      <button
        className="icon-button"
        aria-label="Redo patch edit"
        title="Redo · Ctrl/Cmd+Shift+Z"
        disabled={!canRedo}
        onClick={() => useStore.getState().redo()}
      >
        <Redo2 size={16} />
      </button>
    </div>
  );
}
export function Extensions() {
  const c = useStore((s) => s.project.config),
    set = useStore((s) => s.configure),
    playing = useStore((s) => s.playing),
    step = useStore((s) => s.step);
  const capture = useCapture();
  const mask = euclidean(c.rhythmSteps, c.rhythmPulses, c.rhythmRotation);
  return (
    <div className="extensions-grid">
      <Panel
        title="Euclidean rhythm"
        eyebrow="07 / A RHYTHMIC SKELETON"
        actions={
          <label className="checkbox-field rhythm-toggle">
            <input
              type="checkbox"
              checked={c.rhythmEnabled}
              onChange={(e) => set({ rhythmEnabled: e.target.checked })}
            />
            Enable gate
          </label>
        }
      >
        <div className="extension-body">
          <div
            className="rhythm-mask"
            role="img"
            aria-label={`${c.rhythmPulses} hits across ${c.rhythmSteps} steps: ${mask.map((on) => (on ? "hit" : "rest")).join(", ")}`}
          >
            {mask.map((on, i) => (
              <i
                key={i}
                className={`${on ? "hit" : ""} ${playing && step % c.rhythmSteps === i ? "current" : ""}`}
              >
                <span>{i + 1}</span>
              </i>
            ))}
          </div>
          <div className="rhythm-controls">
            <Slider
              label="Steps"
              min={2}
              max={32}
              step={1}
              value={c.rhythmSteps}
              display={String(c.rhythmSteps)}
              onChange={(rhythmSteps) =>
                set({
                  rhythmSteps,
                  rhythmPulses: Math.min(c.rhythmPulses, rhythmSteps),
                  rhythmRotation: c.rhythmRotation % rhythmSteps,
                })
              }
            />
            <Slider
              label="Pulses"
              min={0}
              max={c.rhythmSteps}
              step={1}
              value={c.rhythmPulses}
              display={String(c.rhythmPulses)}
              onChange={(rhythmPulses) => set({ rhythmPulses })}
            />
            <Slider
              label="Rotation"
              min={0}
              max={c.rhythmSteps - 1}
              step={1}
              value={c.rhythmRotation}
              display={String(c.rhythmRotation)}
              onChange={(rhythmRotation) => set({ rhythmRotation })}
            />
          </div>
          <p className="helper">
            Evenly spaced pulses meet evolving notes. Density can add rests; the
            Markov chain keeps moving.
          </p>
        </div>
      </Panel>
      <Panel
        title="Keep a good take"
        eyebrow="08 / PHRASE CAPTURE"
        actions={
          <span className={`live-badge ${capture.recording ? "active" : ""}`}>
            <i />
            {capture.recording ? "REC" : "MIDI FILE"}
          </span>
        }
      >
        <div className="extension-body">
          <div className="capture-summary">
            <strong>{String(capture.notes.length).padStart(3, "0")}</strong>
            <span>
              notes captured
              <small>
                {capture.recording
                  ? "Recording · 2 minute maximum"
                  : capture.duration
                    ? `${(capture.duration / 1000).toFixed(1)} seconds · ${Math.round(capture.bpm)} BPM`
                    : "Catch a phrase. Take it to your DAW."}
              </small>
            </span>
          </div>
          <div className="capture-actions">
            <button
              className={`small-button ${capture.recording ? "recording" : ""}`}
              disabled={!playing && !capture.recording}
              onClick={() =>
                capture.recording ? endCapture() : startRecording()
              }
            >
              {capture.recording ? <Square size={13} /> : <Circle size={13} />}{" "}
              {capture.recording ? "Finish take" : "Record new take"}
            </button>
            <button
              className="small-button"
              disabled={capture.recording || !capture.notes.length}
              onClick={() =>
                download(
                  midiFile(capture.notes, capture.bpm, capture.duration),
                  "markov-take.mid",
                  "audio/midi",
                )
              }
            >
              <Download size={14} />
              Export MIDI
            </button>
          </div>
          <p className="helper">
            Records notes, velocity, groove, and microtonal bends. Start
            playback to record. A new take replaces the previous one.
          </p>
        </div>
      </Panel>
    </div>
  );
}
