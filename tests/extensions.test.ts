import test from "node:test";
import assert from "node:assert/strict";
import { euclidean } from "../src/engine/euclidean.ts";
import { History } from "../src/state/history.ts";
import { midiFile, vlq } from "../src/engine/midi-file.ts";
import { Scheduler } from "../src/engine/scheduler.ts";
import { makePreset, parseProject } from "../src/state/project.ts";
test("Euclidean gates preserve pulse counts, even gaps and rotations exhaustively", () => {
  for (let n = 2; n <= 32; n++)
    for (let k = 0; k <= n; k++) {
      const base = euclidean(n, k),
        positions = base.flatMap((on, i) => (on ? [i] : []));
      assert.equal(positions.length, k);
      if (k) {
        const gaps = positions.map(
          (p, i) => ((positions[(i + 1) % k] - p + n - 1) % n) + 1,
        );
        assert.ok(Math.max(...gaps) - Math.min(...gaps) <= 1);
      }
      for (let r = 0; r < n; r++)
        assert.deepEqual(
          euclidean(n, k, r),
          base.map((_, i) => base[(i - r + n) % n]),
        );
    }
});
test("rhythm gate silences notes while retaining Markov history and timing", () => {
  const p = makePreset();
  p.config.density = 1;
  p.config.rhythmEnabled = true;
  p.config.rhythmSteps = 8;
  p.config.rhythmPulses = 3;
  const s = new Scheduler(p);
  s.reset(0);
  const gated = s.collect(0, (60000 / p.config.bpm) * 2 - 1).notes;
  assert.equal(gated.filter((n) => n.velocity > 0).length, 3);
  p.config.rhythmEnabled = false;
  s.reset(0);
  const plain = s.collect(0, (60000 / p.config.bpm) * 2 - 1).notes;
  assert.deepEqual(
    gated.map((n) => n.state),
    plain.map((n) => n.state),
  );
});
test("old v1 projects gain disabled rhythm defaults and malformed rhythm is rejected", () => {
  const p = JSON.parse(JSON.stringify(makePreset()));
  delete p.config.rhythmSteps;
  delete p.config.rhythmEnabled;
  assert.equal(parseProject(p).config.rhythmSteps, 16);
  assert.equal(parseProject(p).config.rhythmEnabled, false);
  p.config.rhythmPulses = "bad";
  assert.throws(() => parseProject(p));
});
test("undo groups one gesture, preserves redo order, and branches on new edits", () => {
  const h = new History<number>();
  h.record(0, 1, "slider", 0);
  h.record(1, 2, "slider", 100);
  h.record(2, 3, "other", 200);
  assert.equal(h.undo(3), 2);
  assert.equal(h.undo(2), 0);
  assert.equal(h.redo(0), 2);
  assert.equal(h.redo(2), 3);
  assert.equal(h.undo(3), 2);
  h.record(2, 9, "third", 300);
  assert.equal(h.redo(9), undefined);
  assert.equal(h.record(9, 9, "third", 400), false);
});
test("undo history is limited to 60 snapshots", () => {
  const h = new History<number>();
  for (let i = 0; i < 100; i++) h.record(i, i + 1, "x", i * 1000);
  assert.equal(h.past.length, 60);
  assert.equal(h.past[0], 40);
});
// Independent SMF decoder: checks structure, length fields, and absolute event ticks.
function decode(bytes: Uint8Array) {
  const view = new DataView(bytes.buffer);
  const text = (a: number, b: number) =>
    String.fromCharCode(...bytes.slice(a, b));
  assert.equal(text(0, 4), "MThd");
  assert.equal(view.getUint32(4), 6);
  assert.equal(view.getUint16(8), 0);
  assert.equal(view.getUint16(10), 1);
  assert.equal(view.getUint16(12), 960);
  assert.equal(text(14, 18), "MTrk");
  assert.equal(view.getUint32(18), bytes.length - 22);
  let pos = 22,
    tick = 0;
  const events: { tick: number; status: number; data: number[] }[] = [];
  const variable = () => {
    let value = 0,
      byte;
    do {
      byte = bytes[pos++];
      value = value * 128 + (byte & 127);
    } while (byte & 128);
    return value;
  };
  while (pos < bytes.length) {
    tick += variable();
    const status = bytes[pos++];
    if (status === 255) {
      const type = bytes[pos++],
        size = variable();
      events.push({
        tick,
        status,
        data: [type, ...bytes.slice(pos, pos + size)],
      });
      pos += size;
    } else {
      events.push({ tick, status, data: [...bytes.slice(pos, pos + 2)] });
      pos += 2;
    }
  }
  return events;
}
test("MIDI export preserves note timing, bend, velocity, channel and track boundaries", () => {
  const data = midiFile(
    [
      { at: 125, durationMs: 250, pitch: 60.5, velocity: 91, channel: 3 },
      { at: 1000, durationMs: 10, pitch: 50, velocity: 90, channel: 3 },
    ],
    120,
    300,
  );
  const events = decode(data),
    on = events.filter((e) => (e.status & 240) === 144),
    off = events.filter((e) => (e.status & 240) === 128);
  assert.deepEqual(on, [{ tick: 240, status: 146, data: [61, 91] }]);
  assert.deepEqual(off, [{ tick: 576, status: 130, data: [61, 0] }]);
  assert.ok(
    events.some(
      (e) =>
        e.tick === 240 &&
        e.status === 226 &&
        e.data[0] === 0 &&
        e.data[1] === 48,
    ),
  );
  assert.deepEqual(events.at(-1), { tick: 576, status: 255, data: [47] });
  assert.deepEqual(events[0].data, [81, 7, 161, 32]);
  assert.deepEqual(vlq(16384), [129, 128, 0]);
});
test("MIDI exporter orders note-off before a repeated note-on and excludes rests", () => {
  const events = decode(
    midiFile(
      [
        { at: 0, durationMs: 125, pitch: 60, velocity: 100, channel: 1 },
        { at: 125, durationMs: 125, pitch: 60, velocity: 80, channel: 1 },
        { at: 80, durationMs: 10, pitch: 70, velocity: 0, channel: 1 },
      ],
      120,
      300,
    ),
  );
  assert.deepEqual(
    events.filter((e) => e.tick === 240).map((e) => e.status),
    [128, 224, 144],
  );
  assert.equal(events.filter((e) => (e.status & 240) === 144).length, 2);
});
