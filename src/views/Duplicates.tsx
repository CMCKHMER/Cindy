import { useEffect, useMemo, useState } from "react";
import { useApp } from "../state/store";
import { Chip, Icon, Section, Segmented, Slider, Thumb, Empty, Metric } from "../components/ui";
import { Approval } from "../components/Panels";
import { fmtBytes, fmtDate, relTime, renderPath } from "../lib/core";

type KindFilter = "all" | "exact" | "near" | "visual";
const KIND_COLOR: Record<string, string> = { exact: "var(--magenta)", near: "var(--amber)", visual: "var(--violet)" };
const KIND_LABEL: Record<string, string> = { exact: "Exact · SHA-256", near: "Near · text similarity", visual: "Visual · pHash + CLIP" };

export default function Duplicates() {
  const { s, d, api } = useApp();
  const [filter, setFilter] = useState<KindFilter>("all");
  const [pending, setPending] = useState<{ ids: string[]; groupId?: string; action?: string } | null>(null);
  const [selected, setSelected] = useState<string[]>([]);

  // "find duplicate photos" narrows straight to the visual clusters
  useEffect(() => {
    if (s.filters.kind === "image") setFilter("visual");
  }, [s.filters.kind]);

  const groups = useMemo(
    () => d.groups.filter((g) => (filter === "all" || g.kind === filter) && !g.resolved),
    [d.groups, filter],
  );
  const resolved = d.groups.filter((g) => g.resolved);
  const pendingFiles = pending ? pending.ids.map((id) => d.byId.get(id)!).filter(Boolean) : [];

  const ask = (ids: string[], groupId?: string) => setPending({ ids, groupId });

  const runAction = (key: string) => {
    if (!pending) return;
    const { ids, groupId } = pending;
    if (groupId) {
      api.resolveGroup(groupId, key as "delete" | "keep" | "review" | "ignore");
    } else if (key === "delete") api.deleteFiles(ids, "Bulk duplicate removal approved");
    else if (key === "review") api.archiveFiles(ids, "Duplicates moved to Review folder");
    else if (key === "ignore") api.ignoreFiles(ids, "Duplicate groups ignored by user");
    else api.keepFiles(ids, "User chose to keep every copy");
    setSelected([]);
    setPending(null);
  };

  return (
    <div className="space-y-4">
      <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-3 stagger">
        <Metric label="Open groups" value={groups.length} icon="copy" color="var(--magenta)" sub={`${d.groups.reduce((a, g) => a + g.members.length, 0)} files involved`} />
        <Metric label="Reclaimable" value={d.stats.dupReclaim} unit="bytes" icon="spark" color="var(--lime)" sub="only with your approval" />
        <Metric label="Exact matches" value={d.groups.filter((g) => g.kind === "exact").length} icon="check" color="var(--teal)" sub="byte-identical SHA-256" />
        <Metric label="Visual matches" value={d.groups.filter((g) => g.kind === "visual").length} icon="image" color="var(--violet)" sub={`pHash ≥ ${s.settings.similarity}% similarity`} />
      </div>

      <Section
        title="Duplicate review"
        sub="These files appear duplicated. Delete, Keep, Move to Review Folder, or Ignore?"
        right={
          <div className="flex flex-wrap items-center gap-2">
            <Segmented value={filter} onChange={setFilter} size="sm"
              options={[{ value: "all", label: "All" }, { value: "exact", label: "Exact" }, { value: "near", label: "Near" }, { value: "visual", label: "Visual" }]} />
            <button className="btn btn-sm" onClick={api.redetect}><Icon name="spark" size={13} />Re-run detection</button>
          </div>
        }
      >
        <div className="grid md:grid-cols-3 gap-3 mb-4">
          <div className="inset p-3">
            <Slider label="Visual similarity threshold" value={s.settings.similarity} min={80} max={99} suffix="%" onChange={(v) => api.setSetting("similarity", v)} />
            <p className="text-[10.5px] mt-1" style={{ color: "var(--faint)" }}>Lower finds more resized/re-encoded copies. Re-run detection to apply.</p>
          </div>
          <div className="inset p-3">
            <Slider label="Near-text threshold" value={s.settings.nearThreshold} min={70} max={99} suffix="%" onChange={(v) => api.setSetting("nearThreshold", v)} />
            <p className="text-[10.5px] mt-1" style={{ color: "var(--faint)" }}>MinHash shingle overlap on extracted document text.</p>
          </div>
          <div className="inset p-3 flex flex-col justify-between">
            <div className="text-[11.5px]" style={{ color: "var(--muted)" }}>
              <Icon name="shield" size={12} /> Sasha Maid never deletes automatically. Every choice below is previewed, backed up and undoable.
            </div>
            <div className="flex gap-1.5 mt-2">
              <Chip color="var(--success)">backups on</Chip>
              <Chip color="var(--blue)">undo journal</Chip>
            </div>
          </div>
        </div>

        {selected.length > 0 && (
          <div className="inset p-2.5 mb-3 flex flex-wrap items-center gap-2 pop" style={{ borderColor: "color-mix(in srgb, var(--teal) 40%, transparent)" }}>
            <Icon name="check" size={14} />
            <span className="text-[12px] flex-1">{selected.length} group{selected.length > 1 ? "s" : ""} selected · {fmtBytes(d.groups.filter((g) => selected.includes(g.id)).reduce((a, g) => a + g.reclaimable, 0))} reclaimable</span>
            <button className="btn btn-xs" onClick={() => setSelected([])}>Clear</button>
            <button className="btn btn-xs btn-primary" onClick={() => ask(d.groups.filter((g) => selected.includes(g.id)).flatMap((g) => g.members.filter((m) => m.id !== g.keepId).map((m) => m.id)))}>
              Resolve selected<Icon name="arrow" size={11} />
            </button>
          </div>
        )}

        {groups.length === 0 ? (
          <Empty icon="check" title="No duplicate groups in this view" sub="Everything here has been resolved or filtered out. Re-run detection after new files arrive." action={<button className="btn btn-sm" onClick={api.redetect}><Icon name="spark" size={13} />Re-run detection</button>} />
        ) : (
          <div className="space-y-3">
            {groups.map((g) => {
              const keep = g.members.find((m) => m.id === g.keepId)!;
              const others = g.members.filter((m) => m.id !== g.keepId);
              return (
                <article key={g.id} className="inset overflow-hidden rise" style={{ borderColor: `color-mix(in srgb, ${KIND_COLOR[g.kind]} 28%, var(--line))` }}>
                  <header className="flex flex-wrap items-center gap-3 p-3" style={{ background: `color-mix(in srgb, ${KIND_COLOR[g.kind]} 8%, transparent)`, borderBottom: "1px solid var(--line)" }}>
                    <input type="checkbox" className="check" checked={selected.includes(g.id)}
                      onChange={() => setSelected((cur) => (cur.includes(g.id) ? cur.filter((x) => x !== g.id) : [...cur, g.id]))} aria-label="Select group" />
                    <Chip color={KIND_COLOR[g.kind]} solid>{KIND_LABEL[g.kind]}</Chip>
                    <div className="flex items-center gap-2 min-w-[140px]">
                      <div className="h-1.5 w-20 rounded-full overflow-hidden" style={{ background: "color-mix(in srgb, var(--text) 12%, transparent)" }}>
                        <div className="h-full rounded-full" style={{ width: `${g.similarity * 100}%`, background: KIND_COLOR[g.kind] }} />
                      </div>
                      <span className="mono text-[11.5px]" style={{ color: KIND_COLOR[g.kind] }}>{(g.similarity * 100).toFixed(1)}%</span>
                    </div>
                    <span className="text-[11.5px] flex-1 min-w-[160px]" style={{ color: "var(--muted)" }}>{g.reason}</span>
                    <Chip color="var(--lime)">{fmtBytes(g.reclaimable)} reclaimable</Chip>
                  </header>

                  {g.kind === "visual" && (
                    <div className="p-3 flex gap-3 overflow-x-auto scrollx" style={{ borderBottom: "1px solid var(--line)", background: "color-mix(in srgb, var(--ink) 30%, transparent)" }}>
                      {g.members.map((m) => (
                        <figure key={m.id} className="relative flex-none rounded-[10px] overflow-hidden" style={{ width: 208, border: `1px solid ${m.id === g.keepId ? "var(--success)" : "var(--line-strong)"}` }}>
                          <button className="block w-full" onClick={() => api.openDrawer(m.id)} style={{ aspectRatio: "16/10" }}>
                            <Thumb file={m} size={420} radius={0} className="!w-full !h-full" />
                          </button>
                          <figcaption className="absolute inset-x-0 bottom-0 px-2 py-1.5 flex items-center gap-1.5" style={{ background: "linear-gradient(0deg, rgba(4,7,13,.92), transparent)" }}>
                            <span className="mono text-[10px] truncate flex-1" style={{ color: "#e9eeff" }}>{m.name}</span>
                            <span className="chip" style={{ ["--c" as string]: m.id === g.keepId ? "var(--success)" : "var(--amber)", height: 17, fontSize: 9 }}>
                              {m.id === g.keepId ? "keep" : fmtBytes(m.size)}
                            </span>
                          </figcaption>
                        </figure>
                      ))}
                      <div className="flex-none self-center text-[11px] max-w-[190px]" style={{ color: "var(--muted)" }}>
                        <div className="label mb-1">Vision verdict</div>
                        Same scene, different encode. pHash distance{" "}
                        <span className="mono" style={{ color: "var(--violet)" }}>{Math.round((1 - g.similarity) * 64)} bits</span>, CLIP cosine{" "}
                        <span className="mono" style={{ color: "var(--violet)" }}>{g.similarity.toFixed(3)}</span>. The largest file is proposed as the original.
                      </div>
                    </div>
                  )}

                  <div className="divide-y" style={{ borderColor: "var(--line)" }}>
                    {g.members.map((m) => {
                      const isKeep = m.id === g.keepId;
                      return (
                        <div key={m.id} className="flex flex-wrap items-center gap-3 p-3 row" style={{ borderBottom: "1px solid var(--line)" }}>
                          <label className="flex items-center gap-2 cursor-pointer" title="Choose the original to keep">
                            <input type="radio" className="check radio" name={`keep-${g.id}`} checked={isKeep} onChange={() => api.setKeep(g.id, m.id)} />
                          </label>
                          <button onClick={() => api.openDrawer(m.id)} className="flex-none"><Thumb file={m} size={52} radius={9} /></button>
                          <div className="min-w-[180px] flex-1">
                            <button className="text-[13px] font-medium truncate max-w-full text-left hover:underline" onClick={() => api.openDrawer(m.id)}>{m.name}</button>
                            <div className="mono text-[10.5px] truncate" style={{ color: "var(--faint)" }}>{renderPath(m.dir, s.settings.platform)}</div>
                          </div>
                          <div className="text-[11px] w-[86px]">
                            <div className="mono">{fmtBytes(m.size)}</div>
                            <div style={{ color: "var(--faint)" }}>{m.size === keep.size ? "same size" : `${fmtBytes(Math.abs(m.size - keep.size))} diff`}</div>
                          </div>
                          <div className="text-[11px] w-[112px]">
                            <div>{fmtDate(m.modified)}</div>
                            <div style={{ color: "var(--faint)" }}>{relTime(m.modified)}</div>
                          </div>
                          <div className="w-[96px] flex justify-end">
                            {isKeep ? <Chip color="var(--success)"><Icon name="star" size={10} />original</Chip> : <Chip color="var(--amber)">duplicate</Chip>}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <footer className="flex flex-wrap items-center gap-2 p-3" style={{ borderTop: "1px solid var(--line)" }}>
                    <span className="text-[11.5px] mr-auto" style={{ color: "var(--muted)" }}>
                      Keep <span className="mono" style={{ color: "var(--teal)" }}>{keep.name}</span> · {others.length} cop{others.length === 1 ? "y" : "ies"} pending
                    </span>
                    <button className="btn btn-xs" onClick={() => api.resolveGroup(g.id, "keep")}>
                      <Icon name="star" size={11} />Keep all
                    </button>
                    <button className="btn btn-xs" onClick={() => api.resolveGroup(g.id, "ignore")}>
                      <Icon name="eye" size={11} />Ignore
                    </button>
                    <button className="btn btn-xs btn-warn" onClick={() => ask(others.map((m) => m.id), g.id)}>
                      <Icon name="archive" size={11} />Move to Review
                    </button>
                    <button className="btn btn-xs btn-danger" onClick={() => ask(others.map((m) => m.id), g.id)}>
                      <Icon name="trash" size={11} />Delete duplicates
                    </button>
                  </footer>
                </article>
              );
            })}
          </div>
        )}
      </Section>

      {resolved.length > 0 && (
        <Section title="Resolved groups" sub="Still reversible from the undo journal">
          <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-2.5">
            {resolved.map((g) => (
              <div key={g.id} className="inset p-3 flex items-center gap-2.5">
                <Thumb file={g.members[0]} size={34} radius={7} />
                <div className="min-w-0 flex-1">
                  <div className="text-[12px] truncate">{g.members[0]?.name}</div>
                  <div className="text-[10.5px]" style={{ color: "var(--faint)" }}>{g.members.length} files · {g.kind}</div>
                </div>
                <Chip color={g.resolved === "delete" ? "var(--danger)" : g.resolved === "review" ? "var(--amber)" : g.resolved === "ignore" ? "var(--faint)" : "var(--success)"}>{g.resolved}</Chip>
              </div>
            ))}
          </div>
        </Section>
      )}

      <Approval
        open={!!pending}
        onClose={() => setPending(null)}
        title="These files appear duplicated."
        question="Delete, Keep, Move to Review Folder, or Ignore?"
        files={pendingFiles}
        note="The original you selected is never touched. Deletions go to the system Trash plus a Sasha Maid snapshot, so this is reversible from Undo history."
        actions={[
          { key: "keep", label: "Keep", icon: "star", tone: "success", desc: "Leave every copy on disk and stop suggesting this group." },
          { key: "ignore", label: "Ignore", icon: "eye", tone: "info", desc: "Hide the group from future scans without changing files." },
          { key: "review", label: "Move to Review", icon: "archive", tone: "warn", desc: "Relocate copies to .sasha/Review/<date> for a later decision." },
          { key: "delete", label: "Delete", icon: "trash", tone: "danger", desc: "Send copies to Trash with a backup snapshot and an undo entry." },
        ]}
        onAction={runAction}
      />
    </div>
  );
}