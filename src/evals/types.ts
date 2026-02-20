/**
 * Shared types for the eval runner.
 */

import type { SessionRuntime } from '../runtime/session-runtime.js';
import type { ModelBroker } from '../runtime/model-broker.js';

export interface Example {
  inputs: { question: string };
  outputs: { answer: string };
}

export interface EvalRuntime {
  runtime: SessionRuntime;
  broker: ModelBroker;
}
