"""Sasha Maid — one-command desktop setup and launch.

    python scripts/desktop_setup.py              # set up, then open the desktop app
    python scripts/desktop_setup.py --browser    # set up, then open in your browser
    python scripts/desktop_setup.py --launch     # skip setup, just launch
    python scripts/desktop_setup.py --package    # build a native installer/bundle

Works on Windows, macOS and Linux. Creates an isolated .venv, installs the
Python runtime, makes sure the UI bundle exists, then starts Sasha Maid.
"""
from __future__ import annotations

import argparse
import os
import platform
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
VENV = ROOT / ".venv"
IS_WIN = os.name == "nt"
PY = VENV / ("Scripts/python.exe" if IS_WIN else "bin/python")
STAMP = VENV / ".sasha-installed"


def say(step: str, text: str) -> None:
    print(f"\n\033[36m[{step}]\033[0m {text}", flush=True)


def run(cmd: list[str], **kw) -> None:
    printable = " ".join(str(c) for c in cmd)
    print(f"  $ {printable}", flush=True)
    subprocess.run([str(c) for c in cmd], cwd=ROOT, check=True, **kw)


def ensure_python() -> None:
    if sys.version_info < (3, 10):
        raise SystemExit("Sasha Maid needs Python 3.10 or newer (3.12 recommended).")
    if not PY.exists():
        say("1/4", f"Creating a private Python environment ({platform.system()})")
        run([sys.executable, "-m", "venv", VENV])
    else:
        say("1/4", "Reusing the existing .venv")


def ensure_packages() -> None:
    req = ROOT / "backend" / "requirements.txt"
    marker = f"{req.stat().st_mtime_ns}"
    if STAMP.exists() and STAMP.read_text().strip() == marker:
        say("2/4", "Python packages already installed")
        return
    say("2/4", "Installing FastAPI, Pillow, ONNX Runtime, faiss and the Qt desktop shell")
    run([PY, "-m", "pip", "install", "--upgrade", "pip"])
    try:
        run([PY, "-m", "pip", "install", "-r", req])
    except subprocess.CalledProcessError:
        say("2/4", "Full install failed — retrying with the lightweight core (no faiss/Qt extras)")
        core = ["fastapi", "uvicorn[standard]", "pydantic", "watchdog", "Pillow", "send2trash", "python-multipart"]
        run([PY, "-m", "pip", "install", *core])
    STAMP.write_text(marker)


def ensure_ui() -> None:
    static = ROOT / "backend" / "static"
    dist = ROOT / "dist"
    built = dist / "index.html"
    npm = shutil.which("npm")
    if npm and (ROOT / "package.json").exists():
        say("3/4", "Building the interface with Vite")
        if not (ROOT / "node_modules").exists():
            run([npm, "install"])
        run([npm, "run", "build"])
    elif built.exists():
        say("3/4", "Node.js not found — using the interface bundle already in dist/")
    else:
        raise SystemExit("No UI bundle found. Install Node.js 20+ and re-run, or run 'npm run build' first.")

    static.mkdir(parents=True, exist_ok=True)
    for item in dist.iterdir():
        target = static / item.name
        if item.is_dir():
            shutil.copytree(item, target, dirs_exist_ok=True)
        else:
            shutil.copy2(item, target)
    print(f"  UI ready at {static}")


def main() -> int:
    parser = argparse.ArgumentParser(description="Set up and run Sasha Maid on this computer")
    parser.add_argument("--browser", action="store_true", help="open in the default browser instead of the desktop window")
    parser.add_argument("--launch", action="store_true", help="skip setup and just launch")
    parser.add_argument("--package", action="store_true", help="build a native desktop bundle with PyInstaller")
    args = parser.parse_args()

    print("\n  SASHA MAID — your desktop, tidied. Nothing changes without your approval.\n")

    if args.package:
        ensure_python()
        ensure_packages()
        ensure_ui()
        run([PY, "-m", "pip", "install", "pyinstaller"])
        target = {"Windows": "windows", "Darwin": "macos"}.get(platform.system(), "linux")
        run([PY, ROOT / "scripts" / "build_desktop.py", "--platform", target])
        return 0

    if not args.launch:
        ensure_python()
        ensure_packages()
        ensure_ui()

    if not PY.exists():
        raise SystemExit("Environment missing — run without --launch first.")

    say("4/4", "Starting Sasha Maid" + (" in your browser" if args.browser else " on your desktop"))
    cmd = [PY, ROOT / "desktop" / "app.py"] + (["--browser"] if args.browser else [])
    try:
        return subprocess.call([str(c) for c in cmd], cwd=ROOT)
    except KeyboardInterrupt:
        return 0


if __name__ == "__main__":
    raise SystemExit(main())