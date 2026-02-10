import { z } from 'zod';
import Exa from 'exa-js';
import { definePlugin } from '@/domain/index.js';
import { formatToolResult, parseSearchResults } from '../types.js';

let client: Exa | null = null;

function getClient(): Exa {
  if (!client) {
    client = new Exa(process.env.EXASEARCH_API_KEY);
  }
  return client;
}

const schema = z.object({
  query: z.string().describe('The search query to look up on the web'),
});

export default definePlugin({
  id: 'web_search',
  domain: 'search',
  riskLevel: 'safe',
  description:
    'Search the web for current information on any topic. Returns relevant search results with URLs and content snippets.',
  schema,
  execute: async (raw) => {
    const { query } = schema.parse(raw);
    const result = await getClient().search(query, {
      numResults: 5,
      contents: { text: true },
    });
    const { parsed, urls } = parseSearchResults(result);
    return formatToolResult(parsed, urls);
  },
});
