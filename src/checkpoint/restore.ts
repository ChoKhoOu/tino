import type { Checkpoint, ConversationSnapshot, FileSnapshot } from './types.js';

export interface CheckpointDiff {
  filesChanged: number;
  turnsRemoved: number;
  gitRef: string;
}

export interface RestoreCheckpointOptions {
  rootDir?: string;
}

function snapshotKey(file: FileSnapshot): string {
  return [file.path, file.gitRef ?? '', file.content ?? ''].join('::');
}

function getCheckpointGitRef(checkpoint: Checkpoint): string {
  return checkpoint.files.find((file) => typeof file.gitRef === 'string' && file.gitRef.length > 0)?.gitRef ?? '';
}

async function gitCheckout(gitRef: string, paths: string[], cwd: string): Promise<boolean> {
  try {
    const uniquePaths = Array.from(new Set(paths.filter(Boolean)));
    const checkoutPaths = uniquePaths.length > 0 ? uniquePaths : ['.'];
    const proc = Bun.spawn(['git', 'checkout', gitRef, '--', ...checkoutPaths], {
      cwd,
      stdout: 'ignore',
      stderr: 'ignore',
      stdin: 'ignore',
    });
    return (await proc.exited) === 0;
  } catch {
    return false;
  }
}

export function computeCheckpointDiff(current: Checkpoint, checkpoint: Checkpoint): CheckpointDiff {
  const currentByPath = new Map(current.files.map((file) => [file.path, snapshotKey(file)]));
  const targetByPath = new Map(checkpoint.files.map((file) => [file.path, snapshotKey(file)]));
  const allPaths = new Set([...currentByPath.keys(), ...targetByPath.keys()]);

  let filesChanged = 0;
  for (const path of allPaths) {
    if (currentByPath.get(path) !== targetByPath.get(path)) filesChanged += 1;
  }

  return {
    filesChanged,
    turnsRemoved: Math.max(0, current.conversation.history.length - checkpoint.conversation.history.length),
    gitRef: getCheckpointGitRef(checkpoint),
  };
}

export async function restoreCheckpoint(
  checkpoint: Checkpoint,
  options: RestoreCheckpointOptions = {},
): Promise<ConversationSnapshot | null> {
  const gitRef = getCheckpointGitRef(checkpoint);
  if (gitRef) {
    const restored = await gitCheckout(
      gitRef,
      checkpoint.files.map((file) => file.path),
      options.rootDir ?? process.cwd(),
    );
    if (!restored) return null;
  }

  return checkpoint.conversation;
}
