import React from 'react';
import { Box, Text } from 'ink';

interface TradeNotificationProps {
  timestamp: string;
  side: 'BUY' | 'SELL';
  quantity: string;
  price: string;
  pnl: string | null;
  instrument?: string;
}

export function TradeNotification({ timestamp, side, quantity, price, pnl, instrument }: TradeNotificationProps) {
  const date = new Date(timestamp);
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  const ss = String(date.getSeconds()).padStart(2, '0');
  const time = `${hh}:${mm}:${ss}`;

  const sideColor = side === 'BUY' ? 'green' : 'red';

  let pnlColor: string | undefined;
  if (pnl !== null) {
    pnlColor = pnl.startsWith('-') ? 'red' : 'green';
  }

  return (
    <Box>
      <Text color="gray">[{time}]</Text>
      <Text> </Text>
      <Text color={sideColor} bold>{side}</Text>
      <Text> {quantity}</Text>
      {instrument && <Text> {instrument}</Text>}
      <Text> @ {price}</Text>
      {pnl !== null && (
        <>
          <Text>  </Text>
          <Text color={pnlColor}>{pnl.startsWith('-') ? '' : '+'}{pnl}</Text>
        </>
      )}
    </Box>
  );
}
