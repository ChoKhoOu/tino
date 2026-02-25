import { loadSettings } from './settings.js';

export interface ThemeColors {
  background: string;
  panelBackground: string;
  border: string;
  primaryText: string;
  secondaryText: string;
  up: string;
  down: string;
  warning: string;
  info: string;
  aiReply: string;
}

export const presets: Record<string, ThemeColors> = {
  'crypto-dark': {
    background: '#0D1117',
    panelBackground: '#161B22',
    border: '#30363D',
    primaryText: '#E6EDF3',
    secondaryText: '#7D8590',
    up: '#3FB950',
    down: '#F85149',
    warning: '#D29922',
    info: '#58A6FF',
    aiReply: '#BC8CFF',
  },
};

export function getTheme(): ThemeColors {
  if (process.env.NODE_ENV === 'test') {
    return presets['crypto-dark'];
  }

  try {
    const settings = loadSettings();
    const themeName = settings.theme?.name || 'crypto-dark';
    const baseTheme = presets[themeName] || presets['crypto-dark'];
    const overrides = settings.theme?.overrides || {};

    return {
      background: overrides.background || baseTheme.background,
      panelBackground: overrides.panelBackground || baseTheme.panelBackground,
      border: overrides.border || baseTheme.border,
      primaryText: overrides.primaryText || baseTheme.primaryText,
      secondaryText: overrides.secondaryText || baseTheme.secondaryText,
      up: overrides.up || baseTheme.up,
      down: overrides.down || baseTheme.down,
      warning: overrides.warning || baseTheme.warning,
      info: overrides.info || baseTheme.info,
      aiReply: overrides.aiReply || baseTheme.aiReply,
    };
  } catch (e) {
    return presets['crypto-dark'];
  }
}
