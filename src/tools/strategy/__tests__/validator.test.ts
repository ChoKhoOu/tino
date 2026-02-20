import { describe, test, expect } from 'bun:test';
import { extractStrategyClassName, validateStrategyCode } from '../validator.js';

// Helper: minimal valid strategy code
const VALID_STRATEGY = `
import numpy as np
from nautilus_trader.trading.strategy import Strategy

class MyStrategy(Strategy):
    def on_start(self):
        pass

    def on_bar(self, bar):
        pass
`;

// ---------------------------------------------------------------------------
// extractStrategyClassName
// ---------------------------------------------------------------------------
describe('extractStrategyClassName', () => {
  test('extracts class name from valid Strategy subclass', () => {
    const code = 'class MyStrategy(Strategy):';
    expect(extractStrategyClassName(code)).toBe('MyStrategy');
  });

  test('extracts class name with base class prefix containing Strategy', () => {
    const code = 'class FooStrategy(NautilusStrategy):';
    expect(extractStrategyClassName(code)).toBe('FooStrategy');
  });

  test('returns null for plain function definition', () => {
    const code = 'def my_function():';
    expect(extractStrategyClassName(code)).toBeNull();
  });

  test('returns null when base class does not contain Strategy', () => {
    const code = 'class Foo(Bar):';
    expect(extractStrategyClassName(code)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// validateStrategyCode — valid code
// ---------------------------------------------------------------------------
describe('validateStrategyCode — valid code', () => {
  test('returns valid for well-formed strategy with lifecycle methods', () => {
    const result = validateStrategyCode(VALID_STRATEGY);
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.warnings).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// validateStrategyCode — dangerous imports
// ---------------------------------------------------------------------------
describe('validateStrategyCode — dangerous imports', () => {
  const dangerousImportCases: Array<[string, string]> = [
    ['import os', 'os'],
    ['import subprocess', 'subprocess'],
    ['import socket', 'socket'],
    ['import shutil', 'shutil'],
    ['import requests', 'requests'],
    ['import urllib', 'urllib'],
    ['from os import path', 'os'],
    ['from subprocess import run', 'subprocess'],
    ['from pathlib import Path', 'pathlib'],
    ['from urllib.request import urlopen', 'urllib'],
  ];

  for (const [importLine, moduleName] of dangerousImportCases) {
    test(`detects dangerous import: ${importLine}`, () => {
      const code = `${importLine}\n\nclass MyStrategy(Strategy):\n    def on_start(self):\n        pass\n    def on_bar(self, bar):\n        pass`;
      const result = validateStrategyCode(code);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes(moduleName))).toBe(true);
    });
  }
});

// ---------------------------------------------------------------------------
// validateStrategyCode — dangerous execution patterns
// ---------------------------------------------------------------------------
describe('validateStrategyCode — dangerous execution patterns', () => {
  const execCases: Array<[string, string]> = [
    ['exec(code)', 'exec()'],
    ['eval(expression)', 'eval()'],
    ['compile(source, filename, mode)', 'compile()'],
    ["__import__('os')", '__import__()'],
  ];

  for (const [execCall, label] of execCases) {
    test(`detects dynamic execution: ${label}`, () => {
      const code = `class MyStrategy(Strategy):\n    def on_start(self):\n        ${execCall}\n    def on_bar(self, bar):\n        pass`;
      const result = validateStrategyCode(code);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes(label))).toBe(true);
    });
  }
});

// ---------------------------------------------------------------------------
// validateStrategyCode — missing strategy class
// ---------------------------------------------------------------------------
describe('validateStrategyCode — missing strategy class', () => {
  test('errors when no Strategy subclass is present', () => {
    const code = 'def my_function():\n    pass';
    const result = validateStrategyCode(code);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('class that extends Strategy'))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// validateStrategyCode — lifecycle warnings
// ---------------------------------------------------------------------------
describe('validateStrategyCode — lifecycle warnings', () => {
  test('warns when on_start is missing', () => {
    const code = 'class MyStrategy(Strategy):\n    def on_bar(self, bar):\n        pass';
    const result = validateStrategyCode(code);
    expect(result.valid).toBe(true);
    expect(result.warnings.some((w) => w.includes('on_start'))).toBe(true);
  });

  test('warns when on_bar is missing', () => {
    const code = 'class MyStrategy(Strategy):\n    def on_start(self):\n        pass';
    const result = validateStrategyCode(code);
    expect(result.valid).toBe(true);
    expect(result.warnings.some((w) => w.includes('on_bar'))).toBe(true);
  });

  test('no warnings when both on_start and on_bar are present', () => {
    const result = validateStrategyCode(VALID_STRATEGY);
    expect(result.warnings).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------
describe('validateStrategyCode — edge cases', () => {
  test('reports multiple errors for multiple dangerous imports', () => {
    const code = `import os\nimport subprocess\n\nclass MyStrategy(Strategy):\n    def on_start(self):\n        pass\n    def on_bar(self, bar):\n        pass`;
    const result = validateStrategyCode(code);
    expect(result.valid).toBe(false);
    expect(result.errors.filter((e) => e.includes('Dangerous import')).length).toBeGreaterThanOrEqual(2);
  });

  test('safe imports (numpy, pandas) do NOT trigger errors', () => {
    const code = `import numpy as np\nimport pandas as pd\n\nclass MyStrategy(Strategy):\n    def on_start(self):\n        pass\n    def on_bar(self, bar):\n        pass`;
    const result = validateStrategyCode(code);
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  test('import os_utils does NOT trigger os import error (word boundary)', () => {
    const code = `import os_utils\n\nclass MyStrategy(Strategy):\n    def on_start(self):\n        pass\n    def on_bar(self, bar):\n        pass`;
    const result = validateStrategyCode(code);
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  test('indented import is still caught', () => {
    const code = `  import os\n\nclass MyStrategy(Strategy):\n    def on_start(self):\n        pass\n    def on_bar(self, bar):\n        pass`;
    const result = validateStrategyCode(code);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('os'))).toBe(true);
  });

  test('comment line with import syntax is caught by regex (documents regex limitation)', () => {
    // The regex uses ^\s* with multiline flag, so a line like "# import os"
    // will NOT match because '#' is not whitespace. But "  import os  # comment" WILL match.
    const commentOnly = `# import os\n\nclass MyStrategy(Strategy):\n    def on_start(self):\n        pass\n    def on_bar(self, bar):\n        pass`;
    const resultComment = validateStrategyCode(commentOnly);
    // "# import os" does not start with optional whitespace then "import", so it is safe
    expect(resultComment.valid).toBe(true);

    // However, an actual import with a trailing comment IS caught
    const importWithComment = `import os  # needed\n\nclass MyStrategy(Strategy):\n    def on_start(self):\n        pass\n    def on_bar(self, bar):\n        pass`;
    const resultImport = validateStrategyCode(importWithComment);
    expect(resultImport.valid).toBe(false);
    expect(resultImport.errors.some((e) => e.includes('os'))).toBe(true);
  });
});
