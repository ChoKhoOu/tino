import type { Command, CommandContext } from '../core/command-registry.js';

export const backtestCommand: Command = {
  name: 'backtest',
  description: 'Run a backtest on current strategy',
  async execute(args: string, context: CommandContext): Promise<void> {
    const state = context.strategyAgent.currentState;
    if (!state.versionHash) {
      context.addSystemMessage('No saved strategy. Use /save first, then /backtest.');
      return;
    }

    // Parse args: /backtest BTC/USDT 2024-01-01 2024-12-31
    const parts = args.trim().split(/\s+/);
    if (parts.length < 3 || !parts[0]) {
      context.addSystemMessage(
        'Usage: /backtest <trading_pair> <start_date> <end_date> [bar_type]\n' +
        'Example: /backtest BTC/USDT 2024-01-01 2024-12-31 1-HOUR'
      );
      return;
    }

    const [tradingPair, startDate, endDate, barType] = parts;

    try {
      context.addSystemMessage(`Submitting backtest for ${tradingPair}...`);
      const result = await context.engineClient.submitBacktest({
        strategy_version_hash: state.versionHash,
        trading_pair: tradingPair,
        start_date: startDate,
        end_date: endDate,
        bar_type: barType || '1-HOUR',
      });

      // Trigger backtest mode in app — app.tsx will handle WebSocket + rendering
      context.onStartBacktest(result.id, result.ws_url);
    } catch (error) {
      context.addSystemMessage(`Backtest submission failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  },
};
