import { useCallback, useEffect, useState } from 'react';
import { useKeyboardDispatcher } from '../keyboard/use-keyboard.js';
import type { HistoryItem } from '../components/HistoryItemView.js';

const SUB_MENU_COUNT = 5;

export type RewindAction =
  | 'restore_all'
  | 'restore_conversation'
  | 'restore_code'
  | 'summarize'
  | 'cancel';

export interface UseRewindMenuResult {
  isOpen: boolean;
  selectedIndex: number;
  turns: HistoryItem[];
  subMenuOpen: boolean;
  subMenuIndex: number;
  close: () => void;
}

const ACTIONS: RewindAction[] = [
  'restore_all',
  'restore_conversation',
  'restore_code',
  'summarize',
  'cancel',
];

export function useRewindMenu(
  history: HistoryItem[],
  onAction: (turn: HistoryItem, action: RewindAction) => void,
): UseRewindMenuResult {
  const dispatcher = useKeyboardDispatcher();
  const [turns, setTurns] = useState(history);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [subMenuOpen, setSubMenuOpen] = useState(false);
  const [subMenuIndex, setSubMenuIndex] = useState(0);

  const close = useCallback(() => {
    setSubMenuOpen(false);
    setSubMenuIndex(0);
    setIsOpen(false);
  }, []);

  useEffect(() => {
    setTurns(history);
    setSelectedIndex((prev) => Math.max(0, Math.min(prev, Math.max(0, history.length - 1))));
  }, [history]);

  useEffect(() => {
    return dispatcher.register('global', 'escape+escape', () => {
      if (history.length === 0) return false;
      setSelectedIndex((prev) => Math.max(0, Math.min(prev, history.length - 1)));
      setSubMenuOpen(false);
      setSubMenuIndex(0);
      setIsOpen(true);
      return true;
    });
  }, [dispatcher, history]);

  useEffect(() => {
    if (!isOpen) return;

    dispatcher.pushMode('rewind');

    const cleanupUp = dispatcher.register('rewind', 'up', () => {
      if (subMenuOpen) {
        setSubMenuIndex((prev) => (prev > 0 ? prev - 1 : SUB_MENU_COUNT - 1));
        return true;
      }
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : turns.length - 1));
      return true;
    });

    const cleanupDown = dispatcher.register('rewind', 'down', () => {
      if (subMenuOpen) {
        setSubMenuIndex((prev) => (prev < SUB_MENU_COUNT - 1 ? prev + 1 : 0));
        return true;
      }
      setSelectedIndex((prev) => (prev < turns.length - 1 ? prev + 1 : 0));
      return true;
    });

    const cleanupEnter = dispatcher.register('rewind', 'return', () => {
      if (!subMenuOpen) {
        setSubMenuOpen(true);
        setSubMenuIndex(0);
        return true;
      }

      const turn = turns[selectedIndex];
      if (!turn) {
        close();
        return true;
      }

      const action = ACTIONS[subMenuIndex] ?? 'cancel';
      if (action === 'cancel') {
        close();
        return true;
      }

      onAction(turn, action);
      close();
      return true;
    });

    const cleanupEsc = dispatcher.register('rewind', 'escape', () => {
      if (subMenuOpen) {
        setSubMenuOpen(false);
        setSubMenuIndex(0);
        return true;
      }
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
  }, [close, dispatcher, isOpen, onAction, selectedIndex, subMenuIndex, subMenuOpen, turns]);

  return { isOpen, selectedIndex, turns, subMenuOpen, subMenuIndex, close };
}
