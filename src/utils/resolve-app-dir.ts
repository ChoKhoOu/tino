import { dirname } from 'path';

/**
 * Resolves the project root directory (containing `src/`, `python/`, etc.).
 * In compiled Bun binaries, `import.meta.dirname` returns a virtual `/$bunfs/` path
 * that doesn't exist on disk — falls back to `dirname(process.execPath)`.
 */
export function resolveAppDir(): string {
  const metaDir = import.meta.dirname;

  if (!metaDir || metaDir.startsWith('/$bunfs/')) {
    return dirname(process.execPath);
  }

  // File at <root>/src/utils/ — two levels up = project root
  return dirname(dirname(metaDir));
}

/**
 * Resolves the `src/` directory (or binary directory in compiled mode).
 * Used for tool discovery and other src-relative path resolution.
 */
export function resolveSrcDir(): string {
  const metaDir = import.meta.dirname;

  if (!metaDir || metaDir.startsWith('/$bunfs/')) {
    return dirname(process.execPath);
  }

  // File at <root>/src/utils/ — one level up = src/
  return dirname(metaDir);
}
