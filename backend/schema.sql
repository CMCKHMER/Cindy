-- Sasha Maid index schema — SQLite (WAL), FTS5 search, faiss vectors on the side.
PRAGMA journal_mode = WAL;
PRAGMA synchronous  = NORMAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS roots (
  id          INTEGER PRIMARY KEY,
  path        TEXT UNIQUE NOT NULL,
  recursive   INTEGER DEFAULT 1,
  watch       INTEGER DEFAULT 1,
  enabled     INTEGER DEFAULT 1,
  last_scan   TIMESTAMP
);

CREATE TABLE IF NOT EXISTS files (
  id          INTEGER PRIMARY KEY,
  root_id     INTEGER REFERENCES roots(id) ON DELETE CASCADE,
  path        TEXT UNIQUE NOT NULL,
  name        TEXT NOT NULL,
  ext         TEXT,
  kind        TEXT,
  mime        TEXT,
  signature   TEXT,
  size        INTEGER,
  mtime       REAL,
  ctime       REAL,
  sha256      TEXT,
  phash       TEXT,
  embedding   BLOB,
  ocr_text    TEXT,
  category    TEXT,
  status      TEXT DEFAULT 'indexed',
  broken_kind TEXT,
  broken_info TEXT,
  repairable  INTEGER DEFAULT 0,
  indexed_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_files_sha    ON files(sha256);
CREATE INDEX IF NOT EXISTS idx_files_kind   ON files(kind, size);
CREATE INDEX IF NOT EXISTS idx_files_status ON files(status);
CREATE INDEX IF NOT EXISTS idx_files_mtime  ON files(mtime);

CREATE VIRTUAL TABLE IF NOT EXISTS files_fts
  USING fts5(name, path, ocr_text, content='files', content_rowid='id');

CREATE TABLE IF NOT EXISTS duplicate_groups (
  id          INTEGER PRIMARY KEY,
  kind        TEXT,
  similarity  REAL,
  keep_file   INTEGER REFERENCES files(id),
  reason      TEXT,
  resolved    TEXT
);
CREATE TABLE IF NOT EXISTS duplicate_members (
  group_id INTEGER REFERENCES duplicate_groups(id) ON DELETE CASCADE,
  file_id  INTEGER REFERENCES files(id) ON DELETE CASCADE,
  PRIMARY KEY (group_id, file_id)
);

CREATE TABLE IF NOT EXISTS suggestions (
  id          INTEGER PRIMARY KEY,
  file_id     INTEGER REFERENCES files(id) ON DELETE CASCADE,
  new_name    TEXT NOT NULL,
  confidence  REAL,
  model       TEXT,
  reason      TEXT,
  state       TEXT DEFAULT 'pending'
);

CREATE TABLE IF NOT EXISTS operations (
  id          INTEGER PRIMARY KEY,
  kind        TEXT,
  label       TEXT,
  detail      TEXT,
  bytes       INTEGER,
  backup_path TEXT,
  undone      INTEGER DEFAULT 0,
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS operation_patches (
  op_id     INTEGER REFERENCES operations(id) ON DELETE CASCADE,
  file_id   INTEGER REFERENCES files(id),
  before    TEXT,
  after     TEXT
);

CREATE TABLE IF NOT EXISTS scan_checkpoints (
  root_id  INTEGER PRIMARY KEY REFERENCES roots(id),
  cursor   TEXT,
  done     INTEGER,
  total    INTEGER,
  updated  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS journal (
  id      INTEGER PRIMARY KEY,
  level   TEXT,
  source  TEXT,
  message TEXT,
  at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);