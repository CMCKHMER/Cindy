from __future__ import annotations

from pathlib import Path

import pytest

from backend.organizer import Config, ProtectedPathError, Store, guard


def test_sensitive_configuration_paths_are_hard_protected(tmp_path: Path):
    for path in (tmp_path / ".ssh", tmp_path / ".config", tmp_path / ".env", tmp_path / "secrets" / ".env.production"):
        with pytest.raises(ProtectedPathError):
            guard(path)


def test_scan_prunes_credentials_and_app_configuration(tmp_path: Path):
    root = tmp_path / "home"
    root.mkdir()
    (root / "photo.jpg").write_bytes(b"safe")
    (root / ".env").write_text("SECRET=value")
    (root / ".ssh").mkdir()
    (root / ".ssh" / "id_ed25519").write_text("private key")
    (root / ".config").mkdir()
    (root / ".config" / "preferences.json").write_text("{}")
    store = Store(Config(home=tmp_path / "state"))
    assert list(store.walk(root)) == [root / "photo.jpg"]


def test_permanent_delete_has_no_backup_and_cannot_be_undone(tmp_path: Path):
    root = tmp_path / "photos"
    root.mkdir()
    image = root / "duplicate.jpg"
    image.write_bytes(b"image bytes")
    store = Store(Config(home=tmp_path / "state"))
    store.db.execute("INSERT INTO roots(path) VALUES(?)", (str(root),))
    store.db.commit()
    store.index_file(1, image)
    file_id = store.db.execute("SELECT id FROM files WHERE path=?", (str(image),)).fetchone()["id"]

    result = store.permanently_delete([file_id], approval_token="approved")

    assert result["files"] == 1
    assert not image.exists()
    operation = store.db.execute("SELECT * FROM operations WHERE id=?", (result["op_id"],)).fetchone()
    assert operation["kind"] == "permanent_delete"
    assert operation["backup_path"] == ""
    assert not list((tmp_path / "state" / "backups").iterdir())
    assert store.db.execute("SELECT status FROM files WHERE id=?", (file_id,)).fetchone()["status"] == "permanently_deleted"
    with pytest.raises(ValueError, match="cannot be undone"):
        store.undo(result["op_id"])


def test_permanent_delete_refuses_secret_files_even_with_approval(tmp_path: Path):
    root = tmp_path / "downloads"
    root.mkdir()
    secret = root / ".env"
    secret.write_text("SECRET=value")
    store = Store(Config(home=tmp_path / "state"))
    store.db.execute("INSERT INTO roots(path) VALUES(?)", (str(root),))
    store.db.commit()
    store.index_file(1, secret)
    file_id = store.db.execute("SELECT id FROM files WHERE path=?", (str(secret),)).fetchone()["id"]

    result = store.permanently_delete([file_id], approval_token="approved")

    assert result["files"] == 0
    assert secret.exists()
    assert "protected" in result["failed"][0]["error"].lower()


def test_permanent_delete_requires_approval(tmp_path: Path):
    store = Store(Config(home=tmp_path / "state"))
    with pytest.raises(PermissionError, match="approval"):
        store.permanently_delete([1], approval_token=None)
