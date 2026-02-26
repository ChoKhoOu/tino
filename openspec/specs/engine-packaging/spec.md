# Capability: Engine Packaging

## Purpose

Provides a self-contained Python runtime and pre-installed dependencies for the engine, enabling zero-dependency distribution without requiring users to have Python installed.

## Requirements

### Requirement: Self-contained Python runtime
The engine distribution SHALL include a complete Python 3.12 runtime from python-build-standalone (`aarch64-apple-darwin` variant) so that no system Python installation is required.

#### Scenario: Running on a machine with no Python installed
- **WHEN** the tino CLI spawns the engine using the packaged Python
- **THEN** the engine starts successfully using the bundled Python runtime at `engine/.packaged/python/bin/python3`

### Requirement: Pre-installed dependencies
The engine distribution SHALL include all Python dependencies pre-installed in a bundled virtual environment, including `nautilus_trader[binance]`, `fastapi`, `uvicorn[standard]`, `pydantic`, and `aiosqlite`.

#### Scenario: Engine starts without pip install
- **WHEN** the CLI spawns the engine after a fresh build
- **THEN** all imports in `engine/src/` resolve successfully from `engine/.packaged/venv/lib/python3.12/site-packages/` without any runtime package installation

### Requirement: Build script produces packaged engine
A build script SHALL automate the packaging process: download python-build-standalone, create venv, install all dependencies from `pyproject.toml`, and produce the `engine/.packaged/` directory.

#### Scenario: Running the packaging build script
- **WHEN** the developer runs the engine packaging script
- **THEN** it downloads `cpython-3.12.x-aarch64-apple-darwin-install_only_stripped.tar.gz`, extracts to `engine/.packaged/python/`, creates a venv at `engine/.packaged/venv/`, and installs all dependencies

#### Scenario: Build script is idempotent
- **WHEN** the packaging script runs a second time with an existing `engine/.packaged/` directory
- **THEN** it detects the existing installation and either skips or cleanly rebuilds without leaving corrupt state

### Requirement: Packaged engine directory layout
The packaged engine SHALL follow this directory structure:
```
engine/.packaged/
  python/           # python-build-standalone extraction
    bin/python3
    lib/
  venv/             # Virtual environment using packaged Python
    bin/python3     # Symlink to packaged Python
    lib/python3.12/site-packages/  # All dependencies
```

#### Scenario: CLI locates packaged Python path
- **WHEN** the CLI needs to spawn the engine
- **THEN** it resolves the Python path as `<engineDir>/.packaged/venv/bin/python3`

### Requirement: macOS ARM64 primary target
The packaging build script SHALL target macOS ARM64 (Apple Silicon) as the primary platform. Intel (x86_64) MAY be supported as a secondary target in the same script with architecture detection.

#### Scenario: Building on Apple Silicon Mac
- **WHEN** the packaging script runs on an ARM64 Mac
- **THEN** it downloads the `aarch64-apple-darwin` python-build-standalone variant and installs ARM64-native wheels

#### Scenario: Building on Intel Mac
- **WHEN** the packaging script runs on an x86_64 Mac
- **THEN** it downloads the `x86_64-apple-darwin` python-build-standalone variant and installs x86_64-native wheels

### Requirement: Packaged directory excluded from git
The `engine/.packaged/` directory SHALL be listed in `.gitignore` to prevent committing ~300-500MB of binaries to the repository.

#### Scenario: Git status after packaging
- **WHEN** the developer runs `git status` after building the packaged engine
- **THEN** the `engine/.packaged/` directory does not appear as untracked or modified
