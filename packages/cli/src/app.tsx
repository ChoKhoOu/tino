import React, { useState, useCallback, useEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import { Box, Static, useInput, useApp } from 'ink';
import { EngineClient, EngineWsClient } from '@tino/shared';
import type {
  LiveTradeExecutedEvent,
  LiveRiskAlertEvent,
  LiveRiskCircuitBreakerEvent,
  LivePositionUpdateEvent,
  LiveStateChangeEvent,
  BacktestProgressEvent,
  BacktestCompletedEvent,
  BacktestFailedEvent,
  Position,
} from '@tino/shared';
import { createMessageStore } from './core/message-store.js';
import { CommandRegistry } from './core/command-registry.js';
import { registerAllCommands } from './commands/index.js';
import { useStreamingLLM } from './hooks/useStreamingLLM.js';
import { useCommandHistory } from './hooks/useCommandHistory.js';
import { useWebSocket } from './hooks/useWebSocket.js';
import { LLMClient } from './services/llm-client.js';
import { StrategyAgent } from './agents/strategy-agent.js';
import { startEngineWatchdog } from './daemon/engine-watchdog.js';
import { ModeBanner } from './components/ModeBanner.js';
import { Message } from './components/Message.js';
import { StreamingMessage } from './components/StreamingMessage.js';
import { StatusBar, type EngineStatus, type AppState } from './components/StatusBar.js';
import { InputArea } from './components/InputArea.js';
import { ProgressBar } from './components/ProgressBar.js';
import { BacktestResult } from './components/BacktestResult.js';
import { EquityCurve } from './components/EquityCurve.js';
import { TradeNotification } from './components/TradeNotification.js';
import { RiskAlert } from './components/RiskAlert.js';
import { ConfirmDialog } from './components/ConfirmDialog.js';
import { PositionDisplay } from './components/PositionDisplay.js';
import { StateChangeNotification } from './components/StateChangeNotification.js';

interface AppProps {
  engineUrl?: string;
  apiKey?: string;
  pythonPath?: string;
  engineDir?: string;
  dashboardDist?: string;
}

const DEFAULT_SYSTEM_PROMPT =
  'You are Tino, an AI-powered quantitative trading assistant. ' +
  'Help users design, backtest, and deploy trading strategies. ' +
  'Be concise and precise. Use markdown formatting for code and tables.';

export function App({
  engineUrl = 'http://localhost:8000',
  apiKey = '',
  pythonPath,
  engineDir,
  dashboardDist,
}: AppProps) {
  const { exit } = useApp();

  // --- Core services (stable across renders) ---
  const messageStore = useMemo(() => createMessageStore(), []);
  const commandRegistry = useMemo(() => {
    const registry = new CommandRegistry();
    registerAllCommands(registry);
    return registry;
  }, []);
  const llm = useMemo(() => new LLMClient({ apiKey }), [apiKey]);
  const agent = useMemo(() => new StrategyAgent(llm, engineUrl), [llm, engineUrl]);
  const engineClient = useMemo(() => new EngineClient(engineUrl), [engineUrl]);

  // --- Hooks ---
  const { isStreaming, sendMessage, cancel, tokenUsage } = useStreamingLLM({
    apiKey,
    messageStore,
  });
  const { navigateUp, navigateDown, resetNavigation, addEntry } = useCommandHistory();

  // --- WebSocket for live trading ---
  const wsUrl = useMemo(() => engineUrl.replace(/^http/, 'ws') + '/ws', [engineUrl]);
  const { client: wsClient } = useWebSocket({ url: wsUrl, autoConnect: true });

  // --- Local state ---
  const [engineStatus, setEngineStatus] = useState<EngineStatus>('healthy');
  const [appState, setAppState] = useState<AppState>('idle');
  const [tradingMode, setTradingMode] = useState<'paper' | 'live'>('paper');
  const [inputClearTrigger, setInputClearTrigger] = useState(0);

  // --- Live trading state ---
  const [notifications, setNotifications] = useState<Array<{ id: string; type: string; data: any }>>([]);
  const [positions, setPositions] = useState<Position[]>([]);
  const [liveSessionId, setLiveSessionId] = useState<string | null>(null);

  // --- Backtest state ---
  const [backtestState, setBacktestState] = useState<{
    active: boolean;
    id: string | null;
    wsUrl: string | null;
    progress: { progress_pct: number; trades_so_far: number; current_pnl: string; current_date: string } | null;
    result: any | null;
    equityCurve: any[] | null;
  } | null>(null);
  const backtestWsRef = useRef<EngineWsClient | null>(null);

  // --- ConfirmDialog state ---
  const [confirmDialog, setConfirmDialog] = useState<{
    title: string;
    details: string[];
    confirmText: string;
    onConfirm: () => Promise<void>;
    onCancel: () => void;
  } | null>(null);

  // --- Subscribe to message store via useSyncExternalStore ---
  const completedMessages = useSyncExternalStore(
    messageStore.subscribe,
    () => messageStore.getCompleted(),
  );
  const streamingMessage = useSyncExternalStore(
    messageStore.subscribe,
    () => messageStore.getStreamingMessage(),
  );

  // --- Sync appState with streaming ---
  useEffect(() => {
    setAppState(isStreaming ? 'streaming' : 'idle');
  }, [isStreaming]);

  // --- Engine watchdog ---
  useEffect(() => {
    if (!pythonPath || !engineDir) return;

    const stopWatchdog = startEngineWatchdog(
      { pythonPath, engineDir, dashboardDist },
      () => {
        setEngineStatus('offline');
      },
      () => {
        setEngineStatus('healthy');
      },
      10000,
      () => {
        setEngineStatus('reconnecting');
      },
    );

    return stopWatchdog;
  }, [pythonPath, engineDir, dashboardDist]);

  // --- Welcome message ---
  useEffect(() => {
    messageStore.addMessage(
      'system',
      'Welcome to Tino - AI-Powered Quantitative Trading CLI.\nType a message to chat, or use /help for commands.',
    );
  }, [messageStore]);

  // --- Helpers ---
  const addSystemMessage = useCallback(
    (content: string) => {
      messageStore.addMessage('system', content);
    },
    [messageStore],
  );

  // --- Live trading WebSocket event handlers ---
  useEffect(() => {
    if (!liveSessionId || !wsClient) return;

    const unsubs = [
      wsClient.on('live.trade_executed', (event) => {
        const e = event as LiveTradeExecutedEvent;
        const { trade } = e.payload;
        setNotifications(prev => [...prev, { id: crypto.randomUUID(), type: 'trade', data: { ...trade, timestamp: e.timestamp } }].slice(-100));
      }),
      wsClient.on('live.risk_alert', (event) => {
        const e = event as LiveRiskAlertEvent;
        setNotifications(prev => [...prev, { id: crypto.randomUUID(), type: 'risk', data: e.payload }].slice(-100));
      }),
      wsClient.on('live.risk_circuit_breaker', (event) => {
        const e = event as LiveRiskCircuitBreakerEvent;
        setNotifications(prev => [...prev, { id: crypto.randomUUID(), type: 'circuit_breaker', data: e.payload }].slice(-100));
      }),
      wsClient.on('live.position_update', (event) => {
        const e = event as LivePositionUpdateEvent;
        setPositions(e.payload.positions);
      }),
      wsClient.on('live.state_change', (event) => {
        const e = event as LiveStateChangeEvent;
        const { session_id, previous_state, current_state } = e.payload;
        setNotifications(prev => [...prev, {
          id: crypto.randomUUID(),
          type: 'state_change',
          data: { sessionId: session_id, previousState: previous_state, currentState: current_state, timestamp: e.timestamp }
        }].slice(-100));
      }),
    ];

    return () => unsubs.forEach(unsub => unsub());
  }, [liveSessionId, wsClient]);

  // --- Backtest WebSocket ---
  useEffect(() => {
    if (!backtestState?.active || !backtestState.wsUrl) return;

    const btWsClient = new EngineWsClient({ url: backtestState.wsUrl });

    btWsClient.on('backtest.progress', (event) => {
      const e = event as BacktestProgressEvent;
      setBacktestState(prev => prev ? { ...prev, progress: e.payload } : prev);
      setAppState('backtest_running');
    });

    btWsClient.on('backtest.completed', (event) => {
      const e = event as BacktestCompletedEvent;
      const metrics = e.payload.metrics as BacktestCompletedEvent['payload']['metrics'] & { equity_curve?: any[] };
      setBacktestState(prev => prev ? { ...prev, active: false, result: metrics, equityCurve: metrics.equity_curve ?? null } : prev);
      setAppState('idle');
      addSystemMessage('Backtest completed!');
    });

    btWsClient.on('backtest.failed', (event) => {
      const e = event as BacktestFailedEvent;
      setBacktestState(prev => prev ? { ...prev, active: false } : prev);
      setAppState('idle');
      addSystemMessage(`Backtest failed: ${e.payload.message}`);
    });

    btWsClient.connect();
    backtestWsRef.current = btWsClient;

    return () => btWsClient.disconnect();
  }, [backtestState?.active, backtestState?.wsUrl, addSystemMessage]);

  // --- Submit handler ---
  const handleSubmit = useCallback(
    async (input: string) => {
      addEntry(input);

      if (input.startsWith('/')) {
        const context = {
          engineUrl,
          engineClient,
          messageStore,
          addSystemMessage,
          strategyAgent: agent,
          commandRegistry,
          onStartBacktest: (id: string, btWsUrl: string) => {
            setBacktestState({ active: true, id, wsUrl: btWsUrl, progress: null, result: null, equityCurve: null });
            setAppState('backtest_running');
          },
          onRequestConfirm: (opts: {
            title: string;
            details: string[];
            confirmText: string;
            onConfirm: () => Promise<void>;
            onCancel: () => void;
          }) => setConfirmDialog(opts),
        };
        await commandRegistry.dispatch(input, context);
        return;
      }

      if (input === 'quit' || input === 'exit') {
        exit();
        return;
      }

      // Send through streaming LLM
      const systemPrompt = agent.currentState.currentCode
        ? `${DEFAULT_SYSTEM_PROMPT}\n\nCurrent strategy code:\n\`\`\`python\n${agent.currentState.currentCode}\n\`\`\``
        : DEFAULT_SYSTEM_PROMPT;

      await sendMessage(input, systemPrompt);
    },
    [addEntry, engineUrl, engineClient, messageStore, addSystemMessage, commandRegistry, exit, agent, sendMessage],
  );

  // --- Ctrl+C / Ctrl+K handlers ---
  useInput((input, key) => {
    if (key.ctrl && input === 'c') {
      if (isStreaming) {
        cancel();
      } else if (backtestState?.active) {
        backtestWsRef.current?.send({ type: 'backtest.cancel', payload: { backtest_id: backtestState.id! } } as any);
        setBacktestState(prev => prev ? { ...prev, active: false } : prev);
        setAppState('idle');
        addSystemMessage('Backtest cancelled.');
      } else {
        setInputClearTrigger(prev => prev + 1);
      }
      return;
    }

    if (key.ctrl && input === 'k') {
      engineClient
        .killSwitch()
        .then((result) => {
          if (result.killed_sessions === 0 && result.cancelled_orders === 0 && result.flattened_positions === 0) {
            addSystemMessage('No active live sessions.');
          } else {
            addSystemMessage(
              `Kill switch activated:\n` +
              `  Cancelled orders:    ${result.cancelled_orders}\n` +
              `  Flattened positions: ${result.flattened_positions}\n` +
              `  Sessions killed:     ${result.killed_sessions}`,
            );
          }
        })
        .catch((err: unknown) => {
          addSystemMessage(`Kill switch failed: ${err instanceof Error ? err.message : String(err)}`);
        });
      return;
    }
  });

  // --- Render ---
  return (
    <Box flexDirection="column">
      <ModeBanner mode={tradingMode} />

      <Static items={completedMessages}>
        {(msg) => (
          <Message
            key={msg.id}
            role={msg.role}
            content={msg.content}
            timestamp={msg.timestamp}
          />
        )}
      </Static>

      {streamingMessage && (
        <StreamingMessage
          content={streamingMessage.content}
          isStreaming={streamingMessage.isStreaming === true}
        />
      )}

      {backtestState?.active && backtestState.progress && (
        <ProgressBar
          progress={backtestState.progress.progress_pct}
          tradeCount={backtestState.progress.trades_so_far}
          currentPnl={backtestState.progress.current_pnl}
          currentDate={backtestState.progress.current_date}
        />
      )}
      {backtestState?.result && (
        <>
          <BacktestResult metrics={backtestState.result} />
          {backtestState.equityCurve && backtestState.equityCurve.length >= 2 && (
            <EquityCurve data={backtestState.equityCurve} />
          )}
        </>
      )}

      {notifications.map(n => {
        if (n.type === 'trade') return <TradeNotification key={n.id} timestamp={n.data.timestamp} side={n.data.side} quantity={n.data.quantity} price={n.data.price} pnl={n.data.pnl} />;
        if (n.type === 'risk') return <RiskAlert key={n.id} level={n.data.alert_level} rule={n.data.rule} message={n.data.message} actionTaken={n.data.action_taken} />;
        if (n.type === 'circuit_breaker') return <RiskAlert key={n.id} level="CIRCUIT_BREAKER" rule={n.data.rule} message={`Threshold: ${n.data.threshold}, Actual: ${n.data.actual}`} cancelledOrders={n.data.cancelled_orders} flattenedPositions={n.data.flattened_positions} />;
        if (n.type === 'state_change') return (
          <StateChangeNotification
            key={n.id}
            sessionId={n.data.sessionId}
            previousState={n.data.previousState}
            currentState={n.data.currentState}
            timestamp={n.data.timestamp}
          />
        );
        return null;
      })}

      {positions.length > 0 && (
        <PositionDisplay positions={positions} />
      )}

      {confirmDialog && (
        <ConfirmDialog
          title={confirmDialog.title}
          details={confirmDialog.details}
          confirmText={confirmDialog.confirmText}
          onConfirm={async () => {
            await confirmDialog.onConfirm();
            setConfirmDialog(null);
          }}
          onCancel={() => {
            confirmDialog.onCancel();
            setConfirmDialog(null);
          }}
        />
      )}

      <StatusBar
        modelName={llm.modelName}
        tokenUsage={tokenUsage}
        engineStatus={engineStatus}
        aiStatus={llm.status}
        appState={appState}
        liveSessionInfo={liveSessionId ? { state: 'RUNNING' } : undefined}
      />

      <InputArea
        onSubmit={handleSubmit}
        disabled={isStreaming}
        historyUp={navigateUp}
        historyDown={navigateDown}
        resetHistory={resetNavigation}
        clearTrigger={inputClearTrigger}
      />
    </Box>
  );
}
