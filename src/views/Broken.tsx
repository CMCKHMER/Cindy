import { useMemo, useState } from "react";
import { useApp } from "../state/store";
import { Chip, Empty, Icon, Metric, Section, Thumb } from "../components/ui";
import { Approval } from "../components/Panels";
import { fmtBytes, fmtDate, renderPath } from "../lib/core";

const REASONS = [
  "Corrupted image", "Corrupted video", "Corrupted PDF", "Empty file",
  "Partial download", "Zero-byte file", "Broken shortcut", "Dead link",
] as const;

const REASON_COLOR: Record<string, string> = {
  "Corrupted image": "var(--magenta)",
  "Corrupted video": "var(--violet)",
  "Corrupted PDF": "var(--danger)",
  "Empty file": "var(--slate)",
  "Partial download": "var(--amber)",
  "Zero-byte file": "var(--slate)",
  "Broken shortcut": "var(--orange)",
  "Dead link": "var(--cyan)",
};

export default function Broken() {
  const { s, d, api } = useApp();
  const [reason, setReason] = useState<string>("all");
  const [sel, setSel] = useState<string[]>([]);
  const [ask, setAsk] = useState<string[] | null>(null);

  const list = useMemo(() => d.broken.filter((f) => reason === "all" || f.broken?.reason === reason), [d.broken, reason]);
  const targets = (ask ?? []).map((id) => d.byId.get(id)!).filter(Boolean);
  const repairable = targets.filter((f) => f.broken?.repairable);
  const counts = REASONS.map((r) => ({ r, n: d.broken.filter((f) => f.broken?.reason === r).length }));

  const act = (key: string) => {
    const ids = ask ?? [];
    if (key === "delete") api.deleteFiles(ids, "Damaged files removed with approval");
    else if (key === "repair") api.repairFiles(ids);
    else if (key === "archive") api.archiveFiles(ids, "Damaged files archived for later inspection");
    else api.ignoreFiles(ids, "Integrity warning ignored");
    setSel([]);
    setAsk(null);
  };

  return (
    <div className="space-y-4">
      <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-3 stagger">
        <Metric label="Damaged files" value={d.broken.length} icon="broken" color="var(--danger)" sub="quarantined in review, untouched" />
        <Metric label="Space held" value={d.stats.brokenBytes} unit="bytes" icon="chart" color="var(--amber)" sub="mostly partial downloads" />
        <Metric label="Safely repairable" value={d.broken.filter((f) => f.broken?.repairable).length} icon="wrench" color="var(--success)" sub="header / index reconstruction" />
        <Metric label="Zero-byte & stubs" value={d.broken.filter((f) => f.size === 0 || f.broken?.reason === "Broken shortcut" || f.broken?.reason === "Dead link").length} icon="alert" color="var(--slate)" sub="safe to clear after approval" />
      </div>

      <Section
        title="Integrity review"
        sub="This file appears damaged or unusable. Delete, Repair (if possible), Archive, or Ignore?"
        right={<Chip color="var(--success)"><Icon name="shield" size={11} />no auto-deletion</Chip>}
      >
        <div className="flex flex-wrap gap-1.5 mb-3">
          <button className="btn btn-xs" onClick={() => setReason("all")} style={reason === "all" ? { borderColor: "var(--teal)", color: "var(--teal)" } : undefined}>
            All · {d.broken.length}
          </button>
          {counts.map(({ r, n }) => (
            <button key={r} className="btn btn-xs" disabled={!n} onClick={() => setReason(r)}
              style={reason === r ? { borderColor: REASON_COLOR[r], color: REASON_COLOR[r], background: `color-mix(in srgb, ${REASON_COLOR[r]} 12%, transparent)` } : undefined}>
              <span className="dot" style={{ background: REASON_COLOR[r] }} />{r} · {n}
            </button>
          ))}
        </div>

        {sel.length > 0 && (
          <div className="inset p-2.5 mb-3 flex flex-wrap items-center gap-2 pop" style={{ borderColor: "color-mix(in srgb, var(--teal) 40%, transparent)" }}>
            <Icon name="check" size={14} />
            <span className="text-[12px] flex-1">{sel.length} selected · {fmtBytes(sel.reduce((a, id) => a + (d.byId.get(id)?.size ?? 0), 0))}</span>
            <button className="btn btn-xs" onClick={() => setSel([])}>Clear</button>
            <button className="btn btn-xs" onClick={() => api.repairFiles(sel)}><Icon name="wrench" size={11} />Repair possible</button>
            <button className="btn btn-xs btn-primary" onClick={() => setAsk(sel)}>Review action<Icon name="arrow" size={11} /></button>
          </div>
        )}

        {list.length === 0 ? (
          <Empty icon="check" title="No damaged files in this category" sub="Sasha Maid validates image decoders, video atoms, PDF xref tables, archive CRCs, shortcut targets and link reachability." />
        ) : (
          <div className="grid md:grid-cols-2 2xl:grid-cols-3 gap-3">
            {list.map((f) => {
              const info = f.broken!;
              const color = REASON_COLOR[info.reason] ?? "var(--danger)";
              return (
                <article key={f.id} className="inset overflow-hidden rise" style={{ borderColor: `color-mix(in srgb, ${color} 26%, var(--line))` }}>
                  <div className="flex gap-3 p-3">
                    <input type="checkbox" className="check mt-1" checked={sel.includes(f.id)}
                      onChange={() => setSel((c) => (c.includes(f.id) ? c.filter((x) => x !== f.id) : [...c, f.id]))} aria-label={`Select ${f.name}`} />
                    <button onClick={() => api.openDrawer(f.id)} className="flex-none"><Thumb file={f} size={64} radius={9} /></button>
                    <div className="min-w-0 flex-1">
                      <button className="text-[13px] font-semibold truncate block max-w-full text-left hover:underline" onClick={() => api.openDrawer(f.id)}>{f.name}</button>
                      <div className="mono text-[10.5px] truncate mt-0.5" style={{ color: "var(--faint)" }}>{renderPath(f.dir, s.settings.platform)}</div>
                      <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                        <Chip color={color}>{info.reason}</Chip>
                        <span className="mono text-[10.5px]" style={{ color: "var(--muted)" }}>{fmtBytes(f.size)} · {fmtDate(f.modified)}</span>
                      </div>
                    </div>
                  </div>
                  <div className="px-3 pb-3">
                    <p className="text-[11.5px] leading-relaxed" style={{ color: "var(--muted)" }}>{info.detail}</p>
                    <div className="flex items-center gap-2 mt-2">
                      <div className="h-1 flex-1 rounded-full overflow-hidden" style={{ background: "color-mix(in srgb, var(--text) 10%, transparent)" }}>
                        <div className="h-full rounded-full" style={{ width: `${info.confidence * 100}%`, background: color }} />
                      </div>
                      <span className="mono text-[10px]" style={{ color }}>{Math.round(info.confidence * 100)}% certain</span>
                    </div>
                    {info.repairable ? (
                      <div className="mt-2 p-2 rounded-lg text-[11px] flex gap-1.5" style={{ background: "color-mix(in srgb, var(--success) 10%, transparent)", color: "var(--success)" }}>
                        <Icon name="wrench" size={12} />{info.repairMethod}
                      </div>
                    ) : (
                      <div className="mt-2 p-2 rounded-lg text-[11px] flex gap-1.5" style={{ background: "color-mix(in srgb, var(--text) 6%, transparent)", color: "var(--faint)" }}>
                        <Icon name="info" size={12} />No safe automated repair — the original bytes cannot be recovered.
                      </div>
                    )}
                    <div className="flex flex-wrap gap-1.5 mt-2.5">
                      <button className="btn btn-xs" disabled={!info.repairable} onClick={() => setAsk([f.id])}><Icon name="wrench" size={11} />Repair</button>
                      <button className="btn btn-xs" onClick={() => api.archiveFiles([f.id], `${info.reason} archived`)}><Icon name="archive" size={11} />Archive</button>
                      <button className="btn btn-xs" onClick={() => api.ignoreFiles([f.id], `${info.reason} ignored`)}><Icon name="eye" size={11} />Ignore</button>
                      <button className="btn btn-xs btn-danger" onClick={() => setAsk([f.id])}><Icon name="trash" size={11} />Delete</button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </Section>

      <Approval
        open={!!ask}
        onClose={() => setAsk(null)}
        title="This file appears damaged or unusable."
        question="Delete, Repair (if possible), Archive, or Ignore?"
        files={targets}
        note={repairable.length
          ? `${repairable.length} of ${targets.length} selected files have a safe, non-destructive repair path. Repairs write a new file and keep the original in the backup snapshot.`
          : "None of the selected files can be repaired automatically. Archiving keeps them out of the way without destroying anything."}
        actions={[
          { key: "ignore", label: "Ignore", icon: "eye", tone: "info", desc: "Keep the file and stop flagging it in future scans." },
          { key: "repair", label: `Repair${repairable.length ? ` (${repairable.length})` : ""}`, icon: "wrench", tone: "success", desc: "Rebuild headers/indexes where mathematically possible.", disabled: repairable.length === 0 },
          { key: "archive", label: "Archive", icon: "archive", tone: "warn", desc: "Move to .sasha/Review/<date> with the original path recorded." },
          { key: "delete", label: "Delete", icon: "trash", tone: "danger", desc: "Trash + snapshot, recoverable from Undo history." },
        ]}
        onAction={act}
      />
    </div>
  );
}