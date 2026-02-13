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

describe('theme', () => {
  describe('backward compatibility', () => {
    it('preserves all 14 original colors', () => {
      expect(colors.primary).toBe('#258bff');
      expect(colors.primaryLight).toBe('#a5cfff');
      expect(colors.success).toBe('green');
      expect(colors.error).toBe('red');
      expect(colors.warning).toBe('yellow');
      expect(colors.muted).toBe('#a6a6a6');
      expect(colors.mutedDark).toBe('#303030');
      expect(colors.accent).toBe('cyan');
      expect(colors.highlight).toBe('magenta');
      expect(colors.white).toBe('#ffffff');
      expect(colors.info).toBe('#6CB6FF');
      expect(colors.queryBg).toBe('#3D3D3D');
      expect(colors.claude).toBe('#E5896A');
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
      expect(componentTokens.statusLine.bg).toBe('#1A1A2E');
      expect(componentTokens.statusLine.fg).toBe('#E0E0E0');
      expect(componentTokens.statusLine.separator).toBe('#555555');
    });

    it('has popup tokens', () => {
      expect(componentTokens.popup.bg).toBe('#2D2D2D');
      expect(componentTokens.popup.border).toBe('#555555');
      expect(componentTokens.popup.selected).toBe('#3D5AFE');
      expect(componentTokens.popup.filter).toBe('#FFD700');
    });

    it('has ghostText tokens', () => {
      expect(componentTokens.ghostText.color).toBe('#666666');
    });

    it('has rewindMenu tokens', () => {
      expect(componentTokens.rewindMenu.bg).toBe('#1E1E1E');
      expect(componentTokens.rewindMenu.selected).toBe('#264F78');
    });

    it('has taskList tokens', () => {
      expect(componentTokens.taskList.pending).toBe('#888888');
      expect(componentTokens.taskList.inProgress).toBe('#FFD700');
      expect(componentTokens.taskList.complete).toBe('green');
      expect(componentTokens.taskList.failed).toBe('red');
    });
  });

  describe('contextColors', () => {
    it('defines semantic context colors', () => {
      expect(contextColors.low).toBe('green');
      expect(contextColors.mid).toBe('yellow');
      expect(contextColors.high).toBe('red');
    });
  });

  describe('borderStyles', () => {
    it('defines border color tokens', () => {
      expect(borderStyles.default).toBe('#555555');
      expect(borderStyles.active).toBe('#258bff');
      expect(borderStyles.warning).toBe('yellow');
      expect(borderStyles.info).toBe('#6CB6FF');
    });
  });

  describe('getContextColor', () => {
    it('returns green for low usage (0-69%)', () => {
      expect(getContextColor(0)).toBe('green');
      expect(getContextColor(50)).toBe('green');
      expect(getContextColor(69)).toBe('green');
    });

    it('returns yellow for mid usage (70-89%)', () => {
      expect(getContextColor(70)).toBe('yellow');
      expect(getContextColor(75)).toBe('yellow');
      expect(getContextColor(89)).toBe('yellow');
    });

    it('returns red for high usage (90-100%)', () => {
      expect(getContextColor(90)).toBe('red');
      expect(getContextColor(95)).toBe('red');
      expect(getContextColor(100)).toBe('red');
    });
  });
});
