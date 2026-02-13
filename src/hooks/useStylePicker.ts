import { useState, useEffect, useCallback } from 'react';
import { useKeyboardDispatcher } from '../keyboard/use-keyboard.js';
import { getAllStyles, getActiveStyle, setActiveStyle } from '../styles/registry.js';

export interface StyleOption {
  name: string;
  description: string;
  isCurrent: boolean;
}

export interface UseStylePickerResult {
  isOpen: boolean;
  selectedIndex: number;
  styles: StyleOption[];
  open: () => void;
  close: () => void;
  select: () => void;
}

export function useStylePicker(): UseStylePickerResult {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const dispatcher = useKeyboardDispatcher();

  const buildStyles = (): StyleOption[] => {
    const all = getAllStyles();
    const active = getActiveStyle();
    return all.map((s) => ({
      name: s.name,
      description: s.description,
      isCurrent: s.name === active.name,
    }));
  };

  const styles = buildStyles();

  const open = useCallback(() => {
    const currentIdx = styles.findIndex((s) => s.isCurrent);
    setSelectedIndex(currentIdx >= 0 ? currentIdx : 0);
    setIsOpen(true);
  }, [styles]);

  const close = useCallback(() => {
    setIsOpen(false);
  }, []);

  const select = useCallback(() => {
    const style = styles[selectedIndex];
    if (style) {
      setActiveStyle(style.name);
    }
    setIsOpen(false);
  }, [styles, selectedIndex]);

  useEffect(() => {
    if (!isOpen) return;

    dispatcher.pushMode('popup');

    const cleanupUp = dispatcher.register('popup', 'up', () => {
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : styles.length - 1));
      return true;
    });

    const cleanupDown = dispatcher.register('popup', 'down', () => {
      setSelectedIndex((prev) => (prev < styles.length - 1 ? prev + 1 : 0));
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
  }, [isOpen, styles, dispatcher, select, close]);

  return { isOpen, selectedIndex, styles, open, close, select };
}
