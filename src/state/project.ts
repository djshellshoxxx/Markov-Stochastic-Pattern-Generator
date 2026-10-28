import type { Project, GeneratorConfig, MarkovState } from "../engine/types.ts";
import { clamp, normalize, scales, noteNames } from "../engine/math.ts";
export const defaultConfig: GeneratorConfig = {
  bpm: 112,
  order: 1,
  scaleConstraint: ["C", "D", "D♯", "F", "G", "A", "A♯"],
  entropy: 0.18,
  channel: 1,
  scale: "dorian",
  root: 0,
  edo: 19,
  swing: 0.12,
  density: 0.9,
  velocityVariation: 0.18,
  velocityCurve: "accent",
  gate: 0.72,
  seed: 4281,
  sync: "internal",
  clockOut: false,
  midiLatency: 0,
  monitor: true,
  volume: 0.35,
  waveform: "triangle",
  rhythmEnabled: false,
  rhythmSteps: 16,
  rhythmPulses: 5,
  rhythmRotation: 0,
};
export function scaleConstraint(config: GeneratorConfig): string[] {
  return config.scale === "edo"
    ? [`${config.edo}-EDO`]
    : scales[config.scale].map((n) => noteNames[(n + config.root) % 12]);
}
export const presetNames = [
  "Dorian drift",
  "Glassworks",
  "Low orbit",
  "Broken symmetry",
] as const;
export function makePreset(name: string = presetNames[0]): Project {
  const index = Math.max(
    0,
    presetNames.indexOf(name as (typeof presetNames)[number]),
  );
  const pitches = [
    [48, 55, 60, 62, 63, 69],
    [60, 64, 66, 71, 74, 78],
    [36, 43, 46, 48, 50, 53],
    [48, 51, 56, 60, 65, 70],
  ][index];
  const states = pitches.map((pitch, i) => ({
    id: String.fromCharCode(65 + i),
    pitch,
    velocity: [100, 82, 94, 76, 88, 72][i],
    duration: 240,
  }));
  const matrix = states.map((_, i) =>
    normalize(
      states.map((__, j) =>
        i === j ? 1 : j === (i + 1) % 6 ? 6 : j === (i + 3) % 6 ? 3 : 0.5,
      ),
    ),
  );
  const config = {
    ...defaultConfig,
    bpm: [112, 124, 88, 136][index],
    scale: (["dorian", "lydian", "minor", "edo"] as const)[index],
    entropy: [0.18, 0.08, 0.26, 0.48][index],
  };
  config.scaleConstraint = scaleConstraint(config);
  return {
    version: 1,
    name,
    states,
    matrix,
    config,
    secondOrder: states.map((_, prev) =>
      matrix.map((row) =>
        normalize(row.map((n, next) => n * (next === prev ? 0.15 : 1))),
      ),
    ),
  };
}
const object = (v: unknown): v is Record<string, unknown> =>
  v !== null && typeof v === "object" && !Array.isArray(v);
export function parseProject(input: unknown): Project {
  if (
    !object(input) ||
    input.version !== 1 ||
    !Array.isArray(input.states) ||
    input.states.length < 2 ||
    input.states.length > 12
  )
    throw new Error("Use a version 1 project with 2–12 states.");
  const states: MarkovState[] = input.states.map((s: unknown) => {
    if (
      !object(s) ||
      typeof s.id !== "string" ||
      s.id.length > 16 ||
      !["pitch", "velocity", "duration"].every(
        (k) => typeof s[k] === "number" && Number.isFinite(s[k]),
      )
    )
      throw new Error("Invalid note state.");
    return {
      id: s.id,
      pitch: Math.round(clamp(s.pitch as number, 0, 127)),
      velocity: Math.round(clamp(s.velocity as number, 0, 127)),
      duration: Math.round(clamp(s.duration as number, 60, 3840)),
    };
  });
  if (new Set(states.map((s) => s.id)).size !== states.length)
    throw new Error("State identifiers must be unique.");
  const matrix = (v: unknown): number[][] => {
    if (
      !Array.isArray(v) ||
      v.length !== states.length ||
      !v.every(
        (row) =>
          Array.isArray(row) &&
          row.length === states.length &&
          row.every(
            (n) => typeof n === "number" && Number.isFinite(n) && n >= 0,
          ),
      )
    )
      throw new Error("Transition matrix dimensions or weights are invalid.");
    return v.map(normalize);
  };
  const first = matrix(input.matrix);
  if (
    !Array.isArray(input.secondOrder) ||
    input.secondOrder.length !== states.length
  )
    throw new Error("Missing second-order transition matrices.");
  const secondOrder = input.secondOrder.map(matrix);
  if (!object(input.config))
    throw new Error("Missing generator configuration.");
  const raw = input.config;
  const config = { ...defaultConfig };
  const ranges: Record<string, [number, number]> = {
    bpm: [30, 300],
    entropy: [0, 1],
    channel: [1, 16],
    root: [0, 11],
    edo: [5, 53],
    swing: [0, 0.6],
    density: [0, 1],
    velocityVariation: [0, 1],
    gate: [0.1, 1],
    seed: [0, 4294967295],
    midiLatency: [0, 200],
    volume: [0, 0.8],
  };
  for (const [key, bounds] of Object.entries(ranges)) {
    if (typeof raw[key] !== "number" || !Number.isFinite(raw[key]))
      throw new Error(`Invalid ${key}.`);
    Object.assign(config, { [key]: clamp(raw[key] as number, ...bounds) });
  }
  for (const key of ["channel", "root", "edo", "seed"] as const)
    config[key] = Math.round(config[key]);
  if (raw.order !== 1 && raw.order !== 2)
    throw new Error("Order must be 1 or 2.");
  config.order = raw.order;
  const enums = {
    scale: ["chromatic", "dorian", "lydian", "minor", "pentatonic", "edo"],
    velocityCurve: ["flat", "accent", "soft"],
    waveform: ["sine", "triangle", "sawtooth", "square"],
  };
  for (const [key, values] of Object.entries(enums)) {
    if (!values.includes(raw[key] as string))
      throw new Error(`Unknown ${key}.`);
    Object.assign(config, { [key]: raw[key] });
  }
  config.monitor = raw.monitor !== false;
  config.rhythmEnabled = raw.rhythmEnabled === true;
  for (const [key, lo, hi] of [
    ["rhythmSteps", 2, 32],
    ["rhythmPulses", 0, 32],
    ["rhythmRotation", 0, 31],
  ] as const) {
    if (
      raw[key] !== undefined &&
      (typeof raw[key] !== "number" || !Number.isFinite(raw[key]))
    )
      throw new Error(`Invalid ${key}.`);
    config[key] = Math.round(
      clamp((raw[key] ?? defaultConfig[key]) as number, lo, hi),
    );
  }
  config.rhythmPulses = Math.min(config.rhythmSteps, config.rhythmPulses);
  config.rhythmRotation %= config.rhythmSteps;
  // Imports never auto-connect devices or start an external clock.
  config.sync = "internal";
  config.clockOut = false;
  config.scaleConstraint = scaleConstraint(config);
  return {
    version: 1,
    name:
      typeof input.name === "string"
        ? input.name.slice(0, 80)
        : "Imported patch",
    states,
    matrix: first,
    secondOrder,
    config,
  };
}
