import type { SlashCommandResult } from './slash.js';

export function handleStatus(): SlashCommandResult {
  return {
    handled: true,
    action: 'status',
  };
}

export function handlePermissions(): SlashCommandResult {
  return {
    handled: true,
    action: 'permissions',
  };
}

export function handleMcp(): SlashCommandResult {
  return {
    handled: true,
    action: 'mcp',
  };
}

export function handleConfig(): SlashCommandResult {
  return {
    handled: true,
    action: 'config',
  };
}

export function handleRewind(): SlashCommandResult {
  return {
    handled: true,
    action: 'rewind',
  };
}
