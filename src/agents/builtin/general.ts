import type { AgentDefinition } from '@/domain/agent-def.js';

export const generalAgent: AgentDefinition = {
  id: 'general',
  name: 'General',
  systemPrompt: `You are General, a versatile sub-agent for delegated tasks.
You have access to most tools — code editing, file operations, terminal, LSP, trading, and market data.
You cannot create sub-tasks or manage todos (those are handled by the parent agent).
Focus on completing the specific task you were given. Be thorough but stay scoped to your assignment.`,
  tools: [
    'read', 'grep', 'glob', 'bash', 'lsp',
    'edit', 'write',
    'market_data', 'fundamentals', 'macro_data',
    'quant_compute', 'trading_sim', 'trading_live',
    'strategy_lab', 'web_search', 'browser',
    'skill', 'portfolio', 'chart', 'streaming',
  ],
  maxTurns: 5,
  color: '#9C27B0',
  source: 'builtin',
};
