# MARKOV / Stochastic Pattern Generator

A browser instrument for controlled chance: shape a Markov transition matrix into evolving rhythms and melodies, monitor through a built-in synth, or send timestamped MIDI to your DAW or hardware.

**App:** https://djshellshoxxx.github.io/Markov-Stochastic-Pattern-Generator/

**[CDL home](https://djshellshoxxx.github.io/circuitdriftlabs/)**

## Play

1. Press **Play** (or Space away from a form control). No MIDI device is needed.
   If a saved patch has its synth off or volume at zero and no MIDI output is connected, Play restores audible synth settings. **Test sound** plays a 440 Hz tone independently of the sequencer and enables the internal synth. The transport shows whether the synth is on or muted.
2. Select a matrix cell and move **Transition probability**. Its row stays normalized.
3. Switch to **2nd order** to edit conditional probabilities for each previous/current pair.
4. Adjust entropy, root/scale, swing, note density, velocity curves, gate, and note states.
5. To use hardware, **Enable MIDI**, select an output and channel. External MIDI clock supports Start, Stop and Continue. Press **Arm** before starting the external transport.

Your patch saves locally in the browser. Use the upload/download buttons to import/export validated JSON. Four presets provide starting points. Edits take effect after the short scheduling horizon; device/clock/scale changes stop playback cleanly.

## Included

- React + TypeScript + Zustand, no backend required for the instrument.
- 2–12 note states, normalized N×N first-order and N×N×N second-order probabilities.
- Entropy interpolation from strict matrix probabilities to uniform randomness; reproducible seeded playback.
- Chromatic, Dorian, Lydian, minor, pentatonic, and 5–53 EDO quantization.
- Dedicated Worker sequencing, 20 ms wake-up and 150 ms look-ahead; Web Audio scheduling and Web MIDI timestamps.
- Four oscillator waveforms, velocity-sensitive envelopes, monitor gain and limiter.
- MIDI note/channel routing, adjustable output delay, 24 PPQN clock in/out, tap tempo, note swing, device disconnect handling, panic.
- Canvas probability network and 16-step velocity/note trace.
- Ableton Link tempo/phase following through the included [companion relay](relay/README.md).

### Three additional features

1. **Phrase capture / MIDI export:** record up to two minutes and export a type-0 `.mid` file with timing, velocity, channel, and microtonal pitch bends.
2. **Euclidean rhythm gate:** 2–32 steps, pulse count, rotation, live mask display; combines with stochastic note density.
3. **Undo / redo:** 60 patch snapshots, grouped continuous edits, toolbar controls and Ctrl/Cmd+Z / Ctrl/Cmd+Shift+Z.

See [feature specs](docs/FEATURES.md), [architecture](docs/ARCHITECTURE.md), [research notes](docs/RESEARCH.md), and [validation](docs/VALIDATION.md).

## Develop

Node.js 22.18+ (Node 24 used for validation).

```sh
npm ci
npm run dev
npm test
npm run build
npm run test:worker
npm run preview
```

The project uses relative asset/worker URLs so its build works under the repository's GitHub Pages path or a custom domain. `dist/` is the deployable static site.

## GitHub Pages

The `Pages` workflow tests and builds every push and pull request; only `main` deploys. Under **Settings → Pages → Build and deployment**, use **GitHub Actions** as the source. The workflow uses the built-in token, `pages: write` and `id-token: write`; no personal access token is required. Subsequent pushes to `main` update the site.

## Browser / timing details

Audio starts after a user gesture. MIDI requires a secure context, browser support, and device permission; the synth remains usable without it. A virtual MIDI port may be required to route into a DAW.

A Dedicated Worker cannot own an `AudioContext` in the current deployed API. The worker calculates musical events; the main thread submits them ahead of time to the audio renderer and MIDI driver. This reduces UI-induced jitter; it does **not** guarantee jitter-free playback through long stalls, browser suspension or sleep. Late events are skipped rather than replayed in a burst. MIDI input adds 25 ms of scheduling lead. Keep the tab active for best results.

EDO is exact in the synth. MIDI 1.0 uses monophonic channel pitch bend with an RPN request for ±2 semitones; receivers must support that bend range. Ordinary MIDI note lengths may overlap. Link follows tempo and beat phase, not remote play/stop; the browser transport remains local. Link requires a native relay on the same network as your Link peers, with trusted TLS when connecting from GitHub Pages.

Phrase files preserve performed timing using a fixed tempo equal to the tempo at capture start; tempo changes are flattened into event positions. Captures and undo history are session-only. App configuration stays on your device. The optional fonts are loaded from Google Fonts; system fonts work if unavailable.
