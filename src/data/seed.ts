import {
  type FileRec,
  type RootFolder,
  type DupGroup,
  type FolderSuggestion,
  type LogEntry,
  type Rule,
  type SavedView,
  type BrokenInfo,
  extOf,
  mulberry32,
} from "../lib/core";
import { classify, fakeHash, fakePhash, imageSubkind } from "../lib/engine";
import {
  PHOTOS,
  artThumb,
  brokenThumb,
  docThumb,
  genericThumb,
  logoThumb,
  memeThumb,
  screenshotThumb,
  videoThumb,
  waveThumb,
} from "../lib/thumbs";

const DAY = 86400000;
export const NOW = Date.now();
const r = mulberry32(20260312);
const pick = <T,>(a: T[]): T => a[Math.floor(r() * a.length)];
const int = (a: number, b: number) => Math.floor(a + r() * (b - a));

let n = 0;
function mk(
  name: string,
  dir: string,
  rootId: string,
  size: number,
  ageDays: number,
  extra: Partial<FileRec> = {},
): FileRec {
  const c = classify(name, dir);
  const id = `f${(++n).toString(36)}`;
  const modified = NOW - ageDays * DAY - int(0, 20) * 3600000;
  return {
    id,
    name,
    ext: extOf(name),
    dir,
    rootId,
    size,
    modified,
    created: modified - int(0, 400) * DAY,
    kind: c.kind,
    mime: c.mime,
    signature: c.signature,
    status: "indexed",
    hash: fakeHash(n * 7919),
    phash: c.kind === "image" ? fakePhash(n * 104729) : undefined,
    tags: [],
    bucket: c.bucket,
    dest: c.dest,
    ...extra,
  };
}

/* ---------------- roots ---------------- */
export const seedRoots: RootFolder[] = [
  { id: "downloads", label: "Downloads", dir: "Downloads", enabled: true, recursive: true, files: 0, lastScan: NOW - 2 * DAY, watch: true },
  { id: "pictures", label: "Pictures", dir: "Pictures", enabled: true, recursive: true, files: 0, lastScan: NOW - 2 * DAY, watch: true },
  { id: "documents", label: "Documents", dir: "Documents", enabled: true, recursive: true, files: 0, lastScan: NOW - 5 * DAY, watch: false },
  { id: "desktop", label: "Desktop", dir: "Desktop", enabled: true, recursive: true, files: 0, lastScan: NOW - 9 * DAY, watch: true },
  { id: "projects", label: "Projects", dir: "Projects", enabled: true, recursive: true, files: 0, lastScan: NOW - 12 * DAY, watch: false },
  { id: "music", label: "Music", dir: "Music", enabled: true, recursive: true, files: 0, lastScan: NOW - 21 * DAY, watch: false },
  { id: "videos", label: "Videos", dir: "Videos", enabled: true, recursive: true, files: 0, lastScan: NOW - 21 * DAY, watch: false },
  { id: "archives", label: "Archives", dir: "Archives", enabled: false, recursive: true, files: 0, lastScan: null, watch: false },
];

const files: FileRec[] = [];

