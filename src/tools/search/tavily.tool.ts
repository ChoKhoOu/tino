import { z } from 'zod';
import { defineToolPlugin } from '@/domain/index.js';
import { formatToolResult, parseSearchResults } from '../types.js';

const TAVILY_API_URL = 'https://api.tavily.com/search';

interface TavilyResult {
  title: string;
  url: string;
  content: string;
  score: number;
}

interface TavilyResponse {
  results: TavilyResult[];
  query: string;
}

async function tavilySearch(query: string): Promise<TavilyResponse> {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) {
    throw new Error('TAVILY_API_KEY environment variable is not set');
  }

  const resp = await fetch(TAVILY_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      api_key: apiKey,
      query,
      max_results: 5,
      include_answer: false,
    }),
  });

  if (!resp.ok) {
    throw new Error(`Tavily API error: ${resp.status} ${resp.statusText}`);
  }

  return resp.json() as Promise<TavilyResponse>;
}

const schema = z.object({
  query: z.string().describe('The search query to look up on the web'),
});

export default defineToolPlugin({
  id: 'web_search',
  domain: 'search',
  riskLevel: 'safe',
  description:
    'Search the web for current information on any topic. Returns relevant search results with URLs and content snippets.',
  schema,
  execute: async (raw) => {
    const { query } = schema.parse(raw);
    const result = await tavilySearch(query);
    const { parsed, urls } = parseSearchResults(result);
    return formatToolResult(parsed, urls);
  },
});
