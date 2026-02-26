import type { Command, CommandContext } from '../core/command-registry.js';

export const killCommand: Command = {
  name: 'kill',
  description: 'Emergency kill switch - cancel all orders, flatten positions',
  async execute(_args: string, context: CommandContext): Promise<void> {
    try {
      context.addSystemMessage('Triggering kill switch...');
      const result = await context.engineClient.killSwitch();
      context.addSystemMessage(
        `Kill switch activated:\n` +
        `  Cancelled orders:    ${result.cancelled_orders}\n` +
        `  Flattened positions: ${result.flattened_positions}\n` +
        `  Sessions killed:     ${result.killed_sessions}`
      );
    } catch (error) {
      context.addSystemMessage(`Kill switch failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  },
};
