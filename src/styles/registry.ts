import { getSetting, setSetting } from '@/config/settings.js';
import type { OutputStyle } from './types.js';

const BUILTIN_STYLES: OutputStyle[] = [
  {
    name: 'default',
    description: 'Standard engineering responses',
    systemPromptModifier: '',
    source: 'builtin',
  },
  {
    name: 'concise',
    description: 'Minimal, direct answers',
    systemPromptModifier: 'Be extremely concise. No explanations unless asked. Prefer single-line answers.',
    source: 'builtin',
  },
  {
    name: 'explanatory',
    description: 'Educational with reasoning',
    systemPromptModifier: 'Explain your reasoning step by step. Provide context and rationale for recommendations.',
    source: 'builtin',
  },
  {
    name: 'trading',
    description: 'Finance-focused with data emphasis',
    systemPromptModifier: 'Focus on quantitative data, metrics, and trading implications. Lead with numbers and concrete data points.',
    source: 'builtin',
  },
];

type CustomStyleProvider = (() => OutputStyle[]) | null;
let customStyleProvider: CustomStyleProvider = null;
let styleCache: Map<string, OutputStyle> | null = null;
let activeStyleOverride: string | null = null;

export function setCustomStyleProvider(provider: CustomStyleProvider): void {
  customStyleProvider = provider;
}

export function clearStyleCache(): void {
  styleCache = null;
  activeStyleOverride = null;
}

export function getBuiltinStyles(): OutputStyle[] {
  return [...BUILTIN_STYLES];
}

export function getAllStyles(): OutputStyle[] {
  if (styleCache) {
    return Array.from(styleCache.values());
  }

  styleCache = new Map();
  for (const style of BUILTIN_STYLES) {
    styleCache.set(style.name, style);
  }

  if (customStyleProvider) {
    for (const style of customStyleProvider()) {
      styleCache.set(style.name, style);
    }
  }

  return Array.from(styleCache.values());
}

export function getActiveStyle(): OutputStyle {
  const styleName = activeStyleOverride ?? (getSetting('outputStyle', 'default') as string);
  const styles = getAllStyles();
  return styles.find((s) => s.name === styleName)
    ?? styles.find((s) => s.name === 'default')!;
}

export function setActiveStyle(name: string): boolean {
  const styles = getAllStyles();
  if (!styles.find((s) => s.name === name)) {
    return false;
  }
  activeStyleOverride = null;
  return setSetting('outputStyle', name);
}

export function _overrideActiveStyleName(name: string | null): void {
  activeStyleOverride = name;
}
