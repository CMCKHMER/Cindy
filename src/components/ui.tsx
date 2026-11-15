import React, { useEffect, useMemo, useRef, useState } from "react";
import { KIND_META, type FileRec, type Kind, fmtBytes } from "../lib/core";
import { thumbFor } from "../data/seed";

/* ------------------------------------------------------------------ icons */
const P: Record<string, React.ReactNode> = {
  dashboard: <><rect x="3" y="3" width="7" height="9" rx="1.5" /><rect x="14" y="3" width="7" height="5" rx="1.5" /><rect x="14" y="12" width="7" height="9" rx="1.5" /><rect x="3" y="16" width="7" height="5" rx="1.5" /></>,
  scan: <><path d="M3 8V5a2 2 0 0 1 2-2h3M16 3h3a2 2 0 0 1 2 2v3M21 16v3a2 2 0 0 1-2 2h-3M8 21H5a2 2 0 0 1-2-2v-3" /><path d="M3 12h18" /></>,
  copy: <><rect x="9" y="9" width="12" height="12" rx="2" /><path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1" /></>,
  broken: <><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" /><path d="M14 3v6h6" /><path d="M9 13l6 5M15 13l-6 5" /></>,
  wand: <><path d="M15 4V2M15 16v-2M8 9h2M20 9h2M17.8 11.8l1.4 1.4M17.8 6.2l1.4-1.4M12.2 6.2l-1.4-1.4" /><path d="M3 21l9-9" /></>,
  folder: <><path d="M3 7a2 2 0 0 1 2-2h4l2 2.5h8a2 2 0 0 1 2 2V18a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /></>,
  chart: <><path d="M3 3v18h18" /><rect x="7" y="11" width="3" height="6" rx="1" /><rect x="12" y="7" width="3" height="10" rx="1" /><rect x="17" y="13" width="3" height="4" rx="1" /></>,
  files: <><path d="M4 4h9l2 2.5h5V20H4z" /><path d="M8 12h8M8 16h5" /></>,
  history: <><path d="M3 12a9 9 0 1 0 3-6.7L3 8" /><path d="M3 3v5h5" /><path d="M12 7v5l3 2" /></>,
  settings: <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-2.7 1.1V21a2 2 0 1 1-4 0v-.1A1.6 1.6 0 0 0 7.5 19.4l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.6 1.6 0 0 0 3 14.9H3a2 2 0 1 1 0-4h.1A1.6 1.6 0 0 0 4.6 8.5l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1A1.6 1.6 0 0 0 10 4.6V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 2.7 1.1l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0 1.1 2.7H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1.3z" /></>,
  terminal: <><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M7 9l3 3-3 3M13 15h4" /></>,
  search: <><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></>,
  play: <><path d="M6 4l14 8-14 8z" /></>,
  pause: <><rect x="6" y="4" width="4" height="16" rx="1" /><rect x="14" y="4" width="4" height="16" rx="1" /></>,
  stop: <><rect x="5" y="5" width="14" height="14" rx="2" /></>,
  check: <><path d="M4 12.5l5 5L20 6.5" /></>,
  x: <><path d="M6 6l12 12M18 6L6 18" /></>,
  trash: <><path d="M4 7h16M10 4h4M6 7l1 13h10l1-13" /><path d="M10 11v6M14 11v6" /></>,
  archive: <><rect x="3" y="4" width="18" height="4" rx="1" /><path d="M5 8v11a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8" /><path d="M10 12h4" /></>,
  wrench: <><path d="M14.7 6.3a4 4 0 0 0 5 5l-9.4 9.4a2.1 2.1 0 0 1-3-3z" /><path d="M14.7 6.3L18 3l3 3-3.3 3.3" /></>,
  undo: <><path d="M9 14L4 9l5-5" /><path d="M4 9h10a6 6 0 0 1 0 12h-3" /></>,
  redo: <><path d="M15 14l5-5-5-5" /><path d="M20 9H10a6 6 0 0 0 0 12h3" /></>,
  shield: <><path d="M12 3l8 3v6c0 5-3.4 8.3-8 9-4.6-.7-8-4-8-9V6z" /><path d="M9 12l2 2 4-4" /></>,
  sun: <><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M19.1 4.9l-1.4 1.4M6.3 17.7l-1.4 1.4" /></>,
  moon: <><path d="M21 13A9 9 0 0 1 11 3a7 7 0 1 0 10 10z" /></>,
  sound: <><path d="M4 9v6h4l5 4V5L8 9z" /><path d="M17 8.5a5 5 0 0 1 0 7M20 6a9 9 0 0 1 0 12" /></>,
  mute: <><path d="M4 9v6h4l5 4V5L8 9z" /><path d="M17 9l5 6M22 9l-5 6" /></>,
  plus: <><path d="M12 5v14M5 12h14" /></>,
  minus: <><path d="M5 12h14" /></>,
  eye: <><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7z" /><circle cx="12" cy="12" r="3" /></>,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  download: <><path d="M12 3v12M7 11l5 5 5-5" /><path d="M4 21h16" /></>,
  upload: <><path d="M12 21V9M7 13l5-5 5 5" /><path d="M4 3h16" /></>,
  cpu: <><rect x="6" y="6" width="12" height="12" rx="2" /><path d="M9 2v4M15 2v4M9 18v4M15 18v4M2 9h4M2 15h4M18 9h4M18 15h4" /></>,
  spark: <><path d="M12 3l1.9 5.6L20 10l-5.1 2.4L12 18l-2.9-5.6L4 10l6.1-1.4z" /></>,
  link: <><path d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1" /><path d="M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1" /></>,
  grid: <><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></>,
  list: <><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" /></>,
  filter: <><path d="M3 5h18l-7 8v6l-4 2v-8z" /></>,
  drag: <><circle cx="9" cy="6" r="1.4" /><circle cx="15" cy="6" r="1.4" /><circle cx="9" cy="12" r="1.4" /><circle cx="15" cy="12" r="1.4" /><circle cx="9" cy="18" r="1.4" /><circle cx="15" cy="18" r="1.4" /></>,
  alert: <><path d="M12 3l10 18H2z" /><path d="M12 9v5M12 18h.01" /></>,
  info: <><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 8h.01" /></>,
  bolt: <><path d="M13 2L4 14h7l-1 8 9-12h-7z" /></>,
  image: <><rect x="3" y="4" width="18" height="16" rx="2" /><circle cx="8.5" cy="9.5" r="1.8" /><path d="M21 16l-5-5-9 9" /></>,
  save: <><path d="M5 3h11l3 3v15H5z" /><path d="M8 3v6h8V3M8 21v-7h8v7" /></>,
  book: <><path d="M4 4h9a3 3 0 0 1 3 3v13a3 3 0 0 0-3-3H4z" /><path d="M20 4h-4v13h4z" /></>,
  arrow: <><path d="M5 12h14M13 6l6 6-6 6" /></>,
  star: <><path d="M12 3l2.6 5.6 6.4.8-4.7 4.3 1.3 6.3L12 17l-5.6 3 1.3-6.3L3 9.4l6.4-.8z" /></>,
};

