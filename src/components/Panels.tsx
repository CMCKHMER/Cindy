import { useMemo, useState } from "react";
import { useApp } from "../state/store";
import { Chip, Icon, Modal, Thumb, StatusChip, Empty } from "./ui";
import { KIND_META, fmtBytes, fmtDate, relTime, renderPath } from "../lib/core";
import { normalizeName, uniqueName } from "../lib/engine";

export interface ApprovalAction {
  key: string;
  label: string;
  icon: string;
  tone: "danger" | "warn" | "info" | "success";
  desc: string;
  disabled?: boolean;
}

const TONE: Record<string, string> = { danger: "var(--danger)", warn: "var(--warning)", info: "var(--blue)", success: "var(--success)" };

export function Approval({
  open, onClose, title, question, files, actions, onAction, note,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  question: string;
  files: { id: string; name: string; dir: string; size: number; modified: number }[];
  actions: ApprovalAction[];
  onAction: (key: string) => void;
  note?: string;
}) {
  const { s, d } = useApp();
  const bytes = files.reduce((a, b) => a + b.size, 0);
  return (
    <Modal open={open} onClose={onClose} title={title} sub={question} width={660} tone="var(--amber)"
      footer={
        <>
          <span className="mr-auto text-[11px] flex items-center gap-1.5" style={{ color: "var(--faint)" }}>
            <Icon name="shield" size={13} />
            {s.settings.backups ? `Snapshot will be written to .sasha/backups before applying` : "Backups are disabled in settings"}
          </span>
          <button className="btn" onClick={onClose}>Cancel</button>
          {actions.map((a) => (
            <button key={a.key} className={`btn ${a.tone === "danger" ? "btn-danger" : a.tone === "warn" ? "btn-warn" : a.key === actions[actions.length - 1]?.key ? "btn-primary" : ""}`}
              disabled={a.disabled} title={a.desc} onClick={() => onAction(a.key)}>
              <Icon name={a.icon} size={14} />{a.label}
            </button>
          ))}
        </>
      }>
      <div className="grid sm:grid-cols-3 gap-2 mb-3">
        {[
          { k: "Items", v: String(files.length) },
          { k: "Total size", v: fmtBytes(bytes) },
          { k: "Reversible", v: "Yes · undo history" },
        ].map((x) => (
          <div key={x.k} className="inset p-2.5">
            <div className="label">{x.k}</div>
            <div className="mono text-[13px] mt-1" style={{ color: "var(--teal)" }}>{x.v}</div>
          </div>
        ))}
      </div>
      <div className="inset scroll overflow-y-auto" style={{ maxHeight: 260 }}>
        {files.slice(0, 60).map((f) => {
          const rec = d.byId.get(f.id);
          return (
            <div key={f.id} className="flex items-center gap-2.5 px-2.5 py-2" style={{ borderBottom: "1px solid var(--line)" }}>
              {rec ? <Thumb file={rec} size={30} radius={6} /> : <span className="w-[30px] h-[30px] rounded-md" style={{ background: "var(--surface-2)" }} />}
              <div className="min-w-0 flex-1">
                <div className="text-[12.5px] truncate">{f.name}</div>
                <div className="mono text-[10.5px] truncate" style={{ color: "var(--faint)" }}>{renderPath(f.dir, s.settings.platform)}</div>
              </div>
              <span className="mono text-[11px]" style={{ color: "var(--muted)" }}>{fmtBytes(f.size)}</span>
            </div>
          );
        })}
        {files.length > 60 && <div className="p-2.5 text-[11.5px]" style={{ color: "var(--faint)" }}>+ {files.length - 60} more items in this batch</div>}
      </div>
      {note && (
        <div className="mt-3 p-3 rounded-[10px] text-[12px] flex gap-2.5" style={{ background: "color-mix(in srgb, var(--amber) 10%, transparent)", border: "1px solid color-mix(in srgb, var(--amber) 30%, transparent)", color: "var(--muted)" }}>
          <span style={{ color: "var(--amber)" }} className="mt-0.5"><Icon name="info" size={14} /></span>
          <span>{note}</span>
        </div>
      )}
      <div className="grid sm:grid-cols-2 gap-2 mt-3 mb-1">
        {actions.map((a) => (
          <div key={a.key} className="inset p-2.5 flex gap-2">
            <span style={{ color: TONE[a.tone] }} className="mt-0.5"><Icon name={a.icon} size={14} /></span>
            <div>
              <div className="text-[12px] font-semibold">{a.label}</div>
              <div className="text-[11px] mt-0.5" style={{ color: "var(--muted)" }}>{a.desc}</div>
            </div>
          </div>
        ))}
      </div>
    </Modal>
  );
}

