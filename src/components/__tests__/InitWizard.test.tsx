import React from 'react';
import { describe, it, expect } from 'bun:test';
import { render } from 'ink-testing-library';
import { InitWizard } from '../InitWizard.js';

const delay = (ms = 50) => new Promise((r) => setTimeout(r, ms));

describe('InitWizard', () => {
  it('should render AI provider step on mount', () => {
    const { lastFrame } = render(
      <InitWizard projectDir="/tmp/test-init" onComplete={() => {}} />,
    );
    const output = lastFrame()!;
    expect(output).toContain('AI Model Configuration');
  });

  it('should show AI options', () => {
    const { lastFrame } = render(
      <InitWizard projectDir="/tmp/test-init" onComplete={() => {}} />,
    );
    const output = lastFrame()!;
    expect(output).toContain('Anthropic (Claude)');
    expect(output).toContain('OpenAI (GPT)');
    expect(output).toContain('Skip (Free Tier / Demo)');
  });

  it('should show exchange selection when AI skipped', async () => {
    const { lastFrame, stdin } = render(
      <InitWizard projectDir="/tmp/test-init" onComplete={() => {}} />,
    );
    stdin.write('\x1B[B'); // down
    await delay();
    stdin.write('\x1B[B'); // down to Skip
    await delay();
    stdin.write('\r');
    await delay();
    const output = lastFrame()!;
    expect(output).toContain('Exchange Connection (Optional)');
  });

  it('should show exchange options', async () => {
    const { lastFrame, stdin } = render(
      <InitWizard projectDir="/tmp/test-init" onComplete={() => {}} />,
    );
    // skip AI step
    stdin.write('\x1B[B'); // down
    await delay();
    stdin.write('\x1B[B'); // down to Skip
    await delay();
    stdin.write('\r');
    await delay();
    
    const output = lastFrame()!;
    expect(output).toContain('Binance');
    expect(output).toContain('OKX');
    expect(output).toContain('Bybit');
    expect(output).toContain('Skip for now');
  });

  it('should skip to complete when Exchange is skipped', async () => {
    const { lastFrame, stdin } = render(
      <InitWizard projectDir="/tmp/test-init" onComplete={() => {}} />,
    );
    // skip AI
    stdin.write('\x1B[B'); await delay();
    stdin.write('\x1B[B'); await delay();
    stdin.write('\r'); await delay();
    
    // skip Exchange
    stdin.write('\x1B[B'); await delay();
    stdin.write('\x1B[B'); await delay();
    stdin.write('\x1B[B'); await delay();
    stdin.write('\r'); await delay();
    
    const output = lastFrame()!;
    expect(output).toContain('Setup Complete!');
  });

  it('should show AI key input when AI provider is selected', async () => {
    const { lastFrame, stdin } = render(
      <InitWizard projectDir="/tmp/test-init" onComplete={() => {}} />,
    );
    stdin.write('\r'); // select Anthropic
    await delay();
    const output = lastFrame()!;
    expect(output).toContain('API Key');
    expect(output).toContain('Anthropic');
  });

  it('should show exchange API key input when exchange is selected', async () => {
    const { lastFrame, stdin } = render(
      <InitWizard projectDir="/tmp/test-init" onComplete={() => {}} />,
    );
    // skip AI step
    stdin.write('\x1B[B'); await delay();
    stdin.write('\x1B[B'); await delay();
    stdin.write('\r'); await delay();

    // select Binance
    stdin.write('\r'); await delay();
    const output = lastFrame()!;
    expect(output).toContain('Binance');
    expect(output).toContain('API Key');
  });

  it('should show exchange API secret after entering API key', async () => {
    const { lastFrame, stdin } = render(
      <InitWizard projectDir="/tmp/test-init" onComplete={() => {}} />,
    );
    // skip AI step
    stdin.write('\x1B[B'); await delay();
    stdin.write('\x1B[B'); await delay();
    stdin.write('\r'); await delay();

    // select Binance
    stdin.write('\r'); await delay();

    // type API key and submit
    stdin.write('testkey123');
    await delay();
    stdin.write('\r'); await delay();

    const output = lastFrame()!;
    expect(output).toContain('API Secret');
  });
});
