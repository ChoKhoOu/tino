import { describe, test, expect, mock, beforeEach } from 'bun:test';

const mockGetSetting = mock(() => false);
const mockSetSetting = mock(() => true);

mock.module('@/config/settings.js', () => ({
  getSetting: mockGetSetting,
  setSetting: mockSetSetting,
}));

const { getThinkingEnabled, toggleThinkingSetting, THINKING_SETTING_KEY } = await import(
  '../useThinkingToggle.js'
);

describe('useThinkingToggle', () => {
  beforeEach(() => {
    mockGetSetting.mockReset();
    mockSetSetting.mockReset();
    mockGetSetting.mockReturnValue(false);
    mockSetSetting.mockReturnValue(true);
  });

  describe('THINKING_SETTING_KEY', () => {
    test('is extendedThinking', () => {
      expect(THINKING_SETTING_KEY).toBe('extendedThinking');
    });
  });

  describe('getThinkingEnabled', () => {
    test('returns false by default', () => {
      mockGetSetting.mockReturnValue(false);
      expect(getThinkingEnabled()).toBe(false);
      expect(mockGetSetting).toHaveBeenCalledWith('extendedThinking', false);
    });

    test('returns true when setting is enabled', () => {
      mockGetSetting.mockReturnValue(true);
      expect(getThinkingEnabled()).toBe(true);
    });
  });

  describe('toggleThinkingSetting', () => {
    test('toggles from false to true', () => {
      mockGetSetting.mockReturnValue(false);
      const result = toggleThinkingSetting();
      expect(result).toBe(true);
      expect(mockSetSetting).toHaveBeenCalledWith('extendedThinking', true);
    });

    test('toggles from true to false', () => {
      mockGetSetting.mockReturnValue(true);
      const result = toggleThinkingSetting();
      expect(result).toBe(false);
      expect(mockSetSetting).toHaveBeenCalledWith('extendedThinking', false);
    });

    test('returns new value even if save fails', () => {
      mockGetSetting.mockReturnValue(false);
      mockSetSetting.mockReturnValue(false);
      const result = toggleThinkingSetting();
      expect(result).toBe(true);
    });
  });
});
