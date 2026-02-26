#!/usr/bin/env bash
set -euo pipefail

# Configuration
PYTHON_VERSION="3.12"
PYTHON_BUILD_STANDALONE_TAG="20260211"  # Latest stable release tag
PACKAGED_DIR="engine/.packaged"
PYTHON_DIR="${PACKAGED_DIR}/python"
VENV_DIR="${PACKAGED_DIR}/venv"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
cd "${PROJECT_ROOT}"

# Detect architecture
ARCH="$(uname -m)"
case "${ARCH}" in
    arm64|aarch64)
        PLATFORM="aarch64-apple-darwin"
        ;;
    x86_64)
        PLATFORM="x86_64-apple-darwin"
        ;;
    *)
        echo "Error: Unsupported architecture: ${ARCH}"
        exit 1
        ;;
esac

echo "==> Platform: ${PLATFORM}"

# Idempotency check
if [ -f "${PYTHON_DIR}/bin/python3" ]; then
    EXISTING_VERSION=$("${PYTHON_DIR}/bin/python3" --version 2>&1 | awk '{print $2}')
    if [[ "${EXISTING_VERSION}" == ${PYTHON_VERSION}* ]]; then
        echo "==> Python ${EXISTING_VERSION} already installed at ${PYTHON_DIR}, skipping download"
    else
        echo "==> Found Python ${EXISTING_VERSION} but need ${PYTHON_VERSION}, rebuilding..."
        rm -rf "${PACKAGED_DIR}"
    fi
fi

# Download python-build-standalone if needed
if [ ! -f "${PYTHON_DIR}/bin/python3" ]; then
    echo "==> Downloading python-build-standalone for ${PLATFORM}..."

    # Resolve the full CPython patch version for our PYTHON_VERSION
    # Query the GitHub release to find the exact filename
    RELEASE_URL="https://github.com/astral-sh/python-build-standalone/releases/expanded_assets/${PYTHON_BUILD_STANDALONE_TAG}"
    echo "==> Looking up available CPython ${PYTHON_VERSION}.x builds..."

    # Find the exact tarball name matching our version and platform
    TARBALL_PATTERN="cpython-${PYTHON_VERSION}.*+${PYTHON_BUILD_STANDALONE_TAG}-${PLATFORM}-install_only_stripped.tar.gz"
    TARBALL=$(curl -fsSL "${RELEASE_URL}" | grep -oE "cpython-${PYTHON_VERSION}\.[0-9]+\+${PYTHON_BUILD_STANDALONE_TAG}-${PLATFORM}-install_only_stripped\.tar\.gz" | head -1)

    if [ -z "${TARBALL}" ]; then
        echo "Error: Could not find a CPython ${PYTHON_VERSION}.x build for ${PLATFORM} in release ${PYTHON_BUILD_STANDALONE_TAG}"
        echo "Browse releases: https://github.com/astral-sh/python-build-standalone/releases"
        exit 1
    fi

    DOWNLOAD_URL="https://github.com/astral-sh/python-build-standalone/releases/download/${PYTHON_BUILD_STANDALONE_TAG}/${TARBALL}"
    echo "==> Downloading ${TARBALL}..."

    mkdir -p "${PACKAGED_DIR}"
    TEMP_FILE=$(mktemp)

    if ! curl -fSL --progress-bar -o "${TEMP_FILE}" "${DOWNLOAD_URL}"; then
        echo "Error: Failed to download ${DOWNLOAD_URL}"
        echo "Check if the release tag and Python version are correct."
        echo "Browse releases: https://github.com/astral-sh/python-build-standalone/releases"
        rm -f "${TEMP_FILE}"
        exit 1
    fi

    echo "==> Extracting Python to ${PYTHON_DIR}..."
    # The archive contains a top-level python/ directory
    tar xzf "${TEMP_FILE}" -C "${PACKAGED_DIR}"
    rm -f "${TEMP_FILE}"

    echo "==> Python extracted: $("${PYTHON_DIR}/bin/python3" --version)"
fi

# Create venv if needed
if [ ! -f "${VENV_DIR}/bin/python3" ]; then
    echo "==> Creating virtual environment at ${VENV_DIR}..."
    "${PYTHON_DIR}/bin/python3" -m venv "${VENV_DIR}"
fi

# Install/update dependencies
echo "==> Installing engine dependencies..."
"${VENV_DIR}/bin/pip" install --upgrade pip --quiet
"${VENV_DIR}/bin/pip" install -e ./engine --quiet

echo ""
echo "==> Engine packaging complete!"
echo "    Python: ${PYTHON_DIR}/bin/python3"
echo "    Venv:   ${VENV_DIR}/bin/python3"
echo "    To start engine: ${VENV_DIR}/bin/python -m uvicorn src.main:app --host 127.0.0.1 --port 8000"
