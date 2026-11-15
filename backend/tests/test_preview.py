from __future__ import annotations

from pathlib import Path

from fastapi.testclient import TestClient

from backend import main
from backend.organizer import Config, Store


def client_with_file(tmp_path: Path, monkeypatch, *, name: str, body: bytes, relative: str | None = None):
    root = tmp_path / "media"
    root.mkdir(exist_ok=True)
    home = tmp_path / ".sasha-preview-test"
    store = Store(Config(home=home))
    store.db.execute("INSERT INTO roots(path) VALUES(?)", (str(root),))
    file_path = Path(relative) if relative else root / name
    file_path.parent.mkdir(parents=True, exist_ok=True)
    file_path.write_bytes(body)
    store.db.execute(
        """INSERT INTO files(root_id,path,name,ext,kind,signature,size,mtime,ctime,category,sha256,status)
           VALUES(1,?,?,?,?,?,?,?,?,?,?, 'indexed')""",
        (str(file_path), name, Path(name).suffix.lstrip("."), "document", "test", len(body), 1, 1, "test", "hash"),
    )
    store.db.commit()
    monkeypatch.setattr(main, "store", store)
    return TestClient(main.app), file_path


def test_audio_preview_supports_byte_ranges(tmp_path, monkeypatch):
    client, _ = client_with_file(tmp_path, monkeypatch, name="song.mp3", body=b"0123456789")
    with client:
        response = client.get("/api/files/1/preview", headers={"Range": "bytes=2-5"})
    assert response.status_code == 206
    assert response.content == b"2345"
    assert response.headers["content-range"] == "bytes 2-5/10"
    assert response.headers["accept-ranges"] == "bytes"
    assert response.headers["content-disposition"].startswith("inline;")


def test_preview_rejects_paths_outside_the_registered_root(tmp_path, monkeypatch):
    outside = tmp_path / "outside.txt"
    client, _ = client_with_file(tmp_path, monkeypatch, name="outside.txt", body=b"secret", relative=str(outside))
    with client:
        response = client.get("/api/files/1/preview")
    assert response.status_code == 404


def test_unknown_type_is_download_only(tmp_path, monkeypatch):
    client, _ = client_with_file(tmp_path, monkeypatch, name="archive.zip", body=b"PK\x03\x04data")
    with client:
        inline = client.get("/api/files/1/preview")
        download = client.get("/api/files/1/preview?download=true")
    assert inline.status_code == 415
    assert download.status_code == 200
    assert download.content == b"PK\x03\x04data"
    assert download.headers["content-disposition"].startswith("attachment;")
