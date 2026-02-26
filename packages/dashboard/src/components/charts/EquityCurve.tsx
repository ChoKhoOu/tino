import React from 'react';
import ReactECharts from 'echarts-for-react';

interface EquityCurvePoint {
  timestamp: string;
  equity: string;
}

interface EquityCurveProps {
  data: EquityCurvePoint[];
  height?: number;
}

export function EquityCurve({ data, height = 300 }: EquityCurveProps) {
  const option = {
    backgroundColor: '#1a1a2e',
    tooltip: {
      trigger: 'axis',
      backgroundColor: '#2a2a3e',
      borderColor: '#3a3a4e',
      textStyle: { color: '#e0e0e0' },
    },
    grid: { left: '8%', right: '4%', top: '10%', bottom: '15%' },
    xAxis: {
      type: 'time',
      axisLine: { lineStyle: { color: '#3a3a4e' } },
      axisLabel: { color: '#a0a0a0' },
    },
    yAxis: {
      type: 'value',
      name: 'Equity ($)',
      nameTextStyle: { color: '#a0a0a0' },
      axisLine: { lineStyle: { color: '#3a3a4e' } },
      axisLabel: { color: '#a0a0a0' },
      splitLine: { lineStyle: { color: '#2a2a3e' } },
    },
    dataZoom: [
      { type: 'inside', start: 0, end: 100 },
      { type: 'slider', start: 0, end: 100, height: 20, bottom: 0 },
    ],
    series: [
      {
        type: 'line',
        data: data.map((d) => [d.timestamp, parseFloat(d.equity)]),
        smooth: true,
        lineStyle: { color: '#26a69a', width: 2 },
        areaStyle: {
          color: {
            type: 'linear',
            x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(38,166,154,0.3)' },
              { offset: 1, color: 'rgba(38,166,154,0.0)' },
            ],
          },
        },
        showSymbol: false,
      },
    ],
  };

  return <ReactECharts option={option} style={{ height }} />;
}
