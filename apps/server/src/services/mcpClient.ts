import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';
import { listEnabledMcpServers } from './mcpStore.js';
import type { McpServerConfig } from '../db/schemas.js';

/**
 * MCP Client manager. Maintains a connection pool — one MCP Client per enabled
 * server config. Exposes a unified view of all available tools across connected
 * servers, and provides a `callTool` function the agent loop uses to invoke them.
 */

export interface McpTool {
  serverId: string;
  serverName: string;
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

export interface McpConnectionStatus {
  serverId: string;
  serverName: string;
  connected: boolean;
  toolCount: number;
  error?: string;
}

interface ConnectedServer {
  config: McpServerConfig;
  client: Client;
  transport: StdioClientTransport | SSEClientTransport;
  tools: McpTool[];
  connected: boolean;
  error?: string;
}

const _pool = new Map<string, ConnectedServer>();

/**
 * Connect to a single MCP server. On success, discover its tools.
 * On failure, record the error but don't throw (graceful degradation).
 */
async function connectServer(cfg: McpServerConfig): Promise<ConnectedServer> {
  const entry: ConnectedServer = {
    config: cfg,
    client: null as any,
    transport: null as any,
    tools: [],
    connected: false,
  };

  try {
    let transport: StdioClientTransport | SSEClientTransport;

    if (cfg.transport === 'stdio') {
      if (!cfg.command) throw new Error('No command configured');
      transport = new StdioClientTransport({
        command: cfg.command,
        args: cfg.args ?? [],
        env: { ...process.env, ...(cfg.env ?? {}) } as Record<string, string>,
      });
    } else {
      if (!cfg.url) throw new Error('No URL configured');
      transport = new SSEClientTransport(new URL(cfg.url));
    }

    const client = new Client(
      { name: 'document-reader', version: '1.0.0' },
      { capabilities: {} },
    );

    await client.connect(transport);

    // Discover tools
    const { tools: rawTools } = await client.listTools();
    const tools: McpTool[] = (rawTools ?? []).map((t) => ({
      serverId: cfg._id,
      serverName: cfg.name,
      name: t.name,
      description: t.description ?? '',
      inputSchema: (t.inputSchema as Record<string, unknown>) ?? {},
    }));

    entry.client = client;
    entry.transport = transport;
    entry.tools = tools;
    entry.connected = true;
  } catch (e: any) {
    entry.connected = false;
    entry.error = e?.message ?? 'connection failed';
  }

  return entry;
}

/**
 * Initialise connections to all enabled MCP servers. Safe to call multiple
 * times — existing connections are skipped. Called on server startup.
 */
export async function initMcpConnections(): Promise<void> {
  const servers = await listEnabledMcpServers();
  const pending: Promise<void>[] = [];

  for (const cfg of servers) {
    if (_pool.has(cfg._id)) continue;
    pending.push(
      connectServer(cfg).then((entry) => {
        _pool.set(cfg._id, entry);
      }),
    );
  }

  await Promise.allSettled(pending);
}

/**
 * Refresh a single server's connection. Disconnects the old one if present,
 * then reconnects using the latest config from the store.
 */
export async function refreshConnection(serverId: string): Promise<McpConnectionStatus> {
  // Disconnect existing
  const existing = _pool.get(serverId);
  if (existing?.connected) {
    try {
      await existing.client.close();
    } catch { /* ignore */ }
  }
  _pool.delete(serverId);

  // Re-read config from store
  const { getMcpServer } = await import('./mcpStore.js');
  const cfg = await getMcpServer(serverId);
  if (!cfg || !cfg.enabled) {
    return { serverId, serverName: cfg?.name ?? '', connected: false, toolCount: 0 };
  }

  const entry = await connectServer(cfg);
  _pool.set(serverId, entry);

  return {
    serverId,
    serverName: entry.config.name,
    connected: entry.connected,
    toolCount: entry.tools.length,
    error: entry.error,
  };
}

/**
 * Disconnect a specific server and remove it from the pool.
 */
export async function disconnectServer(serverId: string): Promise<void> {
  const entry = _pool.get(serverId);
  if (entry?.connected) {
    try {
      await entry.client.close();
    } catch { /* ignore */ }
  }
  _pool.delete(serverId);
}

/**
 * Disconnect all servers. Called on graceful shutdown.
 */
export async function disconnectAll(): Promise<void> {
  const closers: Promise<void>[] = [];
  for (const [id, entry] of _pool) {
    if (entry.connected) {
      closers.push(
        entry.client.close().catch(() => {}),
      );
    }
  }
  await Promise.allSettled(closers);
  _pool.clear();
}

/**
 * Get all tools across all connected servers.
 */
export function getAvailableTools(): McpTool[] {
  const tools: McpTool[] = [];
  for (const entry of _pool.values()) {
    if (entry.connected) {
      tools.push(...entry.tools);
    }
  }
  return tools;
}

/**
 * Get connection status for all servers in the pool.
 */
export function getConnectionStatuses(): McpConnectionStatus[] {
  const statuses: McpConnectionStatus[] = [];
  for (const entry of _pool.values()) {
    statuses.push({
      serverId: entry.config._id,
      serverName: entry.config.name,
      connected: entry.connected,
      toolCount: entry.tools.length,
      error: entry.error,
    });
  }
  return statuses;
}

/**
 * Call a tool on a specific MCP server. Returns the tool result content.
 * Throws on connection or execution errors.
 */
export async function callTool(
  serverId: string,
  toolName: string,
  args: Record<string, unknown>,
): Promise<unknown> {
  const entry = _pool.get(serverId);
  if (!entry) throw new Error(`MCP server ${serverId} not in pool`);
  if (!entry.connected) throw new Error(`MCP server ${entry.config.name} is disconnected`);

  const result = await entry.client.callTool({ name: toolName, arguments: args });

  // MCP tool results have a `content` array. Extract text for the LLM.
  if (result.content && Array.isArray(result.content)) {
    const texts = result.content
      .filter((c: any) => c.type === 'text')
      .map((c: any) => c.text);
    if (texts.length) return texts.join('\n');
  }
  return result.content ?? result;
}

/**
 * Convert available MCP tools to OpenAI function-calling format suitable for
 * `ChatOpenAI.bindTools()`.
 */
export function toolsToOpenAIFormat(): Array<{
  type: 'function';
  function: { name: string; description: string; parameters: Record<string, unknown> };
}> {
  const tools = getAvailableTools();
  return tools.map((t) => ({
    type: 'function' as const,
    function: {
      name: `${t.serverId}__${t.name}`,
      description: `[${t.serverName}] ${t.description}`,
      parameters: t.inputSchema,
    },
  }));
}

/**
 * Parse a composite tool name (serverId__toolName) back into its parts.
 */
export function parseToolCallName(compositeName: string): { serverId: string; toolName: string } | null {
  const idx = compositeName.indexOf('__');
  if (idx < 0) return null;
  return {
    serverId: compositeName.slice(0, idx),
    toolName: compositeName.slice(idx + 2),
  };
}
