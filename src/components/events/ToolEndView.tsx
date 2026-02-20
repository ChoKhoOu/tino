import React from 'react';
import { Box, Text } from 'ink';
import { colors } from '../../theme.js';
import { formatToolName, formatArgs, formatDuration, truncateResult } from './utils.js';
import { StreamingTicker } from '../StreamingTicker.js';

interface ToolEndViewProps {
  toolId: string;
  args: Record<string, unknown>;
  result: string;
  duration: number;
}

interface StreamingEvent {
  type: string;
  instrument: string;
  data: { price?: number; bid?: number; ask?: number; close?: number; change_percent?: number };
  timestamp: string;
}

function parseStreamingEvents(result: string): StreamingEvent[] | null {
  try {
    const parsed = JSON.parse(result);
    if (parsed.data?.events && Array.isArray(parsed.data.events)) {
      return parsed.data.events;
    }
  } catch {}
  return null;
}

function getStreamingSummary(result: string): string {
  try {
    const parsed = JSON.parse(result);
    const d = parsed.data;
    if (d?.status === 'subscribed') return `Subscribed to ${d.instrument} (${d.eventsCollected} events)`;
    if (d?.success !== undefined) return `Unsubscribed from ${d.instrument}`;
    if (d?.subscriptions) return `${d.total} active subscription${d.total !== 1 ? 's' : ''}`;
  } catch {}
  return 'Streaming operation complete';
}

function renderStreamingResult(result: string, duration: number, args: Record<string, unknown>) {
  const events = parseStreamingEvents(result);
  const summary = getStreamingSummary(result);

  return (
    <Box flexDirection="column">
      <Box>
        <Text>⏺ </Text>
        <Text>{formatToolName('streaming')}</Text>
        <Text color={colors.muted}>({formatArgs(args)})</Text>
      </Box>
      <Box marginLeft={2}>
        <Text color={colors.muted}>⎿  </Text>
        <Text>{summary}</Text>
        <Text color={colors.muted}> in {formatDuration(duration)}</Text>
      </Box>
      {events && events.length > 0 && (
        <Box flexDirection="column" marginLeft={4} marginTop={1}>
          {events.map((evt, i) => {
            const price = evt.data?.price ?? evt.data?.bid ?? evt.data?.close ?? 0;
            const change = evt.data?.change_percent ?? 0;
            return (
              <StreamingTicker
                key={`${evt.instrument}-${i}`}
                instrument={evt.instrument}
                price={price}
                change={change}
                timestamp={evt.timestamp}
              />
            );
          })}
        </Box>
      )}
    </Box>
  );
}

export function ToolEndView({ toolId, args, result, duration }: ToolEndViewProps) {
  if (toolId === 'streaming') {
    return renderStreamingResult(result, duration, args);
  }

  let summary = 'Received data';
  
  if (toolId === 'skill') {
    const skillName = args.skill as string;
    summary = `Loaded ${skillName} skill`;
  } else {
    try {
      const parsed = JSON.parse(result);
      if (parsed.data) {
        if (Array.isArray(parsed.data)) {
          summary = `Received ${parsed.data.length} items`;
        } else if (typeof parsed.data === 'object') {
          const keys = Object.keys(parsed.data).filter(k => !k.startsWith('_')); // Exclude _errors
          
          // Tool-specific summaries
          if (toolId === 'financial_search') {
            summary = keys.length === 1 
              ? `Called 1 data source` 
              : `Called ${keys.length} data sources`;
          } else if (toolId === 'web_search') {
            summary = `Did 1 search`;
          } else {
            summary = `Received ${keys.length} fields`;
          }
        }
      }
    } catch {
      // Not JSON, use truncated result
      summary = truncateResult(result, 50);
    }
  }
  
  return (
    <Box flexDirection="column">
      <Box>
        <Text>⏺ </Text>
        <Text>{formatToolName(toolId)}</Text>
        <Text color={colors.muted}>({formatArgs(args)})</Text>
      </Box>
      <Box marginLeft={2}>
        <Text color={colors.muted}>⎿  </Text>
        <Text>{summary}</Text>
        <Text color={colors.muted}> in {formatDuration(duration)}</Text>
      </Box>
    </Box>
  );
}
