#!/usr/bin/env python3
"""Static checks for Android wiring and its scoped-storage safety contract."""
from pathlib import Path
import json
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
checks: list[tuple[str, bool]] = []

def check(label: str, passed: bool) -> None:
    checks.append((label, passed))

package = json.loads((ROOT / "package.json").read_text())
config = (ROOT / "capacitor.config.ts").read_text()
manifest = ET.parse(ROOT / "android/app/src/main/AndroidManifest.xml").getroot()
plugin = (ROOT / "android/app/src/main/java/com/cmckhmer/sashamaid/FileAccessPlugin.java").read_text()
activity = (ROOT / "android/app/src/main/java/com/cmckhmer/sashamaid/MainActivity.java").read_text()
mobile_ui = (ROOT / "src/views/LiveAndroid.tsx").read_text()
router = (ROOT / "src/views/Live.tsx").read_text()
permissions = {node.attrib.get("{http://schemas.android.com/apk/res/android}name") for node in manifest.findall("uses-permission")}

check("Capacitor Android runtime configured", "@capacitor/android" in package["dependencies"] and "com.cmckhmer.sashamaid" in config)
check("APK build and device-install tasks declared", "android:apk" in package["scripts"] and "android:install" in package["scripts"] and (ROOT / "android/gradlew").exists())
check("native SAF plugin registered", "registerPlugin(FileAccessPlugin.class)" in activity and '@CapacitorPlugin(name = "FileAccess")' in plugin)
check("Android system folder picker and persisted grant", "ACTION_OPEN_DOCUMENT_TREE" in plugin and "takePersistableUriPermission" in plugin)
check("scan reads through granted DocumentsProvider", "buildChildDocumentsUriUsingTree" in plugin and "openInputStream" in plugin)
check("native Android media preview is bounded", "public void preview(PluginCall call)" in plugin and "MAX_PREVIEW_BYTES" in plugin and "openPreview" in mobile_ui)
check("mutations are explicit and undoable", "window.confirm" in mobile_ui and "undoLatest" in plugin and "moveDocument" in plugin)
check("permanent delete requires an explicit phrase", 'DELETE PERMANENTLY' in mobile_ui and "deleteDocument" in plugin)
check("native scans skip sensitive names", "isSensitiveName" in plugin and '".ssh"' in plugin and '".env"' in plugin)
check("Live screen routes to native Android implementation", "Capacitor.getPlatform() === \"android\"" in router and "LiveAndroid" in router)
check("no broad all-files storage permission", not any("MANAGE_EXTERNAL_STORAGE" in permission or "READ_EXTERNAL_STORAGE" in permission or "WRITE_EXTERNAL_STORAGE" in permission for permission in permissions))

for label, passed in checks:
    print(f"{'PASS' if passed else 'FAIL'}  {label}")
print(f"\n{sum(ok for _, ok in checks)}/{len(checks)} Android integration checks passed")
raise SystemExit(0 if all(ok for _, ok in checks) else 1)
