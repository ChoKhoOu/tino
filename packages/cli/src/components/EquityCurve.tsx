import React, { useMemo } from 'react';
import { Box, Text } from 'ink';

// simple-ascii-chart is a CJS module that sets `exports.default = plot`.
// Under moduleResolution: NodeNext, the default import resolves to the module
// namespace rather than the function directly. Use createRequire for a clean CJS import.
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const plot = require('simple-ascii-chart').default as (
  coordinates: Array<[number, number]>,
  settings?: { width?: number; height?: number; title?: string },
) => string;

interface EquityCurveProps {
  data: Array<{ timestamp: string; equity: string }>;
  width?: number;
  height?: number;
}

export function EquityCurve({ data, width = 60, height = 15 }: EquityCurveProps) {
  const chart = useMemo(() => {
    if (data.length < 2) return null;

    const points: Array<[number, number]> = data.map((point, index) => [
      index,
      parseFloat(point.equity),
    ]);

    return plot(points, { width, height });
  }, [data, width, height]);

  if (data.length < 2) {
    return (
      <Box borderStyle="single" borderColor="gray" paddingX={1}>
        <Text color="gray">Insufficient data for chart</Text>
      </Box>
    );
  }

  const startDate = data[0].timestamp.split('T')[0];
  const endDate = data[data.length - 1].timestamp.split('T')[0];

  return (
    <Box flexDirection="column" borderStyle="single" borderColor="cyan" paddingX={1}>
      <Text color="cyan" bold>
        Equity Curve
      </Text>
      <Text>{chart}</Text>
      <Text color="gray">
        {startDate} — {endDate}
      </Text>
    </Box>
  );
}
