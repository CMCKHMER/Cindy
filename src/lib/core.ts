/* ============================================================
   Sasha Maid core domain model — shared by UI, engine and exporters.
   Mirrors backend/schema.sql (files, duplicates, operations…).
   ============================================================ */

export type Platform = "windows" | "macos" | "linux";

export type Kind =
  | "document"
  | "image"
  | "video"
  | "music"
  | "audio"
  | "archive"
  | "code"
  | "installer"
  | "other";

export type FileStatus =
  | "indexed"
  | "moved"
  | "renamed"
  | "deleted"
  | "archived"
  | "review"
  | "repaired"
  | "ignored";

export type DupKind = "exact" | "near" | "visual";

export interface BrokenInfo {
  reason:
    | "Corrupted image"
    | "Corrupted video"
    | "Corrupted PDF"
    | "Empty file"
    | "Partial download"
    | "Zero-byte file"
    | "Broken shortcut"
    | "Dead link";
  detail: string;
  repairable: boolean;
  repairMethod?: string;
  confidence: number;
}

export interface RenameSuggestion {
  name: string;
  confidence: number;
  model: string;
  subject: string;
  ocr?: string;
  reason: string;
}

export interface FileRec {
  id: string;
  name: string;
  ext: string;
  dir: string; // posix-ish relative dir, e.g. "Downloads"
  rootId: string;
  size: number;
  modified: number;
  created: number;
  kind: Kind;
  mime: string;
  signature: string;
  mismatch?: boolean;
  status: FileStatus;
  hash: string;
  phash?: string;
  dupGroup?: string;
  similarity?: number;
  broken?: BrokenInfo;
  suggestion?: RenameSuggestion;
  thumb?: string;
  photo?: string;
  tags: string[];
  bucket?: string; // Downloads cleanup classification
  dest?: string; // proposed destination dir
  prev?: { name: string; dir: string };
  starred?: boolean;
}

export interface RootFolder {
  id: string;
  label: string;
  dir: string;
  enabled: boolean;
  recursive: boolean;
  files: number;
  lastScan: number | null;
  watch: boolean;
}

export interface DupGroup {
  id: string;
  kind: DupKind;
  similarity: number;
  keepId: string;
  fileIds: string[];
  reason: string;
  resolved?: "delete" | "keep" | "review" | "ignore";
}

export interface FolderSuggestion {
  id: string;
  dir: string;
  current: string;
  suggested: string;
  reason: string;
  confidence: number;
  files: number;
  state: "pending" | "approved" | "rejected";
}

export type OpKind =
  | "move"
  | "rename"
  | "delete"
  | "archive"
  | "repair"
  | "folder-rename"
  | "extract"
  | "ignore"
  | "keep"
  | "import";

export interface OpEntry {
  id: string;
  kind: OpKind;
  at: number;
  label: string;
  detail: string;
  bytes: number;
  backup: string;
  undone: boolean;
  patches: { id: string; before: Partial<FileRec>; after: Partial<FileRec> }[];
  folderPatch?: { id: string; before: string; after: string };
  groupPatch?: { id: string; before?: DupGroup["resolved"]; after?: DupGroup["resolved"] }[];
}

export interface LogEntry {
  id: string;
  at: number;
  level: "info" | "warn" | "danger" | "success" | "ai";
  source: string;
  message: string;
}

export interface SavedView {
  id: string;
  name: string;
  query: string;
  kind: Kind | "all";
  minSize: number;
  olderThanDays: number;
  status: FileStatus | "all";
  sort: string;
}

export interface Rule {
  id: string;
  match: string;
  target: string;
  enabled: boolean;
  hits: number;
}

export interface Settings {
  platform: Platform;
  theme: "dark" | "light";
  sound: boolean;
  watch: boolean;
  threads: number;
  memoryMb: number;
  hashChunkKb: number;
  similarity: number; // visual similarity threshold %
  nearThreshold: number;
  visionModel: string;
  ocrEnabled: boolean;
  localOnly: boolean;
  backups: boolean;
  backupRetention: number;
  incremental: boolean;
  followSymlinks: boolean;
  minNameWords: number;
  autoQueue: boolean;
}

/* ---------------- taxonomy (exact target structure) ---------------- */

