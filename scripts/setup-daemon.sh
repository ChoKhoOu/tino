#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PYTHON_DIR="$REPO_ROOT/python"
RUNTIME_DIR="$PYTHON_DIR/runtime"

if [[ -x "$RUNTIME_DIR/bin/python3.12" ]]; then
  echo "Python runtime already exists at $RUNTIME_DIR"
  echo "To rebuild, run: rm -rf $RUNTIME_DIR && $0"
  exit 0
fi

if ! command -v uv &>/dev/null; then
  echo "Error: uv is required. Install it: curl -LsSf https://astral.sh/uv/install.sh | sh"
  exit 1
fi

echo "Downloading standalone Python 3.12..."
uv python install 3.12
UV_PYTHON=$(uv python find 3.12)
UV_PYTHON_ROOT=$(dirname "$(dirname "$UV_PYTHON")")

mkdir -p "$RUNTIME_DIR"
cp -R "$UV_PYTHON_ROOT/." "$RUNTIME_DIR/"

BUNDLED_PYTHON="$RUNTIME_DIR/bin/python3.12"

echo "Installing Python dependencies..."
"$BUNDLED_PYTHON" -m ensurepip --upgrade 2>/dev/null || true
rm -f "$RUNTIME_DIR/lib/python3.12/EXTERNALLY-MANAGED"
"$BUNDLED_PYTHON" -m pip install "$PYTHON_DIR" --no-cache-dir

rm -rf "$RUNTIME_DIR/include" "$RUNTIME_DIR/share"

# Pre-compile all .pyc bytecode to eliminate cold-start compilation penalty
# Uses unchecked-hash since timestamps may shift during cp -R of relocatable runtime
echo "Pre-compiling Python bytecode..."
find "$RUNTIME_DIR" -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true
"$BUNDLED_PYTHON" -m compileall -q -j0 --invalidation-mode unchecked-hash \
  "$RUNTIME_DIR/lib" "$PYTHON_DIR/tino_daemon" 2>/dev/null || true

RUNTIME_SIZE=$(du -sh "$RUNTIME_DIR" | cut -f1)
echo ""
echo "Done! Python runtime ready (${RUNTIME_SIZE})"
echo "Daemon will now start instantly."
