import { useCallback } from 'react';
import { parseSlashCommand } from '@/commands/slash.js';
import { resolveFileReferences } from '@/utils/file-reference.js';
import { isBashQuickCommand, executeBashQuick, formatBashOutput } from './bash-quick.js';
import { runExtendedSlashAction, type ExtendedSlashDeps } from './slash-command-actions.js';
import type { SessionRuntime } from '@/runtime/session-runtime.js';
import type { HistoryItem } from '@/components/HistoryItemView.js';
import type { BashHistory } from './useBashHistory.js';

interface CommandHandlerDeps {
  exit: () => void;
  openModelPopup: () => void;
  selectModel?: (name: string) => void;
  isProcessing: boolean;
  runtime: SessionRuntime | null;
  saveMessage: (msg: string) => Promise<void>;
  resetNavigation: () => void;
  executeRun: (query: string) => Promise<void>;
  setHistory: React.Dispatch<React.SetStateAction<HistoryItem[]>>;
  setError: React.Dispatch<React.SetStateAction<string | null>>;
  extendedSlashDeps: ExtendedSlashDeps;
  bashHistory?: BashHistory | null;
  toggleVerbose?: () => void;
  openStylePicker?: () => void;
  openInitWizard?: () => void;
}

export function useCommandHandler(deps: CommandHandlerDeps) {
  const {
    exit, openModelPopup, selectModel, isProcessing, runtime,
    saveMessage, resetNavigation, executeRun, setHistory, setError, extendedSlashDeps,
    bashHistory, toggleVerbose, openStylePicker, openInitWizard,
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
        if (bashHistory) await bashHistory.addToHistory(command);
        addDirectResponse(query, formatBashOutput(command, result));
        return;
      }

      const slashResult = parseSlashCommand(query);
      if (slashResult !== null) {
        if (slashResult.action === 'model') {
          if (slashResult.args && slashResult.args.length > 0 && selectModel) {
            selectModel(slashResult.args.join(' '));
            return;
          }
          openModelPopup();
          return;
        }
        if (slashResult.action === 'clear') {
          runtime?.clearHistory();
          setHistory([]);
          return;
        }
        if (slashResult.action === 'exit') { console.log('Goodbye!'); exit(); return; }
        if (slashResult.action === 'verbose' && toggleVerbose) {
          toggleVerbose();
          addDirectResponse(query, 'Verbose mode toggled.');
          return;
        }
        if (slashResult.action === 'output-style' && openStylePicker) {
          openStylePicker();
          return;
        }
        if (slashResult.action === 'init' && openInitWizard) {
          openInitWizard();
          return;
        }
        if (slashResult.action) {
          const output = await runExtendedSlashAction(
            slashResult.action,
            slashResult.args ?? [],
            extendedSlashDeps,
          );
          if (output !== null) {
            addDirectResponse(query, output);
            return;
          }
        }
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

      if (isProcessing) return;

      await saveMessage(query);
      resetNavigation();
      
      const resolvedQuery = await resolveFileReferences(query);
      await executeRun(resolvedQuery);
    },
    [exit, openModelPopup, selectModel, isProcessing, saveMessage, resetNavigation, executeRun, addDirectResponse, runtime, setHistory, setError, extendedSlashDeps, bashHistory, toggleVerbose, openStylePicker, openInitWizard],
  );

  return { handleSubmit, addDirectResponse };
}
