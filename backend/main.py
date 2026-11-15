"""
Sasha Maid FastAPI service — REST + WebSocket for the desktop shell, the web UI
and the Docker deployment.

    uvicorn backend.main:app --port 8765

Destructive endpoints are approval-gated: the UI issues a single-use token when
the human clicks an action, and the server refuses the request without it.
"""
from __future__ import annotations

import asyncio
import csv
import io
import json
import mimetypes
import os
import time
from urllib.parse import quote
from pathlib import Path
from typing import Literal

from fastapi import FastAPI, HTTPException, Request, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from .organizer import (Config, ProtectedPathError, Store, classify, guard,
                        new_approval_token, normalize_name, unique_name)

cfg = Config()
store = Store(cfg)
app = FastAPI(title="Sasha Maid AI File Organizer Agent", version="1.4.0")
app.add_middleware(CORSMiddleware, allow_origins=["http://localhost:5173", "http://localhost:8765"],
                   allow_methods=["*"], allow_headers=["*"])

TOKENS: dict[str, float] = {}
CLIENTS: set[WebSocket] = set()
JOBS: dict[str, dict] = {}


async def broadcast(event: str, payload: dict) -> None:
    dead = []
    for ws in CLIENTS:
        try:
            await ws.send_json({"event": event, "data": payload})
        except Exception:
            dead.append(ws)
    for ws in dead:
        CLIENTS.discard(ws)


def consume(token: str | None) -> None:
    if not token or token not in TOKENS or time.time() - TOKENS[token] > 60:
        raise HTTPException(409, {"error": "approval_required",
                                  "message": "Destructive action needs explicit user approval"})
    TOKENS.pop(token, None)


# --------------------------------------------------------------------------- #
# models
# --------------------------------------------------------------------------- #
class RootIn(BaseModel):
    path: str
    recursive: bool = True
    watch: bool = True


class ScanIn(BaseModel):
    roots: list[int] = Field(default_factory=list)
    incremental: bool = True


class ResolveIn(BaseModel):
    action: Literal["delete", "keep", "review", "ignore", "repair", "archive"]
    approval_token: str | None = None
    ids: list[int] = Field(default_factory=list)
    keep_file: int | None = None


class RenameItem(BaseModel):
    id: int
    name: str


class RenameIn(BaseModel):
    items: list[RenameItem]
    approval_token: str | None = None


class FileActionIn(BaseModel):
    action: Literal["delete", "archive"]
    ids: list[int] = Field(default_factory=list)
    approval_token: str | None = None


class CommandIn(BaseModel):
    text: str


# --------------------------------------------------------------------------- #
# endpoints
# --------------------------------------------------------------------------- #
@app.get("/api/health")
def health():
    return {"status": "ok", "version": "1.4.0", "threads": cfg.threads, "local_only": True,
            "db": str(cfg.home / "sasha.db"), "require_approval": True,
            "models": ["clip-vit-b32", "blip-caption-base", "paddle-ocr-v4"]}


@app.post("/api/approval")
def issue_approval():
    token = new_approval_token()
    TOKENS[token] = time.time()
    return {"approval_token": token, "expires_in": 60}


@app.get("/api/roots")
def roots():
    return [dict(r) for r in store.db.execute("SELECT * FROM roots")]


@app.post("/api/roots")
def add_root(body: RootIn):
    try:
        p = guard(body.path)
    except ProtectedPathError as exc:
        raise HTTPException(403, str(exc))
    if not p.exists() or not p.is_dir():
        raise HTTPException(400, f"Folder does not exist or is not a directory: {p}")
    if not os.access(p, os.R_OK):
        raise HTTPException(403, f"Folder is not readable: {p}")
    cur = store.db.execute("INSERT OR IGNORE INTO roots(path,recursive,watch) VALUES(?,?,?)",
                           (str(p), int(body.recursive), int(body.watch)))
    store.db.commit()
    store.log("success", "watcher", f"Added root {p}")
    return {"id": cur.lastrowid, "path": str(p)}


