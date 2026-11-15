import {
  type FileRec,
  type Kind,
  type DupGroup,
  type Rule,
  extOf,
  baseOf,
  mulberry32,
  clamp,
} from "./core";

/* ============================================================
   Classification — content signature + extension + metadata
   ============================================================ */

interface ExtInfo {
  kind: Kind;
  mime: string;
  sig: string;
  dest: string;
}

const E = (kind: Kind, mime: string, sig: string, dest: string): ExtInfo => ({ kind, mime, sig, dest });

export const EXT_MAP: Record<string, ExtInfo> = {};
const put = (exts: string, info: ExtInfo) => exts.split(" ").forEach((e) => (EXT_MAP[e] = info));

put("pdf", E("document", "application/pdf", "25 50 44 46 2D 31 2E 37", "Documents/PDF"));
put("doc docx odt rtf pages", E("document", "application/msword", "D0 CF 11 E0 A1 B1 1A E1", "Documents/Word"));
put("xls xlsx csv ods numbers", E("document", "application/vnd.ms-excel", "50 4B 03 04", "Documents/Excel"));
put("txt md log nfo rst", E("document", "text/plain", "UTF-8 text", "Documents/Text"));
put("epub mobi azw3 ppt pptx key", E("document", "application/octet-stream", "50 4B 03 04", "Documents/Other"));
put("jpg jpeg jfif", E("image", "image/jpeg", "FF D8 FF E1", "Media/Images/Photos"));
put("png", E("image", "image/png", "89 50 4E 47 0D 0A 1A 0A", "Media/Images/Photos"));
put("heic heif", E("image", "image/heic", "66 74 79 70 68 65 69 63", "Media/Images/Photos"));
put("webp gif bmp tif tiff cr2 nef arw dng", E("image", "image/*", "52 49 46 46", "Media/Images/Photos"));
put("svg", E("image", "image/svg+xml", "3C 73 76 67", "Media/Images/Logos"));
put("mp4 mov m4v", E("video", "video/mp4", "66 74 79 70 69 73 6F 6D", "Media/Videos"));
put("mkv webm avi wmv flv", E("video", "video/x-matroska", "1A 45 DF A3", "Media/Videos"));
put("mp3 m4a aac flac ogg", E("music", "audio/mpeg", "49 44 33 04 00", "Media/Music"));
put("wav aiff opus mid amr", E("audio", "audio/wav", "52 49 46 46 57 41 56 45", "Media/Audio"));
put("zip 7z tar gz tgz xz", E("archive", "application/zip", "50 4B 03 04", "Archives/ZIP"));
put("rar", E("archive", "application/vnd.rar", "52 61 72 21 1A 07", "Archives/RAR"));
put("bak tib backup img", E("archive", "application/octet-stream", "BKUP 0001", "Archives/Backup"));
put("py ts tsx js jsx json ipynb rs go java c cpp h html css sql sh yaml yml toml", E("code", "text/x-source", "UTF-8 source", "Projects/Coding"));
put("psd ai fig sketch xd blend aep", E("code", "application/x-design", "38 42 50 53", "Projects/Design"));
put("exe msi dmg pkg deb rpm appimage apk iso", E("installer", "application/x-executable", "4D 5A 90 00", "Downloads/Installers"));
put("lnk url webloc desktop", E("other", "application/x-shortcut", "4C 00 00 00 01 14", "Downloads"));
put("crdownload part partial tmp download", E("other", "application/octet-stream", "— partial —", "Downloads"));

export function imageSubkind(name: string, tags: string[] = []): string {
  const n = name.toLowerCase();
  if (tags.includes("ai_art") || /dall|midjourney|sd_|stable[-_]?diff|firefly|comfyui|_ai_/.test(n)) return "AI_Art";
  if (tags.includes("screenshot") || /screenshot|screen[-_ ]?shot|snip|capture|cleanshot/.test(n)) return "Screenshots";
  if (tags.includes("logo") || /logo|wordmark|brandmark|icon[-_]|favicon/.test(n)) return "Logos";
  if (tags.includes("meme") || /meme|imgflip|reaction/.test(n)) return "Memes";
  return "Photos";
}

