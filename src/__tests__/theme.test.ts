import { describe, it, expect } from 'bun:test';
import {
  colors,
  dimensions,
  spacing,
  componentTokens,
  contextColors,
  borderStyles,
  getContextColor,
} from '@/theme.js';
import { presets } from '@/config/theme.js';

const dark = presets['crypto-dark'];

describe('theme', () => {
  describe('backward compatibility', () => {
    it('preserves all 14 original colors with crypto-dark equivalents', () => {
      expect(colors.primary).toBe(dark.primaryText);
      expect(colors.primaryLight).toBe(dark.primaryText);
      expect(colors.success).toBe(dark.up);
      expect(colors.error).toBe(dark.down);
      expect(colors.warning).toBe(dark.warning);
      expect(colors.muted).toBe(dark.secondaryText);
      expect(colors.mutedDark).toBe(dark.border);
      expect(colors.accent).toBe(dark.info);
      expect(colors.highlight).toBe(dark.aiReply);
      expect(colors.white).toBe(dark.primaryText);
      expect(colors.info).toBe(dark.info);
      expect(colors.queryBg).toBe(dark.panelBackground);
      expect(colors.claude).toBe(dark.aiReply);
    });

    it('preserves dimensions', () => {
      expect(dimensions.boxWidth).toBe(80);
      expect(dimensions.introWidth).toBe(50);
    });
  });

  describe('spacing', () => {
    it('provides spacing scale', () => {
      expect(spacing.xs).toBe(0);
      expect(spacing.sm).toBe(1);
      expect(spacing.md).toBe(2);
      expect(spacing.lg).toBe(3);
      expect(spacing.xl).toBe(4);
    });
  });

  describe('componentTokens', () => {

    it('has statusLine tokens', () => {
      expect(componentTokens.statusLine.bg).toBe(dark.panelBackground);
      expect(componentTokens.statusLine.fg).toBe(dark.primaryText);
      expect(componentTokens.statusLine.separator).toBe(dark.border);
    });

    it('has popup tokens', () => {
      expect(componentTokens.popup.bg).toBe(dark.panelBackground);
      expect(componentTokens.popup.border).toBe(dark.border);
      expect(componentTokens.popup.selected).toBe(dark.info);
      expect(componentTokens.popup.filter).toBe(dark.warning);
    });

    it('has ghostText tokens', () => {
      expect(componentTokens.ghostText.color).toBe(dark.secondaryText);
    });

    it('has rewindMenu tokens', () => {
      expect(componentTokens.rewindMenu.bg).toBe(dark.background);
      expect(componentTokens.rewindMenu.selected).toBe(dark.panelBackground);
    });

    it('has taskList tokens', () => {
      expect(componentTokens.taskList.pending).toBe(dark.secondaryText);
      expect(componentTokens.taskList.inProgress).toBe(dark.warning);
      expect(componentTokens.taskList.complete).toBe(dark.up);
      expect(componentTokens.taskList.failed).toBe(dark.down);
    });
  });

  describe('contextColors', () => {

    it('defines semantic context colors', () => {
      expect(contextColors.low).toBe(dark.up);
      expect(contextColors.mid).toBe(dark.warning);
      expect(contextColors.high).toBe(dark.down);
    });
  });

  describe('borderStyles', () => {

    it('defines border color tokens', () => {
      expect(borderStyles.default).toBe(dark.border);
      expect(borderStyles.active).toBe(dark.primaryText);
      expect(borderStyles.warning).toBe(dark.warning);
      expect(borderStyles.info).toBe(dark.info);
    });
  });

  describe('getContextColor', () => {

    it('returns up for low usage (0-69%)', () => {
      expect(getContextColor(0)).toBe(dark.up);
      expect(getContextColor(50)).toBe(dark.up);
      expect(getContextColor(69)).toBe(dark.up);
    });

    it('returns warning for mid usage (70-89%)', () => {
      expect(getContextColor(70)).toBe(dark.warning);
      expect(getContextColor(75)).toBe(dark.warning);
      expect(getContextColor(89)).toBe(dark.warning);
    });

    it('returns down for high usage (90-100%)', () => {
      expect(getContextColor(90)).toBe(dark.down);
      expect(getContextColor(95)).toBe(dark.down);
      expect(getContextColor(100)).toBe(dark.down);
    });
  });
});
