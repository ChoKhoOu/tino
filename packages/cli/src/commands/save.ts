import type { Command, CommandContext } from '../core/command-registry.js';

export const saveCommand: Command = {
  name: 'save',
  description: 'Save current strategy to engine',
  async execute(_args: string, context: CommandContext): Promise<void> {
    const state = context.strategyAgent.currentState;
    if (!state.currentCode) {
      context.addSystemMessage('No strategy to save. Generate one first.');
      return;
    }
    try {
      context.addSystemMessage('Saving strategy...');
      const result = await context.strategyAgent.saveCurrentStrategy();
      if (result) {
        context.addSystemMessage(`Strategy saved! Name: ${result.name}, Hash: ${result.versionHash}`);
      } else {
        context.addSystemMessage('No strategy to save.');
      }
    } catch (error) {
      context.addSystemMessage(`Save failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  },
};
