export interface Model {
  id: string;
  displayName: string;
}

interface Provider {
  displayName: string;
  providerId: string;
  models: Model[];
}

export const PROVIDERS: Provider[] = [
  { displayName: 'OpenAI', providerId: 'openai', models: [{ id: 'gpt-5.2', displayName: 'GPT 5.2' }, { id: 'gpt-4.1', displayName: 'GPT 4.1' }] },
  { displayName: 'Anthropic', providerId: 'anthropic', models: [{ id: 'claude-sonnet-4-5', displayName: 'Sonnet 4.5' }, { id: 'claude-opus-4-6', displayName: 'Opus 4.6' }] },
  { displayName: 'Google', providerId: 'google', models: [{ id: 'gemini-3-flash-preview', displayName: 'Gemini 3 Flash' }, { id: 'gemini-3-pro-preview', displayName: 'Gemini 3 Pro' }] },
  { displayName: 'xAI', providerId: 'xai', models: [{ id: 'grok-4-0709', displayName: 'Grok 4' }, { id: 'grok-4-1-fast-reasoning', displayName: 'Grok 4.1 Fast Reasoning' }] },
  { displayName: 'Moonshot', providerId: 'moonshot', models: [{ id: 'kimi-k2-5', displayName: 'Kimi K2.5' }] },
  { displayName: 'OpenRouter', providerId: 'openrouter', models: [] },
  { displayName: 'Ollama', providerId: 'ollama', models: [] },
];

export function getModelsForProvider(providerId: string): Model[] {
  const provider = PROVIDERS.find((entry) => entry.providerId === providerId);
  return provider?.models ?? [];
}

export function getModelIdsForProvider(providerId: string): string[] {
  return getModelsForProvider(providerId).map((model) => model.id);
}

export function getDefaultModelForProvider(providerId: string): string | undefined {
  const models = getModelsForProvider(providerId);
  return models[0]?.id;
}

export function getModelDisplayName(modelId: string): string {
  const normalizedId = modelId.replace(/^(ollama|openrouter):/, '');

  for (const provider of PROVIDERS) {
    const model = provider.models.find((entry) => entry.id === normalizedId || entry.id === modelId);
    if (model) {
      return model.displayName;
    }
  }

  return normalizedId;
}
