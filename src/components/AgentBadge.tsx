import { Text } from 'ink';
import { colors } from '../theme.js';

interface AgentBadgeProps {
  agentName: string;
}

export function AgentBadge({ agentName }: AgentBadgeProps) {
  return <Text bold color={colors.primary}>[{agentName}]</Text>;
}
