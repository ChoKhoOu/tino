import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { mkdtempSync, rmSync, writeFileSync, readFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import type { Checkpoint } from '../types.js';
import { computeCheckpointDiff, restoreCheckpoint } from '../restore.js';

function makeCheckpoint(historyLen: number, gitRef?: string): Checkpoint {
  return {
    id: `cp-${historyLen}`,
    timestamp: new Date().toISOString(),
    turnIndex: historyLen,
    files: [{ path: '.', gitRef }],
    conversation: {
      history: Array.from({ length: historyLen }, (_, i) => ({ id: `turn-${i}` })),
      runtime: {
        events: [],
        answer: `answer-${historyLen}`,
        status: 'done',
      },
    },
  };
}

async function runGit(args: string[], cwd: string): Promise<string> {
  const proc = Bun.spawn(['git', ...args], {
    cwd,
    stdout: 'pipe',
    stderr: 'pipe',
    stdin: 'ignore',
  });
  const code = await proc.exited;
  const stdout = (await new Response(proc.stdout).text()).trim();
  if (code !== 0) {
    const stderr = (await new Response(proc.stderr).text()).trim();
    throw new Error(`git ${args.join(' ')} failed: ${stderr}`);
  }
  return stdout;
}

describe('checkpoint restore', () => {
  let repoDir: string;

  beforeEach(async () => {
    repoDir = mkdtempSync(join(tmpdir(), 'tino-restore-test-'));
    await runGit(['init', '--initial-branch=main'], repoDir);
    await runGit(['config', 'user.email', 'restore-test@local'], repoDir);
    await runGit(['config', 'user.name', 'Restore Test'], repoDir);
  });

  afterEach(() => {
    rmSync(repoDir, { recursive: true, force: true });
  });

  test('computeCheckpointDiff reports file and turn changes', () => {
    const current = makeCheckpoint(6, 'current-sha');
    current.files.push({ path: 'extra.txt', content: 'new' });
    const target = makeCheckpoint(3, 'target-sha');

    const diff = computeCheckpointDiff(current, target);
    expect(diff.filesChanged).toBe(2);
    expect(diff.turnsRemoved).toBe(3);
    expect(diff.gitRef).toBe('target-sha');
  });

  test('restoreCheckpoint checks out git ref and returns conversation snapshot', async () => {
    const filePath = join(repoDir, 'state.txt');

    writeFileSync(filePath, 'v1');
    await runGit(['add', '.'], repoDir);
    await runGit(['commit', '-m', 'v1'], repoDir);
    const oldRef = await runGit(['rev-parse', 'HEAD'], repoDir);

    writeFileSync(filePath, 'v2');
    await runGit(['add', '.'], repoDir);
    await runGit(['commit', '-m', 'v2'], repoDir);

    const checkpoint = makeCheckpoint(1, oldRef);
    const restoredConversation = await restoreCheckpoint(checkpoint, { rootDir: repoDir });

    expect(restoredConversation).toEqual(checkpoint.conversation);
    expect(readFileSync(filePath, 'utf8')).toBe('v1');
  });

  test('restoreCheckpoint skips git checkout when checkpoint has no git ref', async () => {
    const filePath = join(repoDir, 'note.txt');
    writeFileSync(filePath, 'keep-me');

    const checkpoint = makeCheckpoint(2);
    const restoredConversation = await restoreCheckpoint(checkpoint, { rootDir: repoDir });

    expect(restoredConversation).toEqual(checkpoint.conversation);
    expect(readFileSync(filePath, 'utf8')).toBe('keep-me');
  });
});
