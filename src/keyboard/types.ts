export type KeyMode = 'normal' | 'popup' | 'permission' | 'search' | 'rewind' | 'input';

export interface KeyState {
  ctrl: boolean;
  meta: boolean;
  shift: boolean;
  escape: boolean;
  return: boolean;
  tab: boolean;
  backspace: boolean;
  delete: boolean;
  upArrow: boolean;
  downArrow: boolean;
  leftArrow: boolean;
  rightArrow: boolean;
}

export interface KeyEvent {
  input: string;
  key: KeyState;
}

export type KeyHandler = (event: KeyEvent) => boolean | void;

export interface KeyBinding {
  mode: KeyMode | 'global';
  key: string;
  handler: KeyHandler;
  description?: string;
}
