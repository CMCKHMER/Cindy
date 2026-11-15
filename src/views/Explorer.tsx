import { useMemo, useState } from "react";
import { useApp } from "../state/store";
import { Chip, Empty, Icon, Segmented, StatusChip, Thumb, VirtualList, useFilteredFiles } from "../components/ui";
import { Approval } from "../components/Panels";
import { KIND_META, fmtBytes, fmtDate, relTime, renderPath, uid, type Kind, type SavedView } from "../lib/core";

const KINDS: (Kind | "all")[] = ["all", "document", "image", "video", "music", "audio", "archive", "code", "installer", "other"];
const SORTS = [
  { value: "modified-desc", label: "Newest first" },
  { value: "modified-asc", label: "Oldest first" },
  { value: "size-desc", label: "Largest first" },
  { value: "size-asc", label: "Smallest first" },
  { value: "name-asc", label: "Name A→Z" },
  { value: "name-desc", label: "Name Z→A" },
  { value: "kind-asc", label: "Category" },
  { value: "dir-asc", label: "Location" },
];

export default function Explorer() {
  const { s, d, api } = useApp();
  const [mode, setMode] = useState<"list" | "grid">("list");
  const [ask, setAsk] = useState<null | "delete" | "archive" | "move">(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const [gridLimit, setGridLimit] = useState(96);

  const rows = useFilteredFiles(d.files, s.filters, s.sort);
  const selection = s.selection;
  const allSelected = rows.length > 0 && rows.every((r) => selection.includes(r.id));
  const selFiles = selection.map((id) => d.byId.get(id)!).filter(Boolean);
  const activeFilters = [
    s.filters.query && `“${s.filters.query}”`,
    s.filters.kind !== "all" && KIND_META[s.filters.kind as Kind].label,
    s.filters.root !== "all" && s.roots.find((r) => r.id === s.filters.root)?.label,
    s.filters.minSize > 0 && `≥ ${fmtBytes(s.filters.minSize)}`,
    s.filters.olderThanDays > 0 && `> ${s.filters.olderThanDays}d old`,
    s.filters.status !== "all" && s.filters.status,
    s.filters.subject && `subject: ${s.filters.subject}`,
  ].filter(Boolean) as string[];

  const saveView = () => {
    const v: SavedView = {
      id: uid("view"),
      name: activeFilters.length ? activeFilters.join(" · ").slice(0, 28) : `View ${s.views.length + 1}`,
      query: s.filters.query, kind: s.filters.kind, minSize: s.filters.minSize,
      olderThanDays: s.filters.olderThanDays, status: s.filters.status as SavedView["status"], sort: s.sort,
    };
    api.setViews([...s.views, v]);
    api.toast({ tone: "success", title: "View saved", message: v.name });
  };

  const reorder = (from: string, to: string) => {
    const list = [...s.views];
    const a = list.findIndex((v) => v.id === from);
    const b = list.findIndex((v) => v.id === to);
    if (a < 0 || b < 0 || a === b) return;
    const [item] = list.splice(a, 1);
    list.splice(b, 0, item);
    api.setViews(list);
  };

  const gridCols = useMemo(() => [...rows].slice(0, gridLimit), [rows, gridLimit]);

  return (
    <div className="space-y-3.5">
      <div className="card card-pad">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[220px]">
            <span className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--faint)" }}><Icon name="search" size={15} /></span>
            <input id="explorer-search" className="field pl-9" placeholder="Search names, paths, tags or SHA-256 prefix…  ( / )"
              value={s.filters.query} onChange={(e) => api.setFilters({ query: e.target.value })} />
          </div>
          <select className="field w-auto" value={s.filters.kind} onChange={(e) => api.setFilters({ kind: e.target.value as Kind | "all" })} aria-label="Filter by category">
            {KINDS.map((k) => <option key={k} value={k}>{k === "all" ? "All categories" : KIND_META[k as Kind].label}</option>)}
          </select>
          <select className="field w-auto" value={s.filters.root} onChange={(e) => api.setFilters({ root: e.target.value })} aria-label="Filter by root">
            <option value="all">All folders</option>
            {s.roots.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
          </select>
          <select className="field w-auto" value={s.filters.status} onChange={(e) => api.setFilters({ status: e.target.value })} aria-label="Filter by status">
            {["all", "indexed", "moved", "renamed", "archived", "repaired", "ignored", "deleted"].map((x) => <option key={x} value={x}>{x === "all" ? "Any status" : x}</option>)}
          </select>
          <select className="field w-auto" value={s.sort} onChange={(e) => api.setSort(e.target.value)} aria-label="Sort">
            {SORTS.map((x) => <option key={x.value} value={x.value}>{x.label}</option>)}
          </select>
          <Segmented value={mode} onChange={setMode} size="sm" options={[{ value: "list", label: "List", icon: "list" }, { value: "grid", label: "Grid", icon: "grid" }]} />
        </div>

        <div className="flex flex-wrap items-center gap-2 mt-3">
          <span className="label">Saved views</span>
          {s.views.map((v) => (
            <span key={v.id} draggable onDragStart={() => setDragId(v.id)} onDragEnd={() => { setDragId(null); setOverId(null); }}
              onDragOver={(e) => { e.preventDefault(); setOverId(v.id); }} onDrop={() => { if (dragId) reorder(dragId, v.id); setOverId(null); }}
              className={`inline-flex items-center gap-1 rounded-lg ${dragId === v.id ? "dragging" : ""} ${overId === v.id ? "drop-target" : ""}`}
              style={{ border: "1px solid var(--line)", background: "color-mix(in srgb, var(--surface-2) 80%, transparent)" }}>
              <span className="pl-1.5 cursor-grab" style={{ color: "var(--faint)" }} title="Drag to reorder"><Icon name="drag" size={12} /></span>
              <button className="text-[11.5px] py-1 pr-1" onClick={() => api.applyView(v)}>{v.name}</button>
              <button className="pr-1.5" style={{ color: "var(--faint)" }} onClick={() => api.setViews(s.views.filter((x) => x.id !== v.id))} aria-label={`Delete view ${v.name}`}><Icon name="x" size={11} /></button>
            </span>
          ))}
          <button className="btn btn-xs" onClick={saveView}><Icon name="save" size={11} />Save current</button>
          {activeFilters.length > 0 && (
            <>
              <span className="label ml-2">Active</span>
              {activeFilters.map((f) => <Chip key={f} color="var(--teal)">{f}</Chip>)}
              <button className="btn btn-xs" onClick={api.resetFilters}><Icon name="x" size={11} />Clear filters</button>
            </>
          )}
          <span className="ml-auto mono text-[11.5px]" style={{ color: "var(--muted)" }}>
            {rows.length.toLocaleString()} of {d.files.length.toLocaleString()} files · {fmtBytes(rows.reduce((a, b) => a + b.size, 0))}
          </span>
        </div>
      </div>

      {selection.length > 0 && (
        <div className="card p-3 flex flex-wrap items-center gap-2 pop" style={{ borderColor: "color-mix(in srgb, var(--teal) 45%, transparent)" }}>
          <Icon name="check" size={15} />
          <span className="text-[12.5px] font-semibold">{selection.length} selected</span>
          <span className="mono text-[11.5px]" style={{ color: "var(--muted)" }}>{fmtBytes(selFiles.reduce((a, b) => a + b.size, 0))}</span>
          <div className="flex flex-wrap gap-1.5 ml-auto">
            <button className="btn btn-xs" onClick={() => setAsk("move")}><Icon name="folder" size={11} />Auto-organise</button>
            <button className="btn btn-xs" onClick={() => {
              const items = selFiles.filter((f) => f.suggestion).map((f) => ({ id: f.id, name: s.suggestionEdits[f.id] ?? f.suggestion!.name }));
              if (items.length) api.renameFiles(items);
              else api.toast({ tone: "warn", title: "No AI names for this selection", message: "Pick images with suggestions, or open the rename studio." });
            }}><Icon name="wand" size={11} />Apply AI names</button>
            <button className="btn btn-xs" onClick={() => setAsk("archive")}><Icon name="archive" size={11} />Review folder</button>
            <button className="btn btn-xs" onClick={() => { api.ignoreFiles(selection, "Bulk ignore from explorer"); }}><Icon name="eye" size={11} />Ignore</button>
            <button className="btn btn-xs btn-danger" onClick={() => setAsk("delete")}><Icon name="trash" size={11} />Delete</button>
            <button className="btn btn-xs" onClick={() => api.select([])}>Clear</button>
          </div>
        </div>
      )}

      <div className="card overflow-hidden">
        <div className="row px-3 py-2 label" style={{ gridTemplateColumns: "24px 40px minmax(0,2.2fr) 96px 96px minmax(0,1.4fr) 96px", background: "color-mix(in srgb, var(--text) 4%, transparent)" }}>
          <input type="checkbox" className="check" checked={allSelected} onChange={() => api.select(allSelected ? [] : rows.slice(0, 2000).map((r) => r.id))} aria-label="Select all" />
          <span />
          <span>Name</span>
          <span>Size</span>
          <span>Modified</span>
          <span className="hidden md:block">Location</span>
          <span>Status</span>
        </div>

        {rows.length === 0 ? (
          <Empty icon="search" title="No files match" sub="Try clearing filters, or search for a tag like “screenshot”, “ai_art” or “invoice”." action={<button className="btn btn-sm" onClick={api.resetFilters}>Clear filters</button>} />
        ) : mode === "list" ? (
          <VirtualList
            items={rows}
            rowHeight={52}
            height={620}
            render={(f) => (
              <div className="row px-3" style={{ gridTemplateColumns: "24px 40px minmax(0,2.2fr) 96px 96px minmax(0,1.4fr) 96px", height: 52 }} data-selected={selection.includes(f.id)}>
                <input type="checkbox" className="check" checked={selection.includes(f.id)} onChange={() => api.toggleSelect(f.id)} aria-label={`Select ${f.name}`} />
                <button onClick={() => api.openDrawer(f.id)}><Thumb file={f} size={32} radius={7} /></button>
                <button className="min-w-0 text-left" onClick={() => api.openDrawer(f.id)}>
                  <div className="flex items-center gap-1.5">
                    <span className="dot" style={{ background: KIND_META[f.kind].color }} />
                    <span className="text-[12.5px] truncate">{f.name}</span>
                    {f.broken && <Icon name="alert" size={12} />}
                    {f.suggestion && f.name !== f.suggestion.name && <span style={{ color: "var(--blue)" }}><Icon name="wand" size={11} /></span>}
                    {f.starred && <span style={{ color: "var(--amber)" }}><Icon name="star" size={11} /></span>}
                  </div>
                  <div className="mono text-[10px] truncate md:hidden" style={{ color: "var(--faint)" }}>{f.dir}</div>
                </button>
                <span className="mono text-[11.5px]" style={{ color: "var(--muted)" }}>{fmtBytes(f.size)}</span>
                <span className="text-[11px]" style={{ color: "var(--muted)" }} title={fmtDate(f.modified)}>{relTime(f.modified)}</span>
                <span className="mono text-[10.5px] truncate hidden md:block" style={{ color: "var(--faint)" }}>{renderPath(f.dir, s.settings.platform)}</span>
                <StatusChip file={f} />
              </div>
            )}
          />
        ) : (
          <div className="p-3">
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6 gap-2.5">
              {gridCols.map((f) => (
                <button key={f.id} className="inset overflow-hidden text-left group" onClick={() => api.openDrawer(f.id)}
                  style={{ borderColor: selection.includes(f.id) ? "var(--teal)" : undefined }}>
                  <div className="relative aspect-[4/3] overflow-hidden">
                    <Thumb file={f} size={400} radius={0} className="!w-full !h-full transition-transform duration-300 group-hover:scale-105" />
                    <span className="absolute top-1.5 left-1.5"><Chip color={KIND_META[f.kind].color} solid>{KIND_META[f.kind].short}</Chip></span>
                    <input type="checkbox" className="check absolute top-1.5 right-1.5" checked={selection.includes(f.id)}
                      onClick={(e) => e.stopPropagation()} onChange={() => api.toggleSelect(f.id)} aria-label={`Select ${f.name}`} />
                  </div>
                  <div className="p-2">
                    <div className="text-[11.5px] truncate">{f.name}</div>
                    <div className="mono text-[10px]" style={{ color: "var(--faint)" }}>{fmtBytes(f.size)} · {relTime(f.modified)}</div>
                  </div>
                </button>
              ))}
            </div>
            {gridLimit < rows.length && (
              <div className="flex justify-center mt-3">
                <button className="btn" onClick={() => setGridLimit((l) => l + 96)}>Load more · {(rows.length - gridLimit).toLocaleString()} remaining</button>
              </div>
            )}
          </div>
        )}
      </div>

      <Approval
        open={ask !== null}
        onClose={() => setAsk(null)}
        title={ask === "delete" ? `Delete ${selFiles.length} files?` : ask === "archive" ? `Archive ${selFiles.length} files?` : `Auto-organise ${selFiles.length} files?`}
        question={ask === "move"
          ? "Sasha Maid will create the taxonomy folders and move each file to its classified destination. Approve?"
          : "These files appear ready for cleanup. Delete, Keep, Move to Review Folder, or Ignore?"}
        files={selFiles}
        note={ask === "move" ? "Destinations come from content classification and your custom rules. Existing files are never overwritten." : undefined}
        actions={
          ask === "delete" ? [{ key: "delete", label: "Delete", icon: "trash", tone: "danger", desc: "Trash + snapshot, undoable." }]
            : ask === "archive" ? [{ key: "archive", label: "Archive", icon: "archive", tone: "warn", desc: "Move to .sasha/Review/<date>." }]
              : [{ key: "move", label: "Approve moves", icon: "check", tone: "success", desc: "Create folders and move files." }]
        }
        onAction={(k) => {
          if (k === "delete") api.deleteFiles(selection, "Bulk delete approved in explorer");
          else if (k === "archive") api.archiveFiles(selection, "Bulk archive from explorer");
          else api.moveFiles(selection);
          setAsk(null);
        }}
      />
    </div>
  );
}