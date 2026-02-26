import { helpCommand } from './help.js';
import { newCommand } from './new.js';
import { saveCommand } from './save.js';
import { clearCommand } from './clear.js';
import { statusCommand } from './status.js';
import { backtestCommand } from './backtest.js';
import { deployCommand } from './deploy.js';
import { killCommand } from './kill.js';
import type { CommandRegistry } from '../core/command-registry.js';

export const allCommands = [
  helpCommand,
  newCommand,
  saveCommand,
  clearCommand,
  statusCommand,
  backtestCommand,
  deployCommand,
  killCommand,
];

export function registerAllCommands(registry: CommandRegistry): void {
  for (const cmd of allCommands) {
    registry.register(cmd);
  }
}
