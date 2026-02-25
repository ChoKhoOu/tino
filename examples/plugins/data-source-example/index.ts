/**
 * Example Tino Plugin: Crypto Fear & Greed Index
 *
 * A data source plugin that fetches the Crypto Fear & Greed Index
 * from the Alternative.me API.
 *
 * Usage:
 *   Copy this file (or the entire directory) to ~/.tino/plugins/
 *   Then start Tino and ask: "What is the current crypto fear and greed index?"
 */
import { z } from 'zod';

const schema = z.object({
  action: z.enum(['current', 'history']).describe('Whether to fetch current value or historical data'),
  limit: z.number().min(1).max(365).optional().describe('Number of historical records (default 10, max 365)'),
});

const description = `
Fetches the Crypto Fear & Greed Index from Alternative.me.

## When to Use

- Assessing overall crypto market sentiment (0 = Extreme Fear, 100 = Extreme Greed)
- Combining with price data for contrarian signals
- Historical sentiment trend analysis

## When NOT to Use

- Stock market sentiment (crypto-only)
- Real-time intraday signals (index is updated once daily)
- Individual token sentiment (index covers the whole crypto market)

## Actions

| Action | Description | Required Params |
|--------|-------------|-----------------|
| current | Get the latest Fear & Greed value | (none) |
| history | Get historical index values | limit (optional, default 10) |

## Usage Notes

- No API key required
- Values: 0-24 = Extreme Fear, 25-49 = Fear, 50 = Neutral, 51-74 = Greed, 75-100 = Extreme Greed
- Updated once per day
`.trim();

type FearGreedEntry = {
  value: string;
  value_classification: string;
  timestamp: string;
};

type FearGreedResponse = {
  data: FearGreedEntry[];
  metadata: { error: string | null };
};

function classifySentiment(value: number): string {
  if (value <= 24) return 'Extreme Fear';
  if (value <= 49) return 'Fear';
  if (value === 50) return 'Neutral';
  if (value <= 74) return 'Greed';
  return 'Extreme Greed';
}

export default {
  id: 'fear_greed_index',
  domain: 'finance',
  riskLevel: 'safe' as const,
  description,
  schema,
  execute: async (raw: unknown, ctx?: { signal?: AbortSignal; onProgress?: (msg: string) => void }) => {
    const { action, limit = 10 } = schema.parse(raw);

    try {
      const queryLimit = action === 'current' ? 1 : limit;
      const url = `https://api.alternative.me/fng/?limit=${queryLimit}`;

      ctx?.onProgress?.(`Fetching Fear & Greed Index (${action})...`);
      const res = await fetch(url, { signal: ctx?.signal });

      if (!res.ok) {
        return JSON.stringify({ error: `API returned ${res.status}: ${res.statusText}` });
      }

      const json = (await res.json()) as FearGreedResponse;

      if (json.metadata?.error) {
        return JSON.stringify({ error: json.metadata.error });
      }

      const entries = json.data.map((entry) => ({
        value: Number(entry.value),
        classification: entry.value_classification,
        sentiment: classifySentiment(Number(entry.value)),
        date: new Date(Number(entry.timestamp) * 1000).toISOString().split('T')[0],
      }));

      if (action === 'current') {
        return JSON.stringify({
          current: entries[0],
          interpretation: `The crypto market sentiment is currently "${entries[0]?.sentiment}" with a score of ${entries[0]?.value}/100.`,
        });
      }

      return JSON.stringify({
        history: entries,
        count: entries.length,
        range: entries.length > 0
          ? { from: entries[entries.length - 1]?.date, to: entries[0]?.date }
          : null,
      });
    } catch (err) {
      return JSON.stringify({ error: err instanceof Error ? err.message : String(err) });
    }
  },
};
