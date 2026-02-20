/**
 * CSV parser that handles multi-line quoted fields,
 * plus a sampling utility.
 */

import type { Example } from './types.js';

// ============================================================================
// CSV Parser - handles multi-line quoted fields
// ============================================================================

export function parseCSV(csvContent: string): Example[] {
  const examples: Example[] = [];
  const lines = csvContent.split('\n');

  let i = 1; // Skip header row

  while (i < lines.length) {
    const result = parseRow(lines, i);
    if (result) {
      const { row, nextIndex } = result;
      if (row.length >= 2 && row[0].trim()) {
        examples.push({
          inputs: { question: row[0] },
          outputs: { answer: row[1] },
        });
      }
      i = nextIndex;
    } else {
      i++;
    }
  }

  return examples;
}

function parseRow(
  lines: string[],
  startIndex: number,
): { row: string[]; nextIndex: number } | null {
  if (startIndex >= lines.length || !lines[startIndex].trim()) {
    return null;
  }

  const fields: string[] = [];
  let currentField = '';
  let inQuotes = false;
  let lineIndex = startIndex;
  let charIndex = 0;

  while (lineIndex < lines.length) {
    const line = lines[lineIndex];

    while (charIndex < line.length) {
      const char = line[charIndex];
      const nextChar = line[charIndex + 1];

      if (inQuotes) {
        if (char === '"' && nextChar === '"') {
          // Escaped quote
          currentField += '"';
          charIndex += 2;
        } else if (char === '"') {
          // End of quoted field
          inQuotes = false;
          charIndex++;
        } else {
          currentField += char;
          charIndex++;
        }
      } else {
        if (char === '"') {
          // Start of quoted field
          inQuotes = true;
          charIndex++;
        } else if (char === ',') {
          // End of field
          fields.push(currentField);
          currentField = '';
          charIndex++;
        } else {
          currentField += char;
          charIndex++;
        }
      }
    }

    if (inQuotes) {
      // Continue to next line (multi-line field)
      currentField += '\n';
      lineIndex++;
      charIndex = 0;
    } else {
      // Row complete
      fields.push(currentField);
      return { row: fields, nextIndex: lineIndex + 1 };
    }
  }

  // Handle case where file ends while in quotes
  if (currentField) {
    fields.push(currentField);
  }
  return { row: fields, nextIndex: lineIndex };
}

// ============================================================================
// Sampling utilities
// ============================================================================

export function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}