/* ---------------- hero: AI rename candidates ---------------- */
const hero: FileRec[] = [
  mk("IMG_8274.jpg", "Pictures/Camera Roll", "pictures", 4_812_544, 6, {
    photo: PHOTOS.dogA.thumb, hash: fakeHash(4242), phash: fakePhash(555), tags: ["dog", "park", "golden-hour"],
    suggestion: { name: "golden-retriever-running-in-park.jpg", confidence: 0.97, model: "CLIP ViT-B/32 + BLIP caption", subject: "golden retriever running park", reason: "Caption: a golden retriever running across grass at golden hour" },
  }),
  mk("IMG_8275.jpg", "Pictures/Camera Roll", "pictures", 4_798_112, 6, {
    photo: PHOTOS.dogB.thumb, phash: fakePhash(555, 3), tags: ["dog", "park"],
    suggestion: { name: "golden-retriever-running-in-park-closeup.jpg", confidence: 0.94, model: "CLIP ViT-B/32 + BLIP caption", subject: "golden retriever running park", reason: "Same burst sequence, 3-bit pHash distance from IMG_8274" },
  }),
  mk("DSC_0042.jpg", "Pictures/2026/Austin", "pictures", 8_331_008, 34, {
    photo: PHOTOS.dogC.thumb, phash: fakePhash(555, 6), tags: ["dog", "field"],
    suggestion: { name: "golden-retriever-fetching-in-open-field.jpg", confidence: 0.91, model: "CLIP ViT-B/32 + BLIP caption", subject: "golden retriever field", reason: "Subject match with 2 other photos in library" },
  }),
  mk("Screenshot_2026-03-02.png", "Desktop", "desktop", 812_331, 10, {
    thumb: screenshotThumb(11, "order"), tags: ["screenshot", "receipt"],
    suggestion: { name: "amazon-order-confirmation-screen.png", confidence: 0.96, model: "PaddleOCR v4 + rules", subject: "order confirmation screenshot", ocr: "Order placed, thank you! · Arriving Thursday, March 12 · Total $148.20 · Ship to: Alex, 42 Marina Blvd", reason: "OCR found merchant, order state and total" },
  }),
  mk("Screenshot 2026-02-18 at 14.22.png", "Desktop", "desktop", 1_204_887, 22, {
    thumb: screenshotThumb(23, "dashboard"), tags: ["screenshot", "dashboard"],
    suggestion: { name: "analytics-dashboard-monthly-revenue.png", confidence: 0.93, model: "PaddleOCR v4 + rules", subject: "analytics dashboard screenshot", ocr: "Monthly revenue $4.1k · Retention 98.2% · Sessions 12.4k · Feb 2026", reason: "Chart region + KPI labels detected" },
  }),
  mk("DALL-E-Image-77.png", "Downloads", "downloads", 3_998_120, 3, {
    photo: PHOTOS.neonCity.thumb, tags: ["ai_art", "neon", "city"],
    suggestion: { name: "futuristic-neon-cambodia-cityscape.png", confidence: 0.95, model: "SDXL metadata + CLIP", subject: "futuristic neon cityscape", reason: "Prompt metadata: “futuristic neon Cambodia cityscape, rain, 8k”" },
  }),
  mk("sd_output_00231.png", "Pictures/AI", "pictures", 5_120_880, 15, {
    photo: PHOTOS.neonAlley.thumb, tags: ["ai_art", "neon"],
    suggestion: { name: "neon-alley-rain-reflections.png", confidence: 0.92, model: "SDXL metadata + CLIP", subject: "neon alley rain", reason: "Prompt metadata recovered from PNG tEXt chunk" },
  }),
  mk("logo_final_v3.svg", "Projects/design-lab", "projects", 42_112, 41, {
    thumb: logoThumb(5), tags: ["logo"],
    suggestion: { name: "northwind-coffee-logo-mark.svg", confidence: 0.88, model: "OCR + vector heuristic", subject: "northwind coffee logo", ocr: "NORTHWIND COFFEE", reason: "Wordmark text extracted from vector paths" },
  }),
  mk("meme_download_88.jpg", "Downloads", "downloads", 288_442, 12, {
    thumb: memeThumb(9), tags: ["meme"],
    suggestion: { name: "scan-finished-in-four-seconds-meme.jpg", confidence: 0.9, model: "OCR impact-text", subject: "scan finished meme", ocr: "WHEN THE SCAN / FINISHES IN 4 SECONDS", reason: "Impact text OCR" },
  }),
  mk("screen_rec_demo.mov", "Videos/Recordings", "videos", 1_832_446_976, 18, {
    thumb: videoThumb(3, "12:04"), tags: ["screencast"],
    suggestion: { name: "sasha-agent-onboarding-screencast.mov", confidence: 0.86, model: "frame-sample CLIP", subject: "onboarding screencast", reason: "6 sampled frames match app UI" },
  }),
];
files.push(...hero);

