import { describe, expect, test } from 'bun:test';
import { render } from 'ink-testing-library';
import { CheckpointDiff } from '../CheckpointDiff.js';

describe('CheckpointDiff', () => {
  test('renders file and conversation impact summary', () => {
    const { lastFrame } = render(
      <CheckpointDiff
        filesChanged={4}
        turnsRemoved={2}
        gitRef="abc123def"
      />,
    );

    const frame = lastFrame()!;
    expect(frame).toContain('4 files will be reverted');
    expect(frame).toContain('2 conversation turns will be removed');
    expect(frame).toContain('Git ref: abc123def');
  });

  test('renders confirm and cancel options', () => {
    const { lastFrame } = render(
      <CheckpointDiff
        filesChanged={1}
        turnsRemoved={0}
        gitRef="commit-sha"
      />,
    );

    const frame = lastFrame()!;
    expect(frame).toContain('Confirm restore');
    expect(frame).toContain('Cancel');
  });
});
