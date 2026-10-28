import type { GeneratorConfig, Project } from "./types.ts";
export const PPQ = 960;
export const clamp = (n: number, lo: number, hi: number) =>
  Math.max(lo, Math.min(hi, Number.isFinite(n) ? n : lo));
export const noteNames = [
  "C",
  "C♯",
  "D",
  "D♯",
  "E",
  "F",
  "F♯",
  "G",
  "G♯",
  "A",
  "A♯",
  "B",
];
export const noteName = (pitch: number) =>
  `${noteNames[((Math.round(pitch) % 12) + 12) % 12]}${Math.floor(Math.round(pitch) / 12) - 1}`;
export function normalize(row: number[]): number[] {
  const clean = row.map((n) => (Number.isFinite(n) && n > 0 ? n : 0));
  const sum = clean.reduce((a, b) => a + b, 0);
  return clean.map((n) => (sum ? n / sum : 1 / clean.length));
}
export function editProbability(
  row: number[],
  index: number,
  value: number,
): number[] {
  if (row.length === 1) return [1];
  const target = clamp(value, 0, 1);
  const others = row.reduce((sum, n, i) => sum + (i === index ? 0 : n), 0);
  return row.map((n, i) =>
    i === index
      ? target
      : others > 0
        ? (n / others) * (1 - target)
        : (1 - target) / (row.length - 1),
  );
}
export function distribution(
  project: Project,
  previous: number,
  current: number,
): number[] {
  const row =
    project.config.order === 2
      ? project.secondOrder[previous][current]
      : project.matrix[current];
  const e = project.config.entropy;
  return normalize(row).map((n) => n * (1 - e) + e / row.length);
}
export function sample(row: number[], random: () => number): number {
  const target = random();
  let sum = 0;
  for (let i = 0; i < row.length; i++) {
    sum += row[i];
    if (target < sum) return i;
  }
  return row.length - 1;
}
export function seededRandom(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s += 0x6d2b79f5;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export const scales: Record<
  Exclude<GeneratorConfig["scale"], "edo">,
  number[]
> = {
  chromatic: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  lydian: [0, 2, 4, 6, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10],
  pentatonic: [0, 3, 5, 7, 10],
};
export function quantize(pitch: number, config: GeneratorConfig): number {
  if (config.scale === "edo")
    return clamp(
      config.root +
        (Math.round(((pitch - config.root) * config.edo) / 12) * 12) /
          config.edo,
      0,
      127,
    );
  const allowed = scales[config.scale];
  let best = clamp(Math.round(pitch), 0, 127),
    distance = Infinity;
  for (let n = 0; n <= 127; n++)
    if (
      allowed.includes((((n - config.root) % 12) + 12) % 12) &&
      Math.abs(pitch - n) < distance
    ) {
      best = n;
      distance = Math.abs(pitch - n);
    }
  return best;
}
export function velocity(
  base: number,
  step: number,
  config: GeneratorConfig,
  random: () => number,
): number {
  const curve =
    config.velocityCurve === "accent"
      ? step % 4 === 0
        ? 1.12
        : 0.78
      : config.velocityCurve === "soft"
        ? 0.65 + random() * 0.25
        : 1;
  const varied = Math.round(
    clamp(
      base * curve + (random() * 2 - 1) * config.velocityVariation * 48,
      1,
      127,
    ),
  );
  // Still consume the random draws so a rest doesn't change the RNG stream.
  return base === 0 ? 0 : varied;
}
export function swingOffset(step: number, bpm: number, swing: number): number {
  return step % 2 ? (60000 / bpm / 4) * swing : 0;
}
export function pitchBend(pitch: number): {
  note: number;
  lsb: number;
  msb: number;
} {
  const note = Math.round(clamp(pitch, 0, 127));
  const bend = Math.round(clamp(8192 + ((pitch - note) / 2) * 8192, 0, 16383));
  return { note, lsb: bend & 127, msb: bend >> 7 };
}
