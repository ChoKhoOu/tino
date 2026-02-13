import { useState, useMemo, useEffect, useCallback } from 'react';
import { useKeyboardDispatcher } from '../keyboard/use-keyboard.js';

export interface ModelOption {
  name: string;
  provider: string;
  isCurrent: boolean;
}

export interface UseModelSwitchPopupResult {
  isOpen: boolean;
  selectedIndex: number;
  models: ModelOption[];
  open: () => void;
  close: () => void;
  select: () => void;
}

const CURATED_MODELS: { name: string; provider: string }[] = [
  { name: 'gpt-5.2', provider: 'openai' },
  { name: 'gpt-4.1', provider: 'openai' },
  { name: 'gpt-4o', provider: 'openai' },
  { name: 'gpt-4o-mini', provider: 'openai' },
  { name: 'o3', provider: 'openai' },
  { name: 'o4-mini', provider: 'openai' },
  { name: 'claude-sonnet-4-5', provider: 'anthropic' },
  { name: 'claude-opus-4', provider: 'anthropic' },
  { name: 'claude-haiku-4-5', provider: 'anthropic' },
  { name: 'gemini-2.5-pro', provider: 'google' },
  { name: 'gemini-2.5-flash', provider: 'google' },
  { name: 'grok-3', provider: 'xai' },
];

export function useModelSwitchPopup(
  currentModel: string,
  onSelectModel: (name: string) => void,
): UseModelSwitchPopupResult {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const dispatcher = useKeyboardDispatcher();

  const models = useMemo<ModelOption[]>(() => {
    return CURATED_MODELS.map((m) => ({
      ...m,
      isCurrent: m.name === currentModel,
    }));
  }, [currentModel]);

  const open = useCallback(() => {
    const currentIdx = models.findIndex((m) => m.isCurrent);
    setSelectedIndex(currentIdx >= 0 ? currentIdx : 0);
    setIsOpen(true);
  }, [models]);

  const close = useCallback(() => {
    setIsOpen(false);
  }, []);

  const select = useCallback(() => {
    const model = models[selectedIndex];
    if (model) {
      onSelectModel(model.name);
    }
    setIsOpen(false);
  }, [models, selectedIndex, onSelectModel]);

  useEffect(() => {
    return dispatcher.register('normal', 'alt+p', () => {
      open();
      return true;
    });
  }, [dispatcher, open]);

  useEffect(() => {
    if (!isOpen) return;

    dispatcher.pushMode('popup');

    const cleanupUp = dispatcher.register('popup', 'up', () => {
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : models.length - 1));
      return true;
    });

    const cleanupDown = dispatcher.register('popup', 'down', () => {
      setSelectedIndex((prev) => (prev < models.length - 1 ? prev + 1 : 0));
      return true;
    });

    const cleanupEnter = dispatcher.register('popup', 'return', () => {
      select();
      return true;
    });

    const cleanupEsc = dispatcher.register('popup', 'escape', () => {
      close();
      return true;
    });

    return () => {
      cleanupUp();
      cleanupDown();
      cleanupEnter();
      cleanupEsc();
      dispatcher.popMode();
    };
  }, [isOpen, models, dispatcher, select, close]);

  return { isOpen, selectedIndex, models, open, close, select };
}
