# Sasha Maid · AI File Organizer Agent

**Your desktop, tidied.** Sasha Maid is a local-first file librarian for
**Windows, macOS, Linux and Android**. On Android, the app uses the system folder
picker and only accesses folders you explicitly grant. She scans folders
recursively, classifies files by content and metadata, groups exact / near /
visual duplicates, catches damaged
files, writes descriptive image names and builds a cleanup plan — then waits for
your approval before touching anything.

---

## Android app (APK)

The Android app wraps the same interface in Capacitor and uses Android's Storage
Access Framework (SAF) for real file access. No Python server, broad storage
permission, or `MANAGE_EXTERNAL_STORAGE` permission is used. Android asks you to
pick each folder; only those granted locations are scanned. Exact duplicate
checks hash the selected files. Approved rename, organize, review, and trash
operations use Android document-provider actions; Trash is a recoverable folder
inside the selected root, and Undo reverses the latest recorded action.

To build and install a debug APK, install **Android Studio**, its Android SDK
(compile SDK 36), and **JDK 21**, then from this repository run:

```bash
npm ci
npm run android:apk
```

The APK is written to
`android/app/build/outputs/apk/debug/app-debug.apk`. Open the project in Android
Studio with `npm run android:open` to create a signed release build or install
to a connected device. `npm run android:sync` rebuilds the web UI and copies it
into the Android project.

Android file providers vary: cloud-backed, read-only, or third-party providers
may not support every rename/move operation. The app reports provider failures
instead of silently pretending the operation succeeded. In-app media preview is
limited to 32 MiB per file on Android; scanning large files for exact duplicates
can use significant time and battery.

---

## Get it working on your desktop

You need **Python 3.10+** (3.12 recommended). Node.js is optional: if it is
missing, Sasha uses the interface bundle already in `dist/`.

### Windows

1. Install Python once: `winget install Python.Python.3.12`
2. Double-click **`Start Sasha Maid.bat`** in this folder.

That is it. Prefer a terminal?

```powershell
py -3 scripts\desktop_setup.py
```

### macOS

```bash
brew install python@3.12                       # once
chmod +x "Start Sasha Maid.command" start-sasha-maid.sh
xattr -d com.apple.quarantine "Start Sasha Maid.command" 2>/dev/null
```

Then double-click **`Start Sasha Maid.command`**, or run:

```bash
python3 scripts/desktop_setup.py
```

### Linux

```bash
sudo apt install python3 python3-venv libgl1 libegl1 libxkbcommon-x11-0
chmod +x start-sasha-maid.sh
./start-sasha-maid.sh
```

### What the setup command does

| Step | Action |
| --- | --- |
| 1 | Creates an isolated `.venv` (nothing installed system-wide) |
| 2 | Installs FastAPI, Pillow, ONNX Runtime, faiss and the Qt desktop shell |
| 3 | Builds the UI with Vite, or reuses `dist/index.html` if Node is absent |
| 4 | Opens the native window and starts the local service on `127.0.0.1:8765` |

Later runs are fast — the environment is cached, so the launcher just opens the
app. Closing the window hides Sasha to the **system tray**; right-click the tray
icon to quit. If Qt WebEngine is unavailable, add `--browser` and the identical
interface opens in your default browser.

```bash
python3 scripts/desktop_setup.py --launch     # skip setup, just open
python3 scripts/desktop_setup.py --browser    # serve locally, open a browser
python3 scripts/desktop_setup.py --package    # build a native bundle
```

`--package` produces `dist/SashaMaid-Setup.exe`, `dist/SashaMaid-macOS.app` or
`dist/SashaMaid-x86_64` — a self-contained app you can pin to the taskbar or Dock.

### Where Sasha keeps things

| | Windows | macOS / Linux |
| --- | --- | --- |
| Index & journal | `%USERPROFILE%\.sasha\sasha.db` | `~/.sasha/sasha.db` |
| Backups | `%USERPROFILE%\.sasha\backups\` | `~/.sasha/backups/` |
| Review folder | `%USERPROFILE%\.sasha\review\` | `~/.sasha/review/` |
| Desktop log | `%USERPROFILE%\.sasha\desktop.log` | `~/.sasha/desktop.log` |

Set `SASHA_HOME` to move all of it, or `SASHA_PORT` if 8765 is taken (Sasha also
tries 8766–8772 automatically).

### Troubleshooting

- **“python is not recognised”** — reinstall Python with *Add python.exe to PATH*,
  or use the `.bat` launcher, which finds `py -3` for you.
- **Stuck on the loading ring** — the reason is in `~/.sasha/desktop.log`.
- **No Qt WebEngine** — run with `--browser`.
- **Locked-down machine** — use Docker (below) and open `http://localhost:8765`.

The same instructions are inside the app under **Run on desktop**, where you can
also download the launcher for your OS.

---

## Safety contract

- No automatic deletion, overwrite or rename — every destructive action opens an
  approval dialog and needs a single-use token.
- Batches run as `backup → apply → journal`; every operation has an undo entry
  that restores files *and* review state.
- OS-critical paths (`C:\Windows`, `/System`, `/usr`, `/etc`, `/boot`, …) are
  rejected before any worker starts.
- Inference is local (ONNX Runtime). Dropped files are hashed with WebCrypto in
  the browser and never uploaded.

## Other ways to run it

```bash
# web workspace only (interactive local index, seeded library)
npm install && npm run dev

# Native desktop app + live filesystem service
./start-sasha-maid.sh

# Build a portable Linux desktop bundle
python3 scripts/desktop_setup.py --package

# Or run the local API separately (then open the Live disk view)
pip install -r backend/requirements.txt
npm run build
uvicorn backend.main:app --host 127.0.0.1 --port 8765

# containers — only bind-mounted folders are visible
docker compose up --build
```

## Project layout

- `src/` — React + Vite + Tailwind UI: seeded demo workspace plus a separate
  **Live disk** screen connected to the local API for real scans, duplicate review,
  inline image/audio/video/PDF/text previews, approved file operations, and undo;
  also analytics, explorer, reports and settings.
- `src/lib/engine.ts` — classification, naming, SHA-256 / pHash / text similarity,
  natural-language intents, benchmark, live diagnostics.
- `src/state/store.tsx` — operation journal, reversible patches, resumable scan,
  watchdog events, imports, persistence.
- `src/lib/export.ts` — real CSV / JSON downloads and a dependency-free PDF writer.
- `backend/organizer.py` — filesystem engine, protected-path guard, chunked
  hashing, Pillow pHash, integrity checks, backups, undo.
- `backend/main.py` — FastAPI REST + WebSocket API with approval tokens.
- `backend/schema.sql` — WAL SQLite schema with FTS5 and scan checkpoints.
- `desktop/app.py` — PySide6 shell: readiness wait, tray icon, graceful shutdown.
- `scripts/desktop_setup.py` — the one-command setup and launcher.

## Tests

```bash
node scripts/smoke.cjs        # runtime checks against the production bundle (needs jsdom)
pytest backend/tests -q       # engine, safety, dedupe, integrity, resume, undo
```

Inside the app: **Developer → Tests → Run diagnostics** executes the real
classification, naming, safety, similarity and NLP functions.

Reports are available from **Undo & Reports** as PDF, CSV and JSON: files moved
and renamed, duplicate groups and members, damaged files, storage saved, the
safety policy and the full operation journal.