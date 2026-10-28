import type { ReactNode } from "react";
export function Panel({
  title,
  eyebrow,
  actions,
  children,
  className = "",
}: {
  title: string;
  eyebrow: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`panel ${className}`}>
      <header className="panel-header">
        <div>
          <span className="eyebrow">{eyebrow}</span>
          <h2>{title}</h2>
        </div>
        {actions}
      </header>
      {children}
    </section>
  );
}
export function Slider({
  label,
  value,
  onChange,
  min = 0,
  max = 1,
  step = 0.01,
  display,
  hint,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  min?: number;
  max?: number;
  step?: number;
  display?: string;
  hint?: string;
}) {
  return (
    <label className="slider-field">
      <span>
        {label}
        <output>{display ?? `${Math.round(value * 100)}%`}</output>
      </span>
      <input
        aria-label={label}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      {hint && <small>{hint}</small>}
    </label>
  );
}
