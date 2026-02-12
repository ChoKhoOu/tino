import React from 'react';
import { Box } from 'ink';
import { ProviderSelector, ModelSelector, ModelInputField } from '@/components/ModelSelector.js';
import { ApiKeyConfirm, ApiKeyInput } from '@/components/ApiKeyPrompt.js';
import { getApiKeyNameForProvider, getProviderDisplayName } from '@/utils/env.js';
import type { FlowState } from '@/hooks/useModelSelectionFlow.js';
import type { ModelSelectorState } from '@/hooks/useModelSelector.js';

interface ModelSelectionFlowProps {
  flowState: FlowState;
  modelState: ModelSelectorState;
  onProviderSelect: (providerId: string | null) => Promise<void>;
  onModelSelect: (modelId: string | null) => void;
  onModelInputSubmit: (modelName: string | null) => void;
  onApiKeyConfirm: (wantsToSet: boolean) => void;
  onApiKeySubmit: (apiKey: string | null) => void;
}

export function ModelSelectionFlow({
  flowState,
  modelState,
  onProviderSelect,
  onModelSelect,
  onModelInputSubmit,
  onApiKeyConfirm,
  onApiKeySubmit,
}: ModelSelectionFlowProps) {
  const { appState, pendingProvider, pendingModels } = flowState;

  if (appState === 'provider_select') {
    return (
      <Box flexDirection="column">
        <ProviderSelector provider={modelState.currentProvider} onSelect={onProviderSelect} />
      </Box>
    );
  }

  if (appState === 'model_select' && pendingProvider) {
    return (
      <Box flexDirection="column">
        <ModelSelector
          providerId={pendingProvider}
          models={pendingModels}
          currentModel={modelState.currentProvider === pendingProvider ? modelState.currentModel : undefined}
          onSelect={onModelSelect}
        />
      </Box>
    );
  }

  if (appState === 'model_input' && pendingProvider) {
    return (
      <Box flexDirection="column">
        <ModelInputField
          providerId={pendingProvider}
          currentModel={modelState.currentProvider === pendingProvider ? modelState.currentModel : undefined}
          onSubmit={onModelInputSubmit}
        />
      </Box>
    );
  }

  if (appState === 'api_key_confirm' && pendingProvider) {
    return (
      <Box flexDirection="column">
        <ApiKeyConfirm
          providerName={getProviderDisplayName(pendingProvider)}
          onConfirm={onApiKeyConfirm}
        />
      </Box>
    );
  }

  if (appState === 'api_key_input' && pendingProvider) {
    const apiKeyName = getApiKeyNameForProvider(pendingProvider) || '';
    return (
      <Box flexDirection="column">
        <ApiKeyInput
          providerName={getProviderDisplayName(pendingProvider)}
          apiKeyName={apiKeyName}
          onSubmit={onApiKeySubmit}
        />
      </Box>
    );
  }

  return null;
}
