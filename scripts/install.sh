#!/usr/bin/env bash
set -euo pipefail

# Tino installer — downloads the latest release and installs to ~/.tino/
# Usage: curl -sSL https://raw.githubusercontent.com/ChoKhoOu/tino/main/scripts/install.sh | bash

REPO="ChoKhoOu/tino"
INSTALL_DIR="$HOME/.tino"
BIN_DIR="$INSTALL_DIR/bin"

# --- Colors ---
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
RESET='\033[0m'

info()  { printf "${CYAN}info${RESET}  %s\n" "$1"; }
warn()  { printf "${YELLOW}warn${RESET}  %s\n" "$1"; }
error() { printf "${RED}error${RESET} %s\n" "$1" >&2; }
success() { printf "${GREEN}✓${RESET} %s\n" "$1"; }

# --- Platform detection ---
detect_platform() {
  local os arch

  case "$(uname -s)" in
    Darwin) os="darwin" ;;
    Linux)  os="linux"  ;;
    *)
      error "Unsupported OS: $(uname -s)"
      error "Tino supports macOS (darwin) and Linux."
      exit 1
      ;;
  esac

  case "$(uname -m)" in
    arm64|aarch64) arch="arm64" ;;
    x86_64|amd64)  arch="x64"   ;;
    *)
      error "Unsupported architecture: $(uname -m)"
      error "Tino supports arm64 and x86_64."
      exit 1
      ;;
  esac

  # Linux arm64 is not currently built
  if [[ "$os" == "linux" && "$arch" == "arm64" ]]; then
    error "linux-arm64 is not currently supported."
    error "Supported platforms: darwin-arm64, darwin-x64, linux-x64"
    exit 1
  fi

  PLATFORM="${os}"
  ARCH="${arch}"
  ARTIFACT="tino-${PLATFORM}-${ARCH}"
}

# --- Check dependencies ---
check_deps() {
  if ! command -v curl &>/dev/null; then
    error "'curl' is required but not found. Please install curl first."
    exit 1
  fi

  if ! command -v tar &>/dev/null; then
    error "'tar' is required but not found. Please install tar first."
    exit 1
  fi
}

# --- Fetch latest release URL ---
fetch_release_url() {
  info "Fetching latest release..."

  local api_url="https://api.github.com/repos/${REPO}/releases/latest"
  local response

  response=$(curl -sSL -H "Accept: application/vnd.github+json" "$api_url") || {
    error "Failed to fetch release info from GitHub API."
    error "Check your internet connection or try again later."
    exit 1
  }

  # Extract the download URL for our platform's tarball
  TARBALL_URL=$(echo "$response" | grep -o "\"browser_download_url\": *\"[^\"]*${ARTIFACT}\.tar\.gz\"" | head -1 | cut -d'"' -f4)

  if [[ -z "$TARBALL_URL" ]]; then
    error "No release found for ${ARTIFACT}."
    error "Available platforms: darwin-arm64, darwin-x64, linux-x64"
    error "Check releases at: https://github.com/${REPO}/releases"
    exit 1
  fi

  # Extract version from the release tag
  VERSION=$(echo "$response" | grep -o '"tag_name": *"[^"]*"' | head -1 | cut -d'"' -f4)

  info "Found ${VERSION} for ${PLATFORM}-${ARCH}"
}

# --- Download and install ---
install_tino() {
  local tmpdir
  tmpdir=$(mktemp -d)
  trap 'rm -rf "$tmpdir"' EXIT

  info "Downloading ${ARTIFACT}.tar.gz..."
  curl -sSL -o "$tmpdir/tino.tar.gz" "$TARBALL_URL" || {
    error "Download failed."
    exit 1
  }

  info "Extracting..."
  tar -xzf "$tmpdir/tino.tar.gz" -C "$tmpdir" || {
    error "Extraction failed. The download may be corrupted."
    exit 1
  }

  # Create install directories
  mkdir -p "$BIN_DIR"

  # Install binary
  if [[ -f "$tmpdir/$ARTIFACT" ]]; then
    mv "$tmpdir/$ARTIFACT" "$BIN_DIR/tino"
    chmod +x "$BIN_DIR/tino"
    success "Installed binary to ${BIN_DIR}/tino"
  else
    error "Binary not found in archive. Expected: ${ARTIFACT}"
    exit 1
  fi

  # Install Python runtime + daemon
  if [[ -d "$tmpdir/python" ]]; then
    rm -rf "$BIN_DIR/python"
    mv "$tmpdir/python" "$BIN_DIR/python"
    success "Installed Python runtime to ${BIN_DIR}/python/"
  else
    warn "Python runtime not found in archive."
  fi
}

# --- Post-install checks ---
post_install_checks() {
  echo ""

  # Check PATH
  case ":${PATH}:" in
    *":${BIN_DIR}:"*)
      # Already in PATH
      ;;
    *)
      printf "${YELLOW}Warning${RESET}: ${BIN_DIR} is not in your PATH.\n"
      echo "  Add to your shell profile:"
      echo ""
      printf "    ${CYAN}export PATH=\"\$HOME/.tino/bin:\$PATH\"${RESET}\n"
      echo ""
      ;;
  esac
}

# --- Main ---
main() {
  echo ""
  printf "  ${BOLD}Tino Installer${RESET}\n"
  echo ""

  detect_platform
  check_deps
  fetch_release_url
  install_tino
  post_install_checks

  echo ""
  printf "  ${GREEN}${BOLD}Tino ${VERSION} installed successfully!${RESET}\n"
  echo ""
  echo "  Get started:"
  printf "    ${CYAN}export OPENAI_API_KEY=\"sk-...\"${RESET}\n"
  printf "    ${CYAN}tino${RESET}\n"
  echo ""
}

main