export function Icon({ name, size = 16, className = "", strokeWidth = 1.7 }: { name: keyof typeof P | string; size?: number; className?: string; strokeWidth?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      {P[name] ?? P.info}
    </svg>
  );
}

/* ------------------------------------------------------------------ atoms */
export function Chip({ children, color = "var(--slate)", solid = false, title }: { children: React.ReactNode; color?: string; solid?: boolean; title?: string }) {
  return (
    <span className={`chip ${solid ? "chip-solid" : ""}`} style={{ ["--c" as string]: color }} title={title}>
      {children}
    </span>
  );
}

export function KindDot({ kind, size = 8 }: { kind: Kind; size?: number }) {
  return <span className="dot" style={{ background: KIND_META[kind].color, width: size, height: size }} />;
}

export function Section({ title, sub, right, children, className = "" }: { title: string; sub?: string; right?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={`card card-pad ${className}`}>
      <header className="flex items-start justify-between gap-3 mb-3.5">
        <div className="min-w-0">
          <h3 className="text-[15px] font-semibold">{title}</h3>
          {sub && <p className="text-[12px] mt-0.5" style={{ color: "var(--muted)" }}>{sub}</p>}
        </div>
        {right}
      </header>
      {children}
    </section>
  );
}

export function useCountUp(value: number, ms = 700) {
  const [v, setV] = useState(value);
  const prev = useRef(value);
  useEffect(() => {
    const from = prev.current;
    const to = value;
    prev.current = value;
    if (from === to) return;
    let raf = 0;
    const t0 = performance.now();
    const step = (t: number) => {
      const k = Math.min(1, (t - t0) / ms);
      const e = 1 - Math.pow(1 - k, 3);
      setV(from + (to - from) * e);
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value, ms]);
  return v;
}

export function Metric({ label, value, unit, sub, color = "var(--teal)", icon, spark }: { label: string; value: number; unit?: string; sub?: string; color?: string; icon?: string; spark?: number[] }) {
  const v = useCountUp(value);
  const display = unit === "bytes" ? fmtBytes(v) : v >= 1000 ? Math.round(v).toLocaleString() : v.toFixed(v % 1 === 0 ? 0 : 1);
  return (
    <div className="card card-pad card-hi overflow-hidden">
      <div className="flex items-center justify-between gap-2">
        <span className="label">{label}</span>
        {icon && <span style={{ color }}><Icon name={icon} size={15} /></span>}
      </div>
      <div className="display text-[27px] font-bold mt-2 leading-none" style={{ color }}>
        {display}
        {unit && unit !== "bytes" && <span className="text-[13px] font-medium ml-1" style={{ color: "var(--muted)" }}>{unit}</span>}
      </div>
      {sub && <div className="text-[11.5px] mt-1.5" style={{ color: "var(--muted)" }}>{sub}</div>}
      {spark && <Spark data={spark} color={color} />}
    </div>
  );
}

export function Spark({ data, color = "var(--teal)", h = 26 }: { data: number[]; color?: string; h?: number }) {
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const pts = data.map((d, i) => `${(i / Math.max(1, data.length - 1)) * 100},${h - ((d - min) / Math.max(1, max - min)) * (h - 4) - 2}`).join(" ");
  return (
    <svg viewBox={`0 0 100 ${h}`} preserveAspectRatio="none" className="w-full mt-2.5" style={{ height: h }}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.6" vectorEffect="non-scaling-stroke" />
      <polyline points={`0,${h} ${pts} 100,${h}`} fill={color} opacity="0.12" stroke="none" />
    </svg>
  );
}

export function Ring({ value, size = 132, stroke = 11, label, sub, color = "var(--teal)" }: { value: number; size?: number; stroke?: number; label?: string; sub?: string; color?: string }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const v = useCountUp(value);
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="color-mix(in srgb, var(--text) 10%, transparent)" strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c - (c * Math.min(100, Math.max(0, v))) / 100} style={{ filter: `drop-shadow(0 0 6px color-mix(in srgb, ${color} 60%, transparent))` }} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="display text-[24px] font-bold leading-none">{label ?? `${Math.round(v)}%`}</span>
        {sub && <span className="text-[10.5px] mt-1 text-center px-3" style={{ color: "var(--muted)" }}>{sub}</span>}
      </div>
    </div>
  );
}

