import React, { createContext, useContext, useEffect, useMemo, useReducer, useRef } from "react";
import {
  type FileRec,
  type RootFolder,
  type DupGroup,
  type FolderSuggestion,
  type LogEntry,
  type OpEntry,
  type OpKind,
  type Rule,
  type SavedView,
  type Settings,
  type Kind,
  uid,
  isProtected,
  extOf,
  fmtBytes,
  renderPath,
} from "../lib/core";
import { classify, generateName, groupDuplicates, normalizeName, parseCommand, sha256File, uniqueName, type CommandResult } from "../lib/engine";
import {
  seedFiles,
  seedRoots,
  seedGroups,
  seedFolderSuggestions,
  seedLogs,
  seedRules,
  seedViews,
  NOW,
} from "../data/seed";
import { blip, setAudioEnabled } from "../lib/audio";

const KEY = "sasha.state.v1";
const DAY = 86400000;

export interface Filters {
  query: string;
  kind: Kind | "all";
  minSize: number;
  olderThanDays: number;
  status: string;
  subject: string;
  root: string;
}

export const emptyFilters: Filters = { query: "", kind: "all", minSize: 0, olderThanDays: 0, status: "all", subject: "", root: "all" };

export interface ScanState {
  running: boolean;
  paused: boolean;
  done: number;
  total: number;
  rate: number;
  startedAt: number;
  current: string;
  phase: string;
  resumable: boolean;
  found: { dups: number; broken: number; renames: number };
}

export interface Toast {
  id: string;
  tone: "info" | "success" | "warn" | "danger" | "ai";
  title: string;
  message?: string;
  undoOp?: string;
  action?: { label: string; view: string };
}

export interface State {
  settings: Settings;
  roots: RootFolder[];
  ops: OpEntry[];
  imported: FileRec[];
  extraGroups: DupGroup[];
  folders: FolderSuggestion[];
  rules: Rule[];
  views: SavedView[];
  logs: LogEntry[];
  toasts: Toast[];
  scan: ScanState;
  view: string;
  drawer: string | null;
  selection: string[];
  filters: Filters;
  sort: string;
  commandOpen: boolean;
  lastCommand: CommandResult | null;
  suggestionEdits: Record<string, string>;
  bench: { running: boolean; done: number; total: number; result: null | { rate: number; ms: number; memMb: number; files: number } };
}

const defaultSettings: Settings = {
  platform: "windows",
  theme: "dark",
  sound: true,
  watch: true,
  threads: 4,
  memoryMb: 512,
  hashChunkKb: 1024,
  similarity: 92,
  nearThreshold: 88,
  visionModel: "clip-vit-b32 (ONNX · local)",
  ocrEnabled: true,
  localOnly: true,
  backups: true,
  backupRetention: 30,
  incremental: true,
  followSymlinks: false,
  minNameWords: 3,
  autoQueue: true,
};

const initialState: State = {
  settings: defaultSettings,
  roots: seedRoots,
  ops: [],
  imported: [],
  extraGroups: [],
  folders: seedFolderSuggestions,
  rules: seedRules,
  views: seedViews,
  logs: seedLogs,
  toasts: [],
  scan: { running: false, paused: false, done: 0, total: 0, rate: 0, startedAt: 0, current: "", phase: "idle", resumable: false, found: { dups: 0, broken: 0, renames: 0 } },
  view: "dashboard",
  drawer: null,
  selection: [],
  filters: emptyFilters,
  sort: "modified-desc",
  commandOpen: false,
  lastCommand: null,
  suggestionEdits: {},
  bench: { running: false, done: 0, total: 1_000_000, result: null },
};

type Action =
  | { type: "patch"; patch: Partial<State> }
  | { type: "settings"; patch: Partial<Settings> }
  | { type: "roots"; roots: RootFolder[] }
  | { type: "op"; op: OpEntry }
  | { type: "undo"; id: string; undone: boolean }
  | { type: "log"; entry: LogEntry }
  | { type: "toast"; toast: Toast }
  | { type: "untoast"; id: string }
  | { type: "scan"; patch: Partial<ScanState> }
  | { type: "import"; files: FileRec[] }
  | { type: "folders"; folders: FolderSuggestion[] }
  | { type: "rules"; rules: Rule[] }
  | { type: "views"; views: SavedView[] }
  | { type: "groups"; groups: DupGroup[] }
  | { type: "filters"; patch: Partial<Filters> }
  | { type: "selection"; ids: string[] }
  | { type: "suggestion"; id: string; name: string }
  | { type: "bench"; patch: Partial<State["bench"]> };

function reducer(s: State, a: Action): State {
  switch (a.type) {
    case "patch": return { ...s, ...a.patch };
    case "settings": return { ...s, settings: { ...s.settings, ...a.patch } };
    case "roots": return { ...s, roots: a.roots };
    case "op": return { ...s, ops: [...s.ops, a.op] };
    case "undo": return { ...s, ops: s.ops.map((o) => (o.id === a.id ? { ...o, undone: a.undone } : o)) };
    case "log": return { ...s, logs: [a.entry, ...s.logs].slice(0, 220) };
    case "toast": return { ...s, toasts: [...s.toasts.slice(-3), a.toast] };
    case "untoast": return { ...s, toasts: s.toasts.filter((t) => t.id !== a.id) };
    case "scan": return { ...s, scan: { ...s.scan, ...a.patch } };
    case "import": return { ...s, imported: [...a.files, ...s.imported].slice(0, 400) };
    case "folders": return { ...s, folders: a.folders };
    case "rules": return { ...s, rules: a.rules };
    case "views": return { ...s, views: a.views };
    case "groups": return { ...s, extraGroups: a.groups };
    case "filters": return { ...s, filters: { ...s.filters, ...a.patch } };
    case "selection": return { ...s, selection: a.ids };
    case "suggestion": return { ...s, suggestionEdits: { ...s.suggestionEdits, [a.id]: a.name } };
    case "bench": return { ...s, bench: { ...s.bench, ...a.patch } };
    default: return s;
  }
}

