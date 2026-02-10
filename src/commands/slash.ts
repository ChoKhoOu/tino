/**
 * Slash command handler for the Tino CLI.
 *
 * Parses user input starting with `/` and returns a structured result
 * indicating whether the command was handled and what action to take.
 */

// ─── Types ──────────────────────────────────────────────────────────────────

export type SlashAction =
  | 'export'
  | 'backtest'
  | 'positions'
  | 'stop'
  | 'data'
  | 'model'
  | 'help';

export interface SlashCommandResult {
  /** Whether the command was recognized and handled */
  handled: boolean;
  /** Human-readable output to display directly (e.g. /help) */
  output?: string;
  /** Action type for the CLI to dispatch */
  action?: SlashAction;
  /** Reformulated query to send to the agent (for commands that delegate) */
  agentQuery?: string;
}

// ─── Command registry ───────────────────────────────────────────────────────

export const SLASH_COMMANDS: Record<string, string> = {
  '/export': 'Save last result as markdown report',
  '/backtest': 'Quick backtest shortcut — /backtest <strategy>',
  '/positions': 'Show current positions',
  '/stop': 'Kill switch — immediately stop all trading',
  '/data': 'Show available data — /data <instrument>',
  '/model': 'Switch LLM model/provider',
  '/help': 'Show available commands',
};

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatHelpText(): string {
  const lines = ['Available commands:', ''];
  for (const [cmd, desc] of Object.entries(SLASH_COMMANDS)) {
    lines.push(`  ${cmd.padEnd(14)} ${desc}`);
  }
  return lines.join('\n');
}

// ─── Parser ─────────────────────────────────────────────────────────────────

/**
 * Parse a user input string and return a SlashCommandResult if it is a
 * recognized slash command, or `null` if the input is not a slash command.
 */
export function parseSlashCommand(input: string): SlashCommandResult | null {
  const trimmed = input.trim();

  // Not a slash command at all
  if (!trimmed.startsWith('/')) {
    return null;
  }

  const parts = trimmed.split(/\s+/);
  const command = parts[0].toLowerCase();
  const args = parts.slice(1);

  switch (command) {
    case '/help':
      return {
        handled: true,
        action: 'help',
        output: formatHelpText(),
      };

    case '/model':
      return {
        handled: true,
        action: 'model',
      };

    case '/export':
      return {
        handled: true,
        action: 'export',
        output: 'Exporting last result as markdown report...',
      };

    case '/backtest': {
      const strategy = args.join(' ') || undefined;
      if (!strategy) {
        return {
          handled: true,
          action: 'backtest',
          output: 'Usage: /backtest <strategy>',
        };
      }
      return {
        handled: true,
        action: 'backtest',
        agentQuery: `Run a backtest for the "${strategy}" strategy. Use the backtest tool with strategy name "${strategy}".`,
      };
    }

    case '/positions':
      return {
        handled: true,
        action: 'positions',
        agentQuery: 'Show all current open positions with P&L summary.',
      };

    case '/stop':
      return {
        handled: true,
        action: 'stop',
        agentQuery: 'EMERGENCY: Immediately cancel all open orders and flatten all positions. This is a kill switch command.',
      };

    case '/data': {
      const instrument = args.join(' ') || undefined;
      if (!instrument) {
        return {
          handled: true,
          action: 'data',
          agentQuery: 'List all available data sources and instruments in the data catalog.',
        };
      }
      return {
        handled: true,
        action: 'data',
        agentQuery: `Show available market data for "${instrument}" including price history, fundamentals, and any cached datasets.`,
      };
    }

    default:
      // Starts with / but not a recognized command
      return { handled: false };
  }
}
