const KEY_MAP: Record<string, string> = {
  'ctrl+a': '\x01',
  'ctrl+b': '\x02',
  'ctrl+c': '\x03',
  'ctrl+d': '\x04',
  'ctrl+g': '\x07',
  'ctrl+k': '\x0B',
  'ctrl+l': '\x0C',
  'ctrl+o': '\x0F',
  'ctrl+r': '\x12',
  'ctrl+t': '\x14',
  'ctrl+u': '\x15',
  'ctrl+y': '\x19',
  'escape': '\x1b',
  'shift+tab': '\x1b[Z',
  'up': '\x1b[A',
  'down': '\x1b[B',
  'right': '\x1b[C',
  'left': '\x1b[D',
  'enter': '\r',
  'tab': '\t',
  'backspace': '\x7f',
};

// Alt+<char> is ESC followed by the character
function resolveKey(key: string): string {
  if (KEY_MAP[key]) return KEY_MAP[key];

  const altMatch = key.match(/^alt\+(.+)$/);
  if (altMatch) return `\x1b${altMatch[1]}`;

  throw new Error(`Unknown key: "${key}". Use one of: ${Object.keys(KEY_MAP).join(', ')}, or alt+<char>`);
}

export function simulateKey(stdin: { write: (s: string) => void }, key: string): void {
  stdin.write(resolveKey(key));
}

const DEFAULT_TIMEOUT = 3000;
const POLL_INTERVAL = 16;

export async function waitForFrame(
  result: { lastFrame: () => string | undefined },
  predicate: (frame: string) => boolean,
  timeout = DEFAULT_TIMEOUT,
): Promise<string> {
  const deadline = Date.now() + timeout;

  while (Date.now() < deadline) {
    const frame = result.lastFrame();
    if (frame !== undefined && predicate(frame)) return frame;
    await new Promise((r) => setTimeout(r, POLL_INTERVAL));
  }

  throw new Error(`waitForFrame timed out after ${timeout}ms`);
}
