import { z } from 'zod';
import { pathToFileURL } from 'url';
import { definePlugin } from '@/domain/index.js';
import type { LspManager } from '@/lsp/lsp-manager.js';

let manager: LspManager | null = null;
export function configureLspTool(m: LspManager) { manager = m; }

const POSITION_ACTIONS = new Set(['goto_definition', 'find_references', 'hover']);

const SYMBOL_KIND_MAP: Record<number, string> = {
  1: 'File', 2: 'Module', 3: 'Namespace', 4: 'Package', 5: 'Class',
  6: 'Method', 7: 'Property', 8: 'Field', 9: 'Constructor', 10: 'Enum',
  11: 'Interface', 12: 'Function', 13: 'Variable', 14: 'Constant',
  15: 'String', 16: 'Number', 17: 'Boolean', 18: 'Array', 19: 'Object',
  20: 'Key', 21: 'Null', 22: 'EnumMember', 23: 'Struct', 24: 'Event',
  25: 'Operator', 26: 'TypeParameter',
};

type Location = { uri: string; range: { start: { line: number; character: number } } };
type Symbol = { name: string; kind: number; range: { start: { line: number; character: number } } };
type HoverContents = string | { kind?: string; value: string } | { language: string; value: string };

const schema = z.object({
  action: z.enum(['goto_definition', 'find_references', 'hover', 'document_symbols', 'diagnostics']),
  filePath: z.string().describe('Absolute path to the file'),
  line: z.number().optional().describe('1-indexed line number'),
  character: z.number().optional().describe('0-indexed character offset'),
  query: z.string().optional().describe('Search query for workspace symbols'),
});

function formatLocation(loc: Location): string {
  const path = loc.uri.startsWith('file://') ? loc.uri.slice(7) : loc.uri;
  return `${path}:${loc.range.start.line + 1}:${loc.range.start.character + 1}`;
}

function extractHoverText(contents: HoverContents): string {
  if (typeof contents === 'string') return contents;
  if ('value' in contents) return contents.value;
  return JSON.stringify(contents);
}

async function handleDefinition(uri: string, line: number, char: number, client: { definition: (u: string, l: number, c: number) => Promise<unknown | null> }): Promise<string> {
  const result = await client.definition(uri, line, char);
  if (!result) return 'No definition found';
  const locations = Array.isArray(result) ? result as Location[] : [result as Location];
  if (locations.length === 1) return `Definition found at ${formatLocation(locations[0])}`;
  return `Found ${locations.length} definitions:\n${locations.map(l => `  ${formatLocation(l)}`).join('\n')}`;
}

async function handleReferences(uri: string, line: number, char: number, client: { references: (u: string, l: number, c: number) => Promise<unknown | null> }): Promise<string> {
  const result = await client.references(uri, line, char);
  if (!result || (Array.isArray(result) && result.length === 0)) return 'No references found';
  const refs = result as Location[];
  return `Found ${refs.length} references:\n${refs.map(r => `  ${formatLocation(r)}`).join('\n')}`;
}

async function handleHover(uri: string, line: number, char: number, client: { hover: (u: string, l: number, c: number) => Promise<unknown | null> }): Promise<string> {
  const result = await client.hover(uri, line, char) as { contents: HoverContents } | null;
  if (!result) return 'No hover information available';
  return extractHoverText(result.contents);
}

async function handleDocumentSymbols(uri: string, client: { documentSymbol: (u: string) => Promise<unknown | null> }): Promise<string> {
  const result = await client.documentSymbol(uri);
  if (!result || (Array.isArray(result) && result.length === 0)) return 'No symbols found';
  const symbols = result as Symbol[];
  const lines = symbols.map(s => {
    const kind = SYMBOL_KIND_MAP[s.kind] ?? `kind:${s.kind}`;
    return `  ${s.name} (${kind}) at line ${s.range.start.line + 1}`;
  });
  return `Found ${symbols.length} symbols:\n${lines.join('\n')}`;
}

export default definePlugin({
  id: 'lsp',
  domain: 'coding',
  riskLevel: 'safe',
  description: 'Code intelligence via LSP: goto definition, find references, hover, document symbols, diagnostics',
  schema,
  execute: async (raw) => {
    const { action, filePath, line, character } = schema.parse(raw);

    if (!manager) return 'LSP not available. Language server has not been initialized.';

    try {
      const client = await manager.getClientForFile(filePath);
      if (!client) return `No LSP server available for ${filePath}`;

      if (POSITION_ACTIONS.has(action)) {
        if (line === undefined || character === undefined) {
          return `Action "${action}" requires both line and character parameters`;
        }
      }

      const uri = pathToFileURL(filePath).toString();
      const lspLine = line !== undefined ? line - 1 : 0;
      const lspChar = character ?? 0;

      switch (action) {
        case 'goto_definition': return await handleDefinition(uri, lspLine, lspChar, client);
        case 'find_references': return await handleReferences(uri, lspLine, lspChar, client);
        case 'hover': return await handleHover(uri, lspLine, lspChar, client);
        case 'document_symbols': return await handleDocumentSymbols(uri, client);
        case 'diagnostics': return 'Diagnostics are delivered asynchronously via LSP notifications. Use the diagnostic panel or run typecheck for current diagnostics.';
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return `LSP error: ${msg}`;
    }
  },
});
