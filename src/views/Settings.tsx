import { useState } from "react";
import { useApp } from "../state/store";
import { Chip, Icon, Section, Segmented, Slider, Toggle } from "../components/ui";
import { PlatformSwitch } from "../components/Shell";
import { classify } from "../lib/engine";
import { PROTECTED_PATHS, fmtNum, uid } from "../lib/core";

const MODELS = [
  "clip-vit-b32 (ONNX · local)",
  "blip-caption-base (ONNX · local)",
  "mobilenet-v3-large (ONNX · local)",
  "paddle-ocr-v4 (ONNX · local)",
  "siglip-base-p16 (ONNX · local)",
];

function Row({ title, desc, children, locked }: { title: string; desc: string; children: React.ReactNode; locked?: boolean }) {
  return (
    <div className="flex items-start gap-3 py-2.5" style={{ borderBottom: "1px solid var(--line)" }}>
      <div className="min-w-0 flex-1">
        <div className="text-[12.5px] font-medium flex items-center gap-1.5">
          {title}
          {locked && <Chip color="var(--success)"><Icon name="shield" size={10} />enforced</Chip>}
        </div>
        <div className="text-[11px] mt-0.5" style={{ color: "var(--muted)" }}>{desc}</div>
      </div>
      <div className="flex-none pt-0.5">{children}</div>
    </div>
  );
}

