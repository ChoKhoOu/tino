#!/usr/bin/env bun
import React from 'react';
import { render } from 'ink';
import { config } from 'dotenv';
import { CLI } from './cli.js';

// Load environment variables
config({ quiet: true });

// Handle subcommands before launching the interactive Ink app
const subcommand = process.argv[2];

if (subcommand === 'init') {
  // `tino init <project-name>` — one-shot command, no Ink rendering
  const { runInitCommand } = await import('./commands/init.js');
  await runInitCommand(process.argv.slice(3));
} else {
  // Default: launch interactive CLI
  const { waitUntilExit } = render(<CLI />);
  await waitUntilExit();
}