/* ---------------- hero: duplicate clusters ---------------- */
const dupSpecs: { base: string; copies: { dir: string; root: string; name?: string; age: number }[]; size: number; kind: "exact" | "visual" | "near"; seed: number }[] = [
  {
    base: "quarterly-report-2025.pdf", size: 4_412_928, kind: "exact", seed: 1001,
    copies: [
      { dir: "Documents/Work", root: "documents", age: 96 },
      { dir: "Downloads", root: "downloads", name: "quarterly-report-2025 (1).pdf", age: 61 },
      { dir: "Desktop", root: "desktop", name: "quarterly-report-2025 FINAL.pdf", age: 12 },
    ],
  },
  {
    base: "node-v22.4.0-x64.msi", size: 32_506_368, kind: "exact", seed: 1002,
    copies: [
      { dir: "Downloads", root: "downloads", age: 74 },
      { dir: "Downloads/Installers", root: "downloads", name: "node-v22.4.0-x64 (1).msi", age: 33 },
    ],
  },
  {
    base: "IMG_8274.jpg", size: 4_812_544, kind: "exact", seed: 4242,
    copies: [{ dir: "Pictures/Backup 2026-01", root: "pictures", name: "IMG_8274 copy.jpg", age: 40 }],
  },
  {
    base: "_backup_phone_2025.tib", size: 8_453_221_376, kind: "exact", seed: 1004,
    copies: [
      { dir: "Archives/Backups", root: "archives", age: 210 },
      { dir: "Videos", root: "videos", name: "backup_phone_2025_copy.tib", age: 190 },
    ],
  },
  {
    base: "Proposal_Acme_v3.docx", size: 1_204_224, kind: "near", seed: 1005,
    copies: [
      { dir: "Documents/Work", root: "documents", age: 58 },
      { dir: "Documents/Work", root: "documents", name: "Proposal_Acme_v4_final.docx", age: 21 },
    ],
  },
  {
    base: "meeting-notes-2026-02.md", size: 18_442, kind: "near", seed: 1006,
    copies: [
      { dir: "Projects/sasha-agent/docs", root: "projects", age: 26 },
      { dir: "Documents/Notes", root: "documents", name: "meeting-notes-feb-copy.md", age: 25 },
    ],
  },
];

export const seedGroups: DupGroup[] = [];
dupSpecs.forEach((spec, gi) => {
  const ids: string[] = [];
  if (spec.base === "IMG_8274.jpg") ids.push(hero[0].id);
  spec.copies.forEach((c, ci) => {
    const f = mk(c.name ?? spec.base, c.dir, c.root, spec.size, c.age, {
      hash: fakeHash(spec.seed),
      tags: ["dup-candidate"],
      thumb: extOf(c.name ?? spec.base) === "pdf" ? docThumb(spec.seed + ci, "pdf") : undefined,
    });
    files.push(f);
    ids.push(f.id);
  });
  seedGroups.push({
    id: `dup_seed_${gi}`,
    kind: spec.kind,
    similarity: spec.kind === "exact" ? 1 : 0.94 - gi * 0.005,
    keepId: ids[0],
    fileIds: ids,
    reason:
      spec.kind === "exact"
        ? "Identical SHA-256 content hash"
        : "MinHash shingle overlap on extracted text (94%)",
  });
});

// visual cluster: same photo, resized / re-encoded
const visualA = hero[0];
const visualB = hero[1];
const resized = mk("IMG_8274_web.jpg", "Desktop", "desktop", 1_204_224, 5, {
  photo: PHOTOS.dogA.thumb, phash: fakePhash(555, 2), hash: fakeHash(9999), tags: ["dup-candidate", "dog"],
});
files.push(resized);
seedGroups.push({
  id: "dup_visual_dog",
  kind: "visual",
  similarity: 0.964,
  keepId: visualA.id,
  fileIds: [visualA.id, resized.id, visualB.id],
  reason: "pHash distance ≤ 4 bits · CLIP cosine 0.97",
});
const neonCopy = mk("neon-city-wallpaper-4k.png", "Pictures/Wallpapers", "pictures", 12_884_901, 30, {
  photo: PHOTOS.neonCity.thumb, phash: fakePhash(hero[5].id.length * 31, 0), tags: ["dup-candidate", "ai_art"],
});
neonCopy.phash = hero[5].phash ? fakePhash(770_001, 3) : neonCopy.phash;
hero[5].phash = fakePhash(770_001);
files.push(neonCopy);
seedGroups.push({
  id: "dup_visual_neon",
  kind: "visual",
  similarity: 0.938,
  keepId: neonCopy.id,
  fileIds: [neonCopy.id, hero[5].id],
  reason: "Same composition, different resolution (4096px vs 1024px)",
});

