import { AudioEngine } from "./audio";
import { MidiEngine } from "./midi";
import { LinkClient } from "./link";
import { useStore } from "../state/store";
import { defaultConfig } from "../state/project";
import type { NoteEvent, WorkerInput, WorkerOutput } from "./types";
import { beginCapture, endCapture, recordNote } from "../state/capture";
export const audio = new AudioEngine();
export const midi = new MidiEngine();
export const link = new LinkClient();
let worker: Worker | undefined,
  run = 0,
  starting = false;
let visuals: NoteEvent[] = [],
  animation = 0,
  lastMidiAt = 0,
  midiActive = false;
export let linkReady = false;
const message = (text: string) => useStore.setState({ message: text });
function send(m: WorkerInput) {
  worker?.postMessage(m);
}
function animate() {
  const now = performance.timeOrigin + performance.now();
  const due = visuals.filter((e) => e.at <= now);
  visuals = visuals.filter((e) => e.at > now);
  if (due.length) {
    const last = due[due.length - 1];
    useStore.setState((s) => ({
      current: last.state,
      previous: last.previous,
      step: last.step,
      history: [...s.history, ...due].slice(-64),
    }));
  }
  if (useStore.getState().playing) animation = requestAnimationFrame(animate);
}
function ensureWorker() {
  if (worker) return;
  worker = new Worker(new URL("./clock.worker.ts", import.meta.url), {
    type: "module",
  });
  worker.onerror = () => {
    stop();
    message("The scheduling worker stopped. Reload the page to restart it.");
  };
  worker.onmessage = (event: MessageEvent<WorkerOutput>) => {
    const m = event.data,
      s = useStore.getState();
    if (
      !s.playing ||
      m.run !== run ||
      (s.project.config.sync === "midi" && !midiActive)
    )
      return;
    const now = performance.timeOrigin + performance.now();
    let late = 0;
    for (const note of m.notes) {
      if (note.at < now - 30) {
        late++;
        continue;
      }
      if (note.velocity > 0) {
        audio.note(note, s.project.config);
        midi.note(note, s.project.config, audio.latency);
      }
      visuals.push({ ...note, at: note.at + audio.latency });
      recordNote(
        { ...note, at: note.at + audio.latency },
        s.project.config.channel,
      );
    }
    for (const at of m.clocks)
      if (at >= now - 5)
        midi.send(
          [0xf8],
          at -
            performance.timeOrigin +
            audio.latency +
            s.project.config.midiLatency,
        );
    useStore.setState({ late: Math.max(s.late, m.dropped) + late });
  };
}
export async function start() {
  if (starting || useStore.getState().playing) return;
  starting = true;
  const token = ++run;
  try {
    const initial = useStore.getState().project.config;
    // A saved MIDI-only/zero-volume patch must not silently play with no output.
    const restored = midi.output?.state !== "connected" &&
      (!initial.monitor || initial.volume === 0);
    if (restored) useStore.getState().configure({
      monitor: true,
      volume: initial.volume > 0 ? initial.volume : defaultConfig.volume,
    });
    const c = useStore.getState().project.config;
    if (c.sync === "midi" && !midi.input)
      throw new Error("Connect MIDI and choose a clock input first.");
    if (c.sync === "link" && !linkReady)
      throw new Error("Connect the companion Link relay first.");
    await audio.initialize();
    if (token !== run) return;
    audio.context!.onstatechange = () => {
      if (audio.context?.state !== "running" && useStore.getState().playing) {
        stop();
        message("Audio was suspended by the browser. Press Play to resume.");
      }
    };
    ensureWorker();
    audio.volume(c.volume);
    midi.prepare(c);
    const at = performance.timeOrigin + performance.now() + 80;
    midiActive = false;
    lastMidiAt = 0;
    useStore.setState({
      playing: true,
      history: [],
      step: -1,
      late: 0,
      message:
        c.sync === "midi" ? "Armed · waiting for MIDI Start / Continue." :
          restored ? "Internal synth enabled — restored audible output for this patch." : "",
    });
    send({ type: "project", project: useStore.getState().project });
    send({ type: "start", at, run });
    if (c.clockOut && c.sync !== "midi")
      midi.send(
        [0xfa],
        at - performance.timeOrigin + audio.latency + c.midiLatency,
      );
    animation = requestAnimationFrame(animate);
  } catch (error) {
    message(error instanceof Error ? error.message : "Unable to start audio.");
  } finally {
    starting = false;
  }
}
export async function testSound() {
  try {
    await audio.initialize();
    const config = useStore.getState().project.config;
    const volume = config.volume > 0 ? config.volume : defaultConfig.volume;
    useStore.getState().configure({ monitor: true, volume });
    audio.volume(volume);
    audio.note({
      at: performance.timeOrigin + performance.now() + 30,
      durationMs: 700, pitch: 69, velocity: 110, state: 0, previous: 0, step: 0,
    }, { ...config, monitor: true, volume, waveform: "sine" });
    message("Playing a 440 Hz test tone. If silent, check this tab's mute and your selected system output.");
  } catch (error) {
    message(error instanceof Error ? error.message : "Unable to start audio.");
  }
}
export function stop() {
  endCapture();
  run++;
  send({ type: "stop" });
  cancelAnimationFrame(animation);
  visuals = [];
  audio.stop();
  midi.panic();
  if (useStore.getState().project.config.clockOut) midi.send([0xfc]);
  useStore.setState({ playing: false });
}
export function startRecording() {
  const s = useStore.getState();
  if (!s.playing) return;
  beginCapture(s.project.config.bpm);
  for (const n of visuals) recordNote(n, s.project.config.channel);
}
midi.onStatus = (text) => {
  if (useStore.getState().playing) stop();
  message(text);
};
midi.onClock = (status, at, bpm) => {
  if (useStore.getState().project.config.sync !== "midi") return;
  lastMidiAt = performance.now();
  if (status === 0xfc) {
    endCapture();
    midiActive = false;
    audio.stop();
    midi.panic();
    visuals = [];
    message("MIDI transport stopped · armed for Continue.");
  }
  if (status === 0xfa || status === 0xfb) {
    midiActive = true;
    if (status === 0xfa) {
      audio.stop();
      midi.panic();
      visuals = [];
    }
    message("Following MIDI clock");
  }
  send({ type: "midi", status, at, bpm });
  if (
    status === 0xf8 &&
    Math.abs(useStore.getState().project.config.bpm - bpm) > 0.25
  )
    useStore.getState().configure({ bpm });
};
setInterval(() => {
  if (
    useStore.getState().playing &&
    useStore.getState().project.config.sync === "midi" &&
    midiActive &&
    lastMidiAt &&
    performance.now() - lastMidiAt > 2000
  ) {
    stop();
    message("MIDI clock lost. Press Play to arm again.");
  }
}, 500);
link.onSnapshot = (snapshot) => {
  ensureWorker();
  send({ type: "link", ...snapshot });
  if (
    useStore.getState().project.config.sync === "link" &&
    Math.abs(useStore.getState().project.config.bpm - snapshot.bpm) > 0.05
  )
    useStore.getState().configure({ bpm: snapshot.bpm });
};
useStore.subscribe((s, prev) => {
  if (s.project === prev.project) return;
  const a = s.project.config,
    b = prev.project.config;
  if (
    s.playing &&
    (a.sync !== b.sync ||
      a.channel !== b.channel ||
      a.scale !== b.scale ||
      a.clockOut !== b.clockOut ||
      s.project.states.length !== prev.project.states.length)
  )
    stop();
  audio.volume(a.volume);
  if (!a.monitor && b.monitor) audio.stop();
  send({ type: "project", project: s.project });
});
export function setLinkReady(ready: boolean) {
  linkReady = ready;
  if (
    !ready &&
    useStore.getState().playing &&
    useStore.getState().project.config.sync === "link"
  )
    stop();
}
window.addEventListener("pagehide", stop);