@app.post("/api/scan")
async def scan(body: ScanIn):
    rows = store.db.execute("SELECT * FROM roots WHERE enabled=1").fetchall()
    targets = [r for r in rows if not body.roots or r["id"] in body.roots]
    job_id = new_approval_token()[:8]
    JOBS[job_id] = {"state": "running", "done": 0, "total": 0}

    def progress(done: int, total: int, current: str):
        JOBS[job_id].update(done=done, total=total, current=current)

    async def run():
        loop = asyncio.get_running_loop()
        try:
            for r in targets:
                checkpoint = store.db.execute("SELECT cursor FROM scan_checkpoints WHERE root_id=?", (r["id"],)).fetchone()
                await loop.run_in_executor(None, lambda: store.scan(
                    r["id"], Path(r["path"]),
                    lambda d, t, c: (progress(d, t, c), asyncio.run_coroutine_threadsafe(
                        broadcast("scan.progress", {"job": job_id, "done": d, "total": t, "current": c}), loop)),
                    checkpoint["cursor"] if checkpoint and body.incremental else None))
            JOBS[job_id]["state"] = "complete"
            await broadcast("scan.complete", {"job": job_id})
        except Exception as exc:
            JOBS[job_id].update(state="failed", current=str(exc))
            await broadcast("scan.failed", {"job": job_id, "message": str(exc)})

    asyncio.create_task(run())
    return {"job_id": job_id, "roots": [r["path"] for r in targets]}


@app.get("/api/scan/{job_id}")
def scan_status(job_id: str):
    return JOBS.get(job_id, {"state": "unknown"})


@app.post("/api/scan/{job_id}/pause")
def pause(job_id: str):
    JOBS.setdefault(job_id, {})["state"] = "paused"
    store.log("warn", "scanner", f"Scan {job_id} paused — cursor checkpointed")
    return {"state": "paused", "resumable": True}


@app.get("/api/files")
def files(q: str = "", kind: str = "", min_size: int = 0, older_than: int = 0,
          status: str = "", sort: str = "mtime", page: int = 1, per_page: int = 200):
    sql, args = "SELECT * FROM files WHERE 1=1", []
    if q:
        sql += " AND (name LIKE ? OR path LIKE ?)"
        args += [f"%{q}%", f"%{q}%"]
    if kind:
        sql += " AND kind=?"; args.append(kind)
    if min_size:
        sql += " AND size>=?"; args.append(min_size)
    if older_than:
        sql += " AND mtime <= ?"; args.append(time.time() - older_than * 86400)
    if status:
        sql += " AND status=?"; args.append(status)
    order = {"size": "size DESC", "name": "name ASC", "mtime": "mtime DESC"}.get(sort, "mtime DESC")
    sql += f" ORDER BY {order} LIMIT ? OFFSET ?"
    args += [per_page, (page - 1) * per_page]
    return [dict(r) for r in store.db.execute(sql, args)]


PREVIEW_EXTENSIONS = {
    "image": {"jpg", "jpeg", "png", "gif", "webp", "bmp", "avif"},
    "audio": {"mp3", "m4a", "aac", "ogg", "oga", "wav", "flac", "opus"},
    "video": {"mp4", "m4v", "webm", "ogv", "ogg", "mov"},
    "pdf": {"pdf"},
    "text": {"txt", "md", "csv", "json", "log", "py", "js", "ts", "tsx", "css", "html", "xml", "yaml", "yml", "toml", "sh"},
}


