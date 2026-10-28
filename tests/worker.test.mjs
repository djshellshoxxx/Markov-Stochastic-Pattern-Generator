import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import vm from 'node:vm';
import { makePreset } from '../src/state/project.ts';
const path = readdirSync('dist/assets').find(p => p.startsWith('clock.worker-') && p.endsWith('.js'));
if (!path) throw new Error('Run npm run build before the bundled worker tests.');
const source = readFileSync(`dist/assets/${path}`, 'utf8');
function harness(project) {
  let now = 1000, interval; const messages = [];
  const self = { postMessage: data => messages.push(structuredClone(data)) };
  vm.runInNewContext(source, { self, performance: { timeOrigin: 0, now: () => now }, setInterval: fn => { interval = fn; return 1; }, clearInterval: () => { interval = undefined; } });
  const send = data => self.onmessage({ data }); send({ type: 'project', project: structuredClone(project) });
  return { send, messages, tick: n => { now = n; interval?.(); } };
}
test('shipped worker protects first beat from a delayed initial load', () => {
  const h = harness(makePreset()); h.send({ type: 'start', at: 100, run: 9 });
  const events = h.messages.at(-1); assert.equal(events.run, 9); assert.equal(events.dropped, 0);
  assert.equal(events.notes[0].step, 0); assert.equal(events.notes[0].at, 1040);
  h.send({ type: 'stop' }); const before = h.messages.length; h.tick(1200); assert.equal(h.messages.length, before);
});
test('shipped worker follows MIDI Start, Stop and Continue with preserved position', () => {
  const p = makePreset(); p.config.sync = 'midi'; p.config.density = 1;
  const h = harness(p); h.send({ type: 'start', at: 1000, run: 1 });
  const midi = (status, at = 1100) => h.send({ type: 'midi', status, at, bpm: 120 });
  midi(248); assert.equal(h.messages.length, 0); midi(250);
  for (let i = 0; i < 6; i++) midi(248, 1100 + i * 20.8333);
  assert.equal(h.messages.length, 1); assert.equal(h.messages[0].notes[0].step, 0);
  midi(252); for (let i = 0; i < 12; i++) midi(248); assert.equal(h.messages.length, 1);
  midi(251); midi(248, 2000); assert.equal(h.messages[1].notes[0].step, 1);
  midi(250); midi(248, 2100); assert.equal(h.messages[2].notes[0].step, 0);
});
test('shipped worker launches Link playback on a whole beat and pauses stale snapshots', () => {
  const p = makePreset(); p.config.sync = 'link'; p.config.density = 1;
  const h = harness(p); h.send({ type: 'link', beat: .25, bpm: 120, at: 1000 }); h.send({ type: 'start', at: 1080, run: 1 });
  assert.equal(h.messages[0].notes.length, 0); h.tick(1300);
  assert.equal(h.messages.at(-1).notes[0].at, 1375);
  const before = h.messages.length; h.tick(3000); assert.equal(h.messages.length, before);
});
