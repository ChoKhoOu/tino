/**
 * Box-drawing character constants and table rendering helpers.
 *
 * Used by markdown-table.ts for converting markdown tables to
 * properly-aligned Unicode box-drawing tables.
 */

// Box-drawing characters
export const BOX = {
  topLeft: '\u250c',
  topRight: '\u2510',
  bottomLeft: '\u2514',
  bottomRight: '\u2518',
  horizontal: '\u2500',
  vertical: '\u2502',
  topT: '\u252c',
  bottomT: '\u2534',
  leftT: '\u251c',
  rightT: '\u2524',
  cross: '\u253c',
};

/**
 * Check if a string looks like a number (for right-alignment).
 */
export function isNumeric(value: string): boolean {
  const trimmed = value.trim();
  // Match numbers with optional $, %, B/M/K suffixes
  return /^[$]?[-+]?[\d,]+\.?\d*[%BMK]?$/.test(trimmed);
}

/**
 * Render a parsed table as a Unicode box-drawing table.
 */
export function renderBoxTable(headers: string[], rows: string[][]): string {
  // Calculate column widths
  const colWidths: number[] = headers.map(h => h.length);

  for (const row of rows) {
    for (let i = 0; i < row.length; i++) {
      if (i < colWidths.length) {
        colWidths[i] = Math.max(colWidths[i], row[i].length);
      }
    }
  }

  // Determine alignment for each column (right for numeric, left for text)
  const alignRight: boolean[] = headers.map((_, colIndex) => {
    // Check if most values in this column are numeric
    let numericCount = 0;
    for (const row of rows) {
      if (row[colIndex] && isNumeric(row[colIndex])) {
        numericCount++;
      }
    }
    return numericCount > rows.length / 2;
  });

  // Helper to pad a cell
  const padCell = (value: string, width: number, rightAlign: boolean): string => {
    if (rightAlign) {
      return value.padStart(width);
    }
    return value.padEnd(width);
  };

  // Build the table
  const lines: string[] = [];

  // Top border
  const topBorder = BOX.topLeft +
    colWidths.map(w => BOX.horizontal.repeat(w + 2)).join(BOX.topT) +
    BOX.topRight;
  lines.push(topBorder);

  // Header row
  const headerRow = BOX.vertical +
    headers.map((h, i) => ` ${padCell(h, colWidths[i], false)} `).join(BOX.vertical) +
    BOX.vertical;
  lines.push(headerRow);

  // Header separator
  const headerSep = BOX.leftT +
    colWidths.map(w => BOX.horizontal.repeat(w + 2)).join(BOX.cross) +
    BOX.rightT;
  lines.push(headerSep);

  // Data rows
  for (const row of rows) {
    const dataRow = BOX.vertical +
      colWidths.map((w, i) => {
        const value = row[i] || '';
        return ` ${padCell(value, w, alignRight[i])} `;
      }).join(BOX.vertical) +
      BOX.vertical;
    lines.push(dataRow);
  }

  // Bottom border
  const bottomBorder = BOX.bottomLeft +
    colWidths.map(w => BOX.horizontal.repeat(w + 2)).join(BOX.bottomT) +
    BOX.bottomRight;
  lines.push(bottomBorder);

  return lines.join('\n');
}
