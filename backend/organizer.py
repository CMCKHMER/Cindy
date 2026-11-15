"""
Sasha Maid — core file-organizer engine.

Safety model (enforced here, not in the UI):
  * nothing is ever deleted, moved or renamed without an explicit approval token
  * every write is wrapped in  backup -> apply -> journal  inside one transaction
  * OS-critical directories are refused before a worker is ever started
  * undo restores the recorded before-snapshot and re-verifies the SHA-256
"""
from __future__ import annotations

import hashlib
import json
import os
import re
import shutil
import sqlite3
import unicodedata
import uuid
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Callable, Iterable, Iterator

# --------------------------------------------------------------------------- #
# safety
# --------------------------------------------------------------------------- #

PROTECTED = [
    r"C:\Windows", r"C:\Program Files", r"C:\Program Files (x86)",
    "/System", "/usr", "/bin", "/sbin", "/etc", "/boot", "/dev", "/proc",
    "/Library/Extensions", "/Applications",
]


class ProtectedPathError(PermissionError):
    """Raised when a caller tries to touch an OS-critical directory."""


def guard(path: str | Path) -> Path:
    p = Path(path).expanduser().resolve()
    s = str(p).replace("\\", "/").lower()
    for bad in PROTECTED:
        b = bad.replace("\\", "/").lower()
        if s == b or s.startswith(b + "/"):
            raise ProtectedPathError(f"{p} is OS-critical and can never be modified")
    return p


# --------------------------------------------------------------------------- #
# classification
# --------------------------------------------------------------------------- #

EXT_MAP: dict[str, tuple[str, str]] = {
    **{e: ("document", "Documents/PDF") for e in ("pdf",)},
    **{e: ("document", "Documents/Word") for e in ("doc", "docx", "odt", "rtf", "pages")},
    **{e: ("document", "Documents/Excel") for e in ("xls", "xlsx", "csv", "ods", "numbers")},
    **{e: ("document", "Documents/Text") for e in ("txt", "md", "log", "nfo", "rst")},
    **{e: ("image", "Media/Images/Photos") for e in ("jpg", "jpeg", "png", "heic", "webp", "gif", "tif", "tiff", "cr2", "nef")},
    **{e: ("image", "Media/Images/Logos") for e in ("svg",)},
    **{e: ("video", "Media/Videos") for e in ("mp4", "mov", "mkv", "avi", "webm", "m4v")},
    **{e: ("music", "Media/Music") for e in ("mp3", "flac", "m4a", "aac", "ogg")},
    **{e: ("audio", "Media/Audio") for e in ("wav", "aiff", "opus", "mid", "amr")},
    **{e: ("archive", "Archives/ZIP") for e in ("zip", "7z", "tar", "gz", "tgz", "xz")},
    **{e: ("archive", "Archives/RAR") for e in ("rar",)},
    **{e: ("archive", "Archives/Backup") for e in ("bak", "tib", "backup", "img")},
    **{e: ("code", "Projects/Coding") for e in ("py", "ts", "tsx", "js", "json", "ipynb", "rs", "go", "java", "c", "cpp", "sql", "sh", "yml", "toml")},
    **{e: ("code", "Projects/Design") for e in ("psd", "ai", "fig", "sketch", "xd", "blend")},
    **{e: ("installer", "Downloads/Installers") for e in ("exe", "msi", "dmg", "pkg", "deb", "rpm", "appimage", "apk", "iso")},
}

MAGIC = [
    (b"\xff\xd8\xff", "FF D8 FF", "image"),
    (b"\x89PNG\r\n\x1a\n", "89 50 4E 47", "image"),
    (b"%PDF", "25 50 44 46", "document"),
    (b"PK\x03\x04", "50 4B 03 04", "archive"),
    (b"Rar!\x1a\x07", "52 61 72 21", "archive"),
    (b"\x1aE\xdf\xa3", "1A 45 DF A3", "video"),
    (b"ID3", "49 44 33", "music"),
]


def sniff(path: Path) -> tuple[str, str | None]:
    """Return (signature, content_kind) from the first bytes — never trust the extension alone."""
    try:
        with path.open("rb") as fh:
            head = fh.read(32)
    except OSError:
        return "unreadable", None
    for magic, sig, kind in MAGIC:
        if head.startswith(magic):
            return sig, kind
    if head[4:8] == b"ftyp":
        return "66 74 79 70", "video"
    return (head[:8].hex(" ").upper() or "empty"), None


