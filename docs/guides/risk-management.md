# Risk Management

Tino enforces risk limits through a configurable rule engine that runs pre-trade checks on every live order. The risk engine operates locally -- no external dependencies.

## Risk Configuration

Risk rules are defined in `.tino/risk.json` in your project directory. If the file doesn't exist, Tino uses built-in defaults.

### Default Configuration

```json
{
  "maxPositionSize": {
    "BTCUSDT": 1.0,
    "ETHUSDT": 10.0,
    "*": 100.0
  },
  "maxGrossExposure": 10000,
  "maxDailyLoss": 500,
  "maxDrawdown": 0.15,
  "maxOrderRate": 10
}
```

### Creating Your Risk Config

Create `.tino/risk.json` in your project directory:

```bash
mkdir -p .tino
cat > .tino/risk.json << 'EOF'
{
  "maxPositionSize": {
    "BTCUSDT": 0.5,
    "ETHUSDT": 5.0,
    "SOLUSDT": 50.0,
    "*": 25.0
  },
  "maxGrossExposure": 5000,
  "maxDailyLoss": 250,
  "maxDrawdown": 0.10,
  "maxOrderRate": 5
}
EOF
```

## The Five Risk Rules

### 1. Max Position Size

Limits the maximum quantity per instrument. Uses per-symbol overrides with a wildcard fallback.

```json
{
  "maxPositionSize": {
    "BTCUSDT": 1.0,
    "ETHUSDT": 10.0,
    "*": 100.0
  }
}
```

- `BTCUSDT: 1.0` -- max 1 BTC position
- `ETHUSDT: 10.0` -- max 10 ETH position
- `*: 100.0` -- default max 100 units for any other instrument

**When triggered:** Order is rejected with a message showing the attempted size vs the limit.

### 2. Max Gross Exposure

Limits total portfolio exposure in USDT across all positions.

```json
{
  "maxGrossExposure": 10000
}
```

Gross exposure is the sum of `abs(quantity) * price` across all positions. A new order is rejected if it would push total exposure above the limit.

**When triggered:** Order is rejected with current exposure vs limit.

### 3. Max Daily Loss

Stops all trading when cumulative daily realized PnL hits the loss limit.

```json
{
  "maxDailyLoss": 500
}
```

The daily loss counter resets at midnight. Any order submitted after the daily loss limit is reached will be refused.

**When triggered:** All orders refused until the next day or manual reset.

### 4. Max Drawdown

Triggers the kill switch when portfolio drawdown from peak equity exceeds the threshold.

```json
{
  "maxDrawdown": 0.15
}
```

Drawdown is calculated as `(peakEquity - currentEquity) / peakEquity`. A value of `0.15` means 15% drawdown triggers the kill switch.

**When triggered:** Kill switch activates -- all orders cancelled, all positions flattened.

### 5. Max Order Rate

Limits order submission frequency to prevent runaway algorithms.

```json
{
  "maxOrderRate": 10
}
```

Counts orders in a sliding 1-minute window. A value of `10` means max 10 orders per minute.

**When triggered:** Order is rejected. Resumes when the rate drops below the limit.

## Kill Switch

The kill switch is an emergency stop that:

1. Cancels all pending orders
2. Flattens all open positions
3. Logs the event to `.tino/risk-events.log`

### Manual Activation

```
You: Kill switch! Stop everything!
```

Or directly:

```
You: Activate the kill switch
```

### Automatic Activation

The kill switch triggers automatically when the `maxDrawdown` rule fires.

### Risk Event Log

All risk-related events are logged to `.tino/risk-events.log`:

```json
{"timestamp":"2025-01-15T10:30:00.000Z","event":"pre_trade_refused","order":{"instrument":"BTCUSDT","side":"buy","quantity":2.0},"reason":"Position size 2.0 exceeds limit 1.0 for BTCUSDT"}
{"timestamp":"2025-01-15T11:45:00.000Z","event":"kill_switch_triggered","positions":{"BTCUSDT":0.5,"ETHUSDT":3.0}}
```

## Graduation Workflow

Tino enforces a safety progression before live trading:

```
Backtest  -->  Paper Trade  -->  Live Trade
```

1. **Backtest** -- Validate strategy logic with historical data
2. **Paper Trade** -- Test execution with real-time data, no real money
3. **Live Trade** -- Deploy with real capital after passing safety gates

Each stage requires explicit user confirmation before advancing. The `trading_live` tool refuses execution without `confirmed=true`.

## Example: Conservative Crypto Config

```json
{
  "maxPositionSize": {
    "BTCUSDT": 0.1,
    "ETHUSDT": 1.0,
    "*": 10.0
  },
  "maxGrossExposure": 2000,
  "maxDailyLoss": 100,
  "maxDrawdown": 0.05,
  "maxOrderRate": 3
}
```

## Example: Active Trading Config

```json
{
  "maxPositionSize": {
    "BTCUSDT": 2.0,
    "ETHUSDT": 20.0,
    "SOLUSDT": 200.0,
    "*": 500.0
  },
  "maxGrossExposure": 50000,
  "maxDailyLoss": 2000,
  "maxDrawdown": 0.20,
  "maxOrderRate": 30
}
```

## Next Steps

- [Live Trading](/guides/live-trading) -- the full graduation workflow
- [Risk Config Reference](/reference/risk-config) -- complete schema documentation
- [Settings Reference](/reference/settings) -- exchange and provider configuration
