import { z } from 'zod';
import { definePlugin } from '@/domain/index.js';
import { getFmpEarningsTranscripts } from './fmp/index.js';

const schema = z.object({
  ticker: z.string().describe('Stock ticker symbol'),
  year: z.number().describe('Year of the earnings call'),
  quarter: z.number().min(1).max(4).describe('Quarter (1-4)'),
});

export default definePlugin({
  id: 'fmp_earnings_transcripts',
  domain: 'finance',
  riskLevel: 'safe',
  description:
    'Get earnings call transcripts from FMP. Use for qualitative analysis of management commentary.',
  schema,
  execute: async (raw) => {
    const input = schema.parse(raw);
    const data = await getFmpEarningsTranscripts(input.ticker, input.year, input.quarter);
    return JSON.stringify({ data });
  },
});
