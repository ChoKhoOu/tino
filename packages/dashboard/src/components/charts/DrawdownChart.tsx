import React from 'react';
import ReactECharts from 'echarts-for-react';

interface DrawdownChartProps {
  equityData: Array<{ timestamp: string; equity: string }>;
  height?: number;
}

function computeDrawdown(equityData: Array<{ timestamp: string; equity: string }>) {
  let peak = 0;
  return equityData.map((point) => {
    const equity = parseFloat(point.equity);
    if (equity > peak) peak = equity;
    const drawdown = peak > 0 ? ((peak - equity) / peak) * 100 : 0;
    return { timestamp: point.timestamp, drawdown: -drawdown };
  });
}

export function DrawdownChart({ equityData, height = 200 }: DrawdownChartProps) {
  const drawdownData = computeDrawdown(equityData);

  const option = {
    backgroundColor: '#1a1a2e',
    tooltip: {
      trigger: 'axis',
      backgroundColor: '#2a2a3e',
      borderColor: '#3a3a4e',
      textStyle: { color: '#e0e0e0' },
      formatter: (params: any) => {
        const point = params[0];
        return `${point.axisValueLabel}<br/>Drawdown: ${Math.abs(point.value[1]).toFixed(2)}%`;
      },
    },
    grid: { left: '8%', right: '4%', top: '10%', bottom: '10%' },
    xAxis: {
      type: 'time',
      axisLine: { lineStyle: { color: '#3a3a4e' } },
      axisLabel: { color: '#a0a0a0' },
    },
    yAxis: {
      type: 'value',
      name: 'Drawdown (%)',
      nameTextStyle: { color: '#a0a0a0' },
      axisLine: { lineStyle: { color: '#3a3a4e' } },
      axisLabel: { color: '#a0a0a0', formatter: '{value}%' },
      splitLine: { lineStyle: { color: '#2a2a3e' } },
      max: 0,
    },
    visualMap: {
      show: false,
      pieces: [
        { lte: -20, color: '#ef5350' },
        { gt: -20, lte: -10, color: '#ffa726' },
        { gt: -10, lte: -5, color: '#ffee58' },
        { gt: -5, color: '#26a69a' },
      ],
      dimension: 1,
      seriesIndex: 0,
    },
    series: [
      {
        type: 'line',
        data: drawdownData.map((d) => [d.timestamp, d.drawdown]),
        areaStyle: { opacity: 0.3 },
        lineStyle: { width: 1 },
        showSymbol: false,
      },
    ],
  };

  return <ReactECharts option={option} style={{ height }} />;
}
