const MAX_ENTRIES = 100;
const DEFAULT_PATH = '.tino/bash-history.json';

export interface BashHistory {
  addToHistory(command: string): Promise<void>;
  getMatches(prefix: string): string[];
  getBestMatch(prefix: string): string | null;
  getEntries(): string[];
  load(): Promise<void>;
}

export function createBashHistory(storagePath: string = DEFAULT_PATH): BashHistory {
  let entries: string[] = [];

  async function persist(): Promise<void> {
    try {
      await Bun.write(storagePath, JSON.stringify(entries));
    } catch {
      // Cache operations never throw (resilience pattern)
    }
  }

  async function load(): Promise<void> {
    try {
      const file = Bun.file(storagePath);
      if (await file.exists()) {
        const data = await file.json();
        if (Array.isArray(data)) {
          entries = data.filter((e): e is string => typeof e === 'string');
        }
      }
    } catch {
      entries = [];
    }
  }

  async function addToHistory(command: string): Promise<void> {
    const trimmed = command.trim();
    if (!trimmed) return;

    const last = entries[entries.length - 1];
    if (last === trimmed) return;

    entries.push(trimmed);

    if (entries.length > MAX_ENTRIES) {
      entries = entries.slice(entries.length - MAX_ENTRIES);
    }

    await persist();
  }

  function getMatches(prefix: string): string[] {
    if (!prefix) return [];

    const matches: string[] = [];
    for (let i = entries.length - 1; i >= 0; i--) {
      if (entries[i].startsWith(prefix)) {
        matches.push(entries[i]);
      }
    }
    return matches;
  }

  function getBestMatch(prefix: string): string | null {
    if (!prefix) return null;

    for (let i = entries.length - 1; i >= 0; i--) {
      if (entries[i].startsWith(prefix) && entries[i] !== prefix) {
        return entries[i];
      }
    }
    return null;
  }

  function getEntries(): string[] {
    return [...entries];
  }

  return { addToHistory, getMatches, getBestMatch, getEntries, load };
}
