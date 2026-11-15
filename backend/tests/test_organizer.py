"""Sasha Maid test suite — run with `pytest backend/tests -q`."""
from __future__ import annotations

import json
from pathlib import Path

import pytest

from backend.organizer import (Config, ProtectedPathError, Rule, Store, classify,
                               guard, hamming, normalize_name, text_similarity,
                               unique_name, visual_similarity)


# ---------------------------------------------------------------- classification
@pytest.mark.parametrize("name,expected", [
    ("report.pdf", "Documents/PDF"),
    ("budget.xlsx", "Documents/Excel"),
    ("notes.md", "Documents/Text"),
    ("Screenshot 2026-03-01.png", "Media/Images/Screenshots"),
    ("DALL-E-Image-42.png", "Media/Images/AI_Art"),
    ("brand_logo_v3.svg", "Media/Images/Logos"),
    ("holiday.mp4", "Media/Videos"),
    ("track.flac", "Media/Music"),
    ("bundle.rar", "Archives/RAR"),
    ("installer.msi", "Downloads/Installers"),
    ("main.py", "Projects/Coding"),
])
def test_classification(name, expected):
    assert classify(name)["category"] == expected


def test_rule_precedence():
    rules = [Rule("*.mp3", "Media/Music/Sorted"), Rule("track", "Ignored")]
    assert classify("track01.mp3", rules=rules)["category"] == "Media/Music/Sorted"


def test_disabled_rule_is_skipped():
    rules = [Rule("*.mp3", "Media/Music/Sorted", enabled=False)]
    assert classify("track01.mp3", rules=rules)["category"] == "Media/Music"


# ---------------------------------------------------------------- naming
def test_normalize_name():
    assert normalize_name("Golden Retriever Running In Park!!", "JPG") == "golden-retriever-running-in-park.jpg"
    assert normalize_name("Café Phnom Penh Néon", "png") == "cafe-phnom-penh-neon.png"
    assert normalize_name("   ", "txt") == "untitled.txt"


def test_normalize_name_does_not_duplicate_extension():
    assert normalize_name("Golden Retriever.jpg", "jpg") == "golden-retriever.jpg"
    assert normalize_name("screenshot.PNG", "png") == "screenshot.png"


def test_collision_suffix(tmp_path: Path):
    (tmp_path / "dog.jpg").touch()
    (tmp_path / "dog-2.jpg").touch()
    assert unique_name(tmp_path, "dog.jpg") == "dog-3.jpg"


# ---------------------------------------------------------------- safety
@pytest.mark.parametrize("path", ["/etc", "/usr/bin", "/System/Library", "/boot/efi"])
def test_protected_paths(path):
    with pytest.raises(ProtectedPathError):
        guard(path)


def test_user_paths_allowed(tmp_path: Path):
    assert guard(tmp_path) == tmp_path.resolve()


def test_approval_required(tmp_path: Path):
    store = Store(Config(home=tmp_path / ".sasha"))
    f = tmp_path / "a.txt"
    f.write_text("hello")
    store.db.execute("INSERT INTO roots(path) VALUES(?)", (str(tmp_path),))
    store.index_file(1, f)
    row = store.db.execute("SELECT id FROM files").fetchone()
    with pytest.raises(PermissionError):
        store.apply("delete", [row["id"]], approval_token=None)
    assert f.exists(), "file must survive a rejected operation"


# ---------------------------------------------------------------- pipeline
def test_index_undo_roundtrip(tmp_path: Path):
    store = Store(Config(home=tmp_path / ".sasha"))
    src = tmp_path / "inbox"
    src.mkdir()
    f = src / "invoice-2026-014.pdf"
    f.write_bytes(b"%PDF-1.7\n%%EOF\nstartxref\n")
    store.db.execute("INSERT INTO roots(path) VALUES(?)", (str(src),))
    store.scan(1, src)
    row = store.db.execute("SELECT * FROM files").fetchone()
    assert row["sha256"] and row["kind"] == "document"

    review = tmp_path / "review"
    review.mkdir()
    op = store.apply("archive", [row["id"]], approval_token="test",
                     action=lambda p, r: review / p.name)
    assert not f.exists() and (review / f.name).exists()

    store.undo(op["op_id"])
    assert f.exists(), "undo must restore the original path"
    assert f.read_bytes().startswith(b"%PDF")


def test_apply_moves_when_action_returns_destination(tmp_path: Path):
    """An action may simply return the target path; the engine performs the move."""
    store = Store(Config(home=tmp_path / ".sasha"))
    store.db.execute("INSERT INTO roots(path) VALUES(?)", (str(tmp_path),))
    f = tmp_path / "note.txt"
    f.write_text("keep me")
    store.index_file(1, f)
    fid = store.db.execute("SELECT id FROM files").fetchone()["id"]
    dest = tmp_path / "sorted"
    dest.mkdir()
    store.apply("move", [fid], approval_token="t", action=lambda p, r: dest / p.name)
    assert (dest / "note.txt").read_text() == "keep me" and not f.exists()


