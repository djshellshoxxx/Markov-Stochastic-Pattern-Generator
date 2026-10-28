# Research and implementation decisions

Primary sources checked 2026-10-28.

| Question | Source | Decision |
| --- | --- | --- |
| Can a Dedicated Worker directly own Web Audio? | [W3C Web Audio API, Window exposure](https://www.w3.org/TR/webaudio-1.0/) and [AudioContext](https://developer.mozilla.org/en-US/docs/Web/API/AudioContext) | Keep the audio graph in the window and musical clock/probability work in a Dedicated Worker. Do not claim immunity to arbitrary main-thread stalls. |
| How should MIDI be scheduled? | [W3C Web MIDI API](https://www.w3.org/TR/webmidi/) and [MIDIOutput.send](https://developer.mozilla.org/en-US/docs/Web/API/MIDIOutput/send) | Use timestamped sends, no running status, no SysEx permission, clear the output queue on panic. Window/worker time origins are accounted for explicitly. |
| What does Link synchronize? | [Ableton Link documentation](https://ableton.github.io/link/) | Follow tempo and beat phase via a local native bridge; MIDI and audio data remain separate. Browser playback is local; no claim of direct browser UDP participation. |
| Which native bridge API is implemented? | [@ktamas77/abletonlink source and API](https://github.com/ktamas77/ableton-link) | Optional native dependency version 1.2.3, `AbletonLink`, `enable`, `getBeat`, `getTempo`, `getNumPeers`. Native installation requires compilation. |
| What should exported phrases contain? | [MIDI Association: Standard MIDI Files](https://midi.org/standard-midi-files) | Type-0 track with 960 PPQ, tempo/meter metadata, pitch bends, note-on/off pairs and end-of-track. Tests independently decode its structure. |
| How is the static app deployed? | [GitHub Pages custom workflows](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages) | Build `dist`, upload Pages artifact, deploy with the built-in token and OIDC. Relative Vite base supports repository subpaths. |
| Can a workflow enable an unconfigured Pages site? | [configure-pages action inputs](https://github.com/actions/configure-pages/blob/main/action.yml) | Do not assume `GITHUB_TOKEN` can enable Pages. First-time setup needs Pages configured in Settings; repository metadata already reports Pages enabled. |

The look-ahead values, RTT midpoint estimate, uniform entropy mixing and Euclidean modular gate are implementation choices. Browser scheduling is best effort; neither worker timers nor Web MIDI timestamps make a hard real-time guarantee. Hardware/DAW loopback and real multi-peer Link verification require equipment outside this environment.
