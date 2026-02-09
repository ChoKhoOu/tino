/**
 * `tino init <project-name>` — Scaffold a new Tino trading project.
 *
 * Creates directory structure, Python venv via `uv`, and installs NautilusTrader.
 * This is a one-shot CLI command (not interactive Ink).
 */
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { join, resolve } from 'path';

// ─── Templates ──────────────────────────────────────────────────────────────

export function generatePyprojectToml(projectName: string): string {
  return `[project]
name = "${projectName}"
version = "0.1.0"
description = "Tino trading project"
requires-python = ">=3.10,<3.13"
dependencies = [
    "nautilus_trader>=1.200.0",
]

[build-system]
requires = ["hatchling"]
build-backend = "hatchling.build"
`;
}

export function generateSettingsJson(): string {
  return JSON.stringify({ provider: 'openai' }, null, 2) + '\n';
}

export function generateGitignore(): string {
  return `# Tino
.tino/.venv/
.tino/daemon.pid
data/
backtests/

# Python
__pycache__/
*.py[cod]
*.egg-info/
.venv/

# OS
.DS_Store
`;
}

// ─── Directory structure ────────────────────────────────────────────────────

export interface ScaffoldResult {
  projectDir: string;
  directories: string[];
  files: Array<{ path: string; content: string }>;
}

/**
 * Compute the scaffold plan (directories + files) without writing anything.
 * Useful for testing template content independently of filesystem.
 */
export function planScaffold(projectName: string, baseDir: string = process.cwd()): ScaffoldResult {
  const projectDir = resolve(baseDir, projectName);

  const directories = [
    'strategies',
    'data/catalog',
    'backtests',
    '.tino/scratchpad',
  ];

  const files: Array<{ path: string; content: string }> = [
    { path: 'pyproject.toml', content: generatePyprojectToml(projectName) },
    { path: '.tino/settings.json', content: generateSettingsJson() },
    { path: '.gitignore', content: generateGitignore() },
  ];

  return { projectDir, directories, files };
}

/**
 * Write the scaffold to disk (directories + files).
 * Throws if project directory already exists.
 */
export function writeScaffold(scaffold: ScaffoldResult): void {
  const { projectDir, directories, files } = scaffold;

  if (existsSync(projectDir)) {
    throw new Error(`Directory "${projectDir}" already exists.`);
  }

  // Create project root + all subdirectories
  mkdirSync(projectDir, { recursive: true });
  for (const dir of directories) {
    mkdirSync(join(projectDir, dir), { recursive: true });
  }

  // Write template files
  for (const file of files) {
    writeFileSync(join(projectDir, file.path), file.content);
  }
}

// ─── Python environment setup ───────────────────────────────────────────────

interface SpawnResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

/**
 * Run a command via Bun.spawn and capture output.
 */
async function runCommand(
  cmd: string[],
  cwd: string,
  env?: Record<string, string>,
): Promise<SpawnResult> {
  const proc = Bun.spawn(cmd, {
    cwd,
    env: { ...(process.env as Record<string, string>), ...env },
    stdout: 'pipe',
    stderr: 'pipe',
  });

  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);

  return { exitCode, stdout, stderr };
}

/**
 * Detect if Python 3.12 is available via `uv`.
 */
export async function detectPython(): Promise<{ available: boolean; version?: string; error?: string }> {
  try {
    const result = await runCommand(['uv', 'python', 'find', '3.12'], process.cwd());
    if (result.exitCode === 0 && result.stdout.trim()) {
      return { available: true, version: result.stdout.trim() };
    }
    return { available: false, error: 'Python 3.12 not found. Install via: uv python install 3.12' };
  } catch {
    return { available: false, error: '`uv` not found. Install from: https://docs.astral.sh/uv/' };
  }
}

/**
 * Create Python venv in .tino/.venv/ via `uv venv`.
 */
export async function createVenv(projectDir: string): Promise<SpawnResult> {
  const venvDir = join(projectDir, '.tino', '.venv');
  return runCommand(['uv', 'venv', '--python', '3.12', venvDir], projectDir);
}

/**
 * Install NautilusTrader in the project venv via `uv pip install`.
 */
