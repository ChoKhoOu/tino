import { useMemo } from 'react';
import { estimateTokens, TOKEN_BUDGET } from '../utils/tokens.js';
import type { ModelSelectorState } from './useModelSelector.js';
import type { RunState } from './useSessionRunner.js';
import type { DaemonStatus } from './useDaemonStatus.js';
import type { HistoryItem } from '../components/index.js';
import type { StatusLineProps } from '../components/StatusLine.js';
import type { PermissionMode } from '../domain/permission-mode.js';

export function useStatusLineData(
  modelState: ModelSelectorState,
  runState: RunState,
  daemonStatus: { status: DaemonStatus },
  history: HistoryItem[],
  permissionMode?: PermissionMode,
): StatusLineProps {
  const modelName = modelState.currentModel;
  const runStatus = runState.status;
  const events = runState.events;
  const daemon = daemonStatus.status;

  return useMemo(() => {
    let totalTokens = 0;
    
    history.forEach(item => {
      if (item.tokenUsage) {
        totalTokens += item.tokenUsage.totalTokens;
      } else {
        totalTokens += estimateTokens(item.query);
        totalTokens += estimateTokens(item.answer || '');
      }
    });

    if (runStatus !== 'idle') {
      events.forEach(event => {
        if (event.type === 'answer_chunk') {
          totalTokens += estimateTokens(event.content);
        } else if (event.type === 'answer_delta') {
          totalTokens += estimateTokens(event.delta);
        } else if (event.type === 'tool_start') {
           totalTokens += estimateTokens(JSON.stringify(event.args));
        } else if (event.type === 'tool_end') {
           totalTokens += estimateTokens(event.result);
        }
      });
    }

    const contextPercent = Math.min(100, (totalTokens / TOKEN_BUDGET) * 100);

    let duration: number | null = null;
    if (runStatus === 'running' || runStatus === 'permission_pending') {
       const currentItem = history[history.length - 1];
       if (currentItem && currentItem.status === 'processing' && currentItem.startTime) {
         duration = (Date.now() - currentItem.startTime) / 1000;
       }
    } else if (history.length > 0) {
       const last = history[history.length - 1];
       if (last.duration) {
         duration = last.duration / 1000;
       }
    }

    return {
      modelName,
      contextPercent,
      daemonStatus: daemon,
      cost: 0,
      duration,
      permissionMode,
    };
  }, [modelName, runStatus, events, daemon, history, permissionMode]);
}
