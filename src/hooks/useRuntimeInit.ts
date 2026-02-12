import { useEffect, useMemo, useRef, useState } from 'react';
import { homedir } from 'os';
import { join } from 'path';
import { ModelBroker } from '@/runtime/model-broker.js';
import { ToolRegistry } from '@/runtime/tool-registry.js';
import { PermissionEngine } from '@/runtime/permission-engine.js';
import { HookRunner } from '@/runtime/hook-runner.js';
import { SessionRuntime } from '@/runtime/session-runtime.js';
import { buildSystemPrompt } from '@/runtime/prompt-builder.js';
import { configureTaskTool } from '@/tools/agent/task.tool.js';
import { configureLspTool } from '@/tools/coding/lsp.tool.js';
import { configureLspDiagnostics } from '@/tools/coding/lsp-diagnostics-helper.js';
import { AgentRegistry, registerBuiltinAgents } from '@/agent/index.js';
import { LspManager } from '@/lsp/lsp-manager.js';
import { loadMcpConfig, McpClient } from '@/mcp/index.js';
import { registerMcpTools } from '@/mcp/mcp-tool-adapter.js';
import { loadPermissions } from '@/config/permissions.js';
import { loadHooks } from '@/config/hooks.js';
import { discoverPlugins } from '@/plugins/discover.js';
import { SessionStore } from '@/session/index.js';
import { SnapshotManager } from '@/snapshot/index.js';
import { buildToolDescriptions } from './runtime-tool-descriptions.js';

export interface UseRuntimeInitResult {
  runtime: SessionRuntime;
  runtimeReady: boolean;
  broker: ModelBroker;
  sessionStore: SessionStore;
  agentRegistry: AgentRegistry;
  connectedMcpServers: string[];
}

export function useRuntimeInit(): UseRuntimeInitResult {
  const broker = useMemo(() => new ModelBroker(), []);
  const registry = useMemo(() => new ToolRegistry(), []);
  const permissions = useMemo(() => new PermissionEngine(loadPermissions()), []);
  const hooks = useMemo(() => new HookRunner(loadHooks()), []);
  const sessionStore = useMemo(() => new SessionStore(), []);
  const agentRegistry = useMemo(() => new AgentRegistry(), []);
  const lspManager = useMemo(() => new LspManager(), []);
  const snapshotManager = useMemo(() => new SnapshotManager(), []);
  const mcpClientsRef = useRef<McpClient[]>([]);

  const [runtimeReady, setRuntimeReady] = useState(false);
  const [connectedMcpServers, setConnectedMcpServers] = useState<string[]>([]);
  const systemPromptRef = useRef('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const builtins = await registry.discoverTools();
      registry.registerAll(builtins);

      const plugins = await discoverPlugins();
      registry.registerAll(plugins);

      registerBuiltinAgents(agentRegistry);
      agentRegistry.discoverFromDirectory(join(homedir(), '.tino', 'agents'), 'user');
      agentRegistry.discoverFromDirectory(join(process.cwd(), '.tino', 'agents'), 'project');

      configureLspTool(lspManager);
      configureLspDiagnostics(lspManager);

      void snapshotManager.init();

      const mcpConnections: string[] = [];
      const mcpConfig = loadMcpConfig();
      for (const [serverName, config] of Object.entries(mcpConfig)) {
        try {
          const client = new McpClient(serverName, config);
          const connected = await client.connect();
          if (!connected) continue;
          mcpClientsRef.current.push(client);
          await registerMcpTools(registry, serverName, client);
          mcpConnections.push(serverName);
        } catch {
          continue;
        }
      }

      registry.validate();

      const toolDescriptions = buildToolDescriptions(registry.getAll());
      systemPromptRef.current = buildSystemPrompt(toolDescriptions);

      configureTaskTool(() => ({
        broker,
        registry,
        permissions,
        hooks,
        systemPrompt: systemPromptRef.current,
      }));

      if (!cancelled) {
        setConnectedMcpServers(mcpConnections);
        setRuntimeReady(true);
      }
    })();
    return () => {
      cancelled = true;
      void lspManager.shutdown();
      const clients = mcpClientsRef.current;
      mcpClientsRef.current = [];
      for (const client of clients) {
        void client.disconnect();
      }
    };
  }, [agentRegistry, broker, hooks, lspManager, permissions, registry, snapshotManager]);

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
    sessionStore,
    agentRegistry,
    connectedMcpServers,
  };
}