export function FileDrawer() {
  const { s, d, api } = useApp();
  const f = s.drawer ? d.byId.get(s.drawer) : null;
  const [nameDraft, setNameDraft] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<null | "delete" | "archive">(null);

  const related = useMemo(() => (f ? d.groups.find((g) => g.fileIds.includes(f.id)) : null), [f, d.groups]);
  const history = useMemo(() => (f ? s.ops.filter((o) => o.patches.some((p) => p.id === f.id)).slice(-6).reverse() : []), [f, s.ops]);
  if (!f) return null;

  const taken = new Set(d.live.filter((x) => x.dir === f.dir && x.id !== f.id).map((x) => x.name.toLowerCase()));
  const suggested = s.suggestionEdits[f.id] ?? f.suggestion?.name ?? "";
  const draft = nameDraft ?? suggested;
  const normalized = draft ? normalizeName(draft, f.ext) : "";
  const finalName = normalized ? uniqueName(normalized, taken) : "";
  const meta = KIND_META[f.kind];

  return (
    <>
      <div className="fixed inset-0 z-[75] fadein" style={{ background: "var(--scrim)" }} onClick={() => api.openDrawer(null)}>
        <aside className="absolute right-0 top-0 h-full w-[min(96vw,470px)] slidein flex flex-col" style={{ background: "var(--surface)", borderLeft: "1px solid var(--line-strong)", boxShadow: "var(--shadow-lg)" }} onClick={(e) => e.stopPropagation()}>
          <header className="flex items-center gap-2.5 px-4 h-[60px] flex-none" style={{ borderBottom: "1px solid var(--line)" }}>
            <span className="w-7 h-7 rounded-lg grid place-items-center" style={{ background: `color-mix(in srgb, ${meta.color} 16%, transparent)`, color: meta.color }}>
              <Icon name="files" size={15} />
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-[13px] font-semibold truncate">{f.name}</div>
              <div className="mono text-[10.5px] truncate" style={{ color: "var(--faint)" }}>{renderPath(f.dir, s.settings.platform)}</div>
            </div>
            <button className="btn btn-ghost btn-icon btn-sm" onClick={() => api.openDrawer(null)} aria-label="Close details"><Icon name="x" size={16} /></button>
          </header>

          <div className="scroll flex-1 overflow-y-auto p-4 space-y-3.5">
            <div className="relative rounded-[12px] overflow-hidden" style={{ border: "1px solid var(--line)", aspectRatio: "16/10" }}>
              <Thumb file={f} size={999} radius={0} className="!w-full !h-full" />
              <div className="absolute left-2 bottom-2 flex gap-1.5 flex-wrap">
                <Chip color={meta.color} solid>{meta.label}</Chip>
                <StatusChip file={f} />
                {f.starred && <Chip color="var(--amber)"><Icon name="star" size={10} />kept</Chip>}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {[
                ["Size", fmtBytes(f.size)],
                ["Modified", `${fmtDate(f.modified)} · ${relTime(f.modified)}`],
                ["Created", fmtDate(f.created)],
                ["MIME", f.mime || "unknown"],
                ["Content signature", f.signature],
                ["Destination", f.dest ?? "—"],
              ].map(([k, v]) => (
                <div key={k} className="inset p-2.5 min-w-0">
                  <div className="label">{k}</div>
                  <div className="mono text-[11.5px] mt-1 truncate" title={String(v)}>{v}</div>
                </div>
              ))}
            </div>

            <div className="inset p-2.5">
              <div className="label mb-1">SHA-256</div>
              <div className="mono text-[10.5px] break-all" style={{ color: "var(--teal)" }}>{f.hash}</div>
              {f.phash && (
                <>
                  <div className="label mt-2 mb-1">Perceptual hash (64-bit)</div>
                  <div className="mono text-[10.5px]" style={{ color: "var(--magenta)" }}>{f.phash}</div>
                </>
              )}
            </div>

            {f.broken && (
              <div className="p-3 rounded-[11px]" style={{ background: "color-mix(in srgb, var(--danger) 10%, transparent)", border: "1px solid color-mix(in srgb, var(--danger) 32%, transparent)" }}>
                <div className="flex items-center gap-2 text-[12.5px] font-semibold" style={{ color: "var(--danger)" }}>
                  <Icon name="alert" size={14} />{f.broken.reason}
                </div>
                <p className="text-[11.5px] mt-1.5" style={{ color: "var(--muted)" }}>{f.broken.detail}</p>
                {f.broken.repairable && <p className="text-[11.5px] mt-1.5" style={{ color: "var(--success)" }}>Repair: {f.broken.repairMethod}</p>}
                <div className="flex gap-1.5 mt-2.5">
                  <button className="btn btn-xs" disabled={!f.broken.repairable} onClick={() => api.repairFiles([f.id])}><Icon name="wrench" size={11} />Repair</button>
                  <button className="btn btn-xs" onClick={() => setConfirm("archive")}><Icon name="archive" size={11} />Archive</button>
                  <button className="btn btn-xs btn-danger" onClick={() => setConfirm("delete")}><Icon name="trash" size={11} />Delete</button>
                </div>
              </div>
            )}

            {(f.suggestion || f.kind === "image") && (
              <div className="inset p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="label">AI name suggestion</span>
                  {f.suggestion && <Chip color="var(--teal)">{Math.round(f.suggestion.confidence * 100)}% confidence</Chip>}
                </div>
                <input className="field mono text-[12px]" value={draft} placeholder="descriptive-file-name.jpg" onChange={(e) => setNameDraft(e.target.value)} />
                <div className="flex items-center gap-2 mt-2 text-[11px]" style={{ color: "var(--muted)" }}>
                  <Icon name="arrow" size={12} />
                  <span className="mono truncate" style={{ color: finalName !== normalized ? "var(--amber)" : "var(--teal)" }}>{finalName || "—"}</span>
                  {finalName !== normalized && <Chip color="var(--amber)">collision avoided</Chip>}
                </div>
                {f.suggestion?.ocr && (
                  <div className="mt-2.5 p-2 rounded-lg text-[11px] mono" style={{ background: "color-mix(in srgb, var(--blue) 10%, transparent)", color: "var(--muted)" }}>
                    <span style={{ color: "var(--blue)" }}>OCR · </span>{f.suggestion.ocr}
                  </div>
                )}
                <div className="flex flex-wrap gap-1.5 mt-2.5">
                  <button className="btn btn-xs btn-primary" disabled={!finalName || finalName === f.name} onClick={() => { api.renameFiles([{ id: f.id, name: finalName }]); setNameDraft(null); }}>
                    <Icon name="check" size={11} />Approve rename
                  </button>
                  <button className="btn btn-xs" onClick={() => { api.autoSuggest(f.id); setNameDraft(null); }}><Icon name="spark" size={11} />Regenerate</button>
                  {f.suggestion && <Chip color="var(--violet)">{f.suggestion.model}</Chip>}
                </div>
              </div>
            )}

            {related && (
              <div className="inset p-3">
                <div className="label mb-2">Duplicate group · {related.kind} · {(related.similarity * 100).toFixed(1)}%</div>
                <div className="space-y-1.5">
                  {related.members.map((m) => (
                    <button key={m.id} className="w-full flex items-center gap-2 text-left" onClick={() => api.openDrawer(m.id)}>
                      <Thumb file={m} size={26} radius={5} />
                      <span className="text-[11.5px] truncate flex-1">{m.name}</span>
                      {m.id === related.keepId ? <Chip color="var(--success)">original</Chip> : <Chip color="var(--amber)">copy</Chip>}
                    </button>
                  ))}
                </div>
                <button className="btn btn-xs mt-2.5" onClick={() => { api.go("duplicates"); api.openDrawer(null); }}>Open in duplicate review<Icon name="arrow" size={11} /></button>
              </div>
            )}

            {history.length > 0 && (
              <div className="inset p-3">
                <div className="label mb-2">Operation timeline</div>
                <div className="space-y-2">
                  {history.map((o) => (
                    <div key={o.id} className="flex gap-2 text-[11.5px]">
                      <span className="dot mt-1.5" style={{ background: o.undone ? "var(--faint)" : "var(--teal)" }} />
                      <div className="min-w-0">
                        <div className={o.undone ? "line-through" : ""} style={{ color: o.undone ? "var(--faint)" : "var(--text)" }}>{o.label}</div>
                        <div className="mono text-[10px]" style={{ color: "var(--faint)" }}>{relTime(o.at)} · {o.backup}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex flex-wrap gap-1.5">
              <button className="btn btn-sm" onClick={() => api.moveFiles([f.id])}><Icon name="folder" size={13} />Move to {f.dest}</button>
              {(f.ext === "zip" || f.ext === "rar" || f.ext === "7z") && (
                <button className="btn btn-sm" onClick={() => api.extractArchive(f.id)}><Icon name="archive" size={13} />Extract & organise</button>
              )}
              <button className="btn btn-sm" onClick={() => setConfirm("archive")}><Icon name="archive" size={13} />Review folder</button>
              <button className="btn btn-sm" onClick={() => api.ignoreFiles([f.id], "Ignored from detail drawer")}><Icon name="eye" size={13} />Ignore</button>
              <button className="btn btn-sm btn-danger" onClick={() => setConfirm("delete")}><Icon name="trash" size={13} />Delete</button>
            </div>
          </div>
        </aside>
      </div>

      <Approval
        open={confirm !== null}
        onClose={() => setConfirm(null)}
        title={confirm === "delete" ? "Delete this file?" : "Move to Review folder?"}
        question={confirm === "delete"
          ? "This file appears damaged or unusable. Delete, Repair (if possible), Archive, or Ignore?"
          : "The file stays on disk inside .sasha/Review until you decide what to do with it."}
        files={[f]}
        note={confirm === "delete" ? `Sent to ${s.settings.platform === "windows" ? "the Recycle Bin" : "the Trash"} plus a Sasha Maid snapshot — never permanently erased.` : undefined}
        actions={confirm === "delete"
          ? [{ key: "delete", label: "Delete", icon: "trash", tone: "danger", desc: "Recoverable from Trash and from the Sasha Maid backup snapshot." }]
          : [{ key: "archive", label: "Archive", icon: "archive", tone: "warn", desc: "Move to .sasha/Review/<date> and keep the original path in the journal." }]}
        onAction={(k) => {
          if (k === "delete") api.deleteFiles([f.id], f.broken?.reason ?? "Manual delete from detail drawer");
          else api.archiveFiles([f.id], "Archived from detail drawer");
          setConfirm(null);
        }}
      />
    </>
  );
}

export function EmptyDrawer() {
  return <Empty title="Nothing selected" sub="Pick a file to inspect its metadata." />;
}

