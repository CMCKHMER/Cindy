import { useMemo, useState } from "react";
import { useApp } from "../state/store";
import { Chip, CopyBtn, Empty, Icon, Metric, Section, Segmented } from "../components/ui";
import { exportReport } from "../lib/export";
import { fmtBytes, fmtDate, fmtTime, relTime } from "../lib/core";

const OP_ICON: Record<string, string> = {
  move: "folder", rename: "wand", delete: "trash", archive: "archive", repair: "wrench",
  "folder-rename": "folder", extract: "archive", import: "upload", ignore: "eye", keep: "star",
};

export default function History() {
  const { s, d, api } = useApp();
  const [sections, setSections] = useState({ moved: true, renamed: true, duplicates: true, broken: true, storage: true, log: true });
  const [expanded, setExpanded] = useState<string | null>(null);
  const [level, setLevel] = useState<"all" | "info" | "warn" | "danger" | "success" | "ai">("all");
  const [lastExport, setLastExport] = useState<string | null>(null);

  const ops = useMemo(() => [...s.ops].reverse(), [s.ops]);
  const logs = useMemo(() => s.logs.filter((l) => level === "all" || l.level === level), [s.logs, level]);
  const active = s.ops.filter((o) => !o.undone);
  const touched = active.reduce((a, o) => a + o.patches.length, 0);

  const doExport = (format: "pdf" | "csv" | "json") => {
    const name = exportReport(format, {
      ops: s.ops, groups: d.groups, broken: d.broken, renames: d.renames,
      stats: d.stats, settings: s.settings, sections,
    });
    setLastExport(`${name} · ${format.toUpperCase()}`);
    api.log("success", "report", `Exported ${format.toUpperCase()} report: ${name}`);
    api.toast({ tone: "success", title: `${format.toUpperCase()} report exported`, message: name });
  };

  return (
    <div className="space-y-4">
      <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-3 stagger">
        <Metric label="Operations" value={active.length} icon="history" color="var(--teal)" sub={`${s.ops.filter((o) => o.undone).length} reverted`} />
        <Metric label="Files touched" value={touched} icon="files" color="var(--blue)" sub="moves, renames, repairs, deletions" />
        <Metric label="Storage saved" value={d.stats.savedBytes} unit="bytes" icon="spark" color="var(--lime)" sub="approved deletions only" />
        <Metric label="Backup snapshots" value={active.filter((o) => o.patches.length).length} icon="shield" color="var(--violet)" sub={`${s.settings.backupRetention}-day retention`} />
      </div>

      <div className="grid xl:grid-cols-[1fr_1.15fr] gap-4">
        <Section title="Report builder" sub="Everything the agent did, in a format you can hand to someone else"
          right={<Chip color="var(--teal)"><Icon name="download" size={11} />3 formats</Chip>}>
          <div className="grid grid-cols-2 gap-2 mb-3">
            {([
              ["moved", "Files moved"], ["renamed", "Files renamed"], ["duplicates", "Duplicates found"],
              ["broken", "Broken files"], ["storage", "Storage saved"], ["log", "Operation log"],
            ] as const).map(([k, label]) => (
              <label key={k} className="inset p-2.5 flex items-center gap-2 cursor-pointer">
                <input type="checkbox" className="check" checked={sections[k]} onChange={() => setSections((c) => ({ ...c, [k]: !c[k] }))} />
                <span className="text-[12px]">{label}</span>
              </label>
            ))}
          </div>

          <div className="inset p-3 space-y-1.5 mb-3">
            <div className="label mb-1">Report preview</div>
            {[
              ["Files indexed", d.stats.fileCount.toLocaleString()],
              ["Files moved", String(d.stats.movedCount)],
              ["Files renamed", String(d.stats.renamedCount)],
              ["Duplicate groups", String(d.groups.length)],
              ["Broken files found", String(d.broken.length)],
              ["Storage saved", fmtBytes(d.stats.savedBytes)],
              ["Reclaimable pending", fmtBytes(d.stats.dupReclaim)],
            ].map(([k, v]) => (
              <div key={k} className="flex items-center justify-between text-[12px]">
                <span style={{ color: "var(--muted)" }}>{k}</span>
                <span className="mono" style={{ color: "var(--teal)" }}>{v}</span>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap gap-2">
            <button className="btn btn-primary" onClick={() => doExport("pdf")}><Icon name="download" size={14} />Export PDF</button>
            <button className="btn" onClick={() => doExport("csv")}><Icon name="download" size={14} />Export CSV</button>
            <button className="btn" onClick={() => doExport("json")}><Icon name="download" size={14} />Export JSON</button>
          </div>
          {lastExport && (
            <div className="mt-2.5 inset p-2.5 flex items-center gap-2 text-[11.5px] ticker">
              <Icon name="check" size={13} />
              <span className="mono truncate flex-1" style={{ color: "var(--success)" }}>{lastExport}</span>
            </div>
          )}
          <p className="text-[11px] mt-2.5" style={{ color: "var(--faint)" }}>
            The PDF is generated in-browser (no server round-trip); CSV opens in Excel/Numbers; JSON matches the FastAPI <span className="mono">/api/report</span> schema.
          </p>
        </Section>

        <Section title="Undo history" sub="Newest first · every entry restores the exact previous state"
          right={<button className="btn btn-sm" onClick={api.undoLast} disabled={!active.length}><Icon name="undo" size={13} />Undo last<span className="kbd ml-1">⌘Z</span></button>}>
          {ops.length === 0 ? (
            <Empty icon="history" title="No operations yet" sub="Approve something — a duplicate group, a rename batch, a cleanup plan — and it will appear here with a snapshot path and an undo button." />
          ) : (
            <div className="space-y-2 scroll overflow-y-auto" style={{ maxHeight: 520 }}>
              {ops.map((o) => (
                <div key={o.id} className="inset overflow-hidden" style={{ opacity: o.undone ? 0.6 : 1 }}>
                  <div className="p-2.5 flex items-start gap-2.5">
                    <span className="w-7 h-7 rounded-lg grid place-items-center flex-none mt-0.5"
                      style={{ background: `color-mix(in srgb, ${o.kind === "delete" ? "var(--danger)" : o.kind === "repair" ? "var(--success)" : "var(--teal)"} 14%, transparent)`, color: o.kind === "delete" ? "var(--danger)" : o.kind === "repair" ? "var(--success)" : "var(--teal)" }}>
                      <Icon name={OP_ICON[o.kind] ?? "info"} size={14} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className={`text-[12.5px] font-medium ${o.undone ? "line-through" : ""}`}>{o.label}</div>
                      <div className="text-[11px] mt-0.5" style={{ color: "var(--muted)" }}>{o.detail}</div>
                      <div className="mono text-[10px] mt-1 flex flex-wrap gap-x-3" style={{ color: "var(--faint)" }}>
                        <span>{fmtDate(o.at)} {fmtTime(o.at)}</span>
                        <span>{o.patches.length} files</span>
                        <span>{fmtBytes(o.bytes)}</span>
                        <span className="truncate">{o.backup}</span>
                      </div>
                    </div>
                    <div className="flex flex-col gap-1">
                      {o.undone
                        ? <button className="btn btn-xs" onClick={() => api.redo(o.id)}><Icon name="redo" size={11} />Redo</button>
                        : <button className="btn btn-xs" onClick={() => api.undo(o.id)} disabled={!o.patches.length && !o.folderPatch}><Icon name="undo" size={11} />Undo</button>}
                      {!!o.patches.length && (
                        <button className="btn btn-xs btn-ghost" onClick={() => setExpanded(expanded === o.id ? null : o.id)}>
                          <Icon name={expanded === o.id ? "minus" : "plus"} size={11} />Files
                        </button>
                      )}
                    </div>
                  </div>
                  {expanded === o.id && (
                    <div className="px-2.5 pb-2.5 space-y-1 fadein">
                      {o.patches.slice(0, 30).map((p) => {
                        const f = d.byId.get(p.id);
                        return (
                          <div key={p.id} className="mono text-[10.5px] flex flex-wrap items-center gap-1.5 p-1.5 rounded-md" style={{ background: "color-mix(in srgb, var(--text) 4%, transparent)" }}>
                            <span style={{ color: "var(--faint)" }}>{String(p.before.name ?? f?.name ?? p.id)}</span>
                            <Icon name="arrow" size={10} />
                            <span style={{ color: "var(--teal)" }}>{String(p.after.name ?? p.after.dir ?? p.after.status ?? "updated")}</span>
                          </div>
                        );
                      })}
                      {o.patches.length > 30 && <div className="text-[10.5px]" style={{ color: "var(--faint)" }}>+{o.patches.length - 30} more</div>}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </Section>
      </div>

      <Section title="Activity journal" sub="Structured log — mirrored to sasha.log and the SQLite journal table"
        right={
          <div className="flex items-center gap-2">
            <Segmented value={level} onChange={setLevel} size="sm" options={[
              { value: "all", label: "All" }, { value: "success", label: "Applied" }, { value: "ai", label: "AI" },
              { value: "warn", label: "Warnings" }, { value: "danger", label: "Blocked" },
            ]} />
            <CopyBtn label="Copy log" text={logs.map((l) => `${new Date(l.at).toISOString()} [${l.level}] ${l.source}: ${l.message}`).join("\n")} />
          </div>
        }>
        <div className="inset scroll overflow-auto p-3 space-y-1" style={{ maxHeight: 340 }}>
          {logs.length === 0 ? (
            <div className="text-[12px]" style={{ color: "var(--faint)" }}>No entries at this level.</div>
          ) : logs.map((l) => (
            <div key={l.id} className="mono text-[11px] flex gap-2.5 leading-relaxed">
              <span className="flex-none" style={{ color: "var(--faint)" }}>{fmtTime(l.at)}</span>
              <span className="flex-none w-[62px]" style={{ color: l.level === "danger" ? "var(--danger)" : l.level === "warn" ? "var(--warning)" : l.level === "success" ? "var(--success)" : l.level === "ai" ? "var(--violet)" : "var(--blue)" }}>
                {l.level.toUpperCase()}
              </span>
              <span className="flex-none w-[74px] truncate" style={{ color: "var(--teal)" }}>{l.source}</span>
              <span style={{ color: "var(--muted)" }}>{l.message}</span>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2 mt-2.5 text-[11px]" style={{ color: "var(--faint)" }}>
          <Icon name="clock" size={12} />Last entry {s.logs[0] ? relTime(s.logs[0].at) : "—"} · {s.logs.length} entries retained in memory, unlimited on disk
        </div>
      </Section>
    </div>
  );
}