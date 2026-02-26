import type { Command, CommandContext } from '../core/command-registry.js';

export const statusCommand: Command = {
  name: 'status',
  description: 'Show engine health and active sessions',
  async execute(_args: string, context: CommandContext): Promise<void> {
    try {
      const health = await context.engineClient.health();
      const lines = [
        '── Engine Status ──',
        `  Status:          ${health.status}`,
        `  Engine Version:  ${health.engine_version}`,
        `  Nautilus:        ${health.nautilus_version}`,
        `  Live Sessions:   ${health.active_live_sessions}`,
        `  Running Backtests: ${health.running_backtests}`,
      ];
      context.addSystemMessage(lines.join('\n'));
    } catch (error) {
      context.addSystemMessage(`Failed to get engine status: ${error instanceof Error ? error.message : String(error)}`);
    }
  },
};