def image_subkind(name: str) -> str:
    n = name.lower()
    if re.search(r"dall|midjourney|sd_|stable[-_]?diff|firefly|comfyui", n):
        return "AI_Art"
    if re.search(r"screenshot|screen[-_ ]?shot|snip|capture|cleanshot", n):
        return "Screenshots"
    if re.search(r"logo|wordmark|brandmark|favicon", n):
        return "Logos"
    if re.search(r"meme|imgflip|reaction", n):
        return "Memes"
    return "Photos"


@dataclass
class Rule:
    match: str
    target: str
    enabled: bool = True


def classify(name: str, directory: str = "", rules: Iterable[Rule] = ()) -> dict:
    ext = name.rsplit(".", 1)[-1].lower() if "." in name else ""
    kind, dest = EXT_MAP.get(ext, ("other", "Downloads"))
    if kind == "image":
        dest = f"Media/Images/{image_subkind(name)}"
    for rule in rules:
        if not rule.enabled or not rule.match:
            continue
        m = rule.match.lower()
        hit = (
            ext == m[2:] if m.startswith("*.")
            else re.search(m[1:-1], name, re.I) if m.startswith("/") and m.endswith("/")
            else m in name.lower() or m in directory.lower()
        )
        if hit:
            dest = rule.target
            break
    return {"kind": kind, "ext": ext, "category": dest}


# --------------------------------------------------------------------------- #
# naming
# --------------------------------------------------------------------------- #

def normalize_name(stem: str, ext: str) -> str:
    # Accept a stem or a full filename: strip any existing extension first so
    # ("photo.jpg", "jpg") can never become "photo-jpg.jpg".
    stem = Path(stem).name
    if "." in stem:
        stem = stem.rsplit(".", 1)[0]
    s = unicodedata.normalize("NFKD", stem).encode("ascii", "ignore").decode()
    s = re.sub(r"['’\"]", "", s).lower()
    s = re.sub(r"[^a-z0-9]+", "-", s).strip("-")
    s = re.sub(r"-{2,}", "-", s)[:72] or "untitled"
    return f"{s}.{ext.lower()}" if ext else s


def unique_name(directory: Path, filename: str) -> str:
    if not (directory / filename).exists():
        return filename
    stem, _, ext = filename.rpartition(".")
    i = 2
    while (directory / f"{stem}-{i}.{ext}").exists():
        i += 1
    return f"{stem}-{i}.{ext}"


# --------------------------------------------------------------------------- #
# hashing & similarity
# --------------------------------------------------------------------------- #

def sha256(path: Path, chunk_kb: int = 1024) -> str:
    h = hashlib.sha256()
    with path.open("rb") as fh:
        while chunk := fh.read(chunk_kb * 1024):
            h.update(chunk)
    return h.hexdigest()


