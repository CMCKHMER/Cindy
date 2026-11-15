import { useState } from "react";
import { Chip, Code, Icon, Section, Segmented } from "../components/ui";
import { selfTest, type TestResult } from "../lib/engine";
import { useApp } from "../state/store";

const TREE = `sasha/
├── backend/
│   ├── main.py              # FastAPI app, REST + WebSocket, approval gate
│   ├── organizer.py         # scanner, hashing, dedupe, integrity, renamer
│   ├── schema.sql           # SQLite schema (WAL, FTS5, faiss sidecar)
│   ├── requirements.txt
│   └── tests/
│       └── test_organizer.py
├── desktop/
│   ├── app.py               # PySide6 shell: readiness wait, tray icon, shutdown
│   └── icon.png             # application icon for the packaged bundle
├── src/                     # React + Vite front-end (this app)
│   ├── components/          # Shell, UI kit, approval dialog, detail drawer
│   ├── views/               # dashboard, scan, duplicates, broken, rename…
│   ├── state/store.tsx      # ops journal, undo, scan engine, watchdog
│   ├── lib/                 # engine, exporters (PDF/CSV/JSON), thumbs
│   └── data/seed.ts         # demo library
├── config/organizer.toml    # roots, rules, safety, models, performance
├── Start Sasha Maid.bat     # Windows: double-click to install + run
├── Start Sasha Maid.command # macOS: double-click to install + run
├── start-sasha-maid.sh      # Linux: ./start-sasha-maid.sh
├── scripts/desktop_setup.py # one-command setup, launch and packaging
├── scripts/build_desktop.py # PyInstaller spec for Win/Linux/macOS
├── scripts/verify_desktop.py# headless check of the desktop engine + launchers
├── Dockerfile
├── docker-compose.yml
└── README.md`;

const SCHEMA = `PRAGMA journal_mode = WAL;
PRAGMA synchronous  = NORMAL;

CREATE TABLE roots (
  id          INTEGER PRIMARY KEY,
  path        TEXT UNIQUE NOT NULL,
  recursive   INTEGER DEFAULT 1,
  watch       INTEGER DEFAULT 1,
  enabled     INTEGER DEFAULT 1,
  last_scan   TIMESTAMP
);

CREATE TABLE files (
  id          INTEGER PRIMARY KEY,
  root_id     INTEGER REFERENCES roots(id) ON DELETE CASCADE,
  path        TEXT UNIQUE NOT NULL,
  name        TEXT NOT NULL,
  ext         TEXT,
  kind        TEXT,             -- document|image|video|music|audio|archive|code|installer|other
  mime        TEXT,
  signature   TEXT,             -- magic bytes sniffed from content
  size        INTEGER,
  mtime       REAL,
  ctime       REAL,
  sha256      TEXT,
  phash       TEXT,             -- 64-bit perceptual hash
  embedding   BLOB,             -- float32[512] CLIP vector (faiss sidecar)
  ocr_text    TEXT,
  category    TEXT,             -- target taxonomy path
  status      TEXT DEFAULT 'indexed',
  broken_kind TEXT,
  broken_info TEXT,
  repairable  INTEGER DEFAULT 0,
  indexed_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_files_sha    ON files(sha256);
CREATE INDEX idx_files_kind   ON files(kind, size);
CREATE INDEX idx_files_status ON files(status);
CREATE VIRTUAL TABLE files_fts USING fts5(name, path, ocr_text, content='files', content_rowid='id');

CREATE TABLE duplicate_groups (
  id          INTEGER PRIMARY KEY,
  kind        TEXT,             -- exact | near | visual
  similarity  REAL,
  keep_file   INTEGER REFERENCES files(id),
  reason      TEXT,
  resolved    TEXT              -- delete | keep | review | ignore | NULL
);
CREATE TABLE duplicate_members (
  group_id INTEGER REFERENCES duplicate_groups(id) ON DELETE CASCADE,
  file_id  INTEGER REFERENCES files(id) ON DELETE CASCADE,
  PRIMARY KEY (group_id, file_id)
);

CREATE TABLE suggestions (
  id          INTEGER PRIMARY KEY,
  file_id     INTEGER REFERENCES files(id) ON DELETE CASCADE,
  new_name    TEXT NOT NULL,
  confidence  REAL,
  model       TEXT,
  reason      TEXT,
  state       TEXT DEFAULT 'pending'
);

CREATE TABLE operations (            -- the undo journal
  id          INTEGER PRIMARY KEY,
  kind        TEXT,                  -- move|rename|delete|archive|repair|folder-rename
  label       TEXT,
  detail      TEXT,
  bytes       INTEGER,
  backup_path TEXT,
  undone      INTEGER DEFAULT 0,
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE operation_patches (
  op_id     INTEGER REFERENCES operations(id) ON DELETE CASCADE,
  file_id   INTEGER REFERENCES files(id),
  before    TEXT,                    -- JSON snapshot
  after     TEXT
);

CREATE TABLE scan_checkpoints (
  root_id  INTEGER PRIMARY KEY REFERENCES roots(id),
  cursor   TEXT,
  done     INTEGER,
  total    INTEGER,
  updated  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE journal (
  id      INTEGER PRIMARY KEY,
  level   TEXT,
  source  TEXT,
  message TEXT,
  at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);`;

