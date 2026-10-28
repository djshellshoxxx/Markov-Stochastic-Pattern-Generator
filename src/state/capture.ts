import { create } from "zustand";
import type { CapturedNote } from "../engine/midi-file";
import type { NoteEvent } from "../engine/types";
export const useCapture = create<{
  recording: boolean;
  notes: CapturedNote[];
  startedAt: number;
  duration: number;
  bpm: number;
}>(() => ({
  recording: false,
  notes: [],
  startedAt: 0,
  duration: 0,
  bpm: 120,
}));
let timer: ReturnType<typeof setTimeout>;
export function beginCapture(bpm: number) {
  clearTimeout(timer);
  useCapture.setState({
    recording: true,
    notes: [],
    startedAt: performance.timeOrigin + performance.now(),
    duration: 0,
    bpm,
  });
  timer = setTimeout(endCapture, 120000);
}
export function recordNote(n: NoteEvent, channel: number) {
  const s = useCapture.getState();
  if (!s.recording || n.velocity === 0 || n.at < s.startedAt) return;
  useCapture.setState({
    notes: [
      ...s.notes,
      {
        at: n.at - s.startedAt,
        durationMs: n.durationMs,
        velocity: n.velocity,
        pitch: n.pitch,
        channel,
      },
    ],
  });
  if (s.notes.length >= 4095) endCapture();
}
export function endCapture() {
  clearTimeout(timer);
  const s = useCapture.getState();
  if (!s.recording) return;
  const duration = Math.min(
    120000,
    performance.timeOrigin + performance.now() - s.startedAt,
  );
  useCapture.setState({
    recording: false,
    duration,
    notes: s.notes.filter((n) => n.at < duration),
  });
}