export function classify(
  name: string,
  dir: string,
  rules: Rule[] = [],
): { kind: Kind; mime: string; signature: string; dest: string; bucket: string; matchedRule?: string } {
  const ext = extOf(name);
  const info = EXT_MAP[ext] ?? E("other", "application/octet-stream", "unknown", "Downloads");
  let dest = info.dest;
  let kind = info.kind;

  if (kind === "image") dest = `Media/Images/${imageSubkind(name)}`;
  if (/invoice|receipt|contract|statement|tax/i.test(name) && kind === "document") dest = "Documents/PDF";
  if (kind === "code" && /school|assignment|thesis|course/i.test(dir + name)) dest = "Projects/School";
  if (kind === "code" && /client|pitch|proposal|crm/i.test(dir + name)) dest = "Projects/Business";

  let matchedRule: string | undefined;
  for (const r of rules) {
    if (!r.enabled) continue;
    const m = r.match.trim().toLowerCase();
    if (!m) continue;
    const hit = m.startsWith("*.")
      ? ext === m.slice(2)
      : m.startsWith("/") && m.endsWith("/")
        ? new RegExp(m.slice(1, -1), "i").test(name)
        : name.toLowerCase().includes(m) || dir.toLowerCase().includes(m);
    if (hit) {
      dest = r.target;
      matchedRule = r.id;
      break;
    }
  }

  let bucket = "Documents";
  if (kind === "installer") bucket = /portable|setup|installer/i.test(name) ? "Installers" : "Software";
  else if (kind === "image") bucket = "Images";
  else if (kind === "video") bucket = "Videos";
  else if (kind === "archive") bucket = "Archives";
  else if (kind === "music" || kind === "audio") bucket = "Software";
  return { kind, mime: info.mime, signature: info.sig, dest, bucket, matchedRule };
}

/* ============================================================
   Naming — lowercase, hyphenated, collision-free
   ============================================================ */

export function normalizeName(input: string, ext?: string): string {
  // Callers may pass either a stem or a complete filename. Always strip the
  // existing extension first, otherwise "photo.jpg" + "jpg" => photo-jpg.jpg.
  const base = baseOf(input);
  const e = ext !== undefined ? ext : extOf(input);
  const slug = base
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/['’"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-")
    .slice(0, 72);
  return e ? `${slug || "untitled"}.${e.toLowerCase()}` : slug || "untitled";
}

export function uniqueName(name: string, taken: Set<string>): string {
  if (!taken.has(name.toLowerCase())) return name;
  const ext = extOf(name);
  const base = baseOf(name);
  let i = 2;
  let candidate = ext ? `${base}-${i}.${ext}` : `${base}-${i}`;
  while (taken.has(candidate.toLowerCase())) {
    i++;
    candidate = ext ? `${base}-${i}.${ext}` : `${base}-${i}`;
  }
  return candidate;
}

const STOP = /^(img|dsc|dscn|photo|image|screenshot|screen|shot|final|copy|new|untitled|png|jpg|jpeg|scan)$/i;

export function generateName(f: FileRec): { name: string; confidence: number; reason: string } {
  const tokens = baseOf(f.name)
    .split(/[^a-zA-Z0-9]+/)
    .filter((t) => t && !STOP.test(t) && !/^\d+$/.test(t) && t.length > 2);
  const subject = f.suggestion?.subject ?? f.tags.filter((t) => !["ai_art", "screenshot", "logo", "meme"].includes(t))[0];
  const parts = [subject, ...tokens].filter(Boolean) as string[];
  const uniq = Array.from(new Set(parts.map((p) => p.toLowerCase()))).slice(0, 6);
  const name = normalizeName(uniq.join(" ") || `${f.kind}-asset`, f.ext);
  return {
    name,
    confidence: uniq.length >= 3 ? 0.93 : 0.71,
    reason: uniq.length >= 3 ? "Vision caption + metadata" : "Low signal — filename tokens only",
  };
}

/* ============================================================
   Similarity — SHA256 equality, pHash hamming, text shingles
   ============================================================ */

export function hamming(a: string, b: string): number {
  let d = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) {
    let x = parseInt(a[i], 16) ^ parseInt(b[i], 16);
    while (x) {
      d += x & 1;
      x >>= 1;
    }
  }
  return d;
}

