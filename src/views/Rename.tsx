import { useEffect, useMemo, useState } from "react";
import { useApp } from "../state/store";
import { Chip, Empty, Icon, Metric, Modal, Section, Segmented, Slider, Thumb } from "../components/ui";
import { normalizeName, uniqueName } from "../lib/engine";
import { fmtBytes, renderPath } from "../lib/core";

type Scope = "all" | "screenshot" | "ai" | "photo";

export default function Rename() {
  const { s, d, api } = useApp();
  const [scope, setScope] = useState<Scope>("all");
  const [minConf, setMinConf] = useState(70);
  const [q, setQ] = useState("");
  const [limit, setLimit] = useState(24);
  const [sel, setSel] = useState<string[]>([]);
  const [batch, setBatch] = useState(false);
  const [openOcr, setOpenOcr] = useState<string | null>(null);

  // natural-language commands ("rename all screenshots") drive this scope
  useEffect(() => {
    if (s.filters.subject === "Screenshot") setScope("screenshot");
    else if (s.filters.query === "ai_art") setScope("ai");
  }, [s.filters.subject, s.filters.query]);

  const list = useMemo(() => {
    return d.renames.filter((f) => {
      const sg = f.suggestion!;
      if (sg.confidence * 100 < minConf) return false;
      if (scope === "screenshot" && !f.tags.includes("screenshot")) return false;
      if (scope === "ai" && !f.tags.includes("ai_art")) return false;
      if (scope === "photo" && (f.tags.includes("screenshot") || f.tags.includes("ai_art"))) return false;
      if (q && !(f.name.toLowerCase().includes(q.toLowerCase()) || sg.name.includes(q.toLowerCase()) || sg.subject.includes(q.toLowerCase()))) return false;
      return true;
    });
  }, [d.renames, scope, minConf, q]);

  const taken = useMemo(() => {
    const m = new Map<string, Set<string>>();
    d.live.forEach((f) => {
      const set = m.get(f.dir) ?? new Set<string>();
      set.add(f.name.toLowerCase());
      m.set(f.dir, set);
    });
    return m;
  }, [d.live]);

  const resolveName = (id: string) => {
    const f = d.byId.get(id)!;
    const draft = s.suggestionEdits[id] ?? f.suggestion?.name ?? f.name;
    const norm = normalizeName(draft, f.ext);
    const set = new Set(taken.get(f.dir) ?? []);
    set.delete(f.name.toLowerCase());
    return { norm, final: uniqueName(norm, set), edited: draft !== f.suggestion?.name };
  };

  const batchItems = (sel.length ? sel : list.map((f) => f.id)).map((id) => ({ id, name: resolveName(id).final }));
  const avgConf = list.length ? Math.round((list.reduce((a, f) => a + (f.suggestion?.confidence ?? 0), 0) / list.length) * 100) : 0;

  return (
    <div className="space-y-4">
      <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-3 stagger">
        <Metric label="Suggestions ready" value={d.renames.length} icon="wand" color="var(--blue)" sub="generated locally, awaiting approval" />
        <Metric label="Average confidence" value={avgConf} unit="%" icon="spark" color="var(--teal)" sub={`${s.settings.visionModel}`} />
        <Metric label="Screenshots (OCR)" value={d.renames.filter((f) => f.tags.includes("screenshot")).length} icon="image" color="var(--violet)" sub="PaddleOCR v4 headline extraction" />
        <Metric label="Already renamed" value={d.stats.renamedCount} icon="check" color="var(--lime)" sub="every rename is undoable" />
      </div>

      <Section title="Rename studio" sub="Descriptive names · lowercase · hyphenated · extension preserved · collisions auto-suffixed"
        right={
          <div className="flex flex-wrap gap-2 items-center">
            <Segmented value={scope} onChange={setScope} size="sm" options={[
              { value: "all", label: "All" }, { value: "screenshot", label: "Screenshots" }, { value: "ai", label: "AI art" }, { value: "photo", label: "Photos" },
            ]} />
            <button className="btn btn-sm" onClick={() => setSel(list.map((f) => f.id))}><Icon name="check" size={13} />Select all</button>
            <button className="btn btn-sm btn-primary" disabled={!list.length} onClick={() => setBatch(true)}>
              <Icon name="wand" size={13} />Approve {sel.length || list.length} renames
            </button>
          </div>
        }>
        <div className="grid lg:grid-cols-[1fr_260px_240px] gap-3 mb-4">
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--faint)" }}><Icon name="search" size={14} /></span>
            <input className="field pl-9" placeholder="Filter by current name, subject or suggestion…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <div className="inset px-3 py-1.5">
            <Slider label="Minimum confidence" value={minConf} min={50} max={99} suffix="%" onChange={setMinConf} />
          </div>
          <div className="inset p-2.5 flex flex-wrap gap-1.5 items-center">
            {["lowercase", "hyphens", "keep extension", "no collisions"].map((r) => (
              <Chip key={r} color="var(--success)"><Icon name="check" size={10} />{r}</Chip>
            ))}
          </div>
        </div>

        {sel.length > 0 && (
          <div className="inset p-2.5 mb-3 flex flex-wrap items-center gap-2 pop" style={{ borderColor: "color-mix(in srgb, var(--teal) 40%, transparent)" }}>
            <Icon name="check" size={14} />
            <span className="text-[12px] flex-1">{sel.length} selected for batch rename</span>
            <button className="btn btn-xs" onClick={() => { sel.forEach((id) => api.autoSuggest(id)); }}><Icon name="spark" size={11} />Regenerate all</button>
            <button className="btn btn-xs" onClick={() => { api.ignoreFiles(sel, "Rename suggestions dismissed"); setSel([]); }}><Icon name="eye" size={11} />Dismiss</button>
            <button className="btn btn-xs" onClick={() => setSel([])}>Clear</button>
            <button className="btn btn-xs btn-primary" onClick={() => setBatch(true)}>Preview batch<Icon name="arrow" size={11} /></button>
          </div>
        )}

        {list.length === 0 ? (
          <Empty icon="wand" title="No suggestions match this filter" sub="Lower the confidence threshold, or scan again after adding new images." />
        ) : (
          <>
            <div className="grid md:grid-cols-2 2xl:grid-cols-3 gap-3">
              {list.slice(0, limit).map((f) => {
                const sg = f.suggestion!;
                const { norm, final, edited } = resolveName(f.id);
                const collide = final !== norm;
                return (
                  <article key={f.id} className="inset p-3 rise" style={{ borderColor: sel.includes(f.id) ? "color-mix(in srgb, var(--teal) 45%, transparent)" : undefined }}>
                    <div className="flex gap-3">
                      <input type="checkbox" className="check mt-1" checked={sel.includes(f.id)}
                        onChange={() => setSel((c) => (c.includes(f.id) ? c.filter((x) => x !== f.id) : [...c, f.id]))} aria-label={`Select ${f.name}`} />
                      <button className="flex-none relative" onClick={() => api.openDrawer(f.id)}>
                        <Thumb file={f} size={78} radius={10} />
                        <span className="absolute -bottom-1 -right-1 chip chip-solid" style={{ ["--c" as string]: "var(--blue)", height: 18, fontSize: 9.5 }}>{Math.round(sg.confidence * 100)}%</span>
                      </button>
                      <div className="min-w-0 flex-1">
                        <div className="mono text-[11px] truncate" style={{ color: "var(--faint)" }} title={f.name}>{f.name}</div>
                        <div className="flex items-center gap-1.5 my-1" style={{ color: "var(--teal)" }}><Icon name="arrow" size={12} /></div>
                        <input className="field mono !h-8 text-[11.5px]" value={s.suggestionEdits[f.id] ?? sg.name}
                          onChange={(e) => api.setSuggestion(f.id, e.target.value)} aria-label="Suggested filename" />
                        <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                          {collide && <Chip color="var(--amber)">→ {final}</Chip>}
                          {edited && <Chip color="var(--blue)">edited</Chip>}
                          <Chip color="var(--violet)">{sg.model.split(" ")[0]}</Chip>
                          <span className="mono text-[10px]" style={{ color: "var(--faint)" }}>{fmtBytes(f.size)}</span>
                        </div>
                      </div>
                    </div>
                    <p className="text-[11px] mt-2.5" style={{ color: "var(--muted)" }}>{sg.reason}</p>
                    {sg.ocr && (
                      <div className="mt-2">
                        <button className="btn btn-xs" onClick={() => setOpenOcr(openOcr === f.id ? null : f.id)}>
                          <Icon name="eye" size={11} />{openOcr === f.id ? "Hide" : "Show"} OCR text
                        </button>
                        {openOcr === f.id && (
                          <pre className="inset mt-1.5 p-2 mono text-[10.5px] whitespace-pre-wrap scroll" style={{ color: "var(--muted)", maxHeight: 110 }}>{sg.ocr}</pre>
                        )}
                      </div>
                    )}
                    <div className="flex flex-wrap gap-1.5 mt-2.5">
                      <button className="btn btn-xs btn-primary" onClick={() => api.renameFiles([{ id: f.id, name: final }])}><Icon name="check" size={11} />Approve</button>
                      <button className="btn btn-xs" onClick={() => api.autoSuggest(f.id)}><Icon name="spark" size={11} />Regenerate</button>
                      <button className="btn btn-xs" onClick={() => api.ignoreFiles([f.id], "Rename suggestion dismissed")}><Icon name="x" size={11} />Skip</button>
                    </div>
                  </article>
                );
              })}
            </div>
            {limit < list.length && (
              <div className="flex justify-center mt-4">
                <button className="btn" onClick={() => setLimit((l) => l + 24)}>Show {Math.min(24, list.length - limit)} more of {list.length}</button>
              </div>
            )}
          </>
        )}
      </Section>

      <Modal open={batch} onClose={() => setBatch(false)} title={`Approve ${batchItems.length} renames`} width={720}
        sub="Originals are never overwritten — each rename is journaled with its previous name and can be undone."
        footer={
          <>
            <span className="mr-auto text-[11px] flex items-center gap-1.5" style={{ color: "var(--faint)" }}><Icon name="shield" size={13} />Snapshot + undo entry created</span>
            <button className="btn" onClick={() => setBatch(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={() => { api.renameFiles(batchItems); setBatch(false); setSel([]); }}>
              <Icon name="check" size={14} />Apply {batchItems.length} renames
            </button>
          </>
        }>
        <div className="inset scroll overflow-y-auto" style={{ maxHeight: 380 }}>
          <table className="w-full text-[11.5px]">
            <thead>
              <tr className="label" style={{ background: "color-mix(in srgb, var(--text) 5%, transparent)" }}>
                <th className="text-left p-2 font-bold">Before</th>
                <th className="text-left p-2 font-bold">After</th>
                <th className="text-left p-2 font-bold hidden sm:table-cell">Location</th>
              </tr>
            </thead>
            <tbody>
              {batchItems.map(({ id, name }) => {
                const f = d.byId.get(id)!;
                return (
                  <tr key={id} style={{ borderTop: "1px solid var(--line)" }}>
                    <td className="p-2 mono" style={{ color: "var(--faint)" }}>{f.name}</td>
                    <td className="p-2 mono" style={{ color: "var(--teal)" }}>{name}</td>
                    <td className="p-2 mono hidden sm:table-cell truncate max-w-[220px]" style={{ color: "var(--muted)" }}>{renderPath(f.dir, s.settings.platform)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Modal>
    </div>
  );
}