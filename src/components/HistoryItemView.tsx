import React from 'react';
import { Box, Text } from 'ink';
import { colors } from '../theme.js';
import { EventListView } from './AgentEventView.js';
import type { DisplayEvent } from './AgentEventView.js';
import { AnswerBox } from './AnswerBox.js';
import type { TokenUsage } from '@/domain/index.js';

export function formatDuration(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  const totalSeconds = Math.round(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes === 0) return `${seconds}s`;
  return `${minutes}m ${seconds}s`;
}

export function formatTurnStats(
  durationMs: number,
  tokenUsage: { totalTokens: number },
): string {
  const parts: string[] = [formatDuration(durationMs)];
  parts.push(`${tokenUsage.totalTokens.toLocaleString('en-US')} tokens`);
  if (durationMs > 0) {
    const throughput = tokenUsage.totalTokens / (durationMs / 1000);
    parts.push(`(${throughput.toFixed(1)} tok/s)`);
  }
  return parts.join(' · ');
}

export type HistoryItemStatus = 'processing' | 'complete' | 'error' | 'interrupted';

export interface HistoryItem {
  id: string;
  query: string;
  events: DisplayEvent[];
  answer: string;
  status: HistoryItemStatus;
  activeToolId?: string;
  /** Timestamp when this query started processing */
  startTime?: number;
  /** Total duration in milliseconds (set when complete) */
  duration?: number;
  /** Token usage statistics */
  tokenUsage?: TokenUsage;
}

interface HistoryItemViewProps {
  item: HistoryItem;
}

export function HistoryItemView({ item }: HistoryItemViewProps) {
  // Add spacing after completed items, but not during processing
  const isComplete = item.status === 'complete' || item.status === 'error' || item.status === 'interrupted';
  
  return (
    <Box flexDirection="column" marginBottom={isComplete ? 1 : 0}>
      {/* Query */}
      <Box>
        <Text color={colors.muted} backgroundColor={colors.queryBg}>{'❯ '}</Text>
        <Text color={colors.white} backgroundColor={colors.queryBg}>{`${item.query} `}</Text>
      </Box>
            
      {/* Interrupted indicator */}
      {item.status === 'interrupted' && (
        <Box marginLeft={2}>
          <Text color={colors.muted}>⎿  Interrupted · What should Tino do instead?</Text>
        </Box>
      )}
      
      {/* Events (tool calls, thinking) */}
      <EventListView 
        events={item.events} 
        activeToolId={item.status === 'processing' ? item.activeToolId : undefined}
      />
      
      {/* Answer - only show if we have one */}
      {item.answer && (
        <Box>
          <AnswerBox text={item.answer} />
        </Box>
      )}
      
      {/* Performance stats - only show when token data is present */}
      {item.status === 'complete' && item.tokenUsage && item.duration !== undefined && (
        <Box marginTop={1}>
          <Text color={colors.muted}>✻ {formatTurnStats(item.duration, item.tokenUsage)}</Text>
        </Box>
      )}
    </Box>
  );
}
