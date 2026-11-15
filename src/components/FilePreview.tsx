import { useEffect, useState } from "react";
import { Chip, Icon, Modal } from "./ui";
import { fmtBytes } from "../lib/core";

export type PreviewFile = {
  id: number;
  name: string;
  path: string;
  size: number;
  ext: string;
  category: string;
};

type PreviewKind = "image" | "audio" | "video" | "pdf" | "text" | "other";

const IMAGE = new Set(["jpg", "jpeg", "png", "gif", "webp", "bmp", "avif"]);
const AUDIO = new Set(["mp3", "m4a", "aac", "ogg", "oga", "wav", "flac", "opus"]);
const VIDEO = new Set(["mp4", "m4v", "webm", "ogv", "ogg", "mov"]);
const TEXT = new Set(["txt", "md", "csv", "json", "log", "py", "js", "ts", "tsx", "css", "html", "xml", "yaml", "yml", "toml", "sh"]);

export function previewKind(file: PreviewFile): PreviewKind {
  const ext = file.ext.toLowerCase().replace(/^\./, "") || file.name.split(".").pop()?.toLowerCase() || "";
  if (IMAGE.has(ext)) return "image";
  if (AUDIO.has(ext)) return "audio";
  if (VIDEO.has(ext)) return "video";
  if (ext === "pdf") return "pdf";
  if (TEXT.has(ext)) return "text";
  return "other";
}

export function FilePreview({ file, src, downloadUrl, textContent, sourceError, openExternal, onClose }: {
  file: PreviewFile;
  src: string;
  downloadUrl: string;
  textContent?: string;
  sourceError?: string;
  openExternal?: () => Promise<void>;
  onClose: () => void;
}) {
  const kind = previewKind(file);
  const [text, setText] = useState("");
  const [loadingText, setLoadingText] = useState(false);
  const [textError, setTextError] = useState("");
  const [mediaError, setMediaError] = useState("");
  const [externalStatus, setExternalStatus] = useState("");

  useEffect(() => {
    if (kind !== "text" || sourceError) return;
    if (textContent !== undefined) {
      setText(textContent); setTextError(""); setLoadingText(false);
      return;
    }
    const controller = new AbortController();
    setText(""); setTextError(""); setLoadingText(true);
    fetch(src, { signal: controller.signal })
      .then(async response => {
        if (!response.ok) throw new Error((await response.text()) || `Preview failed (${response.status})`);
        return response.text();
      })
      .then(setText)
      .catch(error => { if (error.name !== "AbortError") setTextError(error.message || "Could not read this text file."); })
      .finally(() => setLoadingText(false));
    return () => controller.abort();
  }, [kind, src, textContent, sourceError]);

  const description = `${file.path} · ${file.category || "File"} · ${fmtBytes(file.size)}`;
  const openInSystemApp = async () => {
    if (!openExternal) return;
    setExternalStatus("Opening with the system’s default app…");
    try { await openExternal(); setExternalStatus("Sent to the system’s default app."); }
    catch (error) { setExternalStatus(error instanceof Error ? error.message : "Could not open the system app."); }
  };
  const download = downloadUrl ? <a className="btn btn-primary btn-sm" href={downloadUrl} download={file.name}><Icon name="download" size={13} />Download file</a> : null;

  return <Modal open onClose={onClose} title={file.name} sub={description} width={920} tone="var(--blue)" footer={<><Chip color="var(--slate)">{file.ext ? `.${file.ext}` : "no extension"}</Chip>{openExternal && <button className="btn btn-sm" onClick={() => void openInSystemApp()}><Icon name="link" size={13} />Open in default app</button>}{download}</>}>
    <div className="pb-4">
      {sourceError && <div className="inset p-5 text-[12px]" style={{ color: "var(--warning)" }}>{sourceError}</div>}
      {!sourceError && kind === "image" && <div className="rounded-xl overflow-hidden grid place-items-center p-2" style={{ minHeight: 220, maxHeight: "66vh", background: "color-mix(in srgb, var(--ink) 80%, transparent)" }}><img src={src} alt={file.name} onError={() => setMediaError("The browser could not decode this image. Try Open in default app or use Download.")} style={{ display: "block", maxWidth: "100%", maxHeight: "64vh", objectFit: "contain" }} /></div>}
      {!sourceError && kind === "audio" && <div className="inset p-5 sm:p-8"><div className="flex items-center gap-4 mb-5"><span className="w-14 h-14 rounded-2xl grid place-items-center" style={{ color: "var(--violet)", background: "color-mix(in srgb, var(--violet) 16%, transparent)" }}><Icon name="sound" size={26} /></span><div className="min-w-0"><div className="font-semibold truncate">{file.name}</div><div className="text-[12px] mt-1" style={{ color: "var(--muted)" }}>{fmtBytes(file.size)} · {file.ext.toUpperCase()} audio</div></div></div><audio controls preload="metadata" src={src} onError={() => setMediaError("The browser could not play this audio codec. Try Open in default app or Download.")} style={{ width: "100%" }}>Your browser cannot play this audio format.</audio></div>}
      {!sourceError && kind === "video" && <video controls preload="metadata" src={src} onError={() => setMediaError("The browser could not play this video codec. Try Open in default app; VLC handles more formats.")} style={{ display: "block", width: "100%", maxHeight: "66vh", background: "#05070c", borderRadius: 12 }}>Your browser cannot play this video format.</video>}
      {!sourceError && kind === "pdf" && <iframe title={`Preview of ${file.name}`} src={src} onError={() => setMediaError("The built-in PDF viewer could not open this file. Try Download.")} style={{ width: "100%", height: "66vh", border: "1px solid var(--line)", borderRadius: 12, background: "white" }} />}
      {!sourceError && kind === "text" && <div className="inset rounded-xl overflow-auto" style={{ maxHeight: "66vh" }}>{loadingText ? <div className="p-5 text-[12px]" style={{ color: "var(--muted)" }}>Loading file contents…</div> : textError ? <div className="p-5 text-[12px]" style={{ color: "var(--danger)" }}>{textError}</div> : <pre className="p-4 text-[12px] leading-5 whitespace-pre-wrap break-words" style={{ color: "var(--text)", fontFamily: "var(--font-mono)" }}>{text}</pre>}</div>}
      {!sourceError && kind === "other" && <div className="inset p-6 text-center"><span className="mx-auto w-14 h-14 rounded-2xl grid place-items-center" style={{ color: "var(--blue)", background: "color-mix(in srgb, var(--blue) 14%, transparent)" }}><Icon name="files" size={25} /></span><h4 className="text-[14px] font-semibold mt-3">File details</h4><p className="text-[12px] mt-1" style={{ color: "var(--muted)" }}>Sasha can identify this file, but doesn’t have a safe in-app viewer for this format. Download it or open it with the system’s default app.</p><div className="mono text-[10px] break-all mt-3" style={{ color: "var(--faint)" }}>{file.path}</div></div>}
      {mediaError && <div className="mt-3 text-[12px]" style={{ color: "var(--warning)" }} role="alert">{mediaError}</div>}
      {externalStatus && <div className="mt-3 text-[12px]" style={{ color: externalStatus.startsWith("Could not") ? "var(--danger)" : "var(--success)" }} role="status">{externalStatus}</div>}
    </div>
  </Modal>;
}
