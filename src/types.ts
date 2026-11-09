export interface FileItem {
  id: string;
  name: string;
  path: string;
  size: number;
  type: string;
  category: string;
  modified: string;
  status: 'clean' | 'duplicate' | 'broken' | 'pending';
}

export interface DuplicateGroup {
  id: string;
  files: FileItem[];
  hash: string;
  similarity: number;
  suggestedAction: 'delete' | 'keep' | 'review' | 'ignore';
}

export interface BrokenFile {
  id: string;
  file: FileItem;
  issue: string;
  severity: 'low' | 'medium' | 'high';
  repairable: boolean;
}

export interface RenameSuggestion {
  id: string;
  originalName: string;
  suggestedName: string;
  path: string;
  confidence: number;
  aiReason: string;
  approved: boolean;
}

export interface ScanResult {
  totalFiles: number;
  totalSize: number;
  categories: Record<string, number>;
  duplicates: number;
  brokenFiles: number;
  storageSaved: number;
  scanTime: number;
}

export interface FolderStructure {
  name: string;
  path: string;
  children?: FolderStructure[];
  fileCount: number;
  size: number;
}

export type ViewType = 'dashboard' | 'scanner' | 'duplicates' | 'broken' | 'rename' | 'downloads' | 'analytics' | 'reports' | 'settings' | 'commands';
