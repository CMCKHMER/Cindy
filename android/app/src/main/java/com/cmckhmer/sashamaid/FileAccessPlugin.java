package com.cmckhmer.sashamaid;

import android.app.Activity;
import android.content.Intent;
import androidx.activity.result.ActivityResult;
import android.database.Cursor;
import android.net.Uri;
import android.provider.DocumentsContract;
import android.provider.OpenableColumns;
import android.util.Base64;
import android.webkit.MimeTypeMap;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.security.MessageDigest;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

@CapacitorPlugin(name = "FileAccess")
public class FileAccessPlugin extends Plugin {
    private static final String PREFS = "sasha_android_files";
    private static final String ROOTS = "roots";
    private static final String HISTORY = "history";
    private static final int MAX_PREVIEW_BYTES = 32 * 1024 * 1024;
    private final ExecutorService worker = Executors.newSingleThreadExecutor();
    private final Map<Integer, ScannedFile> scanned = new HashMap<>();
    private int nextId = 1;

    private static class ScannedFile {
        int id;
        Uri uri;
        Uri parent;
        String name;
        String path;
        String mime;
        long size;
        long modified;
        String sha256;
        String category;
    }

    @PluginMethod
    public void getRoots(PluginCall call) {
        JSArray roots = new JSArray();
        JSONArray saved = savedRoots();
        for (int i = 0; i < saved.length(); i++) {
            JSONObject root = saved.optJSONObject(i);
            if (root == null) continue;
            JSObject row = new JSObject();
            row.put("id", root.optInt("id"));
            row.put("path", root.optString("name", "Selected folder"));
            row.put("recursive", 1);
            row.put("watch", 0);
            row.put("enabled", 1);
            row.put("last_scan", root.optString("lastScan", ""));
            roots.put(row);
        }
        JSObject result = new JSObject();
        result.put("roots", roots);
        call.resolve(result);
    }

