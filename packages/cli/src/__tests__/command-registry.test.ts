import { describe, it, expect, vi } from 'vitest';
import { CommandRegistry } from '../core/command-registry.js';
import type { CommandContext } from '../core/command-registry.js';

function createMockContext(): CommandContext {
  return {
    engineUrl: 'http://localhost:8000',
    engineClient: {} as any,
    messageStore: { addMessage: vi.fn() } as any,
    addSystemMessage: vi.fn(),
    strategyAgent: {} as any,
    commandRegistry: new CommandRegistry(),
    onStartBacktest: vi.fn(),
    onRequestConfirm: vi.fn(),
  };
}

describe('CommandRegistry', () => {
  it('should register and dispatch commands', async () => {
    const registry = new CommandRegistry();
    const executeFn = vi.fn();
    registry.register({
      name: 'test',
      description: 'Test command',
      execute: executeFn,
    });

    const ctx = createMockContext();
    const handled = await registry.dispatch('/test some args', ctx);
    expect(handled).toBe(true);
    expect(executeFn).toHaveBeenCalledWith('some args', ctx);
  });

  it('should dispatch commands case-insensitively', async () => {
    const registry = new CommandRegistry();
    const executeFn = vi.fn();
    registry.register({
      name: 'Hello',
      description: 'Hello command',
      execute: executeFn,
    });

    const ctx = createMockContext();
    const handled = await registry.dispatch('/HELLO world', ctx);
    expect(handled).toBe(true);
    expect(executeFn).toHaveBeenCalledWith('world', ctx);
  });

  it('should dispatch commands with no args', async () => {
    const registry = new CommandRegistry();
    const executeFn = vi.fn();
    registry.register({
      name: 'help',
      description: 'Help command',
      execute: executeFn,
    });

    const ctx = createMockContext();
    const handled = await registry.dispatch('/help', ctx);
    expect(handled).toBe(true);
    expect(executeFn).toHaveBeenCalledWith('', ctx);
  });

  it('should not dispatch non-slash input', async () => {
    const registry = new CommandRegistry();
    const ctx = createMockContext();
    const handled = await registry.dispatch('hello world', ctx);
    expect(handled).toBe(false);
  });

  it('should handle unknown commands with error message', async () => {
    const registry = new CommandRegistry();
    registry.register({
      name: 'help',
      description: 'Help',
      execute: vi.fn(),
    });

    const ctx = createMockContext();
    const handled = await registry.dispatch('/halp', ctx);
    expect(handled).toBe(true);
    expect(ctx.addSystemMessage).toHaveBeenCalled();
    const msg = (ctx.addSystemMessage as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(msg).toContain('halp');
  });

  it('should suggest similar commands for typos', async () => {
    const registry = new CommandRegistry();
    registry.register({ name: 'help', description: 'Help', execute: vi.fn() });
    registry.register({ name: 'history', description: 'History', execute: vi.fn() });

    const ctx = createMockContext();
    await registry.dispatch('/halp', ctx);
    const msg = (ctx.addSystemMessage as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    // "halp" is distance 1 from "help", so should suggest it
    expect(msg).toContain('/help');
  });

  it('should list registered commands', () => {
    const registry = new CommandRegistry();
    registry.register({ name: 'a', description: 'A cmd', execute: vi.fn() });
    registry.register({ name: 'b', description: 'B cmd', execute: vi.fn() });
    expect(registry.listCommands()).toHaveLength(2);
  });

  it('should get command by name', () => {
    const registry = new CommandRegistry();
    registry.register({ name: 'foo', description: 'Foo', execute: vi.fn() });
    expect(registry.getCommand('foo')).toBeDefined();
    expect(registry.getCommand('bar')).toBeUndefined();
  });

  it('should get command by name case-insensitively', () => {
    const registry = new CommandRegistry();
    registry.register({ name: 'Foo', description: 'Foo', execute: vi.fn() });
    expect(registry.getCommand('foo')).toBeDefined();
    expect(registry.getCommand('FOO')).toBeDefined();
  });
});
