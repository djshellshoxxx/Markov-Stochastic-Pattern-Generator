import { create } from "zustand";
import type {
  GeneratorConfig,
  MarkovState,
  Project,
  NoteEvent,
} from "../engine/types";
import { editProbability, normalize } from "../engine/math";
import { makePreset, parseProject, scaleConstraint } from "./project";
import { History } from "./history";
const history = new History<Project>();
let restoring = false;
function initial(): Project {
  try {
    const saved = localStorage.getItem("markov-project-v1");
    if (saved) return parseProject(JSON.parse(saved));
  } catch {
    /* Fall back to playable preset. */
  }
  return makePreset();
}
interface Store {
  project: Project;
  playing: boolean;
  current: number;
  previous: number;
  step: number;
  history: NoteEvent[];
  message: string;
  late: number;
  selected: [number, number];
  context: number;
  configure: (patch: Partial<GeneratorConfig>) => void;
  load: (p: Project) => void;
  weight: (from: number, to: number, value: number) => void;
  state: (i: number, patch: Partial<MarkovState>) => void;
  resize: (delta: number) => void;
  randomize: () => void;
  uniform: () => void;
  canUndo: boolean;
  canRedo: boolean;
  undo: () => void;
  redo: () => void;
}
export const useStore = create<Store>((set) => ({
  project: initial(),
  playing: false,
  current: 0,
  previous: 0,
  step: -1,
  history: [],
  message: "",
  late: 0,
  selected: [0, 1],
  context: 0,
  canUndo: false,
  canRedo: false,
  undo: () => restore("undo"),
  redo: () => restore("redo"),
  configure: (patch) =>
    set((s) => {
      const config = { ...s.project.config, ...patch };
      config.scaleConstraint = scaleConstraint(config);
      return { project: { ...s.project, config } };
    }),
  load: (project) =>
    set({
      project,
      current: 0,
      previous: 0,
      step: -1,
      history: [],
      selected: [0, 1],
      context: 0,
    }),
  weight: (from, to, value) =>
    set((s) => {
      const p = s.project;
      return {
        project:
          p.config.order === 1
            ? {
                ...p,
                matrix: p.matrix.map((row, i) =>
                  i === from ? editProbability(row, to, value) : row,
                ),
              }
            : {
                ...p,
                secondOrder: p.secondOrder.map((m, prev) =>
                  prev === s.context
                    ? m.map((row, i) =>
                        i === from ? editProbability(row, to, value) : row,
                      )
                    : m,
                ),
              },
      };
    }),
  state: (i, patch) =>
    set((s) => ({
      project: {
        ...s.project,
        states: s.project.states.map((n, j) =>
          i === j ? { ...n, ...patch } : n,
        ),
      },
    })),
  resize: (delta) =>
    set((s) => {
      const p = s.project,
        n = p.states.length + delta;
      if (n < 2 || n > 12) return {};
      const states =
        delta > 0
          ? [
              ...p.states,
              {
                id: String.fromCharCode(65 + n - 1),
                pitch: 60 + n,
                velocity: 90,
                duration: 240,
              },
            ]
          : p.states.slice(0, n);
      const resize = (m: number[][]) =>
        Array.from({ length: n }, (_, i) =>
          normalize(Array.from({ length: n }, (__, j) => m[i]?.[j] ?? 1 / n)),
        );
      return {
        project: {
          ...p,
          states,
          matrix: resize(p.matrix),
          secondOrder: Array.from({ length: n }, (_, i) =>
            resize(p.secondOrder[i] ?? p.matrix),
          ),
        },
        selected: [0, 1],
        context: 0,
        current: 0,
        previous: 0,
        history: [],
      };
    }),
  randomize: () =>
    set((s) => {
      const fill = (m: number[][]) =>
        m.map((row) =>
          normalize(row.map(() => (Math.random() < 0.4 ? 0 : Math.random()))),
        );
      const p = s.project;
      return {
        project:
          p.config.order === 1
            ? { ...p, matrix: fill(p.matrix) }
            : {
                ...p,
                secondOrder: p.secondOrder.map((m, i) =>
                  i === s.context ? fill(m) : m,
                ),
              },
      };
    }),
  uniform: () =>
    set((s) => {
      const fill = (m: number[][]) =>
        m.map((row) => row.map(() => 1 / row.length));
      const p = s.project;
      return {
        project:
          p.config.order === 1
            ? { ...p, matrix: fill(p.matrix) }
            : {
                ...p,
                secondOrder: p.secondOrder.map((m, i) =>
                  i === s.context ? fill(m) : m,
                ),
              },
      };
    }),
}));
let saveTimer: ReturnType<typeof setTimeout>;
function restore(direction: "undo" | "redo") {
  const current = useStore.getState().project,
    restored = history[direction](current);
  if (!restored) return;
  restoring = true;
  const config = {
    ...restored.config,
    sync: current.config.sync,
    clockOut: current.config.clockOut,
    ...(current.config.sync !== "internal" ? { bpm: current.config.bpm } : {}),
  };
  useStore.setState({
    project: { ...restored, config },
    selected: [0, 1],
    context: 0,
    current: 0,
    previous: 0,
    history: [],
    canUndo: history.past.length > 0,
    canRedo: history.future.length > 0,
  });
  restoring = false;
}
useStore.subscribe((state, previous) => {
  if (state.project === previous.project) return;
  const a = previous.project,
    b = state.project;
  const configKeys = (
    Object.keys(b.config) as (keyof GeneratorConfig)[]
  ).filter((k) => JSON.stringify(a.config[k]) !== JSON.stringify(b.config[k]));
  const externalTempoOnly =
    b.config.sync !== "internal" &&
    configKeys.length === 1 &&
    configKeys[0] === "bpm" &&
    a.states === b.states &&
    a.matrix === b.matrix &&
    a.secondOrder === b.secondOrder;
  if (!restoring && !externalTempoOnly) {
    const key =
      a.name !== b.name
        ? `load:${performance.now()}`
        : configKeys.length
          ? `config:${configKeys.join(",")}`
          : a.states !== b.states
            ? `states:${b.states.map((n, i) => (n !== a.states[i] ? i : "")).join(",")}`
            : `matrix:${b.config.order}:${state.context}:${state.selected.join(",")}`;
    history.record(a, b, key, performance.now());
    useStore.setState({
      canUndo: history.past.length > 0,
      canRedo: history.future.length > 0,
    });
  }
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      localStorage.setItem("markov-project-v1", JSON.stringify(state.project));
    } catch {
      useStore.setState({
        message:
          "Browser storage is unavailable. Export your patch to save it.",
      });
    }
  }, 400);
});
