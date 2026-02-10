/**
 * Better token estimation using character-based heuristics.
 * More accurate than simple text.length / 3.5 by detecting character types
 * and applying appropriate ratios per type.
 *
 * Typical ratios (for GPT-family tokenizers):
 * - English prose: ~4 chars per token
 * - Code (ASCII with symbols): ~3.5 chars per token
 * - CJK characters: ~1.5 chars per token (each char is often 1 token)
 * - Numbers/punctuation: ~3 chars per token
 * - Whitespace: contributes minimally (merged with adjacent tokens)
 */

// CJK Unified Ideographs ranges
const CJK_REGEX = /[\u2E80-\u2FFF\u3040-\u309F\u30A0-\u30FF\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF\uFF00-\uFFEF]/;

// Simple heuristic for "code-like" lines: contains common code patterns
const CODE_LINE_REGEX = /[{}();=<>[\]|&!]|\/\/|=>|function |const |let |var |import |export |return |class /;

/**
 * Estimate the number of tokens in a text string using character-based heuristics.
 * Analyzes character composition to apply weighted ratios for different character types.
 *
 * @param text - The text to estimate tokens for
 * @returns Estimated token count (always >= 0)
 */
export function estimateTokens(text: string): number {
  if (!text) return 0;

  let cjkChars = 0;
  let asciiChars = 0;
  let whitespaceChars = 0;
  let otherChars = 0;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;
    if (CJK_REGEX.test(ch)) {
      cjkChars++;
    } else if (/\s/.test(ch)) {
      whitespaceChars++;
    } else if (ch.charCodeAt(0) < 128) {
      asciiChars++;
    } else {
      // Non-ASCII, non-CJK (e.g., accented Latin, Cyrillic, etc.)
      otherChars++;
    }
  }

  // Determine if text is code-heavy by sampling lines
  const lines = text.split('\n');
  const sampleSize = Math.min(lines.length, 20);
  let codeLines = 0;
  for (let i = 0; i < sampleSize; i++) {
    if (CODE_LINE_REGEX.test(lines[i]!)) {
      codeLines++;
    }
  }
  const codeRatio = sampleSize > 0 ? codeLines / sampleSize : 0;

  // ASCII chars-per-token: blend between prose (4.0) and code (3.5) based on code ratio
  const asciiCpt = 4.0 - (codeRatio * 0.5); // 4.0 for prose, 3.5 for code

  // Calculate token contributions
  const asciiTokens = asciiChars / asciiCpt;
  const cjkTokens = cjkChars / 1.5; // CJK chars are ~1-2 tokens each
  const whitespaceTokens = whitespaceChars / 6; // Whitespace is mostly merged
  const otherTokens = otherChars / 3; // Non-ASCII Latin, Cyrillic, etc.

  return Math.ceil(asciiTokens + cjkTokens + whitespaceTokens + otherTokens);
}
