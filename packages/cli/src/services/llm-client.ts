/**
 * LLM client service using Anthropic API with structured output.
 * Uses Function Calling / Tools for structured output — no regex parsing.
 */

declare const process: { env: Record<string, string | undefined> };

import {
  STRATEGY_GENERATION_SYSTEM_PROMPT,
  STRATEGY_GENERATION_TOOL_SCHEMA,
} from '../prompts/strategy-generation.js';
import {
  STRATEGY_REFINEMENT_SYSTEM_PROMPT,
  STRATEGY_REFINEMENT_TOOL_SCHEMA,
} from '../prompts/strategy-refinement.js';
import {
  ANALYSIS_SYSTEM_PROMPT,
  ANALYSIS_TOOL_SCHEMA,
} from '../prompts/analysis.js';
import { streamCompletion } from '../core/streaming-client.js';

export interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export interface StrategyGenerationResult {
  strategy_name: string;
  strategy_code: string;
  description: string;
  parameters: Record<string, unknown>;
  indicators_used?: string[];
  risk_notes?: string;
}

export interface StrategyRefinementResult {
  strategy_code: string;
  changes_summary: string;
  parameters_changed?: Record<string, unknown>;
  backtest_impact?: string;
}

export interface AnalysisResult {
  explanation: string;
  key_points: string[];
  suggestions?: string[];
}

export type LLMStatus = 'connected' | 'degraded' | 'offline';

export class LLMClient {
  private apiKey: string;
  private model: string;
  private baseUrl: string;
  private _status: LLMStatus = 'offline';

  constructor(options?: {
    apiKey?: string;
    model?: string;
    baseUrl?: string;
  }) {
    this.apiKey = options?.apiKey || process.env.ANTHROPIC_API_KEY || '';
    this.model = options?.model || 'claude-sonnet-4-20250514';
    this.baseUrl = options?.baseUrl || 'https://api.anthropic.com';

    if (this.apiKey) {
      this._status = 'connected';
    }
  }

  get status(): LLMStatus {
    return this._status;
  }

  get isAvailable(): boolean {
    return this._status === 'connected';
  }

  get modelName(): string {
    return this.model;
  }

  async checkHealth(): Promise<void> {
    if (!this.apiKey) {
      this._status = 'offline';
      return;
    }
    try {
      const resp = await fetch(`${this.baseUrl}/v1/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: this.model,
          max_tokens: 1,
          messages: [{ role: 'user', content: 'ping' }],
        }),
      });
      this._status = resp.ok || resp.status === 400 ? 'connected' : 'degraded';
    } catch {
      this._status = 'offline';
    }
  }

  async generateStrategy(
    userMessage: string,
    conversationHistory: Message[] = [],
  ): Promise<StrategyGenerationResult> {
    return this._callWithTool<StrategyGenerationResult>(
      STRATEGY_GENERATION_SYSTEM_PROMPT,
      STRATEGY_GENERATION_TOOL_SCHEMA,
      userMessage,
      conversationHistory,
    );
  }

  async refineStrategy(
    userMessage: string,
    currentCode: string,
    conversationHistory: Message[] = [],
  ): Promise<StrategyRefinementResult> {
    const contextMessage = `Current strategy code:\n\`\`\`python\n${currentCode}\n\`\`\`\n\nUser request: ${userMessage}`;
    return this._callWithTool<StrategyRefinementResult>(
      STRATEGY_REFINEMENT_SYSTEM_PROMPT,
      STRATEGY_REFINEMENT_TOOL_SCHEMA,
      contextMessage,
      conversationHistory,
    );
  }

  async analyzeStrategy(
    userMessage: string,
    context?: { code?: string; metrics?: Record<string, unknown> },
    conversationHistory: Message[] = [],
  ): Promise<AnalysisResult> {
    let fullMessage = userMessage;
    if (context?.code) {
      fullMessage += `\n\nStrategy code:\n\`\`\`python\n${context.code}\n\`\`\``;
    }
    if (context?.metrics) {
      fullMessage += `\n\nBacktest metrics:\n${JSON.stringify(context.metrics, null, 2)}`;
    }
    return this._callWithTool<AnalysisResult>(
      ANALYSIS_SYSTEM_PROMPT,
      ANALYSIS_TOOL_SCHEMA,
      fullMessage,
      conversationHistory,
    );
  }

  async *streamChat(
    userMessage: string,
    systemPrompt: string,
    conversationHistory: Message[] = [],
    options?: { signal?: AbortSignal },
  ): AsyncGenerator<{ type: 'text' | 'usage'; text?: string; inputTokens?: number; outputTokens?: number }> {
    if (!this.isAvailable) {
      this._status = 'offline';
      throw new Error('LLM service is unavailable. AI features are disabled.');
    }

    const messages = [
      ...conversationHistory.map((m) => ({
        role: m.role,
        content: m.content,
      })),
      { role: 'user' as const, content: userMessage },
    ];

    try {
      for await (const chunk of streamCompletion({
        apiKey: this.apiKey,
        model: this.model,
        baseUrl: this.baseUrl,
        systemPrompt,
        messages,
        maxTokens: 8192,
        signal: options?.signal,
      })) {
        if (chunk.type === 'text_delta' && chunk.text) {
          yield { type: 'text', text: chunk.text };
        } else if (chunk.type === 'usage') {
          yield { type: 'usage', inputTokens: chunk.inputTokens, outputTokens: chunk.outputTokens };
        }
      }
      this._status = 'connected';
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('401') || error.message.includes('403')) {
          this._status = 'offline';
        } else if (error.message.includes('429') || error.message.includes('500')) {
          this._status = 'degraded';
        }
      }
      throw error;
    }
  }

  private async _callWithTool<T>(
    systemPrompt: string,
    toolSchema: { name: string; description: string; input_schema: object },
    userMessage: string,
    history: Message[],
  ): Promise<T> {
    if (!this.isAvailable) {
      this._status = 'offline';
      throw new Error('LLM service is unavailable. AI features are disabled.');
    }

    const messages = [
      ...history.map((m) => ({
        role: m.role,
        content: m.content,
      })),
      { role: 'user' as const, content: userMessage },
    ];

    try {
      const response = await fetch(`${this.baseUrl}/v1/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: this.model,
          max_tokens: 8192,
          system: systemPrompt,
          messages,
          tools: [
            {
              name: toolSchema.name,
              description: toolSchema.description,
              input_schema: toolSchema.input_schema,
            },
          ],
          tool_choice: { type: 'tool', name: toolSchema.name },
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        if (response.status === 401 || response.status === 403) {
          this._status = 'offline';
        } else if (response.status === 429 || response.status >= 500) {
          this._status = 'degraded';
        }
        throw new Error(`LLM API error (${response.status}): ${errorText}`);
      }

      this._status = 'connected';
      const data = await response.json();

      // Extract tool use result from response
      const toolUse = data.content?.find(
        (block: { type: string }) => block.type === 'tool_use',
      );

      if (!toolUse) {
        throw new Error('LLM did not return structured output via tool use');
      }

      return toolUse.input as T;
    } catch (error) {
      if (error instanceof TypeError && error.message.includes('fetch')) {
        this._status = 'offline';
        throw new Error('Cannot connect to LLM service. AI features disabled.');
      }
      throw error;
    }
  }
}
