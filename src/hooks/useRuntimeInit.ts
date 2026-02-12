import { useEffect, useMemo, useRef, useState } from 'react';
import { join } from 'path';
import { resolveSrcDir } from '@/utils/resolve-app-dir.js';
import { ModelBroker } from '@/runtime/model-broker.js';
import { ToolRegistry } from '@/runtime/tool-registry.js';
import { PermissionEngine } from '@/runtime/permission-engine.js';
import { HookRunner } from '@/runtime/hook-runner.js';
import { SessionRuntime } from '@/runtime/session-runtime.js';
import { buildSystemPrompt } from '@/runtime/prompt-builder.js';
import { loadPermissions } from '@/config/permissions.js';
import { loadHooks } from '@/config/hooks.js';
import { discoverPlugins } from '@/plugins/discover.js';

export interface UseRuntimeInitResult {
  runtime: SessionRuntime;
  runtimeReady: boolean;
  broker: ModelBroker;
}

export function useRuntimeInit(): UseRuntimeInitResult {
  const broker = useMemo(() => new ModelBroker(), []);
  const registry = useMemo(() => new ToolRegistry(), []);
  const permissions = useMemo(() => new PermissionEngine(loadPermissions()), []);
  const hooks = useMemo(() => new HookRunner(loadHooks()), []);

  const [runtimeReady, setRuntimeReady] = useState(false);
  const systemPromptRef = useRef('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const builtins = await registry.discoverTools(join(resolveSrcDir(), 'tools', 'consolidated'));
      registry.registerAll(builtins);

      const plugins = await discoverPlugins();
      registry.registerAll(plugins);

      registry.validate();

      const toolDescriptions = registry
        .getAll()
        .map((t) => `### ${t.id}\n\n${t.description}`)
        .join('\n\n');
      systemPromptRef.current = buildSystemPrompt(toolDescriptions);

      if (!cancelled) setRuntimeReady(true);
    })();
    return () => { cancelled = true; };
  }, [registry]);

  const runtime = useMemo(() => {
    if (!runtimeReady) return null;
    return new SessionRuntime({
      broker,
      registry,
      permissions,
      hooks,
      systemPrompt: systemPromptRef.current,
    });
  }, [runtimeReady, broker, registry, permissions, hooks]);

  const stubRuntime = useMemo(
    () =>
      new SessionRuntime({
        broker,
        registry,
        permissions,
        hooks,
        systemPrompt: '',
      }),
    [broker, registry, permissions, hooks],
  );

  return {
    runtime: runtime ?? stubRuntime,
    runtimeReady,
    broker,
  };
}
