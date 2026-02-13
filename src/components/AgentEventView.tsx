import { Box } from 'ink';
import type { RunEvent } from '@/domain/index.js';
export { ThinkingView } from './events/ThinkingView.js';
export { ToolStartView } from './events/ToolStartView.js';
export { ToolEndView } from './events/ToolEndView.js';
export { ToolErrorView } from './events/ToolErrorView.js';
export { ContextClearedView } from './events/ContextClearedView.js';
export { BrowserSessionView } from './events/BrowserSessionView.js';
import { ThinkingView } from './events/ThinkingView.js';
import { ToolStartView } from './events/ToolStartView.js';
import { ToolEndView } from './events/ToolEndView.js';
import { ToolErrorView } from './events/ToolErrorView.js';
import { ContextClearedView } from './events/ContextClearedView.js';
import { BrowserSessionView } from './events/BrowserSessionView.js';

export interface DisplayEvent {
  id: string;
  event: RunEvent;
  completed?: boolean;
  endEvent?: RunEvent;
  progressMessage?: string;
}

export function AgentEventView({ event, isActive = false, progressMessage }: {
  event: RunEvent; isActive?: boolean; progressMessage?: string;
}) {
  switch (event.type) {
    case 'thinking': return <ThinkingView message={event.message} />;
    case 'tool_start': return <ToolStartView toolId={event.toolId} args={event.args} agent={event.agent} isActive={isActive} progressMessage={progressMessage} />;
    case 'tool_end': return <ToolEndView toolId={event.toolId} args={{}} result={event.result} duration={event.duration} />;
    case 'tool_error': return <ToolErrorView toolId={event.toolId} error={event.error} />;
    case 'context_cleared': return <ContextClearedView clearedCount={event.clearedCount} keptCount={event.keptCount} />;
    default: return null;
  }
}

type EventGroup =
  | { type: 'browser_session'; id: string; events: DisplayEvent[]; activeStepId?: string }
  | { type: 'single'; displayEvent: DisplayEvent };

function groupBrowserEvents(events: DisplayEvent[], activeToolId?: string): EventGroup[] {
  const groups: EventGroup[] = [];
  let browserGroup: DisplayEvent[] = [];
  const flush = () => {
    if (browserGroup.length > 0) {
      groups.push({
        type: 'browser_session',
        id: `browser-${browserGroup[0].id}`,
        events: browserGroup,
        activeStepId: browserGroup.some(e => e.id === activeToolId) ? activeToolId : undefined,
      });
      browserGroup = [];
    }
  };
  for (const event of events) {
    if (event.event.type === 'tool_start' && event.event.toolId === 'browser') {
      browserGroup.push(event);
    } else {
      flush();
      groups.push({ type: 'single', displayEvent: event });
    }
  }
  flush();
  return groups;
}

export function EventListView({ events, activeToolId }: {
  events: DisplayEvent[]; activeToolId?: string;
}) {
  return (
    <Box flexDirection="column" gap={0} marginTop={1}>
      {groupBrowserEvents(events, activeToolId).map((group) => {
        if (group.type === 'browser_session') {
          return <Box key={group.id} marginBottom={1}><BrowserSessionView events={group.events} activeStepId={group.activeStepId} /></Box>;
        }
        const { id, event, completed, endEvent, progressMessage } = group.displayEvent;
        if (event.type === 'tool_start' && completed && endEvent?.type === 'tool_end') {
          return <Box key={id} marginBottom={1}><ToolEndView toolId={endEvent.toolId} args={event.args} result={endEvent.result} duration={endEvent.duration} /></Box>;
        }
        if (event.type === 'tool_start' && completed && endEvent?.type === 'tool_error') {
          return <Box key={id} marginBottom={1}><ToolErrorView toolId={endEvent.toolId} error={endEvent.error} /></Box>;
        }
        return <Box key={id} marginBottom={1}><AgentEventView event={event} isActive={!completed && id === activeToolId} progressMessage={progressMessage} /></Box>;
      })}
    </Box>
  );
}
