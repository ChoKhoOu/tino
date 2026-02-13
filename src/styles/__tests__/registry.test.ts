import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import type { OutputStyle } from '../types.js';
import { setSetting } from '@/config/settings.js';
import {
  getBuiltinStyles,
  getActiveStyle,
  setActiveStyle,
  getAllStyles,
  clearStyleCache,
  setCustomStyleProvider,
  _overrideActiveStyleName,
} from '../registry.js';

describe('style registry', () => {
  beforeEach(() => {
    setSetting('outputStyle', 'default');
    clearStyleCache();
    setCustomStyleProvider(null);
  });

  afterEach(() => {
    setSetting('outputStyle', 'default');
    clearStyleCache();
  });

  describe('getBuiltinStyles', () => {
    it('returns 4 built-in styles', () => {
      const styles = getBuiltinStyles();
      expect(styles).toHaveLength(4);
    });

    it('includes default, concise, explanatory, and trading styles', () => {
      const styles = getBuiltinStyles();
      const names = styles.map((s: OutputStyle) => s.name);
      expect(names).toContain('default');
      expect(names).toContain('concise');
      expect(names).toContain('explanatory');
      expect(names).toContain('trading');
    });

    it('default style has empty systemPromptModifier', () => {
      const styles = getBuiltinStyles();
      const defaultStyle = styles.find((s: OutputStyle) => s.name === 'default');
      expect(defaultStyle?.systemPromptModifier).toBe('');
    });

    it('concise style has conciseness instruction', () => {
      const styles = getBuiltinStyles();
      const style = styles.find((s: OutputStyle) => s.name === 'concise');
      expect(style?.systemPromptModifier).toContain('concise');
    });

    it('explanatory style has reasoning instruction', () => {
      const styles = getBuiltinStyles();
      const style = styles.find((s: OutputStyle) => s.name === 'explanatory');
      expect(style?.systemPromptModifier).toContain('reasoning');
    });

    it('trading style has quantitative instruction', () => {
      const styles = getBuiltinStyles();
      const style = styles.find((s: OutputStyle) => s.name === 'trading');
      expect(style?.systemPromptModifier).toContain('quantitative');
    });

    it('all built-in styles have source "builtin"', () => {
      const styles = getBuiltinStyles();
      for (const style of styles) {
        expect(style.source).toBe('builtin');
      }
    });
  });

  describe('getActiveStyle', () => {
    it('returns default style when no override is set', () => {
      const style = getActiveStyle();
      expect(style.name).toBe('default');
    });

    it('returns the style matching the override name', () => {
      _overrideActiveStyleName('concise');
      const style = getActiveStyle();
      expect(style.name).toBe('concise');
    });

    it('falls back to default for unknown style name', () => {
      _overrideActiveStyleName('nonexistent');
      const style = getActiveStyle();
      expect(style.name).toBe('default');
    });
  });

  describe('setActiveStyle', () => {
    it('returns true for known style name', () => {
      const result = setActiveStyle('concise');
      expect(result).toBe(true);
    });

    it('returns false for unknown style name', () => {
      const result = setActiveStyle('nonexistent');
      expect(result).toBe(false);
    });
  });

  describe('getAllStyles', () => {
    it('returns built-in styles when no custom provider', () => {
      const styles = getAllStyles();
      expect(styles).toHaveLength(4);
    });

    it('includes custom styles from provider', () => {
      const customStyle: OutputStyle = {
        name: 'custom-test',
        description: 'A test style',
        systemPromptModifier: 'Be a test.',
        source: 'project',
      };
      setCustomStyleProvider(() => [customStyle]);
      clearStyleCache();

      const styles = getAllStyles();
      expect(styles.length).toBeGreaterThan(4);
      const names = styles.map((s: OutputStyle) => s.name);
      expect(names).toContain('custom-test');
    });

    it('custom styles override built-in styles with same name', () => {
      const override: OutputStyle = {
        name: 'concise',
        description: 'Custom concise',
        systemPromptModifier: 'Custom modifier.',
        source: 'project',
      };
      setCustomStyleProvider(() => [override]);
      clearStyleCache();

      const styles = getAllStyles();
      const concise = styles.find((s: OutputStyle) => s.name === 'concise');
      expect(concise?.description).toBe('Custom concise');
      expect(concise?.source).toBe('project');
    });
  });
});