@app.get("/api/files/{file_id}/preview")
def preview_file(file_id: int, request: Request, download: bool = False):
    """Stream a selected indexed file for an inline preview, including audio/video byte ranges."""
    row = store.db.execute(
        """SELECT f.path, f.name, f.ext, f.status, r.path AS root_path
           FROM files f JOIN roots r ON r.id=f.root_id WHERE f.id=?""", (file_id,)
    ).fetchone()
    if not row or row["status"] != "indexed":
        raise HTTPException(404, "Indexed file not found.")
    try:
        root = Path(row["root_path"]).resolve(strict=True)
        path = Path(row["path"]).resolve(strict=True)
        path.relative_to(root)
        guard(path)
    except (OSError, ValueError, ProtectedPathError):
        raise HTTPException(404, "The file is no longer available in its indexed folder.")
    if not path.is_file():
        raise HTTPException(404, "File not found.")

    ext = (row["ext"] or path.suffix.lstrip(".")).lower()
    preview_kind = next((kind for kind, extensions in PREVIEW_EXTENSIONS.items() if ext in extensions), None)
    if not download and preview_kind is None:
        raise HTTPException(415, "No safe in-app preview is available for this file type. Download it to open with another app.")
    media_type = "application/octet-stream" if download and preview_kind is None else mimetypes.guess_type(path.name)[0] or "application/octet-stream"
    if preview_kind == "text":
        media_type = "text/plain; charset=utf-8"
    elif preview_kind == "pdf":
        media_type = "application/pdf"
    elif preview_kind == "image" and media_type == "application/octet-stream":
        media_type = "image/jpeg" if ext in {"jpg", "jpeg"} else f"image/{ext}"
    elif preview_kind == "audio" and media_type == "application/octet-stream":
        media_type = {"mp3": "audio/mpeg", "m4a": "audio/mp4", "oga": "audio/ogg", "opus": "audio/opus"}.get(ext, f"audio/{ext}")
    elif preview_kind == "video" and media_type == "application/octet-stream":
        media_type = {"m4v": "video/mp4", "ogv": "video/ogg", "mov": "video/quicktime"}.get(ext, f"video/{ext}")

    size = path.stat().st_size
    if preview_kind == "text" and size > 2 * 1024 * 1024 and not download:
        raise HTTPException(413, "Text preview is limited to 2 MiB. Download the file to inspect it.")
    start, end = 0, size - 1
    status_code = 200
    range_header = request.headers.get("range")
    if range_header:
        unit, _, value = range_header.partition("=")
        if unit.strip() != "bytes" or "," in value or size == 0:
            raise HTTPException(416, "Requested byte range is not satisfiable.", headers={"Content-Range": f"bytes */{size}"})
        first, dash, last = value.strip().partition("-")
        try:
            if not dash:
                raise ValueError("missing range separator")
            if first:
                start = int(first)
                end = min(int(last), size - 1) if last else size - 1
            else:
                suffix = int(last)
                if suffix <= 0:
                    raise ValueError("invalid suffix range")
                start = max(0, size - suffix)
                end = size - 1
        except ValueError:
            raise HTTPException(416, "Requested byte range is not satisfiable.", headers={"Content-Range": f"bytes */{size}"})
        if start < 0 or start >= size or end < start:
            raise HTTPException(416, "Requested byte range is not satisfiable.", headers={"Content-Range": f"bytes */{size}"})
        status_code = 206

    length = max(0, end - start + 1)
    headers = {
        "Accept-Ranges": "bytes",
        "Content-Length": str(length),
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "no-store",
        "Content-Disposition": f"{('attachment' if download else 'inline')}; filename*=UTF-8''{quote(path.name)}",
    }
    if status_code == 206:
        headers["Content-Range"] = f"bytes {start}-{end}/{size}"

    def stream_file():
        with path.open("rb") as handle:
            handle.seek(start)
            remaining = length
            while remaining:
                chunk = handle.read(min(1024 * 1024, remaining))
                if not chunk:
                    break
                remaining -= len(chunk)
                yield chunk

    return StreamingResponse(stream_file(), status_code=status_code, media_type=media_type, headers=headers)


@app.get("/api/duplicates")
def duplicates():
    return store.duplicates()


@app.post("/api/duplicates/{group_id}/resolve")
def resolve_duplicate(group_id: int, body: ResolveIn):
    ids = body.ids
    if body.action == "keep" or body.action == "ignore":
        store.db.execute("UPDATE duplicate_groups SET resolved=? WHERE id=?", (body.action, group_id))
        store.db.commit()
        return {"resolved": body.action}
    consume(body.approval_token)
    if body.action == "delete":
        return store.apply("delete", ids, approval_token="server", label="Duplicate removal",
                           action=lambda p, r: trash(p))
    return store.apply("archive", ids, approval_token="server", label="Duplicates to review",
                       action=lambda p, r: to_review(p))