/* ---------------- hero: broken files ---------------- */
const brokenSpecs: [string, string, string, number, number, BrokenInfo][] = [
  ["IMG_5521.jpg", "Pictures/Camera Roll", "pictures", 2_204_112, 88,
    { reason: "Corrupted image", detail: "JPEG marker EOI missing — decoder stopped at 71% of scanlines", repairable: true, repairMethod: "Rebuild EOI + salvage 71% of scanlines (Pillow)", confidence: 0.98 }],
  ["holiday_footage.mp4", "Videos/Recordings", "videos", 684_510_208, 120,
    { reason: "Corrupted video", detail: "moov atom not found — recording interrupted before finalize", repairable: true, repairMethod: "untrunc / ffmpeg remux with reference header", confidence: 0.95 }],
  ["scan_contract.pdf", "Documents/Work", "documents", 1_004_544, 47,
    { reason: "Corrupted PDF", detail: "xref table offset invalid, 3 of 12 pages unreadable", repairable: true, repairMethod: "pikepdf xref reconstruction", confidence: 0.91 }],
  ["notes_empty.txt", "Documents/Notes", "documents", 0, 210,
    { reason: "Zero-byte file", detail: "0 bytes allocated, created 210 days ago", repairable: false, confidence: 1 }],
  ["ubuntu-24.04-desktop.iso.crdownload", "Downloads", "downloads", 1_288_490_188, 64,
    { reason: "Partial download", detail: "Chrome partial: 1.2 GB of 5.7 GB, no resume ticket since 64 days", repairable: false, confidence: 1 }],
  ["dataset-cache.tmp", "Downloads", "downloads", 0, 15,
    { reason: "Empty file", detail: "Temp file left by an interrupted extraction", repairable: false, confidence: 1 }],
  ["Photoshop 2025.lnk", "Desktop", "desktop", 2_048, 300,
    { reason: "Broken shortcut", detail: "Target C:\\Program Files\\Adobe\\Photoshop 2025\\Photoshop.exe not found", repairable: false, confidence: 1 }],
  ["Design inspiration.url", "Desktop", "desktop", 512, 410,
    { reason: "Dead link", detail: "HTTP 404 · host resolves, resource removed", repairable: false, confidence: 0.99 }],
  ["family_1998_004.png", "Pictures/Scans", "pictures", 884_224, 500,
    { reason: "Corrupted image", detail: "PNG CRC mismatch in 14 IDAT chunks", repairable: true, repairMethod: "Re-inflate IDAT with CRC tolerance", confidence: 0.87 }],
  ["podcast_ep12.wav", "Music/Recordings", "music", 44_100_000, 33,
    { reason: "Corrupted video", detail: "WAVE header declares 0 frames, payload truncated", repairable: true, repairMethod: "Rewrite RIFF header from payload length", confidence: 0.83 }],
];
brokenSpecs.forEach(([name, dir, root, size, age, info], i) => {
  files.push(
    mk(name, dir, root, size, age, {
      broken: info,
      thumb: brokenThumb(i + 3),
      signature: "— integrity check failed —",
      tags: ["integrity"],
    }),
  );
});

/* ---------------- generated library ---------------- */
const words = ["aurora", "harbor", "cobalt", "meridian", "lantern", "quartz", "vertex", "saffron", "nomad", "ember", "delta", "orbit"];
const albums = ["Midnight Cartography", "Paper Lanterns", "Static Bloom", "Analog Weather", "Blue Hour Sessions"];
const artists = ["Kite Machine", "Nova Reyes", "The Longwave", "Sora Ito", "Field Notes"];
const installers = ["VSCodeUserSetup-x64-1.92.2.exe", "Docker Desktop Installer 4.32.exe", "Obsidian-1.6.7.AppImage", "postgres-16.3-1-linux-x64.run", "Blender-4.2.0.dmg", "python-3.12.4-amd64.exe", "SlackSetup-4.39.exe", "krita-5.2.3-x86_64.appimage"];
const docNames = ["invoice", "contract", "statement", "report", "whitepaper", "roadmap", "proposal", "minutes", "spec", "syllabus"];

