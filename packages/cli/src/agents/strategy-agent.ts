/**
 * Strategy agent: orchestrates LLM calls for strategy generation,
 * refinement, and explanation with conversation history management.
 */

import type {
  LLMClient,
  Message,
  StrategyGenerationResult,
  StrategyRefinementResult,
  AnalysisResult,
} from '../services/llm-client.js';

export interface StrategyState {
  currentCode: string | null;
  currentName: string | null;
  versionHash: string | null;
  parameters: Record<string, unknown>;
  isModified: boolean;
}

export type AgentAction =
  | { type: 'generate'; result: StrategyGenerationResult }
  | { type: 'refine'; result: StrategyRefinementResult }
  | { type: 'analyze'; result: AnalysisResult }
  | { type: 'error'; message: string }
  | { type: 'list'; strategies: StrategyListItem[] };

export interface StrategyListItem {
  version_hash: string;
  name: string;
  backtest_count: number;
  created_at: string;
}

export class StrategyAgent {
  private llm: LLMClient;
  private conversationHistory: Message[] = [];
  private state: StrategyState = {
    currentCode: null,
    currentName: null,
    versionHash: null,
    parameters: {},
    isModified: false,
  };
  private engineUrl: string;

  constructor(llm: LLMClient, engineUrl: string = 'http://localhost:8000') {
    this.llm = llm;
    this.engineUrl = engineUrl;
  }

  get currentState(): Readonly<StrategyState> {
    return this.state;
  }

  get history(): ReadonlyArray<Message> {
    return this.conversationHistory;
  }

  async processInput(input: string): Promise<AgentAction> {
    const trimmed = input.trim().toLowerCase();

    // Check for special commands
    if (trimmed === 'list strategies' || trimmed === 'ls') {
      return this._listStrategies();
    }

    // Determine intent: generate, refine, or analyze
    if (this.state.currentCode) {
      return this._handleWithExistingStrategy(input);
    }
    return this._generateNewStrategy(input);
  }

  async saveCurrentStrategy(sessionId?: string): Promise<{
    versionHash: string;
    name: string;
  } | null> {
    if (!this.state.currentCode || !this.state.currentName) {
      return null;
    }

    try {
      const response = await fetch(`${this.engineUrl}/api/strategies`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: this.state.currentName,
          source_code: this.state.currentCode,
          parameters: this.state.parameters,
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to save strategy: ${response.statusText}`);
      }

      const data = await response.json();
      this.state.versionHash = data.version_hash;
      this.state.isModified = false;

      return {
        versionHash: data.version_hash,
        name: data.name,
      };
    } catch (error) {
      throw new Error(
        `Failed to save strategy: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  resetConversation(): void {
    this.conversationHistory = [];
    this.state = {
      currentCode: null,
      currentName: null,
      versionHash: null,
      parameters: {},
      isModified: false,
    };
  }

  private async _generateNewStrategy(input: string): Promise<AgentAction> {
    try {
      this._addToHistory('user', input);
      const result = await this.llm.generateStrategy(
        input,
        this.conversationHistory.slice(0, -1), // exclude current message
      );
      this.state.currentCode = result.strategy_code;
      this.state.currentName = result.strategy_name;
      this.state.parameters = result.parameters;
      this.state.isModified = true;
      this._addToHistory(
        'assistant',
        `Generated strategy: ${result.strategy_name}\n${result.description}`,
      );
      return { type: 'generate', result };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unknown error';
      return { type: 'error', message };
    }
  }

  private async _handleWithExistingStrategy(
    input: string,
  ): Promise<AgentAction> {
    const lower = input.toLowerCase();

    // Check if user wants analysis/explanation
    const analysisKeywords = [
      'explain',
      'analyze',
      'what does',
      'how does',
      'why',
      'describe',
      'tell me about',
    ];
    const isAnalysis = analysisKeywords.some((kw) => lower.includes(kw));

    if (isAnalysis) {
      return this._analyzeStrategy(input);
    }

    // Default to refinement
    return this._refineStrategy(input);
  }

  private async _refineStrategy(input: string): Promise<AgentAction> {
    try {
      this._addToHistory('user', input);
      const result = await this.llm.refineStrategy(
        input,
        this.state.currentCode!,
        this.conversationHistory.slice(0, -1),
      );
      this.state.currentCode = result.strategy_code;
      this.state.isModified = true;
      this._addToHistory('assistant', result.changes_summary);
      return { type: 'refine', result };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unknown error';
      return { type: 'error', message };
    }
  }

  private async _analyzeStrategy(input: string): Promise<AgentAction> {
    try {
      this._addToHistory('user', input);
      const result = await this.llm.analyzeStrategy(
        input,
        { code: this.state.currentCode ?? undefined },
        this.conversationHistory.slice(0, -1),
      );
      this._addToHistory('assistant', result.explanation);
      return { type: 'analyze', result };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unknown error';
      return { type: 'error', message };
    }
  }

  private async _listStrategies(): Promise<AgentAction> {
    try {
      const response = await fetch(`${this.engineUrl}/api/strategies`);
      if (!response.ok) {
        throw new Error(`Failed to list strategies: ${response.statusText}`);
      }
      const data = await response.json();
      return { type: 'list', strategies: data.items };
    } catch (error) {
      return {
        type: 'error',
        message: `Failed to list strategies: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  private _addToHistory(role: 'user' | 'assistant', content: string): void {
    this.conversationHistory.push({ role, content });
    // Keep history manageable (last 20 messages)
    if (this.conversationHistory.length > 20) {
      this.conversationHistory = this.conversationHistory.slice(-20);
    }
  }
}
