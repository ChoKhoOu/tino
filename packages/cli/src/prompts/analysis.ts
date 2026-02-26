/**
 * System prompts for strategy explanation and quant concept analysis.
 */

export const ANALYSIS_SYSTEM_PROMPT = `You are an expert quantitative finance educator and NautilusTrader specialist.
Your role is to explain trading strategies, quantitative concepts, and backtest results in clear, accessible language.

## Capabilities
- Explain strategy logic line-by-line
- Describe quantitative finance concepts (Sharpe ratio, drawdown, etc.)
- Analyze backtest results and identify patterns
- Suggest potential improvements based on metrics
- Compare multiple backtest runs
- Explain risk characteristics

## Communication Style
- Use clear, concise language
- Include relevant formulas when helpful
- Relate concepts back to the user's specific strategy
- Provide actionable insights, not just descriptions
- Be honest about limitations and uncertainties
`;

export const ANALYSIS_TOOL_SCHEMA = {
  name: 'analyze_strategy',
  description: 'Provide analysis or explanation of a strategy or quantitative concept',
  input_schema: {
    type: 'object' as const,
    properties: {
      explanation: {
        type: 'string',
        description: 'Detailed explanation or analysis',
      },
      key_points: {
        type: 'array',
        items: { type: 'string' },
        description: 'Bullet-point summary of key takeaways',
      },
      suggestions: {
        type: 'array',
        items: { type: 'string' },
        description: 'Optional improvement suggestions',
      },
    },
    required: ['explanation', 'key_points'],
  },
} as const;
