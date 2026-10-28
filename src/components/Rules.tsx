import { useStore } from "../state/store";
import { noteNames } from "../engine/math";
import type { GeneratorConfig } from "../engine/types";
import { Panel, Slider } from "./Controls";
export function Rules() {
  const c = useStore((s) => s.project.config),
    set = useStore((s) => s.configure);
  return (
    <Panel
      title="Generative rules"
      eyebrow="03 / SHAPE THE CHANCE"
      className="rules-panel"
    >
      <label className="field-label">Markov memory</label>
      <div className="segmented" aria-label="Markov order">
        <button aria-pressed={c.order === 1} onClick={() => set({ order: 1 })}>
          1st order<span>Previous note</span>
        </button>
        <button aria-pressed={c.order === 2} onClick={() => set({ order: 2 })}>
          2nd order<span>Previous pair</span>
        </button>
      </div>
      <Slider
        label="Entropy"
        value={c.entropy}
        onChange={(entropy) => set({ entropy })}
      />
      <div className="range-labels">
        <span>Follow the matrix</span>
        <span>Uniform random</span>
      </div>
      <div className="rule-divider" />
      <div className="field-row">
        <label>
          Root
          <select
            value={c.root}
            onChange={(e) => set({ root: Number(e.target.value) })}
          >
            {noteNames.map((n, i) => (
              <option key={n} value={i}>
                {n}
              </option>
            ))}
          </select>
        </label>
        <label>
          Scale lock
          <select
            value={c.scale}
            onChange={(e) =>
              set({ scale: e.target.value as GeneratorConfig["scale"] })
            }
          >
            {[
              "chromatic",
              "dorian",
              "lydian",
              "minor",
              "pentatonic",
              "edo",
            ].map((n) => (
              <option key={n} value={n}>
                {n === "edo"
                  ? "Microtonal / EDO"
                  : n[0].toUpperCase() + n.slice(1)}
              </option>
            ))}
          </select>
        </label>
      </div>
      {c.scale === "edo" ? (
        <label className="field-label">
          Equal divisions of octave
          <input
            aria-label="EDO divisions"
            type="number"
            min="5"
            max="53"
            value={c.edo}
            onChange={(e) =>
              set({ edo: Math.max(5, Math.min(53, Number(e.target.value))) })
            }
          />
          <small>Exact synth tuning · mono MIDI pitch bend ±2 st</small>
        </label>
      ) : (
        <div className="scale-notes">
          {c.scaleConstraint.map((n) => (
            <span key={n}>{n}</span>
          ))}
        </div>
      )}
      <div className="rule-divider" />
      <Slider
        label="Swing"
        value={c.swing}
        max={0.6}
        onChange={(swing) => set({ swing })}
      />
      <Slider
        label="Note density"
        value={c.density}
        onChange={(density) => set({ density })}
      />
      <details className="advanced">
        <summary>Velocity & articulation</summary>
        <Slider
          label="Velocity variation"
          value={c.velocityVariation}
          onChange={(velocityVariation) => set({ velocityVariation })}
        />
        <div className="field-row">
          <label>
            Velocity curve
            <select
              value={c.velocityCurve}
              onChange={(e) =>
                set({
                  velocityCurve: e.target
                    .value as GeneratorConfig["velocityCurve"],
                })
              }
            >
              <option value="flat">Even</option>
              <option value="accent">Beat accents</option>
              <option value="soft">Soft scatter</option>
            </select>
          </label>
          <label>
            Waveform
            <select
              value={c.waveform}
              onChange={(e) =>
                set({ waveform: e.target.value as OscillatorType })
              }
            >
              {["triangle", "sine", "sawtooth", "square"].map((w) => (
                <option key={w}>{w}</option>
              ))}
            </select>
          </label>
        </div>
        <Slider
          label="Gate length"
          min={0.1}
          value={c.gate}
          onChange={(gate) => set({ gate })}
        />
        <label className="field-label">
          Random seed
          <input
            type="number"
            min="0"
            max="4294967295"
            value={c.seed}
            onChange={(e) => set({ seed: Number(e.target.value) >>> 0 })}
          />
          <small>Restart with the same seed to repeat the sequence.</small>
        </label>
      </details>
    </Panel>
  );
}