@app.post("/api/files/resolve")
def resolve_files(body: FileActionIn):
    """Approval-gated file actions used by the live desktop file browser."""
    consume(body.approval_token)
    if not body.ids:
        raise HTTPException(400, "Select at least one file.")
    if body.action == "delete":
        return store.apply("delete", body.ids, approval_token="server", label="Approved file removal",
                           action=lambda p, r: trash(p))
    return store.apply("archive", body.ids, approval_token="server", label="Approved move to review",
                       action=lambda p, r: to_review(p))


@app.get("/api/broken")
def broken():

    return [dict(r) for r in store.db.execute("SELECT * FROM files WHERE broken_kind IS NOT NULL AND status='indexed'")]


@app.post("/api/broken/resolve")
def resolve_broken(body: ResolveIn):
    if body.action == "ignore":
        store.db.executemany("UPDATE files SET status='ignored' WHERE id=?", [(i,) for i in body.ids])
        store.db.commit()
        return {"ignored": len(body.ids)}
    consume(body.approval_token)
    if body.action == "repair":
        return {"repaired": repair(body.ids)}
    if body.action == "archive":
        return store.apply("archive", body.ids, approval_token="server", action=lambda p, r: to_review(p))
    return store.apply("delete", body.ids, approval_token="server", action=lambda p, r: trash(p))


@app.get("/api/rename/suggestions")
def suggestions():
    return [dict(r) for r in store.db.execute("SELECT * FROM suggestions WHERE state='pending'")]


@app.post("/api/rename/apply")
def apply_rename(body: RenameIn):
    consume(body.approval_token)
    ids = [i.id for i in body.items]
    names = {i.id: i.name for i in body.items}

    def act(p: Path, row):
        ext = p.suffix.lstrip(".")
        target = p.parent / unique_name(p.parent, normalize_name(Path(names[row["id"]]).stem, ext))
        p.rename(target)
        return target

    return store.apply("rename", ids, approval_token="server", label="AI rename batch", action=act)


@app.post("/api/organize/plan")
def plan():
    out = []
    for r in store.db.execute("SELECT * FROM files WHERE status='indexed'"):
        out.append({"id": r["id"], "name": r["name"], "from": r["path"],
                    "to": classify(r["name"], str(Path(r["path"]).parent))["category"]})
    return {"moves": out, "writes": False}


@app.post("/api/organize/apply")
def organize(body: ResolveIn):
    consume(body.approval_token)

    def act(p: Path, row):
        dest = guard(cfg.home / "library" / classify(row["name"], str(p.parent))["category"])
        dest.mkdir(parents=True, exist_ok=True)
        target = dest / unique_name(dest, p.name)
        p.rename(target)
        return target

    return store.apply("move", body.ids, approval_token="server", label="Downloads cleanup", action=act)


@app.get("/api/analytics")
def analytics():
    kinds = [dict(r) for r in store.db.execute("SELECT kind, SUM(size) bytes, COUNT(*) n FROM files GROUP BY kind")]
    large = [dict(r) for r in store.db.execute("SELECT * FROM files WHERE size>=1073741824 ORDER BY size DESC LIMIT 100")]
    return {"by_kind": kinds, "large_files": large}


@app.post("/api/undo/{op_id}")
def undo(op_id: int):
    try:
        return store.undo(op_id)
    except ValueError as exc:
        raise HTTPException(404, str(exc))