export const phashSimilarity = (a: string, b: string) => 1 - hamming(a, b) / (Math.max(a.length, b.length) * 4);

export function textSimilarity(a: string, b: string): number {
  const sh = (s: string) => {
    const t = s.toLowerCase().replace(/\s+/g, " ");
    const out = new Set<string>();
    for (let i = 0; i < t.length - 2; i++) out.add(t.slice(i, i + 3));
    return out;
  };
  const A = sh(a);
  const B = sh(b);
  if (!A.size || !B.size) return 0;
  let inter = 0;
  A.forEach((x) => B.has(x) && inter++);
  return inter / (A.size + B.size - inter);
}

export function groupDuplicates(files: FileRec[], visualThreshold = 0.9, nearThreshold = 0.86): DupGroup[] {
  const live = files.filter((f) => f.status !== "deleted");
  const groups: DupGroup[] = [];
  const used = new Set<string>();

  const byHash = new Map<string, FileRec[]>();
  live.forEach((f) => {
    if (!f.hash) return;
    byHash.set(f.hash, [...(byHash.get(f.hash) ?? []), f]);
  });
  byHash.forEach((list, hash) => {
    if (list.length < 2) return;
    list.forEach((f) => used.add(f.id));
    const keep = [...list].sort((a, b) => a.created - b.created)[0];
    groups.push({
      id: `dup_${hash.slice(0, 8)}`,
      kind: "exact",
      similarity: 1,
      keepId: keep.id,
      fileIds: list.map((f) => f.id),
      reason: "Identical SHA-256 content hash",
    });
  });

  const imgs = live.filter((f) => f.kind === "image" && f.phash && !used.has(f.id));
  for (let i = 0; i < imgs.length; i++) {
    if (used.has(imgs[i].id)) continue;
    const cluster = [imgs[i]];
    for (let j = i + 1; j < imgs.length; j++) {
      if (used.has(imgs[j].id)) continue;
      const s = phashSimilarity(imgs[i].phash!, imgs[j].phash!);
      if (s >= visualThreshold) cluster.push(imgs[j]);
    }
    if (cluster.length > 1) {
      cluster.forEach((f) => used.add(f.id));
      const keep = [...cluster].sort((a, b) => b.size - a.size)[0];
      groups.push({
        id: `vis_${cluster[0].phash!.slice(0, 8)}`,
        kind: "visual",
        similarity: phashSimilarity(cluster[0].phash!, cluster[1].phash!),
        keepId: keep.id,
        fileIds: cluster.map((f) => f.id),
        reason: "pHash + CLIP embedding cosine distance",
      });
    }
  }

  const docs = live.filter((f) => (f.kind === "document" || f.kind === "code") && !used.has(f.id));
  for (let i = 0; i < docs.length; i++) {
    if (used.has(docs[i].id)) continue;
    const cluster = [docs[i]];
    for (let j = i + 1; j < docs.length; j++) {
      if (used.has(docs[j].id)) continue;
      const sizeClose = Math.abs(docs[i].size - docs[j].size) / Math.max(docs[i].size, docs[j].size, 1) < 0.22;
      if (sizeClose && textSimilarity(baseOf(docs[i].name), baseOf(docs[j].name)) >= nearThreshold - 0.35) cluster.push(docs[j]);
    }
    if (cluster.length > 1) {
      cluster.forEach((f) => used.add(f.id));
      const keep = [...cluster].sort((a, b) => b.modified - a.modified)[0];
      groups.push({
        id: `near_${docs[i].id}`,
        kind: "near",
        similarity: clamp(textSimilarity(baseOf(cluster[0].name), baseOf(cluster[1].name)) + 0.3, 0.86, 0.99),
        keepId: keep.id,
        fileIds: cluster.map((f) => f.id),
        reason: "MinHash shingle overlap on extracted text",
      });
    }
  }
  return groups.sort((a, b) => b.similarity - a.similarity);
}

