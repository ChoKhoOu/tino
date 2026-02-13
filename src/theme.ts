export const colors = {
  primary: '#E8772E',
  primaryLight: '#F5B87A',
  success: 'green',
  error: 'red',
  warning: 'yellow',
  muted: '#a6a6a6',
  mutedDark: '#303030',
  accent: 'cyan',
  highlight: 'magenta',
  white: '#ffffff',
  info: '#6CB6FF',
  queryBg: '#3D3D3D',
  claude: '#E5896A',
} as const;

export const dimensions = {
  boxWidth: 80,
  introWidth: 50,
} as const;

export const spacing = {
  xs: 0,
  sm: 1,
  md: 2,
  lg: 3,
  xl: 4,
} as const;

export const componentTokens = {
  statusLine: { bg: '#1A1A2E', fg: '#E0E0E0', separator: '#555555' },
  popup: { bg: '#2D2D2D', border: '#555555', selected: '#3D5AFE', filter: '#FFD700' },
  ghostText: { color: '#666666' },
  rewindMenu: { bg: '#1E1E1E', selected: '#264F78' },
  taskList: { pending: '#888888', inProgress: '#FFD700', complete: 'green', failed: 'red' },
} as const;

export const contextColors = { low: 'green', mid: 'yellow', high: 'red' } as const;

export const borderStyles = {
  default: '#555555',
  active: '#E8772E',
  warning: 'yellow',
  info: '#6CB6FF',
} as const;

export function getContextColor(percentage: number): string {
  if (percentage >= 90) return contextColors.high;
  if (percentage >= 70) return contextColors.mid;
  return contextColors.low;
}
