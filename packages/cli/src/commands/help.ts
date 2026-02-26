import type { Command, CommandContext } from '../core/command-registry.js';

export const helpCommand: Command = {
  name: 'help',
  description: 'Show available commands',
  async execute(_args: string, context: CommandContext): Promise<void> {
    const commands = context.commandRegistry.listCommands();
    const lines = commands.map(cmd => `  /${cmd.name.padEnd(10)} - ${cmd.description}`);
    context.addSystemMessage(
      'Available commands:\n' +
      lines.join('\n') +
      '\n\nType anything else to chat with the AI assistant.\n' +
      'Keyboard: Ctrl+C cancel | Ctrl+K kill switch'
    );
  },
};
