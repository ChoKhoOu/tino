import type { SlashCommandResult } from './slash.js';

export function handleResume(args: string[]): SlashCommandResult {
  return {
    handled: true,
    action: 'resume',
    args,
  };
}

export function handleRename(args: string[]): SlashCommandResult {
  if (args.length === 0) {
    return {
      handled: true,
      output: 'Usage: /rename <name>',
    };
  }
  return {
    handled: true,
    action: 'rename',
    args,
  };
}

export function handleExport(args: string[]): SlashCommandResult {
  return {
    handled: true,
    action: 'export',
    args,
  };
}
