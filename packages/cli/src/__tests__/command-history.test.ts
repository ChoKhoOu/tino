import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import { join } from 'node:path';

// Mock node:fs and node:os before importing the module under test
vi.mock('node:fs', () => ({
  readFileSync: vi.fn(),
  writeFileSync: vi.fn(),
  mkdirSync: vi.fn(),
  existsSync: vi.fn(),
}));

vi.mock('node:os', () => ({
  homedir: vi.fn(() => '/mock-home'),
}));

// The hook's internal loadHistory/saveHistory are not exported, so we test them
// indirectly via a dynamic import that re-evaluates the module with our mocks.
// We also mock React hooks to capture the logic without needing a renderer.

// Capture React hook calls to exercise the hook's logic without rendering
const setStateFn = vi.fn();
const refObject = { current: -1 };

vi.mock('react', () => ({
  useState: vi.fn((initial: unknown) => {
    // Return the initial value and the mock setter
    const value = typeof initial === 'function' ? (initial as () => unknown)() : initial;
    return [value, setStateFn];
  }),
  useCallback: vi.fn((fn: unknown) => fn),
  useEffect: vi.fn((fn: () => void) => {
    // Execute the effect immediately to simulate mount
    fn();
  }),
  useRef: vi.fn((initial: unknown) => {
    refObject.current = initial as number;
    return refObject;
  }),
}));

const HISTORY_DIR = join('/mock-home', '.tino');
const HISTORY_FILE = join(HISTORY_DIR, 'command-history.json');

describe('useCommandHistory - file operations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    refObject.current = -1;
    setStateFn.mockReset();
  });

  it('should return empty history when file does not exist', async () => {
    (fs.existsSync as ReturnType<typeof vi.fn>).mockReturnValue(false);

    // Dynamic import to get fresh module evaluation with mocks
    const { useCommandHistory } = await import('../hooks/useCommandHistory.js');

    // useState is called with [] as initial value
    // useEffect runs loadHistory which calls setHistory
    const result = useCommandHistory();

    // loadHistory called existsSync and returned []
    expect(fs.existsSync).toHaveBeenCalledWith(HISTORY_FILE);
    // setHistory was called with [] from loadHistory
    expect(setStateFn).toHaveBeenCalledWith([]);
    expect(result.history).toEqual([]);
  });

  it('should load history from file when it exists', async () => {
    const mockHistory = ['cmd1', 'cmd2', 'cmd3'];
    (fs.existsSync as ReturnType<typeof vi.fn>).mockReturnValue(true);
    (fs.readFileSync as ReturnType<typeof vi.fn>).mockReturnValue(
      JSON.stringify(mockHistory),
    );

    const { useCommandHistory } = await import('../hooks/useCommandHistory.js');
    useCommandHistory();

    expect(fs.existsSync).toHaveBeenCalledWith(HISTORY_FILE);
    expect(fs.readFileSync).toHaveBeenCalledWith(HISTORY_FILE, 'utf-8');
    expect(setStateFn).toHaveBeenCalledWith(mockHistory);
  });

  it('should filter non-string entries from loaded history', async () => {
    const mixedData = ['valid', 42, null, 'also-valid', { bad: true }];
    (fs.existsSync as ReturnType<typeof vi.fn>).mockReturnValue(true);
    (fs.readFileSync as ReturnType<typeof vi.fn>).mockReturnValue(
      JSON.stringify(mixedData),
    );

    const { useCommandHistory } = await import('../hooks/useCommandHistory.js');
    useCommandHistory();

    expect(setStateFn).toHaveBeenCalledWith(['valid', 'also-valid']);
  });

  it('should return empty history on JSON parse error', async () => {
    (fs.existsSync as ReturnType<typeof vi.fn>).mockReturnValue(true);
    (fs.readFileSync as ReturnType<typeof vi.fn>).mockReturnValue('not valid json{{{');

    const { useCommandHistory } = await import('../hooks/useCommandHistory.js');
    useCommandHistory();

    expect(setStateFn).toHaveBeenCalledWith([]);
  });

  it('should return empty history when file contains non-array JSON', async () => {
    (fs.existsSync as ReturnType<typeof vi.fn>).mockReturnValue(true);
    (fs.readFileSync as ReturnType<typeof vi.fn>).mockReturnValue(
      JSON.stringify({ not: 'an array' }),
    );

    const { useCommandHistory } = await import('../hooks/useCommandHistory.js');
    useCommandHistory();

    expect(setStateFn).toHaveBeenCalledWith([]);
  });

  it('should return empty history when readFileSync throws', async () => {
    (fs.existsSync as ReturnType<typeof vi.fn>).mockReturnValue(true);
    (fs.readFileSync as ReturnType<typeof vi.fn>).mockImplementation(() => {
      throw new Error('EACCES');
    });

    const { useCommandHistory } = await import('../hooks/useCommandHistory.js');
    useCommandHistory();

    expect(setStateFn).toHaveBeenCalledWith([]);
  });
});

