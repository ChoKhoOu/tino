import { z } from 'zod';
import { definePlugin } from '@/domain/index.js';
import { getStreamingClient } from '../streaming/grpc-clients.js';
import { STREAMING_DESCRIPTION } from '../descriptions/streaming.js';
import { SubscribeResponse_EventType } from '@/grpc/gen/tino/streaming/v1/streaming_pb.js';
import type { ToolContext } from '@/domain/tool-plugin.js';

const MAX_INITIAL_EVENTS = 10;

const schema = z.object({
  action: z.enum([
    'subscribe',
    'unsubscribe',
    'list_subscriptions',
  ]).describe('The streaming action to perform'),
  instrument: z.string().optional().describe('Instrument symbol (e.g. AAPL, BTCUSD)'),
  source: z.string().optional().describe('Data source (polygon, coinbase, finnhub)'),
  event_type: z.string().optional().describe('Event type: quote, trade, or bar'),
});

type Input = z.infer<typeof schema>;

async function handleSubscribe(input: Input, ctx: ToolContext): Promise<string> {
  const client = ctx.grpc?.streaming ?? getStreamingClient();
  ctx.onProgress(`Subscribing to ${input.instrument} via ${input.source}...`);

  const events: Array<{ type: string; instrument: string; data: unknown; timestamp: string }> = [];

  for await (const event of client.subscribe({
    instrument: input.instrument ?? '',
    source: input.source ?? '',
    eventType: input.event_type ?? 'quote',
  })) {
    if (ctx.signal.aborted) break;

    const eventName = SubscribeResponse_EventType[event.type] ?? 'UNKNOWN';
    let data: unknown;
    try {
      data = JSON.parse(event.dataJson);
    } catch {
      data = event.dataJson;
    }

    events.push({
      type: eventName,
      instrument: event.instrument,
      data,
      timestamp: event.timestamp,
    });

    if (events.length >= MAX_INITIAL_EVENTS) break;
  }

  return JSON.stringify({
    data: {
      status: 'subscribed',
      instrument: input.instrument,
      source: input.source,
      eventType: input.event_type ?? 'quote',
      eventsCollected: events.length,
      events,
    },
  });
}

async function handleUnsubscribe(input: Input, ctx: ToolContext): Promise<string> {
  const client = ctx.grpc?.streaming ?? getStreamingClient();
  const response = await client.unsubscribe({
    instrument: input.instrument ?? '',
    source: input.source,
  });

  return JSON.stringify({
    data: {
      success: response.success,
      instrument: input.instrument,
      source: input.source,
    },
  });
}

async function handleListSubscriptions(ctx: ToolContext): Promise<string> {
  const client = ctx.grpc?.streaming ?? getStreamingClient();
  const response = await client.listSubscriptions();

  const subscriptions = response.subscriptions.map((s) => ({
    instrument: s.instrument,
    source: s.source,
    eventType: s.eventType,
  }));

  return JSON.stringify({
    data: { total: subscriptions.length, subscriptions },
  });
}

export default definePlugin({
  id: 'streaming',
  domain: 'streaming',
  riskLevel: 'safe',
  description: STREAMING_DESCRIPTION,
  schema,
  execute: async (raw, ctx) => {
    const input = schema.parse(raw);

    switch (input.action) {
      case 'subscribe':
        return handleSubscribe(input, ctx);
      case 'unsubscribe':
        return handleUnsubscribe(input, ctx);
      case 'list_subscriptions':
        return handleListSubscriptions(ctx);
    }
  },
});
