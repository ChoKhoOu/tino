import { stdout } from 'node:process';
import type { Command, CommandContext } from '../core/command-registry.js';

export const clearCommand: Command = {
  name: 'clear',
  description: 'Clear terminal screen',
  async execute(_args: string, context: CommandContext): Promise<void> {
    stdout.write('\x1B[2J\x1B[3J\x1B[H');
    context.addSystemMessage('Screen cleared.');
  },
};