function loadPersisted(): State {
  try {
    // migrate sessions saved under the previous product name
    const raw = localStorage.getItem(KEY) ?? localStorage.getItem("verda.state.v1");
    if (!raw) return initialState;
    const p = JSON.parse(raw) as Partial<State>;
    return {
      ...initialState,
      ...p,
      settings: { ...defaultSettings, ...(p.settings ?? {}) },
      roots: p.roots?.length ? p.roots : seedRoots,
      toasts: [],
      drawer: null,
      selection: [],
      commandOpen: false,
      bench: initialState.bench,
      scan: { ...initialState.scan, resumable: !!p.scan?.resumable, done: p.scan?.done ?? 0, total: p.scan?.total ?? 0 },
    };
  } catch {
    return initialState;
  }
}

export function applyOps(base: FileRec[], ops: OpEntry[]): FileRec[] {
  const active = ops.filter((o) => !o.undone);
  if (!active.length) return base;
  const patches = new Map<string, Partial<FileRec>>();
  active.forEach((op) => op.patches.forEach((p) => patches.set(p.id, { ...(patches.get(p.id) ?? {}), ...p.after })));
  return base.map((f) => (patches.has(f.id) ? { ...f, ...patches.get(f.id)! } : f));
}

export interface Derived {
  files: FileRec[];
  byId: Map<string, FileRec>;
  live: FileRec[];
  groups: (DupGroup & { members: FileRec[]; reclaimable: number })[];
  resolvedGroups: number;
  broken: FileRec[];
  renames: FileRec[];
  downloads: FileRec[];
  stats: {
    totalBytes: number;
    fileCount: number;
    dupReclaim: number;
    brokenBytes: number;
    savedBytes: number;
    movedCount: number;
    renamedCount: number;
    deletedCount: number;
    archivedCount: number;
    byKind: { kind: Kind; bytes: number; count: number }[];
    byRoot: { id: string; label: string; bytes: number; count: number }[];
    large: FileRec[];
    old: FileRec[];
  };
  pending: { duplicates: number; broken: number; rename: number; organize: number; folders: number };
}

interface Ctx {
  s: State;
  d: Derived;
  api: Api;
}

export interface Api {
  go: (view: string) => void;
  setSetting: <K extends keyof Settings>(k: K, v: Settings[K]) => void;
  setFilters: (p: Partial<Filters>) => void;
  resetFilters: () => void;
  setSort: (s: string) => void;
  select: (ids: string[]) => void;
  toggleSelect: (id: string) => void;
  openDrawer: (id: string | null) => void;
  toast: (t: Omit<Toast, "id">) => void;
  dismissToast: (id: string) => void;
  log: (level: LogEntry["level"], source: string, message: string) => void;
  startScan: (rootIds?: string[]) => void;
  pauseScan: () => void;
  resumeScan: () => void;
  stopScan: () => void;
  moveFiles: (ids: string[], destFor?: (f: FileRec) => string, label?: string) => void;
  renameFiles: (items: { id: string; name: string }[]) => void;
  deleteFiles: (ids: string[], reason: string) => void;
  archiveFiles: (ids: string[], reason: string) => void;
  repairFiles: (ids: string[]) => void;
  ignoreFiles: (ids: string[], reason: string) => void;
  keepFiles: (ids: string[], reason: string) => void;
  setKeep: (groupId: string, fileId: string) => void;
  resolveGroup: (groupId: string, action: "delete" | "keep" | "review" | "ignore") => void;
  redetect: () => void;
  setSuggestion: (id: string, name: string) => void;
  autoSuggest: (id: string) => void;
  decideFolder: (id: string, state: "approved" | "rejected", name?: string) => void;
  addRoot: (dir: string) => boolean;
  toggleRoot: (id: string, key: "enabled" | "watch" | "recursive") => void;
  removeRoot: (id: string) => void;
  importFiles: (list: FileList | File[]) => Promise<void>;
  undo: (id: string) => void;
  redo: (id: string) => void;
  undoLast: () => void;
  runCommand: (text: string) => void;
  setCommandOpen: (v: boolean) => void;
  setRules: (r: Rule[]) => void;
  setViews: (v: SavedView[]) => void;
  applyView: (v: SavedView) => void;
  runBench: () => void;
  extractArchive: (id: string) => void;
  resetAll: () => void;
}

