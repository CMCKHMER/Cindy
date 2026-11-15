"""Sasha Maid — native desktop shell (Windows / Linux / macOS).

A Qt window hosts the same UI used by the web and Docker targets, and owns a
localhost FastAPI process. Every file write still goes through the server's
approval gate, so the desktop build cannot bypass the safety policy.

    python desktop/app.py            # after scripts/desktop_setup.py
    python desktop/app.py --browser  # open in the default browser instead
"""
from __future__ import annotations

import argparse
import os
import socket
import subprocess
import sys
import time
import urllib.error
import urllib.request
import webbrowser
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
HOME = Path(os.environ.get("SASHA_HOME", str(Path.home() / ".sasha"))).expanduser()
ICON = Path(__file__).with_name("icon.png")

PAGE = """<!doctype html><meta charset="utf-8"><title>Sasha Maid</title>
<style>
  html,body{{height:100%;margin:0}}
  body{{display:grid;place-items:center;background:#080c15;color:#e9eeff;
       font:14px/1.6 Inter,system-ui,sans-serif;text-align:center}}
  .ring{{width:54px;height:54px;margin:0 auto 22px;border-radius:50%;
        border:3px solid rgba(126,163,255,.18);border-top-color:#17d4b4;
        animation:spin 1s linear infinite}}
  @keyframes spin{{to{{transform:rotate(360deg)}}}}
  h1{{font:600 20px/1.2 "Space Grotesk",Inter,sans-serif;letter-spacing:.12em;margin:0 0 6px}}
  h1 span{{color:#17d4b4}}
  p{{color:#96a5c8;margin:4px 0;max-width:520px}}
  pre{{text-align:left;background:#0e1524;border:1px solid rgba(126,163,255,.16);
       border-radius:12px;padding:14px;max-width:640px;max-height:240px;overflow:auto;
       color:#ff8a9c;font:11.5px/1.6 "JetBrains Mono",monospace;white-space:pre-wrap}}
</style>
<div>
  {ring}
  <h1>SASHA<span> MAID</span></h1>
  <p>{message}</p>
  {detail}
</div>"""


def free_port(preferred: int) -> int:
    for port in range(preferred, preferred + 8):
        with socket.socket() as s:
            try:
                s.bind(("127.0.0.1", port))
                return port
            except OSError:
                continue
    return preferred


def start_server(port: int) -> tuple[subprocess.Popen, Path]:
    HOME.mkdir(parents=True, exist_ok=True)
    log_path = HOME / "desktop.log"
    log = log_path.open("a", encoding="utf-8")
    log.write(f"\n--- Sasha Maid {time.strftime('%Y-%m-%d %H:%M:%S')} ---\n")
    log.flush()
    env = {**os.environ, "SASHA_HOME": str(HOME), "PYTHONUNBUFFERED": "1"}
    flags = subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0  # type: ignore[attr-defined]
    proc = subprocess.Popen(
        [sys.executable, "-m", "uvicorn", "backend.main:app", "--host", "127.0.0.1", "--port", str(port)],
        cwd=ROOT, env=env, stdout=log, stderr=subprocess.STDOUT, creationflags=flags,
    )
    return proc, log_path


def wait_ready(proc: subprocess.Popen, port: int, timeout: float = 60.0) -> bool:
    deadline = time.time() + timeout
    url = f"http://127.0.0.1:{port}/api/health"
    while time.time() < deadline:
        if proc.poll() is not None:
            return False
        try:
            with urllib.request.urlopen(url, timeout=1.5) as res:
                if res.status == 200:
                    return True
        except (urllib.error.URLError, OSError, TimeoutError):
            time.sleep(0.25)
    return False


def tail(log_path: Path, lines: int = 24) -> str:
    try:
        return "\n".join(log_path.read_text(encoding="utf-8", errors="replace").splitlines()[-lines:])
    except OSError:
        return "No log available."


def stop(proc: subprocess.Popen) -> None:
    if proc.poll() is None:
        proc.terminate()
        try:
            proc.wait(timeout=6)
        except subprocess.TimeoutExpired:
            proc.kill()


def run_browser(port: int) -> int:
    proc, log_path = start_server(port)
    try:
        if not wait_ready(proc, port):
            print("Sasha Maid could not start. Log:\n" + tail(log_path), file=sys.stderr)
            return 1
        url = f"http://127.0.0.1:{port}"
        print(f"Sasha Maid is running at {url}  (Ctrl+C to stop)")
        webbrowser.open(url)
        while proc.poll() is None:
            time.sleep(0.5)
        return 0
    except KeyboardInterrupt:
        return 0
    finally:
        stop(proc)


