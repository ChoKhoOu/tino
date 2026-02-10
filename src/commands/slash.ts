/**
 * Slash command handler for the Tino CLI.
 *
 * Parses user input starting with `/` and returns a structured result
 * indicating whether the command was handled and what action to take.
 */

// ─── Types ──────────────────────────────────────────────────────────────────

export type SlashAction =
  | 'model'
  | 'clear'
  | 'skill'
  | 'help'
  | 'exit';

export interface SlashCommandResult {
  /** Whether the command was recognized and handled */
  handled: boolean;
  /** Human-readable output to display directly (e.g. /help) */
  output?: string;
  /** Action type for the CLI to dispatch */
  action?: SlashAction;
  /** Optional arguments passed to the command */
  args?: string[];
}

// ─── Command registry ───────────────────────────────────────────────────────

export const SLASH_COMMANDS: Record<string, string> = {
  '/model': 'Switch LLM model/provider',
  '/clear': 'Clear conversation history',
  '/skill': 'List or load a skill — /skill [name]',
  '/help': 'Show available commands',
  '/exit': 'Quit the application',
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
        args,
      };

    case '/clear':
      return {
        handled: true,
        action: 'clear',
        output: 'Conversation cleared.',
      };

    case '/skill':
      return {
        handled: true,
        action: 'skill',
        args,
      };

    case '/exit':
      return {
        handled: true,
        action: 'exit',
      };

    default:
      // Starts with / but not a recognized command
      return { handled: false };
  }
}
