import React, { useEffect, useRef } from 'react';
import { createChart, CandlestickSeries, createSeriesMarkers, type IChartApi, type CandlestickData } from 'lightweight-charts';

interface CandlestickChartProps {
  data: CandlestickData[];
  trades?: Array<{
    time: string;
    side: 'BUY' | 'SELL';
    price: number;
  }>;
  width?: number;
  height?: number;
}

export function CandlestickChart({ data, trades, height = 400 }: CandlestickChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      height,
      layout: {
        background: { color: '#1a1a2e' },
        textColor: '#e0e0e0',
      },
      grid: {
        vertLines: { color: '#2a2a3e' },
        horzLines: { color: '#2a2a3e' },
      },
      crosshair: {
        mode: 0,
      },
      timeScale: {
        borderColor: '#3a3a4e',
        timeVisible: true,
      },
      rightPriceScale: {
        borderColor: '#3a3a4e',
      },
    });

    const candlestickSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#26a69a',
      downColor: '#ef5350',
      borderDownColor: '#ef5350',
      borderUpColor: '#26a69a',
      wickDownColor: '#ef5350',
      wickUpColor: '#26a69a',
    });

    if (data.length > 0) {
      candlestickSeries.setData(data);
    }

    // Add trade markers
    if (trades && trades.length > 0) {
      const markers = trades.map((trade) => ({
        time: trade.time,
        position: trade.side === 'BUY' ? 'belowBar' as const : 'aboveBar' as const,
        color: trade.side === 'BUY' ? '#26a69a' : '#ef5350',
        shape: trade.side === 'BUY' ? 'arrowUp' as const : 'arrowDown' as const,
        text: trade.side,
      }));
      createSeriesMarkers(candlestickSeries, markers as any);
    }

    chart.timeScale().fitContent();
    chartRef.current = chart;

    const resizeObserver = new ResizeObserver(() => {
      if (containerRef.current) {
        chart.applyOptions({ width: containerRef.current.clientWidth });
      }
    });
    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
      chart.remove();
    };
  }, [data, trades, height]);

  return <div ref={containerRef} style={{ width: '100%' }} />;
}
