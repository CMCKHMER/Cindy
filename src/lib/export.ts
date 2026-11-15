import { type FileRec, type OpEntry, type DupGroup, type Settings, fmtBytes, renderPath, PLATFORM_META } from "./core";

export interface ReportInput {
  ops: OpEntry[];
  groups: (DupGroup & { members: FileRec[]; reclaimable: number })[];
  broken: FileRec[];
  renames: FileRec[];
  stats: { totalBytes: number; fileCount: number; savedBytes: number; movedCount: number; renamedCount: number; deletedCount: number; archivedCount: number; dupReclaim: number };
  settings: Settings;
  sections: { moved: boolean; renamed: boolean; duplicates: boolean; broken: boolean; storage: boolean; log: boolean };
}

export function download(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

const csvCell = (v: unknown) => {
  const s = String(v ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
export const toCSV = (rows: unknown[][]) => rows.map((r) => r.map(csvCell).join(",")).join("\r\n");

const stamp = () => new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");

export function reportJSON(input: ReportInput) {
  const active = input.ops.filter((o) => !o.undone);
  return {
    product: "Sasha Maid AI File Organizer Agent",
    version: "1.4.0",
    generated: new Date().toISOString(),
    platform: PLATFORM_META[input.settings.platform].label,
    policy: {
      automatic_deletion: false,
      overwrite_originals: false,
      rename_without_approval: false,
      system_folders_untouched: true,
      backups: input.settings.backups,
      undo_supported: true,
    },
    summary: {
      files_indexed: input.stats.fileCount,
      bytes_indexed: input.stats.totalBytes,
      files_moved: input.stats.movedCount,
      files_renamed: input.stats.renamedCount,
      files_deleted: input.stats.deletedCount,
      files_archived: input.stats.archivedCount,
      duplicate_groups: input.groups.length,
      reclaimable_bytes: input.stats.dupReclaim,
      reclaimed_bytes: input.stats.savedBytes,
      damaged_files: input.broken.length,
    },
    operations: active.map((o) => ({
      id: o.id, kind: o.kind, at: new Date(o.at).toISOString(), label: o.label, detail: o.detail,
      bytes: o.bytes, backup: o.backup, files: o.patches.length,
      changes: o.patches.map((p) => ({ file_id: p.id, before: p.before, after: p.after })),
    })),
    duplicates: input.groups.map((g) => ({
      id: g.id, type: g.kind, similarity: Number(g.similarity.toFixed(4)), reason: g.reason, resolved: g.resolved ?? null,
      keep: g.members.find((m) => m.id === g.keepId)?.name,
      members: g.members.map((m) => ({
        name: m.name, path: renderPath(m.dir, input.settings.platform, m.name), bytes: m.size,
        modified: new Date(m.modified).toISOString(), sha256: m.hash, phash: m.phash ?? null, role: m.id === g.keepId ? "original" : "duplicate",
      })),
    })),
    damaged: input.broken.map((f) => ({
      name: f.name, path: renderPath(f.dir, input.settings.platform, f.name), bytes: f.size,
      reason: f.broken?.reason, detail: f.broken?.detail, repairable: f.broken?.repairable, method: f.broken?.repairMethod ?? null,
    })),
    rename_suggestions: input.renames.map((f) => ({
      from: f.name, to: f.suggestion?.name, confidence: f.suggestion?.confidence, model: f.suggestion?.model,
      path: renderPath(f.dir, input.settings.platform), ocr: f.suggestion?.ocr ?? null,
    })),
  };
}

export function reportCSV(input: ReportInput) {
  const rows: unknown[][] = [];
  const p = input.settings.platform;
  rows.push(["Sasha Maid AI File Organizer — session report"]);
  rows.push(["Generated", new Date().toISOString()]);
  rows.push(["Platform", PLATFORM_META[p].label]);
  rows.push([]);
  rows.push(["SUMMARY", "value"]);
  rows.push(["Files indexed", input.stats.fileCount]);
  rows.push(["Bytes indexed", input.stats.totalBytes]);
  rows.push(["Files moved", input.stats.movedCount]);
  rows.push(["Files renamed", input.stats.renamedCount]);
  rows.push(["Files deleted (approved)", input.stats.deletedCount]);
  rows.push(["Files archived", input.stats.archivedCount]);
  rows.push(["Duplicate groups", input.groups.length]);
  rows.push(["Reclaimable bytes", input.stats.dupReclaim]);
  rows.push(["Reclaimed bytes", input.stats.savedBytes]);
  rows.push(["Damaged files", input.broken.length]);
  rows.push([]);
  if (input.sections.log) {
    rows.push(["OPERATIONS"]);
    rows.push(["timestamp", "kind", "label", "files", "bytes", "backup", "detail"]);
    input.ops.filter((o) => !o.undone).forEach((o) => rows.push([new Date(o.at).toISOString(), o.kind, o.label, o.patches.length, o.bytes, o.backup, o.detail]));
    rows.push([]);
  }
  if (input.sections.duplicates) {
    rows.push(["DUPLICATES"]);
    rows.push(["group", "type", "similarity", "role", "filename", "path", "bytes", "modified", "sha256"]);
    input.groups.forEach((g) =>
      g.members.forEach((m) =>
        rows.push([g.id, g.kind, `${(g.similarity * 100).toFixed(1)}%`, m.id === g.keepId ? "original" : "duplicate", m.name, renderPath(m.dir, p), m.size, new Date(m.modified).toISOString(), m.hash]),
      ),
    );
    rows.push([]);
  }
  if (input.sections.broken) {
    rows.push(["DAMAGED FILES"]);
    rows.push(["filename", "path", "bytes", "reason", "repairable", "method", "detail"]);
    input.broken.forEach((f) => rows.push([f.name, renderPath(f.dir, p), f.size, f.broken?.reason, f.broken?.repairable ? "yes" : "no", f.broken?.repairMethod ?? "", f.broken?.detail]));
    rows.push([]);
  }
  if (input.sections.renamed) {
    rows.push(["RENAME SUGGESTIONS"]);
    rows.push(["from", "to", "confidence", "model", "path"]);
    input.renames.forEach((f) => rows.push([f.name, f.suggestion?.name, `${Math.round((f.suggestion?.confidence ?? 0) * 100)}%`, f.suggestion?.model, renderPath(f.dir, p)]));
  }
  return rows;
}

/* ---------------- minimal PDF writer (Helvetica, no dependencies) ---------------- */

const ascii = (s: string) =>
  s.replace(/[→]/g, "->").replace(/[—–]/g, "-").replace(/[·•]/g, "-").replace(/[“”]/g, '"').replace(/[’]/g, "'").replace(/[^\x20-\x7E]/g, "");
const esc = (s: string) => ascii(s).replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");

interface Line { text: string; size: number; bold?: boolean; color?: [number, number, number]; gapBefore?: number; rule?: boolean }

export function reportPDF(input: ReportInput): Blob {
  const W = 595.28;
  const H = 841.89;
  const M = 46;
  const lines: Line[] = [];
  const p = input.settings.platform;
  const teal: [number, number, number] = [0.05, 0.62, 0.55];
  const ink: [number, number, number] = [0.06, 0.09, 0.16];
  const muted: [number, number, number] = [0.38, 0.44, 0.56];

  const push = (text: string, size = 9.5, opts: Partial<Line> = {}) => lines.push({ text, size, color: ink, ...opts });
  const wrap = (text: string, size: number, width: number) => {
    const max = Math.floor(width / (size * 0.5));
    const words = ascii(text).split(" ");
    const out: string[] = [];
    let cur = "";
    words.forEach((w) => {
      if ((cur + " " + w).trim().length > max) {
        out.push(cur.trim());
        cur = w;
      } else cur += " " + w;
    });
    if (cur.trim()) out.push(cur.trim());
    return out;
  };

  push("SASHA MAID", 24, { bold: true, color: teal });
  push("AI File Organizer Agent - session report", 12, { color: muted, gapBefore: 2 });
  push(`Generated ${new Date().toLocaleString()}   |   ${PLATFORM_META[p].label}   |   local-first, approval-gated`, 8.5, { color: muted, gapBefore: 4, rule: true });

  push("Summary", 13, { bold: true, gapBefore: 16, color: teal });
  const summary: [string, string][] = [
    ["Files indexed", input.stats.fileCount.toLocaleString()],
    ["Storage indexed", fmtBytes(input.stats.totalBytes)],
    ["Files moved", String(input.stats.movedCount)],
    ["Files renamed", String(input.stats.renamedCount)],
    ["Files deleted (approved)", String(input.stats.deletedCount)],
    ["Files archived to review", String(input.stats.archivedCount)],
    ["Duplicate groups found", String(input.groups.length)],
    ["Reclaimable from duplicates", fmtBytes(input.stats.dupReclaim)],
    ["Storage saved this session", fmtBytes(input.stats.savedBytes)],
    ["Damaged files awaiting review", String(input.broken.length)],
  ];
  summary.forEach(([k, v]) => push(`${k.padEnd(34, ".")} ${v}`, 9.5, { gapBefore: 3 }));

  push("Safety policy", 13, { bold: true, gapBefore: 16, color: teal });
  [
    "No file is ever deleted automatically - every destructive action required explicit approval.",
    "Originals are never overwritten; each batch wrote a snapshot to .sasha/backups before applying.",
    "OS-critical directories (System32, /System, /usr/bin, /etc, /boot) are permanently excluded.",
    "Every operation is journaled in SQLite and reversible from the Undo history.",
  ].forEach((t) => wrap(t, 9, W - M * 2).forEach((l) => push(l, 9, { color: muted, gapBefore: 2 })));

  if (input.sections.log) {
    push("Operations", 13, { bold: true, gapBefore: 16, color: teal });
    const act = input.ops.filter((o) => !o.undone);
    if (!act.length) push("No operations applied in this session.", 9, { color: muted, gapBefore: 3 });
    act.slice(0, 40).forEach((o) => {
      push(`${new Date(o.at).toLocaleTimeString()}  [${o.kind}]  ${o.label}`, 9.5, { bold: true, gapBefore: 6 });
      wrap(`${o.detail}  |  ${o.patches.length} files  |  ${fmtBytes(o.bytes)}  |  backup ${o.backup}`, 8.5, W - M * 2).forEach((l) => push(l, 8.5, { color: muted }));
    });
  }

  if (input.sections.duplicates) {
    push("Duplicate groups", 13, { bold: true, gapBefore: 16, color: teal });
    if (!input.groups.length) push("No duplicate groups outstanding.", 9, { color: muted, gapBefore: 3 });
    input.groups.slice(0, 18).forEach((g) => {
      push(`${g.kind.toUpperCase()} - ${(g.similarity * 100).toFixed(1)}% match - ${g.members.length} copies - ${fmtBytes(g.reclaimable)} reclaimable`, 9.5, { bold: true, gapBefore: 7 });
      g.members.forEach((m) => {
        const role = m.id === g.keepId ? "KEEP " : "copy ";
        wrap(`${role} ${renderPath(m.dir, p, m.name)}  (${fmtBytes(m.size)})`, 8.5, W - M * 2).forEach((l) => push(l, 8.5, { color: m.id === g.keepId ? ink : muted }));
      });
    });
  }

  if (input.sections.broken) {
    push("Damaged files", 13, { bold: true, gapBefore: 16, color: teal });
    if (!input.broken.length) push("No damaged files outstanding.", 9, { color: muted, gapBefore: 3 });
    input.broken.slice(0, 24).forEach((f) => {
      push(`${f.broken?.reason} - ${f.name} (${fmtBytes(f.size)})`, 9.5, { bold: true, gapBefore: 6 });
      wrap(`${f.broken?.detail}${f.broken?.repairable ? ` | repair: ${f.broken.repairMethod}` : " | no safe automated repair"}`, 8.5, W - M * 2).forEach((l) => push(l, 8.5, { color: muted }));
    });
  }

  if (input.sections.renamed) {
    push("Rename suggestions", 13, { bold: true, gapBefore: 16, color: teal });
    if (!input.renames.length) push("No pending rename suggestions.", 9, { color: muted, gapBefore: 3 });
    input.renames.slice(0, 30).forEach((f) => {
      wrap(`${f.name}  ->  ${f.suggestion?.name}   (${Math.round((f.suggestion?.confidence ?? 0) * 100)}%, ${f.suggestion?.model})`, 8.5, W - M * 2).forEach((l) => push(l, 8.5, { color: muted, gapBefore: 2 }));
    });
  }

  // paginate
  const pages: string[] = [];
  let stream = "";
  let y = H - M;
  const flush = () => {
    pages.push(stream);
    stream = "";
    y = H - M;
  };
  lines.forEach((l) => {
    const gap = l.gapBefore ?? 0;
    if (y - gap - l.size < M + 26) flush();
    y -= gap;
    const c = l.color ?? ink;
    stream += `BT /${l.bold ? "F2" : "F1"} ${l.size} Tf ${c[0]} ${c[1]} ${c[2]} rg 1 0 0 1 ${M} ${y.toFixed(2)} Tm (${esc(l.text)}) Tj ET\n`;
    if (l.rule) {
      stream += `0.75 w 0.8 0.85 0.92 RG ${M} ${(y - 7).toFixed(2)} m ${(W - M).toFixed(2)} ${(y - 7).toFixed(2)} l S\n`;
      y -= 6;
    }
    y -= l.size * 1.42;
  });
  flush();

  const objects: string[] = [];
  const pageIds = pages.map((_, i) => 5 + i * 2);
  objects[1] = `<< /Type /Catalog /Pages 2 0 R >>`;
  objects[2] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pages.length} >>`;
  objects[3] = `<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>`;
  objects[4] = `<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>`;
  pages.forEach((content, i) => {
    const pid = 5 + i * 2;
    const cid = pid + 1;
    const footer = `BT /F1 8 Tf 0.45 0.5 0.6 rg 1 0 0 1 ${M} 30 Tm (Sasha Maid - local AI librarian - page ${i + 1} of ${pages.length} - approval required for all destructive actions) Tj ET\n`;
    const body = content + footer;
    objects[pid] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W} ${H}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${cid} 0 R >>`;
    objects[cid] = `<< /Length ${body.length} >>\nstream\n${body}endstream`;
  });

  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [];
  for (let i = 1; i < objects.length; i++) {
    offsets[i] = pdf.length;
    pdf += `${i} 0 obj\n${objects[i]}\nendobj\n`;
  }
  const xref = pdf.length;
  pdf += `xref\n0 ${objects.length}\n0000000000 65535 f \n`;
  for (let i = 1; i < objects.length; i++) pdf += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return new Blob([pdf], { type: "application/pdf" });
}

export function exportReport(format: "pdf" | "csv" | "json", input: ReportInput): string {
  const name = `sasha-report-${stamp()}.${format}`;
  if (format === "json") download(name, new Blob([JSON.stringify(reportJSON(input), null, 2)], { type: "application/json" }));
  else if (format === "csv") download(name, new Blob(["\uFEFF" + toCSV(reportCSV(input))], { type: "text/csv;charset=utf-8" }));
  else download(name, reportPDF(input));
  return name;
}