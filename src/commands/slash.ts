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
  | 'agents'
  | 'help'
  | 'exit'
  | 'compact'
  | 'context'
  | 'cost'
  | 'resume'
  | 'export'
  | 'rename'
  | 'rewind'
  | 'status'
  | 'permissions'
  | 'mcp'
  | 'config'
  | 'todos'
  | 'verbose'
  | 'doctor'
  | 'init';

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
  '/agents': 'List available agent definitions',
  '/help': 'Show available commands',
  '/exit': 'Quit the application',
  '/compact': 'Compact conversation context — /compact [focus]',
  '/context': 'Show current context window usage',
  '/cost': 'Show token usage and estimated cost',
  '/resume': 'Resume a previous session — /resume [session]',
  '/export': 'Export conversation to file — /export [filename]',
  '/rename': 'Rename current session — /rename <name>',
  '/rewind': 'Undo last assistant turn',
  '/status': 'Show system status and version info',
  '/permissions': 'Show tool permission settings',
  '/mcp': 'Show MCP server connections',
  '/config': 'Show current configuration',
  '/todos': 'Show active todo items',
  '/verbose': 'Toggle verbose output mode',
  '/doctor': 'Run health checks on your environment',
  '/init': 'Initialize project (.tino/ directory, settings, permissions)',
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

    case '/agents':
      return {
        handled: true,
        action: 'agents',
      };

    case '/exit':
      return {
        handled: true,
        action: 'exit',
      };

    case '/compact':
      return { handled: true, action: 'compact', args };

    case '/context':
      return { handled: true, action: 'context' };

    case '/cost':
      return { handled: true, action: 'cost' };

    case '/todos':
      return { handled: true, action: 'todos' };

    case '/resume':
      return { handled: true, action: 'resume', args };

    case '/export':
      return { handled: true, action: 'export', args };

    case '/rename':
      return { handled: true, action: 'rename', args };

    case '/status':
      return { handled: true, action: 'status' };

    case '/permissions':
      return { handled: true, action: 'permissions' };

    case '/mcp':
      return { handled: true, action: 'mcp' };

    case '/config':
      return { handled: true, action: 'config' };

    case '/rewind':
      return { handled: true, action: 'rewind' };

    case '/verbose':
      return { handled: true, action: 'verbose', output: 'Verbose mode toggled.' };

    case '/doctor':
      return { handled: true, action: 'doctor' };

    case '/init':
      return { handled: true, action: 'init' };

    default:
      // Starts with / but not a recognized command
      return { handled: false };
  }
}
