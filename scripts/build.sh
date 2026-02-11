#!/usr/bin/env bash
set -euo pipefail

# Usage:
#   bash scripts/build.sh                        # Build for current platform
#   bash scripts/build.sh --target bun-linux-x64 # Cross-compile for Linux x64

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

TARGET=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --target)
      TARGET="$2"
      shift 2
      ;;
    --target=*)
      TARGET="${1#*=}"
      shift
      ;;
    *)
      echo "Unknown option: $1"
      echo "Usage: bash scripts/build.sh [--target bun-darwin-arm64|bun-darwin-x64|bun-linux-x64]"
      exit 1
      ;;
  esac
done

if [[ -n "$TARGET" ]]; then
  PLATFORM="$(echo "$TARGET" | cut -d- -f2)"
  ARCH="$(echo "$TARGET" | cut -d- -f3)"
else
  case "$(uname -s)" in
    Darwin) PLATFORM="darwin" ;;
    Linux)  PLATFORM="linux"  ;;
    *)      echo "Unsupported OS: $(uname -s)"; exit 1 ;;
  esac
  case "$(uname -m)" in
    arm64|aarch64) ARCH="arm64" ;;
    x86_64)        ARCH="x64"   ;;
    *)             echo "Unsupported arch: $(uname -m)"; exit 1 ;;
  esac
fi

BINARY_NAME="tino-${PLATFORM}-${ARCH}"
DIST_DIR="$REPO_ROOT/dist"

echo "Building ${BINARY_NAME}..."

mkdir -p "$DIST_DIR"

BUILD_ARGS=(
  build
  --compile
  --minify
  src/index.tsx
  --outfile "$DIST_DIR/$BINARY_NAME"
  --external electron
  --external "chromium-bidi/lib/cjs/bidiMapper/BidiMapper"
  --external "chromium-bidi/lib/cjs/cdp/CdpConnection"
)

if [[ -n "$TARGET" ]]; then
  BUILD_ARGS+=(--target "$TARGET")
fi

bun "${BUILD_ARGS[@]}"

if [[ -d "$REPO_ROOT/python" ]]; then
  rm -rf "$DIST_DIR/python"
  cp -R "$REPO_ROOT/python" "$DIST_DIR/python"
  find "$DIST_DIR/python" -type d \( -name "__pycache__" -o -name ".venv" \) -exec rm -rf {} + 2>/dev/null || true
  echo "Copied python/ daemon source to dist/"
fi

BINARY_PATH="$DIST_DIR/$BINARY_NAME"
if [[ -f "$BINARY_PATH" ]]; then
  SIZE=$(du -sh "$BINARY_PATH" | cut -f1)
  echo ""
  echo "Build successful!"
  echo "  Binary: $BINARY_PATH"
  echo "  Size:   $SIZE"
else
  echo "Error: binary not found at $BINARY_PATH"
  exit 1
fi
