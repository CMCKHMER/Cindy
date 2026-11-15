export type FileCategory = 'Images' | 'Videos' | 'Audio' | 'Documents' | 'Archives' | 'Installers' | 'Other';

export interface LocalFile {
  id: string;
  name: string;
  relativePath: string;
  size: number;
  modified: number;
  mimeType: string;
  category: FileCategory;
  hash?: string;
  handle: FileSystemFileHandle;
  parent: FileSystemDirectoryHandle;
}

export interface DuplicateGroup {
  hash: string;
  size: number;
  files: LocalFile[];
}

const EXTENSION_CATEGORIES: Record<string, FileCategory> = {
  jpg: 'Images', jpeg: 'Images', png: 'Images', gif: 'Images', webp: 'Images', svg: 'Images', heic: 'Images', avif: 'Images', bmp: 'Images', tif: 'Images', tiff: 'Images',
  mp4: 'Videos', mov: 'Videos', avi: 'Videos', mkv: 'Videos', webm: 'Videos', m4v: 'Videos', mpg: 'Videos', mpeg: 'Videos',
  mp3: 'Audio', wav: 'Audio', flac: 'Audio', aac: 'Audio', ogg: 'Audio', m4a: 'Audio', wma: 'Audio',
  pdf: 'Documents', doc: 'Documents', docx: 'Documents', txt: 'Documents', rtf: 'Documents', odt: 'Documents', xls: 'Documents', xlsx: 'Documents', csv: 'Documents', ppt: 'Documents', pptx: 'Documents', md: 'Documents',
  zip: 'Archives', rar: 'Archives', '7z': 'Archives', tar: 'Archives', gz: 'Archives', bz2: 'Archives', xz: 'Archives',
  exe: 'Installers', msi: 'Installers', dmg: 'Installers', pkg: 'Installers', deb: 'Installers', rpm: 'Installers', appimage: 'Installers', apk: 'Installers',
};

export function categorizeFile(name: string): FileCategory {
  const extension = name.split('.').pop()?.toLowerCase() ?? '';
  return EXTENSION_CATEGORIES[extension] ?? 'Other';
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / 1024 ** index).toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}

export function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

async function hashFile(file: File): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer());
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}

export async function scanDirectory(
  root: FileSystemDirectoryHandle,
  onProgress: (message: string, progress: number) => void,
): Promise<LocalFile[]> {
  const found: LocalFile[] = [];
  const walk = async (directory: FileSystemDirectoryHandle, relativeDirectory: string): Promise<void> => {
    for await (const entry of directory.values()) {
      if (entry.name === '.DS_Store' || entry.name === 'Thumbs.db' || entry.name === 'desktop.ini') continue;
      if (entry.kind === 'directory') {
        await walk(entry as FileSystemDirectoryHandle, relativeDirectory ? `${relativeDirectory}/${entry.name}` : entry.name);
      } else {
        const handle = entry as FileSystemFileHandle;
        const file = await handle.getFile();
        const relativePath = relativeDirectory ? `${relativeDirectory}/${entry.name}` : entry.name;
        found.push({
          id: relativePath,
          name: entry.name,
          relativePath,
          size: file.size,
          modified: file.lastModified,
          mimeType: file.type || 'application/octet-stream',
          category: categorizeFile(entry.name),
          handle,
          parent: directory,
        });
        if (found.length % 50 === 0) onProgress(`Found ${found.length.toLocaleString()} files…`, 0);
      }
    }
  };

  await walk(root, '');
  const buckets = new Map<number, LocalFile[]>();
  for (const file of found) {
    const bucket = buckets.get(file.size) ?? [];
    bucket.push(file);
    buckets.set(file.size, bucket);
  }
  const candidates = [...buckets.values()].filter(group => group.length > 1).flat();
  const maxHashSize = 100 * 1024 * 1024;
  const hashable = candidates.filter(file => file.size <= maxHashSize);
  const skippedLarge = candidates.length - hashable.length;
  for (let i = 0; i < hashable.length; i++) {
    const item = hashable[i];
    try {
      item.hash = await hashFile(await item.handle.getFile());
    } catch {
      // A changed or unreadable file should not make the rest of the scan fail.
    }
    onProgress(`Checking same-size files (${i + 1} of ${hashable.length})…`, hashable.length ? Math.round((i + 1) / hashable.length * 100) : 100);
  }
  if (skippedLarge) onProgress(`${skippedLarge} large same-size file(s) were not hashed (100 MB limit).`, 100);
  return found;
}

