import { useCallback, useEffect, useMemo, useState } from "react";
import { Chip, Icon, Section } from "../components/ui";
import { FilePreview, previewKind } from "../components/FilePreview";
import { fmtBytes, fmtDate } from "../lib/core";
import { AndroidFiles, type AndroidDuplicateGroup, type AndroidFile, type AndroidRoot } from "../lib/androidFiles";

type Progress = { current: string; done: number; total: number };

export default function LiveAndroid() {
  const [roots, setRoots] = useState<AndroidRoot[]>([]);
  const [files, setFiles] = useState<AndroidFile[]>([]);
  const [groups, setGroups] = useState<AndroidDuplicateGroup[]>([]);
  const [selected, setSelected] = useState<number[]>([]);
  const [query, setQuery] = useState("");
  const [progress, setProgress] = useState<Progress | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [preview, setPreview] = useState<{ file: AndroidFile; src: string; textContent?: string } | null>(null);

  const refreshRoots = useCallback(async () => {
    const result = await AndroidFiles.getRoots();
    setRoots(result.roots);
  }, []);

  useEffect(() => {
    let remove: (() => Promise<void>) | undefined;
    void AndroidFiles.addListener("scanProgress", update => setProgress(update)).then(handle => { remove = handle.remove; }).catch(() => undefined);
    void refreshRoots().catch(cause => setError(errorMessage(cause)));
    return () => { if (remove) void remove(); };
  }, [refreshRoots]);

  const scan = async () => {
    setBusy(true); setError(""); setNotice(""); setProgress({ current: "Scanning selected folders…", done: 0, total: 0 });
    try {
      const result = await AndroidFiles.scan();
      setFiles(result.files); setGroups(result.duplicates); setSelected([]);
      setNotice(`Scan finished: ${result.done.toLocaleString()} files indexed.`);
      await refreshRoots();
    } catch (cause) { setError(errorMessage(cause)); }
    finally { setBusy(false); setProgress(null); }
  };

  const addFolder = async () => {
    setBusy(true); setError(""); setNotice("");
    try {
      const selectedFolder = await AndroidFiles.pickFolder();
      await refreshRoots();
      setNotice(`Folder access saved for “${selectedFolder.name}”. Scan to index it.`);
    } catch (cause) {
      if (!String(cause).toLowerCase().includes("cancel")) setError(errorMessage(cause));
    } finally { setBusy(false); }
  };

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return files.filter(file => !q || `${file.name} ${file.path} ${file.category}`.toLowerCase().includes(q));
  }, [files, query]);
  const selectedFiles = files.filter(file => selected.includes(file.id));
  const totalBytes = files.reduce((sum, file) => sum + file.size, 0);
  const dupBytes = groups.reduce((sum, group) => sum + (group.files[0]?.size ?? 0) * (group.files.length - 1), 0);

  const apply = async (action: "delete" | "archive" | "move" | "rename") => {
    if (!selectedFiles.length) return;
    let items: { id: number; name?: string }[] = selectedFiles.map(file => ({ id: file.id }));
    if (action === "rename") {
      items = selectedFiles.map(file => {
        const name = window.prompt(`New name for ${file.name}`, file.name);
        return name === null ? null : { id: file.id, name };
      }).filter((item): item is { id: number; name: string } => !!item);
      if (!items.length) return;
    }
    const actionLabel = action === "delete" ? "move selected files into the recoverable Sasha Maid Trash folder" : action === "archive" ? "move selected files into Sasha Maid Review" : action === "move" ? "organize selected files into category folders" : "rename selected files";
    if (!window.confirm(`Approve this action: ${actionLabel}? You can use Undo latest to reverse it.`)) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const result = await AndroidFiles.apply({ action, items });
      const rescanned = await AndroidFiles.scan();
      setFiles(rescanned.files); setGroups(rescanned.duplicates); setSelected([]);
      setNotice(`${result.label}.`);
    } catch (cause) { setError(errorMessage(cause)); }
    finally { setBusy(false); }
  };

  const undo = async () => {
    if (!window.confirm("Undo the most recent approved file action?")) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const result = await AndroidFiles.undoLatest();
      if (!result.undone) { setNotice("There are no file operations to undo."); return; }
      const rescanned = await AndroidFiles.scan();
      setFiles(rescanned.files); setGroups(rescanned.duplicates); setSelected([]);
      setNotice(`Undid ${result.label ?? "the last action"}.`);
    } catch (cause) { setError(errorMessage(cause)); }
    finally { setBusy(false); }
  };

  const openPreview = async (file: AndroidFile) => {
    setBusy(true); setError("");
    try {
      const result = await AndroidFiles.preview({ id: file.id });
      const textContent = previewKind(file) === "text"
        ? new TextDecoder().decode(Uint8Array.from(atob(result.base64), character => character.charCodeAt(0)))
        : undefined;
      setPreview({ file, src: `data:${result.mime};base64,${result.base64}`, textContent });
    } catch (cause) { setError(errorMessage(cause)); }
    finally { setBusy(false); }
  };

  const toggleAll = () => setSelected(selected.length === visible.length ? [] : visible.map(file => file.id));

  return <div className="space-y-4">
    {error && <div className="card p-3 text-[12px]" style={{ borderColor: "var(--danger)", color: "var(--danger)" }} role="alert">{error}</div>}
    {notice && <div className="card p-3 text-[12px]" style={{ borderColor: "var(--success)", color: "var(--success)" }} role="status">{notice}</div>}

    <Section title="Folders on this device" sub="Android asks you to choose each folder. Sasha Maid keeps access only to folders you approve, using the system folder picker." right={<Chip color="var(--success)"><Icon name="shield" size={11} />Android folder access</Chip>}>
      <div className="flex flex-wrap gap-2">
        <button className="btn btn-primary btn-sm" onClick={() => void addFolder()} disabled={busy}><Icon name="folder" size={13} />Choose folder</button>
        <button className="btn btn-sm" onClick={() => void scan()} disabled={busy || roots.length === 0}><Icon name="scan" size={13} />{busy ? "Working…" : "Scan folders"}</button>
        <button className="btn btn-sm" onClick={() => void undo()} disabled={busy}><Icon name="undo" size={13} />Undo latest</button>
      </div>
      {roots.length > 0 && <div className="mt-3 flex flex-wrap gap-2">{roots.map(root => <span key={root.id} className="chip text-[10px]">{root.path}</span>)}</div>}
      {!roots.length && <p className="mt-3 text-[11px]" style={{ color: "var(--muted)" }}>No folders selected yet. Android will show its own folder picker after you tap Choose folder.</p>}
      {progress && <div className="mt-3 inset p-2.5"><div className="flex justify-between text-[11px] mb-1"><span>{progress.current}</span><span>{progress.done.toLocaleString()}</span></div><div className="h-1.5 rounded-full overflow-hidden bg-slate-800"><div className="h-full bg-teal-400" style={{ width: "30%" }} /></div></div>}
    </Section>

    <div className="grid gap-3 sm:grid-cols-3">{[["Indexed files", files.length.toLocaleString(), fmtBytes(totalBytes)], ["Exact duplicate groups", groups.length.toLocaleString(), `${fmtBytes(dupBytes)} reclaimable`], ["Selected folders", roots.length.toLocaleString(), "Access granted by you"]].map(([label, value, detail]) => <div key={label} className="card p-3.5"><div className="label">{label}</div><div className="display text-[20px] font-bold mt-1">{value}</div><div className="text-[11px] mt-1" style={{ color: "var(--muted)" }}>{detail}</div></div>)}</div>

    {groups.length > 0 && <Section title="Exact duplicates" sub="Files with identical SHA-256 hashes. Review each group before moving copies to Trash."><div className="space-y-2">{groups.map((group, index) => {
      const keep = group.files.find(file => file.id === group.keep) ?? group.files[0];
      const copies = group.files.filter(file => file.id !== keep?.id);
      return <div key={`${group.kind}-${group.files.map(file => file.id).join("-")}`} className="inset p-3 flex flex-wrap items-center gap-3"><div className="min-w-0 flex-1"><div className="text-[12px] font-semibold">Group {index + 1} · {fmtBytes(group.files[0]?.size ?? 0)} each</div><div className="mono text-[10px] mt-1 break-all" style={{ color: "var(--muted)" }}>{group.files.map(file => file.path).join(" · ")}</div><div className="text-[10px] mt-1" style={{ color: "var(--success)" }}>Suggested to keep: {keep?.name}</div></div><button className="btn btn-xs" onClick={() => setSelected(copies.map(file => file.id))}>{copies.length} copies · select</button></div>;
    })}</div></Section>}

    <Section title="Files on this device" sub="Only user-selected folders appear here. Android may limit operations on cloud-backed or read-only providers." right={<span className="mono text-[10px]" style={{ color: "var(--muted)" }}>{visible.length.toLocaleString()} files</span>}>
      <div className="flex flex-wrap gap-2 mb-3"><input className="field flex-1 min-w-[180px] text-[12px]" value={query} onChange={event => setQuery(event.target.value)} placeholder="Search names and paths" aria-label="Search files" /></div>
      {selected.length > 0 && <div className="flex flex-wrap items-center gap-2 mb-3 inset p-2.5"><span className="text-[11px] flex-1">{selected.length} selected</span><button className="btn btn-xs" onClick={() => void apply("rename")} disabled={busy}>Rename</button><button className="btn btn-xs" onClick={() => void apply("move")} disabled={busy}>Organize</button><button className="btn btn-xs" onClick={() => void apply("archive")} disabled={busy}>Move to Review</button><button className="btn btn-xs btn-danger" onClick={() => void apply("delete")} disabled={busy}>Trash</button></div>}
      {!files.length ? <div className="py-8 text-center text-[12px]" style={{ color: "var(--muted)" }}>Choose a folder and scan to list files.</div> : <div className="overflow-x-auto"><table className="w-full text-left text-[11px] min-w-[580px]"><thead><tr className="label"><th className="p-2"><input type="checkbox" aria-label="Select all visible files" checked={!!visible.length && selected.length === visible.length} onChange={toggleAll} /></th><th className="p-2">Preview</th><th className="p-2">Name</th><th className="p-2">Category</th><th className="p-2 text-right">Size</th><th className="p-2">Modified</th></tr></thead><tbody>{visible.map(file => <tr key={file.id} className="border-t" style={{ borderColor: "var(--line)" }}><td className="p-2"><input type="checkbox" checked={selected.includes(file.id)} onChange={() => setSelected(current => current.includes(file.id) ? current.filter(id => id !== file.id) : [...current, file.id])} aria-label={`Select ${file.name}`} /></td><td className="p-2"><button className="btn btn-xs" onClick={() => void openPreview(file)} disabled={busy} aria-label={`Preview ${file.name}`}><Icon name="eye" size={12} />View</button></td><td className="p-2"><div className="font-medium break-all max-w-[420px]">{file.name}</div><div className="mono break-all max-w-[420px] text-[9px]" style={{ color: "var(--faint)" }}>{file.path}</div></td><td className="p-2">{file.category}</td><td className="p-2 text-right mono whitespace-nowrap">{fmtBytes(file.size)}</td><td className="p-2 whitespace-nowrap">{fmtDate(file.mtime * 1000)}</td></tr>)}</tbody></table></div>}
    </Section>
    {preview && <FilePreview file={preview.file} src={preview.src} downloadUrl={preview.src} textContent={preview.textContent} onClose={() => setPreview(null)} />}
  </div>;
}

function errorMessage(cause: unknown) {
  if (cause instanceof Error) return cause.message;
  if (typeof cause === "string") return cause;
  try { return JSON.stringify(cause); } catch { return "Android file access failed."; }
}
