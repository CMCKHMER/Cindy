import { useMemo } from "react";
import { useApp } from "../state/store";
import { Chip, Donut, Icon, Metric, Reveal, Ring, Section, Thumb, BarRow, Empty } from "../components/ui";
import { ScanButton } from "../components/Shell";
import { KIND_META, TAXONOMY, fmtBytes, relTime, shortPath } from "../lib/core";
import { storageHistory, subjectClusters } from "../data/seed";

function Tree() {
  return (
    <div className="mono text-[11.5px] leading-[1.85] scroll overflow-auto" style={{ maxHeight: 300 }}>
      {TAXONOMY.map((top) => (
        <div key={top.name}>
          <div style={{ color: "var(--teal)" }}>{top.name}/</div>
          {top.children.map((c, i) => (
            <div key={c.name} style={{ color: "var(--muted)" }}>
              <span style={{ color: "var(--faint)" }}>{i === top.children.length - 1 ? " └── " : " ├── "}</span>
              {c.name}/
              {c.children?.map((g, j) => (
                <div key={g} style={{ color: "var(--faint)" }}>
                  <span>{i === top.children.length - 1 ? "     " : " │   "}{j === c.children!.length - 1 ? " └── " : " ├── "}</span>
                  <span style={{ color: "var(--magenta)" }}>{g}/</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

export default function Dashboard() {
  const { s, d, api } = useApp();
  const health = useMemo(() => {
    const penalty = Math.min(46, d.pending.duplicates * 1.6 + d.pending.broken * 1.4 + d.pending.rename * 0.18 + d.pending.folders * 1.2);
    return Math.max(38, Math.round(100 - penalty));
  }, [d.pending]);

  const queue = [
    { id: "duplicates", label: "Duplicate groups", count: d.pending.duplicates, bytes: d.stats.dupReclaim, color: "var(--magenta)", icon: "copy", files: d.groups.flatMap((g) => g.members).slice(0, 4), cta: "Review duplicates" },
    { id: "broken", label: "Damaged files", count: d.pending.broken, bytes: d.stats.brokenBytes, color: "var(--danger)", icon: "broken", files: d.broken.slice(0, 4), cta: "Inspect integrity" },
    { id: "rename", label: "Rename suggestions", count: d.pending.rename, bytes: d.renames.reduce((a, b) => a + b.size, 0), color: "var(--blue)", icon: "wand", files: d.renames.slice(0, 4), cta: "Open rename studio" },
    { id: "organize", label: "Downloads to triage", count: d.pending.organize, bytes: d.downloads.reduce((a, b) => a + b.size, 0), color: "var(--amber)", icon: "folder", files: d.downloads.slice(0, 4), cta: "Plan cleanup" },
  ];

  const donutData = d.stats.byKind.map((k) => ({ label: KIND_META[k.kind].label, value: k.bytes, color: KIND_META[k.kind].color }));
  const maxRoot = Math.max(...d.stats.byRoot.map((r) => r.bytes), 1);
  const recent = [...s.ops].reverse().slice(0, 5);
  const liveLogs = s.logs.slice(0, 7);

  return (
    <div className="space-y-4">
      <div className="card p-3 flex flex-wrap items-center gap-3" style={{ borderColor: "color-mix(in srgb, var(--amber) 35%, var(--line))" }}>
        <span style={{ color: "var(--amber)" }}><Icon name="info" size={15} /></span>
        <div className="min-w-0 flex-1"><div className="text-[12px] font-semibold">Sample workspace</div><div className="text-[11px]" style={{ color: "var(--muted)" }}>Overview figures are demo data. Use Live disk to scan folders and perform approved actions on this computer.</div></div>
        <button className="btn btn-sm" onClick={() => api.go("live")}>Open Live disk<Icon name="arrow" size={12} /></button>
      </div>
      {/* hero */}
      <section className="card card-hi overflow-hidden rise" style={{ background: "linear-gradient(135deg, color-mix(in srgb, var(--teal) 13%, var(--surface)), color-mix(in srgb, var(--blue) 12%, var(--surface)) 46%, color-mix(in srgb, var(--magenta) 9%, var(--surface)))" }}>
        <div className="grid lg:grid-cols-[1.35fr_1fr] gap-6 p-5 lg:p-7">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-3">
              <Chip color="var(--success)"><span className="dot pulse" style={{ color: "var(--success)" }} />{s.settings.watch ? "monitoring live" : "monitor paused"}</Chip>
              <Chip color="var(--teal)">{s.settings.visionModel}</Chip>
              <Chip color="var(--blue)">{s.settings.localOnly ? "offline" : "hybrid"}</Chip>
            </div>
            <h2 className="display text-[30px] lg:text-[38px] font-bold leading-[1.05]">
              A librarian for every<br />
              <span style={{ color: "var(--teal)" }}>file you own.</span>
            </h2>
            <p className="text-[13.5px] mt-3 max-w-[520px]" style={{ color: "var(--muted)" }}>
              Sasha Maid indexes {d.stats.fileCount.toLocaleString()} files across {s.roots.filter((r) => r.enabled).length} roots, groups duplicates by hash and vision,
              catches damaged files before you need them, and writes descriptive names — then waits for your approval.
            </p>
            <div className="flex flex-wrap items-center gap-2 mt-5">
              <ScanButton />
              <button className="btn" onClick={() => api.runCommand("Clean my Downloads folder")}><Icon name="folder" size={14} />Clean Downloads</button>
              <button className="btn" onClick={() => api.runCommand("Find duplicate photos")}><Icon name="copy" size={14} />Find duplicate photos</button>
              <button className="btn" onClick={() => api.go("desktop")}><Icon name="download" size={14} />Run on my desktop</button>
              <button className="btn btn-ghost" onClick={() => api.setCommandOpen(true)}><Icon name="spark" size={14} />Ask anything<span className="kbd ml-1">⌘K</span></button>
            </div>
            <div className="flex flex-wrap gap-x-6 gap-y-2 mt-5 pt-4" style={{ borderTop: "1px solid var(--line)" }}>
              {[
                { k: "Storage saved", v: fmtBytes(d.stats.savedBytes), c: "var(--lime)" },
                { k: "Files organised", v: String(d.stats.movedCount), c: "var(--teal)" },
                { k: "Files renamed", v: String(d.stats.renamedCount), c: "var(--blue)" },
                { k: "Reversible ops", v: String(s.ops.filter((o) => !o.undone).length), c: "var(--magenta)" },
              ].map((x) => (
                <div key={x.k}>
                  <div className="label">{x.k}</div>
                  <div className="display text-[19px] font-bold mt-0.5" style={{ color: x.c }}>{x.v}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-3 min-w-0">
            <div className="inset p-4 flex items-center gap-4">
              <Ring value={health} size={116} label={`${health}`} sub="library health" color={health > 80 ? "var(--success)" : health > 60 ? "var(--amber)" : "var(--magenta)"} />
              <div className="min-w-0 text-[12px] space-y-1.5">
                <div className="flex items-center gap-2"><span className="dot" style={{ background: "var(--magenta)" }} />{d.pending.duplicates} duplicate groups</div>
                <div className="flex items-center gap-2"><span className="dot" style={{ background: "var(--danger)" }} />{d.pending.broken} damaged files</div>
                <div className="flex items-center gap-2"><span className="dot" style={{ background: "var(--blue)" }} />{d.pending.rename} names to approve</div>
                <div className="flex items-center gap-2"><span className="dot" style={{ background: "var(--amber)" }} />{d.pending.folders} folder names</div>
                <div className="pt-1.5 text-[11px]" style={{ color: "var(--faint)" }}>{fmtBytes(d.stats.dupReclaim + d.stats.brokenBytes)} reclaimable with approval</div>
              </div>
            </div>
            <div className="inset p-3 flex-1 min-h-[150px]">
              <div className="flex items-center justify-between mb-2">
                <span className="label">Live activity</span>
                <span className="mono text-[10px]" style={{ color: "var(--faint)" }}>watchdog · sqlite journal</span>
              </div>
              <div className="space-y-1.5 scroll overflow-y-auto" style={{ maxHeight: 168 }}>
                {liveLogs.map((l) => (
                  <div key={l.id} className="ticker flex gap-2 text-[11.5px]">
                    <span className="mono text-[10px] pt-0.5 flex-none" style={{ color: "var(--faint)" }}>{new Date(l.at).toLocaleTimeString("en-US", { hour12: false })}</span>
                    <span className="dot mt-1.5 flex-none" style={{ background: l.level === "danger" ? "var(--danger)" : l.level === "warn" ? "var(--warning)" : l.level === "ai" ? "var(--violet)" : l.level === "success" ? "var(--success)" : "var(--blue)" }} />
                    <span className="min-w-0" style={{ color: "var(--muted)" }}>{l.message}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* metrics */}
      <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-3 stagger">
        <Metric label="Files indexed" value={d.stats.fileCount} icon="files" color="var(--teal)" sub={`${s.roots.filter((r) => r.enabled).length} roots · incremental index`} spark={[420, 640, 810, 980, 1180, 1320, d.stats.fileCount]} />
        <Metric label="Storage indexed" value={d.stats.totalBytes} unit="bytes" icon="chart" color="var(--blue)" sub={`${d.stats.large.length} files over 1 GB`} spark={storageHistory.map((h) => h.gb)} />
        <Metric label="Reclaimable" value={d.stats.dupReclaim + d.stats.brokenBytes} unit="bytes" icon="spark" color="var(--magenta)" sub="duplicates + damaged, pending approval" spark={[12, 18, 26, 31, 44, 52, 61]} />
        <Metric label="Awaiting approval" value={d.pending.duplicates + d.pending.broken + d.pending.folders} icon="shield" color="var(--amber)" sub="nothing runs without you" spark={[3, 6, 9, 14, 12, 18, 21]} />
      </div>

      {/* approval queue */}
      <Reveal>
        <Section title="Needs your approval" sub="Sasha Maid proposes, you decide. Every action below is reversible." right={<Chip color="var(--success)"><Icon name="shield" size={11} />safe by default</Chip>}>
          <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-3">
            {queue.map((q) => (
              <button key={q.id} className="inset p-3.5 text-left group transition-transform hover:-translate-y-0.5" onClick={() => api.go(q.id)} style={{ borderColor: `color-mix(in srgb, ${q.color} 26%, var(--line))` }}>
                <div className="flex items-center justify-between">
                  <span className="w-8 h-8 rounded-[10px] grid place-items-center" style={{ background: `color-mix(in srgb, ${q.color} 16%, transparent)`, color: q.color }}><Icon name={q.icon} size={16} /></span>
                  <span className="display text-[24px] font-bold" style={{ color: q.color }}>{q.count}</span>
                </div>
                <div className="text-[12.5px] font-semibold mt-2.5">{q.label}</div>
                <div className="text-[11px] mt-0.5" style={{ color: "var(--muted)" }}>{fmtBytes(q.bytes)} involved</div>
                <div className="flex -space-x-2 mt-3">
                  {q.files.length ? q.files.map((f) => <Thumb key={f.id} file={f} size={30} radius={7} className="ring-1 ring-black/20" />) : <span className="text-[11px]" style={{ color: "var(--faint)" }}>all clear</span>}
                </div>
                <div className="flex items-center gap-1.5 mt-3 text-[11.5px] font-medium" style={{ color: q.color }}>
                  {q.cta}<Icon name="arrow" size={12} />
                </div>
              </button>
            ))}
          </div>
        </Section>
      </Reveal>

      <div className="grid xl:grid-cols-[1.1fr_1fr] gap-4">
        <Reveal>
          <Section title="Storage by category" sub="Content-aware classification, not just extensions" right={<button className="btn btn-xs" onClick={() => api.go("analytics")}>Full analytics<Icon name="arrow" size={11} /></button>}>
            <Donut data={donutData} />
            <div className="mt-4 pt-3.5 space-y-2.5" style={{ borderTop: "1px solid var(--line)" }}>
              {d.stats.byRoot.slice(0, 5).map((r, i) => (
                <BarRow key={r.id} label={`${r.label} · ${r.count.toLocaleString()} files`} value={r.bytes} max={maxRoot}
                  color={[KIND_META.image.color, KIND_META.video.color, KIND_META.document.color, KIND_META.music.color, KIND_META.archive.color][i % 5]}
                  onClick={() => { api.setFilters({ root: r.id }); api.go("explorer"); }} />
              ))}
            </div>
          </Section>
        </Reveal>

        <div className="space-y-4">
          <Reveal delay={60}>
            <Section title="Target structure" sub="Created automatically, only when files move" right={<Chip color="var(--teal)">taxonomy v3</Chip>}>
              <Tree />
            </Section>
          </Reveal>
          <Reveal delay={90}>
            <Section title="Photo subjects" sub="CLIP embeddings clustered with faiss">
              <div className="flex flex-wrap gap-2">
                {subjectClusters.map((c) => (
                  <button key={c.name} className="chip" style={{ ["--c" as string]: c.color, height: 28, padding: "0 10px" }}
                    onClick={() => { api.setFilters({ kind: "image", query: c.name.split(" ")[0].toLowerCase() }); api.go("explorer"); }}>
                    {c.name}<span className="mono opacity-70">{c.count}</span>
                  </button>
                ))}
              </div>
            </Section>
          </Reveal>
        </div>
      </div>

      <Reveal>
        <Section title="Recent operations" sub="Snapshots written before every batch" right={<button className="btn btn-xs" onClick={() => api.go("history")}>Undo history<Icon name="arrow" size={11} /></button>}>
          {recent.length === 0 ? (
            <Empty icon="history" title="No operations yet" sub="Approve a duplicate group, a rename batch or a cleanup plan — it will appear here with a one-click undo." action={<ScanButton compact />} />
          ) : (
            <div className="space-y-2">
              {recent.map((o) => (
                <div key={o.id} className="inset p-2.5 flex items-center gap-3">
                  <span className="w-7 h-7 rounded-lg grid place-items-center flex-none" style={{ background: "color-mix(in srgb, var(--teal) 14%, transparent)", color: o.undone ? "var(--faint)" : "var(--teal)" }}>
                    <Icon name={o.kind === "delete" ? "trash" : o.kind === "rename" ? "wand" : o.kind === "repair" ? "wrench" : o.kind === "archive" ? "archive" : "folder"} size={14} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className={`text-[12.5px] truncate ${o.undone ? "line-through opacity-60" : ""}`}>{o.label}</div>
                    <div className="mono text-[10.5px] truncate" style={{ color: "var(--faint)" }}>{relTime(o.at)} · {o.patches.length} files · {fmtBytes(o.bytes)} · {o.backup}</div>
                  </div>
                  {o.undone
                    ? <button className="btn btn-xs" onClick={() => api.redo(o.id)}><Icon name="redo" size={11} />Redo</button>
                    : <button className="btn btn-xs" onClick={() => api.undo(o.id)}><Icon name="undo" size={11} />Undo</button>}
                </div>
              ))}
            </div>
          )}
        </Section>
      </Reveal>

      <Reveal>
        <Section title="Watched folders" sub="Recursive, incremental, never OS-critical">
          <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-2.5">
            {s.roots.map((r) => (
              <div key={r.id} className="inset p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[12.5px] font-semibold truncate">{r.label}</span>
                  <Chip color={r.enabled ? "var(--success)" : "var(--faint)"}>{r.enabled ? "active" : "off"}</Chip>
                </div>
                <div className="mono text-[10.5px] mt-1 truncate" style={{ color: "var(--faint)" }}>{shortPath(r.dir, s.settings.platform)}</div>
                <div className="flex items-center justify-between mt-2 text-[11px]" style={{ color: "var(--muted)" }}>
                  <span>{d.files.filter((f) => f.rootId === r.id).length.toLocaleString()} files</span>
                  <span>{r.lastScan ? relTime(r.lastScan) : "never scanned"}</span>
                </div>
              </div>
            ))}
          </div>
        </Section>
      </Reveal>
    </div>
  );
}