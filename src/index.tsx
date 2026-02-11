#!/usr/bin/env bun
import React from 'react';
import { render } from 'ink';
import { config } from 'dotenv';
import { CLI } from './cli.js';

config({ quiet: true });

const { waitUntilExit } = render(<CLI />);
await waitUntilExit();
