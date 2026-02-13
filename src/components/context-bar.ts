const FILLED_CHAR = '█';
const EMPTY_CHAR = '░';
const DEFAULT_BAR_WIDTH = 30;

export function getContextPercentage(used: number, max: number): number {
  if (max <= 0) return 0;
  return Math.min(100, Math.floor((used / max) * 100));
}

export function formatTokenCount(count: number): string {
  return count.toLocaleString('en-US');
}

export function renderContextBar(
  usedTokens: number,
  maxTokens: number,
  width: number = DEFAULT_BAR_WIDTH,
): string {
  const percent = getContextPercentage(usedTokens, maxTokens);
  const filledCount = Math.round((percent / 100) * width);
  const emptyCount = width - filledCount;

  const filled = FILLED_CHAR.repeat(filledCount);
  const empty = EMPTY_CHAR.repeat(emptyCount);

  return `[${filled}${empty}] ${percent}% (${formatTokenCount(usedTokens)} / ${formatTokenCount(maxTokens)})`;
}
