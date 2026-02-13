import { ESCAPE_DELAY_MS } from './constants.js';
import type { KeyEvent, KeyHandler, KeyMode } from './types.js';

type HandlerScope = KeyMode | 'global';

export class KeyboardDispatcher {
  private modeStack: KeyMode[] = ['normal'];
  private handlers = new Map<string, Set<KeyHandler>>();
  private defaultHandler: KeyHandler | null = null;
  private escTimer: ReturnType<typeof setTimeout> | null = null;

  get currentMode(): KeyMode {
    return this.modeStack[this.modeStack.length - 1] ?? 'normal';
  }

  pushMode(mode: KeyMode): void {
    this.modeStack.push(mode);
  }

  popMode(): KeyMode | undefined {
    if (this.modeStack.length <= 1) return this.currentMode;
    return this.modeStack.pop();
  }

  resetModes(): void {
    this.modeStack = ['normal'];
  }

  register(mode: HandlerScope, keyPattern: string, handler: KeyHandler): () => void {
    const bucket = this.getBucket(mode, keyPattern);
    bucket.add(handler);

    return () => {
      const current = this.handlers.get(this.bucketKey(mode, keyPattern));
      if (!current) return;
      current.delete(handler);
      if (current.size === 0) {
        this.handlers.delete(this.bucketKey(mode, keyPattern));
      }
    };
  }

  setDefaultHandler(handler: KeyHandler | null): () => void {
    this.defaultHandler = handler;
    return () => {
      if (this.defaultHandler === handler) {
        this.defaultHandler = null;
      }
    };
  }

  dispatch(event: KeyEvent): boolean {
    if (this.handleEscape(event)) {
      return true;
    }

    const patterns = this.toPatterns(event);
    if (this.fireHandlers(this.currentMode, patterns, event)) {
      return true;
    }

    if (this.fireHandlers('global', patterns, event)) {
      return true;
    }

    if (this.defaultHandler) {
      return this.defaultHandler(event) === true;
    }

    return false;
  }

  dispose(): void {
    if (this.escTimer) {
      clearTimeout(this.escTimer);
      this.escTimer = null;
    }
    this.handlers.clear();
    this.defaultHandler = null;
    this.resetModes();
  }

  private handleEscape(event: KeyEvent): boolean {
    if (!event.key.escape) return false;

    if (this.escTimer) {
      clearTimeout(this.escTimer);
      this.escTimer = null;
      this.fireHandlers('global', ['escape+escape'], event);
      return true;
    }

    this.escTimer = setTimeout(() => {
      this.escTimer = null;
      if (this.fireHandlers(this.currentMode, ['escape'], event)) return;
      this.fireHandlers('global', ['escape'], event);
    }, ESCAPE_DELAY_MS);

    return true;
  }

  private fireHandlers(mode: HandlerScope, patterns: string[], event: KeyEvent): boolean {
    for (const pattern of [...patterns, 'any']) {
      const bucket = this.handlers.get(this.bucketKey(mode, pattern));
      if (!bucket || bucket.size === 0) continue;

      for (const handler of bucket) {
        if (handler(event) === true) {
          return true;
        }
      }
    }

    return false;
  }

  private toPatterns(event: KeyEvent): string[] {
    const patterns: string[] = [];
    const push = (pattern: string): void => {
      if (pattern && !patterns.includes(pattern)) {
        patterns.push(pattern);
      }
    };

    if (event.key.return) push(this.withModifiers('return', event));
    if (event.key.tab) push(this.withModifiers('tab', event));
    if (event.key.backspace) push(this.withModifiers('backspace', event));
    if (event.key.delete) push(this.withModifiers('delete', event));
    if (event.key.upArrow) push(this.withModifiers('up', event));
    if (event.key.downArrow) push(this.withModifiers('down', event));
    if (event.key.leftArrow) push(this.withModifiers('left', event));
    if (event.key.rightArrow) push(this.withModifiers('right', event));

    if (event.input) {
      const input = event.input.toLowerCase();
      push(this.withModifiers(input, event));
      push(input);
      if (event.key.meta) {
        push(`alt+${input}`);
      }
    }

    return patterns;
  }

  private withModifiers(base: string, event: KeyEvent): string {
    const modifiers: string[] = [];
    if (event.key.ctrl) modifiers.push('ctrl');
    if (event.key.meta) modifiers.push('meta');
    if (event.key.shift) modifiers.push('shift');
    if (modifiers.length === 0) return base;
    return `${modifiers.join('+')}+${base}`;
  }

  private getBucket(mode: HandlerScope, pattern: string): Set<KeyHandler> {
    const key = this.bucketKey(mode, pattern);
    const existing = this.handlers.get(key);
    if (existing) return existing;
    const created = new Set<KeyHandler>();
    this.handlers.set(key, created);
    return created;
  }

  private bucketKey(mode: HandlerScope, pattern: string): string {
    return `${mode}:${pattern}`;
  }
}
