import { useState, useCallback } from 'react';
import { checkApiKeyExistsForProvider, saveApiKeyForProvider, getProviderDisplayName } from '../utils/env.js';
import { getModelsForProvider } from '../components/ModelSelector.js';
import type { Model } from '../components/ModelSelector.js';
import { getOllamaModels } from '../utils/ollama.js';

const SELECTION_STATES = ['provider_select', 'model_select', 'model_input', 'api_key_confirm', 'api_key_input'] as const;
type SelectionState = (typeof SELECTION_STATES)[number];
type AppState = 'idle' | SelectionState;

export interface FlowState {
  appState: AppState;
  pendingProvider: string | null;
  pendingModels: Model[];
}

export interface UseModelSelectionFlowResult {
  flowState: FlowState;
  startFlow: () => void;
  cancelFlow: () => void;
  handleProviderSelect: (providerId: string | null) => Promise<void>;
  handleModelSelect: (modelId: string | null) => void;
  handleModelInputSubmit: (modelName: string | null) => void;
  handleApiKeyConfirm: (wantsToSet: boolean) => void;
  handleApiKeySubmit: (apiKey: string | null) => void;
  isInFlow: () => boolean;
}

function isSelectionState(state: AppState): state is SelectionState {
  return (SELECTION_STATES as readonly string[]).includes(state);
}

export function useModelSelectionFlow(
  onModelSelected: (modelId: string) => void,
): UseModelSelectionFlowResult {
  const [appState, setAppState] = useState<AppState>('idle');
  const [pendingProvider, setPendingProvider] = useState<string | null>(null);
  const [pendingModels, setPendingModels] = useState<Model[]>([]);
  const [pendingSelectedModelId, setPendingSelectedModelId] = useState<string | null>(null);

  const resetPendingState = useCallback(() => {
    setPendingProvider(null);
    setPendingModels([]);
    setPendingSelectedModelId(null);
    setAppState('idle');
  }, []);

  const completeSelection = useCallback(
    (modelId: string) => {
      onModelSelected(modelId);
      resetPendingState();
    },
    [onModelSelected, resetPendingState],
  );

  const startFlow = useCallback(() => setAppState('provider_select'), []);
  const cancelFlow = useCallback(() => resetPendingState(), [resetPendingState]);
  const isInFlow = useCallback(() => isSelectionState(appState), [appState]);

  const handleProviderSelect = useCallback(async (providerId: string | null) => {
    if (!providerId) { setAppState('idle'); return; }
    setPendingProvider(providerId);

    if (providerId === 'openrouter') {
      setPendingModels([]);
      setAppState('model_input');
    } else if (providerId === 'ollama') {
      const ollamaModelIds = await getOllamaModels();
      setPendingModels(ollamaModelIds.map((id) => ({ id, displayName: id })));
      setAppState('model_select');
    } else {
      setPendingModels(getModelsForProvider(providerId));
      setAppState('model_select');
    }
  }, []);

  const handleModelSelect = useCallback(
    (modelId: string | null) => {
      if (!modelId || !pendingProvider) {
        setPendingProvider(null);
        setPendingModels([]);
        setPendingSelectedModelId(null);
        setAppState('provider_select');
        return;
      }

      if (pendingProvider === 'ollama') {
        completeSelection(`ollama:${modelId}`);
        return;
      }

      if (checkApiKeyExistsForProvider(pendingProvider)) {
        completeSelection(modelId);
      } else {
        setPendingSelectedModelId(modelId);
        setAppState('api_key_confirm');
      }
    },
    [pendingProvider, completeSelection],
  );

  const handleModelInputSubmit = useCallback(
    (modelName: string | null) => {
      if (!modelName || !pendingProvider) {
        setPendingProvider(null);
        setPendingModels([]);
        setPendingSelectedModelId(null);
        setAppState('provider_select');
        return;
      }

      const fullModelId = `${pendingProvider}:${modelName}`;
      if (checkApiKeyExistsForProvider(pendingProvider)) {
        completeSelection(fullModelId);
      } else {
        setPendingSelectedModelId(fullModelId);
        setAppState('api_key_confirm');
      }
    },
    [pendingProvider, completeSelection],
  );

  const handleApiKeyConfirm = useCallback(
    (wantsToSet: boolean) => {
      if (wantsToSet) {
        setAppState('api_key_input');
      } else if (pendingProvider && pendingSelectedModelId && checkApiKeyExistsForProvider(pendingProvider)) {
        completeSelection(pendingSelectedModelId);
      } else {
        resetPendingState();
      }
    },
    [pendingProvider, pendingSelectedModelId, completeSelection, resetPendingState],
  );

  const handleApiKeySubmit = useCallback(
    (apiKey: string | null) => {
      if (!pendingSelectedModelId) { resetPendingState(); return; }

      if (apiKey && pendingProvider) {
        const saved = saveApiKeyForProvider(pendingProvider, apiKey);
        if (saved) {
          completeSelection(pendingSelectedModelId);
        } else {
          resetPendingState();
        }
      } else if (!apiKey && pendingProvider && checkApiKeyExistsForProvider(pendingProvider)) {
        completeSelection(pendingSelectedModelId);
      } else {
        resetPendingState();
      }
    },
    [pendingProvider, pendingSelectedModelId, completeSelection, resetPendingState],
  );

  return {
    flowState: { appState, pendingProvider, pendingModels },
    startFlow,
    cancelFlow,
    handleProviderSelect,
    handleModelSelect,
    handleModelInputSubmit,
    handleApiKeyConfirm,
    handleApiKeySubmit,
    isInFlow,
  };
}
