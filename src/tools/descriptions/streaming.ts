export const STREAMING_DESCRIPTION = `
Subscribe to real-time market data streams via the Tino daemon's WebSocket bridge. All streaming goes through gRPC — no direct WebSocket connections from the CLI.

## When to Use

- Monitoring live price updates for one or more instruments
- Subscribing to real-time quotes, trades, or bar data
- Checking which instruments are currently being streamed
- Stopping a stream when monitoring is no longer needed

## When NOT to Use

- Fetching historical price data (use market_data)
- Running backtests or paper trades (use trading_sim)
- Submitting live orders (use trading_live)

## Actions

| Action | Description | Required Params |
|--------|-------------|-----------------|
| subscribe | Start a real-time data stream for an instrument | instrument, source, event_type |
| unsubscribe | Stop streaming data for an instrument | instrument, source |
| list_subscriptions | List all active streaming subscriptions | none |

## Sources

Supported data sources: polygon, coinbase, finnhub (depends on daemon configuration and API keys).

## Event Types

- quote: Bid/ask quotes
- trade: Individual trades
- bar: Aggregated OHLCV bars

## Safety Notes

- Streaming is read-only — it cannot modify positions or submit orders
- Requires the Tino daemon to be running with the streaming service enabled
- Subscribe collects initial events then returns; the stream continues in the daemon
`.trim();
