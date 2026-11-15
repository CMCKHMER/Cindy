"""Dependency-free PDF writer for /api/report?format=pdf (Helvetica, multi-page)."""
from __future__ import annotations


def _ascii(s: str) -> str:
    return (str(s).replace("\u2192", "->").replace("\u2014", "-").replace("\u00b7", "-")
            .encode("ascii", "ignore").decode())


def _esc(s: str) -> str:
    return _ascii(s).replace("\\", r"\\").replace("(", r"\(").replace(")", r"\)")


def build_report_pdf(summary: dict, operations: list[dict]) -> bytes:
    W, H, M = 595.28, 841.89, 46
    lines: list[tuple[str, float, bool, tuple[float, float, float]]] = [
        ("SASHA MAID", 24, True, (0.05, 0.62, 0.55)),
        ("AI File Organizer Agent - session report", 12, False, (0.38, 0.44, 0.56)),
        ("Summary", 13, True, (0.05, 0.62, 0.55)),
    ]
    lines += [(f"{k.replace('_', ' '):.<34} {v}", 9.5, False, (0.06, 0.09, 0.16)) for k, v in summary.items()]
    lines.append(("Operations", 13, True, (0.05, 0.62, 0.55)))
    for op in operations[:60]:
        lines.append((f"[{op['kind']}] {op['label']}  ({op['bytes']} bytes)", 9.5, True, (0.06, 0.09, 0.16)))
        lines.append((f"backup {op['backup_path']}  undone={op['undone']}", 8.5, False, (0.38, 0.44, 0.56)))

    pages, stream, y = [], "", H - M
    for text, size, bold, color in lines:
        if y - size < M + 26:
            pages.append(stream)
            stream, y = "", H - M
        stream += f"BT /{'F2' if bold else 'F1'} {size} Tf {color[0]} {color[1]} {color[2]} rg 1 0 0 1 {M} {y:.2f} Tm ({_esc(text)}) Tj ET\n"
        y -= size * 1.5
    pages.append(stream)

    objects: dict[int, str] = {
        1: "<< /Type /Catalog /Pages 2 0 R >>",
        2: f"<< /Type /Pages /Kids [{' '.join(f'{5 + i * 2} 0 R' for i in range(len(pages)))}] /Count {len(pages)} >>",
        3: "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
        4: "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>",
    }
    for i, content in enumerate(pages):
        pid = 5 + i * 2
        body = content + f"BT /F1 8 Tf 0.45 0.5 0.6 rg 1 0 0 1 {M} 30 Tm (Sasha Maid - page {i + 1} of {len(pages)} - approval required for destructive actions) Tj ET\n"
        objects[pid] = (f"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 {W} {H}] "
                        f"/Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents {pid + 1} 0 R >>")
        objects[pid + 1] = f"<< /Length {len(body)} >>\nstream\n{body}endstream"

    pdf = "%PDF-1.4\n"
    offsets = {}
    for i in sorted(objects):
        offsets[i] = len(pdf)
        pdf += f"{i} 0 obj\n{objects[i]}\nendobj\n"
    xref = len(pdf)
    pdf += f"xref\n0 {len(objects) + 1}\n0000000000 65535 f \n"
    for i in sorted(objects):
        pdf += f"{offsets[i]:010d} 00000 n \n"
    pdf += f"trailer\n<< /Size {len(objects) + 1} /Root 1 0 R >>\nstartxref\n{xref}\n%%EOF"
    return pdf.encode("latin-1", "ignore")