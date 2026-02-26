import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

interface PackageJson {
  name?: string;
}

export function findMonorepoRoot(startDir?: string): string {
  const start = startDir || path.dirname(fileURLToPath(import.meta.url));
  let dir = path.resolve(start);

  while (true) {
    const pkgPath = path.join(dir, 'package.json');
    if (existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8')) as PackageJson;
        if (pkg.name === 'tino') {
          return dir;
        }
      } catch {
        // Invalid JSON — skip
      }
    }

    const parent = path.dirname(dir);
    if (parent === dir) {
      throw new Error(
        'Could not find monorepo root (package.json with name "tino")',
      );
    }
    dir = parent;
  }
}

export interface EnginePaths {
  engineDir: string;
  pythonPath: string;
  dashboardDist?: string;
}

export function resolveEnginePaths(root: string): EnginePaths {
  const engineDir = process.env.TINO_ENGINE_DIR || path.join(root, 'engine');

  // Prefer packaged venv, fall back to dev .venv
  const packagedPython = path.join(engineDir, '.packaged', 'venv', 'bin', 'python3');
  const devPython = path.join(engineDir, '.venv', 'bin', 'python');
  const pythonPath = existsSync(packagedPython) ? packagedPython : devPython;

  if (!existsSync(pythonPath)) {
    throw new Error(
      `Python not found at ${packagedPython} or ${devPython}. Run 'npm run package' to set up the engine.`
    );
  }

  const dashboardDistDir =
    process.env.TINO_DASHBOARD_DIST || path.join(root, 'packages', 'dashboard', 'dist');
  const dashboardDist = existsSync(dashboardDistDir) ? dashboardDistDir : undefined;

  return { engineDir, pythonPath, dashboardDist };
}
