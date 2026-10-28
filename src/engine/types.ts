export interface MarkovState {
  id: string;
  pitch: number;
  velocity: number;
  duration: number;
}
export interface TransitionMatrix {
  states: MarkovState[];
  matrix: number[][];
}
export type Scale =
  "chromatic" | "dorian" | "lydian" | "minor" | "pentatonic" | "edo";
export type SyncMode = "internal" | "midi" | "link";
export interface GeneratorConfig {
  bpm: number;
  order: 1 | 2;
  scaleConstraint: string[];
  entropy: number;
  channel: number;
  scale: Scale;
  root: number;
  edo: number;
  swing: number;
  density: number;
  velocityVariation: number;
  velocityCurve: "flat" | "accent" | "soft";
  gate: number;
  seed: number;
  sync: SyncMode;
  clockOut: boolean;
  midiLatency: number;
  monitor: boolean;
  volume: number;
  waveform: OscillatorType;
  rhythmEnabled: boolean;
  rhythmSteps: number;
  rhythmPulses: number;
  rhythmRotation: number;
}
export interface Project extends TransitionMatrix {
  version: 1;
  name: string;
  config: GeneratorConfig;
  // previous → current → next (N × N × N), not a heuristic blend of rows.
  secondOrder: number[][][];
}
export interface NoteEvent {
  state: number;
  previous: number;
  pitch: number;
  velocity: number;
  durationMs: number;
  at: number;
  step: number;
}
export type WorkerInput =
  | { type: "project"; project: Project }
  | { type: "start"; at: number; run: number }
  | { type: "stop" }
  | { type: "midi"; status: number; at: number; bpm: number }
  | { type: "link"; beat: number; bpm: number; at: number };
export type WorkerOutput = {
  type: "events";
  notes: NoteEvent[];
  clocks: number[];
  run: number;
  dropped: number;
};
