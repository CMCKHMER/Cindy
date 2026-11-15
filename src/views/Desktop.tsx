import { useState } from "react";
import { useApp } from "../state/store";
import { Chip, Code, CopyBtn, Icon, Section, Segmented } from "../components/ui";
import { download } from "../lib/export";
import { Mark } from "../components/Shell";
import { PLATFORM_META, type Platform } from "../lib/core";

/* ------------------------------------------------------------------ launchers
   These are the exact files that ship in the repository root. Downloading them
   from here produces a working double-click launcher for the project folder. */

export const LAUNCHERS: Record<Platform, { file: string; body: string }> = {
  windows: {
    file: "Start Sasha Maid.bat",
    body: `@echo off
title Sasha Maid
cd /d "%~dp0"
echo.
echo   SASHA MAID - your desktop, tidied.
echo   First run installs everything; later runs just open the app.
echo.
where py >nul 2>nul
if %errorlevel%==0 (set "PYCMD=py -3") else (set "PYCMD=python")
%PYCMD% scripts\\desktop_setup.py %*
if errorlevel 1 (
  echo.
  echo   Setup stopped. If Python is missing, install it from python.org and tick
  echo   "Add python.exe to PATH", then double-click this file again.
  echo.
  pause
)
`,
  },
  macos: {
    file: "Start Sasha Maid.command",
    body: `#!/bin/bash
# macOS: double-click in Finder. Save next to the Sasha Maid project folder.
cd "$(dirname "$0")" || exit 1
echo
echo "  SASHA MAID — your desktop, tidied."
echo
PY=python3
command -v python3.12 >/dev/null 2>&1 && PY=python3.12
if ! command -v "$PY" >/dev/null 2>&1; then
  echo "  Python 3 is required:  brew install python@3.12"
  read -r -p "  Press Enter to close…"
  exit 1
fi
"$PY" scripts/desktop_setup.py "$@"
status=$?
[ $status -ne 0 ] && read -r -p "  Setup stopped (code $status). Press Enter to close…"
exit $status
`,
  },
  linux: {
    file: "start-sasha-maid.sh",
    body: `#!/bin/bash
# Linux: ./start-sasha-maid.sh   (chmod +x once)
cd "$(dirname "$0")" || exit 1
echo
echo "  SASHA MAID — your desktop, tidied."
echo
PY=python3
command -v python3.12 >/dev/null 2>&1 && PY=python3.12
if ! command -v "$PY" >/dev/null 2>&1; then
  echo "  Install Python 3 first:  sudo apt install python3 python3-venv"
  exit 1
fi
"$PY" scripts/desktop_setup.py "$@"
`,
  },
};

const PREREQ: Record<Platform, { label: string; cmd: string }[]> = {
  windows: [
    { label: "Python 3.12", cmd: "winget install Python.Python.3.12" },
    { label: "Node.js 22 (optional — a prebuilt UI ships in dist/)", cmd: "winget install OpenJS.NodeJS" },
  ],
  macos: [
    { label: "Python 3.12 + Node", cmd: "brew install python@3.12 node" },
    { label: "Video repair helper (optional)", cmd: "brew install ffmpeg" },
  ],
  linux: [
    { label: "Python, venv, Qt libraries", cmd: "sudo apt install python3 python3-venv python3-pip libgl1 libegl1 libxkbcommon-x11-0" },
    { label: "Video repair helper (optional)", cmd: "sudo apt install ffmpeg" },
  ],
};

