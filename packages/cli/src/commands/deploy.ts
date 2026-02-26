import type { Command, CommandContext } from '../core/command-registry.js';

export const deployCommand: Command = {
  name: 'deploy',
  description: 'Deploy strategy to live trading',
  async execute(_args: string, context: CommandContext): Promise<void> {
    const state = context.strategyAgent.currentState;
    if (!state.versionHash || !state.currentName) {
      context.addSystemMessage('No saved strategy to deploy. Use /save first.');
      return;
    }

    context.onRequestConfirm({
      title: 'LIVE DEPLOYMENT',
      details: [
        `Strategy: ${state.currentName}`,
        `Version: ${state.versionHash}`,
        'Mode: LIVE TRADING (REAL MONEY)',
        'This will deploy to your connected exchange.',
      ],
      confirmText: 'CONFIRM LIVE',
      onConfirm: async () => {
        try {
          context.addSystemMessage('Deploying to live trading...');

          let riskProfileId: string;
          try {
            const riskProfile = await context.engineClient.getRiskProfile();
            riskProfileId = riskProfile.id;
          } catch {
            context.addSystemMessage(
              'Failed to fetch risk profile. Please configure risk controls first using /risk commands.',
            );
            return;
          }

          const result = await context.engineClient.deployLive({
            strategy_version_hash: state.versionHash!,
            trading_pair: _args.trim() || 'BTC/USDT',
            risk_profile_id: riskProfileId,
            confirmed_by_session: `cli-${Date.now()}`,
          });
          context.addSystemMessage(
            `Live session started!\n` +
            `  Session ID: ${result.id}\n` +
            `  State: ${result.lifecycle_state}`
          );
        } catch (error) {
          context.addSystemMessage(`Deploy failed: ${error instanceof Error ? error.message : String(error)}`);
        }
      },
      onCancel: () => {
        context.addSystemMessage('Deployment cancelled.');
      },
    });
  },
};
