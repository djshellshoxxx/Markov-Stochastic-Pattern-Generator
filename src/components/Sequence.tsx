import { useStore } from "../state/store";
import { noteName } from "../engine/math";
import { Panel } from "./Controls";
export function Sequence() {
  const history = useStore((s) => s.history),
    step = useStore((s) => s.step);
  const last16 = Array.from({ length: 16 }, (_, i) =>
    [...history]
      .reverse()
      .find(
        (n) =>
          n.velocity > 0 &&
          n.step === Math.floor(Math.max(step, 0) / 16) * 16 + i,
      ),
  );
  return (
    <Panel
      title="Evolving sequence"
      eyebrow="04 / NOTE TRACE"
      className="sequence-panel"
      actions={<span className="muted mono">1/16 STEP</span>}
    >
      <div className="sequence-grid">
        {last16.map((note, i) => (
          <div
            key={i}
            className={`sequence-step ${step % 16 === i ? "current" : ""}`}
          >
            <span>{String(i + 1).padStart(2, "0")}</span>
            <div className="note-meter">
              <i
                style={{
                  height: note ? `${(note.velocity / 127) * 100}%` : "4%",
                }}
              />
            </div>
            <b>{note ? noteName(note.pitch) : "—"}</b>
          </div>
        ))}
      </div>
      <p className="helper">
        A new path on every step. Height shows velocity; gaps are rests.
      </p>
    </Panel>
  );
}