export default function Settings() {
  const { s, d, api } = useApp();
  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const [sample, setSample] = useState("Screenshot 2026-03-12 at 09.41.png");
  const [newMatch, setNewMatch] = useState("");
  const [newTarget, setNewTarget] = useState("Media/Images/Screenshots");

  const preview = classify(sample, "Downloads", s.rules);
  const benchPct = (s.bench.done / s.bench.total) * 100;

  const reorder = (from: string, to: string) => {
    const list = [...s.rules];
    const a = list.findIndex((r) => r.id === from);
    const b = list.findIndex((r) => r.id === to);
    if (a < 0 || b < 0 || a === b) return;
    const [item] = list.splice(a, 1);
    list.splice(b, 0, item);
    api.setRules(list);
    api.log("info", "rules", `Rule priority changed — ${item.match} now at position ${b + 1}`);
  };

  return (
    <div className="space-y-4">
      <div className="grid xl:grid-cols-2 gap-4">
        <Section title="Safety policy" sub="These guarantees are compiled in — they cannot be switched off"
          right={<Chip color="var(--success)"><Icon name="shield" size={11} />hard rules</Chip>}>
          <Row title="Never delete files automatically" desc="Every deletion needs an explicit approval click." locked><Toggle on={false} onChange={() => {}} disabled label="Never delete automatically" /></Row>
          <Row title="Never overwrite originals" desc="Name collisions get a numeric suffix; moves are atomic." locked><Toggle on={false} onChange={() => {}} disabled label="Never overwrite" /></Row>
          <Row title="Never rename without approval" desc="AI suggestions stay proposals until you accept them." locked><Toggle on={false} onChange={() => {}} disabled label="Never rename without approval" /></Row>
          <Row title="Never touch OS-critical directories" desc={PROTECTED_PATHS.slice(0, 4).join(" · ") + " …"} locked><Toggle on={false} onChange={() => {}} disabled label="Never touch system folders" /></Row>
          <Row title="Create backups before every batch" desc="Copy-on-write snapshot in .sasha/backups plus a journal row.">
            <Toggle on={s.settings.backups} onChange={(v) => api.setSetting("backups", v)} label="Backups" />
          </Row>
          <Row title="Backup retention" desc="Snapshots older than this are pruned automatically.">
            <div className="flex items-center gap-1.5">
              <button className="btn btn-xs btn-icon" onClick={() => api.setSetting("backupRetention", Math.max(1, s.settings.backupRetention - 5))} aria-label="Less retention"><Icon name="minus" size={12} /></button>
              <span className="mono text-[12px] w-[52px] text-center" style={{ color: "var(--teal)" }}>{s.settings.backupRetention} d</span>
              <button className="btn btn-xs btn-icon" onClick={() => api.setSetting("backupRetention", Math.min(365, s.settings.backupRetention + 5))} aria-label="More retention"><Icon name="plus" size={12} /></button>
            </div>
          </Row>
          <Row title="Queue new suggestions automatically" desc="Watcher findings land in the review queue instead of acting.">
            <Toggle on={s.settings.autoQueue} onChange={(v) => api.setSetting("autoQueue", v)} label="Auto queue" />
          </Row>
        </Section>

        <Section title="Local AI models" sub="ONNX Runtime · CPU by default, CUDA/CoreML when available"
          right={<Chip color={s.settings.localOnly ? "var(--teal)" : "var(--amber)"}>{s.settings.localOnly ? "offline" : "hybrid"}</Chip>}>
          <Row title="Vision / caption model" desc="Used for image recognition, subject clustering and filenames.">
            <select className="field w-[230px]" value={s.settings.visionModel} onChange={(e) => api.setSetting("visionModel", e.target.value)} aria-label="Vision model">
              {MODELS.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </Row>
          <Row title="OCR for screenshots" desc="PaddleOCR v4 reads headlines, receipts and window titles.">
            <Toggle on={s.settings.ocrEnabled} onChange={(v) => api.setSetting("ocrEnabled", v)} label="OCR" />
          </Row>
          <Row title="Local-only inference" desc="Blocks any network fallback — files never leave the machine.">
            <Toggle on={s.settings.localOnly} onChange={(v) => api.setSetting("localOnly", v)} label="Local only" />
          </Row>
          <Row title="Minimum words in a generated name" desc="Shorter captions are padded with metadata tokens.">
            <div className="flex items-center gap-1.5">
              <button className="btn btn-xs btn-icon" onClick={() => api.setSetting("minNameWords", Math.max(2, s.settings.minNameWords - 1))} aria-label="Fewer words"><Icon name="minus" size={12} /></button>
              <span className="mono text-[12px] w-[52px] text-center" style={{ color: "var(--teal)" }}>{s.settings.minNameWords}</span>
              <button className="btn btn-xs btn-icon" onClick={() => api.setSetting("minNameWords", Math.min(8, s.settings.minNameWords + 1))} aria-label="More words"><Icon name="plus" size={12} /></button>
            </div>
          </Row>
          <div className="grid sm:grid-cols-2 gap-3 pt-3">
            <div className="inset p-3"><Slider label="Visual duplicate threshold" value={s.settings.similarity} min={80} max={99} suffix="%" onChange={(v) => api.setSetting("similarity", v)} /></div>
            <div className="inset p-3"><Slider label="Near-text threshold" value={s.settings.nearThreshold} min={70} max={99} suffix="%" onChange={(v) => api.setSetting("nearThreshold", v)} /></div>
          </div>
          <button className="btn btn-sm mt-3" onClick={api.redetect}><Icon name="spark" size={13} />Re-run similarity with these thresholds</button>
        </Section>
      </div>

      <div className="grid xl:grid-cols-2 gap-4">
        <Section title="Performance" sub="Built for 1,000,000+ files with a bounded memory footprint"
          right={<Chip color="var(--blue)">{s.settings.threads} threads</Chip>}>
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="inset p-3"><Slider label="Worker threads" value={s.settings.threads} min={1} max={16} onChange={(v) => api.setSetting("threads", v)} /></div>
            <div className="inset p-3"><Slider label="Memory budget" value={s.settings.memoryMb} min={128} max={4096} step={128} suffix=" MB" onChange={(v) => api.setSetting("memoryMb", v)} /></div>
            <div className="inset p-3"><Slider label="Hash chunk size" value={s.settings.hashChunkKb} min={64} max={8192} step={64} suffix=" KB" onChange={(v) => api.setSetting("hashChunkKb", v)} /></div>
            <div className="inset p-3 space-y-2.5">
              <label className="flex items-center justify-between text-[12px]"><span style={{ color: "var(--muted)" }}>Incremental indexing</span><Toggle on={s.settings.incremental} onChange={(v) => api.setSetting("incremental", v)} label="Incremental" /></label>
              <label className="flex items-center justify-between text-[12px]"><span style={{ color: "var(--muted)" }}>Follow symlinks</span><Toggle on={s.settings.followSymlinks} onChange={(v) => api.setSetting("followSymlinks", v)} label="Symlinks" /></label>
              <label className="flex items-center justify-between text-[12px]"><span style={{ color: "var(--muted)" }}>Real-time watch</span><Toggle on={s.settings.watch} onChange={(v) => api.setSetting("watch", v)} label="Watch" /></label>
            </div>
          </div>

          <div className="inset p-3.5 mt-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[12.5px] font-semibold flex-1">Million-file indexing benchmark</span>
              <button className={`btn btn-sm ${s.bench.running ? "" : "btn-primary"}`} onClick={api.runBench}>
                <Icon name={s.bench.running ? "stop" : "bolt"} size={13} />{s.bench.running ? "Stop" : "Run 1,000,000 paths"}
              </button>
            </div>
            <div className="h-2 rounded-full overflow-hidden mt-2.5" style={{ background: "color-mix(in srgb, var(--text) 10%, transparent)" }}>
              <div className="h-full rounded-full transition-all duration-150" style={{ width: `${benchPct}%`, background: "linear-gradient(90deg, var(--teal), var(--lime))" }} />
            </div>
            <div className="grid grid-cols-3 gap-2 mt-2.5">
              {[
                ["Paths hashed", fmtNum(s.bench.done)],
                ["Throughput", s.bench.result ? `${fmtNum(s.bench.result.rate)}/s` : "—"],
                ["Index memory", s.bench.result ? `${s.bench.result.memMb.toFixed(0)} MB` : "—"],
              ].map(([k, v]) => (
                <div key={k}>
                  <div className="label">{k}</div>
                  <div className="mono text-[12.5px] mt-0.5" style={{ color: "var(--teal)" }}>{v}</div>
                </div>
              ))}
            </div>
            <p className="text-[11px] mt-2" style={{ color: "var(--faint)" }}>
              Runs a chunked FNV-1a pass over one million synthetic paths on the main thread without blocking the UI — the same work shape as the Python indexer, which parallelises it across {s.settings.threads} processes.
            </p>
          </div>
        </Section>

        <Section title="Appearance & platform" sub="One codebase, three operating systems">
          <Row title="Theme" desc="Dark vault or daylight paper — both are fully contrast-checked.">
            <Segmented value={s.settings.theme} onChange={(v) => api.setSetting("theme", v)} size="sm"
              options={[{ value: "dark", label: "Dark", icon: "moon" }, { value: "light", label: "Light", icon: "sun" }]} />
          </Row>
          <Row title="Path style" desc="Switch how paths are rendered and which trash target is used.">
            <PlatformSwitch />
          </Row>
          <Row title="Interface sound" desc="Quiet confirmation tones on approve, undo and scan completion.">
            <Toggle on={s.settings.sound} onChange={(v) => api.setSetting("sound", v)} label="Sound" />
          </Row>
          <Row title="Reset demo library" desc="Clears operations, imports and journal, restores the seeded library.">
            <button className="btn btn-sm btn-danger" onClick={api.resetAll}><Icon name="undo" size={13} />Reset</button>
          </Row>
          <div className="grid grid-cols-3 gap-2 mt-3">
            {[["Index size", `${(d.stats.fileCount * 0.000168).toFixed(2)} MB`], ["Journal rows", String(s.logs.length)], ["Ops stored", String(s.ops.length)]].map(([k, v]) => (
              <div key={k} className="inset p-2.5">
                <div className="label">{k}</div>
                <div className="mono text-[12.5px] mt-1" style={{ color: "var(--teal)" }}>{v}</div>
              </div>
            ))}
          </div>
        </Section>
      </div>

      <Section title="Classification rules" sub="Evaluated top to bottom — drag to reorder. First match wins over the built-in taxonomy."
        right={<Chip color="var(--teal)">{s.rules.filter((r) => r.enabled).length} active</Chip>}>
        <div className="space-y-2 mb-3">
          {s.rules.map((r, i) => (
            <div key={r.id} draggable onDragStart={() => setDragId(r.id)} onDragEnd={() => { setDragId(null); setOverId(null); }}
              onDragOver={(e) => { e.preventDefault(); setOverId(r.id); }} onDrop={() => { if (dragId) reorder(dragId, r.id); setOverId(null); }}
              className={`inset p-2.5 flex flex-wrap items-center gap-2.5 ${dragId === r.id ? "dragging" : ""} ${overId === r.id ? "drop-target" : ""}`}>
              <span className="cursor-grab" style={{ color: "var(--faint)" }} title="Drag to reorder"><Icon name="drag" size={14} /></span>
              <span className="mono text-[11px] w-5" style={{ color: "var(--faint)" }}>{i + 1}</span>
              <Toggle on={r.enabled} onChange={(v) => api.setRules(s.rules.map((x) => (x.id === r.id ? { ...x, enabled: v } : x)))} label={`Enable ${r.match}`} />
              <input className="field mono !h-8 w-[190px] text-[11.5px]" value={r.match} onChange={(e) => api.setRules(s.rules.map((x) => (x.id === r.id ? { ...x, match: e.target.value } : x)))} aria-label="Match pattern" />
              <Icon name="arrow" size={13} />
              <input className="field mono !h-8 flex-1 min-w-[180px] text-[11.5px]" value={r.target} onChange={(e) => api.setRules(s.rules.map((x) => (x.id === r.id ? { ...x, target: e.target.value } : x)))} aria-label="Target folder" />
              <Chip color="var(--slate)">{r.hits} hits</Chip>
              <button className="btn btn-xs btn-ghost" onClick={() => api.setRules(s.rules.filter((x) => x.id !== r.id))} aria-label="Delete rule"><Icon name="trash" size={12} /></button>
            </div>
          ))}
        </div>

        <form className="flex flex-wrap gap-2 items-center" onSubmit={(e) => {
          e.preventDefault();
          if (!newMatch.trim()) return;
          api.setRules([...s.rules, { id: uid("rule"), match: newMatch.trim(), target: newTarget, enabled: true, hits: 0 }]);
          api.log("success", "rules", `Rule added: ${newMatch} → ${newTarget}`);
          setNewMatch("");
        }}>
          <input className="field mono w-[200px]" placeholder="*.heic or /invoice|receipt/" value={newMatch} onChange={(e) => setNewMatch(e.target.value)} />
          <Icon name="arrow" size={14} />
          <input className="field mono flex-1 min-w-[200px]" value={newTarget} onChange={(e) => setNewTarget(e.target.value)} />
          <button className="btn btn-primary" type="submit"><Icon name="plus" size={14} />Add rule</button>
        </form>

        <div className="inset p-3 mt-3">
          <div className="label mb-2">Live classification preview</div>
          <div className="flex flex-wrap items-center gap-2">
            <input className="field mono flex-1 min-w-[220px]" value={sample} onChange={(e) => setSample(e.target.value)} aria-label="Sample filename" />
            <Icon name="arrow" size={14} />
            <Chip color="var(--teal)">{preview.dest}</Chip>
            <Chip color="var(--blue)">{preview.kind}</Chip>
            <Chip color="var(--violet)">{preview.signature}</Chip>
            {preview.matchedRule && <Chip color="var(--amber)">custom rule applied</Chip>}
          </div>
        </div>
      </Section>
    </div>
  );
}