export function Donut({ data, size = 190 }: { data: { label: string; value: number; color: string }[]; size?: number }) {
  const total = data.reduce((a, b) => a + b.value, 0) || 1;
  const [hover, setHover] = useState<number | null>(null);
  const r = size / 2 - 14;
  const cx = size / 2;
  let angle = -Math.PI / 2;
  const arcs = data.map((d, i) => {
    const a0 = angle;
    const a1 = angle + (d.value / total) * Math.PI * 2;
    angle = a1;
    const large = a1 - a0 > Math.PI ? 1 : 0;
    const p = (a: number, rr: number) => `${cx + Math.cos(a) * rr},${cx + Math.sin(a) * rr}`;
    const grow = hover === i ? 5 : 0;
    return { d: `M ${p(a0, r + grow)} A ${r + grow} ${r + grow} 0 ${large} 1 ${p(a1 - 0.012, r + grow)}`, color: d.color, i, item: d };
  });
  const active = hover !== null ? data[hover] : null;
  return (
    <div className="flex items-center gap-5 flex-wrap">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size}>
          {arcs.map((a) => (
            <path key={a.i} d={a.d} stroke={a.color} strokeWidth={hover === a.i ? 22 : 17} fill="none" strokeLinecap="butt"
              onMouseEnter={() => setHover(a.i)} onMouseLeave={() => setHover(null)}
              style={{ cursor: "pointer", transition: "stroke-width .18s ease", opacity: hover === null || hover === a.i ? 1 : 0.42 }} />
          ))}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="display text-[19px] font-bold">{active ? fmtBytes(active.value) : fmtBytes(total)}</span>
          <span className="text-[10.5px] mt-0.5 text-center max-w-[92px]" style={{ color: "var(--muted)" }}>{active ? active.label : "total indexed"}</span>
        </div>
      </div>
      <ul className="flex-1 min-w-[150px] space-y-1.5">
        {data.map((dd, i) => (
          <li key={dd.label} className="flex items-center gap-2 text-[12px] cursor-default" onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}
            style={{ opacity: hover === null || hover === i ? 1 : 0.5 }}>
            <span className="dot" style={{ background: dd.color }} />
            <span className="flex-1 truncate">{dd.label}</span>
            <span className="mono text-[11px]" style={{ color: "var(--muted)" }}>{((dd.value / total) * 100).toFixed(1)}%</span>
            <span className="mono text-[11px] w-[62px] text-right">{fmtBytes(dd.value)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function BarRow({ label, value, max, color, right, onClick }: { label: string; value: number; max: number; color: string; right?: string; onClick?: () => void }) {
  const pct = Math.max(1.5, (value / Math.max(1, max)) * 100);
  return (
    <button className="w-full text-left group" onClick={onClick} disabled={!onClick}>
      <div className="flex items-center justify-between text-[12px] mb-1">
        <span className="truncate group-hover:text-white transition-colors">{label}</span>
        <span className="mono text-[11px]" style={{ color: "var(--muted)" }}>{right ?? fmtBytes(value)}</span>
      </div>
      <div className="h-2 rounded-full overflow-hidden" style={{ background: "color-mix(in srgb, var(--text) 8%, transparent)" }}>
        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${color}, color-mix(in srgb, ${color} 45%, var(--blue)))` }} />
      </div>
    </button>
  );
}

export function AreaChart({ data, height = 150 }: { data: { month: string; gb: number; reclaimed: number }[]; height?: number }) {
  const w = 560;
  const max = Math.max(...data.map((d) => d.gb)) * 1.12;
  const x = (i: number) => (i / (data.length - 1)) * (w - 30) + 24;
  const y = (v: number) => height - 22 - (v / max) * (height - 40);
  const line = data.map((d, i) => `${x(i)},${y(d.gb)}`).join(" ");
  const [hi, setHi] = useState<number | null>(null);
  return (
    <svg viewBox={`0 0 ${w} ${height}`} className="w-full" style={{ height }} onMouseLeave={() => setHi(null)}>
      <defs>
        <linearGradient id="areaFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--teal)" stopOpacity="0.42" />
          <stop offset="100%" stopColor="var(--blue)" stopOpacity="0.02" />
        </linearGradient>
      </defs>
      {[0.25, 0.5, 0.75, 1].map((g) => (
        <line key={g} x1="24" x2={w - 6} y1={y(max * g)} y2={y(max * g)} stroke="var(--line)" strokeDasharray="3 4" />
      ))}
      <polygon points={`${x(0)},${height - 22} ${line} ${x(data.length - 1)},${height - 22}`} fill="url(#areaFill)" />
      <polyline points={line} fill="none" stroke="var(--teal)" strokeWidth="2" />
      {data.map((d, i) => (
        <g key={d.month} onMouseEnter={() => setHi(i)}>
          <rect x={x(i) - 18} y="0" width="36" height={height} fill="transparent" />
          <circle cx={x(i)} cy={y(d.gb)} r={hi === i ? 4.5 : 2.6} fill={hi === i ? "var(--lime)" : "var(--teal)"} />
          {d.reclaimed > 0 && <rect x={x(i) - 3} y={height - 20} width="6" height={Math.min(16, d.reclaimed)} rx="2" fill="var(--magenta)" opacity="0.75" />}
          <text x={x(i)} y={height - 5} textAnchor="middle" fontSize="9" fill="var(--faint)" fontFamily="var(--font-mono)">{d.month}</text>
          {hi === i && (
            <g>
              <rect x={Math.min(w - 108, Math.max(0, x(i) - 52))} y={Math.max(2, y(d.gb) - 40)} width="104" height="32" rx="6" fill="var(--overlay)" stroke="var(--line-strong)" />
              <text x={Math.min(w - 56, Math.max(52, x(i)))} y={Math.max(2, y(d.gb) - 26)} textAnchor="middle" fontSize="10" fill="var(--text)" fontFamily="var(--font-mono)">{d.gb} GB used</text>
              <text x={Math.min(w - 56, Math.max(52, x(i)))} y={Math.max(2, y(d.gb) - 14)} textAnchor="middle" fontSize="9" fill="var(--magenta)" fontFamily="var(--font-mono)">−{d.reclaimed} GB reclaimed</text>
            </g>
          )}
        </g>
      ))}
    </svg>
  );
}

export function Toggle({ on, onChange, disabled, label }: { on: boolean; onChange: (v: boolean) => void; disabled?: boolean; label?: string }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} className="switch" data-on={on} disabled={disabled} onClick={() => onChange(!on)} />
  );
}

export function Slider({ value, min, max, step = 1, onChange, label, suffix }: { value: number; min: number; max: number; step?: number; onChange: (v: number) => void; label?: string; suffix?: string }) {
  const fill = ((value - min) / (max - min)) * 100;
  return (
    <label className="block">
      {label && (
        <span className="flex items-center justify-between text-[12px] mb-1">
          <span style={{ color: "var(--muted)" }}>{label}</span>
          <span className="mono text-[11.5px]" style={{ color: "var(--teal)" }}>{value}{suffix}</span>
        </span>
      )}
      <input type="range" min={min} max={max} step={step} value={value} style={{ ["--fill" as string]: `${fill}%` }} onChange={(e) => onChange(Number(e.target.value))} />
    </label>
  );
}

export function Segmented<T extends string>({ value, options, onChange, size = "md" }: { value: T; options: { value: T; label: string; icon?: string }[]; onChange: (v: T) => void; size?: "sm" | "md" }) {
  return (
    <div className="inline-flex p-0.5 rounded-[10px] gap-0.5" style={{ background: "color-mix(in srgb, var(--ink) 55%, transparent)", border: "1px solid var(--line)" }}>
      {options.map((o) => (
        <button key={o.value} onClick={() => onChange(o.value)}
          className={`inline-flex items-center gap-1.5 rounded-lg font-medium transition-all ${size === "sm" ? "px-2 h-[26px] text-[11.5px]" : "px-3 h-[30px] text-[12.5px]"}`}
          style={value === o.value
            ? { background: "linear-gradient(135deg, color-mix(in srgb, var(--teal) 28%, transparent), color-mix(in srgb, var(--blue) 22%, transparent))", color: "var(--text)", boxShadow: "inset 0 0 0 1px color-mix(in srgb, var(--teal) 35%, transparent)" }
            : { color: "var(--muted)" }}>
          {o.icon && <Icon name={o.icon} size={13} />}
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Modal({ open, onClose, title, sub, children, footer, width = 620, tone = "var(--teal)" }: { open: boolean; onClose: () => void; title: string; sub?: string; children: React.ReactNode; footer?: React.ReactNode; width?: number; tone?: string }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 fadein" style={{ background: "var(--scrim)", backdropFilter: "blur(6px)" }} onMouseDown={onClose}>
      <div className="card pop w-full max-h-[88vh] flex flex-col" style={{ maxWidth: width, boxShadow: "var(--shadow-lg)" }} onMouseDown={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={title}>
        <div className="flex items-start gap-3 p-5 pb-3.5">
          <span className="w-8 h-8 rounded-[10px] grid place-items-center flex-none" style={{ background: `color-mix(in srgb, ${tone} 18%, transparent)`, color: tone }}>
            <Icon name="shield" size={17} />
          </span>
          <div className="min-w-0 flex-1">
            <h3 className="text-[16px] font-semibold leading-snug">{title}</h3>
            {sub && <p className="text-[12.5px] mt-1" style={{ color: "var(--muted)" }}>{sub}</p>}
          </div>
          <button className="btn btn-ghost btn-icon btn-sm" onClick={onClose} aria-label="Close dialog"><Icon name="x" size={15} /></button>
        </div>
        <div className="scroll overflow-y-auto px-5 pb-2 flex-1">{children}</div>
        {footer && <div className="p-4 mt-2 flex flex-wrap items-center justify-end gap-2 divide-line">{footer}</div>}
      </div>
    </div>
  );
}

export function Empty({ icon = "check", title, sub, action }: { icon?: string; title: string; sub?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-14 px-6">
      <span className="w-14 h-14 rounded-2xl grid place-items-center mb-3.5" style={{ background: "color-mix(in srgb, var(--teal) 12%, transparent)", color: "var(--teal)", border: "1px solid color-mix(in srgb, var(--teal) 25%, transparent)" }}>
        <Icon name={icon} size={24} />
      </span>
      <h4 className="text-[15px] font-semibold">{title}</h4>
      {sub && <p className="text-[12.5px] mt-1.5 max-w-[380px]" style={{ color: "var(--muted)" }}>{sub}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Thumb({ file, size = 44, radius = 8, className = "" }: { file: FileRec; size?: number; radius?: number; className?: string }) {
  const [err, setErr] = useState(false);
  const src = err ? thumbFor({ ...file, photo: undefined }) : thumbFor(file);
  return (
    <div className={`relative overflow-hidden flex-none ${className}`} style={{ width: size, height: size, borderRadius: radius, background: "var(--surface-2)", border: "1px solid var(--line)" }}>
      <img src={src} alt="" loading="lazy" onError={() => setErr(true)} className="w-full h-full object-cover" style={{ display: "block" }} />
      {file.status === "deleted" && <div className="absolute inset-0 grid place-items-center" style={{ background: "color-mix(in srgb, var(--danger) 55%, transparent)" }}><Icon name="trash" size={size / 3} /></div>}
    </div>
  );
}

export function StatusChip({ file }: { file: FileRec }) {
  const map: Record<string, { c: string; t: string }> = {
    indexed: { c: "var(--slate)", t: "Indexed" },
    moved: { c: "var(--teal)", t: "Moved" },
    renamed: { c: "var(--blue)", t: "Renamed" },
    deleted: { c: "var(--danger)", t: "Deleted" },
    archived: { c: "var(--amber)", t: "Archived" },
    review: { c: "var(--amber)", t: "In review" },
    repaired: { c: "var(--success)", t: "Repaired" },
    ignored: { c: "var(--faint)", t: "Ignored" },
  };
  const m = map[file.status] ?? map.indexed;
  return <Chip color={m.c}>{m.t}</Chip>;
}

export function VirtualList<T>({ items, rowHeight, height, render, overscan = 8, className = "" }: { items: T[]; rowHeight: number; height: number; render: (item: T, index: number) => React.ReactNode; overscan?: number; className?: string }) {
  const [top, setTop] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (ref.current && ref.current.scrollTop > items.length * rowHeight) {
      ref.current.scrollTop = 0;
      setTop(0);
    }
  }, [items.length, rowHeight]);
  const start = Math.max(0, Math.floor(top / rowHeight) - overscan);
  const end = Math.min(items.length, Math.ceil((top + height) / rowHeight) + overscan);
  const slice = items.slice(start, end);
  return (
    <div ref={ref} className={`scroll overflow-y-auto ${className}`} style={{ height }} onScroll={(e) => setTop((e.target as HTMLDivElement).scrollTop)}>
      <div style={{ height: items.length * rowHeight, position: "relative" }}>
        <div style={{ transform: `translateY(${start * rowHeight}px)` }}>
          {slice.map((item, i) => (
            <div key={start + i} style={{ height: rowHeight }}>{render(item, start + i)}</div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function Reveal({ children, delay = 0, className = "" }: { children: React.ReactNode; delay?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          el.classList.add("in");
          io.disconnect();
        }
      },
      { threshold: 0.08 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <div ref={ref} className={`reveal ${className}`} style={{ transitionDelay: `${delay}ms` }}>
      {children}
    </div>
  );
}

export function CopyBtn({ text, label = "Copy" }: { text: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button className="btn btn-xs" onClick={async () => {
      try {
        await navigator.clipboard.writeText(text);
      } catch {
        const ta = document.createElement("textarea");
        ta.value = text;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        ta.remove();
      }
      setDone(true);
      setTimeout(() => setDone(false), 1400);
    }}>
      <Icon name={done ? "check" : "copy"} size={12} />
      {done ? "Copied" : label}
    </button>
  );
}

export function Code({ children, lang }: { children: string; lang?: string }) {
  return (
    <div className="inset relative overflow-hidden">
      <div className="flex items-center justify-between px-3 py-1.5" style={{ borderBottom: "1px solid var(--line)" }}>
        <span className="label">{lang ?? "code"}</span>
        <CopyBtn text={children} />
      </div>
      <pre className="scroll overflow-auto p-3 text-[11.5px] leading-[1.65] mono" style={{ maxHeight: 420, color: "var(--muted)" }}>{children}</pre>
    </div>
  );
}

export function useFilteredFiles(files: FileRec[], filters: { query: string; kind: string; minSize: number; olderThanDays: number; status: string; subject: string; root: string }, sort: string) {
  return useMemo(() => {
    const q = filters.query.trim().toLowerCase();
    const now = Date.now();
    let out = files.filter((f) => {
      if (filters.kind !== "all" && f.kind !== filters.kind) return false;
      if (filters.root !== "all" && f.rootId !== filters.root) return false;
      if (filters.minSize && f.size < filters.minSize) return false;
      if (filters.olderThanDays && now - f.modified < filters.olderThanDays * 86400000) return false;
      if (filters.status !== "all" && f.status !== filters.status) return false;
      if (filters.subject && !(f.suggestion?.subject ?? "").toLowerCase().includes(filters.subject.toLowerCase()) && !f.tags.includes(filters.subject.toLowerCase())) return false;
      if (q && !(f.name.toLowerCase().includes(q) || f.dir.toLowerCase().includes(q) || f.tags.some((t) => t.includes(q)) || f.hash.startsWith(q))) return false;
      return true;
    });
    const [key, dir] = sort.split("-");
    const mul = dir === "asc" ? 1 : -1;
    out = [...out].sort((a, b) => {
      if (key === "name") return mul * a.name.localeCompare(b.name);
      if (key === "size") return mul * (a.size - b.size);
      if (key === "kind") return mul * a.kind.localeCompare(b.kind);
      if (key === "dir") return mul * a.dir.localeCompare(b.dir);
      return mul * (a.modified - b.modified);
    });
    return out;
  }, [files, filters, sort]);
}