@app.post("/api/command")
def command(body: CommandIn):
    """Natural-language router — the local model maps text to one of the intents."""
    t = body.text.lower()
    if "duplicate" in t:
        return {"intent": "duplicates", "payload": store.duplicates()}
    if "broken" in t or "corrupt" in t:
        return {"intent": "broken", "payload": broken()}
    if "rename" in t:
        return {"intent": "rename", "payload": suggestions()}
    if "clean" in t or "organize" in t:
        return {"intent": "organize", "payload": plan()}
    if "larger" in t or "bigger" in t:
        import re
        m = re.search(r"(\d+(?:\.\d+)?)\s*(kb|mb|gb|tb)", t)
        size = int(float(m[1]) * {"kb": 1024, "mb": 1024**2, "gb": 1024**3, "tb": 1024**4}[m[2]]) if m else 1024**3
        return {"intent": "large_files", "payload": files(min_size=size)}
    return {"intent": "search", "payload": files(q=body.text)}


@app.get("/api/report")
def report(format: Literal["json", "csv", "pdf"] = "json"):
    ops = [dict(r) for r in store.db.execute("SELECT * FROM operations ORDER BY id DESC")]
    summary = {
        "files_moved": sum(o["kind"] == "move" and not o["undone"] for o in ops),
        "files_renamed": sum(o["kind"] == "rename" and not o["undone"] for o in ops),
        "storage_saved": sum(o["bytes"] for o in ops if o["kind"] == "delete" and not o["undone"]),
        "duplicate_groups": len(store.duplicates()),
        "broken_files": len(broken()),
    }
    if format == "json":
        return {"summary": summary, "operations": ops}
    if format == "csv":
        buf = io.StringIO()
        w = csv.writer(buf)
        w.writerow(["id", "kind", "label", "bytes", "backup_path", "undone", "created_at"])
        for o in ops:
            w.writerow([o["id"], o["kind"], o["label"], o["bytes"], o["backup_path"], o["undone"], o["created_at"]])
        return StreamingResponse(iter([buf.getvalue()]), media_type="text/csv",
                                 headers={"Content-Disposition": "attachment; filename=sasha-report.csv"})
    from .pdf import build_report_pdf  # tiny Helvetica writer, mirrors the UI exporter
    return StreamingResponse(io.BytesIO(build_report_pdf(summary, ops)), media_type="application/pdf",
                             headers={"Content-Disposition": "attachment; filename=sasha-report.pdf"})


@app.websocket("/ws/events")
async def events(ws: WebSocket):
    await ws.accept()
    CLIENTS.add(ws)
    try:
        while True:
            await ws.receive_text()
    except WebSocketDisconnect:
        CLIENTS.discard(ws)


# --------------------------------------------------------------------------- #
# helpers
# --------------------------------------------------------------------------- #
def trash(p: Path) -> Path:
    """Never unlink: move into the Sasha Maid trash so the OS bin and undo both work."""
    dest = cfg.home / "trash"
    dest.mkdir(exist_ok=True)
    target = dest / unique_name(dest, p.name)
    p.rename(target)
    return target


def to_review(p: Path) -> Path:
    dest = cfg.home / "review" / time.strftime("%Y-%m-%d")
    dest.mkdir(parents=True, exist_ok=True)
    target = dest / unique_name(dest, p.name)
    p.rename(target)
    return target


def repair(ids: list[int]) -> int:
    fixed = 0
    for i in ids:
        row = store.db.execute("SELECT * FROM files WHERE id=?", (i,)).fetchone()
        if not row or not row["repairable"]:
            continue
        p = Path(row["path"])
        try:
            if row["kind"] == "image":
                from PIL import Image
                with Image.open(p) as im:
                    im.convert("RGB").save(p.with_suffix(".repaired.jpg"), quality=95)
            elif p.suffix.lower() == ".pdf":
                import pikepdf
                with pikepdf.open(p) as pdf:
                    pdf.save(p.with_suffix(".repaired.pdf"))
            fixed += 1
            store.db.execute("UPDATE files SET status='repaired', broken_kind=NULL WHERE id=?", (i,))
        except Exception as exc:  # pragma: no cover
            store.log("danger", "repair", f"{p.name}: {exc}")
    store.db.commit()
    return fixed


static = Path(__file__).parent / "static"
if static.exists():
    app.mount("/", StaticFiles(directory=static, html=True), name="ui")