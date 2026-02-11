export const CHART_DESCRIPTION = `
Visualizes financial data using ANSI charts in the terminal.
Supports candlestick charts for OHLCV data, line charts for time series, and subplots for combining price and volume.
Use this tool when the user asks to "plot", "chart", "visualize", or "show" price data.
The output is a JSON object containing an 'ansiChart' string which should be rendered using the AnsiChart component.
`.trim();