    @PluginMethod
    public void pickFolder(PluginCall call) {
        Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT_TREE);
        intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_WRITE_URI_PERMISSION |
                Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION | Intent.FLAG_GRANT_PREFIX_URI_PERMISSION);
        startActivityForResult(call, intent, "folderPicked");
    }

    @ActivityCallback
    private void folderPicked(PluginCall call, ActivityResult result) {
        if (call == null) return;
        if (result.getResultCode() != Activity.RESULT_OK || result.getData() == null || result.getData().getData() == null) {
            call.reject("Folder selection was cancelled.", "CANCELLED");
            return;
        }
        Uri tree = result.getData().getData();
        int flags = result.getData().getFlags() & (Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_WRITE_URI_PERMISSION);
        try {
            getContext().getContentResolver().takePersistableUriPermission(tree, flags);
            String name = queryDisplayName(tree);
            JSONArray roots = savedRoots();
            for (int i = 0; i < roots.length(); i++) {
                if (tree.toString().equals(roots.optJSONObject(i).optString("uri"))) {
                    JSObject same = new JSObject(); same.put("id", roots.optJSONObject(i).optInt("id")); same.put("name", name);
                    call.resolve(same); return;
                }
            }
            int id = (int) (System.currentTimeMillis() & 0x7fffffff);
            JSONObject root = new JSONObject();
            root.put("id", id); root.put("uri", tree.toString()); root.put("name", name); root.put("lastScan", "");
            roots.put(root);
            saveRoots(roots);
            JSObject response = new JSObject(); response.put("id", id); response.put("name", name);
            call.resolve(response);
        } catch (Exception error) {
            call.reject("Android could not keep access to that folder: " + error.getMessage(), "PERMISSION_ERROR", error);
        }
    }

    @PluginMethod
    public void scan(PluginCall call) {
        worker.execute(() -> {
            try {
                JSONArray rootRows = savedRoots();
                List<ScannedFile> found = new ArrayList<>();
                scanned.clear(); nextId = 1;
                int rootCount = rootRows.length();
                for (int i = 0; i < rootCount; i++) {
                    JSONObject root = rootRows.optJSONObject(i);
                    if (root == null) continue;
                    Uri tree = Uri.parse(root.optString("uri"));
                    Uri rootDoc = DocumentsContract.buildDocumentUriUsingTree(tree, DocumentsContract.getTreeDocumentId(tree));
                    walk(tree, rootDoc, root.optString("name", "Folder"), found, 0);
                    root.put("lastScan", Long.toString(System.currentTimeMillis()));
                    JSObject progress = new JSObject(); progress.put("done", found.size()); progress.put("total", 0);
                    progress.put("current", "Scanned " + found.size() + " files · " + root.optString("name"));
                    notifyListeners("scanProgress", progress);
                }
                saveRoots(rootRows);
                JSArray rows = new JSArray();
                for (ScannedFile file : found) rows.put(toJson(file));
                JSObject response = new JSObject();
                response.put("files", rows);
                response.put("duplicates", duplicateGroups(found));
                response.put("done", found.size());
                call.resolve(response);
            } catch (Exception error) {
                call.reject("Folder scan failed: " + error.getMessage(), "SCAN_FAILED", error);
            }
        });
    }

    private void walk(Uri tree, Uri parent, String parentPath, List<ScannedFile> out, int depth) throws Exception {
        if (depth > 100) return;
        String parentId = DocumentsContract.getDocumentId(parent);
        Uri childrenUri = DocumentsContract.buildChildDocumentsUriUsingTree(tree, parentId);
        String[] columns = {DocumentsContract.Document.COLUMN_DOCUMENT_ID, DocumentsContract.Document.COLUMN_DISPLAY_NAME,
                DocumentsContract.Document.COLUMN_MIME_TYPE, DocumentsContract.Document.COLUMN_SIZE,
                DocumentsContract.Document.COLUMN_LAST_MODIFIED};
        try (Cursor cursor = getContext().getContentResolver().query(childrenUri, columns, null, null, null)) {
            if (cursor == null) return;
            while (cursor.moveToNext()) {
                String documentId = cursor.getString(0);
                String name = cursor.getString(1);
                String mime = cursor.getString(2);
                long size = cursor.isNull(3) ? 0 : Math.max(0, cursor.getLong(3));
                long modified = cursor.isNull(4) ? 0 : Math.max(0, cursor.getLong(4));
                Uri child = DocumentsContract.buildDocumentUriUsingTree(tree, documentId);
                if (DocumentsContract.Document.MIME_TYPE_DIR.equals(mime)) {
                    if (depth == 0 && (".Sasha Maid Trash".equals(name) || "Sasha Maid Review".equals(name))) continue;
                    walk(tree, child, parentPath + "/" + name, out, depth + 1);
                    continue;
                }
                ScannedFile file = new ScannedFile();
                file.id = nextId++; file.uri = child; file.parent = parent; file.name = name;
                file.path = parentPath + "/" + name; file.mime = mime == null ? "application/octet-stream" : mime;
                file.size = size; file.modified = modified;
                file.category = category(name, file.mime);
                file.sha256 = hash(child);
                scanned.put(file.id, file); out.add(file);
            }
        }
    }

    private String hash(Uri uri) throws Exception {
        MessageDigest digest = MessageDigest.getInstance("SHA-256");
        try (InputStream input = getContext().getContentResolver().openInputStream(uri)) {
            if (input == null) return "";
            byte[] buffer = new byte[64 * 1024]; int count;
            while ((count = input.read(buffer)) != -1) digest.update(buffer, 0, count);
        }
        StringBuilder hex = new StringBuilder();
        for (byte b : digest.digest()) hex.append(String.format(Locale.ROOT, "%02x", b));
        return hex.toString();
    }

    private JSObject toJson(ScannedFile file) {
        JSObject row = new JSObject();
        row.put("id", file.id); row.put("root_id", 0); row.put("path", file.path); row.put("name", file.name);
        String ext = ""; int dot = file.name.lastIndexOf('.'); if (dot >= 0) ext = file.name.substring(dot + 1).toLowerCase(Locale.ROOT);
        row.put("ext", ext); row.put("kind", file.category); row.put("signature", file.mime); row.put("size", file.size);
        row.put("mtime", file.modified / 1000.0); row.put("ctime", 0); row.put("sha256", file.sha256);
        row.put("category", file.category); row.put("status", "indexed");
        return row;
    }

    private JSArray duplicateGroups(List<ScannedFile> files) {
        Map<String, List<ScannedFile>> byHash = new HashMap<>();
        for (ScannedFile f : files) if (!f.sha256.isEmpty()) byHash.computeIfAbsent(f.sha256, k -> new ArrayList<>()).add(f);
        JSArray groups = new JSArray();
        for (List<ScannedFile> members : byHash.values()) {
            if (members.size() < 2) continue;
            JSObject group = new JSObject(); group.put("kind", "exact"); group.put("similarity", 1.0);
            group.put("reason", "Matching SHA-256"); group.put("keep", members.get(0).id);
            JSArray rows = new JSArray(); for (ScannedFile member : members) rows.put(toJson(member));
            group.put("files", rows); groups.put(group);
        }
        return groups;
    }

    @PluginMethod
    public void preview(PluginCall call) {
        Integer id = call.getInt("id");
        if (id == null) { call.reject("A scanned file id is required."); return; }
        worker.execute(() -> {
            try {
                ScannedFile file = scanned.get(id);
                if (file == null) throw new IllegalArgumentException("Scan this folder again before previewing the file.");
                ByteArrayOutputStream bytes = new ByteArrayOutputStream((int) Math.min(file.size, 1024 * 1024));
                try (InputStream input = getContext().getContentResolver().openInputStream(file.uri)) {
                    if (input == null) throw new IllegalStateException("Android could not read this file.");
                    byte[] buffer = new byte[32 * 1024]; int count; int total = 0;
                    while ((count = input.read(buffer)) != -1) {
                        total += count;
                        if (total > MAX_PREVIEW_BYTES) throw new IllegalArgumentException("Android in-app preview is limited to 32 MiB; use another viewer for larger files.");
                        bytes.write(buffer, 0, count);
                    }
                }
                String mime = file.mime;
                if (mime == null || mime.isEmpty() || "application/octet-stream".equals(mime)) {
                    String extension = file.name.contains(".") ? file.name.substring(file.name.lastIndexOf('.') + 1).toLowerCase(Locale.ROOT) : "";
                    String guessed = MimeTypeMap.getSingleton().getMimeTypeFromExtension(extension);
                    mime = guessed == null ? "application/octet-stream" : guessed;
                }
                JSObject result = new JSObject();
                result.put("name", file.name); result.put("mime", mime); result.put("size", bytes.size());
                result.put("base64", Base64.encodeToString(bytes.toByteArray(), Base64.NO_WRAP));
                call.resolve(result);
            } catch (Exception error) {
                call.reject("Could not preview file: " + error.getMessage(), "PREVIEW_FAILED", error);
            }
        });
    }

    @PluginMethod
    public void apply(PluginCall call) {
        String action = call.getString("action", "");
        JSArray requested = call.getArray("items", new JSArray());
        worker.execute(() -> {
            List<JSONObject> completed = new ArrayList<>();
            try {
                for (int i = 0; i < requested.length(); i++) {
                    JSObject item = JSObject.fromJSONObject(requested.getJSONObject(i));
                    int id = item.getInteger("id");
                    ScannedFile file = scanned.get(id);
                    if (file == null) throw new IllegalArgumentException("File selection expired. Scan again before applying actions.");
                    JSONObject record = applyOne(action, file, item.optString("name", file.name));
                    completed.add(record);
                }
                JSONArray history = savedHistory();
                JSONObject op = new JSONObject(); op.put("label", action + " " + completed.size() + " file(s)");
                op.put("items", new JSONArray(completed)); history.put(op); saveHistory(history);
                call.resolve(new JSObject().put("count", completed.size()).put("label", op.optString("label")));
            } catch (Exception error) {
                Collections.reverse(completed);
                for (JSONObject record : completed) try { undoRecord(record); } catch (Exception ignored) { }
                call.reject("File operation failed; completed changes were rolled back where possible: " + error.getMessage(), "ACTION_FAILED", error);
            }
        });
    }

    private JSONObject applyOne(String action, ScannedFile file, String requestedName) throws Exception {
        Uri resolver = file.uri;
        Uri resulting = resolver;
        String resultName = file.name;
        String normalized = action.toLowerCase(Locale.ROOT);
        if ("rename".equals(normalized)) {
            String safeName = requestedName.trim();
            if (safeName.isEmpty() || safeName.contains("/") || safeName.contains("\\")) throw new IllegalArgumentException("Enter a valid file name.");
            if (safeName.equals(file.name)) throw new IllegalArgumentException("The new name must differ from the current name.");
            resulting = DocumentsContract.renameDocument(getContext().getContentResolver(), file.uri, safeName);
            if (resulting == null) throw new IllegalStateException("The selected provider could not rename this file.");
            resultName = safeName;
        } else {
            Uri tree = Uri.parse(rootTreeUri(file.uri));
            Uri root = DocumentsContract.buildDocumentUriUsingTree(tree, DocumentsContract.getTreeDocumentId(tree));
            String folder;
            if ("delete".equals(normalized)) folder = ".Sasha Maid Trash";
            else if ("archive".equals(normalized)) folder = "Sasha Maid Review";
            else if ("move".equals(normalized)) folder = file.category.substring(0, 1).toUpperCase(Locale.ROOT) + file.category.substring(1);
            else throw new IllegalArgumentException("Unsupported file action: " + action);
            Uri destination = childFolder(tree, root, folder);
            resulting = DocumentsContract.moveDocument(getContext().getContentResolver(), file.uri, file.parent, destination);
            if (resulting == null) throw new IllegalStateException("This Android storage provider cannot move the selected file.");
        }
        JSONObject record = new JSONObject();
        record.put("before", file.uri.toString()); record.put("after", resulting.toString());
        record.put("parent", file.parent.toString()); record.put("name", file.name); record.put("afterName", resultName);
        record.put("action", normalized);
        return record;
    }

    private Uri childFolder(Uri tree, Uri root, String name) throws Exception {
        Uri children = DocumentsContract.buildChildDocumentsUriUsingTree(tree, DocumentsContract.getDocumentId(root));
        String[] columns = {DocumentsContract.Document.COLUMN_DOCUMENT_ID, DocumentsContract.Document.COLUMN_DISPLAY_NAME,
                DocumentsContract.Document.COLUMN_MIME_TYPE};
        try (Cursor cursor = getContext().getContentResolver().query(children, columns, null, null, null)) {
            if (cursor != null) while (cursor.moveToNext()) {
                if (name.equals(cursor.getString(1)) && DocumentsContract.Document.MIME_TYPE_DIR.equals(cursor.getString(2)))
                    return DocumentsContract.buildDocumentUriUsingTree(tree, cursor.getString(0));
            }
        }
        Uri created = DocumentsContract.createDocument(getContext().getContentResolver(), root,
                DocumentsContract.Document.MIME_TYPE_DIR, name);
        if (created == null) throw new IllegalStateException("Could not create destination folder " + name);
        return created;
    }

    private void undoRecord(JSONObject record) throws Exception {
        Uri current = Uri.parse(record.optString("after"));
        Uri destinationParent = Uri.parse(record.optString("parent"));
        String action = record.optString("action");
        Uri restored = current;
        if (!"rename".equals(action)) {
            Uri currentParent = DocumentsContract.buildDocumentUriUsingTree(current,
                    DocumentsContract.getTreeDocumentId(current));
            // The SAF move API uses the actual current parent document, so find it from the action's destination folder.
            currentParent = findParent(current);
            restored = DocumentsContract.moveDocument(getContext().getContentResolver(), current, currentParent, destinationParent);
            if (restored == null) throw new IllegalStateException("Could not restore file to its original folder.");
        }
        String oldName = record.optString("name");
        if (!queryDisplayName(restored).equals(oldName)) {
            Uri renamed = DocumentsContract.renameDocument(getContext().getContentResolver(), restored, oldName);
            if (renamed == null) throw new IllegalStateException("File moved back, but its original name could not be restored.");
        }
    }

    private Uri findParent(Uri document) throws Exception {
        String documentId = DocumentsContract.getDocumentId(document);
        Uri tree = Uri.parse(rootTreeUri(document));
        Uri root = DocumentsContract.buildDocumentUriUsingTree(tree, DocumentsContract.getTreeDocumentId(tree));
        return findParentRecursive(tree, root, documentId, 0);
    }

    private Uri findParentRecursive(Uri tree, Uri parent, String targetId, int depth) throws Exception {
        if (depth > 100) return null;
        String parentId = DocumentsContract.getDocumentId(parent);
        Uri children = DocumentsContract.buildChildDocumentsUriUsingTree(tree, parentId);
        String[] columns = {DocumentsContract.Document.COLUMN_DOCUMENT_ID, DocumentsContract.Document.COLUMN_MIME_TYPE};
        try (Cursor cursor = getContext().getContentResolver().query(children, columns, null, null, null)) {
            if (cursor != null) while (cursor.moveToNext()) {
                String id = cursor.getString(0);
                Uri child = DocumentsContract.buildDocumentUriUsingTree(tree, id);
                if (targetId.equals(id)) return parent;
                if (DocumentsContract.Document.MIME_TYPE_DIR.equals(cursor.getString(1))) {
                    Uri found = findParentRecursive(tree, child, targetId, depth + 1);
                    if (found != null) return found;
                }
            }
        }
        return null;
    }

    @PluginMethod
    public void undoLatest(PluginCall call) {
        worker.execute(() -> {
            try {
                JSONArray history = savedHistory();
                if (history.length() == 0) { call.resolve(new JSObject().put("undone", false)); return; }
                JSONObject op = history.getJSONObject(history.length() - 1);
                JSONArray items = op.getJSONArray("items");
                for (int i = items.length() - 1; i >= 0; i--) undoRecord(items.getJSONObject(i));
                history.remove(history.length() - 1); saveHistory(history);
                call.resolve(new JSObject().put("undone", true).put("label", op.optString("label")));
            } catch (Exception error) { call.reject("Undo failed: " + error.getMessage(), "UNDO_FAILED", error); }
        });
    }

    private String rootTreeUri(Uri fileUri) throws Exception {
        JSONArray roots = savedRoots();
        String treeDocId = DocumentsContract.getTreeDocumentId(fileUri);
        for (int i = 0; i < roots.length(); i++) {
            JSONObject root = roots.optJSONObject(i);
            Uri tree = Uri.parse(root.optString("uri"));
            if (tree.getAuthority().equals(fileUri.getAuthority()) &&
                    DocumentsContract.getTreeDocumentId(tree).equals(treeDocId)) return tree.toString();
        }
        throw new SecurityException("This file is outside the folders selected in Sasha Maid.");
    }

    private String category(String name, String mime) {
        String ext = ""; int dot = name.lastIndexOf('.'); if (dot >= 0) ext = name.substring(dot + 1).toLowerCase(Locale.ROOT);
        if (mime.startsWith("image/") || hasExtension("jpg jpeg png gif webp heic bmp tif tiff svg", ext)) return "Images";
        if (mime.startsWith("video/") || hasExtension("mp4 mov mkv avi webm", ext)) return "Videos";
        if (mime.startsWith("audio/") || hasExtension("mp3 wav flac m4a ogg", ext)) return "Audio";
        if (hasExtension("pdf doc docx xls xlsx ppt pptx txt md csv", ext)) return "Documents";
        return "Other";
    }

    private boolean hasExtension(String extensions, String ext) {
        return !ext.isEmpty() && (" " + extensions + " ").contains(" " + ext + " ");
    }

    private String queryDisplayName(Uri uri) {
        try (Cursor cursor = getContext().getContentResolver().query(uri, new String[]{OpenableColumns.DISPLAY_NAME}, null, null, null)) {
            if (cursor != null && cursor.moveToFirst()) return cursor.getString(0);
        } catch (Exception ignored) { }
        return "Selected folder";
    }

    private JSONArray savedRoots() {
        String raw = getContext().getSharedPreferences(PREFS, 0).getString(ROOTS, "[]");
        try { return new JSONArray(raw); } catch (JSONException ignored) { return new JSONArray(); }
    }
    private void saveRoots(JSONArray roots) { getContext().getSharedPreferences(PREFS, 0).edit().putString(ROOTS, roots.toString()).apply(); }
    private JSONArray savedHistory() {
        String raw = getContext().getSharedPreferences(PREFS, 0).getString(HISTORY, "[]");
        try { return new JSONArray(raw); } catch (JSONException ignored) { return new JSONArray(); }
    }
    private void saveHistory(JSONArray history) { getContext().getSharedPreferences(PREFS, 0).edit().putString(HISTORY, history.toString()).apply(); }
}