const AppCtx = createContext<Ctx | null>(null);
export const useApp = () => {
  const c = useContext(AppCtx);
  if (!c) throw new Error("useApp outside provider");
  return c;
};

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [s, dispatch] = useReducer(reducer, undefined, loadPersisted);
  const sRef = useRef(s);
  sRef.current = s;
  const scanTimer = useRef<number | null>(null);
  const scanCursor = useRef(0);
  const scanQueue = useRef<FileRec[]>([]);
  const benchCancel = useRef<null | (() => void)>(null);

  /* ---------- derived ---------- */
  const files = useMemo(() => applyOps([...seedFiles, ...s.imported], s.ops), [s.imported, s.ops]);
  const d = useMemo<Derived>(() => {
    const byId = new Map(files.map((f) => [f.id, f]));
    const live = files.filter((f) => f.status !== "deleted");
    const resolutions = new Map<string, DupGroup["resolved"]>();
    const keeps = new Map<string, string>();
    s.ops.filter((o) => !o.undone).forEach((o) => {
      o.groupPatch?.forEach((g) => {
        resolutions.set(g.id, g.after);
        if (g.after === "keep" || g.after === undefined) keeps.set(g.id, keeps.get(g.id) ?? "");
      });
      if (o.kind === "keep" && o.groupPatch?.length) keeps.set(o.groupPatch[0].id, (o as OpEntry & { keepId?: string }).keepId ?? keeps.get(o.groupPatch[0].id) ?? "");
    });
    const allGroups = [...seedGroups, ...s.extraGroups];
    const seen = new Set<string>();
    const groups = allGroups
      .filter((g) => (seen.has(g.id) ? false : (seen.add(g.id), true)))
      .map((g) => {
        const members = g.fileIds.map((id) => byId.get(id)!).filter(Boolean).filter((f) => f.status !== "deleted");
        const keepId = members.some((m) => m.id === g.keepId) ? g.keepId : members[0]?.id;
        return {
          ...g,
          keepId,
          members,
          resolved: resolutions.get(g.id),
          reclaimable: members.filter((m) => m.id !== keepId).reduce((a, b) => a + b.size, 0),
        };
      })
      .filter((g) => g.members.length > 1);

    const broken = live.filter((f) => f.broken && f.status !== "ignored" && f.status !== "repaired");
    const renames = live.filter((f) => f.suggestion && f.status !== "ignored" && f.status !== "renamed" && f.name !== (s.suggestionEdits[f.id] ?? f.suggestion.name));
    const downloads = live.filter((f) => f.rootId === "downloads" && f.status === "indexed");

    const byKindMap = new Map<Kind, { bytes: number; count: number }>();
    const byRootMap = new Map<string, { bytes: number; count: number }>();
    live.forEach((f) => {
      const k = byKindMap.get(f.kind) ?? { bytes: 0, count: 0 };
      byKindMap.set(f.kind, { bytes: k.bytes + f.size, count: k.count + 1 });
      const rr = byRootMap.get(f.rootId) ?? { bytes: 0, count: 0 };
      byRootMap.set(f.rootId, { bytes: rr.bytes + f.size, count: rr.count + 1 });
    });

    const active = s.ops.filter((o) => !o.undone);
    const sum = (kinds: OpKind[]) => active.filter((o) => kinds.includes(o.kind)).reduce((a, b) => a + b.bytes, 0);
    const count = (kinds: OpKind[]) => active.filter((o) => kinds.includes(o.kind)).reduce((a, b) => a + b.patches.length, 0);

    return {
      files,
      byId,
      live,
      groups,
      resolvedGroups: Array.from(resolutions.values()).filter(Boolean).length,
      broken,
      renames,
      downloads,
      stats: {
        totalBytes: live.reduce((a, b) => a + b.size, 0),
        fileCount: live.length,
        dupReclaim: groups.filter((g) => !g.resolved).reduce((a, b) => a + b.reclaimable, 0),
        brokenBytes: broken.reduce((a, b) => a + b.size, 0),
        savedBytes: sum(["delete"]),
        movedCount: count(["move"]),
        renamedCount: count(["rename"]),
        deletedCount: count(["delete"]),
        archivedCount: count(["archive"]),
        byKind: Array.from(byKindMap, ([kind, v]) => ({ kind, ...v })).sort((a, b) => b.bytes - a.bytes),
        byRoot: Array.from(byRootMap, ([id, v]) => ({ id, label: s.roots.find((r) => r.id === id)?.label ?? id, ...v })).sort((a, b) => b.bytes - a.bytes),
        large: live.filter((f) => f.size >= 1024 ** 3).sort((a, b) => b.size - a.size),
        old: live.filter((f) => NOW - f.modified > 365 * DAY).sort((a, b) => a.modified - b.modified),
      },
      pending: {
        duplicates: groups.filter((g) => !g.resolved).length,
        broken: broken.length,
        rename: renames.length,
        organize: downloads.length,
        folders: s.folders.filter((f) => f.state === "pending").length,
      },
    };
  }, [files, s.ops, s.extraGroups, s.suggestionEdits, s.folders, s.roots]);

  const dRef = useRef(d);
  dRef.current = d;

  /* ---------- persistence ---------- */
  useEffect(() => {
    const t = setTimeout(() => {
      try {
        const { settings, roots, ops, imported, folders, rules, views, logs, extraGroups, suggestionEdits, scan } = sRef.current;
        localStorage.setItem(
          KEY,
          JSON.stringify({
            settings, roots, ops: ops.slice(-120), imported: imported.slice(0, 60), folders, rules, views,
            logs: logs.slice(0, 60), extraGroups, suggestionEdits,
            scan: { resumable: scan.resumable, done: scan.done, total: scan.total },
          }),
        );
      } catch {
        /* quota — keep running in-memory */
      }
    }, 400);
    return () => clearTimeout(t);
  }, [s.settings, s.roots, s.ops, s.imported, s.folders, s.rules, s.views, s.logs, s.extraGroups, s.suggestionEdits, s.scan.resumable, s.scan.done]);

  useEffect(() => {
    document.documentElement.dataset.theme = s.settings.theme;
    setAudioEnabled(s.settings.sound);
  }, [s.settings.theme, s.settings.sound]);

  /* ---------- api ---------- */
  const api = useMemo<Api>(() => {
    const log: Api["log"] = (level, source, message) =>
      dispatch({ type: "log", entry: { id: uid("log"), at: Date.now(), level, source, message } });

    const toast: Api["toast"] = (t) => {
      const id = uid("t");
      dispatch({ type: "toast", toast: { ...t, id } });
      window.setTimeout(() => dispatch({ type: "untoast", id }), t.undoOp ? 9000 : 5200);
    };

    const backupPath = () => {
      const dt = new Date();
      const stamp = `${dt.toISOString().slice(0, 10)}T${String(dt.getHours()).padStart(2, "0")}-${String(dt.getMinutes()).padStart(2, "0")}-${String(dt.getSeconds()).padStart(2, "0")}`;
      return `.sasha/backups/${stamp}`;
    };

    const makeOp = (
      kind: OpKind,
      label: string,
      detail: string,
      targets: FileRec[],
      after: (f: FileRec) => Partial<FileRec>,
      bytes?: number,
    ): OpEntry => ({
      id: uid("op"),
      kind,
      at: Date.now(),
      label,
      detail,
      bytes: bytes ?? targets.reduce((a, b) => a + b.size, 0),
      backup: backupPath(),
      undone: false,
      patches: targets.map((f) => {
        const a = after(f);
        const before: Partial<FileRec> = {};
        (Object.keys(a) as (keyof FileRec)[]).forEach((k) => ((before as Record<string, unknown>)[k] = f[k]));
        return { id: f.id, before, after: a };
      }),
    });

    const commit = (op: OpEntry, tone: Toast["tone"], message: string, sound: Parameters<typeof blip>[0] = "approve") => {
      dispatch({ type: "op", op });
      log(tone === "danger" ? "danger" : "success", op.kind, `${op.label} — ${op.detail}`);
      blip(sound);
      toast({ tone, title: message, message: `Backup: ${op.backup}`, undoOp: op.id });
      dispatch({ type: "selection", ids: [] });
    };

    const targetsOf = (ids: string[]) => ids.map((id) => dRef.current.byId.get(id)).filter(Boolean) as FileRec[];

    const stopTimer = () => {
      if (scanTimer.current !== null) {
        window.clearInterval(scanTimer.current);
        scanTimer.current = null;
      }
    };

    const tick = () => {
      const st = sRef.current;
      const total = scanQueue.current.length;
      const chunk = Math.max(4, st.settings.threads * 6);
      scanCursor.current = Math.min(total, scanCursor.current + chunk);
      const done = scanCursor.current;
      const pct = done / Math.max(1, total);
      const phase = pct < 0.14 ? "Walking directories" : pct < 0.58 ? "Hashing · SHA-256" : pct < 0.84 ? "Vision embeddings · ONNX" : "Integrity verification";
      const cur = scanQueue.current[Math.max(0, done - 1)];
      const elapsed = (performance.now() - (st.scan.startedAt || performance.now())) / 1000;
      dispatch({
        type: "scan",
        patch: {
          done,
          phase,
          current: cur ? renderPath(cur.dir, st.settings.platform, cur.name) : "",
          rate: Math.round(done / Math.max(0.2, elapsed)),
          found: {
            dups: Math.round(dRef.current.groups.length * Math.min(1, pct * 1.6)),
            broken: Math.round(dRef.current.broken.length * Math.min(1, pct * 1.3)),
            renames: Math.round(dRef.current.renames.length * Math.min(1, pct * 1.1)),
          },
        },
      });
      if (done % (chunk * 6) < chunk && cur) log("info", "scanner", `${phase} · ${cur.dir}`);
      if (done >= total) {
        stopTimer();
        dispatch({ type: "scan", patch: { running: false, paused: false, phase: "complete", resumable: false, current: "" } });
        dispatch({
          type: "roots",
          roots: sRef.current.roots.map((r) => (r.enabled ? { ...r, lastScan: Date.now(), files: dRef.current.files.filter((f) => f.rootId === r.id).length } : r)),
        });
        log("success", "scanner", `Scan complete — ${total.toLocaleString()} files indexed, checkpoint committed to sasha.db`);
        blip("done");
        toast({
          tone: "success",
          title: `Scan complete · ${total.toLocaleString()} files`,
          message: `${dRef.current.groups.length} duplicate groups · ${dRef.current.broken.length} damaged files · ${dRef.current.renames.length} rename ideas`,
          action: { label: "Review", view: "duplicates" },
        });
      }
    };

    const startScan: Api["startScan"] = (rootIds) => {
      stopTimer();
      const st = sRef.current;
      const enabled = new Set(rootIds ?? st.roots.filter((r) => r.enabled).map((r) => r.id));
      if (!enabled.size) {
        toast({ tone: "warn", title: "No folders selected", message: "Enable at least one root folder to scan." });
        return;
      }
      scanQueue.current = dRef.current.files.filter((f) => enabled.has(f.rootId) && f.status !== "deleted");
      scanCursor.current = 0;
      dispatch({
        type: "scan",
        patch: { running: true, paused: false, done: 0, total: scanQueue.current.length, startedAt: performance.now(), phase: "Walking directories", resumable: false, found: { dups: 0, broken: 0, renames: 0 } },
      });
      log("info", "scanner", `Scan started — ${enabled.size} roots, ${st.settings.threads} worker threads, incremental=${st.settings.incremental}`);
      blip("open");
      scanTimer.current = window.setInterval(tick, 90);
    };

    return {
      go: (view) => {
        dispatch({ type: "patch", patch: { view  } });
        blip("tick");
      },
      setSetting: (k, v) => dispatch({ type: "settings", patch: { [k]: v } as Partial<Settings> }),
      setFilters: (p) => dispatch({ type: "filters", patch: p }),
      resetFilters: () => dispatch({ type: "filters", patch: emptyFilters }),
      setSort: (sort) => dispatch({ type: "patch", patch: { sort  } }),
      select: (ids) => dispatch({ type: "selection", ids }),
      toggleSelect: (id) => {
        const cur = sRef.current.selection;
        dispatch({ type: "selection", ids: cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id] });
      },
      openDrawer: (id) => {
        dispatch({ type: "patch", patch: { drawer: id  } });
        if (id) blip("open");
      },
      toast,
      dismissToast: (id) => dispatch({ type: "untoast", id }),
      log,
      startScan,
      pauseScan: () => {
        stopTimer();
        dispatch({ type: "scan", patch: { running: false, paused: true, resumable: true, phase: "paused" } });
        log("warn", "scanner", `Scan paused at ${scanCursor.current.toLocaleString()} files — cursor checkpointed, safe to resume`);
      },
      resumeScan: () => {
        if (!scanQueue.current.length) {
          startScan();
          return;
        }
        dispatch({ type: "scan", patch: { running: true, paused: false, resumable: false, startedAt: performance.now() - (scanCursor.current / 24) * 90 } });
        log("info", "scanner", `Resuming scan from checkpoint ${scanCursor.current.toLocaleString()}`);
        scanTimer.current = window.setInterval(tick, 90);
      },
      stopScan: () => {
        stopTimer();
        dispatch({ type: "scan", patch: { running: false, paused: false, resumable: scanCursor.current > 0, phase: "cancelled" } });
        log("warn", "scanner", "Scan cancelled by user — partial index retained");
      },

      moveFiles: (ids, destFor, label) => {
        const targets = targetsOf(ids).filter((f) => f.status !== "deleted");
        if (!targets.length) return;
        // Reserve destination names up front: a batch can never overwrite an
        // existing file, and two files moving into the same folder cannot clash.
        const targetIds = new Set(targets.map((f) => f.id));
        const occupied = new Map<string, Set<string>>();
        dRef.current.live.filter((f) => !targetIds.has(f.id)).forEach((f) => {
          const set = occupied.get(f.dir) ?? new Set<string>();
          set.add(f.name.toLowerCase());
          occupied.set(f.dir, set);
        });
        const planned = new Map<string, { dir: string; name: string }>();
        targets.forEach((f) => {
          const dir = destFor ? destFor(f) : f.dest ?? classify(f.name, f.dir, sRef.current.rules).dest;
          const set = occupied.get(dir) ?? new Set<string>();
          const name = uniqueName(f.name, set);
          set.add(name.toLowerCase());
          occupied.set(dir, set);
          planned.set(f.id, { dir, name });
        });
        const op = makeOp(
          "move",
          label ?? `Moved ${targets.length} file${targets.length > 1 ? "s" : ""}`,
          `${targets.length} files organised into taxonomy folders`,
          targets,
          (f) => ({ dir: planned.get(f.id)!.dir, name: planned.get(f.id)!.name, status: "moved" as const, prev: { name: f.name, dir: f.dir } }),
        );
        commit(op, "success", `${targets.length} file${targets.length > 1 ? "s" : ""} moved · originals backed up`);
      },

      renameFiles: (items) => {
        const targets = items.map((i) => ({ f: dRef.current.byId.get(i.id), name: i.name })).filter((x) => x.f) as { f: FileRec; name: string }[];
        if (!targets.length) return;
        // Enforce the naming contract here too, so every entry point (drawer,
        // studio, explorer bulk action) gets lowercase, hyphenated, unique names.
        const ids = new Set(targets.map((t) => t.f.id));
        const occupied = new Map<string, Set<string>>();
        dRef.current.live.filter((f) => !ids.has(f.id)).forEach((f) => {
          const set = occupied.get(f.dir) ?? new Set<string>();
          set.add(f.name.toLowerCase());
          occupied.set(f.dir, set);
        });
        const finalNames = new Map<string, string>();
        targets.forEach((t) => {
          const set = occupied.get(t.f.dir) ?? new Set<string>();
          const name = uniqueName(normalizeName(t.name, t.f.ext), set);
          set.add(name.toLowerCase());
          occupied.set(t.f.dir, set);
          finalNames.set(t.f.id, name);
        });
        const op = makeOp(
          "rename",
          `Renamed ${targets.length} file${targets.length > 1 ? "s" : ""}`,
          targets.slice(0, 3).map((t) => `${t.f.name} → ${finalNames.get(t.f.id)}`).join(" · ") + (targets.length > 3 ? ` +${targets.length - 3} more` : ""),
          targets.map((t) => t.f),
          (f) => ({ name: finalNames.get(f.id)!, suggestion: undefined, status: "renamed" as const, prev: { name: f.name, dir: f.dir } }),
        );
        commit(op, "success", `${targets.length} file${targets.length > 1 ? "s" : ""} renamed`);
      },

      deleteFiles: (ids, reason) => {
        const targets = targetsOf(ids).filter((f) => f.status !== "deleted");
        if (!targets.length) return;
        const bytes = targets.reduce((a, b) => a + b.size, 0);
        const op = makeOp("delete", `Deleted ${targets.length} file${targets.length > 1 ? "s" : ""}`, `${reason} · ${fmtBytes(bytes)} reclaimable`, targets, () => ({ status: "deleted" as const, prev: { name: targets[0].name, dir: targets[0].dir } }), bytes);
        commit(op, "danger", `${fmtBytes(bytes)} moved to ${sRef.current.settings.platform === "windows" ? "Recycle Bin" : "Trash"} — recoverable`, "alert");
      },

      archiveFiles: (ids, reason) => {
        const targets = targetsOf(ids).filter((f) => f.status !== "deleted");
        if (!targets.length) return;
        const stamp = new Date().toISOString().slice(0, 10);
        const op = makeOp("archive", `Archived ${targets.length} file${targets.length > 1 ? "s" : ""}`, reason, targets, (f) => ({
          dir: `.sasha/Review/${stamp}/${f.dir}`,
          status: "archived" as const,
          prev: { name: f.name, dir: f.dir },
        }));
        commit(op, "info", `${targets.length} file${targets.length > 1 ? "s" : ""} moved to Review folder`);
      },

      repairFiles: (ids) => {
        const targets = targetsOf(ids).filter((f) => f.broken?.repairable);
        if (!targets.length) {
          toast({ tone: "warn", title: "Nothing repairable selected", message: "These files have no safe automated repair path." });
          return;
        }
        const op = makeOp("repair", `Repaired ${targets.length} file${targets.length > 1 ? "s" : ""}`, targets.map((t) => t.broken!.repairMethod).join(" · "), targets, () => ({ broken: undefined, status: "repaired" as const, signature: "— header rebuilt —" }));
        commit(op, "success", `${targets.length} file${targets.length > 1 ? "s" : ""} repaired · original preserved in backup`);
      },

      ignoreFiles: (ids, reason) => {
        const targets = targetsOf(ids);
        if (!targets.length) return;
        const op = makeOp("ignore", `Ignored ${targets.length} item${targets.length > 1 ? "s" : ""}`, reason, targets, () => ({ status: "ignored" as const }), 0);
        dispatch({ type: "op", op });
        log("info", "review", `${targets.length} items marked ignored — they stay untouched on disk`);
        toast({ tone: "info", title: "Marked as ignored", message: "Sasha Maid will not suggest these again.", undoOp: op.id });
      },

      keepFiles: (ids, reason) => {
        const targets = targetsOf(ids);
        if (!targets.length) return;
        const op = makeOp("keep", `Kept ${targets.length} file${targets.length > 1 ? "s" : ""}`, reason, targets, () => ({ starred: true }), 0);
        dispatch({ type: "op", op });
        log("success", "review", `${targets.length} files pinned as originals`);
        blip("approve");
        toast({ tone: "success", title: "Kept as original", message: reason, undoOp: op.id });
      },

      setKeep: (groupId, fileId) => {
        const op: OpEntry = {
          id: uid("op"), kind: "keep", at: Date.now(), label: "Changed kept original", detail: `Group ${groupId}`, bytes: 0,
          backup: backupPath(), undone: false, patches: [], groupPatch: [{ id: groupId, after: undefined }],
        };
        (op as OpEntry & { keepId?: string }).keepId = fileId;
        dispatch({ type: "op", op });
        dispatch({ type: "groups", groups: sRef.current.extraGroups.map((g) => (g.id === groupId ? { ...g, keepId: fileId } : g)) });
        const seedG = seedGroups.find((g) => g.id === groupId);
        if (seedG) seedG.keepId = fileId;
        blip("tick");
      },

      resolveGroup: (groupId, action) => {
        const g = dRef.current.groups.find((x) => x.id === groupId);
        if (!g) return;
        const keep = g.members.find((m) => m.id === g.keepId);
        const others = g.members.filter((m) => m.id !== g.keepId);
        const stamp = new Date().toISOString().slice(0, 10);
        // One journal entry owns both the file patches and the group state, so
        // undo restores the files *and* returns the group to the review queue.
        const op =
          action === "keep"
            ? makeOp("keep", "Kept duplicate group", g.reason, g.members, () => ({ starred: true }), 0)
            : action === "delete"
              ? makeOp("delete", `Deleted ${others.length} duplicate${others.length === 1 ? "" : "s"}`,
                `Copies of ${keep?.name ?? "the original"} · ${fmtBytes(others.reduce((a, b) => a + b.size, 0))} reclaimable`,
                others, () => ({ status: "deleted" as const }), others.reduce((a, b) => a + b.size, 0))
              : action === "review"
                ? makeOp("archive", `Archived ${others.length} duplicate${others.length === 1 ? "" : "s"}`,
                  "Duplicate group moved to Review folder", others, (f) => ({
                    dir: `.sasha/Review/${stamp}/${f.dir}`, status: "archived" as const, prev: { name: f.name, dir: f.dir },
                  }))
                : makeOp("ignore", "Ignored duplicate group", g.reason, others, () => ({ status: "ignored" as const }), 0);
        op.groupPatch = [{ id: groupId, after: action }];
        commit(
          op,
          action === "delete" ? "danger" : action === "review" ? "info" : action === "keep" ? "success" : "info",
          action === "delete"
            ? `${fmtBytes(op.bytes)} moved to ${sRef.current.settings.platform === "windows" ? "Recycle Bin" : "Trash"} — recoverable`
            : action === "review" ? "Duplicates moved to Review folder" : action === "keep" ? "All copies kept intentionally" : "Duplicate group ignored",
          action === "delete" ? "alert" : "approve",
        );
      },

      redetect: () => {
        const candidates = dRef.current.live.filter((f) => f.kind === "image" || f.tags.includes("dup-candidate"));
        const found = groupDuplicates(candidates, sRef.current.settings.similarity / 100, sRef.current.settings.nearThreshold / 100);
        dispatch({ type: "groups", groups: found });
        log("ai", "similarity", `Re-ran detection on ${candidates.length.toLocaleString()} candidates → ${found.length} clusters (faiss IVF, ${sRef.current.settings.similarity}% threshold)`);
        blip("done");
        toast({ tone: "ai", title: `${found.length} clusters recomputed`, message: `Visual threshold ${sRef.current.settings.similarity}% · near-text ${sRef.current.settings.nearThreshold}%` });
      },

      setSuggestion: (id, name) => dispatch({ type: "suggestion", id, name }),
      autoSuggest: (id) => {
        const f = dRef.current.byId.get(id);
        if (!f) return;
        const g = generateName(f);
        dispatch({ type: "suggestion", id, name: g.name });
        log("ai", "vision", `Regenerated name for ${f.name} → ${g.name} (${Math.round(g.confidence * 100)}%)`);
        blip("tick");
      },

      decideFolder: (id, state, name) => {
        const sug = sRef.current.folders.find((f) => f.id === id);
        if (!sug) return;
        if (state === "rejected") {
          dispatch({ type: "folders", folders: sRef.current.folders.map((f) => (f.id === id ? { ...f, state } : f)) });
          log("info", "naming", `Folder suggestion rejected: ${sug.current}`);
          toast({ tone: "info", title: "Suggestion dismissed", message: `${sug.current} keeps its name.` });
          return;
        }
        const newName = (name ?? sug.suggested).trim().replace(/[\\/]/g, "-").replace(/\.\./g, "");
        if (!newName) {
          toast({ tone: "warn", title: "Folder name required", message: "Choose a non-empty name without path separators." });
          return;
        }
        const parent = sug.dir.includes("/") ? sug.dir.slice(0, sug.dir.lastIndexOf("/")) : "";
        const newDir = parent ? `${parent}/${newName}` : newName;
        const affected = dRef.current.live.filter((f) => f.dir === sug.dir || f.dir.startsWith(sug.dir + "/"));
        const op = makeOp(
          "folder-rename",
          `Folder renamed → ${newName}`,
          `${sug.dir} → ${newDir} · ${affected.length} files re-pathed`,
          affected,
          (f) => ({ dir: newDir + f.dir.slice(sug.dir.length), status: "moved" as const, prev: { name: f.name, dir: f.dir } }),
          0,
        );
        op.folderPatch = { id, before: sug.current, after: newName };
        dispatch({ type: "op", op });
        dispatch({ type: "folders", folders: sRef.current.folders.map((f) => (f.id === id ? { ...f, state, suggested: newName, current: newName, dir: newDir } : f)) });
        log("success", "naming", `Folder renamed ${sug.dir} → ${newDir} (${affected.length} files)`);
        blip("approve");
        toast({ tone: "success", title: `Renamed to “${newName}”`, message: `${affected.length} files re-pathed`, undoOp: op.id });
      },

      addRoot: (dir) => {
        const clean = dir.trim().replace(/\\/g, "/").replace(/\/+$/, "");
        if (!clean) return false;
        const blocked = isProtected(clean);
        if (blocked) {
          blip("alert");
          log("danger", "safety", `Refused to watch protected system path: ${clean}`);
          toast({ tone: "danger", title: "Protected system path", message: `${blocked} is OS-critical and can never be scanned or modified.` });
          return false;
        }
        const label = clean.split("/").filter(Boolean).pop() ?? clean;
        if (sRef.current.roots.some((r) => r.dir.toLowerCase() === clean.toLowerCase())) {
          toast({ tone: "warn", title: "Already watched", message: `${label} is in your folder list.` });
          return false;
        }
        const root: RootFolder = { id: uid("root"), label, dir: clean, enabled: true, recursive: true, files: 0, lastScan: null, watch: true };
        dispatch({ type: "roots", roots: [...sRef.current.roots, root] });
        log("success", "watcher", `Added root ${clean} (recursive)`);
        blip("approve");
        toast({ tone: "success", title: `Watching ${label}`, message: "Run a scan to index it." });
        return true;
      },

      toggleRoot: (id, key) =>
        dispatch({ type: "roots", roots: sRef.current.roots.map((r) => (r.id === id ? { ...r, [key]: !r[key] } : r)) }),

      removeRoot: (id) => {
        const r = sRef.current.roots.find((x) => x.id === id);
        dispatch({ type: "roots", roots: sRef.current.roots.filter((x) => x.id !== id) });
        log("warn", "watcher", `Removed root ${r?.dir ?? id} — indexed records kept, files untouched`);
        toast({ tone: "info", title: "Folder removed from watch list", message: "No files were touched." });
      },

      importFiles: async (list) => {
        const arr = Array.from(list).slice(0, 60);
        if (!arr.length) return;
        const out: FileRec[] = [];
        for (const file of arr) {
          const hash = await sha256File(file);
          const c = classify(file.name, "Downloads", sRef.current.rules);
          let photo: string | undefined;
          if (file.type.startsWith("image/") && file.size < 25 * 1024 * 1024) {
            photo = await new Promise<string | undefined>((res) => {
              const url = URL.createObjectURL(file);
              const img = new Image();
              img.onload = () => {
                try {
                  const cv = document.createElement("canvas");
                  const w = 360;
                  cv.width = w;
                  cv.height = Math.max(1, Math.round((img.height / img.width) * w));
                  cv.getContext("2d")!.drawImage(img, 0, 0, cv.width, cv.height);
                  res(cv.toDataURL("image/jpeg", 0.72));
                } catch {
                  res(undefined);
                }
                URL.revokeObjectURL(url);
              };
              img.onerror = () => {
                res(undefined);
                URL.revokeObjectURL(url);
              };
              img.src = url;
            });
          }
          const dupe = dRef.current.live.find((f) => f.hash === hash);
          out.push({
            id: uid("imp"), name: file.name, ext: extOf(file.name), dir: "Downloads/Inbox", rootId: "downloads",
            size: file.size, modified: file.lastModified || Date.now(), created: Date.now(), kind: c.kind, mime: file.type || c.mime,
            signature: c.signature, status: "indexed", hash, phash: c.kind === "image" ? hash.slice(0, 16) : undefined,
            tags: ["imported"], bucket: c.bucket, dest: c.dest, photo, dupGroup: dupe?.dupGroup,
          });
        }
        dispatch({ type: "import", files: out });
        const bytes = out.reduce((a, b) => a + b.size, 0);
        const op: OpEntry = {
          id: uid("op"), kind: "import", at: Date.now(), label: `Ingested ${out.length} dropped file${out.length > 1 ? "s" : ""}`,
          detail: `${fmtBytes(bytes)} hashed with real SHA-256 (WebCrypto)`, bytes: 0, backup: backupPath(), undone: false, patches: [],
        };
        dispatch({ type: "op", op });
        log("success", "ingest", `${out.length} files hashed and classified into the index (${fmtBytes(bytes)})`);
        blip("done");
        toast({ tone: "success", title: `${out.length} file${out.length > 1 ? "s" : ""} ingested`, message: "Real SHA-256 computed locally — nothing uploaded.", action: { label: "Open explorer", view: "explorer" } });
      },

      undo: (id) => {
        const op = sRef.current.ops.find((o) => o.id === id);
        if (!op || op.undone) return;
        dispatch({ type: "undo", id, undone: true });
        if (op.folderPatch) {
          dispatch({ type: "folders", folders: sRef.current.folders.map((f) => (f.id === op.folderPatch!.id ? { ...f, state: "pending", current: op.folderPatch!.before } : f)) });
        }
        log("warn", "undo", `Reverted: ${op.label} — restored from ${op.backup}`);
        blip("undo");
        toast({ tone: "info", title: "Operation reverted", message: op.label });
      },

      redo: (id) => {
        dispatch({ type: "undo", id, undone: false });
        log("success", "undo", `Re-applied operation ${id}`);
        blip("approve");
      },

      undoLast: () => {
        const last = [...sRef.current.ops].reverse().find((o) => !o.undone && o.patches.length + (o.folderPatch ? 1 : 0) > 0);
        if (!last) {
          toast({ tone: "info", title: "Nothing to undo", message: "No file operations in this session yet." });
          return;
        }
        api.undo(last.id);
      },

      runCommand: (text) => {
        const res = parseCommand(text);
        dispatch({ type: "patch", patch: { lastCommand: res, view: res.view, commandOpen: false  } });
        if (res.filter) dispatch({ type: "filters", patch: { ...emptyFilters, ...res.filter } as Partial<Filters> });
        log("ai", "librarian", `“${text}” → intent:${res.intent} · ${res.message}`);
        blip("open");
        if (res.action === "scan") window.setTimeout(() => api.startScan(), 250);
        toast({ tone: "ai", title: "Librarian", message: res.message });
      },

      setCommandOpen: (v) => dispatch({ type: "patch", patch: { commandOpen: v  } }),

      setRules: (rules) => dispatch({ type: "rules", rules }),
      setViews: (views) => dispatch({ type: "views", views }),
      applyView: (v) => {
        dispatch({ type: "filters", patch: { ...emptyFilters, query: v.query, kind: v.kind, minSize: v.minSize, olderThanDays: v.olderThanDays, status: v.status } });
        dispatch({ type: "patch", patch: { sort: v.sort, view: "explorer"  } });
        blip("tick");
      },

      runBench: () => {
        if (sRef.current.bench.running) {
          benchCancel.current?.();
          dispatch({ type: "bench", patch: { running: false } });
          return;
        }
        dispatch({ type: "bench", patch: { running: true, done: 0, result: null } });
        log("info", "benchmark", "Starting 1,000,000-file synthetic indexing benchmark (chunked, non-blocking)");
        import("../lib/engine").then(({ runBenchmark }) => {
          const { promise, cancel } = runBenchmark(
            sRef.current.settings.threads,
            1_000_000,
            (done) => dispatch({ type: "bench", patch: { done } }),
          );
          benchCancel.current = cancel;
          promise.then((res) => {
            dispatch({ type: "bench", patch: { running: false, result: { rate: res.rate, ms: res.ms, memMb: res.memMb, files: res.files } } });
            log("success", "benchmark", `${res.files.toLocaleString()} paths hashed in ${res.ms.toFixed(0)} ms → ${Math.round(res.rate).toLocaleString()} paths/s, ~${res.memMb.toFixed(0)} MB index estimate`);
            blip("done");
          });
        });
      },

      extractArchive: (id) => {
        const f = dRef.current.byId.get(id);
        if (!f) return;
        const base = f.name.replace(/\.[^.]+$/, "");
        const inner: FileRec[] = ["readme.txt", "dataset.csv", "preview.png", "license.md"].map((nm, i) => {
          const c = classify(nm, `Archives/Extracted/${base}`);
          return {
            id: uid("ext"), name: nm, ext: extOf(nm), dir: `Archives/Extracted/${base}`, rootId: "archives",
            size: Math.round(f.size / (6 + i)), modified: Date.now(), created: Date.now(), kind: c.kind, mime: c.mime,
            signature: c.signature, status: "indexed" as const, hash: `${f.hash.slice(0, 60)}${i}${i}${i}${i}`, tags: ["extracted"],
            bucket: c.bucket, dest: c.dest,
          };
        });
        dispatch({ type: "import", files: inner });
        const op: OpEntry = {
          id: uid("op"), kind: "extract", at: Date.now(), label: `Extracted ${f.name}`, detail: `4 entries → Archives/Extracted/${base} (original archive untouched)`,
          bytes: 0, backup: backupPath(), undone: false, patches: [],
        };
        dispatch({ type: "op", op });
        log("success", "archive", `Extracted ${f.name} → Archives/Extracted/${base}; entries queued for categorisation`);
        blip("done");
        toast({ tone: "success", title: "Archive extracted safely", message: `4 entries → Archives/Extracted/${base}`, action: { label: "View", view: "explorer" } });
      },

      resetAll: () => {
        stopTimer();
        try {
          localStorage.removeItem(KEY);
        } catch { /* ignore */ }
        dispatch({ type: "patch", patch: { ...initialState, settings: sRef.current.settings, roots: seedRoots, folders: seedFolderSuggestions, ops: [], imported: [], extraGroups: [], logs: seedLogs, suggestionEdits: {} } });
        toast({ tone: "info", title: "Demo library restored", message: "All operations cleared, seed data reloaded." });
        log("warn", "system", "Session reset — seed library restored");
      },
    };
  }, []);

  /* ---------- watchdog: real-time monitoring ---------- */
  useEffect(() => {
    if (!s.settings.watch) return;
    const templates = [
      () => ({ name: `invoice-${Math.floor(Math.random() * 9000 + 1000)}.pdf`, dir: "Downloads", size: 240_000 + Math.random() * 900_000 }),
      () => ({ name: `Screenshot 2026-03-12 at ${Math.floor(Math.random() * 12 + 9)}.${Math.floor(Math.random() * 50 + 10)}.png`, dir: "Desktop", size: 700_000 + Math.random() * 1_400_000 }),
      () => ({ name: `setup_${Math.floor(Math.random() * 90 + 10)}.exe`, dir: "Downloads", size: 40_000_000 + Math.random() * 200_000_000 }),
      () => ({ name: `sd_output_${Math.floor(Math.random() * 90000 + 10000)}.png`, dir: "Pictures/AI", size: 3_000_000 + Math.random() * 4_000_000 }),
    ];
    const t = window.setInterval(() => {
      if (sRef.current.scan.running) return;
      const tpl = templates[Math.floor(Math.random() * templates.length)]();
      const c = classify(tpl.name, tpl.dir, sRef.current.rules);
      const rootId = tpl.dir.startsWith("Pictures") ? "pictures" : tpl.dir === "Desktop" ? "desktop" : "downloads";
      const f: FileRec = {
        id: uid("watch"), name: tpl.name, ext: extOf(tpl.name), dir: tpl.dir, rootId, size: Math.round(tpl.size),
        modified: Date.now(), created: Date.now(), kind: c.kind, mime: c.mime, signature: c.signature, status: "indexed",
        hash: Array.from({ length: 64 }, () => "0123456789abcdef"[Math.floor(Math.random() * 16)]).join(""),
        phash: c.kind === "image" ? Array.from({ length: 16 }, () => "0123456789abcdef"[Math.floor(Math.random() * 16)]).join("") : undefined,
        tags: ["watch", ...(c.kind === "image" && /screenshot/i.test(tpl.name) ? ["screenshot"] : []), ...(c.dest.includes("AI_Art") ? ["ai_art"] : [])],
        bucket: c.bucket, dest: c.dest,
      };
      if (c.kind === "image" && sRef.current.settings.ocrEnabled) {
        const g = generateName(f);
        f.suggestion = { name: g.name, confidence: 0.82, model: sRef.current.settings.visionModel, subject: g.name.replace(/-/g, " ").replace(/\.\w+$/, ""), reason: "Live capture — captioned on arrival" };
      }
      dispatch({ type: "import", files: [f] });
      dispatch({ type: "log", entry: { id: uid("log"), at: Date.now(), level: "info", source: "watchdog", message: `New file detected: ${tpl.dir}/${tpl.name} → suggested ${c.dest}` } });
    }, 11000);
    return () => window.clearInterval(t);
  }, [s.settings.watch, s.settings.ocrEnabled, s.settings.visionModel]);

  /* ---------- global keyboard ---------- */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      const typing = tag === "INPUT" || tag === "TEXTAREA" || (e.target as HTMLElement)?.isContentEditable;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        dispatch({ type: "patch", patch: { commandOpen: !sRef.current.commandOpen  } });
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z" && !typing) {
        e.preventDefault();
        api.undoLast();
      } else if (e.key === "Escape") {
        if (sRef.current.commandOpen) dispatch({ type: "patch", patch: { commandOpen: false  } });
        else if (sRef.current.drawer) dispatch({ type: "patch", patch: { drawer: null  } });
      } else if (e.key === "/" && !typing) {
        e.preventDefault();
        dispatch({ type: "patch", patch: { view: "explorer"  } });
        window.setTimeout(() => document.getElementById("explorer-search")?.focus(), 60);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [api]);

  useEffect(() => () => {
    if (scanTimer.current !== null) window.clearInterval(scanTimer.current);
    benchCancel.current?.();
  }, []);

  return <AppCtx.Provider value={{ s, d, api }}>{children}</AppCtx.Provider>;
}