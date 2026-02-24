# Skills

Skills are guided multi-step workflows that walk you through complex trading and research tasks. Each skill is a markdown-driven pipeline that orchestrates multiple tools in sequence.

## How Skills Work

Skills are defined as `SKILL.md` files in `src/skills/<name>/`. Each file has YAML frontmatter with a `name` and `description`, followed by a step-by-step workflow that the AI agent follows.

When you activate a skill, Tino loads the workflow and executes each step using the appropriate tools -- fetching data, running computations, generating strategies, and producing structured reports.

## Using Skills

### List Available Skills

```
You: /skill
```

### Activate a Skill

```
You: /skill backtest
```

Or just describe what you need -- Tino automatically matches your request to the right skill:

```
You: Run a comprehensive analysis on ETH
```

This activates the `comprehensive-research` skill without needing the `/skill` command.

## All Skills

### backtest

Run, configure, evaluate, or improve historical strategy simulations.

**Triggers:** "run backtest", "test strategy", "optimize parameters", "analyze backtest results"

```
You: /skill backtest
You: Backtest my momentum strategy on BTCUSDT over the last year
```

### comprehensive-research

End-to-end investment analysis combining fundamentals, technicals, and quantitative risk assessment.

**Triggers:** "full research", "comprehensive analysis", "analyze this stock deeply"

```
You: /skill comprehensive-research
You: Give me a full analysis of AAPL
```

### dcf-valuation

Discounted cash flow analysis to estimate intrinsic value per share.

**Triggers:** "fair value", "intrinsic value", "DCF", "what is X worth", "undervalued"

```
You: /skill dcf-valuation
You: What is the fair value of MSFT?
```

### options-analysis

Options pricing, Greeks calculation, strategy comparison, and payoff analysis.

**Triggers:** "price options", "Greeks", "options strategy", "calls and puts"

```
You: /skill options-analysis
You: Analyze a covered call on BTC with a $100k strike
```

### strategy-generation

Generate NautilusTrader strategy code from natural language descriptions.

**Triggers:** "generate strategy", "build a trading strategy", "create NautilusTrader strategy"

```
You: /skill strategy-generation
You: Generate a mean reversion strategy for ETHUSDT on 5-min bars
```

### paper-trade

Simulate live execution without real capital. Test strategies in real-time market conditions.

**Triggers:** "start paper trading", "run strategy in simulation", "monitor paper account"

```
You: /skill paper-trade
You: Paper trade my EMA crossover strategy on BTCUSDT
```

### live-trade

Deploy strategies with real capital. Includes safety guardrails and explicit confirmation gates.

**Triggers:** "go live", "enable live trading", "deploy to production", "trade with real money"

```
You: /skill live-trade
You: I'm ready to go live with my momentum strategy
```

### funding-rate-arb

Analyze funding rate arbitrage opportunities across perpetual futures. Identifies cash-and-carry trade setups.

**Triggers:** "funding rate arb", "funding rate arbitrage", "cash and carry trade", "perp basis trade"

```
You: /skill funding-rate-arb
You: Find funding rate arbitrage opportunities across major perps
```

The funding rate arb skill:
1. Fetches current rates across BTC, ETH, SOL, and other major perpetuals
2. Identifies anomalies vs 30-day historical means
3. Generates a delta-neutral arb strategy
4. Backtests with sensitivity analysis on entry/exit thresholds
5. Produces a report with yield estimates and risk assessment

## Next Steps

- [Risk Management](/guides/risk-management) -- configure safety rules before trading
- [Live Trading](/guides/live-trading) -- graduate from backtest to paper to live
- [Tools Reference](/reference/tools) -- see all 14 tools used by skills
