import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';

describe('root-finder', () => {
  async function loadModule() {
    vi.resetModules();
    return await import('../root-finder.js');
  }

  describe('findMonorepoRoot', () => {
    it('finds the root from a nested directory', async () => {
      const { findMonorepoRoot } = await loadModule();
      // __dirname is inside packages/cli/src/daemon/__tests__ which is within the monorepo
      const root = findMonorepoRoot(__dirname);
      const rootPkg = path.join(root, 'package.json');
      const pkg = JSON.parse(await import('node:fs').then((m) => m.readFileSync(rootPkg, 'utf-8')));
      expect(pkg.name).toBe('tino');
    });

    it('throws when started from /tmp (no tino project there)', async () => {
      const { findMonorepoRoot } = await loadModule();
      expect(() => findMonorepoRoot('/tmp')).toThrow(
        'Could not find monorepo root',
      );
    });
  });

  describe('resolveEnginePaths', () => {
    let tmpRoot: string;

    beforeEach(() => {
      tmpRoot = path.join(os.tmpdir(), `tino-root-test-${process.pid}-${Date.now()}`);
      mkdirSync(tmpRoot, { recursive: true });
      // Clean env overrides
      delete process.env.TINO_ENGINE_DIR;
      delete process.env.TINO_DASHBOARD_DIST;
    });

    afterEach(() => {
      delete process.env.TINO_ENGINE_DIR;
      delete process.env.TINO_DASHBOARD_DIST;
      try {
        rmSync(tmpRoot, { recursive: true, force: true });
      } catch {
        // ignore
      }
    });

    it('throws when neither packaged nor dev python exists', async () => {
      const { resolveEnginePaths } = await loadModule();
      expect(() => resolveEnginePaths(tmpRoot)).toThrow(
        /Python not found at .+ Run 'npm run package' to set up the engine\./,
      );
    });

    it('returns correct engineDir, pythonPath, dashboardDist when dev python exists', async () => {
      const { resolveEnginePaths } = await loadModule();
      const devPythonDir = path.join(tmpRoot, 'engine', '.venv', 'bin');
      mkdirSync(devPythonDir, { recursive: true });
      writeFileSync(path.join(devPythonDir, 'python'), '');

      const result = resolveEnginePaths(tmpRoot);

      expect(result.engineDir).toBe(path.join(tmpRoot, 'engine'));
      expect(result.pythonPath).toBe(path.join(devPythonDir, 'python'));
      expect(result.dashboardDist).toBeUndefined();
    });

    it('respects TINO_ENGINE_DIR env var override', async () => {
      const customEngine = path.join(tmpRoot, 'custom-engine');
      const customPythonDir = path.join(customEngine, '.venv', 'bin');
      mkdirSync(customPythonDir, { recursive: true });
      writeFileSync(path.join(customPythonDir, 'python'), '');
      process.env.TINO_ENGINE_DIR = customEngine;

      const { resolveEnginePaths } = await loadModule();
      const result = resolveEnginePaths(tmpRoot);

      expect(result.engineDir).toBe(customEngine);
    });

    it('respects TINO_DASHBOARD_DIST env var override', async () => {
      // Create dev python so resolveEnginePaths doesn't throw
      const devPythonDir = path.join(tmpRoot, 'engine', '.venv', 'bin');
      mkdirSync(devPythonDir, { recursive: true });
      writeFileSync(path.join(devPythonDir, 'python'), '');

      const customDist = path.join(tmpRoot, 'custom-dist');
      mkdirSync(customDist, { recursive: true });
      process.env.TINO_DASHBOARD_DIST = customDist;

      const { resolveEnginePaths } = await loadModule();
      const result = resolveEnginePaths(tmpRoot);

      expect(result.dashboardDist).toBe(customDist);
    });

    it('returns undefined dashboardDist when dist dir does not exist', async () => {
      // Create dev python so resolveEnginePaths doesn't throw
      const devPythonDir = path.join(tmpRoot, 'engine', '.venv', 'bin');
      mkdirSync(devPythonDir, { recursive: true });
      writeFileSync(path.join(devPythonDir, 'python'), '');

      const { resolveEnginePaths } = await loadModule();
      const result = resolveEnginePaths(tmpRoot);

      expect(result.dashboardDist).toBeUndefined();
    });
  });
});
