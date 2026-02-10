/**
 * Reusable meta-tool factory.
 * Extracts the common LLM-as-router pattern used by financial_search, financial_research, etc.
 */
import { DynamicStructuredTool, StructuredToolInterface } from '@langchain/core/tools';
import type { RunnableConfig } from '@langchain/core/runnables';
import { AIMessage, ToolCall } from '@langchain/core/messages';
import { z } from 'zod';
import { callLlm } from '../model/llm.js';
import { formatToolResult } from './types.js';

/** Format snake_case tool name to Title Case for progress messages */
function formatSubToolName(name: string): string {
  return name.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

export interface MetaToolOptions {
  /** Tool name (e.g. 'financial_research') */
  name: string;
  /** Short description for LLM tool binding */
  description: string;
  /** Zod schema for the tool input */
  schema: z.ZodObject<{ query: z.ZodString }>;
  /** System prompt for the LLM router */
  systemPrompt: string;
  /** Sub-tools to route to */
  subTools: StructuredToolInterface[];
  /** LLM model name for routing */
  model: string;
}

/**
 * Create a meta-tool that uses LLM-as-router to dispatch queries to sub-tools.
 * Follows the same pattern as financial_search.ts.
 */
export function createMetaTool(options: MetaToolOptions): DynamicStructuredTool {
  const { name, description, schema, systemPrompt, subTools, model } = options;

  // Build a map for quick tool lookup
  const toolMap = new Map(subTools.map(t => [t.name, t]));

  return new DynamicStructuredTool({
    name,
    description,
    schema,
    func: async (input, _runManager, config?: RunnableConfig) => {
      const onProgress = config?.metadata?.onProgress as ((msg: string) => void) | undefined;

      // 1. Call LLM with sub-tools bound (native tool calling)
      onProgress?.('Searching...');
      const { response } = await callLlm(input.query, {
        model,
        systemPrompt,
        tools: subTools,
      });
      const aiMessage = response as AIMessage;

      // 2. Check for tool calls
      const toolCalls = aiMessage.tool_calls as ToolCall[];
      if (!toolCalls || toolCalls.length === 0) {
        return formatToolResult({ error: 'No tools selected for query' }, []);
      }

      // 3. Execute tool calls in parallel
      const toolNames = toolCalls.map(tc => formatSubToolName(tc.name));
      onProgress?.(`Fetching from ${toolNames.join(', ')}...`);
      const results = await Promise.all(
        toolCalls.map(async (tc) => {
          try {
            const tool = toolMap.get(tc.name);
            if (!tool) {
              throw new Error(`Tool '${tc.name}' not found`);
            }
            const rawResult = await tool.invoke(tc.args);
            const result = typeof rawResult === 'string' ? rawResult : JSON.stringify(rawResult);
            const parsed = JSON.parse(result);
            return {
              tool: tc.name,
              args: tc.args,
              data: parsed.data ?? parsed,
              sourceUrls: parsed.sourceUrls || [],
              error: null,
            };
          } catch (error) {
            return {
              tool: tc.name,
              args: tc.args,
              data: null,
              sourceUrls: [],
              error: error instanceof Error ? error.message : String(error),
            };
          }
        })
      );

      // 4. Combine results
      const successfulResults = results.filter((r) => r.error === null);
      const failedResults = results.filter((r) => r.error !== null);
      const allUrls = results.flatMap((r) => r.sourceUrls);

      const combinedData: Record<string, unknown> = {};
      for (const result of successfulResults) {
        const ticker = (result.args as Record<string, unknown>).ticker as string | undefined;
        const key = ticker ? `${result.tool}_${ticker}` : result.tool;
        combinedData[key] = result.data;
      }

      if (failedResults.length > 0) {
        combinedData._errors = failedResults.map((r) => ({
          tool: r.tool,
          args: r.args,
          error: r.error,
        }));
      }

      return formatToolResult(combinedData, allUrls);
    },
  });
}