describe('useCommandHistory - addEntry', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    refObject.current = -1;
    setStateFn.mockReset();
  });

  it('should add an entry and persist to file', async () => {
    (fs.existsSync as ReturnType<typeof vi.fn>).mockReturnValue(true);
    (fs.readFileSync as ReturnType<typeof vi.fn>).mockReturnValue('[]');

    const { useCommandHistory } = await import('../hooks/useCommandHistory.js');
    const { addEntry } = useCommandHistory();

    // addEntry calls setHistory with a callback. We need to invoke that callback
    // to test the logic inside it.
    addEntry('test command');

    // setHistory is called with a function (the updater)
    const updaterCall = setStateFn.mock.calls.find(
      (call: unknown[]) => typeof call[0] === 'function',
    );
    expect(updaterCall).toBeDefined();

    // Execute the updater with an empty previous state
    const updater = updaterCall![0] as (prev: string[]) => string[];
    const result = updater([]);

    expect(result).toEqual(['test command']);
    // saveHistory should have been called
    expect(fs.writeFileSync).toHaveBeenCalledWith(
      HISTORY_FILE,
      JSON.stringify(['test command']),
      'utf-8',
    );
  });

  it('should deduplicate consecutive entries', async () => {
    (fs.existsSync as ReturnType<typeof vi.fn>).mockReturnValue(false);

    const { useCommandHistory } = await import('../hooks/useCommandHistory.js');
    const { addEntry } = useCommandHistory();

    addEntry('duplicate');
    const updater = setStateFn.mock.calls.find(
      (call: unknown[]) => typeof call[0] === 'function',
    )![0] as (prev: string[]) => string[];

    // When the last entry is the same, it should return the previous array unchanged
    const prev = ['other', 'duplicate'];
    const result = updater(prev);
    expect(result).toBe(prev); // same reference = no change
  });

  it('should allow non-consecutive duplicates', async () => {
    (fs.existsSync as ReturnType<typeof vi.fn>).mockReturnValue(false);

    const { useCommandHistory } = await import('../hooks/useCommandHistory.js');
    const { addEntry } = useCommandHistory();

    addEntry('cmd1');
    const updater = setStateFn.mock.calls.find(
      (call: unknown[]) => typeof call[0] === 'function',
    )![0] as (prev: string[]) => string[];

    // 'cmd1' is not at the end, so it should be added
    const result = updater(['cmd1', 'cmd2']);
    expect(result).toEqual(['cmd1', 'cmd2', 'cmd1']);
  });

  it('should cap history at maxEntries', async () => {
    (fs.existsSync as ReturnType<typeof vi.fn>).mockReturnValue(false);

    const { useCommandHistory } = await import('../hooks/useCommandHistory.js');
    const { addEntry } = useCommandHistory(3); // max 3 entries

    addEntry('new');
    const updater = setStateFn.mock.calls.find(
      (call: unknown[]) => typeof call[0] === 'function',
    )![0] as (prev: string[]) => string[];

    const result = updater(['a', 'b', 'c']);
    // Should drop 'a' and keep the most recent 3
    expect(result).toEqual(['b', 'c', 'new']);
  });

  it('should create directory if it does not exist when saving', async () => {
    // existsSync returns false for history file (load) and false for dir (save)
    (fs.existsSync as ReturnType<typeof vi.fn>).mockReturnValue(false);

    const { useCommandHistory } = await import('../hooks/useCommandHistory.js');
    const { addEntry } = useCommandHistory();

    addEntry('cmd');
    const updater = setStateFn.mock.calls.find(
      (call: unknown[]) => typeof call[0] === 'function',
    )![0] as (prev: string[]) => string[];

    updater([]);

    expect(fs.mkdirSync).toHaveBeenCalledWith(HISTORY_DIR, { recursive: true });
    expect(fs.writeFileSync).toHaveBeenCalled();
  });

  it('should gracefully handle write failures', async () => {
    (fs.existsSync as ReturnType<typeof vi.fn>).mockReturnValue(true);
    (fs.readFileSync as ReturnType<typeof vi.fn>).mockReturnValue('[]');
    (fs.writeFileSync as ReturnType<typeof vi.fn>).mockImplementation(() => {
      throw new Error('ENOSPC');
    });

    const { useCommandHistory } = await import('../hooks/useCommandHistory.js');
    const { addEntry } = useCommandHistory();

    addEntry('cmd');
    const updater = setStateFn.mock.calls.find(
      (call: unknown[]) => typeof call[0] === 'function',
    )![0] as (prev: string[]) => string[];

    // Should not throw
    expect(() => updater([])).not.toThrow();
  });

  it('should reset navigation index after adding entry', async () => {
    (fs.existsSync as ReturnType<typeof vi.fn>).mockReturnValue(false);

    const { useCommandHistory } = await import('../hooks/useCommandHistory.js');
    const { addEntry } = useCommandHistory();

    // Simulate that navigation index was moved
    refObject.current = 2;

    addEntry('new cmd');
    const updater = setStateFn.mock.calls.find(
      (call: unknown[]) => typeof call[0] === 'function',
    )![0] as (prev: string[]) => string[];
    updater([]);

    expect(refObject.current).toBe(-1);
  });
});

