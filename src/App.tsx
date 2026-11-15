import { useMemo, useState } from 'react';
import {
  AlertTriangle, Archive, ChevronRight, Copy, Download, File,
  FileText, FolderOpen, HardDrive, HelpCircle, Image, Loader2, Music2, Search,
  ShieldCheck, Trash2, Video, Wand2, X,
} from 'lucide-react';
import {
  deleteFile, DuplicateGroup, FileCategory, formatBytes, formatDate,
  LocalFile, moveIntoCategory, renameFile, scanDirectory,
} from './fileSystem';

type Page = 'overview' | 'files' | 'duplicates' | 'organize';
const categoryIcons: Record<FileCategory, typeof File> = {
  Images: Image, Videos: Video, Audio: Music2, Documents: FileText,
  Archives: Archive, Installers: Download, Other: File,
};
const categories: FileCategory[] = ['Images', 'Videos', 'Audio', 'Documents', 'Archives', 'Installers', 'Other'];

function formatPath(path: string) {
  return path.split('/').slice(0, -1).join('/') || 'Selected folder';
}

export default function App() {
  const [page, setPage] = useState<Page>('overview');
  const [root, setRoot] = useState<FileSystemDirectoryHandle | null>(null);
  const [files, setFiles] = useState<LocalFile[]>([]);
  const [scanning, setScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [scanMessage, setScanMessage] = useState('');
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<FileCategory | 'All'>('All');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ text: string; error?: boolean } | null>(null);

  const duplicates = useMemo(() => {
    const groups = new Map<string, LocalFile[]>();
    files.forEach(file => {
      if (!file.hash) return;
      const group = groups.get(file.hash) ?? [];
      group.push(file);
      groups.set(file.hash, group);
    });
    return [...groups.entries()]
      .filter(([, group]) => group.length > 1)
      .map(([hash, group]) => ({ hash, size: group[0].size, files: group } satisfies DuplicateGroup));
  }, [files]);
  const emptyFiles = useMemo(() => files.filter(file => file.size === 0), [files]);
  const categoryCounts = useMemo(() => categories.map(category => ({
    category,
    count: files.filter(file => file.category === category).length,
    size: files.filter(file => file.category === category).reduce((sum, file) => sum + file.size, 0),
  })), [files]);
  const duplicateBytes = duplicates.reduce((sum, group) => sum + group.size * (group.files.length - 1), 0);
  const visibleFiles = useMemo(() => files.filter(file => {
    const matchesText = `${file.name} ${file.relativePath}`.toLowerCase().includes(search.toLowerCase());
    return matchesText && (categoryFilter === 'All' || file.category === categoryFilter);
  }), [files, search, categoryFilter]);
  const needsOrganizing = files.filter(file => !file.relativePath.startsWith(`${file.category}/`));

  const announce = (text: string, error = false) => {
    setNotice({ text, error });
    window.setTimeout(() => setNotice(current => current?.text === text ? null : current), 5000);
  };

  const pickFolder = async () => {
    if (scanning || busy) return;
    if (!('showDirectoryPicker' in window) || !window.isSecureContext) {
      announce('Choose a folder in Chrome or Edge on HTTPS or localhost to grant file access.', true);
      return;
    }
    try {
      const selected = await window.showDirectoryPicker({ mode: 'read' });
      setRoot(selected);
      setFiles([]);
      setScanProgress(0);
      setScanMessage('');
      setPage('overview');
      announce(`Selected “${selected.name}”. Scan it to see your files.`);
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      announce(error instanceof Error ? error.message : 'Could not open that folder.', true);
    }
  };

  const runScan = async () => {
    if (!root || scanning) return;
    setScanning(true);
    setScanProgress(0);
    setScanMessage('Reading folder contents…');
    try {
      const permission = await root.requestPermission({ mode: 'read' });
      if (permission !== 'granted') throw new Error('Folder access was not granted. Choose the folder again to continue.');
      const results = await scanDirectory(root, (message, progress) => {
        setScanMessage(message);
        if (progress > 0) setScanProgress(progress);
      });
      setFiles(results);
      setScanProgress(100);
      setScanMessage(`Scan complete · ${results.length.toLocaleString()} files`);
      announce(`Scan complete: ${results.length.toLocaleString()} files found.`);
    } catch (error) {
      announce(error instanceof Error ? error.message : 'The folder could not be scanned.', true);
      setScanMessage('Scan did not complete. Check the folder permission and try again.');
    } finally {
      setScanning(false);
    }
  };

  const ensureWritePermission = async () => {
    if (!root) throw new Error('Choose a folder first.');
    const permission = await root.requestPermission({ mode: 'readwrite' });
    if (permission !== 'granted') throw new Error('Write access was not granted. Select the folder and approve write access.');
  };

  const updateFile = (oldId: string, updated: LocalFile) => {
    setFiles(current => current.map(file => file.id === oldId ? updated : file));
  };

  const handleRename = async (file: LocalFile) => {
    const nextName = window.prompt('Rename this file. Keep the extension if you want to preserve its file type.', file.name);
    if (nextName === null || nextName.trim() === file.name) return;
    try {
      setBusy(true);
      await ensureWritePermission();
      const renamed = await renameFile(file, nextName);
      updateFile(file.id, renamed);
      announce(`Renamed to “${renamed.name}”.`);
    } catch (error) {
      announce(error instanceof Error ? error.message : 'Rename failed.', true);
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (file: LocalFile) => {
    if (!window.confirm(`Permanently delete “${file.name}”? This cannot be undone.`)) return;
    try {
      setBusy(true);
      await ensureWritePermission();
      await deleteFile(file);
      setFiles(current => current.filter(entry => entry.id !== file.id));
      announce(`Deleted “${file.name}”.`);
    } catch (error) {
      announce(error instanceof Error ? error.message : 'Delete failed.', true);
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteDuplicates = async (group: DuplicateGroup) => {
    const keep = [...group.files].sort((a, b) => a.modified - b.modified)[0];
    const toDelete = group.files.filter(file => file.id !== keep.id);
    const names = toDelete.map(file => `• ${file.relativePath}`).join('\n');
    if (!window.confirm(`Keep the oldest copy (${keep.relativePath}) and permanently delete these ${toDelete.length} duplicate(s)?\n\n${names}`)) return;
    try {
      setBusy(true);
      await ensureWritePermission();
      const deleted: string[] = [];
      for (const file of toDelete) {
        await deleteFile(file);
        deleted.push(file.id);
      }
      setFiles(current => current.filter(file => !deleted.includes(file.id)));
      announce(`Deleted ${deleted.length} duplicate copy/copies. Kept ${keep.name}.`);
    } catch (error) {
      announce(`Some duplicates may already have been deleted. ${error instanceof Error ? error.message : 'Delete failed.'}`, true);
      try {
        const refreshed = await scanDirectory(root!, () => undefined);
        setFiles(refreshed);
      } catch { /* Keep the visible state if a refresh is not possible. */ }
    } finally {
      setBusy(false);
    }
  };

  const handleOrganize = async () => {
    if (!root || !needsOrganizing.length) return;
    if (!window.confirm(`Move ${needsOrganizing.length} file(s) into type-based folders inside “${root.name}”? Existing files will not be overwritten; duplicate names get a numbered suffix.`)) return;
    try {
      setBusy(true);
      await ensureWritePermission();
      let updated = [...files];
      let moved = 0;
      const failures: string[] = [];
      for (const file of needsOrganizing) {
        try {
          const result = await moveIntoCategory(root, file);
          updated = updated.map(entry => entry.id === file.id ? result : entry);
          moved++;
        } catch (error) {
          failures.push(`${file.name}: ${error instanceof Error ? error.message : 'move failed'}`);
        }
      }
      setFiles(updated);
      announce(failures.length
        ? `Moved ${moved} file(s); ${failures.length} failed. ${failures[0]}`
        : `Organized ${moved} file(s) into category folders.` , failures.length > 0);
    } catch (error) {
      announce(error instanceof Error ? error.message : 'Could not organize files.', true);
    } finally {
      setBusy(false);
    }
  };

  const exportCsv = () => {
    const quote = (value: string) => `"${value.replace(/"/g, '""')}"`;
    const rows = [['Name', 'Path', 'Category', 'Size (bytes)', 'Modified', 'SHA-256'], ...files.map(file => [file.name, file.relativePath, file.category, String(file.size), formatDate(file.modified), file.hash ?? ''])];
    const csv = rows.map(row => row.map(value => quote(String(value))).join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `${root?.name ?? 'cindy'}-scan.csv`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const nav: { id: Page; label: string; icon: typeof HardDrive }[] = [
    { id: 'overview', label: 'Overview', icon: HardDrive },
    { id: 'files', label: 'Files', icon: File },
    { id: 'duplicates', label: 'Duplicates', icon: Copy },
    { id: 'organize', label: 'Organize', icon: Wand2 },
  ];
  const totalSize = files.reduce((sum, file) => sum + file.size, 0);

  return (
    <div className="min-h-screen bg-[#0b1020] text-slate-200 md:flex">
      <aside className="w-full border-b border-slate-800 bg-[#10182a] p-4 md:sticky md:top-0 md:h-screen md:w-64 md:flex-shrink-0 md:border-b-0 md:border-r md:p-5">
        <div className="mb-7 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500 text-white"><FolderOpen className="h-5 w-5" /></div>
          <div><h1 className="font-semibold text-white">Cindy</h1><p className="text-xs text-slate-400">Local file organizer</p></div>
        </div>
        <div className="mb-5 rounded-xl border border-slate-700/70 bg-slate-900/60 p-3">
          <p className="mb-1 text-[11px] uppercase tracking-wide text-slate-500">Working folder</p>
          <p className="truncate text-sm font-medium text-slate-200">{root?.name ?? 'No folder selected'}</p>
          <button onClick={pickFolder} disabled={scanning || busy} className="mt-3 w-full rounded-lg border border-slate-700 px-3 py-2 text-xs font-medium text-slate-200 hover:border-indigo-400 hover:bg-indigo-500/10 disabled:opacity-50">{root ? 'Choose another folder' : 'Choose a folder'}</button>
        </div>
        <nav className="grid grid-cols-2 gap-1 md:block md:space-y-1">
          {nav.map(item => {
            const Icon = item.icon;
            const badge = item.id === 'files' ? files.length : item.id === 'duplicates' ? duplicates.length : undefined;
            return <button key={item.id} onClick={() => setPage(item.id)} className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition ${page === item.id ? 'bg-indigo-500/15 text-indigo-300' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'}`}><Icon className="h-4 w-4" />{item.label}{badge !== undefined && <span className="ml-auto text-xs text-slate-500">{badge}</span>}</button>;
          })}
        </nav>
        <div className="mt-6 hidden rounded-xl border border-slate-700/60 bg-slate-900/50 p-3 text-xs leading-5 text-slate-500 md:block">
          <div className="mb-1 flex items-center gap-2 text-slate-300"><ShieldCheck className="h-4 w-4 text-emerald-400" /> You stay in control</div>
          Files are only read or changed after you choose a folder and approve the requested browser permission.
        </div>
      </aside>

      <main className="min-w-0 flex-1">
        <header className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 bg-[#0b1020]/95 px-5 py-4 backdrop-blur md:px-8">
          <div><p className="text-xs text-slate-500">{root ? root.name : 'Welcome to Cindy'}</p><h2 className="text-lg font-semibold text-white">{nav.find(item => item.id === page)?.label}</h2></div>
          <div className="flex gap-2">
            {files.length > 0 && <button onClick={exportCsv} className="flex items-center gap-2 rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-300 hover:bg-slate-800"><Download className="h-4 w-4" /><span className="hidden sm:inline">Export CSV</span></button>}
            <button onClick={runScan} disabled={!root || scanning || busy} className="flex items-center gap-2 rounded-lg bg-indigo-500 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-400 disabled:cursor-not-allowed disabled:opacity-50">{scanning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}{scanning ? 'Scanning…' : files.length ? 'Rescan' : 'Scan folder'}</button>
          </div>
        </header>

        {scanning && <div className="h-1 bg-slate-800"><div className="h-full bg-indigo-400 transition-all" style={{ width: `${Math.max(scanProgress, 4)}%` }} /></div>}
        <div className="mx-auto max-w-7xl space-y-6 p-5 md:p-8">
          {notice && <div role="status" className={`flex items-start justify-between gap-3 rounded-xl border px-4 py-3 text-sm ${notice.error ? 'border-red-500/30 bg-red-500/10 text-red-200' : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200'}`}><span>{notice.text}</span><button aria-label="Dismiss notification" onClick={() => setNotice(null)}><X className="h-4 w-4" /></button></div>}
          {scanMessage && <p className="text-xs text-slate-500">{scanMessage}</p>}

          {!root ? <Welcome onChoose={pickFolder} /> : page === 'overview' ? <Overview
            root={root} files={files} totalSize={totalSize} duplicateGroups={duplicates.length} duplicateBytes={duplicateBytes}
            emptyCount={emptyFiles.length} categories={categoryCounts} onChoose={pickFolder} onScan={runScan} onNavigate={setPage}
          /> : page === 'files' ? <FilesPage files={visibleFiles} allCount={files.length} busy={busy || scanning} search={search} setSearch={setSearch} category={categoryFilter} setCategory={setCategoryFilter} onRename={handleRename} onDelete={handleDelete} /> : page === 'duplicates' ? <DuplicatesPage groups={duplicates} busy={busy || scanning} onDelete={handleDeleteDuplicates} /> : <OrganizePage rootName={root.name} files={files} pending={needsOrganizing} busy={busy || scanning} onOrganize={handleOrganize} />}

          {emptyFiles.length > 0 && page !== 'files' && <div className="flex items-start gap-3 rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 text-sm text-amber-100"><AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-400" /><div><p className="font-medium">{emptyFiles.length} empty file(s) found</p><p className="mt-1 text-xs text-amber-100/60">Empty files are not necessarily damaged. Review them in Files before deciding whether to remove them.</p><button onClick={() => setPage('files')} className="mt-2 text-xs font-medium text-amber-300 underline">Review files</button></div></div>}
          <p className="pb-4 text-center text-[11px] text-slate-600">Cindy runs in your browser. Your files are not uploaded. Deletions and moves require explicit confirmation.</p>
        </div>
      </main>
    </div>
  );
}

function Welcome({ onChoose }: { onChoose: () => void }) {
  return <section className="mx-auto max-w-3xl py-10 md:py-20">
    <div className="mb-6 inline-flex rounded-full border border-indigo-400/20 bg-indigo-400/10 px-3 py-1 text-xs text-indigo-200"><ShieldCheck className="mr-2 h-3.5 w-3.5" /> Private by design</div>
    <h3 className="max-w-2xl text-3xl font-semibold leading-tight text-white md:text-5xl">Make your folders feel organized again.</h3>
    <p className="mt-4 max-w-xl text-sm leading-6 text-slate-400 md:text-base">Scan a folder on your device, find exact duplicate files, and sort items into type-based folders. You choose what changes happen.</p>
    <button onClick={onChoose} className="mt-7 flex items-center gap-2 rounded-xl bg-indigo-500 px-5 py-3 text-sm font-semibold text-white hover:bg-indigo-400"><FolderOpen className="h-4 w-4" /> Choose a folder</button>
    <div className="mt-8 flex max-w-xl items-start gap-3 rounded-xl border border-slate-800 bg-slate-900/50 p-4 text-xs leading-5 text-slate-500"><HelpCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-slate-400" /><p>Folder access requires Chrome or Edge on HTTPS or localhost. Your browser asks before reading and again before writing. Cindy cannot access folders you have not selected.</p></div>
  </section>;
}

function Overview({ root, files, totalSize, duplicateGroups, duplicateBytes, emptyCount, categories, onChoose, onScan, onNavigate }: {
  root: FileSystemDirectoryHandle; files: LocalFile[]; totalSize: number; duplicateGroups: number; duplicateBytes: number; emptyCount: number;
  categories: { category: FileCategory; count: number; size: number }[]; onChoose: () => void; onScan: () => void; onNavigate: (page: Page) => void;
}) {
  if (!files.length) return <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6 md:p-10"><p className="text-xs uppercase tracking-wider text-indigo-300">Ready to scan</p><h3 className="mt-2 text-2xl font-semibold text-white">{root.name}</h3><p className="mt-2 max-w-xl text-sm leading-6 text-slate-400">Cindy will read file names, sizes, and modified dates. It only reads file contents when comparing same-sized files for exact duplicates.</p><button onClick={onScan} className="mt-6 rounded-lg bg-indigo-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-400">Scan this folder</button><button onClick={onChoose} className="ml-3 mt-6 rounded-lg border border-slate-700 px-4 py-2.5 text-sm text-slate-300 hover:bg-slate-800">Choose another</button></section>;
  const cards = [
    { label: 'Files found', value: files.length.toLocaleString(), sub: formatBytes(totalSize), icon: File, color: 'text-indigo-300 bg-indigo-400/10' },
    { label: 'Duplicate groups', value: duplicateGroups.toLocaleString(), sub: `${formatBytes(duplicateBytes)} reclaimable`, icon: Copy, color: 'text-rose-300 bg-rose-400/10' },
    { label: 'Empty files', value: emptyCount.toLocaleString(), sub: 'Review before deleting', icon: AlertTriangle, color: 'text-amber-300 bg-amber-400/10' },
    { label: 'File categories', value: String(categories.filter(item => item.count).length), sub: 'Based on extension', icon: Archive, color: 'text-emerald-300 bg-emerald-400/10' },
  ];
  return <>
    <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs uppercase tracking-wider text-indigo-300">Scan results</p><h3 className="mt-1 text-2xl font-semibold text-white">{root.name}</h3><p className="mt-1 text-sm text-slate-500">{files.length.toLocaleString()} files · {formatBytes(totalSize)} total</p></div><button onClick={onChoose} className="rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-300 hover:bg-slate-800">Change folder</button></div>
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{cards.map(card => { const Icon = card.icon; return <div key={card.label} className="rounded-xl border border-slate-800 bg-slate-900/60 p-4"><div className="flex items-center gap-3"><div className={`rounded-lg p-2 ${card.color}`}><Icon className="h-4 w-4" /></div><div><p className="text-xs text-slate-500">{card.label}</p><p className="text-xl font-semibold text-white">{card.value}</p></div></div><p className="mt-3 text-xs text-slate-500">{card.sub}</p></div>; })}</div>
    <div className="grid gap-5 lg:grid-cols-2"><section className="rounded-xl border border-slate-800 bg-slate-900/50 p-5"><div className="mb-4 flex items-center justify-between"><div><h4 className="font-medium text-white">By file type</h4><p className="text-xs text-slate-500">Sorted by extension, not file contents</p></div><button onClick={() => onNavigate('files')} className="text-xs text-indigo-300 hover:text-indigo-200">View files <ChevronRight className="inline h-3 w-3" /></button></div><div className="space-y-3">{categories.filter(item => item.count).map(item => { const Icon = categoryIcons[item.category]; return <div key={item.category} className="flex items-center gap-3"><Icon className="h-4 w-4 text-slate-400" /><span className="w-24 text-sm text-slate-300">{item.category}</span><div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-800"><div className="h-full rounded-full bg-indigo-400" style={{ width: `${Math.max(2, item.count / files.length * 100)}%` }} /></div><span className="w-10 text-right text-xs text-slate-500">{item.count}</span></div>; })}</div></section><section className="rounded-xl border border-slate-800 bg-slate-900/50 p-5"><h4 className="font-medium text-white">Next steps</h4><p className="mb-4 mt-1 text-xs text-slate-500">Nothing changes until you approve an action.</p><div className="space-y-2"><ActionRow title="Review exact duplicates" detail={`${duplicateGroups} group(s) · ${formatBytes(duplicateBytes)} reclaimable`} onClick={() => onNavigate('duplicates')} /><ActionRow title="Organize into type folders" detail={`${files.filter(file => !file.relativePath.startsWith(`${file.category}/`)).length} file(s) can be moved`} onClick={() => onNavigate('organize')} /><ActionRow title="Review all scanned files" detail={`${files.length.toLocaleString()} file(s) · rename or delete individually`} onClick={() => onNavigate('files')} /></div></section></div>
  </>;
}

function ActionRow({ title, detail, onClick }: { title: string; detail: string; onClick: () => void }) {
  return <button onClick={onClick} className="flex w-full items-center gap-3 rounded-lg border border-slate-800 bg-slate-950/40 p-3 text-left hover:border-slate-700 hover:bg-slate-800/60"><div className="min-w-0 flex-1"><p className="text-sm text-slate-200">{title}</p><p className="truncate text-xs text-slate-500">{detail}</p></div><ChevronRight className="h-4 w-4 text-slate-500" /></button>;
}

function FilesPage({ files, allCount, busy, search, setSearch, category, setCategory, onRename, onDelete }: {
  files: LocalFile[]; allCount: number; busy: boolean; search: string; setSearch: (value: string) => void;
  category: FileCategory | 'All'; setCategory: (value: FileCategory | 'All') => void; onRename: (file: LocalFile) => void; onDelete: (file: LocalFile) => void;
}) {
  return <>
    <section className="flex flex-wrap items-end justify-between gap-3"><div><h3 className="text-xl font-semibold text-white">Files</h3><p className="mt-1 text-sm text-slate-500">Rename or delete files. Destructive actions always ask for confirmation.</p></div><p className="text-xs text-slate-500">Showing {files.length} of {allCount}</p></section>
    <section className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900/50"><div className="flex flex-col gap-2 border-b border-slate-800 p-3 sm:flex-row"><div className="relative flex-1"><Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" /><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search names and folders" className="w-full rounded-lg border border-slate-700 bg-slate-950 py-2 pl-9 pr-3 text-sm text-white outline-none placeholder:text-slate-600 focus:border-indigo-400" /></div><select value={category} onChange={event => setCategory(event.target.value as FileCategory | 'All')} className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-300 outline-none"><option>All</option>{categories.map(item => <option key={item}>{item}</option>)}</select></div>
      {!files.length ? <EmptyState text="No matching files. Scan a folder first or change your search." /> : <div className="divide-y divide-slate-800">{files.map(file => <FileRow key={file.id} file={file} busy={busy} onRename={onRename} onDelete={onDelete} />)}</div>}
    </section>
  </>;
}

function FileRow({ file, busy, onRename, onDelete }: { file: LocalFile; busy: boolean; onRename: (file: LocalFile) => void; onDelete: (file: LocalFile) => void }) {
  const Icon = categoryIcons[file.category];
  return <div className="flex flex-wrap items-center gap-3 px-4 py-3 hover:bg-slate-800/30"><div className="rounded-lg bg-slate-800 p-2"><Icon className="h-4 w-4 text-slate-300" /></div><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium text-slate-200">{file.name}</p><p className="truncate text-xs text-slate-500">{formatPath(file.relativePath)} · {file.category}</p></div><div className="w-20 text-right text-xs text-slate-400">{formatBytes(file.size)}</div><div className="hidden w-28 text-right text-xs text-slate-500 md:block">{formatDate(file.modified)}</div>{file.size === 0 && <span className="rounded bg-amber-500/10 px-2 py-1 text-[10px] text-amber-300">Empty</span>}<div className="flex gap-1"><button disabled={busy} onClick={() => onRename(file)} className="rounded-md px-2.5 py-1.5 text-xs text-slate-400 hover:bg-indigo-500/10 hover:text-indigo-300 disabled:opacity-40">Rename</button><button disabled={busy} onClick={() => onDelete(file)} aria-label={`Delete ${file.name}`} className="rounded-md p-1.5 text-slate-500 hover:bg-red-500/10 hover:text-red-300 disabled:opacity-40"><Trash2 className="h-4 w-4" /></button></div></div>;
}

function DuplicatesPage({ groups, busy, onDelete }: { groups: DuplicateGroup[]; busy: boolean; onDelete: (group: DuplicateGroup) => void }) {
  return <><section><h3 className="text-xl font-semibold text-white">Exact duplicates</h3><p className="mt-1 text-sm text-slate-500">Compared with SHA-256 hashes after grouping files by size. Files over 100 MB are skipped by the duplicate checker.</p></section>{!groups.length ? <EmptyState text="No exact duplicate files found. Scan a folder to compare same-sized files." /> : <div className="space-y-4">{groups.map(group => { const keep = [...group.files].sort((a, b) => a.modified - b.modified)[0]; return <section key={group.hash} className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900/50"><header className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 p-4"><div><p className="font-medium text-white">{group.files.length} identical files · {formatBytes(group.size)} each</p><p className="mt-1 font-mono text-[10px] text-slate-600">SHA-256 {group.hash}</p></div><button disabled={busy} onClick={() => onDelete(group)} className="rounded-lg border border-red-500/30 px-3 py-2 text-xs text-red-300 hover:bg-red-500/10 disabled:opacity-40">Keep oldest, delete copies</button></header><div className="divide-y divide-slate-800">{group.files.map(file => <div key={file.id} className="flex items-center gap-3 px-4 py-3"><div className={`h-2 w-2 rounded-full ${file.id === keep.id ? 'bg-emerald-400' : 'bg-rose-400'}`} /><div className="min-w-0 flex-1"><p className="truncate text-sm text-slate-300">{file.relativePath}</p><p className="text-xs text-slate-600">Modified {formatDate(file.modified)}{file.id === keep.id ? ' · Suggested copy to keep' : ''}</p></div><span className="text-xs text-slate-500">{formatBytes(file.size)}</span></div>)}</div></section>; })}</div>}</>;
}

function OrganizePage({ rootName, files, pending, busy, onOrganize }: { rootName: string; files: LocalFile[]; pending: LocalFile[]; busy: boolean; onOrganize: () => void }) {
  return <><section className="flex flex-wrap items-end justify-between gap-3"><div><h3 className="text-xl font-semibold text-white">Organize files</h3><p className="mt-1 max-w-2xl text-sm leading-5 text-slate-500">Move files into folders named Images, Documents, Videos, and so on inside <span className="text-slate-300">{rootName}</span>. Cindy will never overwrite an existing file; collisions get a numbered suffix.</p></div><button disabled={!pending.length || busy} onClick={onOrganize} className="rounded-lg bg-indigo-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-400 disabled:cursor-not-allowed disabled:opacity-40">{busy ? 'Working…' : `Move ${pending.length} file(s)`}</button></section><div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 text-xs leading-5 text-amber-100/80"><ShieldCheck className="mr-2 inline h-4 w-4 text-amber-300" />Moves use copy-then-delete: Cindy copies each file to its category folder and only removes the original after the copy succeeds. Approve write access when your browser asks.</div><section className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900/50"><div className="flex items-center justify-between border-b border-slate-800 px-4 py-3"><h4 className="text-sm font-medium text-white">Move preview</h4><span className="text-xs text-slate-500">{pending.length} to move · {files.length - pending.length} already organized</span></div>{!pending.length ? <EmptyState text="All scanned files are already inside their matching category folders." /> : <div className="divide-y divide-slate-800">{pending.slice(0, 250).map(file => <div key={file.id} className="flex items-center gap-3 px-4 py-3"><File className="h-4 w-4 flex-shrink-0 text-slate-500" /><div className="min-w-0 flex-1"><p className="truncate text-sm text-slate-300">{file.relativePath}</p></div><ChevronRight className="h-4 w-4 text-slate-600" /><span className="rounded-md bg-indigo-500/10 px-2 py-1 text-xs text-indigo-200">{file.category}/</span><span className="hidden w-16 text-right text-xs text-slate-500 sm:block">{formatBytes(file.size)}</span></div>)}{pending.length > 250 && <p className="p-3 text-center text-xs text-slate-500">Showing first 250 of {pending.length} files in the preview. The action includes all.</p>}</div>}</section></>;
}

function EmptyState({ text }: { text: string }) {
  return <div className="px-5 py-12 text-center"><File className="mx-auto h-7 w-7 text-slate-700" /><p className="mt-3 text-sm text-slate-500">{text}</p></div>;
}
