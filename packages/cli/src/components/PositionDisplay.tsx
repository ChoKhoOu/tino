import React from 'react';
import { Box, Text } from 'ink';

interface Position {
  instrument: string;
  side: string;
  quantity: string;
  avg_entry_price: string;
  unrealized_pnl: string;
}

interface PositionDisplayProps {
  positions: Position[];
  totalUnrealizedPnl?: string;
  totalRealizedPnl?: string;
}

export function PositionDisplay({ positions, totalUnrealizedPnl, totalRealizedPnl }: PositionDisplayProps) {
  if (positions.length === 0) {
    return (
      <Box>
        <Text dimColor>No open positions</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" borderStyle="single" borderColor="gray" paddingX={1}>
      <Text bold>Open Positions</Text>
      {positions.map((pos, i) => {
        const pnlNum = parseFloat(pos.unrealized_pnl);
        const pnlColor = pnlNum >= 0 ? 'green' : 'red';
        return (
          <Box key={i} gap={2}>
            <Text>{pos.side === 'LONG' ? '\u2191' : '\u2193'} {pos.instrument}</Text>
            <Text dimColor>qty: {pos.quantity}</Text>
            <Text dimColor>entry: {pos.avg_entry_price}</Text>
            <Text color={pnlColor}>PnL: {pos.unrealized_pnl}</Text>
          </Box>
        );
      })}
      {(totalUnrealizedPnl || totalRealizedPnl) && (
        <Box gap={2} marginTop={1}>
          {totalUnrealizedPnl && (
            <Text>Unrealized: <Text color={parseFloat(totalUnrealizedPnl) >= 0 ? 'green' : 'red'}>{totalUnrealizedPnl}</Text></Text>
          )}
          {totalRealizedPnl && (
            <Text>Realized: <Text color={parseFloat(totalRealizedPnl) >= 0 ? 'green' : 'red'}>{totalRealizedPnl}</Text></Text>
          )}
        </Box>
      )}
    </Box>
  );
}
