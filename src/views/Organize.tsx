import { useMemo, useState } from "react";
import { useApp } from "../state/store";
import { Chip, Empty, Icon, Metric, Section, Thumb } from "../components/ui";
import { Approval } from "../components/Panels";
import { BUCKETS, BUCKET_DEST, fmtBytes, relTime, shortPath } from "../lib/core";

const BUCKET_COLOR: Record<string, string> = {
  Software: "var(--lime)", Installers: "var(--orange)", Documents: "var(--blue)",
  Images: "var(--magenta)", Videos: "var(--violet)", Archives: "var(--amber)",
};

export default function Organize() {
  const { s, d, api } = useApp();
  const [sel, setSel] = useState<string[]>([]);
  const [ask, setAsk] = useState<{ ids: string[]; label: string } | null>(null);
  const [editFolder, setEditFolder] = useState<Record<string, string>>({});
  const [expanded, setExpanded] = useState<string | null>("Installers");

  const buckets = useMemo(() => {
    return BUCKETS.map((b) => {
      const files = d.downloads.filter((f) => (f.bucket ?? "Documents") === b);
      return { name: b, files, bytes: files.reduce((a, f) => a + f.size, 0), dest: BUCKET_DEST[b] };
    });
  }, [d.downloads]);

  const archives = useMemo(() => d.live.filter((f) => ["zip", "rar", "7z", "tar", "gz"].includes(f.ext)).slice(0, 8), [d.live]);
  const targets = (ask?.ids ?? []).map((id) => d.byId.get(id)!).filter(Boolean);
  const planBytes = d.downloads.reduce((a, f) => a + f.size, 0);

  return (
    <div className="space-y-4">
      <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-3 stagger">
        <Metric label="Downloads to triage" value={d.downloads.length} icon="download" color="var(--amber)" sub={`${fmtBytes(planBytes)} awaiting a home`} />
        <Metric label="Folder name ideas" value={d.pending.folders} icon="folder" color="var(--teal)" sub="from content analysis, not guesses" />
        <Metric label="Files organised" value={d.stats.movedCount} icon="check" color="var(--lime)" sub="taxonomy folders created on demand" />
        <Metric label="Archives indexed" value={d.live.filter((f) => ["zip", "rar", "7z", "tar", "gz"].includes(f.ext)).length} icon="archive" color="var(--violet)" sub="safe extraction to a sandbox folder" />
      </div>

      <Section title="Downloads cleanup plan" sub="Sasha Maid classifies every item, proposes a destination and waits for your approval before moving anything."
        right={
          <div className="flex gap-2">
            {sel.length > 0 && <button className="btn btn-sm" onClick={() => setAsk({ ids: sel, label: `Move ${sel.length} selected items` })}><Icon name="check" size={13} />Move selected ({sel.length})</button>}
            <button className="btn btn-sm btn-primary" disabled={!d.downloads.length} onClick={() => setAsk({ ids: d.downloads.map((f) => f.id), label: "Downloads cleanup plan" })}>
              <Icon name="folder" size={13} />Approve full plan
            </button>
          </div>
        }>
        {d.downloads.length === 0 ? (
          <Empty icon="check" title="Downloads is clean" sub="Every item has an approved home. New arrivals are classified automatically by the watcher." />
        ) : (
          <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3">
            {buckets.map((b) => {
              const open = expanded === b.name;
              return (
                <div key={b.name} className="inset overflow-hidden" style={{ borderColor: `color-mix(in srgb, ${BUCKET_COLOR[b.name]} 26%, var(--line))` }}>
                  <div className="p-3" style={{ background: `color-mix(in srgb, ${BUCKET_COLOR[b.name]} 8%, transparent)` }}>
                    <div className="flex items-center gap-2">
                      <span className="w-7 h-7 rounded-lg grid place-items-center" style={{ background: `color-mix(in srgb, ${BUCKET_COLOR[b.name]} 18%, transparent)`, color: BUCKET_COLOR[b.name] }}>
                        <Icon name={b.name === "Images" ? "image" : b.name === "Videos" ? "play" : b.name === "Archives" ? "archive" : b.name === "Documents" ? "files" : "cpu"} size={14} />
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="text-[13px] font-semibold">{b.name}</div>
                        <div className="mono text-[10px] truncate" style={{ color: "var(--faint)" }}>→ {b.dest}</div>
                      </div>
                      <div className="text-right">
                        <div className="display text-[17px] font-bold" style={{ color: BUCKET_COLOR[b.name] }}>{b.files.length}</div>
                        <div className="mono text-[10px]" style={{ color: "var(--muted)" }}>{fmtBytes(b.bytes)}</div>
                      </div>
                    </div>
                  </div>
                  <div className="p-2.5 space-y-1.5">
                    {(open ? b.files.slice(0, 14) : b.files.slice(0, 3)).map((f) => (
                      <div key={f.id} className="flex items-center gap-2">
                        <input type="checkbox" className="check" checked={sel.includes(f.id)}
                          onChange={() => setSel((c) => (c.includes(f.id) ? c.filter((x) => x !== f.id) : [...c, f.id]))} aria-label={`Select ${f.name}`} />
                        <button className="min-w-0 flex-1 text-left" onClick={() => api.openDrawer(f.id)}>
                          <div className="text-[11.5px] truncate">{f.name}</div>
                          <div className="mono text-[10px]" style={{ color: "var(--faint)" }}>{fmtBytes(f.size)} · {relTime(f.modified)}</div>
                        </button>
                      </div>
                    ))}
                    {b.files.length > 3 && (
                      <button className="btn btn-xs w-full" onClick={() => setExpanded(open ? null : b.name)}>
                        {open ? "Collapse" : `Show ${Math.min(14, b.files.length)} of ${b.files.length}`}
                      </button>
                    )}
                    <button className="btn btn-xs btn-primary w-full" disabled={!b.files.length}
                      onClick={() => setAsk({ ids: b.files.map((f) => f.id), label: `Move ${b.name} → ${b.dest}` })}>
                      <Icon name="arrow" size={11} />Move {b.files.length} to {b.dest.split("/").pop()}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Section>

      <Section title="Smart folder names" sub="Folder contents are analysed as a whole — music becomes a collection, invoices become records."
        right={<Chip color="var(--teal)"><Icon name="spark" size={11} />content-aware</Chip>}>
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3">
          {s.folders.map((f) => {
            const draft = editFolder[f.id] ?? f.suggested;
            return (
              <article key={f.id} className="inset p-3.5 rise" style={{ opacity: f.state === "rejected" ? 0.55 : 1 }}>
                <div className="flex items-center justify-between gap-2">
                  <Chip color={f.state === "approved" ? "var(--success)" : f.state === "rejected" ? "var(--faint)" : "var(--amber)"}>
                    {f.state === "pending" ? "awaiting approval" : f.state}
                  </Chip>
                  <span className="mono text-[10.5px]" style={{ color: "var(--muted)" }}>{Math.round(f.confidence * 100)}% · {f.files} files</span>
                </div>
                <div className="mono text-[11px] mt-2.5 truncate" style={{ color: "var(--faint)" }}>{shortPath(f.dir, s.settings.platform)}</div>
                <div className="flex items-center gap-2 mt-1.5">
                  <span className="text-[12.5px] line-through" style={{ color: "var(--faint)" }}>{f.current}</span>
                  <Icon name="arrow" size={13} />
                </div>
                <input className="field mt-2 text-[13px] font-semibold" value={draft} disabled={f.state !== "pending"}
                  onChange={(e) => setEditFolder((c) => ({ ...c, [f.id]: e.target.value }))} aria-label="Suggested folder name" />
                <p className="text-[11px] mt-2" style={{ color: "var(--muted)" }}>{f.reason}</p>
                {f.state === "pending" && (
                  <div className="flex gap-1.5 mt-2.5">
                    <button className="btn btn-xs btn-primary" onClick={() => api.decideFolder(f.id, "approved", draft)}><Icon name="check" size={11} />Approve name</button>
                    <button className="btn btn-xs" onClick={() => api.decideFolder(f.id, "rejected")}><Icon name="x" size={11} />Keep current</button>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      </Section>

      <Section title="Archive extraction" sub="Archives are opened read-only and extracted into a sandbox folder — the original archive is never modified.">
        <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-2.5">
          {archives.map((f) => (
            <div key={f.id} className="inset p-3 flex gap-2.5">
              <Thumb file={f} size={40} radius={8} />
              <div className="min-w-0 flex-1">
                <div className="text-[12px] truncate">{f.name}</div>
                <div className="mono text-[10px]" style={{ color: "var(--faint)" }}>{fmtBytes(f.size)} · {f.ext.toUpperCase()}</div>
                <button className="btn btn-xs mt-2" onClick={() => api.extractArchive(f.id)}><Icon name="archive" size={11} />Extract & organise</button>
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Approval
        open={!!ask}
        onClose={() => setAsk(null)}
        title={ask?.label ?? "Approve moves"}
        question="Move these files into the organised structure? Folders are created automatically if they do not exist."
        files={targets}
        note="Moves are atomic and journaled: the previous path is stored so Undo restores the exact original layout. Name collisions are resolved with a numeric suffix, never an overwrite."
        actions={[{ key: "move", label: "Approve moves", icon: "check", tone: "success", desc: "Create destination folders and move the files, with a snapshot first." }]}
        onAction={() => {
          api.moveFiles(ask!.ids, undefined, ask!.label);
          setSel([]);
          setAsk(null);
        }}
      />
    </div>
  );
}