/**
 * Format tool name from snake_case to Title Case
 * e.g., get_financial_metrics_snapshot -> Get Financial Metrics Snapshot
 */
export function formatToolName(name: string): string {
  return name
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Truncate string at word boundary (before exceeding maxLength)
 */
export function truncateAtWord(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  
  // Find last space before maxLength
  const lastSpace = str.lastIndexOf(' ', maxLength);
  
  // If there's a space in a reasonable position (at least 50% of maxLength), use it
  if (lastSpace > maxLength * 0.5) {
    return str.slice(0, lastSpace) + '...';
  }
  
  // No good word boundary - truncate at maxLength
  return str.slice(0, maxLength) + '...';
}

/**
 * Format tool arguments for display - truncate long values at word boundaries
 */
export function formatArgs(args: Record<string, unknown>): string {
  // For tools with a single 'query' arg, show it in a clean format
  if (Object.keys(args).length === 1 && 'query' in args) {
    const query = String(args.query);
    return `"${truncateAtWord(query, 60)}"`;
  }
  
  // For other tools, format key=value pairs with truncation
  return Object.entries(args)
    .map(([key, value]) => {
      const strValue = String(value);
      return `${key}=${truncateAtWord(strValue, 60)}`;
    })
    .join(', ');
}

/**
 * Format duration in human-readable form
 */
export function formatDuration(ms: number): string {
  if (ms < 1000) {
    return `${ms}ms`;
  }
  return `${(ms / 1000).toFixed(1)}s`;
}

/**
 * Truncate result for display
 */
export function truncateResult(result: string, maxLength: number = 100): string {
  if (result.length <= maxLength) {
    return result;
  }
  return result.slice(0, maxLength) + '...';
}

/**
 * Truncate URL to hostname + path for display
 */
export function truncateUrl(url: string, maxLen = 45): string {
  try {
    const parsed = new URL(url);
    const display = parsed.hostname + parsed.pathname;
    return display.length <= maxLen ? display : display.slice(0, maxLen) + '...';
  } catch {
    return url.length > maxLen ? url.slice(0, maxLen) + '...' : url;
  }
}

/**
 * Format browser step for consolidated display.
 * Returns null for actions that should not be shown (act steps like click, type).
 */
export function formatBrowserStep(args: Record<string, unknown>): string | null {
  const action = args.action as string;
  const url = args.url as string | undefined;

  switch (action) {
    case 'open':
      return `Opening ${truncateUrl(url || '')}`;
    case 'navigate':
      return `Navigating to ${truncateUrl(url || '')}`;
    case 'snapshot':
      return 'Reading page structure';
    case 'read':
      return 'Extracting page text';
    case 'close':
      return 'Closing browser';
    case 'act':
      return null; // Don't show act steps (click, type, etc.)
    default:
      return null;
  }
}