function genDownloads(count: number) {
  for (let i = 0; i < count; i++) {
    const roll = r();
    if (roll < 0.14) files.push(mk(pick(installers).replace(/(\.\w+)$/, `-${int(1, 9)}$1`), "Downloads", "downloads", int(20, 480) * 1024 * 1024, int(1, 400)));
    else if (roll < 0.34) files.push(mk(`${pick(docNames)}-2026-${String(int(1, 199)).padStart(3, "0")}.pdf`, "Downloads", "downloads", int(80, 9000) * 1024, int(1, 500)));
    else if (roll < 0.5) files.push(mk(`${pick(words)}-${pick(words)}-${int(1000, 9999)}.zip`, "Downloads", "downloads", int(2, 900) * 1024 * 1024, int(1, 420)));
    else if (roll < 0.62) files.push(mk(`Screenshot_2026-0${int(1, 9)}-${int(10, 28)}.png`, "Downloads", "downloads", int(200, 2400) * 1024, int(1, 200), { tags: ["screenshot"] }));
    else if (roll < 0.72) files.push(mk(`clip_${int(1000, 9999)}.mp4`, "Downloads", "downloads", int(40, 1800) * 1024 * 1024, int(1, 300)));
    else if (roll < 0.8) files.push(mk(`part_${int(100, 999)}.rar`, "Downloads", "downloads", int(10, 400) * 1024 * 1024, int(30, 600)));
    else if (roll < 0.88) files.push(mk(`${pick(words)}_wallpaper_${int(1, 40)}.jpg`, "Downloads", "downloads", int(1, 12) * 1024 * 1024, int(1, 365)));
    else if (roll < 0.94) files.push(mk(`download_${int(10000, 99999)}.crdownload`, "Downloads", "downloads", int(1, 700) * 1024 * 1024, int(2, 90), { broken: { reason: "Partial download", detail: "Browser download never completed", repairable: false, confidence: 1 }, tags: ["integrity"] }));
    else files.push(mk(`${pick(words)}-notes.txt`, "Downloads", "downloads", int(1, 90) * 1024, int(1, 300)));
  }
}

function genPictures(count: number) {
  for (let i = 0; i < count; i++) {
    const roll = r();
    if (roll < 0.46) files.push(mk(`IMG_${int(1000, 9999)}.${r() < 0.25 ? "heic" : "jpg"}`, "Pictures/Camera Roll", "pictures", int(1800, 9000) * 1024, int(1, 700), { tags: [pick(["travel", "family", "food", "city", "dog", "nature"])] }));
    else if (roll < 0.68) files.push(mk(`Screenshot 2026-0${int(1, 9)}-${int(10, 28)} at ${int(9, 22)}.${int(10, 59)}.png`, "Pictures/Screenshots", "pictures", int(300, 3200) * 1024, int(1, 240), { tags: ["screenshot"] }));
    else if (roll < 0.84) files.push(mk(`sd_output_${String(int(1, 999)).padStart(5, "0")}.png`, "Pictures/AI", "pictures", int(2400, 8200) * 1024, int(1, 180), { tags: ["ai_art"] }));
    else if (roll < 0.92) files.push(mk(`${pick(words)}_logo_v${int(1, 6)}.svg`, "Pictures/Logos", "pictures", int(8, 220) * 1024, int(20, 600), { tags: ["logo"] }));
    else files.push(mk(`meme_${int(100, 999)}.jpg`, "Pictures/Memes", "pictures", int(80, 900) * 1024, int(1, 400), { tags: ["meme"] }));
  }
}

