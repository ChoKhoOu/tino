import React from 'react';
import { describe, it, expect } from 'bun:test';
import { render } from 'ink-testing-library';
import { InitWizard } from '../InitWizard.js';

const delay = (ms = 50) => new Promise((r) => setTimeout(r, ms));

describe('InitWizard', () => {
  it('should render welcome step on mount', () => {
    const { lastFrame } = render(
      <InitWizard projectDir="/tmp/test-init" onComplete={() => {}} />,
    );
    const output = lastFrame()!;
    expect(output).toContain('Initialize Tino Project');
  });

  it('should show list of files that will be created', () => {
    const { lastFrame } = render(
      <InitWizard projectDir="/tmp/test-init" onComplete={() => {}} />,
    );
    const output = lastFrame()!;
    expect(output).toContain('settings.json');
    expect(output).toContain('permissions.json');
  });

  it('should show exchange selection on enter', async () => {
    const { lastFrame, stdin } = render(
      <InitWizard projectDir="/tmp/test-init" onComplete={() => {}} />,
    );
    stdin.write('\r');
    await delay();
    const output = lastFrame()!;
    expect(output).toContain('Select Exchange');
  });

  it('should show exchange options', async () => {
    const { lastFrame, stdin } = render(
      <InitWizard projectDir="/tmp/test-init" onComplete={() => {}} />,
    );
    stdin.write('\r');
    await delay();
    const output = lastFrame()!;
    expect(output).toContain('Binance');
    expect(output).toContain('OKX');
    expect(output).toContain('Bybit');
    expect(output).toContain('Skip');
  });

  it('should skip to trading pair when Skip is selected', async () => {
    const { lastFrame, stdin } = render(
      <InitWizard projectDir="/tmp/test-init" onComplete={() => {}} />,
    );
    stdin.write('\r');
    await delay();
    stdin.write('\x1B[B'); // down
    await delay();
    stdin.write('\x1B[B'); // down
    await delay();
    stdin.write('\x1B[B'); // down to Skip
    await delay();
    stdin.write('\r');
    await delay();
    const output = lastFrame()!;
    expect(output).toContain('Default Trading Pair');
  });

  it('should show API key input when exchange is selected', async () => {
    const { lastFrame, stdin } = render(
      <InitWizard projectDir="/tmp/test-init" onComplete={() => {}} />,
    );
    stdin.write('\r');
    await delay();
    stdin.write('\r'); // select Binance (first item)
    await delay();
    const output = lastFrame()!;
    expect(output).toContain('API Key');
  });
});
