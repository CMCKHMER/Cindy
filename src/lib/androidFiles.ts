import { registerPlugin } from "@capacitor/core";

export type AndroidFile = {
  id: number; root_id: number; path: string; name: string; ext: string; kind: string; signature: string;
  size: number; mtime: number; ctime: number; sha256: string; category: string; status: string;
  broken_kind?: string | null;
};
export type AndroidRoot = { id: number; path: string; recursive: number; watch: number; enabled: number; last_scan: string | null };
export type AndroidDuplicateGroup = { kind: string; similarity: number; reason: string; keep: number; files: AndroidFile[] };

export interface FileAccessPlugin {
  getRoots(): Promise<{ roots: AndroidRoot[] }>;
  pickFolder(): Promise<{ id: number; name: string }>;
  scan(): Promise<{ files: AndroidFile[]; duplicates: AndroidDuplicateGroup[]; done: number }>;
  preview(options: { id: number }): Promise<{ mime: string; base64: string }>;
  apply(options: { action: "delete" | "archive" | "move" | "rename"; items: { id: number; name?: string }[] }): Promise<{ count: number; label: string }>;
  undoLatest(): Promise<{ undone: boolean; label?: string }>;
  addListener(eventName: "scanProgress", listenerFunc: (event: { done: number; total: number; current: string }) => void): Promise<{ remove: () => Promise<void> }>;
}

export const AndroidFiles = registerPlugin<FileAccessPlugin>("FileAccess");
