import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock LLM client interface
interface MockLLMClient {
  status: string;
  isAvailable: boolean;
  generateStrategy: ReturnType<typeof vi.fn>;
  refineStrategy: ReturnType<typeof vi.fn>;
  analyzeStrategy: ReturnType<typeof vi.fn>;
}

function createMockLLM(): MockLLMClient {
  return {
    status: 'connected',
    isAvailable: true,
    generateStrategy: vi.fn().mockResolvedValue({
      strategy_name: 'Test Strategy',
      strategy_code: 'class TestStrategy: pass',
      description: 'A test strategy',
      parameters: { period: 20 },
    }),
    refineStrategy: vi.fn().mockResolvedValue({
      strategy_code: 'class TestStrategy: refined = True',
      changes_summary: 'Added refined flag',
    }),
    analyzeStrategy: vi.fn().mockResolvedValue({
      explanation: 'This strategy does...',
      key_points: ['Point 1', 'Point 2'],
    }),
  };
}

// Test importing the actual module - will fail until it exists (TDD)
describe('StrategyAgent', () => {
  let mockLLM: MockLLMClient;

  beforeEach(() => {
    vi.restoreAllMocks();
    mockLLM = createMockLLM();
  });

  describe('processInput - generation', () => {
    it('should call generateStrategy for new conversation', async () => {
      const { StrategyAgent } = await import('../../src/agents/strategy-agent.js');
      const agent = new StrategyAgent(mockLLM as any);

      const result = await agent.processInput('build a mean reversion strategy');

      expect(result.type).toBe('generate');
      expect(mockLLM.generateStrategy).toHaveBeenCalledWith(
        'build a mean reversion strategy',
        expect.any(Array),
      );
    });

    it('should update state after generation', async () => {
      const { StrategyAgent } = await import('../../src/agents/strategy-agent.js');
      const agent = new StrategyAgent(mockLLM as any);

      await agent.processInput('build a strategy');

      expect(agent.currentState.currentCode).toBe('class TestStrategy: pass');
      expect(agent.currentState.currentName).toBe('Test Strategy');
      expect(agent.currentState.isModified).toBe(true);
    });
  });

  describe('processInput - refinement', () => {
    it('should call refineStrategy when strategy exists', async () => {
      const { StrategyAgent } = await import('../../src/agents/strategy-agent.js');
      const agent = new StrategyAgent(mockLLM as any);

      // First generate
      await agent.processInput('build a strategy');
      // Then refine
      const result = await agent.processInput('change the period to 50');

      expect(result.type).toBe('refine');
      expect(mockLLM.refineStrategy).toHaveBeenCalled();
    });

    it('should update code after refinement', async () => {
      const { StrategyAgent } = await import('../../src/agents/strategy-agent.js');
      const agent = new StrategyAgent(mockLLM as any);

      await agent.processInput('build a strategy');
      await agent.processInput('add a parameter');

      expect(agent.currentState.currentCode).toBe(
        'class TestStrategy: refined = True',
      );
    });
  });

  describe('processInput - analysis', () => {
    it('should call analyzeStrategy for explain requests', async () => {
      const { StrategyAgent } = await import('../../src/agents/strategy-agent.js');
      const agent = new StrategyAgent(mockLLM as any);

      await agent.processInput('build a strategy');
      const result = await agent.processInput('explain this strategy');

      expect(result.type).toBe('analyze');
      expect(mockLLM.analyzeStrategy).toHaveBeenCalled();
    });
  });

  describe('processInput - list', () => {
    it('should handle list strategies command', async () => {
      // Mock fetch for listing
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            items: [
              {
                version_hash: 'sha256:abc',
                name: 'Strategy 1',
                backtest_count: 2,
                created_at: '2026-01-01T00:00:00Z',
              },
            ],
            total: 1,
          }),
      });
      vi.stubGlobal('fetch', mockFetch);

      const { StrategyAgent } = await import('../../src/agents/strategy-agent.js');
      const agent = new StrategyAgent(mockLLM as any);

      const result = await agent.processInput('list strategies');
      expect(result.type).toBe('list');

      vi.unstubAllGlobals();
    });
  });

  describe('conversation history', () => {
    it('should maintain conversation history', async () => {
      const { StrategyAgent } = await import('../../src/agents/strategy-agent.js');
      const agent = new StrategyAgent(mockLLM as any);

      await agent.processInput('build a strategy');

      expect(agent.history.length).toBeGreaterThan(0);
      expect(agent.history[0]?.role).toBe('user');
    });

    it('should reset conversation', async () => {
      const { StrategyAgent } = await import('../../src/agents/strategy-agent.js');
      const agent = new StrategyAgent(mockLLM as any);

      await agent.processInput('build a strategy');
      agent.resetConversation();

      expect(agent.history.length).toBe(0);
      expect(agent.currentState.currentCode).toBeNull();
    });
  });

  describe('error handling', () => {
    it('should return error action on LLM failure', async () => {
      mockLLM.generateStrategy.mockRejectedValue(new Error('API Error'));

      const { StrategyAgent } = await import('../../src/agents/strategy-agent.js');
      const agent = new StrategyAgent(mockLLM as any);

      const result = await agent.processInput('build a strategy');
      expect(result.type).toBe('error');
    });
  });
});
