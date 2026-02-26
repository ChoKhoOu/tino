#!/usr/bin/env node

import React from 'react';
import { render } from 'ink';
import { App } from './app.js';
import { DaemonManager, unregisterCli, setShuttingDown } from './daemon/index.js';
import { findMonorepoRoot, resolveEnginePaths } from './daemon/root-finder.js';

async function main() {
  const root = findMonorepoRoot();
  const paths = resolveEnginePaths(root);
  const daemon = new DaemonManager(paths);

  daemon.registerCli();

  // Show startup message
  process.stdout.write('Starting Tino...\n');

  try {
    await daemon.ensureEngine();
  } catch (error) {
    console.error(`Failed to start engine: ${error}`);
    daemon.unregisterCli();
    process.exit(1);
  }

  const engineUrl = `http://127.0.0.1:${daemon.getEnginePort()}`;
  const apiKey = process.env.ANTHROPIC_API_KEY || '';

  let isCleaningUp = false;

  const cleanup = async () => {
    if (isCleaningUp) return; // Prevent double-cleanup
    isCleaningUp = true;
    setShuttingDown(true); // Prevent watchdog from restarting engine
    try {
      await daemon.shutdownIfLastCli();
    } catch {
      /* best effort */
    }
  };

  // For SIGINT/SIGTERM: await cleanup, then exit
  const handleSignal = async () => {
    await cleanup();
    process.exit(0);
  };

  process.on('SIGINT', () => { handleSignal().catch(() => process.exit(1)); });
  process.on('SIGTERM', () => { handleSignal().catch(() => process.exit(1)); });
  process.on('uncaughtException', (err) => {
    console.error('Fatal:', err);
    // For uncaught exceptions, do sync cleanup only (unregister lock file)
    try { unregisterCli(); } catch { /* best effort */ }
    process.exit(1);
  });

  const { waitUntilExit } = render(
    React.createElement(App, {
      engineUrl,
      apiKey,
      pythonPath: paths.pythonPath,
      engineDir: paths.engineDir,
      dashboardDist: paths.dashboardDist,
    }),
  );

  await waitUntilExit();
  await cleanup();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