const STEPS: Record<Platform, { title: string; body: string; cmd: string }[]> = {
  windows: [
    { title: "Put the folder somewhere permanent", body: "For example C:\\Users\\you\\SashaMaid. Keep the whole project together — the launcher lives beside scripts/.", cmd: 'cd C:\\Users\\%USERNAME%\\SashaMaid' },
    { title: "Double-click the launcher", body: "“Start Sasha Maid.bat” creates a private .venv, installs the runtime, builds the interface and opens the desktop window.", cmd: '".\\Start Sasha Maid.bat"' },
    { title: "Or run it from PowerShell", body: "Same result, with visible logs if anything needs attention.", cmd: "py -3 scripts\\desktop_setup.py" },
  ],
  macos: [
    { title: "Allow the launcher once", body: "macOS quarantines downloaded scripts. Clearing the flag lets Finder run it by double-click.", cmd: 'chmod +x "Start Sasha Maid.command" start-sasha-maid.sh\nxattr -d com.apple.quarantine "Start Sasha Maid.command" 2>/dev/null' },
    { title: "Double-click “Start Sasha Maid.command”", body: "Terminal opens, Sasha installs into .venv, then the native window appears with a tray icon.", cmd: './"Start Sasha Maid.command"' },
    { title: "Or run it from Terminal", body: "Useful the first time so you can watch the install.", cmd: "python3 scripts/desktop_setup.py" },
  ],
  linux: [
    { title: "Make the launcher executable", body: "One time only.", cmd: "chmod +x start-sasha-maid.sh" },
    { title: "Run it", body: "Installs into .venv, builds the UI and opens the Qt window. Falls back to your browser if Qt WebEngine is unavailable.", cmd: "./start-sasha-maid.sh" },
    { title: "Headless / server mode", body: "Serve the same interface on localhost without a desktop session.", cmd: "python3 scripts/desktop_setup.py --browser" },
  ],
};

