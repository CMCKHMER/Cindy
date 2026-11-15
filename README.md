# Cindy — Local File Organizer

Cindy scans a folder you explicitly select in your browser, finds exact duplicate files, and can rename, delete, or sort files into type-based folders. Files stay on your device; Cindy does not upload them.

## Run locally

```sh
npm ci
npm run dev
```

Open the local URL printed by Vite. Type checking and production build:

```sh
npm run typecheck
npm run build
```

## Browser support and permissions

File access uses the browser File System Access API. Use a current Chromium-based browser (Chrome or Edge) on HTTPS or `localhost`. Other browsers may not offer folder selection or write access. Choose a folder in Cindy; the browser prompts before access. Cindy requests read/write access only when you choose a file-changing action. Folder handles are kept in memory for the current page session and are not uploaded or saved by Cindy.

## What the scan does

- Recursively lists file names, sizes, modified dates, and extension-based categories.
- Checks exact duplicates by SHA-256, but only hashes files sharing a size and no larger than 100 MB. Larger candidates are skipped to avoid excessive memory use.
- Flags zero-byte files for review. An empty file is not necessarily damaged.
- Does not infer image contents or claim to repair corrupted files.

## File operations

- **Rename** prompts for a new name and refuses an existing file name.
- **Delete** requires confirmation and permanently removes the selected file.
- **Keep oldest, delete copies** requires confirmation and permanently removes the other exact copies.
- **Organize** previews the plan, then copies each file to its category folder and removes the original only after the copy completes. Name collisions receive a numbered suffix.

The browser may ask you to grant write permission. Keep a separate backup of important files before making changes; deletes cannot be undone.