describe('useCommandHistory - navigation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    refObject.current = -1;
    setStateFn.mockReset();
  });

  it('navigateUp should return null on empty history', async () => {
    (fs.existsSync as ReturnType<typeof vi.fn>).mockReturnValue(false);

    // useState returns [] for initial history
    const react = await import('react');
    (react.useState as ReturnType<typeof vi.fn>).mockReturnValueOnce([[], setStateFn]);

    const { useCommandHistory } = await import('../hooks/useCommandHistory.js');
    const { navigateUp } = useCommandHistory();

    expect(navigateUp()).toBeNull();
  });

  it('navigateUp should return last entry first', async () => {
    (fs.existsSync as ReturnType<typeof vi.fn>).mockReturnValue(false);

    const history = ['first', 'second', 'third'];
    const react = await import('react');
    (react.useState as ReturnType<typeof vi.fn>).mockReturnValueOnce([history, setStateFn]);

    const { useCommandHistory } = await import('../hooks/useCommandHistory.js');
    const { navigateUp } = useCommandHistory();

    expect(navigateUp()).toBe('third');
    expect(refObject.current).toBe(2);
  });

  it('navigateUp should move backwards through history', async () => {
    (fs.existsSync as ReturnType<typeof vi.fn>).mockReturnValue(false);

    const history = ['first', 'second', 'third'];
    const react = await import('react');
    (react.useState as ReturnType<typeof vi.fn>).mockReturnValueOnce([history, setStateFn]);

    const { useCommandHistory } = await import('../hooks/useCommandHistory.js');
    const { navigateUp } = useCommandHistory();

    expect(navigateUp()).toBe('third');   // index 2
    expect(navigateUp()).toBe('second');  // index 1
    expect(navigateUp()).toBe('first');   // index 0
    // At the beginning, should stay at index 0
    expect(navigateUp()).toBe('first');
  });

  it('navigateDown should return null when not navigating', async () => {
    (fs.existsSync as ReturnType<typeof vi.fn>).mockReturnValue(false);

    const history = ['first', 'second'];
    const react = await import('react');
    (react.useState as ReturnType<typeof vi.fn>).mockReturnValueOnce([history, setStateFn]);

    const { useCommandHistory } = await import('../hooks/useCommandHistory.js');
    const { navigateDown } = useCommandHistory();

    // indexRef.current is -1, so navigateDown returns null
    expect(navigateDown()).toBeNull();
  });

  it('navigateDown should move forward through history', async () => {
    (fs.existsSync as ReturnType<typeof vi.fn>).mockReturnValue(false);

    const history = ['first', 'second', 'third'];
    const react = await import('react');
    (react.useState as ReturnType<typeof vi.fn>).mockReturnValueOnce([history, setStateFn]);

    const { useCommandHistory } = await import('../hooks/useCommandHistory.js');
    const { navigateUp, navigateDown } = useCommandHistory();

    // Navigate up to the beginning
    navigateUp(); // -> 'third' (index 2)
    navigateUp(); // -> 'second' (index 1)
    navigateUp(); // -> 'first' (index 0)

    // Now navigate down
    expect(navigateDown()).toBe('second');  // index 1
    expect(navigateDown()).toBe('third');   // index 2
    // Past the end, returns null and resets index
    expect(navigateDown()).toBeNull();
    expect(refObject.current).toBe(-1);
  });

  it('resetNavigation should reset index to -1', async () => {
    (fs.existsSync as ReturnType<typeof vi.fn>).mockReturnValue(false);

    const history = ['a', 'b'];
    const react = await import('react');
    (react.useState as ReturnType<typeof vi.fn>).mockReturnValueOnce([history, setStateFn]);

    const { useCommandHistory } = await import('../hooks/useCommandHistory.js');
    const { navigateUp, resetNavigation } = useCommandHistory();

    navigateUp(); // index becomes 1
    expect(refObject.current).toBe(1);

    resetNavigation();
    expect(refObject.current).toBe(-1);
  });
});
