"""Desktop-path verification without third-party packages.

Exercises the pieces the launchers depend on: the filesystem engine's safety
gate, scan/duplicate/undo behaviour, and the desktop shell's port + readiness
helpers. Run: python3 scripts/verify_desktop.py
"""
from __future__ import annotations

import importlib.util
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from backend.organizer import Config, ProtectedPathError, Store, classify, guard, normalize_name, unique_name  # noqa: E402

checks: list[tuple[str, bool, str]] = []


def check(name: str, ok: bool, detail: str = "") -> None:
    checks.append((name, bool(ok), detail))


def load_shell():
    spec = importlib.util.spec_from_file_location("sasha_desktop", ROOT / "desktop" / "app.py")
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)  # PySide6 is imported lazily, so this is safe headless
    return mod


def main() -> int:
    shell = load_shell()
    port = shell.free_port(8765)
    check("free_port picks a bindable port", isinstance(port, int) and 8765 <= port <= 8772, str(port))
    check("loading page is branded", "SASHA" in shell.PAGE and "MAID" in shell.PAGE)
    check("icon shipped for the desktop bundle", (ROOT / "desktop" / "icon.png").exists(),
          f"{(ROOT / 'desktop' / 'icon.png').stat().st_size} bytes")

    for name in ("Start Sasha Maid.bat", "Start Sasha Maid.command", "start-sasha-maid.sh"):
        p = ROOT / name
        check(f"launcher present: {name}", p.exists() and "desktop_setup.py" in p.read_text())

    check("naming contract", normalize_name("Golden Retriever.jpg", "jpg") == "golden-retriever.jpg")

    with tempfile.TemporaryDirectory() as tmp:
        tmp = Path(tmp)
        home = tmp / ".sasha"
        store = Store(Config(home=home, threads=2))
        check("index created at .sasha/sasha.db", (home / "sasha.db").exists())

        inbox = tmp / "Downloads"
        inbox.mkdir()
        (inbox / "invoice-2026-014.pdf").write_bytes(b"%PDF-1.7\nstartxref\n%%EOF\n")
        (inbox / "invoice-2026-014 (1).pdf").write_bytes(b"%PDF-1.7\nstartxref\n%%EOF\n")
        (inbox / "Screenshot 2026-03-12.png").write_bytes(b"\x89PNG\r\n\x1a\nrest")
        (inbox / "empty.txt").touch()
        (inbox / "ubuntu.iso.crdownload").write_bytes(b"\x00" * 2048)

        store.db.execute("INSERT INTO roots(path) VALUES(?)", (str(inbox),))
        n = store.scan(1, inbox)
        check("recursive scan indexes files", n == 5, f"{n} files")

        groups = store.duplicates()
        check("exact duplicates grouped", len(groups) == 1 and len(groups[0]["files"]) == 2)

        broken = store.db.execute("SELECT name, broken_kind FROM files WHERE broken_kind IS NOT NULL").fetchall()
        kinds = {r["broken_kind"] for r in broken}
        check("integrity findings", {"Zero-byte file", "Partial download"} <= kinds, ", ".join(sorted(kinds)))

        check("classification routes screenshots",
              classify("Screenshot 2026-03-12.png")["category"] == "Media/Images/Screenshots")

        target = store.db.execute("SELECT id, name FROM files WHERE name LIKE 'invoice%' ORDER BY id LIMIT 1").fetchone()
        fid, fname = target["id"], target["name"]

        refused = False
        try:
            store.apply("delete", [fid], approval_token=None)
        except PermissionError:
            refused = True
        check("destructive action refused without approval", refused)

        review = home / "review" / "today"
        review.mkdir(parents=True)
        op = store.apply("archive", [fid], approval_token="user-clicked",
                         action=lambda p, r: review / unique_name(review, p.name))
        moved = (review / fname).exists() and not (inbox / fname).exists()
        backup_copies = list((home / "backups").rglob(fname))
        check("approved move applies + backup written", moved and len(backup_copies) == 1,
              f"{fname} → review, {len(backup_copies)} snapshot")

        store.undo(op["op_id"])
        check("undo restores the original path", (inbox / fname).exists())

        try:
            guard("/etc")
            check("system path refused", False)
        except ProtectedPathError:
            check("system path refused", True, "/etc")

    print()
    for name, ok, detail in checks:
        print(f"{'PASS' if ok else 'FAIL'}  {name}{('  [' + detail + ']') if detail else ''}")
    passed = sum(1 for _, ok, _ in checks if ok)
    print(f"\n{passed}/{len(checks)} desktop checks passed")
    return 0 if passed == len(checks) else 1


if __name__ == "__main__":
    raise SystemExit(main())