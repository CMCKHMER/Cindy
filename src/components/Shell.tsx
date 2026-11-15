import React, { useEffect, useRef, useState } from "react";
import { useApp } from "../state/store";
import { Icon, Chip, Toggle } from "./ui";
import { PLATFORM_META, type Platform, fmtBytes } from "../lib/core";

const DISK_TOTAL_LABEL = "1 TB";

const NAV: { id: string; label: string; icon: string; group: string; badge?: keyof ReturnType<typeof badges> }[] = [
  { id: "dashboard", label: "Overview", icon: "dashboard", group: "Library" },
  { id: "scan", label: "Scan & Watch", icon: "scan", group: "Library" },
  { id: "live", label: "Live disk", icon: "folder", group: "Library" },
  { id: "explorer", label: "Explorer", icon: "files", group: "Library" },
  { id: "duplicates", label: "Duplicates", icon: "copy", group: "Review", badge: "duplicates" },
  { id: "broken", label: "Damaged files", icon: "broken", group: "Review", badge: "broken" },
  { id: "rename", label: "AI Renaming", icon: "wand", group: "Review", badge: "rename" },
  { id: "organize", label: "Cleanup plan", icon: "folder", group: "Review", badge: "folders" },
  { id: "analytics", label: "Storage", icon: "chart", group: "Insight" },
  { id: "history", label: "Undo & Reports", icon: "history", group: "Insight" },
  { id: "desktop", label: "Run on desktop", icon: "download", group: "System" },
  { id: "settings", label: "Settings", icon: "settings", group: "System" },
  { id: "system", label: "Developer", icon: "terminal", group: "System" },
];

function badges(p: { duplicates: number; broken: number; rename: number; organize: number; folders: number }) {
  return p;
}

const TITLES: Record<string, { title: string; sub: string }> = {
  dashboard: { title: "Library overview", sub: "Your digital librarian, on duty" },
  scan: { title: "Scan & real-time watch", sub: "Multi-threaded, resumable, incremental" },
  live: { title: "Live files on this computer", sub: "Connect scans and approved actions to the local filesystem" },
  explorer: { title: "File explorer", sub: "Search, filter and bulk-organise the index" },
  duplicates: { title: "Duplicate review", sub: "Exact · near · visual — nothing deleted without you" },
  broken: { title: "Damaged file review", sub: "Integrity checks with safe repair paths" },
  rename: { title: "AI rename studio", sub: "Descriptive, lowercase, collision-free names" },
  organize: { title: "Cleanup plan", sub: "Downloads triage and smart folder names" },
  analytics: { title: "Storage analytics", sub: "Where the gigabytes actually live" },
  history: { title: "Undo history & reports", sub: "Every action journaled and reversible" },
  desktop: { title: "Run Sasha Maid on your desktop", sub: "Windows, macOS and Linux — one command, then a real app" },
  settings: { title: "Settings", sub: "Safety, models, performance and rules" },
  system: { title: "Developer", sub: "Architecture, schema, API, packaging and tests" },
};

const SUGGESTIONS = [
  "Get Sasha working on my desktop",
  "Clean my Downloads folder",
  "Find duplicate photos",
  "Rename all screenshots",
  "Organize my music",
  "Show files larger than 1GB",
  "Find broken files",
  "Old files I haven't touched",
];

