import React from 'react';
import { Box } from 'ink';

interface ScrollableContentProps {
  flexGrow?: number;
  height?: number;
  children: React.ReactNode;
}

export function ScrollableContent({ flexGrow, height, children }: ScrollableContentProps) {
  // Reverse children to work with flexDirection="column-reverse"
  // This ensures content sticks to the bottom and overflows from the top
  const reversedChildren = React.Children.toArray(children).reverse();
  
  return (
    <Box flexDirection="column-reverse" flexGrow={flexGrow} height={height} overflow="hidden">
      {reversedChildren}
    </Box>
  );
}
