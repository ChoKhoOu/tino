/**
 * Command registration and dispatch system.
 * Slash-commands are parsed and routed to registered handlers.
 */

import type { EngineClient } from '@tino/shared';
import type { MessageStore } from './message-store.js';
import type { StrategyAgent } from '../agents/strategy-agent.js';

export interface CommandContext {
  engineUrl: string;
  engineClient: EngineClient;
  messageStore: MessageStore;
  addSystemMessage: (content: string) => void;
  strategyAgent: StrategyAgent;
  commandRegistry: CommandRegistry;
  onStartBacktest: (backtestId: string, wsUrl: string) => void;
  onRequestConfirm: (opts: {
    title: string;
    details: string[];
    confirmText: string;
    onConfirm: () => Promise<void>;
    onCancel: () => void;
  }) => void;
}

export interface Command {
  name: string;
  description: string;
  execute(args: string, context: CommandContext): Promise<void>;
}

export class CommandRegistry {
  private commands = new Map<string, Command>();

  register(command: Command): void {
    this.commands.set(command.name.toLowerCase(), command);
  }

  async dispatch(input: string, context: CommandContext): Promise<boolean> {
    if (!input.startsWith('/')) {
      return false;
    }

    const trimmed = input.slice(1).trim();
    const spaceIndex = trimmed.indexOf(' ');
    const commandName = (spaceIndex === -1 ? trimmed : trimmed.slice(0, spaceIndex)).toLowerCase();
    const args = spaceIndex === -1 ? '' : trimmed.slice(spaceIndex + 1).trim();

    const command = this.commands.get(commandName);
    if (command) {
      await command.execute(args, context);
      return true;
    }

    // Command not found — suggest closest matches
    const suggestions = this.findSimilar(commandName);
    let errorMsg = `Unknown command: /${commandName}`;
    if (suggestions.length > 0) {
      errorMsg += `\nDid you mean: ${suggestions.map((s) => `/${s}`).join(', ')}?`;
    }
    errorMsg += `\nType /help to see available commands.`;
    context.addSystemMessage(errorMsg);

    return true;
  }

  listCommands(): Command[] {
    return [...this.commands.values()];
  }

  getCommand(name: string): Command | undefined {
    return this.commands.get(name.toLowerCase());
  }

  private findSimilar(input: string): string[] {
    const names = [...this.commands.keys()];
    return names
      .map((name) => ({ name, distance: levenshtein(input, name) }))
      .filter(({ distance }) => distance <= 3)
      .sort((a, b) => a.distance - b.distance)
      .slice(0, 3)
      .map(({ name }) => name);
  }
}

/**
 * Minimal Levenshtein distance for fuzzy command matching.
 */
function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () =>
    Array.from({ length: n + 1 }, () => 0),
  );

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost,
      );
    }
  }

  return dp[m][n];
}
