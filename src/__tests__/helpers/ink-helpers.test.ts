import { describe, test, expect } from 'bun:test';
import { simulateKey, waitForFrame } from './ink-helpers.js';

// ─── simulateKey — ctrl+key mappings ────────────────────────────────────────

describe('simulateKey — ctrl keys', () => {
  function capture(): { write: (s: string) => void; written: string[] } {
    const written: string[] = [];
    return { write: (s: string) => written.push(s), written };
  }

  test('ctrl+a writes \\x01', () => {
    const stdin = capture();
    simulateKey(stdin, 'ctrl+a');
    expect(stdin.written).toEqual(['\x01']);
  });

  test('ctrl+b writes \\x02', () => {
    const stdin = capture();
    simulateKey(stdin, 'ctrl+b');
    expect(stdin.written).toEqual(['\x02']);
  });

  test('ctrl+c writes \\x03', () => {
    const stdin = capture();
    simulateKey(stdin, 'ctrl+c');
    expect(stdin.written).toEqual(['\x03']);
  });

  test('ctrl+d writes \\x04', () => {
    const stdin = capture();
    simulateKey(stdin, 'ctrl+d');
    expect(stdin.written).toEqual(['\x04']);
  });

  test('ctrl+g writes \\x07', () => {
    const stdin = capture();
    simulateKey(stdin, 'ctrl+g');
    expect(stdin.written).toEqual(['\x07']);
  });

  test('ctrl+k writes \\x0B', () => {
    const stdin = capture();
    simulateKey(stdin, 'ctrl+k');
    expect(stdin.written).toEqual(['\x0B']);
  });

  test('ctrl+l writes \\x0C', () => {
    const stdin = capture();
    simulateKey(stdin, 'ctrl+l');
    expect(stdin.written).toEqual(['\x0C']);
  });

  test('ctrl+o writes \\x0F', () => {
    const stdin = capture();
    simulateKey(stdin, 'ctrl+o');
    expect(stdin.written).toEqual(['\x0F']);
  });

  test('ctrl+r writes \\x12', () => {
    const stdin = capture();
    simulateKey(stdin, 'ctrl+r');
    expect(stdin.written).toEqual(['\x12']);
  });

  test('ctrl+t writes \\x14', () => {
    const stdin = capture();
    simulateKey(stdin, 'ctrl+t');
    expect(stdin.written).toEqual(['\x14']);
  });

  test('ctrl+u writes \\x15', () => {
    const stdin = capture();
    simulateKey(stdin, 'ctrl+u');
    expect(stdin.written).toEqual(['\x15']);
  });

  test('ctrl+y writes \\x19', () => {
    const stdin = capture();
    simulateKey(stdin, 'ctrl+y');
    expect(stdin.written).toEqual(['\x19']);
  });
});

// ─── simulateKey — escape / alt / shift ─────────────────────────────────────

describe('simulateKey — escape, alt, shift', () => {
  function capture(): { write: (s: string) => void; written: string[] } {
    const written: string[] = [];
    return { write: (s: string) => written.push(s), written };
  }

  test('escape writes \\x1b', () => {
    const stdin = capture();
    simulateKey(stdin, 'escape');
    expect(stdin.written).toEqual(['\x1b']);
  });

  test('alt+p writes \\x1bp', () => {
    const stdin = capture();
    simulateKey(stdin, 'alt+p');
    expect(stdin.written).toEqual(['\x1bp']);
  });

  test('alt+t writes \\x1bt', () => {
    const stdin = capture();
    simulateKey(stdin, 'alt+t');
    expect(stdin.written).toEqual(['\x1bt']);
  });

  test('alt+y writes \\x1by', () => {
    const stdin = capture();
    simulateKey(stdin, 'alt+y');
    expect(stdin.written).toEqual(['\x1by']);
  });

  test('shift+tab writes \\x1b[Z', () => {
    const stdin = capture();
    simulateKey(stdin, 'shift+tab');
    expect(stdin.written).toEqual(['\x1b[Z']);
  });
});

// ─── simulateKey — arrow keys ───────────────────────────────────────────────

describe('simulateKey — arrow keys', () => {
  function capture(): { write: (s: string) => void; written: string[] } {
    const written: string[] = [];
    return { write: (s: string) => written.push(s), written };
  }

  test('up writes \\x1b[A', () => {
    const stdin = capture();
    simulateKey(stdin, 'up');
    expect(stdin.written).toEqual(['\x1b[A']);
  });

  test('down writes \\x1b[B', () => {
    const stdin = capture();
    simulateKey(stdin, 'down');
    expect(stdin.written).toEqual(['\x1b[B']);
  });

  test('right writes \\x1b[C', () => {
    const stdin = capture();
    simulateKey(stdin, 'right');
    expect(stdin.written).toEqual(['\x1b[C']);
  });

  test('left writes \\x1b[D', () => {
    const stdin = capture();
    simulateKey(stdin, 'left');
    expect(stdin.written).toEqual(['\x1b[D']);
  });
});

// ─── simulateKey — special keys ─────────────────────────────────────────────

describe('simulateKey — special keys', () => {
  function capture(): { write: (s: string) => void; written: string[] } {
    const written: string[] = [];
    return { write: (s: string) => written.push(s), written };
  }

  test('enter writes \\r', () => {
    const stdin = capture();
    simulateKey(stdin, 'enter');
    expect(stdin.written).toEqual(['\r']);
  });

  test('tab writes \\t', () => {
    const stdin = capture();
    simulateKey(stdin, 'tab');
    expect(stdin.written).toEqual(['\t']);
  });

  test('backspace writes \\x7f', () => {
    const stdin = capture();
    simulateKey(stdin, 'backspace');
    expect(stdin.written).toEqual(['\x7f']);
  });

  test('throws on unknown key', () => {
    const stdin = capture();
    expect(() => simulateKey(stdin, 'unknown_key')).toThrow();
  });
});

// ─── waitForFrame ───────────────────────────────────────────────────────────

describe('waitForFrame', () => {
  test('resolves when predicate matches immediately', async () => {
    const result = { lastFrame: () => 'Hello World' };
    const frame = await waitForFrame(result, (f) => f.includes('Hello'));
    expect(frame).toBe('Hello World');
  });

  test('resolves when predicate matches after delay', async () => {
    let callCount = 0;
    const result = {
      lastFrame: () => {
        callCount++;
        return callCount >= 3 ? 'Ready' : 'Loading';
      },
    };
    const frame = await waitForFrame(result, (f) => f === 'Ready');
    expect(frame).toBe('Ready');
  });

  test('rejects on timeout', async () => {
    const result = { lastFrame: () => 'never matches' };
    await expect(
      waitForFrame(result, () => false, 100),
    ).rejects.toThrow('timed out');
  });

  test('handles undefined lastFrame gracefully', async () => {
    let callCount = 0;
    const result = {
      lastFrame: () => {
        callCount++;
        return callCount >= 3 ? 'Found' : undefined;
      },
    };
    const frame = await waitForFrame(result, (f) => f === 'Found');
    expect(frame).toBe('Found');
  });
});
