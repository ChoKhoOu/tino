import { Box, Text } from 'ink';
import Spinner from 'ink-spinner';
import type { BackgroundTask, BackgroundTaskStatus } from '@/domain/background-task.js';
import { componentTokens } from '@/theme.js';

const MAX_VISIBLE_TASKS = 10;

function getStatusDisplay(status: BackgroundTaskStatus): {
  icon: string;
  label: string;
  color: string;
  showSpinner: boolean;
} {
  switch (status) {
    case 'pending':
      return { icon: '◯', label: 'pending', color: componentTokens.taskList.pending, showSpinner: false };
    case 'running':
      return { icon: '◉', label: 'running', color: componentTokens.taskList.inProgress, showSpinner: true };
    case 'completed':
      return { icon: '✓', label: 'complete', color: componentTokens.taskList.complete, showSpinner: false };
    case 'failed':
      return { icon: '✗', label: 'failed', color: componentTokens.taskList.failed, showSpinner: false };
  }
}

interface TaskListProps {
  tasks: BackgroundTask[];
}

export function TaskList({ tasks }: TaskListProps) {
  if (tasks.length === 0) {
    return (
      <Box marginBottom={1}>
        <Text color={componentTokens.taskList.pending}>No background tasks</Text>
      </Box>
    );
  }

  const visibleTasks = tasks.slice(0, MAX_VISIBLE_TASKS);

  return (
    <Box flexDirection="column" marginBottom={1}>
      <Text bold>Background Tasks</Text>
      {visibleTasks.map((task) => {
        const status = getStatusDisplay(task.status);
        return (
          <Box key={task.id}>
            <Text color={status.color}>{status.icon}</Text>
            <Text color={status.color}> </Text>
            {status.showSpinner ? (
              <>
                <Text color={status.color}>
                  <Spinner type="dots" />
                </Text>
                <Text> </Text>
              </>
            ) : null}
            <Text>{task.description}</Text>
            <Text color={componentTokens.taskList.pending}> ({status.label})</Text>
          </Box>
        );
      })}
    </Box>
  );
}
