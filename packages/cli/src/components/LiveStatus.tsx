import React from 'react';
import { Box, Text } from 'ink';

interface Position {
  instrument: string;
  side: string;
  quantity: string;
  avg_entry_price: string;
  unrealized_pnl: string;
}

interface LiveStatusProps {
  sessionId: string;
  state: string;
  tradingPair: string;
  positions: Position[];
  realizedPnl: string;
  unrealizedPnl: string;
  openOrders: number;
}

export function LiveStatus({
  sessionId,
  state,
  tradingPair,
  positions,
  realizedPnl,
  unrealizedPnl,
  openOrders,
}: LiveStatusProps) {
  const stateColor =
    state === 'RUNNING'
      ? 'green'
      : state === 'PAUSED'
        ? 'yellow'
        : state === 'STOPPED'
          ? 'red'
          : 'cyan';

  return (
    <Box flexDirection="column" borderStyle="single" borderColor={stateColor} paddingX={1}>
      {/* Header */}
      <Box marginBottom={1}>
        <Text color="red" bold>
          LIVE
        </Text>
        <Text color="gray"> | </Text>
        <Text color="white">{tradingPair}</Text>
        <Text color="gray"> | </Text>
        <Text color={stateColor} bold>
          {state}
        </Text>
        <Text color="gray"> | </Text>
        <Text color="gray">{sessionId.slice(0, 8)}...</Text>
      </Box>

      {/* PnL */}
      <Box>
        <Box width={20}>
          <Text color="gray">Realized PnL:</Text>
        </Box>
        <Text color={parseFloat(realizedPnl) >= 0 ? 'green' : 'red'} bold>
          ${realizedPnl}
        </Text>
      </Box>
      <Box>
        <Box width={20}>
          <Text color="gray">Unrealized PnL:</Text>
        </Box>
        <Text color={parseFloat(unrealizedPnl) >= 0 ? 'green' : 'red'} bold>
          ${unrealizedPnl}
        </Text>
      </Box>
      <Box>
        <Box width={20}>
          <Text color="gray">Open Orders:</Text>
        </Box>
        <Text>{openOrders}</Text>
      </Box>

      {/* Positions */}
      {positions.length > 0 && (
        <Box flexDirection="column" marginTop={1}>
          <Text color="cyan" bold>
            Positions:
          </Text>
          {positions.map((pos, i) => (
            <Box key={i} paddingLeft={2}>
              <Text color={pos.side === 'LONG' ? 'green' : 'red'}>
                {pos.side}
              </Text>
              <Text>
                {' '}{pos.quantity} @ ${pos.avg_entry_price}
              </Text>
              <Text color={parseFloat(pos.unrealized_pnl) >= 0 ? 'green' : 'red'}>
                {' '}(${pos.unrealized_pnl})
              </Text>
            </Box>
          ))}
        </Box>
      )}

      {/* Controls hint */}
      <Box marginTop={1}>
        <Text color="gray" dimColor>
          Commands: pause | resume | stop | kill-switch
        </Text>
      </Box>
    </Box>
  );
}