export const TAXONOMY: { name: string; children: { name: string; children?: string[] }[] }[] = [
  {
    name: "Documents",
    children: [{ name: "PDF" }, { name: "Word" }, { name: "Excel" }, { name: "Text" }, { name: "Other" }],
  },
  {
    name: "Media",
    children: [
      { name: "Images", children: ["Photos", "Screenshots", "AI_Art", "Logos", "Memes"] },
      { name: "Videos" },
      { name: "Music" },
      { name: "Audio" },
    ],
  },
  {
    name: "Projects",
    children: [{ name: "Coding" }, { name: "Design" }, { name: "School" }, { name: "Business" }],
  },
  { name: "Archives", children: [{ name: "ZIP" }, { name: "RAR" }, { name: "Backup" }] },
  { name: "Downloads", children: [] },
];

export const KIND_META: Record<Kind, { label: string; color: string; short: string }> = {
  document: { label: "Documents", color: "var(--blue)", short: "DOC" },
  image: { label: "Images", color: "var(--magenta)", short: "IMG" },
  video: { label: "Video", color: "var(--violet)", short: "VID" },
  music: { label: "Music", color: "var(--teal)", short: "MUS" },
  audio: { label: "Audio", color: "var(--cyan)", short: "AUD" },
  archive: { label: "Archives", color: "var(--amber)", short: "ARC" },
  code: { label: "Projects", color: "var(--lime)", short: "SRC" },
  installer: { label: "Installers", color: "var(--orange)", short: "BIN" },
  other: { label: "Other", color: "var(--slate)", short: "OTH" },
};

export const BUCKETS = ["Software", "Installers", "Documents", "Images", "Videos", "Archives"] as const;

export const BUCKET_DEST: Record<string, string> = {
  Software: "Projects/Coding/Installers",
  Installers: "Downloads/Installers",
  Documents: "Documents/PDF",
  Images: "Media/Images/Photos",
  Videos: "Media/Videos",
  Archives: "Archives/ZIP",
};

export const PROTECTED_PATHS = [
  "C:\\Windows\\System32",
  "C:\\Program Files",
  "/System",
  "/usr/bin",
  "/etc",
  "/Library/Extensions",
  "/boot",
  "~/AppData/Local/Microsoft",
];

export const PLATFORM_META: Record<Platform, { label: string; home: string; sep: string; trash: string }> = {
  windows: { label: "Windows", home: "C:\\Users\\alex", sep: "\\", trash: "Recycle Bin" },
  macos: { label: "macOS", home: "/Users/alex", sep: "/", trash: "Trash" },
  linux: { label: "Linux", home: "/home/alex", sep: "/", trash: "Trash" },
};

/* ---------------- utils ---------------- */

export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

let _uid = 0;
export const uid = (p = "id") => `${p}_${(++_uid).toString(36)}${Math.random().toString(36).slice(2, 7)}`;

export function fmtBytes(n: number, digits = 1): string {
  if (!n) return "0 B";
  const neg = n < 0;
  n = Math.abs(n);
  const u = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.min(u.length - 1, Math.floor(Math.log(n) / Math.log(1024)));
  const v = n / Math.pow(1024, i);
  return `${neg ? "−" : ""}${v.toFixed(i === 0 ? 0 : v >= 100 ? 0 : digits)} ${u[i]}`;
}

export function fmtNum(n: number): string {
  return Math.round(n).toLocaleString("en-US");
}

export function fmtDate(t: number): string {
  return new Date(t).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "2-digit" });
}

export function fmtTime(t: number): string {
  return new Date(t).toLocaleTimeString("en-US", { hour12: false });
}

export function relTime(t: number, now = Date.now()): string {
  const s = Math.max(1, Math.round((now - t) / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  if (d < 31) return `${d}d ago`;
  const mo = Math.round(d / 30);
  if (mo < 12) return `${mo}mo ago`;
  return `${(d / 365).toFixed(1)}y ago`;
}

export function renderPath(dir: string, platform: Platform, name?: string): string {
  const meta = PLATFORM_META[platform];
  const parts = [dir, name].filter(Boolean) as string[];
  const rel = parts.join("/");
  return meta.home + meta.sep + rel.split("/").join(meta.sep);
}

export function shortPath(dir: string, platform: Platform): string {
  const meta = PLATFORM_META[platform];
  return "~" + meta.sep + dir.split("/").join(meta.sep);
}

export const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

export function isProtected(dir: string): string | null {
  const norm = dir.replace(/\\/g, "/").toLowerCase();
  for (const p of PROTECTED_PATHS) {
    const q = p.replace(/\\/g, "/").toLowerCase();
    if (norm.includes(q.replace("~/", "/"))) return p;
  }
  return null;
}

export function extOf(name: string): string {
  const i = name.lastIndexOf(".");
  return i > 0 ? name.slice(i + 1).toLowerCase() : "";
}

export function baseOf(name: string): string {
  const i = name.lastIndexOf(".");
  return i > 0 ? name.slice(0, i) : name;
}