import { useState, useCallback } from 'react';
import { ModelBroker, DEFAULT_MODEL, DEFAULT_PROVIDER } from '@/runtime/model-broker.js';
import { getSetting, setSetting } from '@/utils/config.js';

// ============================================================================
// Types
// ============================================================================

export interface ModelSelectorState {
  currentModel: string;
  currentProvider: string;
  isSelecting: boolean;
}

export interface UseModelSelectorResult {
  state: ModelSelectorState;
  selectModel: (name: string) => void;
  startSelection: () => void;
  cancelSelection: () => void;
}

// ============================================================================
// Hook
// ============================================================================

export function useModelSelector(broker: ModelBroker): UseModelSelectorResult {
  const [currentModel, setCurrentModel] = useState<string>(
    () => (getSetting('modelId', null) as string | null) ?? DEFAULT_MODEL,
  );
  const [currentProvider, setCurrentProvider] = useState<string>(
    () => getSetting('provider', DEFAULT_PROVIDER) as string,
  );
  const [isSelecting, setIsSelecting] = useState(false);

  const selectModel = useCallback(
    (name: string) => {
      broker.setModel(name);
      setCurrentModel(name);
      const provider = detectProviderFromName(name);
      setCurrentProvider(provider);
      setSetting('modelId', name);
      setSetting('provider', provider);
      setIsSelecting(false);
    },
    [broker],
  );

  const startSelection = useCallback(() => setIsSelecting(true), []);
  const cancelSelection = useCallback(() => setIsSelecting(false), []);

  return {
    state: { currentModel, currentProvider, isSelecting },
    selectModel,
    startSelection,
    cancelSelection,
  };
}

// ============================================================================
// Helpers
// ============================================================================

const PREFIX_MAP: [string, string][] = [
  ['openrouter:', 'openrouter'],
  ['custom:', 'custom'],
  ['ollama:', 'ollama'],
  ['claude-', 'anthropic'],
  ['gemini-', 'google'],
  ['grok-', 'xai'],
  ['kimi-', 'moonshot'],
];

function detectProviderFromName(model: string): string {
  for (const [prefix, provider] of PREFIX_MAP) {
    if (model.startsWith(prefix)) return provider;
  }
  return 'openai';
}
