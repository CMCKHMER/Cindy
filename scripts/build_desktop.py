"""Build a native Sasha Maid desktop bundle with PyInstaller.

    python scripts/build_desktop.py --platform windows|linux|macos

The UI is built first, then copied into backend/static so the executable is
self-contained (Python, Qt, ONNX models and the front-end).
"""
from __future__ import annotations

import argparse
import platform
import shutil
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--platform", choices=["windows", "linux", "macos"], default={
        "Windows": "windows", "Linux": "linux", "Darwin": "macos",
    }.get(platform.system(), "linux"))
    args = parser.parse_args()

    subprocess.run(["npm", "ci"], cwd=ROOT, check=True)
    subprocess.run(["npm", "run", "build"], cwd=ROOT, check=True)
    static = ROOT / "backend" / "static"
    static.mkdir(exist_ok=True)
    for item in (ROOT / "dist").iterdir():
        target = static / item.name
        if item.is_dir():
            shutil.copytree(item, target, dirs_exist_ok=True)
        else:
            shutil.copy2(item, target)

    name = {"windows": "SashaMaid-Setup", "linux": "SashaMaid-x86_64", "macos": "SashaMaid-macOS"}[args.platform]
    sep = ";" if args.platform == "windows" else ":"
    icon = ROOT / "desktop" / "icon.png"
    cmd = [
        "pyinstaller", "--noconfirm", "--clean", "--windowed", "--name", name,
        "--add-data", f"{static}{sep}backend/static",
        "--add-data", f"{ROOT / 'backend' / 'schema.sql'}{sep}backend",
        "--add-data", f"{icon}{sep}desktop",
        "--hidden-import", "onnxruntime", "--hidden-import", "faiss",
    ]
    ico = icon.with_suffix(".ico")
    chosen = ico if ico.exists() else (icon if icon.exists() else None)
    if chosen is not None:
        cmd += ["--icon", str(chosen)]
    cmd.append(str(ROOT / "desktop" / "app.py"))
    subprocess.run(cmd, cwd=ROOT, check=True)
    print(f"Built {name} in {ROOT / 'dist'}")


if __name__ == "__main__":
    main()