import { pitchBend } from "./math.ts";
import type { GeneratorConfig, NoteEvent } from "./types";
export class MidiEngine {
  access?: MIDIAccess;
  output?: MIDIOutput;
  input?: MIDIInput;
  onPorts = () => {};
  onStatus = (_message: string) => {};
  onClock = (_status: number, _at: number, _bpm: number) => {};
  intervals: number[] = [];
  lastTick = 0;
  bpm = 120;
  async connect() {
    if (!navigator.requestMIDIAccess)
      throw new Error(
        "Web MIDI is unavailable in this browser. The internal synth is ready to use.",
      );
    this.access = await navigator.requestMIDIAccess({ sysex: false });
    this.access.onstatechange = () => {
      if (this.output?.state === "disconnected") {
        this.output = undefined;
        this.onStatus("MIDI output disconnected.");
      }
      if (this.input?.state === "disconnected") {
        this.input.onmidimessage = null;
        this.input = undefined;
        this.onStatus("MIDI clock input disconnected.");
      }
      this.onPorts();
    };
    this.onPorts();
  }
  selectOutput(id: string) {
    this.panic();
    this.output = this.access?.outputs.get(id);
  }
  selectInput(id: string) {
    if (this.input) this.input.onmidimessage = null;
    this.input = this.access?.inputs.get(id);
    this.lastTick = 0;
    this.intervals = [];
    if (this.input)
      this.input.onmidimessage = (e) => {
        const status = e.data?.[0];
        if (status === undefined) return;
        const at = e.timeStamp;
        if (status === 0xfa) {
          this.lastTick = 0;
          this.intervals = [];
        }
        if (status === 0xf8) {
          const delta = at - this.lastTick;
          if (this.lastTick && delta > 1 && delta < 100) {
            this.intervals.push(delta);
            if (this.intervals.length > 48) this.intervals.shift();
            const sorted = [...this.intervals].sort((a, b) => a - b);
            this.bpm = Math.max(
              30,
              Math.min(
                300,
                60000 / (sorted[Math.floor(sorted.length / 2)] * 24),
              ),
            );
          }
          this.lastTick = at;
        }
        if ([0xf8, 0xfa, 0xfb, 0xfc].includes(status))
          this.onClock(status, at + performance.timeOrigin, this.bpm);
      };
  }
  send(bytes: number[], timestamp = performance.now()) {
    try {
      if (this.output?.state === "connected")
        this.output.send(bytes, timestamp);
    } catch {
      this.onStatus("MIDI send failed. Reconnect or choose another output.");
    }
  }
  prepare(config: GeneratorConfig) {
    if (config.scale !== "edo") return;
    // RPN 0: pitch-bend sensitivity = ±2 semitones, then deselect RPN.
    const ch = config.channel - 1;
    for (const [cc, value] of [
      [101, 0],
      [100, 0],
      [6, 2],
      [38, 0],
      [101, 127],
      [100, 127],
    ])
      this.send([0xb0 | ch, cc, value]);
  }
  note(event: NoteEvent, config: GeneratorConfig, audioLatency: number) {
    const ch = config.channel - 1;
    const at = Math.max(
      performance.now(),
      event.at - performance.timeOrigin + audioLatency + config.midiLatency,
    );
    const pitch = pitchBend(event.pitch);
    this.send([0xe0 | ch, pitch.lsb, pitch.msb], at);
    this.send([0x90 | ch, pitch.note, event.velocity], at);
    this.send([0x80 | ch, pitch.note, 0], at + event.durationMs);
  }
  panic() {
    try {
      (this.output as (MIDIOutput & { clear(): void }) | undefined)?.clear();
    } catch {
      /* Disconnected or older port. */
    }
    if (!this.output) return;
    for (let ch = 0; ch < 16; ch++) {
      this.send([0xb0 | ch, 123, 0]);
      this.send([0xb0 | ch, 120, 0]);
      this.send([0xe0 | ch, 0, 64]);
    }
  }
}