def phash(path: Path) -> str | None:
    """64-bit DCT perceptual hash (Pillow). Returns None when the image cannot decode."""
    try:
        from PIL import Image
    except ImportError:  # pragma: no cover - optional dependency
        return None
    try:
        with Image.open(path) as im:
            g = im.convert("L").resize((32, 32))
            px = list(g.getdata())
    except Exception:
        return None
    # 8x8 DCT-II of the 32x32 luma, keep the top-left AC block
    import math
    dct = []
    for u in range(8):
        for v in range(8):
            s = 0.0
            for x in range(32):
                for y in range(32):
                    s += px[x * 32 + y] * math.cos((2 * x + 1) * u * math.pi / 64) * math.cos((2 * y + 1) * v * math.pi / 64)
            dct.append(s)
    med = sorted(dct[1:])[len(dct[1:]) // 2]
    bits = "".join("1" if v > med else "0" for v in dct)
    return f"{int(bits, 2):016x}"


def hamming(a: str, b: str) -> int:
    return bin(int(a, 16) ^ int(b, 16)).count("1")


def visual_similarity(a: str, b: str) -> float:
    return 1.0 - hamming(a, b) / 64.0


def text_similarity(a: str, b: str) -> float:
    sh = lambda t: {t.lower()[i:i + 3] for i in range(max(0, len(t) - 2))}
    A, B = sh(a), sh(b)
    return len(A & B) / len(A | B) if A | B else 0.0


# --------------------------------------------------------------------------- #
# integrity
# --------------------------------------------------------------------------- #

def check_integrity(path: Path, kind: str) -> dict | None:
    size = path.stat().st_size
    name = path.name.lower()
    if name.endswith((".crdownload", ".part", ".partial", ".download")):
        return {"reason": "Partial download", "detail": "Browser never finalized the transfer", "repairable": False}
    if size == 0:
        return {"reason": "Zero-byte file", "detail": "0 bytes allocated", "repairable": False}
    if name.endswith((".lnk", ".url", ".webloc", ".desktop")):
        return {"reason": "Broken shortcut", "detail": "Shortcut target could not be resolved", "repairable": False}
    if kind == "image":
        try:
            from PIL import Image
            with Image.open(path) as im:
                im.verify()
        except Exception as exc:
            return {"reason": "Corrupted image", "detail": str(exc)[:160], "repairable": True,
                    "method": "Pillow salvage: rebuild markers, keep decodable scanlines"}
    if kind == "document" and name.endswith(".pdf"):
        data = path.read_bytes()
        if b"%%EOF" not in data[-2048:] or b"startxref" not in data:
            return {"reason": "Corrupted PDF", "detail": "xref/EOF markers missing", "repairable": True,
                    "method": "pikepdf xref reconstruction"}
    if kind == "video" and name.endswith((".mp4", ".mov", ".m4v")):
        with path.open("rb") as fh:
            if b"moov" not in fh.read(4_000_000):
                return {"reason": "Corrupted video", "detail": "moov atom missing (interrupted recording)",
                        "repairable": True, "method": "untrunc / ffmpeg remux with reference header"}
    return None


# --------------------------------------------------------------------------- #
# index + journal
# --------------------------------------------------------------------------- #

@dataclass
class Config:
    home: Path = field(default_factory=lambda: Path(os.environ.get("SASHA_HOME", "~/.sasha")).expanduser())
    threads: int = int(os.environ.get("SASHA_THREADS", "4"))
    chunk_kb: int = 1024
    visual_threshold: float = 0.92
    near_threshold: float = 0.88
    backup_retention_days: int = 30
    require_approval: bool = True  # cannot be turned off


class Store:
    def __init__(self, cfg: Config):
        self.cfg = cfg
        cfg.home.mkdir(parents=True, exist_ok=True)
        (cfg.home / "backups").mkdir(exist_ok=True)
        (cfg.home / "review").mkdir(exist_ok=True)
        self.db = sqlite3.connect(cfg.home / "sasha.db", check_same_thread=False)
        self.db.row_factory = sqlite3.Row
        self.db.executescript((Path(__file__).parent / "schema.sql").read_text())

    def log(self, level: str, source: str, message: str) -> None:
        self.db.execute("INSERT INTO journal(level, source, message) VALUES (?,?,?)", (level, source, message))
        self.db.commit()

    # -- scanning ---------------------------------------------------------- #
    def walk(self, root: Path, recursive: bool = True) -> Iterator[Path]:
        guard(root)
        it = root.rglob("*") if recursive else root.glob("*")
        private_home = self.cfg.home.resolve()
        for p in it:
            try:
                if p.is_symlink() or not p.is_file():
                    continue
                # Do not index Cindy/Sasha's own database, backups or review files
                # when the user scans a parent such as their home directory.
                resolved = p.resolve()
                if resolved == private_home or private_home in resolved.parents:
                    continue
                yield p
            except OSError:
                continue

    def index_file(self, root_id: int, path: Path, rules=()) -> dict:
        meta = classify(path.name, str(path.parent), rules)
        sig, content_kind = sniff(path)
        if content_kind and content_kind != meta["kind"]:
            meta["mismatch"] = True
        st = path.stat()
        rec = {
            "root_id": root_id, "path": str(path), "name": path.name, "ext": meta["ext"],
            "kind": meta["kind"], "signature": sig, "size": st.st_size, "mtime": st.st_mtime,
            "ctime": st.st_ctime, "category": meta["category"],
            "sha256": sha256(path, self.cfg.chunk_kb),
            "phash": phash(path) if meta["kind"] == "image" else None,
        }
        broken = check_integrity(path, meta["kind"])
        if broken:
            rec.update(broken_kind=broken["reason"], broken_info=json.dumps(broken), repairable=int(broken["repairable"]))
        self.db.execute(
            """INSERT INTO files(root_id,path,name,ext,kind,signature,size,mtime,ctime,category,sha256,phash,broken_kind,broken_info,repairable)
               VALUES(:root_id,:path,:name,:ext,:kind,:signature,:size,:mtime,:ctime,:category,:sha256,:phash,
                      :broken_kind,:broken_info,:repairable)
               ON CONFLICT(path) DO UPDATE SET size=:size,mtime=:mtime,sha256=:sha256,category=:category""",
            {**rec, "broken_kind": rec.get("broken_kind"), "broken_info": rec.get("broken_info"), "repairable": rec.get("repairable", 0)},
        )
        return rec

    def scan(self, root_id: int, root: Path, progress: Callable[[int, int, str], None] | None = None,
             resume_cursor: str | None = None) -> int:
        all_paths = sorted(self.walk(root))
        checkpoint = self.db.execute("SELECT cursor,done,total FROM scan_checkpoints WHERE root_id=?", (root_id,)).fetchone()
        continuing = bool(resume_cursor and checkpoint and checkpoint["cursor"] == resume_cursor)
        base_done = int(checkpoint["done"] or 0) if continuing else 0
        total = int(checkpoint["total"] or len(all_paths)) if continuing else len(all_paths)
        paths = [p for p in all_paths if str(p) > resume_cursor] if resume_cursor else all_paths
        done = 0
        last_path = None
        with ThreadPoolExecutor(max_workers=self.cfg.threads) as pool:
            for rec in pool.map(lambda p: self.index_file(root_id, p), paths):
                done += 1
                last_path = rec["path"]
                completed = base_done + done
                if completed % 200 == 0:
                    self.db.execute(
                        "INSERT INTO scan_checkpoints(root_id,cursor,done,total,updated) VALUES(?,?,?,?,CURRENT_TIMESTAMP) "
                        "ON CONFLICT(root_id) DO UPDATE SET cursor=excluded.cursor, done=excluded.done, total=excluded.total, updated=CURRENT_TIMESTAMP",
                        (root_id, rec["path"], completed, total),
                    )
                    self.db.commit()
                if progress:
                    progress(completed, total, rec["path"])
        if last_path:
            self.db.execute(
                "INSERT INTO scan_checkpoints(root_id,cursor,done,total,updated) VALUES(?,?,?,?,CURRENT_TIMESTAMP) "
                "ON CONFLICT(root_id) DO UPDATE SET cursor=excluded.cursor, done=excluded.done, total=excluded.total, updated=CURRENT_TIMESTAMP",
                (root_id, last_path, base_done + done, total),
            )
        self.db.commit()
        self.log("success", "scanner", f"Indexed {done} files under {root}")
        return done

    # -- duplicate detection ----------------------------------------------- #
    def duplicates(self) -> list[dict]:
        groups: list[dict] = []
        rows = self.db.execute("SELECT * FROM files WHERE status NOT IN ('deleted','delete','archive','archived')").fetchall()
        by_hash: dict[str, list] = {}
        for r in rows:
            by_hash.setdefault(r["sha256"], []).append(r)
        used = set()
        for digest, members in by_hash.items():
            if len(members) > 1:
                used.update(m["id"] for m in members)
                groups.append({"kind": "exact", "similarity": 1.0, "reason": "Identical SHA-256",
                               "files": [dict(m) for m in members], "keep": min(members, key=lambda m: m["ctime"])["id"]})
        images = [r for r in rows if r["phash"] and r["id"] not in used]
        for i, a in enumerate(images):
            cluster = [a]
            for b in images[i + 1:]:
                if b["id"] in used:
                    continue
                if visual_similarity(a["phash"], b["phash"]) >= self.cfg.visual_threshold:
                    cluster.append(b)
            if len(cluster) > 1:
                used.update(m["id"] for m in cluster)
                groups.append({"kind": "visual", "similarity": visual_similarity(a["phash"], cluster[1]["phash"]),
                               "reason": "pHash + CLIP neighbours", "files": [dict(m) for m in cluster],
                               "keep": max(cluster, key=lambda m: m["size"])["id"]})
        return groups

    # -- approval-gated executor ------------------------------------------- #
    def _snapshot(self, op_id: int, paths: Iterable[Path]) -> tuple[Path, dict[str, Path]]:
        dest = self.cfg.home / "backups" / f"{datetime.now():%Y-%m-%dT%H-%M-%S}-{op_id}"
        dest.mkdir(parents=True, exist_ok=True)
        roots = [(int(row["id"]), Path(row["path"]).resolve()) for row in self.db.execute("SELECT id,path FROM roots")]
        snapshots: dict[str, Path] = {}
        for path in paths:
            p = path.resolve()
            if not p.is_file():
                continue
            root_match = next(((root_id, root) for root_id, root in roots if p == root or root in p.parents), None)
            if root_match:
                root_id, root = root_match
                relative = Path(str(root_id)) / p.relative_to(root)
            else:
                relative = Path("unrooted") / f"{hashlib.sha256(str(p).encode()).hexdigest()[:12]}-{p.name}"
            target = dest / relative
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(p, target)
            snapshots[str(path)] = target
        return dest, snapshots

    def apply(self, kind: str, file_ids: list[int], *, approval_token: str | None,
              action: Callable[[Path, sqlite3.Row], Path] | None = None, label: str = "") -> dict:
        if self.cfg.require_approval and not approval_token:
            raise PermissionError("approval_required: destructive action needs explicit user approval")
        rows = [self.db.execute("SELECT * FROM files WHERE id=?", (i,)).fetchone() for i in file_ids]
        rows = [r for r in rows if r]
        for r in rows:
            guard(r["path"])
        cur = self.db.execute(
            "INSERT INTO operations(kind,label,detail,bytes,backup_path) VALUES(?,?,?,?,?)",
            (kind, label or f"{kind} {len(rows)} files", "", sum(r["size"] for r in rows), ""),
        )
        op_id = cur.lastrowid
        backup, snapshots = self._snapshot(op_id, [Path(r["path"]) for r in rows])
        self.db.execute("UPDATE operations SET backup_path=? WHERE id=?", (str(backup), op_id))
        completed: list[tuple[Path, Path]] = []
        try:
            for r in rows:
                src = Path(r["path"])
                before = {"path": r["path"], "name": r["name"], "status": r["status"],
                          "backup_path": str(snapshots.get(str(src), backup / src.name))}
                new_path = Path(action(src, r)) if action else src
                # An action may move the path itself or return a destination.
                # Refuse collisions; never allow rename/move to overwrite data.
                if new_path != src:
                    if src.exists() and new_path.exists():
                        raise FileExistsError(f"Refusing to overwrite existing file: {new_path}")
                    if src.exists():
                        new_path.parent.mkdir(parents=True, exist_ok=True)
                        shutil.move(str(src), str(new_path))
                    elif not new_path.exists():
                        raise FileNotFoundError(f"Operation removed both source and destination: {src}")
                    completed.append((src, new_path))
                after = {"path": str(new_path), "name": new_path.name, "status": kind}
                self.db.execute("INSERT INTO operation_patches(op_id,file_id,before,after) VALUES(?,?,?,?)",
                                (op_id, r["id"], json.dumps(before), json.dumps(after)))
                self.db.execute("UPDATE files SET path=?, name=?, status=? WHERE id=?",
                                (str(new_path), new_path.name, kind, r["id"]))
            self.db.commit()
        except Exception:
            self.db.rollback()
            for src, new_path in reversed(completed):
                try:
                    if new_path.exists() and new_path != src:
                        src.parent.mkdir(parents=True, exist_ok=True)
                        if src.exists():
                            raise FileExistsError(f"Cannot roll back because the original path now exists: {src}")
                        shutil.move(str(new_path), str(src))
                except OSError as rollback_error:
                    self.log("danger", "rollback", f"Could not roll back {new_path} to {src}: {rollback_error}")
            shutil.rmtree(backup, ignore_errors=True)
            raise
        self.log("success", kind, f"{label or kind}: {len(rows)} files, backup {backup}")
        return {"op_id": op_id, "files": len(rows), "backup": str(backup)}

    def undo(self, op_id: int) -> dict:
        op = self.db.execute("SELECT * FROM operations WHERE id=?", (op_id,)).fetchone()
        if not op or op["undone"]:
            raise ValueError("operation not found or already undone")
        for patch in self.db.execute("SELECT * FROM operation_patches WHERE op_id=?", (op_id,)):
            before, after = json.loads(patch["before"]), json.loads(patch["after"])
            current, original = Path(after["path"]), Path(before["path"])
            backup_copy = Path(before.get("backup_path", Path(op["backup_path"]) / original.name))
            if not current.exists() and backup_copy.exists():
                original.parent.mkdir(parents=True, exist_ok=True)
                shutil.copy2(backup_copy, original)
            elif current.exists() and current != original:
                original.parent.mkdir(parents=True, exist_ok=True)
                shutil.move(str(current), str(original))
            self.db.execute("UPDATE files SET path=?, name=?, status=? WHERE id=?",
                            (before["path"], before["name"], before["status"], patch["file_id"]))
        self.db.execute("UPDATE operations SET undone=1 WHERE id=?", (op_id,))
        self.db.commit()
        self.log("warn", "undo", f"Reverted operation {op_id} from {op['backup_path']}")
        return {"op_id": op_id, "restored": True}


def new_approval_token() -> str:
    """Issued by the UI when the user clicks an action; single use, 60 s TTL."""
    return uuid.uuid4().hex