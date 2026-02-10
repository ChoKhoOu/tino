/**
 * Rich description for the strategy_gen tool.
 * Used in the system prompt to guide the LLM on when and how to use this tool.
 */
export const STRATEGY_GEN_DESCRIPTION = `
Generate NautilusTrader strategy Python code from natural language with built-in safety guardrails. The tool creates a complete Strategy class implementation and validates dangerous imports and dynamic execution patterns before returning code.

## Trigger Phrases

- "generate strategy"
- "create trading strategy"
- "write strategy code"
- "draft NautilusTrader strategy"

## When to Use

- User wants a new strategy implementation from plain-language requirements
- User needs a strategy skeleton with lifecycle methods (\`on_start\`, \`on_bar\`, optional \`on_stop\`)
- User needs optimization-ready parameters and a suggested file path in \`strategies/\`
- User asks for guardrail-checked strategy code before backtesting

## When NOT to Use

- Running a backtest or paper/live trading session (use \`trading_ops\`)
- Fetching market data or fundamentals (use \`financial_search\`/\`financial_metrics\`)
- General quant calculations without strategy code generation (use \`quant_analysis\`)

## Safety Guardrails

- Rejects dangerous imports (\`os\`, \`subprocess\`, \`socket\`, \`shutil\`, \`requests\`, \`urllib\`, and \`pathlib\` import patterns)
- Rejects dynamic code execution (\`exec\`, \`eval\`, \`compile\`, \`__import__\`)
- Requires generated class inheritance from \`Strategy\`
- Warns when required lifecycle methods are missing

## Usage Notes

- Provide a clear strategy description, instrument, and timeframe when possible
- Tool returns code, class name, validation results, and suggested path
- Generated code should always be user-reviewed before execution
`.trim();
