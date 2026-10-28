# Architecture and contracts

## Boundaries

- `src/state/project.ts`: default configurations, playable presets, strict bounded JSON import.
- `src/state/store.ts`: Zustand patch/UI state, debounced browser persistence and undo integration. Runtime history is never serialized.
- `src/engine/math.ts`: probability normalization, exact cell rebalancing, sampling, seeded RNG, scale/EDO quantization, velocity curves and MIDI bend conversion.
- `src/engine/scheduler.ts`: pure state machine with a 960-PPQ musical model and a 24-PPQN clock. One note transition every six clock pulses.
- `src/engine/clock.worker.ts`: Dedicated Worker owns RNG/history and recurring scheduling, plus external MIDI and Link timing inputs.
- `src/engine/runtime.ts`: single lifetime controller, independent of React effects. Receives event batches, checks run generation, skips stale events, submits audio/MIDI and queues visual updates.
- `audio.ts`, `midi.ts`, `link.ts`: device-specific adapters. No React state reads inside audio rendering.
- `midi-file.ts`, `euclidean.ts`, `state/history.ts`: testable extension logic.
- `src/components`: native labelled controls, transition table, Canvas graph, trace, output routing and capture.
- `relay/server.mjs`: loopback WebSocket gateway to native Ableton Link. No relay is hosted on GitHub Pages.

## Probability model

For first order, sample `P[next | current]`. For second order, sample `P[next | previous, current]` from an explicit 3D tensor. Each previous-state slice has its own matrix editor. Presets suppress immediate returns in second-order mode, but all entries remain editable.

At entropy `e`, sample `(1-e) * normalizedRow + e/N`. A zero row becomes uniform. Editing a cell to `v` sets it exactly to `v` and scales all other cells proportionally into `1-v`. If the other cells are zero they share that remainder equally. Empty matrices and invalid dimensions are rejected on import.

The chain advances through rests, including Euclidean gate misses. A seeded generator restarts identically when configuration and start history are identical. Live edits consume the current stream rather than resetting it.

## Time model

`performance.timeOrigin + performance.now()` is the shared epoch across the worker and window. Internal events are generated 150 ms ahead on a 20 ms timer. Swing offsets odd sixteenths and never moves MIDI clock pulses. A stale worker interval skips expired ticks instead of sending a catch-up burst.

Audio maps future event deadlines onto `AudioContext.currentTime`. MIDI maps the event deadline to a window-relative `DOMHighResTimeStamp`, plus estimated audio output latency and user output delay. These are estimates, not hardware-calibrated measurements. Main-thread blocking beyond the look-ahead horizon is not fully isolated. Suspended audio, clock loss, disconnect and page unload stop notes.

MIDI clock uses 24 ticks per quarter; incoming Start resets the sequence, Continue resumes its tick counter, Stop silences output while remaining armed. Timing Clock is ignored until a transport start/continue arrives. A median of up to 48 pulse intervals estimates tempo. External mode does not echo clock, avoiding a feedback loop. Song Position Pointer is outside the current contract.

Link requests a timing snapshot every 100 ms; the relay returns beat, BPM, peers and the echoed client timestamp. A midpoint/half-RTT estimate maps the snapshot to browser time. Playback launches on a whole beat; ongoing phase corrections are bounded to avoid discontinuities. Invalid messages are discarded; stale timing pauses generation and connection loss stops transport. This is network tempo/phase following, not sample-accurate or latency-calibrated synchronization.

## Note model and bounds

Pitch is 0–127; default velocity 0–127 (zero is a rest); duration 60–3840 ticks (960 ticks per quarter). Velocity-zero generated events denote rests for visual timing and are never sent as note-ons. There are 2–12 states. BPM is bounded to 30–300. EDO supports 5–53 divisions, rooted at the selected pitch class. Microtonal note durations are clipped below the shortest swung step because channel-wide pitch bend cannot tune overlapping pitches independently.

## Persistence and lifecycle

JSON version 1 contains states, both matrices, and config; rhythm fields added later have backwards-compatible defaults. Import rejects malformed/nonfinite values, normalizes rows and bounds ranges, and resets external routing mode/clock output. Browser-storage failures surface an export reminder. Output ports are never saved or auto-permissioned.

Stop invalidates queued worker messages with a generation counter, stops oscillators, clears MIDI pending output, sends CC123/CC120 and centered pitch bend, and sends MIDI Stop when clock output was enabled. Structural or device/clock changes stop playback before new configuration is used.
