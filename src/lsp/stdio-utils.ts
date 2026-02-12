export type Bytes = Uint8Array<ArrayBufferLike>;

type WritablePipe = {
  write: (chunk: Uint8Array | string) => unknown;
  end: () => unknown;
};

export function spawnWithPipes(command: string[]): ReturnType<typeof Bun.spawn> {
  return Bun.spawn(command, { stdin: 'pipe', stdout: 'pipe', stderr: 'pipe' });
}

export function concatBytes(left: Uint8Array, right: Uint8Array): Bytes {
  const merged: Bytes = new Uint8Array(left.byteLength + right.byteLength);
  merged.set(left, 0);
  merged.set(right, left.byteLength);
  return merged;
}

export function indexOfSequence(data: Uint8Array, sequence: number[]): number {
  for (let i = 0; i <= data.byteLength - sequence.length; i++) {
    let matched = true;
    for (let j = 0; j < sequence.length; j++) {
      if (data[i + j] !== sequence[j]) {
        matched = false;
        break;
      }
    }
    if (matched) return i;
  }
  return -1;
}

export function isReadableStream(value: unknown): value is ReadableStream<Uint8Array> {
  return typeof value === 'object' && value !== null && 'getReader' in value;
}

export function isWritablePipe(value: unknown): value is WritablePipe {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Partial<WritablePipe>;
  return typeof candidate.write === 'function' && typeof candidate.end === 'function';
}