function genDocuments(count: number) {
  for (let i = 0; i < count; i++) {
    const roll = r();
    const dir = pick(["Documents/Work", "Documents/Personal", "Documents/Notes", "Documents/Finance"]);
    if (roll < 0.4) files.push(mk(`${pick(docNames)}_${pick(words)}_${int(2023, 2026)}.pdf`, dir, "documents", int(120, 12000) * 1024, int(1, 900)));
    else if (roll < 0.66) files.push(mk(`${pick(docNames)}-${pick(words)}.docx`, dir, "documents", int(40, 3000) * 1024, int(1, 800)));
    else if (roll < 0.84) files.push(mk(`budget_${pick(words)}_Q${int(1, 4)}.xlsx`, dir, "documents", int(30, 900) * 1024, int(1, 700)));
    else files.push(mk(`${pick(words)}-notes.md`, dir, "documents", int(2, 120) * 1024, int(1, 500)));
  }
}

function genProjects(count: number) {
  const srcs = ["main.py", "scanner.py", "index.tsx", "worker.rs", "schema.sql", "pipeline.ipynb", "docker-compose.yml", "hasher.go", "App.tsx", "similarity.py"];
  for (let i = 0; i < count; i++) {
    const roll = r();
    if (roll < 0.62) files.push(mk(pick(srcs), pick(["Projects/sasha-agent/src", "Projects/sasha-agent/tests", "Projects/portfolio-site", "Projects/ml-notes"]), "projects", int(1, 220) * 1024, int(1, 300)));
    else if (roll < 0.82) files.push(mk(`${pick(words)}_mockup_v${int(1, 9)}.psd`, "Projects/design-lab", "projects", int(20, 700) * 1024 * 1024, int(5, 400)));
    else files.push(mk(`${pick(words)}-brand.fig`, "Projects/design-lab", "projects", int(4, 90) * 1024 * 1024, int(5, 300)));
  }
}

function genMusic(count: number) {
  for (let i = 0; i < count; i++) {
    const album = pick(albums);
    const t = int(1, 14);
    files.push(mk(`${String(t).padStart(2, "0")} - ${pick(words)} ${pick(words)}.${r() < 0.3 ? "flac" : "mp3"}`, `Music/${pick(artists)}/${album}`, "music", int(3, 60) * 1024 * 1024, int(30, 1200), { tags: ["music"] }));
  }
}

function genVideos(count: number) {
  for (let i = 0; i < count; i++) {
    const big = r() < 0.3;
    files.push(
      mk(
        `${pick(["capture", "session", "trip", "tutorial", "render"])}_${int(100, 999)}.${pick(["mp4", "mkv", "mov"])}`,
        pick(["Videos/Recordings", "Videos/Exports", "Videos"]),
        "videos",
        (big ? int(1200, 7400) : int(80, 900)) * 1024 * 1024,
        int(5, 900),
      ),
    );
  }
}

function genMisc(count: number) {
  for (let i = 0; i < count; i++) {
    const roll = r();
    if (roll < 0.4) files.push(mk(`${pick(words)}.lnk`, "Desktop", "desktop", int(1, 4) * 1024, int(10, 700)));
    else if (roll < 0.6) files.push(mk(`${pick(words)}-${int(1, 99)}.url`, "Desktop", "desktop", 512, int(10, 800)));
    else if (roll < 0.85) files.push(mk(`backup_${pick(words)}_2025.${pick(["zip", "bak"])}`, "Archives/Backups", "archives", int(400, 9000) * 1024 * 1024, int(100, 800)));
    else files.push(mk(`${pick(words)}_archive.part${int(1, 5)}.rar`, "Archives", "archives", int(100, 2000) * 1024 * 1024, int(60, 700)));
  }
}

genDownloads(320);
genPictures(430);
genDocuments(260);
genProjects(210);
genMusic(150);
genVideos(90);
genMisc(120);

