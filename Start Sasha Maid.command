#!/bin/bash
# macOS: double-click this file in Finder. Keep it in the Sasha Maid folder.
cd "$(dirname "$0")" || exit 1
echo
echo "  SASHA MAID — your desktop, tidied."
echo "  First run installs everything; later runs just open the app."
echo
PY=python3
command -v python3.12 >/dev/null 2>&1 && PY=python3.12
if ! command -v "$PY" >/dev/null 2>&1; then
  echo "  Python 3 is required. Install it with:  brew install python@3.12"
  read -r -p "  Press Enter to close…"
  exit 1
fi
"$PY" scripts/desktop_setup.py "$@"
status=$?
if [ $status -ne 0 ]; then
  read -r -p "  Setup stopped (code $status). Press Enter to close…"
fi
exit $status