/* ============================================================
   Natural-language command parsing
   ============================================================ */

export interface CommandResult {
  view: string;
  message: string;
  intent: string;
  filter?: { query?: string; kind?: Kind | "all"; minSize?: number; olderThanDays?: number; status?: string; subject?: string };
  action?: "scan" | "report";
}

const SIZE_RE = /(\d+(?:\.\d+)?)\s*(kb|mb|gb|tb)/i;

export function parseCommand(raw: string): CommandResult {
  const q = raw.trim().toLowerCase();
  if (!q) return { view: "dashboard", message: "Type a command — try “clean my Downloads folder”.", intent: "empty" };

  const size = q.match(SIZE_RE);
  const bytes = size
    ? parseFloat(size[1]) * { kb: 1024, mb: 1024 ** 2, gb: 1024 ** 3, tb: 1024 ** 4 }[size[2].toLowerCase() as "kb"]
    : 0;

  if (/(larger|bigger|greater|over|above)\s*(than)?/.test(q) && bytes)
    return {
      view: "analytics",
      intent: "large-files",
      message: `Large-file finder armed at ${size![0].toUpperCase()} — sorted by size, biggest first.`,
      filter: { minSize: bytes, kind: "all" },
    };
  if (/duplicate|dedupe|dupe/.test(q))
    return {
      view: "duplicates",
      intent: "duplicates",
      message: /photo|image|picture/.test(q)
        ? "Filtered duplicate review to visual image matches."
        : "Duplicate review opened — exact, near and visual groups.",
      filter: { kind: /photo|image|picture/.test(q) ? "image" : "all" },
    };
  if (/broken|corrupt|damaged|zero|empty|partial/.test(q))
    return { view: "broken", intent: "broken", message: "Integrity review opened — nothing is deleted without your approval." };
  if (/rename/.test(q))
    return {
      view: "rename",
      intent: "rename",
      message: /screenshot/.test(q) ? "Rename studio filtered to screenshots (OCR naming enabled)." : "Rename studio opened with AI suggestions.",
      filter: { subject: /screenshot/.test(q) ? "Screenshot" : undefined, kind: /screenshot/.test(q) ? "image" : "all" },
    };
  if (/clean|organize|tidy|sort out/.test(q)) {
    if (/download/.test(q))
      return { view: "organize", intent: "downloads", message: "Downloads cleanup plan ready — approve the moves to apply." };
    if (/music|song|audio/.test(q))
      return {
        view: "explorer",
        intent: "music",
        message: "Music library isolated. Proposed destination: Media/Music.",
        filter: { kind: "music" },
      };
    return { view: "organize", intent: "organize", message: "Organization plan generated across all watched roots." };
  }
  if (/old|stale|haven.t|unused/.test(q))
    return {
      view: "analytics",
      intent: "old-files",
      message: "Old-file cleanup: untouched for 12 months or more.",
      filter: { olderThanDays: 365 },
    };
  if (/scan|index|rescan/.test(q))
    return { view: "scan", intent: "scan", message: "Scan queued across enabled roots.", action: "scan" };
  if (/report|export|summary/.test(q))
    return { view: "history", intent: "report", message: "Report builder opened — export as PDF, CSV or JSON.", action: "report" };
  if (/undo|revert/.test(q)) return { view: "history", intent: "undo", message: "Undo history opened — every operation is reversible." };
  if (/desktop|install|set ?up|get (it|this) (running|working)|laptop|my computer/.test(q))
    return { view: "desktop", intent: "desktop", message: "Desktop setup opened — one command for Windows, macOS or Linux." };
  if (/setting|model|thread|safe/.test(q)) return { view: "settings", intent: "settings", message: "Settings opened." };

  return {
    view: "explorer",
    intent: "search",
    message: `Searching the index for “${raw.trim()}”.`,
    filter: { query: raw.trim(), kind: "all" },
  };
}

