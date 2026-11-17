import type { GeneratorConfig, NoteEvent } from "./types";
export class AudioEngine {
  context?: AudioContext;
  master?: GainNode;
  voices = new Set<OscillatorNode>();
  async initialize() {
    if (!this.context || this.context.state === "closed") {
      this.context = new AudioContext({ latencyHint: "interactive" });
      this.master = this.context.createGain();
      this.master.gain.value = 0;
      const limiter = this.context.createDynamicsCompressor();
      limiter.threshold.value = -12;
      limiter.ratio.value = 12;
      this.master.connect(limiter).connect(this.context.destination);
    }
    await this.context.resume();
    if (this.context.state !== "running")
      throw new Error("Audio is paused. Click Play or Test sound to enable it.");
  }
  volume(value: number) {
    if (this.context && this.master)
      this.master.gain.setTargetAtTime(
        value * 0.4,
        this.context.currentTime,
        0.015,
      );
  }
  note(note: NoteEvent, config: GeneratorConfig) {
    const ctx = this.context;
    if (!ctx || ctx.state !== "running" || !this.master || !config.monitor)
      return;
    const at =
      ctx.currentTime +
      Math.max(0, note.at - performance.timeOrigin - performance.now()) / 1000;
    const duration = Math.max(0.02, note.durationMs / 1000);
    const osc = ctx.createOscillator(),
      gain = ctx.createGain();
    osc.type = config.waveform;
    osc.frequency.value = 440 * 2 ** ((note.pitch - 69) / 12);
    gain.gain.setValueAtTime(0, at);
    gain.gain.linearRampToValueAtTime((note.velocity / 127) * 0.5, at + 0.006);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + duration);
    osc.connect(gain).connect(this.master);
    osc.start(at);
    osc.stop(at + duration + 0.01);
    this.voices.add(osc);
    osc.onended = () => {
      this.voices.delete(osc);
      osc.disconnect();
      gain.disconnect();
    };
  }
  stop() {
    for (const voice of this.voices) {
      try {
        voice.stop();
      } catch {
        /* Already ended. */
      }
      voice.disconnect();
    }
    this.voices.clear();
  }
  get latency() {
    return (
      (this.context?.outputLatency ?? this.context?.baseLatency ?? 0) * 1000
    );
  }
}
