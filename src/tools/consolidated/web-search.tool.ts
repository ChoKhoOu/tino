import { z } from 'zod';
import { definePlugin } from '@/domain/index.js';

const schema = z.object({
  query: z.string().describe('The search query to look up on the web'),
  maxResults: z.number().optional().describe('Maximum number of results to return (default 5)'),
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
    return JSON.stringify({ error: `Not implemented: web_search for query "${query}"` });
  },
});