const API: [string, string, string][] = [
  ["GET", "/api/health", "Runtime, model list, thread count, DB size"],
  ["GET", "/api/roots", "Watched folders with last scan + file counts"],
  ["POST", "/api/roots", "Add a root — 403 if the path is OS-critical"],
  ["POST", "/api/scan", "Start scan {roots[], incremental} → job id"],
  ["POST", "/api/scan/{id}/pause", "Checkpoint the cursor and stop workers"],
  ["POST", "/api/scan/{id}/resume", "Resume from the durable checkpoint"],
  ["GET", "/api/files", "Search: q, kind, min_size, older_than, status, sort, page"],
  ["GET", "/api/duplicates", "Exact / near / visual clusters with keep suggestion"],
  ["POST", "/api/duplicates/{id}/resolve", "{action: delete|keep|review|ignore} — approval required"],
  ["GET", "/api/broken", "Integrity findings with repair feasibility"],
  ["POST", "/api/broken/resolve", "{ids[], action: delete|repair|archive|ignore}"],
  ["GET", "/api/rename/suggestions", "Pending AI names with confidence + OCR"],
  ["POST", "/api/rename/apply", "{items:[{id, name}]} — collision-safe, journaled"],
  ["POST", "/api/organize/plan", "Downloads triage plan (dry run, no writes)"],
  ["POST", "/api/organize/apply", "Execute an approved plan"],
  ["POST", "/api/folders/rename", "Approve a smart folder name"],
  ["GET", "/api/report", "?format=json|csv|pdf"],
  ["POST", "/api/undo/{op_id}", "Restore the before-snapshot of an operation"],
  ["POST", "/api/command", "{text} → parsed intent + result payload"],
  ["WS", "/ws/events", "scan.progress, file.created, suggestion.ready, op.applied"],
];

