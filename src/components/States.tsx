import { Plus, Minus } from "lucide-react";
import { useStore } from "../state/store";
import { clamp, noteName } from "../engine/math";
import { Panel } from "./Controls";
export function States() {
  const states = useStore((s) => s.project.states),
    update = useStore((s) => s.state),
    resize = useStore((s) => s.resize);
  return (
    <Panel
      title="Note states"
      eyebrow="05 / YOUR VOCABULARY"
      className="states-panel"
      actions={
        <div className="button-pair">
          <button
            className="icon-button"
            aria-label="Remove last state"
            disabled={states.length <= 2}
            onClick={() => resize(-1)}
          >
            <Minus size={16} />
          </button>
          <button
            className="icon-button"
            aria-label="Add state"
            disabled={states.length >= 12}
            onClick={() => resize(1)}
          >
            <Plus size={16} />
          </button>
        </div>
      }
    >
      <div className="states-grid">
        {states.map((s, i) => (
          <div className="note-state" key={s.id}>
            <div className="state-title">
              <b>{s.id}</b>
              <span>{noteName(s.pitch)}</span>
            </div>
            <label>
              Pitch
              <input
                aria-label={`State ${s.id} MIDI pitch`}
                type="number"
                min="0"
                max="127"
                value={s.pitch}
                onChange={(e) =>
                  update(i, {
                    pitch: Math.round(clamp(Number(e.target.value), 0, 127)),
                  })
                }
              />
            </label>
            <label>
              Velocity
              <input
                aria-label={`State ${s.id} velocity`}
                type="number"
                min="0"
                max="127"
                value={s.velocity}
                onChange={(e) =>
                  update(i, {
                    velocity: Math.round(clamp(Number(e.target.value), 0, 127)),
                  })
                }
              />
            </label>
            <label>
              Length
              <select
                aria-label={`State ${s.id} duration`}
                value={s.duration}
                onChange={(e) =>
                  update(i, { duration: Number(e.target.value) })
                }
              >
                {[60, 120, 240, 480, 960, 1920, 3840].map((n) => (
                  <option key={n} value={n}>
                    {n === 3840 ? "1 bar" : `1/${3840 / n}`}
                  </option>
                ))}
              </select>
            </label>
          </div>
        ))}
      </div>
    </Panel>
  );
}