export function Mark({ size = 30 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none" aria-hidden="true">
      <defs>
        <linearGradient id="vg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="var(--teal)" />
          <stop offset="55%" stopColor="var(--blue)" />
          <stop offset="100%" stopColor="var(--magenta)" />
        </linearGradient>
      </defs>
      <rect x="2" y="2" width="36" height="36" rx="11" stroke="url(#vg)" strokeWidth="2" />
      <path d="M11 13h7l2.4 3H29v11a2 2 0 0 1-2 2H13a2 2 0 0 1-2-2z" fill="url(#vg)" opacity="0.22" />
      <path d="M11 13h7l2.4 3H29v11a2 2 0 0 1-2 2H13a2 2 0 0 1-2-2z" stroke="url(#vg)" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M16 22.5l2.6 2.6L25 18.7" stroke="var(--lime)" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function ScanButton({ compact = false }: { compact?: boolean }) {
  const { s, api } = useApp();
  const running = s.scan.running;
  return (
    <button
      className={`btn ${running ? "" : "btn-primary"} ${compact ? "btn-sm" : ""}`}
      onClick={() => (running ? api.pauseScan() : s.scan.resumable ? api.resumeScan() : api.startScan())}
      title={running ? "Pause scan (checkpoint is saved)" : s.scan.resumable ? "Resume interrupted scan" : "Scan enabled folders"}
    >
      <Icon name={running ? "pause" : "play"} size={14} />
      {running ? `Scanning ${Math.round((s.scan.done / Math.max(1, s.scan.total)) * 100)}%` : s.scan.resumable ? "Resume scan" : "Scan library"}
    </button>
  );
}

function CommandPalette() {
  const { s, api } = useApp();
  const [text, setText] = useState("");
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (s.commandOpen) setTimeout(() => ref.current?.focus(), 40);
    else setText("");
  }, [s.commandOpen]);
  if (!s.commandOpen) return null;
  return (
    <div className="fixed inset-0 z-[90] flex items-start justify-center pt-[12vh] px-4 fadein" style={{ background: "var(--scrim)", backdropFilter: "blur(7px)" }} onMouseDown={() => api.setCommandOpen(false)}>
      <div className="card pop w-full max-w-[640px] overflow-hidden" style={{ boxShadow: "var(--shadow-lg)" }} onMouseDown={(e) => e.stopPropagation()}>
        <form
          className="flex items-center gap-3 px-4 h-[58px]"
          style={{ borderBottom: "1px solid var(--line)" }}
          onSubmit={(e) => {
            e.preventDefault();
            if (text.trim()) api.runCommand(text.trim());
          }}
        >
          <span style={{ color: "var(--teal)" }}><Icon name="spark" size={18} /></span>
          <input ref={ref} value={text} onChange={(e) => setText(e.target.value)} placeholder="Tell your librarian what to do…"
            className="flex-1 bg-transparent outline-none text-[15px]" style={{ color: "var(--text)" }} />
          <span className="kbd">Enter</span>
        </form>
        <div className="p-3">
          <div className="label px-1 mb-2">Try a command</div>
          <div className="flex flex-wrap gap-1.5">
            {SUGGESTIONS.map((x) => (
              <button key={x} className="btn btn-xs" onClick={() => api.runCommand(x)}>
                <Icon name="arrow" size={11} />{x}
              </button>
            ))}
          </div>
          {s.lastCommand && (
            <div className="inset mt-3 p-3 text-[12px] flex items-start gap-2.5">
              <span style={{ color: "var(--teal)" }} className="mt-0.5"><Icon name="spark" size={14} /></span>
              <div>
                <div className="mono text-[10.5px]" style={{ color: "var(--faint)" }}>last intent · {s.lastCommand.intent}</div>
                <div className="mt-0.5" style={{ color: "var(--muted)" }}>{s.lastCommand.message}</div>
              </div>
            </div>
          )}
          <div className="flex items-center gap-3 px-1 pt-3 text-[11px]" style={{ color: "var(--faint)" }}>
            <span><span className="kbd">⌘K</span> palette</span>
            <span><span className="kbd">/</span> search files</span>
            <span><span className="kbd">⌘Z</span> undo last action</span>
            <span><span className="kbd">Esc</span> close</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function Toasts() {
  const { s, api } = useApp();
  const tone: Record<string, string> = { info: "var(--blue)", success: "var(--success)", warn: "var(--warning)", danger: "var(--danger)", ai: "var(--teal)" };
  return (
    <div className="fixed z-[95] bottom-4 right-4 flex flex-col gap-2 w-[min(94vw,380px)] pointer-events-none">
      {s.toasts.map((t) => (
        <div key={t.id} className="card card-hi slidein p-3 pointer-events-auto" style={{ boxShadow: "var(--shadow-lg)", borderLeft: `3px solid ${tone[t.tone]}` }}>
          <div className="flex items-start gap-2.5">
            <span style={{ color: tone[t.tone] }} className="mt-0.5">
              <Icon name={t.tone === "danger" ? "alert" : t.tone === "ai" ? "spark" : t.tone === "success" ? "check" : "info"} size={15} />
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-[13px] font-semibold leading-snug">{t.title}</div>
              {t.message && <div className="text-[11.5px] mt-0.5 break-words" style={{ color: "var(--muted)" }}>{t.message}</div>}
              <div className="flex gap-1.5 mt-2">
                {t.undoOp && (
                  <button className="btn btn-xs" onClick={() => { api.undo(t.undoOp!); api.dismissToast(t.id); }}>
                    <Icon name="undo" size={11} />Undo
                  </button>
                )}
                {t.action && (
                  <button className="btn btn-xs" onClick={() => { api.go(t.action!.view); api.dismissToast(t.id); }}>
                    {t.action.label}<Icon name="arrow" size={11} />
                  </button>
                )}
              </div>
            </div>
            <button className="btn btn-ghost btn-icon btn-xs" onClick={() => api.dismissToast(t.id)} aria-label="Dismiss"><Icon name="x" size={13} /></button>
          </div>
        </div>
      ))}
    </div>
  );
}

export function Shell({ children }: { children: React.ReactNode }) {
  const { s, d, api } = useApp();
  const [mobileNav, setMobileNav] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const meta = TITLES[s.view] ?? TITLES.dashboard;
  const usedPct = Math.min(99, (d.stats.totalBytes / (1024 ** 4)) * 100);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0, behavior: "smooth" });
    setMobileNav(false);
  }, [s.view]);

  const groups = Array.from(new Set(NAV.map((n) => n.group)));

  const rail = (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2.5 px-4 h-[68px] flex-none" style={{ borderBottom: "1px solid var(--line)" }}>
        <Mark />
        <div className="min-w-0">
          <div className="display text-[15.5px] font-bold tracking-[0.1em] leading-none whitespace-nowrap">
            SASHA<span style={{ color: "var(--teal)" }}> MAID</span>
          </div>
          <div className="text-[9.5px] mt-1 tracking-[0.1em] uppercase" style={{ color: "var(--faint)" }}>tidies your desktop</div>
        </div>
      </div>

      <nav className="scroll flex-1 overflow-y-auto px-3 py-3.5">
        {groups.map((g) => (
          <div key={g} className="mb-3.5">
            <div className="label px-2 mb-1.5">{g}</div>
            <div className="space-y-0.5">
              {NAV.filter((n) => n.group === g).map((n) => {
                const count = n.badge ? d.pending[n.badge] : 0;
                return (
                  <button key={n.id} className="navlink" data-active={s.view === n.id} onClick={() => api.go(n.id)}>
                    <Icon name={n.icon} size={16} />
                    <span className="flex-1 truncate">{n.label}</span>
                    {!!count && (
                      <span className="mono text-[10px] px-1.5 py-0.5 rounded-md" style={{ background: "color-mix(in srgb, var(--teal) 18%, transparent)", color: "var(--teal)" }}>
                        {count > 999 ? "999+" : count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="p-3 flex-none space-y-2.5" style={{ borderTop: "1px solid var(--line)" }}>
        <div className="inset p-2.5">
          <div className="flex items-center justify-between text-[11px] mb-1.5">
            <span style={{ color: "var(--muted)" }}>Local disk</span>
            <span className="mono" style={{ color: "var(--teal)" }}>{usedPct.toFixed(1)}%</span>
          </div>
          <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "color-mix(in srgb, var(--text) 10%, transparent)" }}>
            <div className="h-full rounded-full" style={{ width: `${usedPct}%`, background: "linear-gradient(90deg, var(--teal), var(--blue), var(--magenta))" }} />
          </div>
          <div className="mono text-[10px] mt-1.5" style={{ color: "var(--faint)" }}>{fmtBytes(d.stats.totalBytes)} of {DISK_TOTAL_LABEL}</div>
        </div>
        <div className="flex items-center gap-2 px-1">
          <span style={{ color: "var(--success)" }}><Icon name="shield" size={14} /></span>
          <span className="text-[10.5px] leading-tight" style={{ color: "var(--muted)" }}>Approval required for every destructive action</span>
        </div>
      </div>
    </div>
  );

  return (
    <div className="relative h-full flex" style={{ zIndex: 2 }}>
      <aside className="hidden lg:flex flex-col flex-none h-full" style={{ width: "var(--rail)", background: "color-mix(in srgb, var(--surface) 72%, transparent)", borderRight: "1px solid var(--line)", backdropFilter: "blur(14px)" }}>
        {rail}
      </aside>

      {mobileNav && (
        <div className="lg:hidden fixed inset-0 z-[70] fadein" style={{ background: "var(--scrim)" }} onClick={() => setMobileNav(false)}>
          <aside className="h-full w-[262px] slidein" style={{ background: "var(--surface)", borderRight: "1px solid var(--line)" }} onClick={(e) => e.stopPropagation()}>
            {rail}
          </aside>
        </div>
      )}

      <div className="flex-1 min-w-0 flex flex-col h-full">
        <header className="flex-none flex items-center gap-3 px-4 lg:px-6 h-[68px]" style={{ borderBottom: "1px solid var(--line)", background: "color-mix(in srgb, var(--bg) 78%, transparent)", backdropFilter: "blur(16px)" }}>
          <button className="btn btn-ghost btn-icon lg:hidden" onClick={() => setMobileNav(true)} aria-label="Open navigation"><Icon name="list" size={18} /></button>
          <div className="min-w-0 hidden sm:block">
            <h1 className="text-[15.5px] font-semibold leading-tight truncate">{meta.title}</h1>
            <p className="text-[11.5px] truncate" style={{ color: "var(--muted)" }}>{meta.sub}</p>
          </div>

          <button onClick={() => api.setCommandOpen(true)}
            className="flex-1 min-w-0 max-w-[440px] ml-auto flex items-center gap-2.5 h-9 px-3 rounded-[10px] text-left transition-colors"
            style={{ background: "color-mix(in srgb, var(--ink) 50%, transparent)", border: "1px solid var(--line)" }}>
            <span style={{ color: "var(--teal)" }}><Icon name="spark" size={15} /></span>
            <span className="flex-1 truncate text-[12.5px]" style={{ color: "var(--faint)" }}>Ask your librarian…</span>
            <span className="kbd hidden md:inline">⌘K</span>
          </button>

          <div className="flex items-center gap-1.5">
            <div className="hidden xl:flex items-center gap-2 h-9 px-2.5 rounded-[10px]" style={{ border: "1px solid var(--line)" }} title="Real-time folder monitoring (watchdog)">
              <span className={`dot ${s.settings.watch ? "pulse" : ""}`} style={{ background: s.settings.watch ? "var(--success)" : "var(--faint)", color: "var(--success)" }} />
              <span className="text-[11.5px]" style={{ color: "var(--muted)" }}>Watch</span>
              <Toggle on={s.settings.watch} onChange={(v) => api.setSetting("watch", v)} label="Real-time monitoring" />
            </div>
            <button className="btn btn-ghost btn-icon" onClick={() => api.setSetting("sound", !s.settings.sound)} title={s.settings.sound ? "Sound on — click to mute" : "Muted — click to enable"} aria-label="Toggle sound">
              <Icon name={s.settings.sound ? "sound" : "mute"} size={17} />
            </button>
            <button className="btn btn-ghost btn-icon" onClick={() => api.setSetting("theme", s.settings.theme === "dark" ? "light" : "dark")} title="Toggle theme" aria-label="Toggle theme">
              <Icon name={s.settings.theme === "dark" ? "sun" : "moon"} size={17} />
            </button>
            <ScanButton />
          </div>
        </header>

        {s.scan.running && (
          <div className="flex-none h-[3px] relative overflow-hidden" style={{ background: "color-mix(in srgb, var(--text) 8%, transparent)" }}>
            <div className="h-full transition-all duration-200" style={{ width: `${(s.scan.done / Math.max(1, s.scan.total)) * 100}%`, background: "linear-gradient(90deg, var(--teal), var(--lime))" }} />
          </div>
        )}

        <main ref={scrollRef} className="scroll flex-1 overflow-y-auto">
          <div className="px-4 lg:px-6 py-5 max-w-[1500px] mx-auto">{children}</div>
          <footer className="px-4 lg:px-6 pb-8 pt-2 max-w-[1500px] mx-auto">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[11px] pt-4" style={{ borderTop: "1px solid var(--line)", color: "var(--faint)" }}>
              <span className="mono">sasha 1.4.0</span>
              <span>{PLATFORM_META[s.settings.platform].label} · {s.settings.threads} threads · ONNX local runtime</span>
              <Chip color="var(--success)"><Icon name="shield" size={11} />no automatic deletion</Chip>
              <Chip color="var(--blue)">{s.settings.localOnly ? "100% offline inference" : "cloud fallback enabled"}</Chip>
              <span className="ml-auto">{d.stats.fileCount.toLocaleString()} files indexed · {s.logs.length} journal entries</span>
            </div>
          </footer>
        </main>
      </div>

      <CommandPalette />
      <Toasts />
    </div>
  );
}

export function PlatformSwitch() {
  const { s, api } = useApp();
  return (
    <div className="inline-flex gap-1">
      {(Object.keys(PLATFORM_META) as Platform[]).map((p) => (
        <button key={p} className="btn btn-xs" onClick={() => api.setSetting("platform", p)}
          style={s.settings.platform === p ? { borderColor: "var(--teal)", color: "var(--teal)", background: "color-mix(in srgb, var(--teal) 12%, transparent)" } : undefined}>
          {PLATFORM_META[p].label}
        </button>
      ))}
    </div>
  );
}