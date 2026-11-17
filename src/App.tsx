import { useEffect, useRef, useState } from "react";
import {
  Download,
  Upload,
  ChevronDown,
  Github,
  X,
  HelpCircle,
} from "lucide-react";
import { useStore } from "./state/store";
import { makePreset, parseProject, presetNames } from "./state/project";
import { start, stop } from "./engine/runtime";
import { Transport } from "./components/Transport";
import { Matrix } from "./components/Matrix";
import { Graph } from "./components/Graph";
import { Rules } from "./components/Rules";
import { Sequence } from "./components/Sequence";
import { States } from "./components/States";
import { Routing } from "./components/Routing";
import { Extensions, HistoryButtons } from "./components/Extensions";
import { download } from "./engine/download";
export default function App() {
  const project = useStore((s) => s.project),
    message = useStore((s) => s.message),
    late = useStore((s) => s.late);
  const file = useRef<HTMLInputElement>(null),
    help = useRef<HTMLDialogElement>(null),
    [showHelp, setShowHelp] = useState(false);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (
        (e.ctrlKey || e.metaKey) &&
        !["INPUT", "TEXTAREA"].includes(target.tagName) &&
        !target.isContentEditable &&
        !help.current?.open
      ) {
        if (e.key.toLowerCase() === "z") {
          e.preventDefault();
          useStore.getState()[e.shiftKey ? "redo" : "undo"]();
          return;
        }
        if (e.key.toLowerCase() === "y") {
          e.preventDefault();
          useStore.getState().redo();
          return;
        }
      }
      if (
        ["INPUT", "SELECT", "TEXTAREA", "BUTTON", "SUMMARY"].includes(
          target.tagName,
        ) ||
        target.isContentEditable ||
        help.current?.open
      )
        return;
      if (e.code === "Space") {
        e.preventDefault();
        if (useStore.getState().playing) stop();
        else void start();
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, []);
  useEffect(() => {
    if (showHelp) help.current?.showModal();
    else help.current?.close();
  }, [showHelp]);
  async function importProject(file: File) {
    try {
      if (file.size > 2_000_000)
        throw new Error("Choose a project file smaller than 2 MB.");
      const p = parseProject(JSON.parse(await file.text()));
      stop();
      useStore.getState().load(p);
      useStore.setState({ message: `Loaded “${p.name}”.` });
    } catch (e) {
      useStore.setState({
        message:
          e instanceof Error ? e.message : "This project could not be loaded.",
      });
    }
  }
  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="brand">
          <svg viewBox="0 0 36 36" aria-hidden="true">
            <path d="M5 27V9l13 13L31 9v18" />
          </svg>
          <div>
            <h1>
              MARKOV<span> / </span>
            </h1>
            <p>STOCHASTIC PATTERN GENERATOR</p>
          </div>
          <span className="version">v1.0</span>
        </div>
        <div className="header-actions">
          <a className="cdl-home" href="https://djshellshoxxx.github.io/circuitdriftlabs/">← CDL home</a>
          <button
            className="icon-button"
            onClick={() => setShowHelp(true)}
            aria-label="Open quick guide"
          >
            <HelpCircle size={19} />
          </button>
          <a
            className="icon-button"
            aria-label="Source code on GitHub"
            href="https://github.com/djshellshoxxx/Markov-Stochastic-Pattern-Generator"
            target="_blank"
            rel="noreferrer"
          >
            <Github size={19} />
          </a>
        </div>
      </header>
      <main>
        <div className="workspace-heading">
          <div>
            <div className="eyebrow accent">
              AN INSTRUMENT FOR CONTROLLED CHANCE
            </div>
            <h2>
              Find a pattern.<span> Let it wander.</span>
            </h2>
          </div>
          <div className="patch-tools">
            <label className="preset-select">
              <span className="eyebrow">STARTING POINT</span>
              <select
                aria-label="Load preset"
                value={
                  presetNames.includes(
                    project.name as (typeof presetNames)[number],
                  )
                    ? project.name
                    : ""
                }
                onChange={(e) => {
                  stop();
                  useStore.getState().load(makePreset(e.target.value));
                }}
              >
                <option value="" disabled>
                  Custom patch
                </option>
                {presetNames.map((n) => (
                  <option key={n}>{n}</option>
                ))}
              </select>
              <ChevronDown size={14} />
            </label>
            <button
              className="icon-button"
              aria-label="Import project"
              title="Import project JSON"
              onClick={() => file.current?.click()}
            >
              <Upload size={17} />
            </button>
            <button
              className="icon-button"
              aria-label="Export project"
              title="Export project JSON"
              onClick={() =>
                download(
                  JSON.stringify(project, null, 2),
                  "markov-patch.json",
                  "application/json",
                )
              }
            >
              <Download size={17} />
            </button>
            <input
              hidden
              type="file"
              accept=".json,application/json"
              ref={file}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void importProject(f);
                e.target.value = "";
              }}
            />
          </div>
        </div>
        <div className="edit-toolbar">
          <span className="helper">Patch changes save in this browser.</span>
          <HistoryButtons />
        </div>
        <Transport />
        {message && (
          <div className="notice" role="status">
            <span>{message}</span>
            <button
              className="icon-button"
              aria-label="Dismiss notification"
              onClick={() => useStore.setState({ message: "" })}
            >
              <X size={15} />
            </button>
          </div>
        )}
        <div className="instrument-grid">
          <Matrix />
          <Graph />
          <Rules />
          <Sequence />
        </div>
        <States />
        <Extensions />
        <Routing />
        <footer>
          <span>
            <i className="status-dot on" />
            LOCAL-FIRST · NO ACCOUNT REQUIRED
          </span>
          <span>
            {late
              ? `${late} late events skipped · reduce system load`
              : "960 PPQ · WORKER SCHEDULING"}
            <b> / </b>
            <kbd>SPACE</kbd> PLAY / STOP
          </span>
        </footer>
      </main>
      <dialog
        ref={help}
        onClose={() => setShowHelp(false)}
        className="help-dialog"
      >
        <div className="dialog-heading">
          <h2>A little structure. A little chance.</h2>
          <button
            className="icon-button"
            aria-label="Close guide"
            onClick={() => setShowHelp(false)}
          >
            <X />
          </button>
        </div>
        <ol>
          <li>
            <b>Press Play.</b> The built-in synth works without MIDI hardware.
          </li>
          <li>
            <b>Shape a transition.</b> Select a matrix cell, then adjust its
            probability. Each row always sums to one.
          </li>
          <li>
            <b>Give it memory.</b> Second-order mode remembers two states.
            Choose a previous state above the matrix to edit that context.
          </li>
          <li>
            <b>Let it wander.</b> Entropy blends the matrix toward equal chance.
            Scale lock keeps the pitches in your chosen key.
          </li>
          <li>
            <b>Route it.</b> Enable MIDI, choose an output, then select a
            channel. A virtual MIDI port can connect your DAW.
          </li>
        </ol>
        <p>
          Projects save in this browser. Export a JSON patch to keep or share
          it. MIDI availability depends on browser support and device
          permission. Link requires the companion relay.
        </p>
        <p>
          Microtonal MIDI uses a monophonic channel with ±2-semitone pitch bend;
          your instrument must honor the pitch-bend range.
        </p>
      </dialog>
    </div>
  );
}
