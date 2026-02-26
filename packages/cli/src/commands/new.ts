import type { Command, CommandContext } from '../core/command-registry.js';

export const newCommand: Command = {
  name: 'new',
  description: 'Start a new conversation',
  async execute(_args: string, context: CommandContext): Promise<void> {
    context.strategyAgent.resetConversation();
    context.messageStore.reset();
    context.addSystemMessage('Conversation reset. Describe a new strategy to get started.');
  },
};
