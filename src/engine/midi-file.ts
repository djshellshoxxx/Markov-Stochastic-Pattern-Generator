import { pitchBend, PPQ } from "./math.ts";
export interface CapturedNote {
  at: number;
  durationMs: number;
  pitch: number;
  velocity: number;
  channel: number;
}
const ascii = (text: string) => Array.from(text, (c) => c.charCodeAt(0));
const u32 = (n: number) => [
  (n >>> 24) & 255,
  (n >>> 16) & 255,
  (n >>> 8) & 255,
  n & 255,
];
export function vlq(n: number): number[] {
  const result = [n & 127];
  while ((n >>>= 7)) result.unshift((n & 127) | 128);
  return result;
}
export function midiFile(
  notes: CapturedNote[],
  bpm: number,
  durationMs: number,
): Uint8Array<ArrayBuffer> {
  const events: { tick: number; priority: number; data: number[] }[] = [];
  const ticks = (ms: number) =>
    Math.max(0, Math.round(((ms * bpm) / 60000) * PPQ));
  const tempo = Math.round(60_000_000 / bpm);
  events.push({
    tick: 0,
    priority: -3,
    data: [255, 81, 3, (tempo >> 16) & 255, (tempo >> 8) & 255, tempo & 255],
  });
  events.push({ tick: 0, priority: -3, data: [255, 88, 4, 4, 2, 24, 8] });
  const valid = notes.filter(
    (n) => n.velocity > 0 && n.at >= 0 && n.at < durationMs,
  );
  const channels = new Set(valid.map((n) => n.channel - 1));
  for (const ch of channels)
    for (const [cc, val] of [
      [101, 0],
      [100, 0],
      [6, 2],
      [38, 0],
      [101, 127],
      [100, 127],
    ])
      events.push({ tick: 0, priority: -2, data: [0xb0 | ch, cc, val] });
  for (const n of valid) {
    const start = ticks(n.at),
      end = Math.max(
        start + 1,
        ticks(Math.min(durationMs, n.at + n.durationMs)),
      ),
      ch = n.channel - 1,
      bend = pitchBend(n.pitch);
    events.push({
      tick: start,
      priority: 1,
      data: [0xe0 | ch, bend.lsb, bend.msb],
    });
    events.push({
      tick: start,
      priority: 2,
      data: [0x90 | ch, bend.note, n.velocity],
    });
    events.push({ tick: end, priority: 0, data: [0x80 | ch, bend.note, 0] });
  }
  events.sort((a, b) => a.tick - b.tick || a.priority - b.priority);
  const track: number[] = [];
  let last = 0;
  for (const e of events) {
    track.push(...vlq(e.tick - last), ...e.data);
    last = e.tick;
  }
  for (const ch of channels) track.push(0, 0xe0 | ch, 0, 64);
  track.push(...vlq(Math.max(0, ticks(durationMs) - last)), 255, 47, 0);
  return new Uint8Array([
    ...ascii("MThd"),
    ...u32(6),
    0,
    0,
    0,
    1,
    PPQ >> 8,
    PPQ & 255,
    ...ascii("MTrk"),
    ...u32(track.length),
    ...track,
  ]);
}