def run_desktop(port: int) -> int:
    from PySide6.QtCore import Qt, QThread, QTimer, QUrl, Signal
    from PySide6.QtGui import QAction, QIcon
    from PySide6.QtWidgets import (QApplication, QMainWindow, QMenu, QSystemTrayIcon)
    from PySide6.QtWebEngineWidgets import QWebEngineView

    class Boot(QThread):
        ready = Signal(str)
        failed = Signal(str)

        def __init__(self, proc, log_path, port):
            super().__init__()
            self.proc, self.log_path, self.port = proc, log_path, port

        def run(self):
            if wait_ready(self.proc, self.port):
                self.ready.emit(f"http://127.0.0.1:{self.port}")
            else:
                self.failed.emit(tail(self.log_path))

    app = QApplication(sys.argv)
    app.setApplicationName("Sasha Maid")
    app.setOrganizationName("Sasha Maid")
    app.setQuitOnLastWindowClosed(False)
    icon = QIcon(str(ICON)) if ICON.exists() else QIcon()
    app.setWindowIcon(icon)

    win = QMainWindow()
    win.setWindowTitle("Sasha Maid · AI File Organizer Agent")
    win.setWindowIcon(icon)
    win.resize(1480, 980)
    view = QWebEngineView()
    view.setHtml(PAGE.format(ring='<div class="ring"></div>',
                             message="Waking the librarian — starting the local index and AI models…",
                             detail=""))
    win.setCentralWidget(view)
    win.show()

    proc, log_path = start_server(port)
    boot = Boot(proc, log_path, port)

    def on_ready(url: str):
        view.load(QUrl(url))
        if tray is not None:
            tray.showMessage("Sasha Maid", "Ready. Nothing is changed without your approval.",
                             QSystemTrayIcon.MessageIcon.Information, 4000)

    def on_failed(detail: str):
        escaped = detail.replace("&", "&amp;").replace("<", "&lt;")
        view.setHtml(PAGE.format(
            ring="", message="Sasha could not start the local service. The log below says why.",
            detail=f"<pre>{escaped}</pre>"))

    boot.ready.connect(on_ready)
    boot.failed.connect(on_failed)
    boot.start()

    tray = None
    if QSystemTrayIcon.isSystemTrayAvailable():
        tray = QSystemTrayIcon(icon, app)
        tray.setToolTip("Sasha Maid — tidying your desktop, with approval")
        menu = QMenu()
        show_action = QAction("Open Sasha Maid", menu)
        show_action.triggered.connect(lambda: (win.show(), win.raise_(), win.activateWindow()))
        quit_action = QAction("Quit", menu)
        quit_action.triggered.connect(app.quit)
        menu.addAction(show_action)
        menu.addSeparator()
        menu.addAction(quit_action)
        tray.setContextMenu(menu)
        tray.activated.connect(lambda reason: show_action.trigger()
                               if reason == QSystemTrayIcon.ActivationReason.Trigger else None)
        tray.show()

    def close_event(event):
        # keep the agent alive in the tray, like a real desktop utility
        if tray is not None and tray.isVisible():
            event.ignore()
            win.hide()
            tray.showMessage("Sasha Maid", "Still watching in the tray. Right-click to quit.",
                             QSystemTrayIcon.MessageIcon.Information, 3000)
        else:
            event.accept()
            app.quit()

    win.closeEvent = close_event  # type: ignore[method-assign]
    QTimer.singleShot(0, lambda: view.setFocus(Qt.FocusReason.OtherFocusReason))
    try:
        return app.exec()
    finally:
        boot.wait(2000)
        stop(proc)


def main() -> int:
    parser = argparse.ArgumentParser(description="Sasha Maid desktop")
    parser.add_argument("--browser", action="store_true", help="serve locally and open the default browser")
    parser.add_argument("--port", type=int, default=int(os.environ.get("SASHA_PORT", "8765")))
    args = parser.parse_args()
    port = free_port(args.port)
    if args.browser:
        return run_browser(port)
    try:
        return run_desktop(port)
    except ImportError as exc:
        print(f"Qt web engine unavailable ({exc}); falling back to the browser.", file=sys.stderr)
        return run_browser(port)


if __name__ == "__main__":
    raise SystemExit(main())