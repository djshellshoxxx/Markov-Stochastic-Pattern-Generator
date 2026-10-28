import { useEffect, useRef } from "react";
import { useStore } from "../state/store";
import { distribution, noteName } from "../engine/math";
import { Panel } from "./Controls";
export function Graph() {
  const canvas = useRef<HTMLCanvasElement>(null),
    project = useStore((s) => s.project),
    current = useStore((s) => s.current),
    previous = useStore((s) => s.previous),
    playing = useStore((s) => s.playing);
  useEffect(() => {
    const el = canvas.current;
    if (!el) return;
    function draw() {
      if (!el) return;
      const ctx = el.getContext("2d");
      if (!ctx) return;
      const width = el.clientWidth,
        height = 318,
        dpr = window.devicePixelRatio || 1;
      el.width = width * dpr;
      el.height = height * dpr;
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, width, height);
      const cx = width / 2,
        cy = height / 2,
        radius = Math.min(width * 0.34, 110);
      const points = project.states.map((_, i) => ({
        x:
          cx +
          Math.cos((i / project.states.length) * Math.PI * 2 - Math.PI / 2) *
            radius,
        y:
          cy +
          Math.sin((i / project.states.length) * Math.PI * 2 - Math.PI / 2) *
            radius,
      }));
      ctx.fillStyle = "#293239";
      for (let x = 12; x < width; x += 20)
        for (let y = 12; y < height; y += 20) {
          ctx.beginPath();
          ctx.arc(x, y, 0.6, 0, Math.PI * 2);
          ctx.fill();
        }
      for (let i = 0; i < points.length; i++) {
        const row = distribution(project, previous, i);
        for (let j = 0; j < points.length; j++) {
          const weight = row[j];
          if (weight < 0.025) continue;
          const a = points[i],
            b = points[j],
            active = playing && i === previous && j === current;
          ctx.strokeStyle = active
            ? "#b4f272"
            : `rgba(133,166,149,${0.06 + weight * 0.55})`;
          ctx.lineWidth = active ? 2.2 : 0.5 + weight * 3;
          ctx.beginPath();
          if (i === j) {
            ctx.arc(a.x, a.y - 22, 17, 0, Math.PI * 2);
            ctx.stroke();
            continue;
          }
          const dx = b.x - a.x,
            dy = b.y - a.y,
            length = Math.hypot(dx, dy),
            ux = dx / length,
            uy = dy / length;
          const start = { x: a.x + ux * 23, y: a.y + uy * 23 },
            end = { x: b.x - ux * 25, y: b.y - uy * 25 };
          const mid = {
            x: (a.x + b.x) / 2 - uy * 20,
            y: (a.y + b.y) / 2 + ux * 20,
          };
          ctx.moveTo(start.x, start.y);
          ctx.quadraticCurveTo(mid.x, mid.y, end.x, end.y);
          ctx.stroke();
          const angle = Math.atan2(end.y - mid.y, end.x - mid.x);
          ctx.beginPath();
          ctx.moveTo(end.x, end.y);
          ctx.lineTo(
            end.x - 6 * Math.cos(angle - 0.45),
            end.y - 6 * Math.sin(angle - 0.45),
          );
          ctx.moveTo(end.x, end.y);
          ctx.lineTo(
            end.x - 6 * Math.cos(angle + 0.45),
            end.y - 6 * Math.sin(angle + 0.45),
          );
          ctx.stroke();
        }
      }
      points.forEach((point, i) => {
        const active = playing && current === i;
        if (active) {
          ctx.beginPath();
          ctx.arc(point.x, point.y, 29, 0, Math.PI * 2);
          ctx.strokeStyle = "#b4f24544";
          ctx.lineWidth = 5;
          ctx.stroke();
        }
        ctx.beginPath();
        ctx.arc(point.x, point.y, 23, 0, Math.PI * 2);
        ctx.fillStyle = active ? "#b4f272" : "#1b2429";
        ctx.fill();
        ctx.strokeStyle = active ? "#b4f272" : "#516259";
        ctx.lineWidth = 1.3;
        ctx.stroke();
        ctx.textAlign = "center";
        ctx.fillStyle = active ? "#15200b" : "#dde8df";
        ctx.font = "bold 14px monospace";
        ctx.fillText(project.states[i].id, point.x, point.y + 1);
        ctx.font = "9px monospace";
        ctx.fillStyle = active ? "#324621" : "#91a299";
        ctx.fillText(noteName(project.states[i].pitch), point.x, point.y + 14);
      });
    }
    draw();
    const observer = new ResizeObserver(draw);
    observer.observe(el);
    return () => observer.disconnect();
  }, [project, current, previous, playing]);
  return (
    <Panel
      title="State network"
      eyebrow="02 / LIVE VIEW"
      className="graph-panel"
      actions={
        <span className={`live-badge ${playing ? "active" : ""}`}>
          <i />
          {playing ? "LIVE" : "IDLE"}
        </span>
      }
    >
      <canvas
        ref={canvas}
        role="img"
        aria-label={`Directed probability network. ${playing ? `Current state ${project.states[current]?.id}.` : "Playback stopped."}`}
      />
      <div className="graph-caption">
        <span>Edge weight = transition probability</span>
        <span>{project.states.length} NODES</span>
      </div>
    </Panel>
  );
}
