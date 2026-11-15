import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { Capacitor } from "@capacitor/core";
import { Chip, Icon, Section } from "../components/ui";
import { FilePreview } from "../components/FilePreview";
import LiveAndroid from "./LiveAndroid";
import { fmtBytes, fmtDate } from "../lib/core";

type Root = { id: number; path: string; recursive: number; watch: number; enabled: number; last_scan: string | null };
type FileRow = {
  id: number; root_id: number; path: string; name: string; ext: string; kind: string; signature: string;
  size: number; mtime: number; ctime: number; sha256: string; phash?: string | null; category: string;
  status: string; broken_kind?: string | null; broken_info?: string | null; repairable?: number;
};
type DuplicateGroup = { kind: string; similarity: number; reason: string; keep: number; files: FileRow[] };
type Job = { state: string; done: number; total: number; current?: string };

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    const detail = body?.detail;
    throw new Error(typeof detail === "string" ? detail : detail?.message ?? `Request failed (${response.status})`);
  }
  return body as T;
}

async function issueApproval() {
  const result = await api<{ approval_token: string }>("/api/approval", { method: "POST", body: "{}" });
  return result.approval_token;
}

function LiveDesktop() {
  const [online, setOnline] = useState(false);
  const [roots, setRoots] = useState<Root[]>([]);
  const [files, setFiles] = useState<FileRow[]>([]);
  const [groups, setGroups] = useState<DuplicateGroup[]>([]);
  const [folderPath, setFolderPath] = useState("");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<number[]>([]);
  const [job, setJob] = useState<string | null>(null);
  const [jobState, setJobState] = useState<Job | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [previewFile, setPreviewFile] = useState<FileRow | null>(null);
  const [page, setPage] = useState(0);
  const pageSize = 100;

  const refresh = useCallback(async () => {
    const [rootRows, groupRows] = await Promise.all([
      api<Root[]>("/api/roots"),
      api<DuplicateGroup[]>("/api/duplicates"),
    ]);
    const allFiles: FileRow[] = [];
    for (let pageIndex = 1; ; pageIndex++) {
      const batch = await api<FileRow[]>(`/api/files?per_page=500&page=${pageIndex}`);
      allFiles.push(...batch);
      if (batch.length < 500) break;
    }
    setRoots(rootRows);
    setGroups(groupRows);
    setFiles(allFiles.filter(file => !["delete", "deleted", "archive", "archived"].includes(file.status)));
    setSelected([]);
  }, []);

  useEffect(() => {
    let alive = true;
    api<{ status: string }>("/api/health").then(async result => {
      if (!alive) return;
      setOnline(result.status === "ok");
      await refresh();
    }).catch(() => { if (alive) setOnline(false); });
    return () => { alive = false; };
  }, [refresh]);

  useEffect(() => {
    if (!job) return;
    let alive = true;
    const timer = window.setInterval(async () => {
      try {
        const status = await api<Job>(`/api/scan/${job}`);
        if (!alive) return;
        setJobState(status);
        if (["complete", "failed", "unknown"].includes(status.state)) {
          window.clearInterval(timer);
          setJob(null);
          if (status.state === "complete") {
            await refresh();
            setNotice(`Scan finished: ${status.done.toLocaleString()} files indexed.`);
          } else {
            setError(status.current || `Scan ${status.state}.`);
          }
        }
      } catch (cause) {
        if (!alive) return;
        window.clearInterval(timer);
        setJob(null);
        setError(cause instanceof Error ? cause.message : "Could not read scan status.");
      }
    }, 500);
    return () => { alive = false; window.clearInterval(timer); };
  }, [job, refresh]);

  const visibleFiles = useMemo(() => {
    const q = query.trim().toLowerCase();
    return files.filter(file => !q || `${file.name} ${file.path} ${file.category}`.toLowerCase().includes(q));
  }, [files, query]);
  const pageCount = Math.max(1, Math.ceil(visibleFiles.length / pageSize));
  const shownFiles = visibleFiles.slice(page * pageSize, (page + 1) * pageSize);
  const totalBytes = files.reduce((sum, file) => sum + file.size, 0);
  const duplicateBytes = groups.reduce((sum, group) => sum + (group.files[0]?.size ?? 0) * (group.files.length - 1), 0);

  const addRoot = async (event: FormEvent) => {
    event.preventDefault();
    if (!folderPath.trim()) return;
    setBusy(true); setError(""); setNotice("");
    try {
      await api("/api/roots", { method: "POST", body: JSON.stringify({ path: folderPath.trim(), recursive: true, watch: false }) });
      setFolderPath("");
      await refresh();
      setNotice("Folder added. Start a scan to index its files.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not add folder."); }
    finally { setBusy(false); }
  };

  const startScan = async () => {
    setBusy(true); setError(""); setNotice(""); setJobState({ state: "starting", done: 0, total: 0 });
    try {
      const result = await api<{ job_id: string }>("/api/scan", { method: "POST", body: JSON.stringify({ incremental: true }) });
      setJob(result.job_id);
    } catch (cause) { setJobState(null); setError(cause instanceof Error ? cause.message : "Could not start scan."); }
    finally { setBusy(false); }
  };

  const runOperation = async (operation: "delete" | "archive" | "move" | "rename") => {
    if (!selected.length) return;
    const selectedFiles = files.filter(file => selected.includes(file.id));
    if (operation === "delete" && !window.confirm(`Move ${selected.length} selected file(s) to Sasha Maid's recoverable trash?`)) return;
    if (operation === "archive" && !window.confirm(`Move ${selected.length} selected file(s) to the Review folder?`)) return;
    let renameItems: { id: number; name: string }[] = [];
    if (operation === "rename") {
      renameItems = selectedFiles.map(file => {
        const name = window.prompt(`New name for ${file.name}`, file.name);
        return name === null ? null : { id: file.id, name };
      }).filter((item): item is { id: number; name: string } => !!item);
      if (!renameItems.length) return;
      if (!window.confirm(`Apply ${renameItems.length} approved rename(s)? Existing files will not be overwritten.`)) return;
    }
    if (operation === "move" && !window.confirm(`Move ${selected.length} file(s) to type-based folders under Sasha Maid's local library?`)) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const approval_token = await issueApproval();
      if (operation === "rename") {
        await api("/api/rename/apply", { method: "POST", body: JSON.stringify({ items: renameItems, approval_token }) });
      } else if (operation === "move") {
        await api("/api/organize/apply", { method: "POST", body: JSON.stringify({ action: "archive", ids: selected, approval_token }) });
      } else {
        await api("/api/files/resolve", { method: "POST", body: JSON.stringify({ action: operation, ids: selected, approval_token }) });
      }
      await refresh();
      setNotice(`${operation === "move" ? "Moved" : operation === "rename" ? "Renamed" : operation === "delete" ? "Sent to trash" : "Archived"} files successfully.`);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "File operation failed."); }
    finally { setBusy(false); }
  };

  const undoLatest = async () => {
    setBusy(true); setError(""); setNotice("");
    try {
      const report = await api<{ operations: { id: number; undone: number; label: string }[] }>("/api/report?format=json");
      const last = report.operations.find(operation => !operation.undone);
      if (!last) { setNotice("There are no file operations to undo."); return; }
      if (!window.confirm(`Undo “${last.label}”?`)) return;
      await api(`/api/undo/${last.id}`, { method: "POST" });
      await refresh();
      setNotice(`Undid “${last.label}”.`);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Undo failed."); }
    finally { setBusy(false); }
  };

  const toggleOne = (id: number) => setSelected(current => current.includes(id) ? current.filter(value => value !== id) : [...current, id]);
  const togglePage = () => setSelected(current => shownFiles.length && shownFiles.every(file => current.includes(file.id))
    ? current.filter(id => !shownFiles.some(file => file.id === id))
    : [...new Set([...current, ...shownFiles.map(file => file.id)])]);

  if (!online) return <div className="card card-pad rise"><div className="flex items-start gap-3"><span style={{ color: "var(--amber)" }}><Icon name="info" size={18} /></span><div><div className="text-[14px] font-semibold">Live filesystem service is not running</div><p className="mt-1 text-[12px] leading-5" style={{ color: "var(--muted)" }}>This page needs Sasha Maid’s local Python service. Start the native app with <code className="mono">./start-sasha-maid.sh</code> or start the API on <code className="mono">127.0.0.1:8765</code>, then reload. The other screens are the sample workspace.</p></div></div></div>;

  return <div className="space-y-4">
    {error && <div className="card p-3 text-[12px]" style={{ borderColor: "var(--danger)", color: "var(--danger)" }} role="alert">{error}</div>}
    {notice && <div className="card p-3 text-[12px]" style={{ borderColor: "var(--success)", color: "var(--success)" }} role="status">{notice}</div>}

    <Section title="Folders on this computer" sub="Choose roots to index. System-critical folders are blocked by the service." right={<Chip color="var(--success)"><Icon name="shield" size={11} />local API connected</Chip>}>
      <form className="flex flex-wrap gap-2" onSubmit={addRoot}>
        <input className="field flex-1 min-w-[240px] mono text-[12px]" value={folderPath} onChange={event => setFolderPath(event.target.value)} placeholder="Absolute path, e.g. /home/you/Downloads" aria-label="Folder path" />
        <button className="btn btn-primary btn-sm" disabled={busy || !folderPath.trim()}><Icon name="folder" size={13} />Add folder</button>
        <button type="button" className="btn btn-sm" onClick={startScan} disabled={busy || !roots.length}><Icon name="scan" size={13} />{job ? "Scanning…" : "Scan enabled folders"}</button>
        <button type="button" className="btn btn-sm" onClick={undoLatest} disabled={busy}><Icon name="undo" size={13} />Undo latest</button>
      </form>
      {roots.length > 0 && <div className="mt-3 flex flex-wrap gap-2">{roots.map(root => <span key={root.id} className="chip mono text-[10px]" title={root.path}>{root.path}</span>)}</div>}
      {jobState && <div className="mt-3 inset p-2.5"><div className="flex justify-between text-[11px] mb-1"><span>{jobState.current || (jobState.state === "starting" ? "Starting scan…" : "Scanning…")}</span><span>{jobState.total ? `${jobState.done.toLocaleString()} / ${jobState.total.toLocaleString()}` : jobState.state}</span></div><div className="h-1.5 rounded-full overflow-hidden bg-slate-800"><div className="h-full bg-teal-400 transition-all" style={{ width: `${jobState.total ? Math.max(2, jobState.done / jobState.total * 100) : 8}%` }} /></div></div>}
    </Section>

    <div className="grid gap-3 sm:grid-cols-3">
      {[["Indexed files", files.length.toLocaleString(), fmtBytes(totalBytes)], ["Exact duplicate groups", groups.length.toLocaleString(), `${fmtBytes(duplicateBytes)} reclaimable`], ["Roots", roots.length.toLocaleString(), "On this computer"]].map(([label, value, detail]) => <div key={label} className="card p-3.5"><div className="label">{label}</div><div className="display text-[20px] font-bold mt-1">{value}</div><div className="text-[11px] mt-1" style={{ color: "var(--muted)" }}>{detail}</div></div>)}
    </div>

    {groups.length > 0 && <Section title="Duplicate groups" sub="Exact-hash and visual candidates. Review paths before choosing which copies to keep or trash.">
      <div className="space-y-2">{groups.map((group, index) => {
        const keep = group.files.find(file => file.id === group.keep) ?? group.files[0];
        const copies = group.files.filter(file => file.id !== keep?.id);
        return <div key={`${group.kind}-${group.files.map(file => file.id).join("-")}`} className="inset p-3 flex flex-wrap items-center gap-3">
          <div className="min-w-0 flex-1"><div className="text-[12px] font-semibold">Group {index + 1} · {group.kind} · {fmtBytes(group.files[0]?.size ?? 0)} each</div><div className="mono text-[10px] mt-1 truncate" style={{ color: "var(--muted)" }}>{group.files.map(file => file.path).join(" · ")}</div><div className="text-[10px] mt-1" style={{ color: "var(--success)" }}>Keep suggested: {keep?.name}</div></div>
          <button className="btn btn-xs" disabled={!copies.length || busy} onClick={() => { setSelected(copies.map(file => file.id)); setQuery(""); setNotice(`${copies.length} duplicate copy/copies selected. Use Trash after reviewing the file list.`); }}>{copies.length} copies · select</button>
        </div>;
      })}</div>
    </Section>}

    <Section title="Indexed files" sub="These rows come from the selected folders on disk, not the demo library." right={<span className="mono text-[10px]" style={{ color: "var(--muted)" }}>{visibleFiles.length.toLocaleString()} files</span>}>
      <div className="flex flex-wrap gap-2 mb-3">
        <input className="field flex-1 min-w-[220px] text-[12px]" value={query} onChange={event => { setQuery(event.target.value); setPage(0); }} placeholder="Search actual file names and paths" />
        <button className="btn btn-sm" onClick={() => void refresh()} disabled={busy}><Icon name="refresh" size={12} />Refresh</button>
      </div>
      {selected.length > 0 && <div className="flex flex-wrap items-center gap-2 mb-3 inset p-2.5"><span className="text-[11px] flex-1">{selected.length} selected</span><button className="btn btn-xs" disabled={busy} onClick={() => void runOperation("rename")}>Rename</button><button className="btn btn-xs" disabled={busy} onClick={() => void runOperation("move")}>Organize</button><button className="btn btn-xs" disabled={busy} onClick={() => void runOperation("archive")}>Move to Review</button><button className="btn btn-xs btn-danger" disabled={busy} onClick={() => void runOperation("delete")}>Trash</button></div>}
      {!files.length ? <div className="py-8 text-center text-[12px]" style={{ color: "var(--muted)" }}>No files indexed yet. Add a folder and start a scan.</div> : <div className="overflow-x-auto"><table className="w-full text-left text-[11px]"><thead><tr className="label"><th className="p-2"><input type="checkbox" aria-label="Select current page" checked={!!shownFiles.length && shownFiles.every(file => selected.includes(file.id))} onChange={togglePage} /></th><th className="p-2">Preview</th><th className="p-2">Name</th><th className="p-2">Category</th><th className="p-2 text-right">Size</th><th className="p-2">Modified</th><th className="p-2">Status</th></tr></thead><tbody>{shownFiles.map(file => <tr key={file.id} className="border-t" style={{ borderColor: "var(--line)" }}><td className="p-2"><input type="checkbox" checked={selected.includes(file.id)} onChange={() => toggleOne(file.id)} aria-label={`Select ${file.name}`} /></td><td className="p-2"><button className="btn btn-xs" onClick={() => setPreviewFile(file)} aria-label={`Preview ${file.name}`}><Icon name="eye" size={12} />View</button></td><td className="p-2"><div className="font-medium truncate max-w-[420px]" title={file.path}>{file.name}</div><div className="mono truncate max-w-[420px] text-[9px]" style={{ color: "var(--faint)" }}>{file.path}</div></td><td className="p-2">{file.category}</td><td className="p-2 text-right mono">{fmtBytes(file.size)}</td><td className="p-2 whitespace-nowrap">{fmtDate(file.mtime * 1000)}</td><td className="p-2">{file.broken_kind ? <span style={{ color: "var(--danger)" }}>{file.broken_kind}</span> : <span style={{ color: "var(--success)" }}>{file.status}</span>}</td></tr>)}</tbody></table><div className="flex items-center justify-end gap-2 pt-3"><button className="btn btn-xs" onClick={() => setPage(Math.max(0, page - 1))} disabled={page === 0}>Previous</button><span className="mono text-[10px]">{page + 1} / {pageCount}</span><button className="btn btn-xs" onClick={() => setPage(Math.min(pageCount - 1, page + 1))} disabled={page + 1 >= pageCount}>Next</button></div></div>}
    </Section>
    {previewFile && <FilePreview file={previewFile} src={`/api/files/${previewFile.id}/preview`} downloadUrl={`/api/files/${previewFile.id}/preview?download=true`} onClose={() => setPreviewFile(null)} />}
  </div>;
}

export default function Live() {
  if (Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android") return <LiveAndroid />;
  return <LiveDesktop />;
}