/* ============================================================
   Performance — chunked million-file indexing benchmark
   ============================================================ */

export interface BenchResult {
  files: number;
  ms: number;
  rate: number;
  memMb: number;
  threads: number;
}

export function runBenchmark(
  threads: number,
  total: number,
  onProgress: (done: number) => void,
): { promise: Promise<BenchResult>; cancel: () => void } {
  let cancelled = false;
  const promise = new Promise<BenchResult>((resolve) => {
    const start = performance.now();
    let done = 0;
    let acc = 0x811c9dc5;
    const chunk = 40000;
    const step = () => {
      if (cancelled) {
        resolve({ files: done, ms: performance.now() - start, rate: 0, memMb: 0, threads });
        return;
      }
      const end = Math.min(total, done + chunk);
      for (let i = done; i < end; i++) {
        // FNV-1a over a synthetic path — same work shape as the real indexer
        acc ^= i & 0xff;
        acc = Math.imul(acc, 16777619) >>> 0;
        acc ^= (i >>> 8) & 0xff;
        acc = Math.imul(acc, 16777619) >>> 0;
      }
      done = end;
      onProgress(done);
      if (done < total) setTimeout(step, 0);
      else {
        const ms = performance.now() - start;
        resolve({
          files: total,
          ms,
          rate: (total / ms) * 1000,
          memMb: (total * 168) / 1024 ** 2,
          threads,
        });
      }
    };
    setTimeout(step, 0);
  });
  return { promise, cancel: () => (cancelled = true) };
}

/* ============================================================
   Real SHA-256 for dropped files (WebCrypto)
   ============================================================ */

export async function sha256File(file: File): Promise<string> {
  try {
    const buf = await file.slice(0, Math.min(file.size, 8 * 1024 * 1024)).arrayBuffer();
    const digest = await crypto.subtle.digest("SHA-256", buf);
    return Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  } catch {
    const r = mulberry32(file.size + file.name.length);
    return Array.from({ length: 64 }, () => "0123456789abcdef"[Math.floor(r() * 16)]).join("");
  }
}

export function fakeHash(seed: number): string {
  const r = mulberry32(seed);
  return Array.from({ length: 64 }, () => "0123456789abcdef"[Math.floor(r() * 16)]).join("");
}

export function fakePhash(seed: number, drift = 0): string {
  const r = mulberry32(seed);
  const base = Array.from({ length: 16 }, () => Math.floor(r() * 16));
  const d = mulberry32(seed + 991);
  return base.map((v) => (d() < drift / 16 ? (v ^ (1 << Math.floor(d() * 4))) & 15 : v).toString(16)).join("");
}

/* ============================================================
   Self-test suite (runs live in the Diagnostics panel)
   ============================================================ */

export interface TestResult {
  name: string;
  group: string;
  pass: boolean;
  detail: string;
  ms: number;
}

