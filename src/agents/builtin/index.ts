import type { AgentRegistry } from '../registry.js';
import { buildAgent } from './build.js';
import { planAgent } from './plan.js';
import { exploreAgent } from './explore.js';
import { generalAgent } from './general.js';
import { compactionAgent } from './compaction.js';

export { buildAgent } from './build.js';
export { planAgent } from './plan.js';
export { exploreAgent } from './explore.js';
export { generalAgent } from './general.js';
export { compactionAgent } from './compaction.js';

const BUILTIN_AGENTS = [buildAgent, planAgent, exploreAgent, generalAgent, compactionAgent];

export function registerBuiltinAgents(registry: AgentRegistry): void {
  for (const agent of BUILTIN_AGENTS) {
    registry.register(agent);
  }
}
