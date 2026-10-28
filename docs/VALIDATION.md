# Validation record

Validated 2026-10-28 with Node 24.22.1, TypeScript and Vite production build.

## Automated checks

- 19 application tests pass: 10,000 matrix edits; 100,000 weighted samples; exact second-order contexts; entropy; rooted scales/EDO; deterministic restart; stale clock recovery; 24 PPQN and swing separation; microtonal non-overlap; JSON validation/backwards compatibility; exhaustive Euclidean masks; bounded/grouped undo/redo; independently decoded MIDI file structure; MIDI scheduling/panic and input transport/tempo with mock devices.
- 3 tests exercise the actual bundled worker: delayed initial startup, MIDI Start/Stop/Continue, Link beat-aligned launch and stale timing.
- Relay protocol integration test passes against a real loopback WebSocket connection and injected clock; checks timing values and denied origins.
- `npm run build` passes strict TypeScript checking and creates a standalone worker plus relative-path static assets.

## Browser checks

- Play starts transport; graph state, note trace and position advance; Stop returns to idle.
- Recording captures notes and enables MIDI export after finishing. Stopping playback ends the take.
- Enabling the rhythm gate changes its checked state; Undo restores the prior gate state and enables Redo.
- Responsive layout inspected using embedded viewports at 320, 768, 1024 and 1440 px. Body scroll width matched viewport client width at each size. Matrix scrolling is contained within its panel on narrow screens.
- Published GitHub Pages build tested directly: playback, second-order context switch, and capture/export. A downloaded 636-note MIDI file was decoded and had 636 matching note-offs, a valid track length and 960 PPQ.
- Native labels, range controls, buttons, selects and dialog are used; probability sliders have explicit accessible names. Space avoids editable controls. Reduced-motion CSS disables transitions.

## Limits

Physical MIDI hardware/DAW loopback and a real multi-peer Ableton Link session are unavailable here. MIDI adapter behavior is tested with mock ports; the WebSocket protocol is tested separately from native Link.

A native addon build was attempted but this environment's node-gyp header extraction failed with `TAR_ENTRY_ERROR EINVAL: invalid argument, fchown`. This is separate from the passing relay protocol test. The native relay needs compilation and verification on the user's machine, including TLS/browser local network access and peer discovery.

The scheduler is best-effort browser timing. Tests do not establish a jitter-free or sample-accurate guarantee. An audio loopback measurement and a full assistive-technology audit were not performed.
