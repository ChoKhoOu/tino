import { afterAll, describe, test, expect, spyOn, beforeEach } from 'bun:test';
import * as fs from 'fs';
import { loadPermissions } from '../permissions.js';

const mockExistsSync = spyOn(fs, 'existsSync');
const mockReadFileSync = spyOn(fs, 'readFileSync') as unknown as ReturnType<typeof spyOn>;

afterAll(() => {
  mockExistsSync.mockRestore();
  mockReadFileSync.mockRestore();
});

const DEFAULT_PERMISSIONS = {
  rules: [
    { tool: 'trading_*', action: 'ask' as const },
    { tool: '*', action: 'allow' as const },
  ],
  defaultAction: 'ask' as const,
};

describe('loadPermissions', () => {
  beforeEach(() => {
    mockExistsSync.mockReset();
    mockReadFileSync.mockReset();
  });

  test('returns DEFAULT_PERMISSIONS when file does not exist', () => {
    mockExistsSync.mockReturnValue(false);
    const result = loadPermissions();
    expect(result).toEqual(DEFAULT_PERMISSIONS);
  });

  test('returns DEFAULT_PERMISSIONS when JSON is invalid', () => {
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue('not valid json');
    const result = loadPermissions();
    expect(result).toEqual(DEFAULT_PERMISSIONS);
  });

  test('returns DEFAULT_PERMISSIONS when rules is not an array', () => {
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue(JSON.stringify({ rules: 'not-array', defaultAction: 'deny' }));
    const result = loadPermissions();
    expect(result).toEqual(DEFAULT_PERMISSIONS);
  });

  test('returns parsed permissions with defaultAction', () => {
    const custom = {
      rules: [{ tool: 'market_data', action: 'allow' as const }],
      defaultAction: 'deny' as const,
    };
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue(JSON.stringify(custom));
    const result = loadPermissions();
    expect(result).toEqual(custom);
  });

  test('falls back to ask when defaultAction is missing', () => {
    const noDefault = {
      rules: [{ tool: 'market_data', action: 'allow' as const }],
    };
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue(JSON.stringify(noDefault));
    const result = loadPermissions();
    expect(result.defaultAction).toBe('ask');
    expect(result.rules).toEqual(noDefault.rules);
  });

  test('default permissions include trading_* ask rule and * allow rule', () => {
    mockExistsSync.mockReturnValue(false);
    const result = loadPermissions();
    const tradingRule = result.rules.find((r) => r.tool === 'trading_*');
    expect(tradingRule).toBeDefined();
    expect(tradingRule!.action).toBe('ask');
    const wildcardRule = result.rules.find((r) => r.tool === '*');
    expect(wildcardRule).toBeDefined();
    expect(wildcardRule!.action).toBe('allow');
  });
});
