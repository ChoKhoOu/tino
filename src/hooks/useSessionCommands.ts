import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { SessionRuntime } from '@/runtime/session-runtime.js';
import type { SessionStore } from '@/session/session-store.js';
import type { RunState } from './useSessionRunner.js';
import type { HistoryItem } from '@/components/HistoryItemView.js';
import type { TokenUsage } from '@/domain/events.js';
import type { Session } from '@/session/session.js';
import {
  buildSessionFromHistory,
  createSessionId,
  extractTodosFromEvents,
  sessionToHistoryItems,
  summarizeTodos,
} from './session-history.js';
import type { ExtendedSlashDeps } from './slash-command-actions.js';
import { renderContextBar } from '@/components/context-bar.js';
import { TOKEN_BUDGET } from '@/utils/tokens.js';
import { discoverAgentConfigs } from '@/agents/registry.js';

interface SessionCommandOptions {
  runtime: SessionRuntime | null;
  runState: RunState;
  history: HistoryItem[];
  setHistory: React.Dispatch<React.SetStateAction<HistoryItem[]>>;
  resetNavigation: () => void;
  sessionStore: SessionStore;
  connectedMcpServers: string[];
  provider: string;
  model: string;
}

function buildMarkdownExport(title: string, history: HistoryItem[]): string {
  const lines = [`# ${title}`, ''];
  for (const item of history) {
    lines.push(`## User`);
    lines.push(item.query);
    lines.push('');
    lines.push('## Assistant');
    lines.push(item.answer || '(no answer)');
    lines.push('');
  }
  return lines.join('\n');
}

export function useSessionCommands(options: SessionCommandOptions): ExtendedSlashDeps {
  const {
    runtime, runState, history, setHistory, resetNavigation,
    sessionStore, connectedMcpServers, provider, model,
  } = options;

  const [sessionId, setSessionId] = useState(createSessionId);
  const [sessionTitle, setSessionTitle] = useState('Untitled Session');
  const [sessionCreatedAt, setSessionCreatedAt] = useState(new Date().toISOString());
  const activeTodosRef = useRef<Session['todos']>([]);
  const historyRef = useRef(history);
  const tokenUsageRef = useRef<TokenUsage | undefined>(runState.tokenUsage);

  useEffect(() => {
    historyRef.current = history;
  }, [history]);

  useEffect(() => {
    tokenUsageRef.current = runState.tokenUsage;
    const todos = extractTodosFromEvents(runState.events);
    if (todos) activeTodosRef.current = todos;
  }, [runState.events, runState.tokenUsage]);

  const persistCurrentSession = useCallback(async () => {
    const snapshot = buildSessionFromHistory({
      id: sessionId,
      title: sessionTitle,
      createdAt: sessionCreatedAt,
      systemPrompt: 'Session prompt managed by runtime.',
      history: historyRef.current,
      tokenUsage: tokenUsageRef.current,
      todos: activeTodosRef.current,
    });
    await sessionStore.save(snapshot);
  }, [sessionCreatedAt, sessionId, sessionStore, sessionTitle]);

  useEffect(() => {
    if (runState.status !== 'done') return;
    void persistCurrentSession();
  }, [persistCurrentSession, runState.status]);

  const reloadRuntimeFromHistory = useCallback((nextHistory: HistoryItem[]) => {
    const session = buildSessionFromHistory({
      id: sessionId,
      title: sessionTitle,
      createdAt: sessionCreatedAt,
      systemPrompt: 'Session prompt managed by runtime.',
      history: nextHistory,
      tokenUsage: tokenUsageRef.current,
      todos: activeTodosRef.current,
    });
    runtime?.loadFromSession(session);
  }, [runtime, sessionCreatedAt, sessionId, sessionTitle]);

  return useMemo<ExtendedSlashDeps>(() => ({
    compact: () => {
      const current = historyRef.current;
      if (current.length <= 8) return { removed: 0, kept: current.length };
      const compacted = current.slice(-8);
      setHistory(compacted);
      reloadRuntimeFromHistory(compacted);
      return { removed: current.length - compacted.length, kept: compacted.length };
    },
    getContextSummary: () => {
      const turns = historyRef.current.length;
      const messages = turns * 2 + 1;
      const usage = tokenUsageRef.current;
      const usedTokens = usage?.inputTokens ?? 0;
      const bar = renderContextBar(usedTokens, TOKEN_BUDGET);
      return `Context: ${messages} messages across ${turns} turns.\n${bar}`;
    },
    getCostSummary: () => {
      const usage = tokenUsageRef.current;
      if (!usage) return 'No token usage available yet.';
      return `Cost: ${usage.totalTokens.toLocaleString()} total tokens (${usage.inputTokens.toLocaleString()} in / ${usage.outputTokens.toLocaleString()} out).`;
    },
    getTodosSummary: () => summarizeTodos(activeTodosRef.current ?? []),
    rewind: () => {
      const current = historyRef.current;
      if (current.length === 0) return false;
      const next = current.slice(0, -1);
      setHistory(next);
      reloadRuntimeFromHistory(next);
      void persistCurrentSession();
      return true;
    },
    getStatusSummary: () => `Status: ${runState.status}. Session: ${sessionId}.`,
    getPermissionsSummary: () => 'Permissions loaded from ~/.tino/permissions.json and .tino/permissions.json.',
    getMcpSummary: () => connectedMcpServers.length > 0
      ? `MCP: connected to ${connectedMcpServers.join(', ')}.`
      : 'MCP: no active server connections.',
    getConfigSummary: () => `Config: provider=${provider}, model=${model}.`,
    getAgentsSummary: () => {
      const agents = discoverAgentConfigs();
      if (agents.length === 0) {
        return 'No custom agents found. Add markdown files in ~/.tino/agents or .tino/agents.';
      }
      return ['Available agents:', ...agents.map((agent) => `- ${agent.name} (${agent.source}): ${agent.description ?? 'No description'}`)].join('\n');
    },
    renameSession: async (name: string) => {
      setSessionTitle(name);
      await persistCurrentSession();
      return await sessionStore.rename(sessionId, name);
    },
    resumeSession: async (resumeId?: string) => {
      if (!resumeId) {
        const sessions = await sessionStore.list();
        if (sessions.length === 0) return 'No saved sessions found.';
        return ['Available sessions:', ...sessions.slice(0, 10).map((s) => `- ${s.id}: ${s.title}`)].join('\n');
      }

      const session = await sessionStore.load(resumeId);
      if (!session) return `Session not found: ${resumeId}`;

      runtime?.loadFromSession(session);
      setHistory(sessionToHistoryItems(session));
      resetNavigation();

      setSessionId(session.id);
      setSessionTitle(session.title);
      setSessionCreatedAt(session.createdAt);
      activeTodosRef.current = session.todos ?? [];
      tokenUsageRef.current = session.tokenUsage;
      return `Resumed session ${session.id} (${session.title}).`;
    },
    exportSession: async (target?: string) => {
      const outputPath = target ?? `${sessionId}.md`;
      const markdown = buildMarkdownExport(sessionTitle, historyRef.current);
      await Bun.write(outputPath, markdown);
      return `Exported to ${outputPath}`;
    },
  }), [
    connectedMcpServers,
    persistCurrentSession,
    provider,
    model,
    reloadRuntimeFromHistory,
    resetNavigation,
    runState.status,
    sessionId,
    sessionStore,
    sessionTitle,
    setHistory,
    runtime,
  ]);
}
