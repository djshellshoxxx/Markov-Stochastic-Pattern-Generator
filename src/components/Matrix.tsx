import { Shuffle, Equal } from "lucide-react";
import { useStore } from "../state/store";
import { noteName } from "../engine/math";
import { Panel, Slider } from "./Controls";
export function Matrix() {
  const p = useStore((s) => s.project),
    selected = useStore((s) => s.selected),
    context = useStore((s) => s.context);
  const current = useStore((s) => s.current),
    playing = useStore((s) => s.playing),
    weight = useStore((s) => s.weight);
  const matrix = p.config.order === 1 ? p.matrix : p.secondOrder[context];
  const [from, to] = selected;
  return (
    <Panel
      title="Transition matrix"
      eyebrow="01 / PROBABILITY"
      className="matrix-panel"
      actions={
        <div className="button-pair">
          <button
            className="icon-button"
            aria-label="Set uniform probabilities"
            title="Uniform probabilities"
            onClick={() => useStore.getState().uniform()}
          >
            <Equal size={17} />
          </button>
          <button
            className="icon-button"
            aria-label="Randomize probabilities"
            title="Randomize probabilities"
            onClick={() => useStore.getState().randomize()}
          >
            <Shuffle size={16} />
          </button>
        </div>
      }
    >
      <div className="matrix-description">
        <p>Choose where the next note goes.</p>
        <span>
          ROWS SUM TO <b>1.00</b>
        </span>
      </div>
      {p.config.order === 2 && (
        <label className="context-select">
          Previous state{" "}
          <select
            value={context}
            onChange={(e) =>
              useStore.setState({ context: Number(e.target.value) })
            }
          >
            {p.states.map((s, i) => (
              <option key={s.id} value={i}>
                {s.id} · {noteName(s.pitch)}
              </option>
            ))}
          </select>
          <small>Editing P(next | previous, current)</small>
        </label>
      )}
      <div className="matrix-scroll">
        <table
          style={{ minWidth: p.states.length * 40 + 40 }}
          className="matrix"
          aria-label="State transition probabilities"
        >
          <thead>
            <tr>
              <th scope="col">
                <span className="axis">
                  FROM ↓<br />
                  TO →
                </span>
              </th>
              {p.states.map((s) => (
                <th key={s.id} scope="col">
                  <b>{s.id}</b>
                  <small>{noteName(s.pitch)}</small>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {matrix.map((row, i) => (
              <tr
                key={p.states[i].id}
                className={playing && current === i ? "active-row" : ""}
              >
                <th scope="row">
                  <b>{p.states[i].id}</b>
                  <small>{noteName(p.states[i].pitch)}</small>
                </th>
                {row.map((v, j) => (
                  <td key={p.states[j].id}>
                    <button
                      className={`matrix-cell ${from === i && to === j ? "selected" : ""}`}
                      style={{ "--weight": v } as React.CSSProperties}
                      aria-label={`${p.states[i].id} to ${p.states[j].id}: ${(v * 100).toFixed(1)} percent`}
                      aria-pressed={from === i && to === j}
                      onClick={() => useStore.setState({ selected: [i, j] })}
                    >
                      {Math.round(v * 100)}
                      <span>%</span>
                    </button>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="matrix-legend">
        <span>
          <i className="legend-low" />
          Unlikely
        </span>
        <div className="legend-ramp" />
        <span>
          Likely
          <i className="legend-high" />
        </span>
      </div>
      <div className="probability-editor">
        <div className="transition-label">
          <span>{p.states[from].id}</span>
          <b>→</b>
          <span>{p.states[to].id}</span>
          <small>
            {noteName(p.states[from].pitch)} → {noteName(p.states[to].pitch)}
          </small>
        </div>
        <Slider
          label="Transition probability"
          value={matrix[from][to]}
          onChange={(n) => weight(from, to, n)}
        />
        <p className="helper">
          The other weights in this row rebalance automatically.
        </p>
      </div>
    </Panel>
  );
}
