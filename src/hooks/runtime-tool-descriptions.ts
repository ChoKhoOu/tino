import * as descriptions from '@/tools/descriptions/index.js';

interface ToolLike {
  id: string;
  description: string;
}

const RICH_TOOL_DESCRIPTIONS: Record<string, string> = {
  market_data: descriptions.MARKET_DATA_DESCRIPTION,
  fundamentals: descriptions.FUNDAMENTALS_DESCRIPTION,
  macro_data: descriptions.MACRO_DATA_DESCRIPTION,
  quant_compute: descriptions.QUANT_COMPUTE_DESCRIPTION,
  trading_sim: descriptions.TRADING_SIM_DESCRIPTION,
  trading_live: descriptions.TRADING_LIVE_DESCRIPTION,
  strategy_lab: descriptions.STRATEGY_LAB_DESCRIPTION,
  web_search: descriptions.WEB_SEARCH_DESCRIPTION,
  browser: descriptions.BROWSER_DESCRIPTION,
  portfolio: descriptions.PORTFOLIO_DESCRIPTION,
  chart: descriptions.CHART_DESCRIPTION,
  streaming: descriptions.STREAMING_DESCRIPTION,
  read_file: descriptions.READ_DESCRIPTION,
  write_file: descriptions.WRITE_DESCRIPTION,
  edit_file: descriptions.EDIT_DESCRIPTION,
  bash: descriptions.BASH_DESCRIPTION,
  grep: descriptions.GREP_DESCRIPTION,
  glob: descriptions.GLOB_DESCRIPTION,
  lsp: descriptions.LSP_DESCRIPTION,
  task: descriptions.TASK_DESCRIPTION,
  todo_write: descriptions.TODO_DESCRIPTION,
  question: descriptions.QUESTION_DESCRIPTION,
};

export function buildToolDescriptions(tools: ToolLike[]): string {
  return tools
    .map((tool) => `### ${tool.id}\n\n${RICH_TOOL_DESCRIPTIONS[tool.id] ?? tool.description}`)
    .join('\n\n');
}