export default function Desktop() {
  const { s, api } = useApp();
  const [os, setOs] = useState<Platform>(s.settings.platform);
  const meta = PLATFORM_META[os];
  const launcher = LAUNCHERS[os];

  const grab = () => {
    download(launcher.file, new Blob([launcher.body], { type: "text/plain;charset=utf-8" }));
    api.log("success", "desktop", `Launcher downloaded: ${launcher.file}`);
    api.toast({
      tone: "success",
      title: `${launcher.file} downloaded`,
      message: os === "windows"
        ? "Save it in the Sasha Maid project folder, then double-click it."
        : "Save it in the project folder, run chmod +x once, then double-click it.",
    });
  };

  return (
    <div className="space-y-4">
      <Section
        title="Get Sasha Maid on your desktop"
        sub="One command sets everything up. Afterwards it is a normal app: a window, a tray icon, and a local service that never touches a file without asking."
        right={<Segmented value={os} onChange={setOs} size="sm" options={[
          { value: "windows", label: "Windows" }, { value: "macos", label: "macOS" }, { value: "linux", label: "Linux" },
        ]} />}
      >
        <div className="inset p-3.5 mb-3 flex flex-wrap items-center gap-4" style={{ background: "linear-gradient(120deg, color-mix(in srgb, var(--teal) 12%, transparent), color-mix(in srgb, var(--blue) 10%, transparent) 55%, color-mix(in srgb, var(--magenta) 10%, transparent))" }}>
          <span className="grid place-items-center rounded-[20px] flex-none" style={{ width: 76, height: 76, background: "var(--ink)", border: "1px solid var(--line-strong)", boxShadow: "0 14px 34px -16px color-mix(in srgb, var(--teal) 70%, transparent)" }}>
            <Mark size={50} />
          </span>
          <div className="min-w-[200px] flex-1">
            <div className="display text-[19px] font-bold tracking-[0.08em] leading-none">
              SASHA<span style={{ color: "var(--teal)" }}> MAID</span>
            </div>
            <p className="text-[12px] mt-1.5" style={{ color: "var(--muted)" }}>
              After setup she behaves like any other desktop app — her own window, her own icon in the taskbar or Dock,
              and a tray presence that keeps watching after you close the window.
            </p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <Chip color="var(--teal)"><Icon name="grid" size={10} />native window</Chip>
            <Chip color="var(--blue)"><Icon name="eye" size={10} />tray watching</Chip>
            <Chip color="var(--lime)"><Icon name="bolt" size={10} />starts in seconds</Chip>
          </div>
        </div>

        <div className="grid lg:grid-cols-[1.15fr_1fr] gap-3">
          <div className="inset p-4" style={{ borderColor: "color-mix(in srgb, var(--teal) 34%, var(--line))" }}>
            <div className="flex items-center gap-2 mb-2">
              <span className="w-8 h-8 rounded-[10px] grid place-items-center" style={{ background: "color-mix(in srgb, var(--teal) 16%, transparent)", color: "var(--teal)" }}>
                <Icon name="bolt" size={16} />
              </span>
              <div>
                <div className="text-[13.5px] font-semibold">The one command</div>
                <div className="text-[11.5px]" style={{ color: "var(--muted)" }}>Run it inside the project folder on {meta.label}</div>
              </div>
            </div>
            <Code lang={os === "windows" ? "powershell" : "terminal"}>
              {os === "windows" ? "py -3 scripts\\desktop_setup.py" : "python3 scripts/desktop_setup.py"}
            </Code>
            <div className="grid sm:grid-cols-2 gap-2 mt-3">
              {[
                ["1", "Creates .venv", "An isolated Python environment — nothing is installed system-wide."],
                ["2", "Installs the runtime", "FastAPI, Pillow, ONNX Runtime, faiss and the Qt shell."],
                ["3", "Builds the interface", "Uses Node if present, otherwise the bundle already in dist/."],
                ["4", "Opens the app", "Native window + tray icon, serving on 127.0.0.1:8765."],
              ].map(([n, t, b]) => (
                <div key={n} className="flex gap-2.5 p-2 rounded-[10px]" style={{ background: "color-mix(in srgb, var(--text) 4%, transparent)" }}>
                  <span className="mono text-[11px] w-5 h-5 rounded-md grid place-items-center flex-none" style={{ background: "color-mix(in srgb, var(--teal) 20%, transparent)", color: "var(--teal)" }}>{n}</span>
                  <div className="min-w-0">
                    <div className="text-[12px] font-medium">{t}</div>
                    <div className="text-[11px]" style={{ color: "var(--muted)" }}>{b}</div>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex flex-wrap gap-2 mt-3">
              <button className="btn btn-primary btn-sm" onClick={grab}><Icon name="download" size={13} />Download {launcher.file}</button>
              <CopyBtn label="Copy command" text={os === "windows" ? "py -3 scripts\\desktop_setup.py" : "python3 scripts/desktop_setup.py"} />
            </div>
          </div>

          <div className="space-y-3">
            <div className="inset p-3.5">
              <div className="label mb-2">Install first on {meta.label}</div>
              <div className="space-y-2">
                {PREREQ[os].map((p) => (
                  <div key={p.cmd}>
                    <div className="text-[11.5px] mb-1" style={{ color: "var(--muted)" }}>{p.label}</div>
                    <div className="flex items-center gap-1.5">
                      <code className="mono text-[11px] flex-1 min-w-0 truncate p-1.5 rounded-md" style={{ background: "color-mix(in srgb, var(--ink) 45%, transparent)", color: "var(--teal)" }}>{p.cmd}</code>
                      <CopyBtn label="" text={p.cmd} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="inset p-3.5">
              <div className="label mb-2">Where Sasha keeps things</div>
              {[
                ["Index & journal", os === "windows" ? "%USERPROFILE%\\.sasha\\sasha.db" : "~/.sasha/sasha.db"],
                ["Backups", os === "windows" ? "%USERPROFILE%\\.sasha\\backups\\" : "~/.sasha/backups/"],
                ["Review folder", os === "windows" ? "%USERPROFILE%\\.sasha\\review\\" : "~/.sasha/review/"],
                ["Desktop log", os === "windows" ? "%USERPROFILE%\\.sasha\\desktop.log" : "~/.sasha/desktop.log"],
              ].map(([k, v]) => (
                <div key={k} className="flex items-center justify-between gap-2 py-1 text-[11.5px]">
                  <span style={{ color: "var(--muted)" }}>{k}</span>
                  <code className="mono text-[10.5px] truncate" style={{ color: "var(--text)" }}>{v}</code>
                </div>
              ))}
              <div className="flex flex-wrap gap-1.5 mt-2">
                <Chip color="var(--success)"><Icon name="shield" size={10} />approval required</Chip>
                <Chip color="var(--blue)">127.0.0.1 only</Chip>
                <Chip color="var(--violet)">no cloud upload</Chip>
              </div>
            </div>
          </div>
        </div>
      </Section>

      <div className="grid lg:grid-cols-2 gap-4">
        <Section title={`Step by step · ${meta.label}`} sub="Exactly what to click, in order">
          <div className="space-y-3">
            {STEPS[os].map((st, i) => (
              <div key={st.title} className="flex gap-3">
                <div className="flex flex-col items-center">
                  <span className="w-6 h-6 rounded-full grid place-items-center mono text-[11px] flex-none" style={{ background: "color-mix(in srgb, var(--teal) 18%, transparent)", color: "var(--teal)" }}>{i + 1}</span>
                  {i < STEPS[os].length - 1 && <span className="flex-1 w-px my-1" style={{ background: "var(--line-strong)" }} />}
                </div>
                <div className="min-w-0 flex-1 pb-1">
                  <div className="text-[12.5px] font-semibold">{st.title}</div>
                  <p className="text-[11.5px] mt-0.5 mb-1.5" style={{ color: "var(--muted)" }}>{st.body}</p>
                  <Code lang={os === "windows" ? "powershell" : "bash"}>{st.cmd}</Code>
                </div>
              </div>
            ))}
          </div>
        </Section>

        <div className="space-y-4">
          <Section title="Make it a real app icon" sub="Package a self-contained binary you can pin to the taskbar or Dock">
            <Code lang={os === "windows" ? "powershell" : "terminal"}>
              {`${os === "windows" ? "py -3" : "python3"} scripts/desktop_setup.py --package\n\n# produces:\n#   ${os === "windows" ? "dist\\SashaMaid-Setup.exe   (pin to Start / taskbar)" : os === "macos" ? "dist/SashaMaid-macOS.app   (drag to Applications)" : "dist/SashaMaid-x86_64   (mark executable, add to your launcher)"}`}
            </Code>
            <p className="text-[11.5px] mt-2" style={{ color: "var(--muted)" }}>
              The bundle carries Python, the models, Qt and the built interface, so the finished app runs on a machine with nothing installed.
            </p>
          </Section>

          <Section title="If something gets in the way" sub="The three things that actually happen">
            <div className="space-y-2">
              {[
                ["“python is not recognised”", "Python is not on PATH. Reinstall it with “Add python.exe to PATH” ticked, or use the py -3 launcher which finds it automatically.", "var(--amber)"],
                ["Window stays on the loading ring", "The local service is still starting or a port is taken. Sasha tries 8765–8772 automatically; the reason is written to ~/.sasha/desktop.log.", "var(--blue)"],
                ["No Qt WebEngine on this machine", "Run with --browser. Identical interface, same local service, opens in your default browser instead.", "var(--violet)"],
                ["Corporate machine, no installs allowed", "Use the Docker option: docker compose up --build, then open http://localhost:8765.", "var(--teal)"],
              ].map(([t, b, c]) => (
                <div key={t} className="inset p-2.5 flex gap-2.5">
                  <span style={{ color: c }} className="mt-0.5"><Icon name="info" size={14} /></span>
                  <div>
                    <div className="text-[12px] font-medium">{t}</div>
                    <div className="text-[11px] mt-0.5" style={{ color: "var(--muted)" }}>{b}</div>
                  </div>
                </div>
              ))}
            </div>
          </Section>
        </div>
      </div>

      <Section title="What runs on your machine" sub="Three processes, all local, all yours">
        <div className="grid md:grid-cols-3 gap-3">
          {[
            { t: "Sasha Maid window", d: "PySide6 + Qt WebEngine shell. Closing it hides to the tray so watching continues; right-click the tray icon to quit.", c: "var(--teal)", i: "grid" },
            { t: "Local service", d: "FastAPI on 127.0.0.1:8765 with the SQLite index, approval tokens, backups and the undo journal.", c: "var(--blue)", i: "cpu" },
            { t: "Watcher & workers", d: "watchdog events plus a thread pool for hashing, perceptual hashes, ONNX captions and OCR.", c: "var(--magenta)", i: "eye" },
          ].map((x) => (
            <div key={x.t} className="inset p-3.5">
              <span className="w-8 h-8 rounded-[10px] grid place-items-center mb-2" style={{ background: `color-mix(in srgb, ${x.c} 15%, transparent)`, color: x.c }}>
                <Icon name={x.i} size={16} />
              </span>
              <div className="text-[12.5px] font-semibold">{x.t}</div>
              <p className="text-[11.5px] mt-1" style={{ color: "var(--muted)" }}>{x.d}</p>
            </div>
          ))}
        </div>
        <div className="mt-3">
          <Code lang="handy commands">{`python3 scripts/desktop_setup.py --launch     # skip setup, just open the app
python3 scripts/desktop_setup.py --browser    # same app, in your browser
python3 scripts/desktop_setup.py --package    # build the native bundle
pytest backend/tests -q                       # run the safety + engine suite`}</Code>
        </div>
      </Section>
    </div>
  );
}