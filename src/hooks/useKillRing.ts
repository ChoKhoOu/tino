import { useRef } from 'react';

export class KillRing {
  private ring: string[] = [];
  private index = 0;
  readonly maxSize = 10;

  push(text: string): void {
    if (text.length === 0) return;
    this.ring.push(text);
    if (this.ring.length > this.maxSize) {
      this.ring.shift();
    }
    this.index = this.ring.length - 1;
  }

  yank(): string | null {
    if (this.ring.length === 0) return null;
    this.index = this.ring.length - 1;
    return this.ring[this.index]!;
  }

  yankPop(): string | null {
    if (this.ring.length === 0) return null;
    this.index = (this.index - 1 + this.ring.length) % this.ring.length;
    return this.ring[this.index]!;
  }

  get size(): number {
    return this.ring.length;
  }

  getEntries(): string[] {
    return [...this.ring];
  }
}

interface TextResult {
  newText: string;
  newCursor: number;
}

export interface KillRingInstance {
  killToEnd: (text: string, cursorPosition: number) => TextResult;
  killLine: (text: string) => TextResult;
  yank: (text: string, cursorPosition: number) => TextResult;
  yankPop: (text: string, cursorPosition: number, lastYankLength: number) => TextResult;
  getRing: () => string[];
}

function findLineEnd(text: string, cursor: number): number {
  const idx = text.indexOf('\n', cursor);
  return idx === -1 ? text.length : idx;
}

export function createKillRing(): KillRingInstance {
  const kr = new KillRing();

  return {
    killToEnd(text: string, cursorPosition: number): TextResult {
      if (cursorPosition >= text.length) {
        return { newText: text, newCursor: cursorPosition };
      }

      const lineEnd = findLineEnd(text, cursorPosition);

      if (lineEnd === cursorPosition) {
        kr.push('\n');
        const newText = text.slice(0, cursorPosition) + text.slice(cursorPosition + 1);
        return { newText, newCursor: cursorPosition };
      }

      const killed = text.slice(cursorPosition, lineEnd);
      kr.push(killed);
      const newText = text.slice(0, cursorPosition) + text.slice(lineEnd);
      return { newText, newCursor: cursorPosition };
    },

    killLine(text: string): TextResult {
      if (text.length === 0) {
        return { newText: '', newCursor: 0 };
      }
      kr.push(text);
      return { newText: '', newCursor: 0 };
    },

    yank(text: string, cursorPosition: number): TextResult {
      const entry = kr.yank();
      if (!entry) return { newText: text, newCursor: cursorPosition };
      const newText = text.slice(0, cursorPosition) + entry + text.slice(cursorPosition);
      return { newText, newCursor: cursorPosition + entry.length };
    },

    yankPop(text: string, cursorPosition: number, lastYankLength: number): TextResult {
      const entry = kr.yankPop();
      if (!entry) return { newText: text, newCursor: cursorPosition };
      const removeStart = cursorPosition - lastYankLength;
      const newText = text.slice(0, removeStart) + entry + text.slice(cursorPosition);
      return { newText, newCursor: removeStart + entry.length };
    },

    getRing(): string[] {
      return kr.getEntries();
    },
  };
}

export function useKillRing(): KillRingInstance {
  const instanceRef = useRef<KillRingInstance | null>(null);
  if (!instanceRef.current) {
    instanceRef.current = createKillRing();
  }
  return instanceRef.current;
}
