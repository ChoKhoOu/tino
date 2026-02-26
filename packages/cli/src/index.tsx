#!/usr/bin/env node

declare const process: { env: Record<string, string | undefined> };

import React from 'react';
import { render } from 'ink';
import { App } from './app.js';

const engineUrl = process.env.ENGINE_URL || 'http://localhost:8000';
const apiKey = process.env.ANTHROPIC_API_KEY || '';

render(
  <App engineUrl={engineUrl} apiKey={apiKey} />,
);