export async function installDeps(projectDir: string): Promise<SpawnResult> {
  const venvDir = join(projectDir, '.tino', '.venv');
  return runCommand(
    ['uv', 'pip', 'install', '--python', join(venvDir, 'bin', 'python'), 'nautilus_trader>=1.200.0'],
    projectDir,
  );
}

// ─── Main init orchestrator ─────────────────────────────────────────────────

interface InitProgress {
  step: string;
  detail?: string;
}

type ProgressCallback = (progress: InitProgress) => void;

export interface InitOptions {
  projectName: string;
  baseDir?: string;
  onProgress?: ProgressCallback;
  /** Skip Python venv creation (for testing) */
  skipPython?: boolean;
}

export interface InitResult {
  success: boolean;
  projectDir: string;
  error?: string;
}

/**
 * Full init flow: scaffold → detect Python → create venv → install deps.
 */
export async function initProject(options: InitOptions): Promise<InitResult> {
  const { projectName, baseDir, onProgress, skipPython } = options;

  // Validate project name
  if (!projectName || !/^[a-zA-Z0-9_-]+$/.test(projectName)) {
    return {
      success: false,
      projectDir: '',
      error: 'Invalid project name. Use only letters, numbers, hyphens, and underscores.',
    };
  }

  const notify = onProgress ?? (() => {});

  // 1. Scaffold directories and files
  notify({ step: 'scaffold', detail: 'Creating project structure...' });
  const scaffold = planScaffold(projectName, baseDir);
  try {
    writeScaffold(scaffold);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, projectDir: scaffold.projectDir, error: msg };
  }

  if (skipPython) {
    return { success: true, projectDir: scaffold.projectDir };
  }

  // 2. Detect Python 3.12
  notify({ step: 'python', detail: 'Detecting Python 3.12...' });
  const python = await detectPython();
  if (!python.available) {
    return {
      success: false,
      projectDir: scaffold.projectDir,
      error: python.error ?? 'Python 3.12 not available.',
    };
  }
  notify({ step: 'python', detail: `Found Python at ${python.version}` });

  // 3. Create venv
  notify({ step: 'venv', detail: 'Creating Python virtual environment...' });
  const venvResult = await createVenv(scaffold.projectDir);
  if (venvResult.exitCode !== 0) {
    return {
      success: false,
      projectDir: scaffold.projectDir,
      error: `Failed to create venv: ${venvResult.stderr.trim()}`,
    };
  }

  // 4. Install NautilusTrader
  notify({ step: 'install', detail: 'Installing NautilusTrader (this may take a minute)...' });
  const installResult = await installDeps(scaffold.projectDir);
  if (installResult.exitCode !== 0) {
    return {
      success: false,
      projectDir: scaffold.projectDir,
      error: `Failed to install dependencies: ${installResult.stderr.trim()}`,
    };
  }

  notify({ step: 'done', detail: 'Project initialized successfully!' });
  return { success: true, projectDir: scaffold.projectDir };
}

// ─── CLI entry point (called from src/index.tsx) ────────────────────────────

/**
 * Handle `tino init <project-name>` from the command line.
 * Prints progress to stdout and exits with appropriate code.
 */
export async function runInitCommand(args: string[]): Promise<void> {
  const projectName = args[0];

  if (!projectName) {
    console.error('Usage: tino init <project-name>');
    process.exit(1);
  }

  console.log(`\n  🚀 Initializing Tino project: ${projectName}\n`);

  const result = await initProject({
    projectName,
    onProgress: ({ step, detail }) => {
      const icons: Record<string, string> = {
        scaffold: '📁',
        python: '🐍',
        venv: '🔧',
        install: '📦',
        done: '✅',
      };
      const icon = icons[step] ?? '•';
      if (detail) {
        console.log(`  ${icon} ${detail}`);
      }
    },
  });

  if (!result.success) {
    console.error(`\n  ❌ Error: ${result.error}\n`);
    process.exit(1);
  }

  console.log(`\n  Project created at: ${result.projectDir}`);
  console.log(`\n  Next steps:`);
  console.log(`    cd ${projectName}`);
  console.log(`    tino\n`);
}
