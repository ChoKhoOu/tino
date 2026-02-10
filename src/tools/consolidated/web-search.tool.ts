import { z } from 'zod';
import { definePlugin } from '@/domain/index.js';
import { resolveProvider, executeSearch } from './web-search-providers.js';
import { WEB_SEARCH_DESCRIPTION } from '../descriptions/web-search.js';

const schema = z.object({
  query: z.string().describe('The search query to look up on the web'),
  provider: z.enum(['auto', 'exa', 'tavily']).default('auto').describe('Search provider to use'),
  max_results: z.number().optional().describe('Maximum number of results to return (default 5)'),
  recency_days: z.number().optional().describe('Only return results from the last N days'),
});

export default definePlugin({
  id: 'web_search',
  domain: 'search',
  riskLevel: 'safe',
  description: WEB_SEARCH_DESCRIPTION,
  schema,
  execute: async (raw) => {
    const { query, provider: providerPref, max_results, recency_days } = schema.parse(raw);
    const explicit = providerPref === 'auto' ? undefined : providerPref;
    const resolved = resolveProvider(explicit);

    if (!resolved) {
      const msg = explicit
        ? `${explicit.toUpperCase()} API key not set (${explicit === 'exa' ? 'EXASEARCH_API_KEY' : 'TAVILY_API_KEY'})`
        : 'No search API key available. Set EXASEARCH_API_KEY or TAVILY_API_KEY.';
      return JSON.stringify({ error: msg });
    }

    return executeSearch(resolved, {
      query,
      maxResults: max_results ?? 5,
      recencyDays: recency_days,
    });
  },
});
