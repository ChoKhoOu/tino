import { z } from 'zod';
import { definePlugin } from '@/domain/index.js';
import { getChartClient } from '../chart/grpc-clients.js';
import { CHART_DESCRIPTION } from '../descriptions/chart.js';

const schema = z.object({
  action: z.enum(['candlestick', 'line_chart', 'subplot']).describe('The chart action to perform'),
  dates: z.array(z.string()).optional().describe('Dates for candlestick/subplot'),
  open: z.array(z.number()).optional().describe('Open prices'),
  close: z.array(z.number()).optional().describe('Close prices'),
  high: z.array(z.number()).optional().describe('High prices'),
  low: z.array(z.number()).optional().describe('Low prices'),
  volume: z.array(z.number()).optional().describe('Volume data'),
  labels: z.array(z.string()).optional().describe('Labels for line chart'),
  values: z.array(z.number()).optional().describe('Values for line chart'),
  width: z.number().optional().describe('Chart width'),
  height: z.number().optional().describe('Chart height'),
  title: z.string().optional().describe('Chart title'),
  color: z.string().optional().describe('Line color'),
});

type Input = z.infer<typeof schema>;

async function handleCandlestick(input: Input): Promise<string> {
  const client = getChartClient();
  const response = await client.renderCandlestick({
    dates: input.dates ?? [],
    open: input.open ?? [],
    close: input.close ?? [],
    high: input.high ?? [],
    low: input.low ?? [],
    width: input.width ?? 80,
    height: input.height ?? 20,
    title: input.title ?? '',
  });

  return JSON.stringify({
    data: { ansiChart: response.ansiChart },
  });
}

async function handleLineChart(input: Input): Promise<string> {
  const client = getChartClient();
  const response = await client.renderLineChart({
    labels: input.labels ?? [],
    values: input.values ?? [],
    width: input.width ?? 80,
    height: input.height ?? 20,
    title: input.title ?? '',
    color: input.color ?? '',
  });

  return JSON.stringify({
    data: { ansiChart: response.ansiChart },
  });
}

async function handleSubplot(input: Input): Promise<string> {
  const client = getChartClient();
  const response = await client.renderSubplot({
    dates: input.dates ?? [],
    open: input.open ?? [],
    close: input.close ?? [],
    high: input.high ?? [],
    low: input.low ?? [],
    volume: input.volume ?? [],
    width: input.width ?? 80,
    height: input.height ?? 20,
  });

  return JSON.stringify({
    data: { ansiChart: response.ansiChart },
  });
}

export default definePlugin({
  id: 'chart',
  domain: 'chart',
  riskLevel: 'safe',
  description: CHART_DESCRIPTION,
  schema,
  execute: async (raw) => {
    const input = schema.parse(raw);

    switch (input.action) {
      case 'candlestick':
        return handleCandlestick(input);
      case 'line_chart':
        return handleLineChart(input);
      case 'subplot':
        return handleSubplot(input);
    }
  },
});
