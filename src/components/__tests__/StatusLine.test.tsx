import { describe, test, expect } from 'bun:test';
import React from 'react';
import { render } from 'ink-testing-library';
import { StatusLine } from '../StatusLine.js';

describe('StatusLine', () => {
  test('renders model name', () => {
    const { lastFrame } = render(
      <StatusLine
        modelName="gpt-5.2"
        contextPercent={10}
        daemonStatus="connected"
        cost={0.0012}
        duration={120}
      />
    );
    expect(lastFrame()).toContain('gpt-5.2');
  });

  test('renders context percentage', () => {
    const { lastFrame } = render(
      <StatusLine
        modelName="gpt-5.2"
        contextPercent={45}
        daemonStatus="connected"
        cost={0}
        duration={null}
      />
    );
    expect(lastFrame()).toContain('45%');
  });

  test('renders daemon status', () => {
    const { lastFrame } = render(
      <StatusLine
        modelName="gpt-5.2"
        contextPercent={10}
        daemonStatus="starting"
        cost={0}
        duration={null}
      />
    );
    // Depending on implementation, it might show "starting" text or just an icon
    // But the requirement says "Shows daemon status with colored indicator"
    // Let's assume it shows text for now or at least the status is reflected
    // The previous DaemonStatusBar showed "Daemon starting..."
    // The requirement says: "Shows daemon status with colored indicator (● green = connected, ○ red = error, spinner = starting)"
    // It doesn't explicitly say it must show the TEXT "starting", but usually status lines do.
    // Let's check for the text "starting" or "Daemon: starting"
    // The layout requirement: [Model] │ [Context: XX%] │ [Daemon: status] │ [$X.XXXX] │ [Xm Xs]
    // So it should contain "Daemon: starting" or similar.
    expect(lastFrame()).toContain('starting');
  });

  test('renders cost formatted', () => {
    const { lastFrame } = render(
      <StatusLine
        modelName="gpt-5.2"
        contextPercent={10}
        daemonStatus="connected"
        cost={1.23456}
        duration={null}
      />
    );
    expect(lastFrame()).toContain('$1.2346');
  });

  test('renders duration formatted', () => {
    const { lastFrame } = render(
      <StatusLine
        modelName="gpt-5.2"
        contextPercent={10}
        daemonStatus="connected"
        cost={0}
        duration={65} // 1m 5s
      />
    );
    expect(lastFrame()).toContain('1m 5s');
  });
});
