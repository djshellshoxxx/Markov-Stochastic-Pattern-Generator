import { Scheduler } from "./scheduler";
import type { WorkerInput, WorkerOutput } from "./types";
let scheduler: Scheduler | undefined,
  timer: ReturnType<typeof setInterval> | undefined;
let running = false,
  run = 0,
  externalTick = 0,
  externalRunning = false;
let link: { beat: number; bpm: number; at: number } | undefined;
const now = () => performance.timeOrigin + performance.now();
function post(notes: WorkerOutput["notes"], clocks: number[]) {
  self.postMessage({
    type: "events",
    notes,
    clocks,
    run,
    dropped: scheduler?.dropped ?? 0,
  } satisfies WorkerOutput);
}
function pump() {
  if (!running || !scheduler || scheduler.project.config.sync === "midi")
    return;
  if (scheduler.project.config.sync === "link") {
    if (!link || now() - link.at > 1500) return;
    const tickMs = 60000 / link.bpm / 24;
    const linkedBeat =
      link.beat + ((scheduler.nextAt - link.at) * link.bpm) / 60000;
    const error =
      ((Math.round(linkedBeat * 24) / 24 - linkedBeat) * 60000) / link.bpm;
    scheduler.nextAt += Math.max(-tickMs * 0.1, Math.min(tickMs * 0.1, error));
  }
  const events = scheduler.collect(now());
  post(events.notes, events.clocks);
}
self.onmessage = (event: MessageEvent<WorkerInput>) => {
  const m = event.data;
  if (m.type === "project") {
    if (scheduler) scheduler.update(m.project);
    else scheduler = new Scheduler(m.project);
  }
  if (m.type === "stop") {
    running = false;
    clearInterval(timer);
    externalRunning = false;
  }
  if (m.type === "start" && scheduler) {
    clearInterval(timer);
    run = m.run;
    running = true;
    externalTick = 0;
    externalRunning = false;
    // Initial worker fetch/compilation may outlast the requested lead time.
    let at = Math.max(m.at, now() + 40);
    if (scheduler.project.config.sync === "link" && link) {
      const beat = link.beat + ((at - link.at) * link.bpm) / 60000;
      at += ((Math.ceil(beat) - beat) * 60000) / link.bpm;
    }
    scheduler.reset(at);
    pump();
    timer = setInterval(pump, 20);
  }
  if (m.type === "link") {
    link = m;
    if (scheduler?.project.config.sync === "link")
      scheduler.project.config.bpm = m.bpm;
  }
  if (
    m.type === "midi" &&
    scheduler &&
    running &&
    scheduler.project.config.sync === "midi"
  ) {
    if (m.status === 0xfa) {
      scheduler.reset(m.at);
      externalTick = 0;
      externalRunning = true;
    }
    if (m.status === 0xfb) externalRunning = true;
    if (m.status === 0xfc) externalRunning = false;
    if (m.status === 0xf8 && externalRunning) {
      scheduler.project.config.bpm = m.bpm;
      if (externalTick % 6 === 0) {
        const note = scheduler.note(m.at + 25, Math.floor(externalTick / 6));
        if (note) post([note], []);
      }
      externalTick++;
    }
  }
};
