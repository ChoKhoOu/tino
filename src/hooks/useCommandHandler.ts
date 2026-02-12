import { useCallback } from 'react';
import { parseSlashCommand } from '@/commands/slash.js';
import { resolveFileReferences } from '@/utils/file-reference.js';
import { isBashQuickCommand, executeBashQuick, formatBashOutput } from './bash-quick.js';
import type { SessionRuntime } from '@/runtime/session-runtime.js';
import type { HistoryItem } from '@/components/HistoryItemView.js';

interface CommandHandlerDeps {
  exit: () => void;
  startFlow: () => void;
  isInFlow: () => boolean;
  isProcessing: boolean;
  runtime: SessionRuntime | null;
  saveMessage: (msg: string) => Promise<void>;
  resetNavigation: () => void;
  executeRun: (query: string) => Promise<void>;
  setHistory: React.Dispatch<React.SetStateAction<HistoryItem[]>>;
  setError: React.Dispatch<React.SetStateAction<string | null>>;
}

export function useCommandHandler(deps: CommandHandlerDeps) {
  const {
    exit, startFlow, isInFlow, isProcessing, runtime,
    saveMessage, resetNavigation, executeRun, setHistory, setError,
  } = deps;

  const addDirectResponse = useCallback((query: string, answer: string) => {
    setHistory((prev) => [
      ...prev,
      { id: Date.now().toString(), query, events: [], answer, status: 'complete' as const, startTime: Date.now() },
    ]);
  }, [setHistory]);

  const handleSubmit = useCallback(
    async (query: string) => {
      if (query.toLowerCase() === 'exit' || query.toLowerCase() === 'quit') {
        console.log('Goodbye!');
        exit();
        return;
      }

      if (isBashQuickCommand(query)) {
        const command = query.slice(1).trim();
        const result = await executeBashQuick(command);
        addDirectResponse(query, formatBashOutput(command, result));
        return;
      }

      const slashResult = parseSlashCommand(query);
      if (slashResult !== null) {
        if (slashResult.action === 'model') { startFlow(); return; }
        if (slashResult.action === 'clear') {
          runtime?.clearHistory();
          setHistory([]);
          return;
        }
        if (slashResult.action === 'exit') { console.log('Goodbye!'); exit(); return; }
        if (!slashResult.handled) {
          setError(`Unknown command: ${query.trim().split(/\s+/)[0]}. Type /help for available commands.`);
          return;
        }
        if (slashResult.output) {
          addDirectResponse(query, slashResult.output);
          return;
        }
        return;
      }

      if (isInFlow() || isProcessing) return;

      await saveMessage(query);
      resetNavigation();
      
      const resolvedQuery = await resolveFileReferences(query);
      await executeRun(resolvedQuery);
    },
    [exit, startFlow, isInFlow, isProcessing, saveMessage, resetNavigation, executeRun, addDirectResponse, runtime, setHistory, setError],
  );

  return { handleSubmit, addDirectResponse };
}
