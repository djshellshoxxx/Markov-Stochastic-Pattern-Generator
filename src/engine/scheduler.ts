import {
  distribution,
  sample,
  seededRandom,
  quantize,
  velocity,
  swingOffset,
  PPQ,
} from "./math.ts";
import type { NoteEvent, Project } from "./types.ts";
import { euclidean } from "./euclidean.ts";
// Pure clock core: the worker supplies time; no DOM, audio or React dependencies.
export class Scheduler {
  project: Project;
  previous = 0;
  current = 0;
  tick = 0;
  nextAt = 0;
  dropped = 0;
  random: () => number;
  constructor(project: Project) {
    this.project = project;
    this.random = seededRandom(project.config.seed);
  }
  reset(at: number) {
    this.previous = 0;
    this.current = 0;
    this.tick = 0;
    this.nextAt = at;
    this.dropped = 0;
    this.random = seededRandom(this.project.config.seed);
  }
  update(project: Project) {
    this.project = project;
    this.current %= project.states.length;
    this.previous %= project.states.length;
  }
  note(at: number, step: number): NoteEvent | null {
    const p = this.project,
      c = p.config;
    const next = sample(
      distribution(p, this.previous, this.current),
      this.random,
    );
    this.previous = this.current;
    this.current = next;
    const s = p.states[next],
      densityHit = this.random() < c.density;
    const audible =
      densityHit &&
      (!c.rhythmEnabled ||
        euclidean(c.rhythmSteps, c.rhythmPulses, c.rhythmRotation)[
          step % c.rhythmSteps
        ]);
    const v = velocity(s.velocity, step, c, this.random);
    const beatMs = 60000 / c.bpm;
    // Pitch bend affects a whole MIDI channel, so EDO notes must not overlap.
    const maxGate =
      c.scale === "edo" ? (beatMs / 4) * (1 - c.swing) * 0.95 : Infinity;
    return {
      state: next,
      previous: this.previous,
      pitch: quantize(s.pitch, c),
      velocity: audible ? v : 0,
      durationMs: Math.min((s.duration / PPQ) * beatMs * c.gate, maxGate),
      at: at + swingOffset(step, c.bpm, c.swing),
      step,
    };
  }
  collect(
    now: number,
    horizon = 150,
  ): { notes: NoteEvent[]; clocks: number[] } {
    const notes: NoteEvent[] = [],
      clocks: number[] = [];
    const interval = 60000 / this.project.config.bpm / 24;
    if (this.nextAt < now - 30) {
      const skip = Math.ceil((now + 25 - this.nextAt) / interval);
      this.tick += skip;
      this.nextAt += skip * interval;
      this.dropped += skip;
    }
    while (this.nextAt < now + horizon) {
      if (this.project.config.clockOut) clocks.push(this.nextAt);
      if (this.tick % 6 === 0) {
        const note = this.note(this.nextAt, Math.floor(this.tick / 6));
        if (note) notes.push(note);
      }
      this.tick++;
      this.nextAt += interval;
    }
    return { notes, clocks };
  }
}
