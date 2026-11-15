#!/bin/bash
# Double-click on macOS (Finder) or run ./start-sasha-maid.sh in a terminal.
cd "$(dirname "$0")" || exit 1
echo
echo "  SASHA MAID — your desktop, tidied."
echo "  First run installs everything; later runs just open the app."
echo
PY=python3
command -v python3.12 >/dev/null 2>&1 && PY=python3.12
if ! command -v "$PY" >/dev/null 2>&1; then
  if [ "$(uname -s)" = "Linux" ]; then
    echo "  Python 3 is required. Install it with your package manager (e.g. sudo apt install python3 python3-venv)."
  elif [ "$(uname -s)" = "Darwin" ]; then
    echo "  Python 3 is required. Install it with: brew install python@3.12"
  else
    echo "  Python 3 is required and must be available on PATH."
  fi
  read -r -p "  Press Enter to close…"
  exit 1
fi
"$PY" scripts/desktop_setup.py "$@"
status=$?
if [ $status -ne 0 ]; then
  read -r -p "  Setup stopped (code $status). Press Enter to close…"
fi
exit $status