def test_batch_failure_rolls_back_prior_moves(tmp_path: Path):
    store = Store(Config(home=tmp_path / ".sasha"))
    store.db.execute("INSERT INTO roots(path) VALUES(?)", (str(tmp_path),))
    paths = [tmp_path / "one.txt", tmp_path / "two.txt"]
    for path in paths:
        path.write_text(path.name)
        store.index_file(1, path)
    ids = [row["id"] for row in store.db.execute("SELECT id FROM files ORDER BY name")]
    target = tmp_path / "review"
    target.mkdir()

    def fail_second(path: Path, row):
        if path.name == "two.txt":
            raise OSError("simulated destination failure")
        return target / path.name

    with pytest.raises(OSError, match="simulated"):
        store.apply("move", ids, approval_token="approved", action=fail_second)
    assert all(path.exists() for path in paths)
    assert not list(target.iterdir())
    assert store.db.execute("SELECT COUNT(*) FROM operations").fetchone()[0] == 0


def test_backup_keeps_same_basename_files_separate(tmp_path: Path):
    store = Store(Config(home=tmp_path / ".sasha"))
    root = tmp_path / "root"
    a_dir, b_dir = root / "a", root / "b"
    a_dir.mkdir(parents=True); b_dir.mkdir()
    a, b = a_dir / "same.txt", b_dir / "same.txt"
    a.write_text("first"); b.write_text("second")
    store.db.execute("INSERT INTO roots(path) VALUES(?)", (str(root),))
    store.index_file(1, a); store.index_file(1, b)
    ids = [row["id"] for row in store.db.execute("SELECT id FROM files")]
    target = tmp_path / "trash"; target.mkdir()
    op = store.apply("archive", ids, approval_token="approved", action=lambda path, row: target / f"{row['id']}.txt")
    backups = list(Path(op["backup"]).rglob("same.txt"))
    assert len(backups) == 2
    assert {path.read_text() for path in backups} == {"first", "second"}
    store.undo(op["op_id"])
    assert a.read_text() == "first" and b.read_text() == "second"


def test_duplicate_grouping(tmp_path: Path):
    store = Store(Config(home=tmp_path / ".sasha"))
    store.db.execute("INSERT INTO roots(path) VALUES(?)", (str(tmp_path),))
    for name in ("a.bin", "b.bin", "c.bin"):
        p = tmp_path / name
        p.write_bytes(b"same" if name != "c.bin" else b"different")
        store.index_file(1, p)
    groups = store.duplicates()
    assert len(groups) == 1
    assert groups[0]["kind"] == "exact" and len(groups[0]["files"]) == 2


def test_integrity_zero_byte(tmp_path: Path):
    store = Store(Config(home=tmp_path / ".sasha"))
    store.db.execute("INSERT INTO roots(path) VALUES(?)", (str(tmp_path),))
    empty = tmp_path / "empty.txt"
    empty.touch()
    rec = store.index_file(1, empty)
    assert rec["broken_kind"] == "Zero-byte file"


def test_partial_download_detected(tmp_path: Path):
    store = Store(Config(home=tmp_path / ".sasha"))
    store.db.execute("INSERT INTO roots(path) VALUES(?)", (str(tmp_path),))
    part = tmp_path / "ubuntu.iso.crdownload"
    part.write_bytes(b"\x00" * 1024)
    assert store.index_file(1, part)["broken_kind"] == "Partial download"


def test_scan_checkpoint_resume(tmp_path: Path):
    store = Store(Config(home=tmp_path / ".sasha", threads=2))
    for i in range(450):
        (tmp_path / f"f{i}.txt").write_text(str(i))
    store.db.execute("INSERT INTO roots(path) VALUES(?)", (str(tmp_path),))
    assert store.scan(1, tmp_path) == 450
    cp = store.db.execute("SELECT * FROM scan_checkpoints WHERE root_id=1").fetchone()
    assert cp and cp["done"] > 0
    # resuming from the last cursor indexes nothing new
    assert store.scan(1, tmp_path, resume_cursor=cp["cursor"]) == 0


# ---------------------------------------------------------------- similarity
def test_phash_distance():
    a, b = "ffffffffffffffff", "fffffffffffffff0"
    assert hamming(a, b) == 4
    assert 0.9 < visual_similarity(a, b) < 1.0


def test_text_similarity():
    assert text_similarity("Proposal_Acme_v3", "Proposal_Acme_v4") > 0.7
    assert text_similarity("cat", "completely different") < 0.2


def test_journal_written(tmp_path: Path):
    store = Store(Config(home=tmp_path / ".sasha"))
    store.log("info", "test", "hello")
    assert store.db.execute("SELECT message FROM journal").fetchone()["message"] == "hello"


def test_patches_are_json_snapshots(tmp_path: Path):
    store = Store(Config(home=tmp_path / ".sasha"))
    store.db.execute("INSERT INTO roots(path) VALUES(?)", (str(tmp_path),))
    f = tmp_path / "x.txt"
    f.write_text("x")
    store.index_file(1, f)
    fid = store.db.execute("SELECT id FROM files").fetchone()["id"]
    op = store.apply("archive", [fid], approval_token="t", action=lambda p, r: p)
    patch = store.db.execute("SELECT * FROM operation_patches WHERE op_id=?", (op["op_id"],)).fetchone()
    assert json.loads(patch["before"])["path"] == str(f)