import { nanoid } from 'nanoid';
import { getDb } from '../db/index.js';
import type { McpServerConfig } from '../db/schemas.js';

/**
 * NeDB-backed CRUD for MCP server configurations. These control which MCP
 * servers the application connects to, making their tools available to the
 * chat LLM agent loop.
 */

export interface McpServerInput {
  name: string;
  transport: 'stdio' | 'sse';
  command?: string;
  args?: string[];
  url?: string;
  enabled?: boolean;
  env?: Record<string, string>;
}

function sanitize(input: McpServerInput): Omit<McpServerConfig, '_id' | 'createdAt' | 'updatedAt'> {
  const base = {
    name: input.name.trim(),
    transport: input.transport,
    enabled: input.enabled ?? true,
    env: input.env ?? undefined,
  };

  if (input.transport === 'stdio') {
    return {
      ...base,
      command: input.command?.trim(),
      args: input.args?.map((a) => a.trim()).filter(Boolean),
    };
  }
  // sse
  return {
    ...base,
    url: input.url?.trim(),
  };
}

export async function listMcpServers(): Promise<McpServerConfig[]> {
  const { mcpServers } = getDb();
  const rows = await mcpServers.findAsync<McpServerConfig>({}).sort({ createdAt: -1 });
  return rows as McpServerConfig[];
}

export async function getMcpServer(id: string): Promise<McpServerConfig | null> {
  const { mcpServers } = getDb();
  const row = await mcpServers.findOneAsync<McpServerConfig>({ _id: id });
  return (row as McpServerConfig) ?? null;
}

export async function createMcpServer(input: McpServerInput): Promise<McpServerConfig> {
  const { mcpServers } = getDb();
  const clean = sanitize(input);
  if (!clean.name) throw new Error('MCP server name is required');
  if (clean.transport === 'stdio' && !clean.command) {
    throw new Error('Command is required for stdio transport');
  }
  if (clean.transport === 'sse' && !clean.url) {
    throw new Error('URL is required for SSE transport');
  }

  const now = Date.now();
  const row: McpServerConfig = {
    _id: `mcp-${nanoid(10)}`,
    ...clean,
    createdAt: now,
    updatedAt: now,
  };
  await mcpServers.insertAsync(row);
  return row;
}

export async function updateMcpServer(
  id: string,
  patch: Partial<McpServerInput>,
): Promise<McpServerConfig | null> {
  const existing = await getMcpServer(id);
  if (!existing) return null;

  const merged = sanitize({
    name: patch.name ?? existing.name,
    transport: patch.transport ?? existing.transport,
    command: patch.command !== undefined ? patch.command : existing.command,
    args: patch.args !== undefined ? patch.args : existing.args,
    url: patch.url !== undefined ? patch.url : existing.url,
    enabled: patch.enabled !== undefined ? patch.enabled : existing.enabled,
    env: patch.env !== undefined ? patch.env : existing.env,
  });

  const next: McpServerConfig = {
    ...existing,
    ...merged,
    updatedAt: Date.now(),
  };
  const { mcpServers } = getDb();
  await mcpServers.updateAsync({ _id: id }, next, {});
  return next;
}

export async function deleteMcpServer(id: string): Promise<boolean> {
  const { mcpServers } = getDb();
  const removed = await mcpServers.removeAsync({ _id: id }, {});
  return removed > 0;
}

export async function listEnabledMcpServers(): Promise<McpServerConfig[]> {
  const { mcpServers } = getDb();
  const rows = await mcpServers.findAsync<McpServerConfig>({ enabled: true });
  return rows as McpServerConfig[];
}
