import type {
  HookEvent,
  HookDefinition,
  HookContext,
  HookResult,
} from '@/domain/index.js';
import { logger } from '@/utils/logger.js';

export class HookRunner {
  private hooks: HookDefinition[];

  constructor(hooks: HookDefinition[]) {
    this.hooks = hooks;
  }

  async run(event: HookEvent, ctx: HookContext): Promise<HookResult> {
    const matching = this.hooks.filter((h) => h.event === event);

    for (const hook of matching) {
      try {
        const result = await this.executeHook(hook, ctx);
        if (result.allow === false) {
          return result;
        }
      } catch (err) {
        logger.warn(
          `[HookRunner] Hook error (event=${event}, type=${hook.type}):`,
          err,
        );
      }
    }

    return { allow: true };
  }

  private async executeHook(
    hook: HookDefinition,
    ctx: HookContext,
  ): Promise<HookResult> {
    if (hook.type === 'command' && hook.command) {
      return this.runCommand(hook.command, ctx);
    }

    if (hook.type === 'function' && hook.fn) {
      return hook.fn(ctx);
    }

    return { allow: true };
  }

  private async runCommand(
    command: string,
    ctx: HookContext,
  ): Promise<HookResult> {
    const proc = Bun.spawn(['sh', '-c', command], {
      stdin: 'pipe',
      stdout: 'pipe',
      stderr: 'pipe',
    });

    proc.stdin.write(JSON.stringify(ctx));
    proc.stdin.end();

    const output = await new Response(proc.stdout).text();
    await proc.exited;

    if (!output.trim()) {
      return { allow: true };
    }

    return JSON.parse(output) as HookResult;
  }
}
