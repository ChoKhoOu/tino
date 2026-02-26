import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CommandRegistry } from '../core/command-registry.js';
import { createMessageStore } from '../core/message-store.js';
import { registerAllCommands } from '../commands/index.js';

/**
 * Mock EngineClient that matches the real class's public API.
 * Each method is a vi.fn() so we can control return values and assert calls.
 */
function createMockEngineClient() {
  return {
    health: vi.fn().mockResolvedValue({
      status: 'ok',
      engine_version: '0.1.0',
      nautilus_version: '0.1.0',
      active_live_sessions: 0,
      running_backtests: 1,
    }),
    killSwitch: vi.fn().mockResolvedValue({
      killed_sessions: 2,
      cancelled_orders: 5,
      flattened_positions: 3,
      executed_at: '2025-01-01T00:00:00Z',
    }),
    createStrategy: vi.fn(),
    listStrategies: vi.fn(),
    getStrategy: vi.fn(),
    submitBacktest: vi.fn(),
    getBacktest: vi.fn(),
    deployLive: vi.fn(),
    pauseLive: vi.fn(),
    resumeLive: vi.fn(),
    stopLive: vi.fn(),
    getLiveSession: vi.fn(),
    getRiskProfile: vi.fn(),
    updateRiskProfile: vi.fn(),
    getDataCacheStatus: vi.fn(),
  } as any;
}

describe('Command Flow Integration', () => {
  let registry: CommandRegistry;
  let messageStore: ReturnType<typeof createMessageStore>;
  let engineClient: ReturnType<typeof createMockEngineClient>;
  let addSystemMessage: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    registry = new CommandRegistry();
    messageStore = createMessageStore();
    engineClient = createMockEngineClient();
    addSystemMessage = vi.fn((content: string) => {
      messageStore.addMessage('system', content);
    });
    registerAllCommands(registry);
  });

  const createContext = () => ({
    engineUrl: 'http://localhost:8000',
    engineClient,
    messageStore,
    addSystemMessage,
    strategyAgent: { resetConversation: vi.fn(), currentState: { currentCode: null, currentName: null, versionHash: null, parameters: {}, isModified: false }, saveCurrentStrategy: vi.fn() } as any,
    commandRegistry: registry,
    onStartBacktest: vi.fn(),
    onRequestConfirm: vi.fn(),
  });

  it('should dispatch /help and add help message', async () => {
    const ctx = createContext();
    const handled = await registry.dispatch('/help', ctx);
    expect(handled).toBe(true);
    expect(addSystemMessage).toHaveBeenCalled();
    const msg = addSystemMessage.mock.calls[0][0];
    expect(msg).toContain('/help');
    expect(msg).toContain('/save');
    expect(msg).toContain('/kill');
  });

  it('should dispatch /status and call engine health API', async () => {
    const ctx = createContext();
    const handled = await registry.dispatch('/status', ctx);
    expect(handled).toBe(true);
    expect(engineClient.health).toHaveBeenCalled();
    expect(addSystemMessage).toHaveBeenCalled();
    const msg = addSystemMessage.mock.calls[0][0];
    expect(msg).toContain('Engine');
    expect(msg).toContain('0.1.0');
  });

  it('should dispatch /kill and call killSwitch API', async () => {
    const ctx = createContext();
    await registry.dispatch('/kill', ctx);
    expect(engineClient.killSwitch).toHaveBeenCalled();
    // First message: "Triggering kill switch..."
    // Second message: formatted results
    expect(addSystemMessage).toHaveBeenCalledTimes(2);
    const resultMsg = addSystemMessage.mock.calls[1][0];
    expect(resultMsg).toContain('5'); // cancelled_orders
    expect(resultMsg).toContain('3'); // flattened_positions
  });

  it('should dispatch /new and reset message store', async () => {
    const ctx = createContext();
    messageStore.addMessage('user', 'some old message');
    expect(messageStore.messages.length).toBe(1);
    await registry.dispatch('/new', ctx);
    // /new calls messageStore.reset() then addSystemMessage
    // reset() clears messages, then addSystemMessage adds one back
    expect(addSystemMessage).toHaveBeenCalled();
    const msg = addSystemMessage.mock.calls[0][0];
    expect(msg).toContain('reset');
  });

  it('should not dispatch non-slash input', async () => {
    const ctx = createContext();
    const handled = await registry.dispatch('hello world', ctx);
    expect(handled).toBe(false);
    expect(addSystemMessage).not.toHaveBeenCalled();
  });

  it('should handle unknown slash commands with suggestions', async () => {
    const ctx = createContext();
    const handled = await registry.dispatch('/halp', ctx);
    expect(handled).toBe(true);
    expect(addSystemMessage).toHaveBeenCalled();
    const msg = addSystemMessage.mock.calls[0][0];
    expect(msg).toContain('halp'); // mentions the unknown command
  });

  it('should handle /status API failure gracefully', async () => {
    engineClient.health.mockRejectedValue(new Error('Connection refused'));
    const ctx = createContext();
    await registry.dispatch('/status', ctx);
    expect(addSystemMessage).toHaveBeenCalled();
    const msg = addSystemMessage.mock.calls[0][0];
    expect(msg).toContain('Failed');
    expect(msg).toContain('Connection refused');
  });

  it('should handle /kill API failure gracefully', async () => {
    engineClient.killSwitch.mockRejectedValue(new Error('Engine offline'));
    const ctx = createContext();
    await registry.dispatch('/kill', ctx);
    // First call: "Triggering kill switch..."
    // Second call: error message "Kill switch failed: ..."
    const lastMsg = addSystemMessage.mock.calls[addSystemMessage.mock.calls.length - 1][0];
    expect(lastMsg).toContain('failed');
    expect(lastMsg).toContain('Engine offline');
  });
});
