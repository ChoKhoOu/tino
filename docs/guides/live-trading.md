# Live Trading

Tino enforces a strict graduation workflow before allowing live trading with real capital. This guide covers the full path from backtest to production.

## The Graduation Path

```
Backtest  -->  Paper Trade  -->  Live Trade
```

Every strategy must pass through each stage. There are no shortcuts.

## Stage 1: Backtest

Run your strategy against historical data to validate the logic.

```
You: Backtest my EMA crossover strategy on BTCUSDT over the last 6 months
```

**What to look for:**
- Sharpe ratio > 1.0 (risk-adjusted return is reasonable)
- Max drawdown < 20% (losses are manageable)
- Profit factor > 1.5 (winners outweigh losers)
- Sufficient number of trades (not just luck)

**Use the backtest skill for a guided workflow:**

```
You: /skill backtest
```

## Stage 2: Paper Trading

Test your strategy with real-time market data but no real money.

```
You: Paper trade the EMA crossover strategy on BTCUSDT
```

Paper trading uses the `trading_sim` tool with `paper_trade` action. The NautilusTrader daemon runs the strategy against live market feeds.

**Monitor your paper account:**

```
You: Show my paper trading positions
You: What is my paper trading PnL today?
```

**Use the paper trade skill:**

```
You: /skill paper-trade
```

**What to verify:**
- Strategy behaves as expected with live data
- Order fills match backtest assumptions
- No unexpected behavior during volatile periods
- Acceptable slippage and execution quality

## Stage 3: Live Trading

Once paper trading confirms the strategy works, go live.

### The `confirmed=true` Gate

Every live order requires explicit confirmation. The `trading_live` tool refuses to execute without `confirmed=true` -- this is enforced at the tool level and cannot be bypassed.

```
You: I'm ready to go live with my momentum strategy on BTCUSDT

Tino: I'll submit a live BUY order for 0.1 BTC on BTCUSDT.
      This uses REAL MONEY. Do you confirm? (yes/no)

You: Yes, confirmed

Tino: [Submits order with confirmed=true]
```

### Venue Configuration

Live trading uses Binance by default:

| Venue | Description |
|-------|-------------|
| `SIM` | Default simulated venue (NautilusTrader internal matching engine) |
| `BINANCE` | Binance live exchange for real trading |

The `BINANCE` venue requires `BINANCE_API_KEY` and `BINANCE_API_SECRET` environment variables. See [Exchange Setup](/getting-started/exchange-setup).

### Use the Live Trade Skill

```
You: /skill live-trade
```

The skill guides you through:
1. Strategy validation and safety checks
2. Risk configuration review
3. Order submission with explicit confirmation
4. Position monitoring

## Monitoring Positions

Track your live portfolio at any time:

```
You: Show my open positions
You: What is my PnL today?
You: Show my trade history for BTCUSDT
```

The `portfolio` tool provides:
- **summary** -- total trades, open positions, realized/unrealized PnL, fees
- **trades** -- trade history with filters by instrument and date range
- **positions** -- current open positions with PnL
- **pnl_history** -- daily PnL entries over time

## Emergency Stop

If anything goes wrong, use the kill switch:

```
You: Kill switch! Stop everything!
```

This immediately:
1. Cancels all pending orders
2. Flattens all open positions
3. Logs the event for post-mortem

See [Risk Management](/guides/risk-management) for automatic kill switch triggers.

## Safety Summary

| Safety Feature | How It Works |
|---------------|-------------|
| `confirmed=true` gate | Every live order requires explicit user consent |
| Kill switch | Emergency stop cancels all orders and flattens positions |
| Strategy validation | Blocks dangerous imports (`os`, `subprocess`, `socket`, `exec`, `eval`) |
| Sandboxed execution | Strategies run in a controlled Python environment |
| Paper trading first | Agent always recommends paper trading before live |
| Testnet default | Binance defaults to testnet; mainnet requires explicit config |
| Risk engine | 5 pre-trade rules checked on every order submission |

## Next Steps

- [Risk Management](/guides/risk-management) -- configure the 5 risk rules
- [Skills](/guides/skills) -- all 9 pre-built research workflows
- [Tools Reference](/reference/tools) -- detailed tool documentation
