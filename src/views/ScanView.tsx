import { useRef, useState } from "react";
import { useApp } from "../state/store";
import { Chip, Icon, Ring, Section, Toggle, Empty } from "../components/ui";
import { PlatformSwitch } from "../components/Shell";
import { PROTECTED_PATHS, fmtBytes, fmtNum, relTime, renderPath, shortPath } from "../lib/core";

export default function ScanView() {
  const { s, d, api } = useApp();
  const [newDir, setNewDir] = useState("");
  const [drag, setDrag] = useState(false);
  const [busy, setBusy] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const dirInput = useRef<HTMLInputElement>(null);

  const pct = s.scan.total ? (s.scan.done / s.scan.total) * 100 : 0;
  const elapsed = s.scan.running ? (performance.now() - s.scan.startedAt) / 1000 : 0;
  const eta = s.scan.rate > 0 ? (s.scan.total - s.scan.done) / s.scan.rate : 0;
  const watchLogs = s.logs.filter((l) => l.source === "watchdog" || l.source === "ingest" || l.source === "scanner").slice(0, 40);

  const ingest = async (list: FileList | File[]) => {
    setBusy(true);
    await api.importFiles(list);
    setBusy(false);
  };

  return (
    <div className="space-y-4">
      {s.scan.resumable && !s.scan.running && (
        <div className="card p-3.5 flex flex-wrap items-center gap-3 rise" style={{ borderColor: "color-mix(in srgb, var(--amber) 45%, transparent)", background: "color-mix(in srgb, var(--amber) 9%, var(--surface))" }}>
          <span style={{ color: "var(--amber)" }}><Icon name="clock" size={18} /></span>
          <div className="flex-1 min-w-[200px]">
            <div className="text-[13px] font-semibold">Interrupted scan checkpoint found</div>
            <div className="text-[11.5px]" style={{ color: "var(--muted)" }}>
              {fmtNum(s.scan.done)} of {fmtNum(s.scan.total)} files indexed — the SQLite cursor is durable, resume skips finished work.
            </div>
          </div>
          <button className="btn btn-primary btn-sm" onClick={api.resumeScan}><Icon name="play" size={13} />Resume scan</button>
          <button className="btn btn-sm" onClick={api.stopScan}>Discard</button>
        </div>
      )}

      <div className="grid xl:grid-cols-[1.05fr_1fr] gap-4">
        <Section title="Scan progress" sub={`${s.settings.threads} worker threads · ${s.settings.hashChunkKb} KB hash chunks · ${s.settings.memoryMb} MB budget`}
          right={<Chip color={s.scan.running ? "var(--teal)" : s.scan.phase === "complete" ? "var(--success)" : "var(--slate)"}>{s.scan.running ? "running" : s.scan.phase}</Chip>}>
          <div className="flex flex-wrap items-center gap-5">
            <Ring value={pct} size={148} sub={s.scan.running ? s.scan.phase : s.scan.phase === "complete" ? "index up to date" : "idle"} color={s.scan.running ? "var(--teal)" : "var(--blue)"} />
            <div className="flex-1 min-w-[220px] space-y-2.5">
              <div className="grid grid-cols-2 gap-2">
                {[
                  ["Files walked", `${fmtNum(s.scan.done)} / ${fmtNum(s.scan.total || d.stats.fileCount)}`],
                  ["Throughput", `${fmtNum(s.scan.rate || 0)} files/s`],
                  ["Elapsed", `${elapsed.toFixed(1)}s`],
                  ["ETA", s.scan.running ? `${Math.max(0, eta).toFixed(1)}s` : "—"],
                ].map(([k, v]) => (
                  <div key={k} className="inset p-2.5">
                    <div className="label">{k}</div>
                    <div className="mono text-[13px] mt-1" style={{ color: "var(--teal)" }}>{v}</div>
                  </div>
                ))}
              </div>
              <div className="inset p-2.5">
                <div className="label mb-1">Current path</div>
                <div className="mono text-[11px] truncate" style={{ color: "var(--muted)" }}>{s.scan.current || renderPath("Downloads", s.settings.platform, "…")}</div>
              </div>
              <div className="flex flex-wrap gap-2">
                {s.scan.running ? (
                  <>
                    <button className="btn btn-sm" onClick={api.pauseScan}><Icon name="pause" size={13} />Pause & checkpoint</button>
                    <button className="btn btn-sm btn-danger" onClick={api.stopScan}><Icon name="stop" size={13} />Cancel</button>
                  </>
                ) : (
                  <>
                    <button className="btn btn-sm btn-primary" onClick={() => (s.scan.resumable ? api.resumeScan() : api.startScan())}><Icon name="play" size={13} />{s.scan.resumable ? "Resume" : "Start scan"}</button>
                    <button className="btn btn-sm" onClick={api.redetect}><Icon name="spark" size={13} />Re-run similarity</button>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3.5" style={{ borderTop: "1px solid var(--line)" }}>
            <div className="label mb-2">Worker lanes</div>
            <div className="space-y-1.5">
              {Array.from({ length: s.settings.threads }).map((_, i) => {
                const active = s.scan.running;
                const w = active ? 35 + ((s.scan.done * (i + 3)) % 65) : 4;
                return (
                  <div key={i} className="flex items-center gap-2">
                    <span className="mono text-[10px] w-14 flex-none" style={{ color: "var(--faint)" }}>worker-{i}</span>
                    <div className={`h-1.5 flex-1 rounded-full overflow-hidden ${active ? "shimmer" : ""}`} style={{ background: "color-mix(in srgb, var(--text) 8%, transparent)" }}>
                      <div className="h-full rounded-full transition-all duration-200" style={{ width: `${w}%`, background: `linear-gradient(90deg, var(--teal), ${["var(--blue)", "var(--magenta)", "var(--lime)", "var(--amber)", "var(--violet)", "var(--cyan)"][i % 6]})` }} />
                    </div>
                    <span className="mono text-[10px] w-16 text-right flex-none" style={{ color: "var(--muted)" }}>{active ? `${fmtNum(s.scan.rate / s.settings.threads)}/s` : "idle"}</span>
                  </div>
                );
              })}
            </div>
            <div className="grid grid-cols-3 gap-2 mt-3">
              {[["Duplicate groups", s.scan.found.dups, "var(--magenta)"], ["Damaged files", s.scan.found.broken, "var(--danger)"], ["Rename ideas", s.scan.found.renames, "var(--blue)"]].map(([k, v, c]) => (
                <div key={String(k)} className="inset p-2.5 text-center">
                  <div className="display text-[19px] font-bold" style={{ color: String(c) }}>{String(v)}</div>
                  <div className="text-[10.5px] mt-0.5" style={{ color: "var(--muted)" }}>{String(k)}</div>
                </div>
              ))}
            </div>
          </div>
        </Section>

        <div className="space-y-4">
          <Section title="Add files" sub="Drop real files — SHA-256 is computed locally with WebCrypto" right={<Chip color="var(--teal)"><Icon name="shield" size={11} />never uploaded</Chip>}>
            <div
              className={`rounded-[12px] p-6 text-center transition-colors ${drag ? "dragover" : ""}`}
              style={{ border: "1.5px dashed var(--line-strong)", background: "color-mix(in srgb, var(--ink) 35%, transparent)" }}
              onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
              onDragLeave={() => setDrag(false)}
              onDrop={(e) => { e.preventDefault(); setDrag(false); if (e.dataTransfer.files?.length) void ingest(e.dataTransfer.files); }}
            >
              <span className="inline-grid place-items-center w-12 h-12 rounded-2xl mb-3" style={{ background: "color-mix(in srgb, var(--teal) 14%, transparent)", color: "var(--teal)" }}>
                <Icon name={busy ? "cpu" : "upload"} size={22} className={busy ? "spin" : ""} />
              </span>
              <div className="text-[13px] font-semibold">{busy ? "Hashing & classifying…" : "Drag files or folders here"}</div>
              <p className="text-[11.5px] mt-1 max-w-[380px] mx-auto" style={{ color: "var(--muted)" }}>
                Dropped files are hashed, classified by content and added to the index. Exact duplicates are detected instantly against the existing library.
              </p>
              <div className="flex flex-wrap justify-center gap-2 mt-3.5">
                <button className="btn btn-sm" onClick={() => fileInput.current?.click()}><Icon name="files" size={13} />Choose files</button>
                <button className="btn btn-sm" onClick={() => dirInput.current?.click()}><Icon name="folder" size={13} />Choose folder</button>
              </div>
              <input ref={fileInput} type="file" multiple hidden onChange={(e) => e.target.files && void ingest(e.target.files)} />
              <input ref={dirInput} type="file" multiple hidden {...{ webkitdirectory: "", directory: "" }} onChange={(e) => e.target.files && void ingest(e.target.files)} />
            </div>
            {s.imported.length > 0 && (
              <div className="mt-3 inset p-2.5 flex items-center gap-2.5">
                <Icon name="check" size={14} />
                <span className="text-[12px] flex-1">{s.imported.length} files ingested this session · {fmtBytes(s.imported.reduce((a, b) => a + b.size, 0))}</span>
                <button className="btn btn-xs" onClick={() => { api.setFilters({ query: "" }); api.go("explorer"); }}>View<Icon name="arrow" size={11} /></button>
              </div>
            )}
          </Section>

          <Section title="Real-time monitoring" sub="watchdog · inotify / FSEvents / ReadDirectoryChangesW"
            right={<Toggle on={s.settings.watch} onChange={(v) => api.setSetting("watch", v)} label="Monitoring" />}>
            <div className="flex items-center gap-2.5 inset p-2.5 mb-3">
              <span className={`dot ${s.settings.watch ? "pulse" : ""}`} style={{ background: s.settings.watch ? "var(--success)" : "var(--faint)", color: "var(--success)" }} />
              <span className="text-[12px] flex-1" style={{ color: "var(--muted)" }}>
                {s.settings.watch ? `Watching ${s.roots.filter((r) => r.watch && r.enabled).length} roots — new files are classified on arrival` : "Monitoring paused — nothing is being watched"}
              </span>
            </div>
            <div className="inset scroll overflow-y-auto p-2.5 space-y-1.5" style={{ maxHeight: 190 }}>
              {watchLogs.length === 0 ? (
                <div className="text-[11.5px] p-2" style={{ color: "var(--faint)" }}>Waiting for filesystem events…</div>
              ) : watchLogs.map((l) => (
                <div key={l.id} className="ticker flex gap-2 text-[11px]">
                  <span className="mono flex-none" style={{ color: "var(--faint)" }}>{new Date(l.at).toLocaleTimeString("en-US", { hour12: false })}</span>
                  <span className="mono flex-none" style={{ color: l.level === "warn" ? "var(--warning)" : l.level === "success" ? "var(--success)" : "var(--blue)" }}>[{l.source}]</span>
                  <span style={{ color: "var(--muted)" }}>{l.message}</span>
                </div>
              ))}
            </div>
          </Section>
        </div>
      </div>

      <Section title="Watched folders" sub="Recursion, live watch and per-root scanning" right={<PlatformSwitch />}>
        <form className="flex flex-wrap gap-2 mb-3" onSubmit={(e) => { e.preventDefault(); if (api.addRoot(newDir)) setNewDir(""); }}>
          <input className="field flex-1 min-w-[240px] mono text-[12px]" placeholder={renderPath("Projects/Archive", s.settings.platform)} value={newDir} onChange={(e) => setNewDir(e.target.value)} />
          <button className="btn btn-primary" type="submit"><Icon name="plus" size={14} />Add folder</button>
          {["Documents", "Pictures/Scans", "Projects", "Videos/Exports"].map((q) => (
            <button key={q} type="button" className="btn btn-sm" onClick={() => api.addRoot(q)}><Icon name="folder" size={12} />{q}</button>
          ))}
        </form>

        <div className="space-y-2">
          {s.roots.map((r) => (
            <div key={r.id} className="inset p-3 flex flex-wrap items-center gap-3">
              <input type="checkbox" className="check" checked={r.enabled} onChange={() => api.toggleRoot(r.id, "enabled")} aria-label={`Enable ${r.label}`} />
              <span className="w-8 h-8 rounded-lg grid place-items-center flex-none" style={{ background: "color-mix(in srgb, var(--teal) 12%, transparent)", color: r.enabled ? "var(--teal)" : "var(--faint)" }}>
                <Icon name="folder" size={15} />
              </span>
              <div className="min-w-[160px] flex-1">
                <div className="text-[13px] font-semibold truncate">{r.label}</div>
                <div className="mono text-[10.5px] truncate" style={{ color: "var(--faint)" }}>{shortPath(r.dir, s.settings.platform)}</div>
              </div>
              <div className="text-[11px] w-[92px]" style={{ color: "var(--muted)" }}>
                <div className="mono">{d.files.filter((f) => f.rootId === r.id).length.toLocaleString()} files</div>
                <div>{r.lastScan ? relTime(r.lastScan) : "never scanned"}</div>
              </div>
              <label className="flex items-center gap-1.5 text-[11.5px]" style={{ color: "var(--muted)" }}>
                <Toggle on={r.recursive} onChange={() => api.toggleRoot(r.id, "recursive")} label="Recursive" />recursive
              </label>
              <label className="flex items-center gap-1.5 text-[11.5px]" style={{ color: "var(--muted)" }}>
                <Toggle on={r.watch} onChange={() => api.toggleRoot(r.id, "watch")} label="Watch" />watch
              </label>
              <button className="btn btn-xs" onClick={() => api.startScan([r.id])}><Icon name="scan" size={11} />Scan</button>
              <button className="btn btn-xs btn-ghost" onClick={() => api.removeRoot(r.id)} aria-label="Remove folder"><Icon name="x" size={12} /></button>
            </div>
          ))}
          {s.roots.length === 0 && <Empty icon="folder" title="No folders watched" sub="Add a folder above to begin. System directories are refused automatically." />}
        </div>

        <div className="mt-3.5 p-3 rounded-[11px] flex flex-wrap items-center gap-2" style={{ background: "color-mix(in srgb, var(--danger) 8%, transparent)", border: "1px solid color-mix(in srgb, var(--danger) 26%, transparent)" }}>
          <span style={{ color: "var(--danger)" }}><Icon name="shield" size={15} /></span>
          <span className="text-[12px] font-semibold">Permanently excluded</span>
          {PROTECTED_PATHS.map((p) => <span key={p} className="chip" style={{ ["--c" as string]: "var(--danger)" }}>{p}</span>)}
        </div>
      </Section>
    </div>
  );
}