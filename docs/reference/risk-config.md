# Risk Config Reference

The risk engine reads configuration from `.tino/risk.json` in your project directory. If the file doesn't exist, defaults are used. The config is reloaded on each risk engine initialization.

## File Location

```
.tino/risk.json
```

## Full Schema

```json
{
  "maxPositionSize": {
    "<instrument>": "<number>",
    "*": "<number>"
  },
  "maxGrossExposure": "<number>",
  "maxDailyLoss": "<number>",
  "maxDrawdown": "<number>",
  "maxOrderRate": "<number>"
}
```

## Fields

### maxPositionSize

| Property | Value |
|----------|-------|
| **Type** | `Record<string, number>` |
| **Default** | `{ "BTCUSDT": 1.0, "ETHUSDT": 10.0, "*": 100.0 }` |
| **Description** | Maximum position quantity per instrument. Keys are instrument symbols. The `*` wildcard sets the default for instruments without a specific entry. |

**Behavior:** Before each order, the engine calculates `currentPosition + orderQuantity`. If this exceeds the limit for the instrument (or the `*` fallback), the order is rejected.

**Example:**

```json
{
  "maxPositionSize": {
    "BTCUSDT": 0.5,
    "ETHUSDT": 5.0,
    "SOLUSDT": 100.0,
    "*": 50.0
  }
}
```

### maxGrossExposure

| Property | Value |
|----------|-------|
| **Type** | `number` |
| **Default** | `10000` |
| **Unit** | USDT |
| **Description** | Maximum total portfolio exposure across all positions. Calculated as the sum of `abs(quantity) * price` for each position. |

**Behavior:** Before each order, the engine calculates total gross exposure including the new order. If it exceeds the limit, the order is rejected.

**Example:**

```json
{
  "maxGrossExposure": 25000
}
```

### maxDailyLoss

| Property | Value |
|----------|-------|
| **Type** | `number` |
| **Default** | `500` |
| **Unit** | USDT |
| **Description** | Maximum cumulative daily realized loss. Resets at midnight or on manual reset. |

**Behavior:** If `dailyPnl <= -maxDailyLoss`, all subsequent orders are rejected until the counter resets.

**Example:**

```json
{
  "maxDailyLoss": 200
}
```

### maxDrawdown

| Property | Value |
|----------|-------|
| **Type** | `number` |
| **Default** | `0.15` |
| **Unit** | Decimal ratio (0.15 = 15%) |
| **Description** | Maximum portfolio drawdown from peak equity. Triggers the kill switch when breached. |

**Behavior:** Drawdown is calculated as `(peakEquity - currentEquity) / peakEquity`. When drawdown >= `maxDrawdown`, the kill switch activates: all orders are cancelled and all positions are flattened. This is the only rule that triggers the kill switch.

**Example:**

```json
{
  "maxDrawdown": 0.10
}
```

### maxOrderRate

| Property | Value |
|----------|-------|
| **Type** | `number` |
| **Default** | `10` |
| **Unit** | Orders per minute |
| **Description** | Maximum number of orders in a sliding 1-minute window. Prevents runaway algorithms. |

**Behavior:** The engine maintains timestamps of recent orders. If the count of orders within the last 60 seconds >= `maxOrderRate`, new orders are rejected.

**Example:**

```json
{
  "maxOrderRate": 5
}
```

## Default Configuration

The full default config used when `.tino/risk.json` is absent:

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

## Risk Profile Examples

### Conservative (Learning / Small Account)

```json
{
  "maxPositionSize": {
    "BTCUSDT": 0.01,
    "ETHUSDT": 0.1,
    "*": 1.0
  },
  "maxGrossExposure": 500,
  "maxDailyLoss": 25,
  "maxDrawdown": 0.05,
  "maxOrderRate": 3
}
```

### Moderate (Paper Trading Graduation)

```json
{
  "maxPositionSize": {
    "BTCUSDT": 0.5,
    "ETHUSDT": 5.0,
    "SOLUSDT": 50.0,
    "*": 25.0
  },
  "maxGrossExposure": 10000,
  "maxDailyLoss": 500,
  "maxDrawdown": 0.15,
  "maxOrderRate": 10
}
```

### Aggressive (Experienced Trader)

```json
{
  "maxPositionSize": {
    "BTCUSDT": 5.0,
    "ETHUSDT": 50.0,
    "SOLUSDT": 500.0,
    "*": 1000.0
  },
  "maxGrossExposure": 100000,
  "maxDailyLoss": 5000,
  "maxDrawdown": 0.25,
  "maxOrderRate": 60
}
```

## Risk Event Log

All risk events (refused orders, kill switch triggers) are logged to `.tino/risk-events.log` as newline-delimited JSON:

```json
{"timestamp":"2025-01-15T10:30:00.000Z","event":"pre_trade_refused","order":{...},"reason":"..."}
{"timestamp":"2025-01-15T11:45:00.000Z","event":"kill_switch_triggered","positions":{...}}
{"timestamp":"2025-01-15T11:45:01.000Z","event":"kill_switch_error","error":"..."}
```

## Related

- [Risk Management Guide](/guides/risk-management) -- how the risk engine works in practice
- [Live Trading Guide](/guides/live-trading) -- graduation workflow and safety gates
- [Settings Reference](/reference/settings) -- exchange and provider configuration