export function findDuplicates(files: LocalFile[]): DuplicateGroup[] {
  const byHash = new Map<string, LocalFile[]>();
  for (const file of files) {
    if (!file.hash) continue;
    const group = byHash.get(file.hash) ?? [];
    group.push(file);
    byHash.set(file.hash, group);
  }
  return [...byHash.entries()]
    .filter(([, group]) => group.length > 1)
    .map(([hash, group]) => ({ hash, size: group[0].size, files: group }));
}

async function getUnusedName(directory: FileSystemDirectoryHandle, desiredName: string): Promise<string> {
  const dot = desiredName.lastIndexOf('.');
  const stem = dot > 0 ? desiredName.slice(0, dot) : desiredName;
  const extension = dot > 0 ? desiredName.slice(dot) : '';
  let candidate = desiredName;
  let suffix = 2;
  while (true) {
    try {
      await directory.getFileHandle(candidate);
      candidate = `${stem} (${suffix++})${extension}`;
    } catch (error) {
      if (error instanceof DOMException && error.name === 'NotFoundError') return candidate;
      throw error;
    }
  }
}

export async function renameFile(item: LocalFile, desiredName: string): Promise<LocalFile> {
  const name = desiredName.trim();
  if (!name || name === '.' || name === '..' || /[/\\\0]/.test(name)) throw new Error('Enter a valid file name without folder separators.');
  if (name === item.name) return item;
  try {
    await item.parent.getFileHandle(name);
    throw new Error(`A file named “${name}” already exists in this folder.`);
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('A file named')) throw error;
    if (!(error instanceof DOMException && error.name === 'NotFoundError')) throw error;
  }

  const source = await item.handle.getFile();
  const newHandle = await item.parent.getFileHandle(name, { create: true });
  try {
    const writable = await newHandle.createWritable();
    await writable.write(source);
    await writable.close();
    await item.parent.removeEntry(item.name);
  } catch (error) {
    try { await item.parent.removeEntry(name); } catch { /* Best-effort cleanup of a partial copy. */ }
    throw error;
  }
  const parentPath = item.relativePath.includes('/') ? item.relativePath.slice(0, item.relativePath.lastIndexOf('/')) : '';
  const relativePath = parentPath ? `${parentPath}/${name}` : name;
  return { ...item, id: relativePath, name, relativePath, category: categorizeFile(name), handle: newHandle };
}

export async function deleteFile(item: LocalFile): Promise<void> {
  await item.parent.removeEntry(item.name);
}

export async function moveIntoCategory(root: FileSystemDirectoryHandle, item: LocalFile): Promise<LocalFile> {
  const targetDirectory = await root.getDirectoryHandle(item.category, { create: true });
  const targetRelativePath = `${item.category}/${item.name}`;
  if (item.relativePath === targetRelativePath) return item;
  const targetName = await getUnusedName(targetDirectory, item.name);
  const file = await item.handle.getFile();
  const destination = await targetDirectory.getFileHandle(targetName, { create: true });
  try {
    const writable = await destination.createWritable();
    await writable.write(file);
    await writable.close();
    await item.parent.removeEntry(item.name);
  } catch (error) {
    try { await targetDirectory.removeEntry(targetName); } catch { /* Best-effort cleanup of a partial copy. */ }
    throw error;
  }
  return {
    ...item,
    id: `${item.category}/${targetName}`,
    name: targetName,
    relativePath: `${item.category}/${targetName}`,
    handle: destination,
    parent: targetDirectory,
  };
}
