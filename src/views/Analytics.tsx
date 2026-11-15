import { useEffect, useMemo, useState } from "react";
import { useApp } from "../state/store";
import { AreaChart, BarRow, Chip, Donut, Empty, Icon, Metric, Section, Slider, Thumb, VirtualList } from "../components/ui";
import { Approval } from "../components/Panels";
import { KIND_META, fmtBytes, fmtDate, relTime, renderPath } from "../lib/core";
import { storageHistory } from "../data/seed";

function Treemap({ items, onPick }: { items: { id: string; name: string; size: number; color: string; kind: string }[]; onPick: (id: string) => void }) {
  // simple squarified-ish row packing
  const total = items.reduce((a, b) => a + b.size, 0) || 1;
  const rows: (typeof items)[] = [];
  let cur: typeof items = [];
  let curSum = 0;
  const target = total / 4;
  items.forEach((it) => {
    cur.push(it);
    curSum += it.size;
    if (curSum >= target) {
      rows.push(cur);
      cur = [];
      curSum = 0;
    }
  });
  if (cur.length) rows.push(cur);
  const [hover, setHover] = useState<string | null>(null);
  return (
    <div className="flex flex-col gap-1" style={{ height: 260 }}>
      {rows.map((row, i) => {
        const rowSum = row.reduce((a, b) => a + b.size, 0);
        return (
          <div key={i} className="flex gap-1 min-h-0" style={{ flex: rowSum / total }}>
            {row.map((it) => (
              <button key={it.id} onMouseEnter={() => setHover(it.id)} onMouseLeave={() => setHover(null)} onClick={() => onPick(it.id)}
                className="relative overflow-hidden rounded-[7px] text-left transition-all min-w-0"
                style={{
                  flex: it.size / rowSum,
                  background: `linear-gradient(140deg, color-mix(in srgb, ${it.color} ${hover === it.id ? 70 : 42}%, var(--surface)), color-mix(in srgb, ${it.color} 16%, var(--surface)))`,
                  border: `1px solid color-mix(in srgb, ${it.color} 45%, transparent)`,
                  transform: hover === it.id ? "scale(1.012)" : undefined,
                }}
                title={`${it.name} · ${fmtBytes(it.size)}`}>
                <span className="absolute inset-x-1.5 top-1.5 text-[10.5px] font-medium truncate">{it.name}</span>
                <span className="absolute inset-x-1.5 bottom-1.5 mono text-[9.5px]" style={{ color: "var(--muted)" }}>{fmtBytes(it.size)}</span>
              </button>
            ))}
          </div>
        );
      })}
    </div>
  );
}