/* extra rename candidates from the generated pool */
const renamePool = files.filter(
  (f) => !f.suggestion && !f.broken && f.kind === "image" && (f.tags.includes("screenshot") || f.tags.includes("ai_art") || /^IMG_|^DSC/.test(f.name)),
);
renamePool.slice(0, 46).forEach((f, i) => {
  const sub = f.tags.includes("screenshot")
    ? pick(["github pull request review", "figma component library", "terminal build log", "calendar week view", "stripe payout dashboard"])
    : f.tags.includes("ai_art")
      ? pick(["crystalline desert monolith", "retro spaceship cockpit", "bioluminescent forest path", "brutalist tower at dusk"])
      : pick(["mountain lake at sunrise", "street market at night", "coffee flatlay on marble", "surf break at low tide", "city skyline in fog"]);
  const isShot = f.tags.includes("screenshot");
  f.suggestion = {
    name: `${sub.split(" ").join("-")}${isShot ? "-screen" : ""}.${f.ext}`.toLowerCase(),
    confidence: 0.78 + ((i * 7) % 20) / 100,
    model: isShot ? "PaddleOCR v4 + rules" : f.tags.includes("ai_art") ? "SDXL metadata + CLIP" : "CLIP ViT-B/32 + BLIP caption",
    subject: sub,
    ocr: isShot ? `${sub.toUpperCase()} · sasha-app · 2026-0${(i % 9) + 1}-${10 + (i % 18)} · 1440×900` : undefined,
    reason: isShot ? "OCR headline + window chrome detection" : "Vision caption with 0.9 cosine to subject cluster",
  };
});

/* subject clusters for photo grouping */
export const subjectClusters = [
  { name: "Dogs & parks", count: files.filter((f) => f.tags.includes("dog")).length + 34, color: "var(--teal)" },
  { name: "Screenshots · work", count: files.filter((f) => f.tags.includes("screenshot")).length, color: "var(--blue)" },
  { name: "AI generated art", count: files.filter((f) => f.tags.includes("ai_art")).length, color: "var(--magenta)" },
  { name: "Logos & marks", count: files.filter((f) => f.tags.includes("logo")).length, color: "var(--lime)" },
  { name: "Memes", count: files.filter((f) => f.tags.includes("meme")).length, color: "var(--amber)" },
  { name: "Travel & city", count: files.filter((f) => f.tags.includes("travel") || f.tags.includes("city")).length, color: "var(--violet)" },
];

seedRoots.forEach((root) => {
  root.files = files.filter((f) => f.rootId === root.id).length;
});

export const seedFiles = files;

/* ---------------- folder naming suggestions ---------------- */
export const seedFolderSuggestions: FolderSuggestion[] = [
  { id: "fs1", dir: "Music", current: "Music", suggested: "Music Collection", reason: "150 tagged audio files across 5 artists / 5 albums — ID3 metadata dominant", confidence: 0.96, files: 150, state: "pending" },
  { id: "fs2", dir: "Documents/Finance", current: "Finance", suggested: "Financial Records", reason: "68 invoices, 14 statements, 9 tax PDFs detected by OCR keywords", confidence: 0.94, files: 91, state: "pending" },
  { id: "fs3", dir: "Pictures/AI", current: "AI", suggested: "AI Generated Images", reason: "PNG tEXt chunks contain Stable Diffusion prompts in 92% of files", confidence: 0.98, files: 74, state: "pending" },
  { id: "fs4", dir: "Downloads", current: "Downloads", suggested: "Inbox — Unsorted Downloads", reason: "Mixed 6-category intake folder; 320 items awaiting triage", confidence: 0.81, files: 320, state: "pending" },
  { id: "fs5", dir: "Projects/design-lab", current: "design-lab", suggested: "Brand Design Workspace", reason: "PSD/FIG dominant, shared color tokens across 41 documents", confidence: 0.89, files: 58, state: "pending" },
  { id: "fs6", dir: "Pictures/Camera Roll", current: "Camera Roll", suggested: "Camera Imports 2024–2026", reason: "EXIF capture dates span 26 months, 3 device models", confidence: 0.92, files: 198, state: "pending" },
];

