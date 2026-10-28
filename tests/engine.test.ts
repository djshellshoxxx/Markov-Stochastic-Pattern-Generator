import test from "node:test";
import assert from "node:assert/strict";
import {
  normalize,
  editProbability,
  distribution,
  sample,
  seededRandom,
  quantize,
  pitchBend,
} from "../src/engine/math.ts";
import { makePreset, parseProject } from "../src/state/project.ts";
import { Scheduler } from "../src/engine/scheduler.ts";
const sum = (a: number[]) => a.reduce((x, y) => x + y, 0);
test("normalization recovers a zero row and rejects nonfinite/negative weights", () => {
  assert.deepEqual(normalize([0, 0, 0, 0]), [0.25, 0.25, 0.25, 0.25]);
  assert.deepEqual(normalize([NaN, -2, 4, Infinity]), [0, 0, 1, 0]);
});
test("10,000 matrix edits preserve row sums and exact edited probability", () => {
  const random = seededRandom(91);
  let row = normalize([1, 2, 3, 4, 5, 6]);
  for (let i = 0; i < 10000; i++) {
    const index = Math.floor(random() * row.length),
      target = random();
    row = editProbability(row, index, target);
    assert.ok(Math.abs(sum(row) - 1) < 1e-12);
    assert.equal(row[index], target);
    assert.ok(row.every((n) => n >= 0));
  }
  assert.deepEqual(editProbability([1, 0, 0], 0, 0), [0, 0.5, 0.5]);
});
test("second-order contexts are distinct and entropy one is uniform", () => {
  const p = makePreset();
  p.config.order = 2;
  p.config.entropy = 0;
  p.secondOrder[0][1] = [1, 0, 0, 0, 0, 0];
  p.secondOrder[2][1] = [0, 0, 0, 1, 0, 0];
  assert.equal(
    sample(distribution(p, 0, 1), () => 0.4),
    0,
  );
  assert.equal(
    sample(distribution(p, 2, 1), () => 0.4),
    3,
  );
  p.config.entropy = 1;
  assert.deepEqual(distribution(p, 2, 1), Array(6).fill(1 / 6));
});
test("weighted sample approximates probabilities across 100,000 transitions", () => {
  const count = [0, 0, 0],
    random = seededRandom(1234);
  for (let i = 0; i < 100000; i++) count[sample([0.1, 0.3, 0.6], random)]++;
  [0.1, 0.3, 0.6].forEach((p, i) =>
    assert.ok(Math.abs(count[i] / 100000 - p) < 0.005),
  );
});
test("quantization respects root and EDO frequency mapping", () => {
  const c = makePreset().config;
  for (let n = 0; n < 128; n++)
    assert.ok([0, 2, 3, 5, 7, 9, 10].includes(quantize(n, c) % 12));
  c.root = 2;
  assert.equal(quantize(61, c), 60);
  c.scale = "edo";
  c.root = 0;
  c.edo = 19;
  assert.ok(Math.abs(quantize(63, c) - 1200 / 19) < 1e-10);
  assert.deepEqual(pitchBend(60.5), { note: 61, lsb: 0, msb: 48 });
});
test("clock produces 24 pulses and four sixteenths per quarter; swing leaves clock unchanged", () => {
  const p = makePreset();
  Object.assign(p.config, { bpm: 120, clockOut: true, density: 1, swing: 0.5 });
  const s = new Scheduler(p);
  s.reset(1000);
  const e = s.collect(1000, 499);
  assert.equal(e.clocks.length, 24);
  assert.equal(e.notes.length, 4);
  assert.ok(Math.abs(e.notes[1].at - 1187.5) < 0.00001);
  assert.ok(Math.abs(e.clocks[6] - 1125) < 0.00001);
});
test("restart is deterministic, long stalls skip stale work, and rests advance steps", () => {
  const p = makePreset(),
    s = new Scheduler(p);
  s.reset(1000);
  const first = s.collect(1000, 1000);
  s.reset(1000);
  assert.deepEqual(s.collect(1000, 1000), first);
  s.collect(10000);
  assert.ok(s.dropped > 0);
  assert.ok(s.nextAt >= 10000);
  p.config.density = 0;
  s.reset(1000);
  const silent = s.collect(1000, 1000).notes;
  assert.ok(silent.length > 0);
  assert.ok(silent.every((n) => n.velocity === 0));
});
test("microtonal durations cannot overlap the shortest swung step", () => {
  const p = makePreset("Broken symmetry");
  p.config.density = 1;
  p.config.swing = 0.6;
  p.states.forEach((s) => (s.duration = 3840));
  const s = new Scheduler(p);
  s.reset(1000);
  const notes = s.collect(1000, 1000).notes;
  for (let i = 1; i < notes.length; i++)
    assert.ok(notes[i - 1].at + notes[i - 1].durationMs < notes[i].at);
});
test("import validates matrix dimensions, normalizes weights and resets device settings", () => {
  const p = makePreset();
  p.config.sync = "midi";
  p.config.clockOut = true;
  p.matrix[0][0] = 10;
  const loaded = parseProject(JSON.parse(JSON.stringify(p)));
  assert.equal(loaded.config.sync, "internal");
  assert.equal(loaded.config.clockOut, false);
  assert.ok(Math.abs(sum(loaded.matrix[0]) - 1) < 1e-12);
  assert.throws(() => parseProject({ ...p, matrix: [[1]] }));
  assert.throws(() =>
    parseProject({ ...p, config: { ...p.config, bpm: NaN } }),
  );
  assert.throws(() =>
    parseProject({ ...p, states: p.states.map(() => p.states[0]) }),
  );
});