export default function Analytics() {
  const { s, d, api } = useApp();
  const [minGb, setMinGb] = useState(1);
  const [ageMonths, setAgeMonths] = useState(12);
  const [ask, setAsk] = useState<{ ids: string[]; kind: "delete" | "archive" } | null>(null);
  const [sel, setSel] = useState<string[]>([]);

  // commands like “show files larger than 1GB” / “old files I haven't touched” land here
  useEffect(() => {
    if (s.filters.minSize > 0) setMinGb(Math.max(0.1, Math.round((s.filters.minSize / 1024 ** 3) * 10) / 10));
  }, [s.filters.minSize]);
  useEffect(() => {
    if (s.filters.olderThanDays > 0) setAgeMonths(Math.max(3, Math.round(s.filters.olderThanDays / 30)));
  }, [s.filters.olderThanDays]);

  const large = useMemo(() => d.live.filter((f) => f.size >= minGb * 1024 ** 3).sort((a, b) => b.size - a.size), [d.live, minGb]);
  const old = useMemo(() => d.live.filter((f) => Date.now() - f.modified > ageMonths * 30 * 86400000).sort((a, b) => b.size - a.size), [d.live, ageMonths]);
  const treemapItems = useMemo(
    () => [...d.live].sort((a, b) => b.size - a.size).slice(0, 22).map((f) => ({ id: f.id, name: f.name, size: f.size, color: KIND_META[f.kind].color, kind: f.kind })),
    [d.live],
  );
  const donut = d.stats.byKind.map((k) => ({ label: KIND_META[k.kind].label, value: k.bytes, color: KIND_META[k.kind].color }));
  const maxRoot = Math.max(...d.stats.byRoot.map((r) => r.bytes), 1);
  const oldest = d.stats.old[0];
  const targets = (ask?.ids ?? []).map((id) => d.byId.get(id)!).filter(Boolean);

  const reclaim = [
    { label: "Duplicate copies", bytes: d.stats.dupReclaim, color: "var(--magenta)", view: "duplicates" },
    { label: "Damaged & partial", bytes: d.stats.brokenBytes, color: "var(--danger)", view: "broken" },
    { label: "Stale installers", bytes: d.live.filter((f) => f.kind === "installer" && Date.now() - f.modified > 180 * 86400000).reduce((a, b) => a + b.size, 0), color: "var(--orange)", view: "explorer" },
    { label: "Already reclaimed", bytes: d.stats.savedBytes, color: "var(--lime)", view: "history" },
  ];

  return (
    <div className="space-y-4">
      <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-3 stagger">
        <Metric label="Indexed volume" value={d.stats.totalBytes} unit="bytes" icon="chart" color="var(--blue)" sub={`${d.stats.fileCount.toLocaleString()} live files`} spark={storageHistory.map((h) => h.gb)} />
        <Metric label="Reclaimable now" value={d.stats.dupReclaim + d.stats.brokenBytes} unit="bytes" icon="spark" color="var(--magenta)" sub="approval required" />
        <Metric label="Largest file" value={d.stats.large[0]?.size ?? 0} unit="bytes" icon="bolt" color="var(--amber)" sub={d.stats.large[0]?.name ?? "—"} />
        <Metric label="Oldest untouched" value={oldest ? Math.round((Date.now() - oldest.modified) / 86400000) : 0} unit="days" icon="clock" color="var(--violet)" sub={oldest?.name ?? "—"} />
      </div>

      <div className="grid xl:grid-cols-[1fr_1fr] gap-4">
        <Section title="Category split" sub="Content signature + extension + metadata">
          <Donut data={donut} size={200} />
        </Section>
        <Section title="12-month storage trend" sub="Pink bars are gigabytes reclaimed by approved cleanups">
          <AreaChart data={storageHistory} height={190} />
          <div className="grid grid-cols-3 gap-2 mt-2">
            {[
              ["Growth", `+${(storageHistory[11].gb - storageHistory[0].gb).toFixed(1)} GB`, "var(--blue)"],
              ["Reclaimed", `${storageHistory.reduce((a, b) => a + b.reclaimed, 0).toFixed(1)} GB`, "var(--magenta)"],
              ["Peak month", storageHistory.reduce((a, b) => (b.gb > a.gb ? b : a)).month, "var(--teal)"],
            ].map(([k, v, c]) => (
              <div key={k} className="inset p-2.5">
                <div className="label">{k}</div>
                <div className="mono text-[13px] mt-1" style={{ color: c }}>{v}</div>
              </div>
            ))}
          </div>
        </Section>
      </div>

      <div className="grid xl:grid-cols-[1.25fr_1fr] gap-4">
        <Section title="Space treemap" sub="The 22 largest files — click any tile to inspect it">
          <Treemap items={treemapItems} onPick={api.openDrawer} />
          <div className="flex flex-wrap gap-1.5 mt-3">
            {d.stats.byKind.map((k) => (
              <Chip key={k.kind} color={KIND_META[k.kind].color}>{KIND_META[k.kind].label} · {fmtBytes(k.bytes)}</Chip>
            ))}
          </div>
        </Section>
        <Section title="Where it lives" sub="Per-root volume, click to filter the explorer">
          <div className="space-y-2.5">
            {d.stats.byRoot.map((r, i) => (
              <BarRow key={r.id} label={`${r.label} · ${r.count.toLocaleString()} files`} value={r.bytes} max={maxRoot}
                color={[KIND_META.image.color, KIND_META.video.color, KIND_META.archive.color, KIND_META.document.color, KIND_META.music.color, KIND_META.code.color, KIND_META.installer.color, KIND_META.other.color][i % 8]}
                onClick={() => { api.setFilters({ root: r.id }); api.go("explorer"); }} />
            ))}
          </div>
          <div className="mt-4 pt-3.5 space-y-2" style={{ borderTop: "1px solid var(--line)" }}>
            <div className="label mb-1">Reclaim opportunities</div>
            {reclaim.map((r) => (
              <button key={r.label} className="w-full flex items-center gap-2.5 text-left inset p-2.5" onClick={() => api.go(r.view)}>
                <span className="dot" style={{ background: r.color }} />
                <span className="text-[12px] flex-1">{r.label}</span>
                <span className="mono text-[11.5px]" style={{ color: r.color }}>{fmtBytes(r.bytes)}</span>
                <Icon name="arrow" size={12} />
              </button>
            ))}
          </div>
        </Section>
      </div>

      <Section title="Large file finder" sub={`Files at or above ${minGb} GB — natural language works too: “show files larger than 1GB”`}
        right={<div className="w-[220px]"><Slider value={minGb} min={0.1} max={8} step={0.1} suffix=" GB" onChange={setMinGb} /></div>}>
        <div className="flex flex-wrap items-center gap-2 mb-2.5">
          <Chip color="var(--amber)">{large.length} files · {fmtBytes(large.reduce((a, b) => a + b.size, 0))}</Chip>
          {sel.length > 0 && (
            <>
              <Chip color="var(--teal)">{sel.length} selected</Chip>
              <button className="btn btn-xs" onClick={() => setAsk({ ids: sel, kind: "archive" })}><Icon name="archive" size={11} />Archive</button>
              <button className="btn btn-xs btn-danger" onClick={() => setAsk({ ids: sel, kind: "delete" })}><Icon name="trash" size={11} />Delete</button>
              <button className="btn btn-xs" onClick={() => setSel([])}>Clear</button>
            </>
          )}
          {s.filters.minSize > 0 && <Chip color="var(--blue)">filter from command: ≥ {fmtBytes(s.filters.minSize)}</Chip>}
        </div>
        {large.length === 0 ? (
          <Empty icon="check" title="Nothing that large" sub="Lower the threshold to inspect smaller files." />
        ) : (
          <div className="inset overflow-hidden">
            <VirtualList
              items={large.slice(0, 400)}
              rowHeight={54}
              height={Math.min(380, Math.max(120, large.length * 54))}
              render={(f) => (
                <div className="row px-2.5" style={{ gridTemplateColumns: "22px 40px minmax(0,1fr) 92px 108px 92px", height: 54 }} data-selected={sel.includes(f.id)}>
                  <input type="checkbox" className="check" checked={sel.includes(f.id)}
                    onChange={() => setSel((c) => (c.includes(f.id) ? c.filter((x) => x !== f.id) : [...c, f.id]))} aria-label={`Select ${f.name}`} />
                  <button onClick={() => api.openDrawer(f.id)}><Thumb file={f} size={34} radius={7} /></button>
                  <button className="min-w-0 text-left" onClick={() => api.openDrawer(f.id)}>
                    <div className="text-[12.5px] truncate">{f.name}</div>
                    <div className="mono text-[10px] truncate" style={{ color: "var(--faint)" }}>{renderPath(f.dir, s.settings.platform)}</div>
                  </button>
                  <span className="mono text-[11.5px]" style={{ color: "var(--amber)" }}>{fmtBytes(f.size)}</span>
                  <span className="text-[11px]" style={{ color: "var(--muted)" }}>{fmtDate(f.modified)}</span>
                  <Chip color={KIND_META[f.kind].color}>{KIND_META[f.kind].short}</Chip>
                </div>
              )}
            />
          </div>
        )}
      </Section>

      <Section title="Old file cleanup" sub={`Untouched for ${ageMonths} months — archive first, delete only if you are sure`}
        right={<div className="w-[220px]"><Slider value={ageMonths} min={3} max={36} suffix=" months" onChange={setAgeMonths} /></div>}>
        <div className="flex flex-wrap items-center gap-2 mb-2.5">
          <Chip color="var(--violet)">{old.length} files · {fmtBytes(old.reduce((a, b) => a + b.size, 0))}</Chip>
          <button className="btn btn-xs" disabled={!old.length} onClick={() => setAsk({ ids: old.slice(0, 200).map((f) => f.id), kind: "archive" })}>
            <Icon name="archive" size={11} />Archive oldest {Math.min(200, old.length)}
          </button>
          <button className="btn btn-xs" onClick={() => { api.setFilters({ olderThanDays: ageMonths * 30 }); api.go("explorer"); }}>Open in explorer<Icon name="arrow" size={11} /></button>
        </div>
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-2">
          {old.slice(0, 9).map((f) => (
            <button key={f.id} className="inset p-2.5 flex items-center gap-2.5 text-left" onClick={() => api.openDrawer(f.id)}>
              <Thumb file={f} size={34} radius={7} />
              <div className="min-w-0 flex-1">
                <div className="text-[12px] truncate">{f.name}</div>
                <div className="mono text-[10px]" style={{ color: "var(--faint)" }}>{relTime(f.modified)} · {fmtBytes(f.size)}</div>
              </div>
            </button>
          ))}
        </div>
      </Section>

      <Approval
        open={!!ask}
        onClose={() => setAsk(null)}
        title={ask?.kind === "delete" ? "Delete large files?" : "Archive to Review folder?"}
        question={ask?.kind === "delete"
          ? "These files appear unused. Delete, Keep, Move to Review Folder, or Ignore?"
          : "Files move to .sasha/Review/<date> and keep their original path in the journal."}
        files={targets}
        actions={ask?.kind === "delete"
          ? [{ key: "delete", label: "Delete", icon: "trash", tone: "danger", desc: "Trash + snapshot, fully reversible." }]
          : [{ key: "archive", label: "Archive", icon: "archive", tone: "warn", desc: "Relocate without deleting anything." }]}
        onAction={(k) => {
          if (k === "delete") api.deleteFiles(ask!.ids, "Large file cleanup approved");
          else api.archiveFiles(ask!.ids, "Old / large files archived for review");
          setSel([]);
          setAsk(null);
        }}
      />
    </div>
  );
}