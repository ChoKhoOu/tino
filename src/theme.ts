import { getTheme } from './config/theme.js';

export const colors = {
  get primary() { return getTheme().primaryText; },
  get primaryLight() { return getTheme().primaryText; },
  get success() { return getTheme().up; },
  get error() { return getTheme().down; },
  get warning() { return getTheme().warning; },
  get muted() { return getTheme().secondaryText; },
  get mutedDark() { return getTheme().border; },
  get accent() { return getTheme().info; },
  get highlight() { return getTheme().aiReply; },
  get white() { return getTheme().primaryText; },
  get info() { return getTheme().info; },
  get queryBg() { return getTheme().panelBackground; },
  get claude() { return getTheme().aiReply; },
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
  get statusLine() {
    const t = getTheme();
    return { bg: t.panelBackground, fg: t.primaryText, separator: t.border };
  },
  get popup() {
    const t = getTheme();
    return { bg: t.panelBackground, border: t.border, selected: t.info, filter: t.warning };
  },
  get ghostText() {
    const t = getTheme();
    return { color: t.secondaryText };
  },
  get rewindMenu() {
    const t = getTheme();
    return { bg: t.background, selected: t.panelBackground };
  },
  get taskList() {
    const t = getTheme();
    return { pending: t.secondaryText, inProgress: t.warning, complete: t.up, failed: t.down };
  },
} as const;

export const contextColors = {
  get low() { return getTheme().up; },
  get mid() { return getTheme().warning; },
  get high() { return getTheme().down; },
} as const;

export const borderStyles = {
  get default() { return getTheme().border; },
  get active() { return getTheme().primaryText; },
  get warning() { return getTheme().warning; },
  get info() { return getTheme().info; },
} as const;

export function getContextColor(percentage: number): string {
  if (percentage >= 90) return contextColors.high;
  if (percentage >= 70) return contextColors.mid;
  return contextColors.low;
}