/* ---------------- rules, views, logs ---------------- */
export const seedRules: Rule[] = [
  { id: "r1", match: "*.crdownload", target: "Downloads/Partial", enabled: true, hits: 21 },
  { id: "r2", match: "/invoice|receipt/", target: "Documents/PDF", enabled: true, hits: 68 },
  { id: "r3", match: "*.psd", target: "Projects/Design", enabled: true, hits: 41 },
  { id: "r4", match: "*.flac", target: "Media/Music/Lossless", enabled: true, hits: 44 },
  { id: "r5", match: "screenshot", target: "Media/Images/Screenshots", enabled: true, hits: 132 },
  { id: "r6", match: "*.iso", target: "Archives/Backup", enabled: false, hits: 3 },
];

export const seedViews: SavedView[] = [
  { id: "v1", name: "Big videos", query: "", kind: "video", minSize: 1024 ** 3, olderThanDays: 0, status: "all", sort: "size-desc" },
  { id: "v2", name: "Screenshots inbox", query: "screenshot", kind: "image", minSize: 0, olderThanDays: 0, status: "all", sort: "modified-desc" },
  { id: "v3", name: "Stale installers", query: "", kind: "installer", minSize: 0, olderThanDays: 180, status: "all", sort: "modified-asc" },
];

export const seedLogs: LogEntry[] = [
  { id: "l1", at: NOW - 1000 * 60 * 4, level: "success", source: "watchdog", message: "Real-time monitor attached to 3 roots (inotify / FSEvents / ReadDirectoryChangesW)" },
  { id: "l2", at: NOW - 1000 * 60 * 22, level: "ai", source: "vision", message: "ONNX runtime loaded CLIP ViT-B/32 (CPU, 4 threads) in 412 ms" },
  { id: "l3", at: NOW - 1000 * 60 * 61, level: "warn", source: "integrity", message: "10 damaged files quarantined to review — no automatic action taken" },
  { id: "l4", at: NOW - 1000 * 60 * 96, level: "info", source: "index", message: "Incremental index checkpoint written to sasha.db (WAL, 38 MB)" },
  { id: "l5", at: NOW - 1000 * 60 * 140, level: "success", source: "backup", message: "Snapshot created before last batch: .sasha/backups/2026-03-12T08-14" },
];

export const storageHistory = Array.from({ length: 12 }, (_, i) => {
  const base = 612 + i * 9 + Math.sin(i / 2) * 14;
  return { month: ["Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec", "Jan", "Feb", "Mar"][i], gb: Math.round(base * 10) / 10, reclaimed: i < 3 ? 0 : Math.round((4 + Math.sin(i) * 3 + i) * 10) / 10 };
});

export const DISK_TOTAL = 1024 * 1024 * 1024 * 1024; // 1 TB

/* ---------------- lazy thumbnail resolution ---------------- */
const thumbCache = new Map<string, string>();
export function thumbFor(f: FileRec): string {
  if (f.photo) return f.photo;
  if (f.thumb) return f.thumb;
  const hit = thumbCache.get(f.id);
  if (hit) return hit;
  const seed = f.id.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  let out: string;
  if (f.broken) out = brokenThumb(seed);
  else if (f.kind === "image") {
    const sub = imageSubkind(f.name, f.tags);
    out = sub === "Screenshots" ? screenshotThumb(seed, seed % 3 === 0 ? "dashboard" : seed % 3 === 1 ? "order" : "code")
      : sub === "AI_Art" ? artThumb(seed)
      : sub === "Logos" ? logoThumb(seed)
      : sub === "Memes" ? memeThumb(seed)
      : artThumb(seed + 17);
  } else if (f.kind === "video") out = videoThumb(seed, `${int(1, 40)}:${String(seed % 60).padStart(2, "0")}`);
  else if (f.kind === "music" || f.kind === "audio") out = waveThumb(seed, f.kind === "music" ? "#17d4b4" : "#22d3ee");
  else if (f.kind === "document") out = docThumb(seed, f.ext === "pdf" ? "pdf" : f.ext === "xlsx" || f.ext === "csv" ? "excel" : f.ext === "docx" ? "word" : "text");
  else out = genericThumb(seed, (f.ext || "bin").toUpperCase().slice(0, 5));
  thumbCache.set(f.id, out);
  return out;
}