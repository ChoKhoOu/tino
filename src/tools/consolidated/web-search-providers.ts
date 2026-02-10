import { formatToolResult, parseSearchResults } from '../types.js';

const EXA_API_URL = 'https://api.exa.ai/search';
const TAVILY_API_URL = 'https://api.tavily.com/search';

export type SearchProvider = 'exa' | 'tavily';

export interface SearchOptions {
  query: string;
  maxResults: number;
  recencyDays?: number;
}

export function resolveProvider(explicit?: string): SearchProvider | null {
  if (explicit === 'exa') {
    if (!process.env.EXASEARCH_API_KEY) return null;
    return 'exa';
  }
  if (explicit === 'tavily') {
    if (!process.env.TAVILY_API_KEY) return null;
    return 'tavily';
  }
  if (process.env.EXASEARCH_API_KEY) return 'exa';
  if (process.env.TAVILY_API_KEY) return 'tavily';
  return null;
}

async function searchExa(opts: SearchOptions): Promise<string> {
  const apiKey = process.env.EXASEARCH_API_KEY!;
  const resp = await fetch(EXA_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
    },
    body: JSON.stringify({
      query: opts.query,
      numResults: opts.maxResults,
      contents: { text: true },
    }),
  });

  if (!resp.ok) throw new Error(`Exa API error: ${resp.status} ${resp.statusText}`);
  const data = await resp.json();
  const { parsed, urls } = parseSearchResults(data);
  return formatToolResult(parsed, urls);
}

async function searchTavily(opts: SearchOptions): Promise<string> {
  const apiKey = process.env.TAVILY_API_KEY!;
  const resp = await fetch(TAVILY_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      api_key: apiKey,
      query: opts.query,
      max_results: opts.maxResults,
      include_answer: false,
    }),
  });

  if (!resp.ok) throw new Error(`Tavily API error: ${resp.status} ${resp.statusText}`);
  const data = await resp.json();
  const { parsed, urls } = parseSearchResults(data);
  return formatToolResult(parsed, urls);
}

export async function executeSearch(provider: SearchProvider, opts: SearchOptions): Promise<string> {
  return provider === 'exa' ? searchExa(opts) : searchTavily(opts);
}
