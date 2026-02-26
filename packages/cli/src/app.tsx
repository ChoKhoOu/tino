import React, { useState, useCallback } from 'react';
import { Box, Text, useApp } from 'ink';
import { Chat, type ChatMessage } from './components/Chat.js';
import { Input } from './components/Input.js';
import { StrategyReview } from './components/StrategyReview.js';
import { StrategyAgent, type AgentAction } from './agents/strategy-agent.js';
import { LLMClient } from './services/llm-client.js';

interface AppProps {
  engineUrl?: string;
  apiKey?: string;
}

export function App({ engineUrl = 'http://localhost:8000', apiKey }: AppProps) {
  const { exit } = useApp();
  const [llm] = useState(() => new LLMClient({ apiKey }));
  const [agent] = useState(() => new StrategyAgent(llm, engineUrl));
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: 'system',
      content: 'Welcome to Tino - AI-Powered Quantitative Trading CLI.\nDescribe a trading strategy to get started, or type "help" for commands.',
      timestamp: new Date(),
    },
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const [lastAction, setLastAction] = useState<AgentAction | null>(null);

  const handleSubmit = useCallback(
    async (input: string) => {
      // Handle special commands
      if (input === 'quit' || input === 'exit') {
        exit();
        return;
      }

      if (input === 'help') {
        setMessages((prev) => [
          ...prev,
          {
            role: 'system',
            content: [
              'Commands:',
              '  describe a strategy  - Generate a new trading strategy',
              '  modify/change/adjust - Refine the current strategy',
              '  explain/analyze      - Get analysis of current strategy',
              '  save                 - Save the current strategy to engine',
              '  list strategies      - Show all saved strategies',
              '  new                  - Start a new conversation',
              '  quit/exit            - Exit Tino',
            ].join('\n'),
            timestamp: new Date(),
          },
        ]);
        return;
      }

      if (input === 'new' || input === 'reset') {
        agent.resetConversation();
        setLastAction(null);
        setMessages((prev) => [
          ...prev,
          {
            role: 'system',
            content: 'Conversation reset. Describe a new strategy to get started.',
            timestamp: new Date(),
          },
        ]);
        return;
      }

      if (input === 'save') {
        if (!agent.currentState.currentCode) {
          setMessages((prev) => [
            ...prev,
            { role: 'system', content: 'No strategy to save.', timestamp: new Date() },
          ]);
          return;
        }
        try {
          setIsLoading(true);
          const result = await agent.saveCurrentStrategy();
          if (result) {
            setMessages((prev) => [
              ...prev,
              {
                role: 'system',
                content: `Strategy saved! Hash: ${result.versionHash}`,
                timestamp: new Date(),
              },
            ]);
          }
        } catch (error) {
          setMessages((prev) => [
            ...prev,
            {
              role: 'system',
              content: `Save failed: ${error instanceof Error ? error.message : String(error)}`,
              timestamp: new Date(),
            },
          ]);
        } finally {
          setIsLoading(false);
        }
        return;
      }

      // Process through agent
      setMessages((prev) => [
        ...prev,
        { role: 'user', content: input, timestamp: new Date() },
      ]);
      setIsLoading(true);

      try {
        const action = await agent.processInput(input);
        setLastAction(action);

        switch (action.type) {
          case 'generate':
            setMessages((prev) => [
              ...prev,
              {
                role: 'assistant',
                content: `Generated: **${action.result.strategy_name}**\n\n${action.result.description}`,
                timestamp: new Date(),
              },
            ]);
            break;
          case 'refine':
            setMessages((prev) => [
              ...prev,
              {
                role: 'assistant',
                content: `Strategy refined: ${action.result.changes_summary}`,
                timestamp: new Date(),
              },
            ]);
            break;
          case 'analyze':
            setMessages((prev) => [
              ...prev,
              {
                role: 'assistant',
                content: `${action.result.explanation}\n\nKey points:\n${action.result.key_points.map((p) => `• ${p}`).join('\n')}`,
                timestamp: new Date(),
              },
            ]);
            break;
          case 'list': {
            const list = action.strategies
              .map(
                (s) =>
                  `  ${s.name} (${s.version_hash.slice(0, 15)}...) - ${s.backtest_count} backtests`,
              )
              .join('\n');
            setMessages((prev) => [
              ...prev,
              {
                role: 'system',
                content: `Strategies:\n${list || '  No strategies found.'}`,
                timestamp: new Date(),
              },
            ]);
            break;
          }
          case 'error':
            setMessages((prev) => [
              ...prev,
              {
                role: 'system',
                content: `Error: ${action.message}`,
                timestamp: new Date(),
              },
            ]);
            break;
        }
      } catch (error) {
        setMessages((prev) => [
          ...prev,
          {
            role: 'system',
            content: `Error: ${error instanceof Error ? error.message : String(error)}`,
            timestamp: new Date(),
          },
        ]);
      } finally {
        setIsLoading(false);
      }
    },
    [agent, exit],
  );

  return (
    <Box flexDirection="column" height="100%">
      {/* Header */}
      <Box paddingX={1} marginBottom={1}>
        <Text color="green" bold>
          Tino
        </Text>
        <Text color="gray"> | </Text>
        <Text color={llm.status === 'connected' ? 'green' : llm.status === 'degraded' ? 'yellow' : 'red'}>
          AI: {llm.status}
        </Text>
        <Text color="gray"> | </Text>
        <Text color="gray">Engine: {engineUrl}</Text>
      </Box>

      {/* Main content area */}
      <Box flexDirection="row" flexGrow={1}>
        {/* Chat panel */}
        <Box flexDirection="column" flexGrow={1} flexBasis="60%">
          <Chat messages={messages} />
        </Box>

        {/* Strategy review panel */}
        <Box flexDirection="column" flexBasis="40%" borderStyle="single" borderColor="gray" paddingX={1}>
          <StrategyReview
            strategyName={agent.currentState.currentName}
            code={agent.currentState.currentCode}
            parameters={agent.currentState.parameters}
            isModified={agent.currentState.isModified}
            versionHash={agent.currentState.versionHash}
            changesSummary={
              lastAction?.type === 'refine'
                ? lastAction.result.changes_summary
                : undefined
            }
          />
        </Box>
      </Box>

      {/* Input */}
      <Box marginTop={1}>
        <Input onSubmit={handleSubmit} isLoading={isLoading} />
      </Box>
    </Box>
  );
}
