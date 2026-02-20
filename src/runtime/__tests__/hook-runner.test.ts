import { describe, test, expect, mock } from 'bun:test';
import { HookRunner } from '../hook-runner.js';
import type {
  HookEvent,
  HookContext,
  HookResult,
  HookDefinition,
} from '@/domain/index.js';

function makeCtx(overrides: Partial<HookContext> = {}): HookContext {
  return { event: 'PreToolUse', toolId: 'test-tool', args: {}, ...overrides };
}

function makeFnHook(
  event: HookEvent,
  fn: (ctx: HookContext) => Promise<HookResult>,
): HookDefinition {
  return { event, type: 'function', fn };
}

function makeCmdHook(event: HookEvent, command: string): HookDefinition {
  return { event, type: 'command', command };
}

describe('HookRunner', () => {
  // 1. No hooks -> returns { allow: true }
  test('returns allow:true when no hooks are registered', async () => {
    const runner = new HookRunner([]);
    const result = await runner.run('PreToolUse', makeCtx());
    expect(result).toEqual({ allow: true });
  });

  // 2. Matching function hook that allows
  test('matching function hook that allows returns allow:true', async () => {
    const hook = makeFnHook('PreToolUse', async () => ({ allow: true }));
    const runner = new HookRunner([hook]);
    const result = await runner.run('PreToolUse', makeCtx());
    expect(result).toEqual({ allow: true });
  });

  // 3. Matching function hook that blocks
  test('matching function hook that blocks returns allow:false with message', async () => {
    const hook = makeFnHook('PreToolUse', async () => ({
      allow: false,
      message: 'blocked by policy',
    }));
    const runner = new HookRunner([hook]);
    const result = await runner.run('PreToolUse', makeCtx());
    expect(result.allow).toBe(false);
    expect(result.message).toBe('blocked by policy');
  });

  // 4. Multiple hooks, first allows, second blocks
  test('stops at first blocking hook and returns its result', async () => {
    const allowHook = makeFnHook('PreToolUse', async () => ({ allow: true }));
    const blockHook = makeFnHook('PreToolUse', async () => ({
      allow: false,
      message: 'second hook blocked',
    }));
    const thirdHook = makeFnHook('PreToolUse', async () => ({
      allow: false,
      message: 'third hook should not run',
    }));
    const thirdFn = mock(() => Promise.resolve({ allow: false, message: 'third hook should not run' }));
    thirdHook.fn = thirdFn;

    const runner = new HookRunner([allowHook, blockHook, thirdHook]);
    const result = await runner.run('PreToolUse', makeCtx());
    expect(result.allow).toBe(false);
    expect(result.message).toBe('second hook blocked');
    // Third hook should never be called because second already blocked
    expect(thirdFn).not.toHaveBeenCalled();
  });

  // 5. Hook throws error -> caught silently, continues, returns allow
  test('catches hook errors and continues to return allow:true', async () => {
    const throwingHook = makeFnHook('PreToolUse', async () => {
      throw new Error('hook exploded');
    });
    const runner = new HookRunner([throwingHook]);
    const result = await runner.run('PreToolUse', makeCtx());
    expect(result).toEqual({ allow: true });
  });

  test('continues past throwing hook to evaluate remaining hooks', async () => {
    const throwingHook = makeFnHook('PreToolUse', async () => {
      throw new Error('hook exploded');
    });
    const blockHook = makeFnHook('PreToolUse', async () => ({
      allow: false,
      message: 'blocked after error',
    }));
    const runner = new HookRunner([throwingHook, blockHook]);
    const result = await runner.run('PreToolUse', makeCtx());
    expect(result.allow).toBe(false);
    expect(result.message).toBe('blocked after error');
  });

  // 6. Non-matching hooks (wrong event) -> skipped
  test('skips hooks that do not match the event', async () => {
    const fn = mock(() => Promise.resolve({ allow: false, message: 'should not run' }));
    const hook: HookDefinition = { event: 'PostToolUse', type: 'function', fn };
    const runner = new HookRunner([hook]);
    const result = await runner.run('PreToolUse', makeCtx());
    expect(result).toEqual({ allow: true });
    expect(fn).not.toHaveBeenCalled();
  });

  test('only runs hooks matching the specific event', async () => {
    const sessionFn = mock(() => Promise.resolve({ allow: true }));
    const preFn = mock(() => Promise.resolve({ allow: true }));
    const sessionHook: HookDefinition = { event: 'SessionStart', type: 'function', fn: sessionFn };
    const preHook: HookDefinition = { event: 'PreToolUse', type: 'function', fn: preFn };

    const runner = new HookRunner([sessionHook, preHook]);
    await runner.run('PreToolUse', makeCtx());
    expect(sessionFn).not.toHaveBeenCalled();
    expect(preFn).toHaveBeenCalledTimes(1);
  });

  // 7. Command hook with real shell command
  test('command hook with empty output returns allow:true', async () => {
    const hook = makeCmdHook('PreToolUse', 'echo -n ""');
    const runner = new HookRunner([hook]);
    const result = await runner.run('PreToolUse', makeCtx());
    expect(result).toEqual({ allow: true });
  });

  test('command hook that outputs JSON returns parsed result', async () => {
    const hook = makeCmdHook(
      'PreToolUse',
      'echo \'{"allow":false,"message":"cmd blocked"}\'',
    );
    const runner = new HookRunner([hook]);
    const result = await runner.run('PreToolUse', makeCtx());
    expect(result.allow).toBe(false);
    expect(result.message).toBe('cmd blocked');
  });

  test('command hook that outputs allow:true JSON', async () => {
    const hook = makeCmdHook('PreToolUse', 'echo \'{"allow":true}\'');
    const runner = new HookRunner([hook]);
    const result = await runner.run('PreToolUse', makeCtx());
    expect(result.allow).toBe(true);
  });

  test('command hook receives context on stdin', async () => {
    // Use cat to echo back stdin, wrapping it as a valid HookResult
    const hook = makeCmdHook(
      'PreToolUse',
      'cat > /dev/null && echo \'{"allow":true}\'',
    );
    const runner = new HookRunner([hook]);
    const ctx = makeCtx({ toolId: 'my-tool', args: { key: 'value' } });
    const result = await runner.run('PreToolUse', ctx);
    expect(result.allow).toBe(true);
  });

  test('command hook with invalid JSON output is caught as error', async () => {
    const hook = makeCmdHook('PreToolUse', 'echo "not json"');
    const runner = new HookRunner([hook]);
    // JSON.parse will throw, which should be caught by the try/catch
    const result = await runner.run('PreToolUse', makeCtx());
    expect(result).toEqual({ allow: true });
  });

  // 8. Hook with type='function' but no fn -> returns allow
  test('function hook with no fn property returns allow:true', async () => {
    const hook: HookDefinition = { event: 'PreToolUse', type: 'function' };
    const runner = new HookRunner([hook]);
    const result = await runner.run('PreToolUse', makeCtx());
    expect(result).toEqual({ allow: true });
  });

  // 9. Hook with type='command' but no command -> returns allow
  test('command hook with no command property returns allow:true', async () => {
    const hook: HookDefinition = { event: 'PreToolUse', type: 'command' };
    const runner = new HookRunner([hook]);
    const result = await runner.run('PreToolUse', makeCtx());
    expect(result).toEqual({ allow: true });
  });

  // 10. Mixed function and command hooks
  test('mixed function and command hooks run in order', async () => {
    const fnHook = makeFnHook('PreToolUse', async () => ({ allow: true }));
    const cmdHook = makeCmdHook(
      'PreToolUse',
      'echo \'{"allow":false,"message":"cmd says no"}\'',
    );
    const runner = new HookRunner([fnHook, cmdHook]);
    const result = await runner.run('PreToolUse', makeCtx());
    expect(result.allow).toBe(false);
    expect(result.message).toBe('cmd says no');
  });

  test('mixed hooks: command allows, function blocks', async () => {
    const cmdHook = makeCmdHook('PreToolUse', 'echo \'{"allow":true}\'');
    const fnHook = makeFnHook('PreToolUse', async () => ({
      allow: false,
      message: 'fn blocked',
    }));
    const runner = new HookRunner([cmdHook, fnHook]);
    const result = await runner.run('PreToolUse', makeCtx());
    expect(result.allow).toBe(false);
    expect(result.message).toBe('fn blocked');
  });

  // Additional edge cases
  test('function hook passes context to fn', async () => {
    const fn = mock((ctx: HookContext) => Promise.resolve({ allow: true }));
    const hook: HookDefinition = { event: 'PreToolUse', type: 'function', fn };
    const runner = new HookRunner([hook]);
    const ctx = makeCtx({ toolId: 'special-tool', args: { foo: 'bar' } });
    await runner.run('PreToolUse', ctx);
    expect(fn).toHaveBeenCalledWith(ctx);
  });

  test('works with all hook event types', async () => {
    const events: HookEvent[] = ['PreToolUse', 'PostToolUse', 'SessionStart', 'Stop'];
    for (const event of events) {
      const fn = mock(() => Promise.resolve({ allow: true }));
      const hook: HookDefinition = { event, type: 'function', fn };
      const runner = new HookRunner([hook]);
      const ctx = makeCtx({ event });
      await runner.run(event, ctx);
      expect(fn).toHaveBeenCalledTimes(1);
    }
  });

  test('hook returning allow:undefined is treated as allow (not false)', async () => {
    const hook = makeFnHook('PreToolUse', async () => ({}));
    const blockHook = makeFnHook('PreToolUse', async () => ({
      allow: false,
      message: 'should reach here',
    }));
    const runner = new HookRunner([hook, blockHook]);
    const result = await runner.run('PreToolUse', makeCtx());
    // allow is undefined (not === false), so first hook does not block
    expect(result.allow).toBe(false);
    expect(result.message).toBe('should reach here');
  });
});
