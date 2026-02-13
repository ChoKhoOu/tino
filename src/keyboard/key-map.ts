import type { KeyMode } from './types.js';

export type KeyActionName =
  | 'clear_screen'
  | 'exit'
  | 'cancel'
  | 'cancel_or_exit'
  | 'rewind';

export interface KeyActionBinding {
  mode: KeyMode | 'global';
  key: string;
  action: KeyActionName;
  description: string;
}

export const DEFAULT_KEY_MAP: KeyActionBinding[] = [
  { mode: 'global', key: 'ctrl+l', action: 'clear_screen', description: 'Clear screen and reset local UI history' },
  { mode: 'global', key: 'ctrl+d', action: 'exit', description: 'Exit the application immediately' },
  { mode: 'global', key: 'escape', action: 'cancel', description: 'Cancel active flow or active run' },
  { mode: 'global', key: 'ctrl+c', action: 'cancel_or_exit', description: 'Cancel active work or exit when idle' },
  { mode: 'global', key: 'escape+escape', action: 'rewind', description: 'Reserved double-escape rewind trigger' },
];