const INSTALL: Record<string, string> = {
  windows: `# Windows 10/11 (PowerShell)
winget install Python.Python.3.12
git clone https://github.com/sasha/sasha.git ; cd sasha
py -3.12 -m venv .venv ; .\\.venv\\Scripts\\Activate.ps1
pip install -r backend/requirements.txt
npm install ; npm run build          # builds the UI into backend/static

python -m uvicorn backend.main:app --port 8765
# desktop shell (PySide6 + QtWebEngine)
python desktop/app.py`,
  linux: `# Debian / Ubuntu / Fedora
sudo apt install python3.12 python3.12-venv ffmpeg libgl1   # or dnf equivalents
git clone https://github.com/sasha/sasha.git && cd sasha
python3.12 -m venv .venv && source .venv/bin/activate
pip install -r backend/requirements.txt
npm install && npm run build

uvicorn backend.main:app --host 127.0.0.1 --port 8765
python desktop/app.py                # PySide6 shell`,
  macos: `# macOS 13+ (Apple Silicon or Intel)
brew install python@3.12 ffmpeg node
git clone https://github.com/sasha/sasha.git && cd sasha
python3.12 -m venv .venv && source .venv/bin/activate
pip install -r backend/requirements.txt
npm install && npm run build

uvicorn backend.main:app --port 8765
python desktop/app.py                # CoreML acceleration is picked up automatically`,
};

const DOCKER = `# Dockerfile (multi-stage: node build → python runtime)
FROM node:22-alpine AS ui
WORKDIR /ui
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM python:3.12-slim
ENV PYTHONUNBUFFERED=1 SASHA_HOME=/data
RUN apt-get update && apt-get install -y --no-install-recommends \\
    ffmpeg libgl1 libglib2.0-0 && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY backend/requirements.txt backend/requirements.txt
RUN pip install --no-cache-dir -r backend/requirements.txt
COPY backend backend
COPY config config
COPY --from=ui /ui/dist backend/static
EXPOSE 8765
VOLUME ["/data", "/library"]
CMD ["uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "8765"]`;

const COMPOSE = `services:
  sasha:
    build: .
    ports: ["8765:8765"]
    environment:
      SASHA_THREADS: "8"
      SASHA_LOCAL_ONLY: "1"
      SASHA_REQUIRE_APPROVAL: "1"     # cannot be disabled
    volumes:
      - ./data:/data                  # SQLite index, backups, journal
      - ~/Downloads:/library/Downloads
      - ~/Pictures:/library/Pictures
      - ~/Documents:/library/Documents
    restart: unless-stopped`;

const PYTEST = `pytest backend/tests -q
# or with coverage
pytest --cov=backend --cov-report=term-missing

# desktop path, no third-party packages needed:
python3 scripts/verify_desktop.py

# the suite covers:
#  - content classification & rule precedence
#  - filename normalisation, collisions, extension preservation
#  - SHA-256 grouping and pHash clustering thresholds
#  - integrity detectors (JPEG EOI, PDF xref, moov atom, zero-byte)
#  - protected-path rejection for every platform
#  - approval gate: destructive endpoints 409 without an approval token
#  - undo restores byte-identical state and file paths`;

type Tab = "architecture" | "schema" | "api" | "install" | "docker" | "tests";

