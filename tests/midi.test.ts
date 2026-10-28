import test from "node:test";
import assert from "node:assert/strict";
import { MidiEngine } from "../src/engine/midi.ts";
import { makePreset } from "../src/state/project.ts";
test("MIDI scheduling uses timestamped note pairs and panic cancels pending output", () => {
  const m = new MidiEngine(),
    sent: { bytes: number[]; at: number }[] = [];
  let cleared = false;
  m.output = {
    state: "connected",
    send: (bytes: number[], at: number) => sent.push({ bytes, at }),
    clear: () => {
      cleared = true;
    },
  } as unknown as MIDIOutput;
  const c = makePreset().config;
  c.channel = 4;
  c.midiLatency = 12;
  const at = performance.timeOrigin + performance.now() + 1000;
  m.note(
    {
      state: 0,
      previous: 0,
      pitch: 60,
      velocity: 90,
      durationMs: 80,
      at,
      step: 0,
    },
    c,
    20,
  );
  assert.deepEqual(
    sent.map((n) => n.bytes),
    [
      [227, 0, 64],
      [147, 60, 90],
      [131, 60, 0],
    ],
  );
  assert.ok(Math.abs(sent[0].at - (at - performance.timeOrigin + 32)) < 0.001);
  assert.equal(sent[2].at - sent[1].at, 80);
  m.panic();
  assert.equal(cleared, true);
  assert.ok(sent.some((n) => n.bytes[0] === 179 && n.bytes[1] === 123));
});
test("MIDI input measures 24 PPQN and forwards Start/Continue/Stop", () => {
  const m = new MidiEngine(),
    input = { onmidimessage: null } as unknown as MIDIInput;
  m.access = { inputs: new Map([["test", input]]) } as unknown as MIDIAccess;
  const received: number[] = [];
  m.onClock = (status) => received.push(status);
  m.selectInput("test");
  const send = (status: number, timeStamp: number) =>
    input.onmidimessage!.call(input, {
      data: new Uint8Array([status]),
      timeStamp,
    } as MIDIMessageEvent);
  send(250, 0);
  for (let i = 1; i <= 48; i++) send(248, (i * 60000) / 120 / 24);
  send(252, 1100);
  send(251, 1200);
  assert.ok(Math.abs(m.bpm - 120) < 0.001);
  assert.equal(received[0], 250);
  assert.deepEqual(received.slice(-2), [252, 251]);
  m.selectInput("");
  assert.equal(input.onmidimessage, null);
});