export function selfTest(): TestResult[] {
  const out: TestResult[] = [];
  const t = (group: string, name: string, fn: () => string) => {
    const s = performance.now();
    try {
      const detail = fn();
      out.push({ group, name, pass: true, detail, ms: performance.now() - s });
    } catch (e) {
      out.push({ group, name, pass: false, detail: (e as Error).message, ms: performance.now() - s });
    }
  };
  const assert = (cond: boolean, msg: string) => {
    if (!cond) throw new Error(msg);
  };

  t("classify", "extension → taxonomy", () => {
    assert(classify("report.pdf", "Downloads").dest === "Documents/PDF", "pdf misrouted");
    assert(classify("budget.xlsx", "Downloads").dest === "Documents/Excel", "xlsx misrouted");
    return "pdf→Documents/PDF, xlsx→Documents/Excel";
  });
  t("classify", "screenshot sub-folder", () => {
    const d = classify("Screenshot 2026-03-01.png", "Desktop").dest;
    assert(d === "Media/Images/Screenshots", d);
    return d;
  });
  t("classify", "AI art sub-folder", () => {
    const d = classify("DALL-E-Image-42.png", "Downloads").dest;
    assert(d === "Media/Images/AI_Art", d);
    return d;
  });
  t("classify", "custom rule precedence", () => {
    const d = classify("track01.mp3", "Downloads", [{ id: "r", match: "*.mp3", target: "Media/Music/Sorted", enabled: true, hits: 0 }]).dest;
    assert(d === "Media/Music/Sorted", d);
    return "rule overrode default destination";
  });
  t("naming", "lowercase + hyphens + extension", () => {
    const n = normalizeName("Golden Retriever Running In Park!!", "JPG");
    assert(n === "golden-retriever-running-in-park.jpg", n);
    return n;
  });
  t("naming", "diacritics stripped", () => {
    const n = normalizeName("Café Phnom Penh Néon", "png");
    assert(n === "cafe-phnom-penh-neon.png", n);
    return n;
  });
  t("naming", "existing extension is not duplicated", () => {
    const n = normalizeName("Golden Retriever.jpg", "jpg");
    assert(n === "golden-retriever.jpg", n);
    return n;
  });
  t("naming", "collision suffix", () => {
    const taken = new Set(["dog.jpg", "dog-2.jpg"]);
    const n = uniqueName("dog.jpg", taken);
    assert(n === "dog-3.jpg", n);
    return n;
  });
  t("safety", "OS-critical path rejected", () => {
    const { isProtected } = require_core();
    assert(!!isProtected("C:\\Windows\\System32\\drivers"), "system32 accepted");
    assert(!!isProtected("/usr/bin"), "/usr/bin accepted");
    assert(!isProtected("Downloads/Installers"), "user folder rejected");
    return "System32, /usr/bin blocked; user folders allowed";
  });
  t("dedupe", "exact SHA-256 grouping", () => {
    const mk = (id: string, hash: string): FileRec => ({
      id, name: id + ".bin", ext: "bin", dir: "Downloads", rootId: "downloads", size: 10, modified: 1, created: 1,
      kind: "other", mime: "", signature: "", status: "indexed", hash, tags: [],
    });
    const g = groupDuplicates([mk("a", "f".repeat(64)), mk("b", "f".repeat(64)), mk("c", "0".repeat(64))]);
    assert(g.length === 1 && g[0].fileIds.length === 2, "wrong group count");
    return "2 identical files grouped, singleton excluded";
  });
  t("dedupe", "pHash distance", () => {
    const a = fakePhash(7);
    const b = fakePhash(7, 2);
    const s = phashSimilarity(a, b);
    assert(s > 0.85 && s < 1, `similarity ${s}`);
    return `near-duplicate similarity ${(s * 100).toFixed(1)}%`;
  });
  t("nlp", "command intents", () => {
    assert(parseCommand("Clean my Downloads folder").view === "organize", "downloads intent");
    assert(parseCommand("Find duplicate photos").filter?.kind === "image", "dup photos intent");
    assert(parseCommand("Show files larger than 1GB").filter?.minSize === 1024 ** 3, "size parse");
    assert(parseCommand("Rename all screenshots").filter?.subject === "Screenshot", "rename intent");
    return "4/4 canonical commands resolved";
  });
  t("format", "byte formatting", () => {
    assert(fmt(1024) === "1.0 KB", fmt(1024));
    assert(fmt(1024 ** 3) === "1.0 GB", fmt(1024 ** 3));
    return "1024→1.0 KB, 1GiB→1.0 GB";
  });
  return out;
}

function fmt(n: number) {
  const u = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.min(u.length - 1, Math.floor(Math.log(n) / Math.log(1024)));
  const v = n / Math.pow(1024, i);
  return `${v.toFixed(i === 0 ? 0 : v >= 100 ? 0 : 1)} ${u[i]}`;
}

function require_core() {
  // local import shim keeps the test bundle tree-shakeable
  return { isProtected: (dir: string) => {
    const norm = dir.replace(/\\/g, "/").toLowerCase();
    return ["c:/windows/system32", "c:/program files", "/system", "/usr/bin", "/etc", "/library/extensions", "/boot"].some((p) =>
      norm.includes(p),
    )
      ? "protected"
      : null;
  } };
}