export default function System() {
  const { s, api } = useApp();
  const [tab, setTab] = useState<Tab>("architecture");
  const [os, setOs] = useState<"windows" | "linux" | "macos">(s.settings.platform);
  const [results, setResults] = useState<TestResult[] | null>(null);
  const [running, setRunning] = useState(false);

  const run = () => {
    setRunning(true);
    setTimeout(() => {
      const r = selfTest();
      setResults(r);
      setRunning(false);
      const passed = r.filter((x) => x.pass).length;
      api.log(passed === r.length ? "success" : "danger", "tests", `Diagnostics: ${passed}/${r.length} checks passed in ${r.reduce((a, b) => a + b.ms, 0).toFixed(1)} ms`);
      api.toast({
        tone: passed === r.length ? "success" : "danger",
        title: `${passed}/${r.length} checks passed`,
        message: "Classification, naming, safety, dedupe, NLP and formatting suites.",
      });
    }, 260);
  };

  return (
    <div className="space-y-4">
      <Section title="Developer console" sub="The full stack behind this interface — Python core, SQLite index, ONNX models, packaged for three platforms"
        right={<Segmented value={tab} onChange={setTab} size="sm" options={[
          { value: "architecture", label: "Structure" }, { value: "schema", label: "Schema" }, { value: "api", label: "API" },
          { value: "install", label: "Install" }, { value: "docker", label: "Docker" }, { value: "tests", label: "Tests" },
        ]} />}>
        <div className="flex flex-wrap gap-1.5 mb-3">
          {["Python 3.12", "FastAPI", "SQLite + FTS5", "PySide6", "ONNX Runtime", "Pillow", "OpenCV", "watchdog", "faiss", "React 19", "Vite", "Tailwind 4"].map((t) => (
            <Chip key={t} color="var(--blue)">{t}</Chip>
          ))}
        </div>

        {tab === "architecture" && (
          <div className="grid lg:grid-cols-[1.1fr_1fr] gap-3">
            <Code lang="project structure">{TREE}</Code>
            <div className="space-y-3">
              <div className="inset p-3.5">
                <div className="label mb-2">Data flow</div>
                {[
                  ["watchdog / scanner", "filesystem events + recursive walk", "var(--teal)"],
                  ["worker pool", "magic bytes → SHA-256 → pHash → CLIP → OCR", "var(--blue)"],
                  ["SQLite + faiss", "incremental index, FTS5 search, vector neighbours", "var(--violet)"],
                  ["planner", "duplicate / integrity / naming proposals", "var(--magenta)"],
                  ["approval gate", "human decision required for every write", "var(--amber)"],
                  ["executor + journal", "backup → apply → journal → undo", "var(--lime)"],
                ].map(([a, b, c], i, arr) => (
                  <div key={a} className="flex gap-2.5">
                    <div className="flex flex-col items-center">
                      <span className="w-2.5 h-2.5 rounded-full mt-1.5" style={{ background: c }} />
                      {i < arr.length - 1 && <span className="flex-1 w-px" style={{ background: "var(--line-strong)" }} />}
                    </div>
                    <div className="pb-3">
                      <div className="text-[12.5px] font-medium" style={{ color: c }}>{a}</div>
                      <div className="text-[11.5px]" style={{ color: "var(--muted)" }}>{b}</div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="inset p-3.5">
                <div className="label mb-2">Safety invariants (enforced server-side)</div>
                <ul className="space-y-1.5 text-[11.5px]" style={{ color: "var(--muted)" }}>
                  {[
                    "Destructive endpoints require a one-time approval token issued by the UI.",
                    "Every write is wrapped in backup → apply → journal, inside a transaction.",
                    "Path guard rejects OS-critical directories before any worker starts.",
                    "Undo replays the before-snapshot and verifies the SHA-256 after restore.",
                  ].map((t) => (
                    <li key={t} className="flex gap-2"><span style={{ color: "var(--success)" }}><Icon name="check" size={12} /></span>{t}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}

        {tab === "schema" && <Code lang="backend/schema.sql">{SCHEMA}</Code>}

        {tab === "api" && (
          <div className="space-y-3">
            <div className="inset overflow-hidden">
              <div className="scroll overflow-y-auto" style={{ maxHeight: 420 }}>
                <table className="w-full text-[11.5px]">
                  <thead><tr className="label" style={{ background: "color-mix(in srgb, var(--text) 5%, transparent)" }}>
                    <th className="text-left p-2 font-bold w-[70px]">Method</th><th className="text-left p-2 font-bold">Endpoint</th><th className="text-left p-2 font-bold hidden md:table-cell">Description</th>
                  </tr></thead>
                  <tbody>
                    {API.map(([m, p, desc]) => (
                      <tr key={p} style={{ borderTop: "1px solid var(--line)" }}>
                        <td className="p-2"><Chip color={m === "GET" ? "var(--teal)" : m === "WS" ? "var(--violet)" : "var(--amber)"}>{m}</Chip></td>
                        <td className="p-2 mono" style={{ color: "var(--text)" }}>{p}</td>
                        <td className="p-2 hidden md:table-cell" style={{ color: "var(--muted)" }}>{desc}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <Code lang="example · approval-gated delete">{`curl -X POST localhost:8765/api/duplicates/42/resolve \\
  -H "Content-Type: application/json" \\
  -d '{"action":"delete","approval_token":"a7f3…","keep_file":10241}'

# 409 Conflict without a valid token:
# {"error":"approval_required","message":"Destructive action needs explicit user approval"}`}</Code>
          </div>
        )}

        {tab === "install" && (
          <div className="space-y-3">
            <Segmented value={os} onChange={setOs} options={[{ value: "windows", label: "Windows" }, { value: "linux", label: "Linux" }, { value: "macos", label: "macOS" }]} />
            <Code lang={`install · ${os}`}>{INSTALL[os]}</Code>
            <Code lang="package a native desktop binary">{`python scripts/build_desktop.py --platform ${os}
# → dist/Sasha Maid-${os === "windows" ? "Setup.exe" : os === "macos" ? "macOS.dmg" : "x86_64.AppImage"}
# bundles: Python runtime, ONNX models, Qt WebEngine, the built UI`}</Code>
          </div>
        )}

        {tab === "docker" && (
          <div className="grid lg:grid-cols-2 gap-3">
            <Code lang="Dockerfile">{DOCKER}</Code>
            <div className="space-y-3">
              <Code lang="docker-compose.yml">{COMPOSE}</Code>
              <Code lang="run">{`docker compose up --build
# UI + API on http://localhost:8765
# Mount only the folders you want organised — the container can never
# see host system directories that are not explicitly bind-mounted.`}</Code>
            </div>
          </div>
        )}

        {tab === "tests" && (
          <div className="space-y-3">
            <div className="inset p-3.5 flex flex-wrap items-center gap-3">
              <div className="flex-1 min-w-[220px]">
                <div className="text-[13px] font-semibold">Live diagnostics</div>
                <div className="text-[11.5px]" style={{ color: "var(--muted)" }}>
                  Runs the real engine functions used by this UI: classification, naming, collisions, protected paths, hashing, similarity, NLP and formatting.
                </div>
              </div>
              <button className={`btn ${running ? "" : "btn-primary"}`} onClick={run} disabled={running}>
                <Icon name={running ? "cpu" : "play"} size={14} className={running ? "spin" : ""} />{running ? "Running…" : "Run diagnostics"}
              </button>
            </div>

            {results && (
              <div className="inset overflow-hidden fadein">
                <div className="flex items-center gap-2 p-2.5" style={{ borderBottom: "1px solid var(--line)" }}>
                  <Chip color={results.every((r) => r.pass) ? "var(--success)" : "var(--danger)"} solid>
                    {results.filter((r) => r.pass).length}/{results.length} passed
                  </Chip>
                  <span className="mono text-[11px]" style={{ color: "var(--muted)" }}>{results.reduce((a, b) => a + b.ms, 0).toFixed(2)} ms total</span>
                </div>
                <div className="scroll overflow-y-auto" style={{ maxHeight: 340 }}>
                  {results.map((r) => (
                    <div key={r.group + r.name} className="flex items-start gap-2.5 p-2.5" style={{ borderBottom: "1px solid var(--line)" }}>
                      <span style={{ color: r.pass ? "var(--success)" : "var(--danger)" }} className="mt-0.5"><Icon name={r.pass ? "check" : "x"} size={14} /></span>
                      <div className="min-w-0 flex-1">
                        <div className="text-[12px]"><span className="mono" style={{ color: "var(--faint)" }}>{r.group} · </span>{r.name}</div>
                        <div className="mono text-[10.5px] mt-0.5" style={{ color: r.pass ? "var(--muted)" : "var(--danger)" }}>{r.detail}</div>
                      </div>
                      <span className="mono text-[10.5px]" style={{ color: "var(--faint)" }}>{r.ms.toFixed(2)} ms</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <Code lang="python test suite">{PYTEST}</Code>
          </div>
        )}
      </Section>
    </div>
  );
}