import { pathToFileURL } from 'url';
import { extname } from 'path';
import type { LspManager } from '@/lsp/lsp-manager.js';

let manager: LspManager | null = null;

const MAX_DISPLAYED = 10;
const SEVERITY_ERROR = 1;

const EXTENSION_TO_LANGUAGE: Record<string, string> = {
  '.ts': 'typescript', '.tsx': 'typescriptreact', '.js': 'javascript', '.jsx': 'javascriptreact',
  '.mjs': 'javascript', '.cjs': 'javascript', '.py': 'python',
};

interface DiagnosticItem {
  range: { start: { line: number; character: number } };
  message: string;
  severity: number;
}

interface PullDiagnosticsResult {
  items?: DiagnosticItem[];
}

export function configureLspDiagnostics(m: LspManager): void {
  manager = m;
}

export function resetLspDiagnostics(): void {
  manager = null;
}

function detectLanguage(filePath: string): string {
  return EXTENSION_TO_LANGUAGE[extname(filePath).toLowerCase()] ?? 'plaintext';
}

function formatDiagnostics(errors: DiagnosticItem[]): string {
  if (errors.length === 0) return '';

  const label = errors.length === 1 ? '1 error' : `${errors.length} errors`;
  const displayed = errors.slice(0, MAX_DISPLAYED);
  const lines = displayed.map((d) => `  line ${d.range.start.line + 1}: ${d.message}`);

  if (errors.length > MAX_DISPLAYED) {
    lines.push(`  ... and ${errors.length - MAX_DISPLAYED} more`);
  }

  return `\n\nLSP Diagnostics (${label}):\n${lines.join('\n')}`;
}

export async function getPostEditDiagnostics(filePath: string, content: string): Promise<string> {
  try {
    if (!manager) return '';

    const client = await manager.getClientForFile(filePath);
    if (!client) return '';

    const uri = pathToFileURL(filePath).toString();
    const languageId = detectLanguage(filePath);

    await client.didOpen(uri, languageId, content);

    const response = await client.request('textDocument/diagnostic', {
      textDocument: { uri },
    }) as PullDiagnosticsResult | null;

    if (!response?.items) return '';

    const errors = response.items.filter((d) => d.severity === SEVERITY_ERROR);
    return formatDiagnostics(errors);
  } catch {
    return '';
  }
}
