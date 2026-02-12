import type { SlashCommandResult } from './slash.js';

export function handleCompact(args: string[]): SlashCommandResult {
  return {
    handled: true,
    action: 'compact',
    args,
  };
}

export function handleContext(): SlashCommandResult {
  return {
    handled: true,
    action: 'context',
  };
}

export function handleCost(): SlashCommandResult {
  return {
    handled: true,
    action: 'cost',
  };
}

export function handleTodos(): SlashCommandResult {
  return {
    handled: true,
    action: 'todos',
  };
}
