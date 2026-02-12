import { resolve } from 'node:path';

export function parseFileReferences(text: string): string[] {
  const matches = text.match(/@([^\s]+)/g);
  if (!matches) return [];
  return matches.map((m) => m.slice(1));
}

export async function resolveFileReferences(text: string, cwd: string = process.cwd()): Promise<string> {
  let result = text;
  const refs = parseFileReferences(text);

  const uniqueRefs = [...new Set(refs)];

  for (const ref of uniqueRefs) {
    const filePath = resolve(cwd, ref);
    let content = '';
    try {
      const file = Bun.file(filePath);
      if (await file.exists()) {
        const textContent = await file.text();
        if (file.size > 1024 * 1024) {
          content = `\n--- ${ref} (TRUNCATED: >1MB) ---\n`;
        } else {
          content = `\n--- ${ref} ---\n${textContent}\n--- end ---\n`;
        }
      } else {
        content = `\n[Error reading ${ref}: File not found]\n`;
      }
    } catch (error) {
      content = `\n[Error reading ${ref}: ${(error as Error).message}]\n`;
    }

    const escapedRef = ref.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    result = result.replace(new RegExp(`@${escapedRef}(?=\\s|$)`, 'g'), content);
  }

  return result;
}

export async function scanFiles(query: string, cwd: string = process.cwd()): Promise<string[]> {
  const pattern = `**/*${query}*`;
  const glob = new Bun.Glob(pattern);
  const results: string[] = [];
  const EXCLUDED = ['.git', 'node_modules'];

  try {
    for await (const path of glob.scan({ cwd, absolute: false })) {
      if (EXCLUDED.some(ex => path.includes(ex))) continue;
      results.push(path);
      if (results.length >= 10) break;
    }
  } catch {
    return [];
  }
  
  return results.sort();
}
