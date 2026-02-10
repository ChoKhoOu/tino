import React from 'react';
import { Box, Text } from 'ink';
import { colors } from '../../theme.js';

interface ColoredTableProps {
  headers: string[];
  rows: string[][];
  /** Column indices (0-based) that should be colored green/red based on sign */
  colorColumns?: number[];
  /** Column indices (0-based) that should be right-aligned (numeric) */
  alignRight?: number[];
}

/**
 * Format a numeric string with color based on sign.
 * Returns { text, color } for rendering.
 * Exported for testing.
 */
export function formatColoredValue(value: string): { text: string; color: string } {
  const trimmed = value.trim();
  const numericStr = trimmed.replace(/[,%$()]/g, '');
  const num = parseFloat(numericStr);

  if (isNaN(num)) {
    return { text: value, color: colors.white };
  }

  // Handle parenthesized negatives like (1,234)
  const isNegative = num < 0 || trimmed.startsWith('(');

  if (isNegative) {
    return { text: value, color: colors.error };
  } else if (num > 0) {
    return { text: value, color: colors.success };
  }
  return { text: value, color: colors.muted };
}

/**
 * Calculate the display width for each column based on content.
 */
function computeColumnWidths(headers: string[], rows: string[][]): number[] {
  const widths = headers.map((h) => h.length);
  for (const row of rows) {
    for (let i = 0; i < row.length; i++) {
      if (row[i] !== undefined) {
        widths[i] = Math.max(widths[i] ?? 0, row[i].length);
      }
    }
  }
  return widths;
}

/**
 * Pad a string to a given width, with optional right-alignment.
 */
function padCell(value: string, width: number, rightAlign: boolean): string {
  if (rightAlign) {
    return value.padStart(width);
  }
  return value.padEnd(width);
}

export function ColoredTable({
  headers,
  rows,
  colorColumns = [],
  alignRight = [],
}: ColoredTableProps) {
  const colWidths = computeColumnWidths(headers, rows);
  const colorSet = new Set(colorColumns);
  const rightSet = new Set(alignRight);
  const gap = '  ';

  return (
    <Box flexDirection="column">
      {/* Header row */}
      <Text bold color={colors.primary}>
        {headers.map((h, i) => padCell(h, colWidths[i], rightSet.has(i))).join(gap)}
      </Text>
      {/* Separator */}
      <Text color={colors.mutedDark}>
        {colWidths.map((w) => '─'.repeat(w)).join(gap)}
      </Text>
      {/* Data rows */}
      {rows.map((row, rowIdx) => (
        <Text key={`row-${row[0] ?? rowIdx}`}>
          {row.map((cell, colIdx) => {
            const padded = padCell(cell, colWidths[colIdx], rightSet.has(colIdx));
            const isLast = colIdx === row.length - 1;
            const suffix = isLast ? '' : gap;
            const cellKey = `${row[0] ?? rowIdx}-${headers[colIdx] ?? colIdx}`;

            if (colorSet.has(colIdx)) {
              const { color } = formatColoredValue(cell);
              return (
                <Text key={cellKey} color={color}>
                  {padded + suffix}
                </Text>
              );
            }
            return (
              <Text key={cellKey}>
                {padded + suffix}
              </Text>
            );
          })}
        </Text>
      ))}
    </Box>
  );
}
