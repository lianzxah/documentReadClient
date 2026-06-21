import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import {
  createMcpServer,
  deleteMcpServer,
  getMcpServer,
  listMcpServers,
  updateMcpServer,
} from '../services/mcpStore.js';
import {
  getAvailableTools,
  getConnectionStatuses,
  refreshConnection,
  disconnectServer,
} from '../services/mcpClient.js';

const McpServerBody = z.object({
  name: z.string().min(1).max(100),
  transport: z.enum(['stdio', 'sse']),
  command: z.string().max(500).optional(),
  args: z.array(z.string().max(200)).max(20).optional(),
  url: z.string().url().optional(),
  enabled: z.boolean().optional(),
  env: z.record(z.string().max(200)).optional(),
});

const McpServerPatch = McpServerBody.partial();

export async function mcpRoutes(app: FastifyInstance) {
  /** List all configured MCP servers with their connection status. */
  app.get('/mcp/servers', async () => {
    const servers = await listMcpServers();
    const statuses = getConnectionStatuses();
    const statusMap = new Map(statuses.map((s) => [s.serverId, s]));

    const items = servers.map((s) => ({
      ...s,
      connected: statusMap.get(s._id)?.connected ?? false,
      toolCount: statusMap.get(s._id)?.toolCount ?? 0,
      connectionError: statusMap.get(s._id)?.error,
    }));
    return { items };
  });

  /** Get a single MCP server config. */
  app.get<{ Params: { id: string } }>('/mcp/servers/:id', async (req, reply) => {
    const server = await getMcpServer(req.params.id);
    if (!server) return reply.code(404).send({ error: 'mcp server not found' });
    return server;
  });

  /** Add a new MCP server configuration. */
  app.post('/mcp/servers', async (req, reply) => {
    const parsed = McpServerBody.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.flatten() });
    }
    try {
      const created = await createMcpServer(parsed.data);
      // Auto-connect if enabled
      if (created.enabled) {
        await refreshConnection(created._id);
      }
      const statuses = getConnectionStatuses();
      const status = statuses.find((s) => s.serverId === created._id);
      return {
        ...created,
        connected: status?.connected ?? false,
        toolCount: status?.toolCount ?? 0,
        connectionError: status?.error,
      };
    } catch (e: any) {
      return reply.code(400).send({ error: e?.message ?? 'create failed' });
    }
  });

  /** Update an MCP server configuration. */
  app.put<{ Params: { id: string } }>('/mcp/servers/:id', async (req, reply) => {
    const parsed = McpServerPatch.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.flatten() });
    }
    const updated = await updateMcpServer(req.params.id, parsed.data);
    if (!updated) return reply.code(404).send({ error: 'mcp server not found' });

    // Reconnect with updated config
    if (updated.enabled) {
      await refreshConnection(updated._id);
    } else {
      await disconnectServer(updated._id);
    }
    const statuses = getConnectionStatuses();
    const status = statuses.find((s) => s.serverId === updated._id);
    return {
      ...updated,
      connected: status?.connected ?? false,
      toolCount: status?.toolCount ?? 0,
      connectionError: status?.error,
    };
  });

  /** Delete an MCP server configuration. */
  app.delete<{ Params: { id: string } }>('/mcp/servers/:id', async (req, reply) => {
    await disconnectServer(req.params.id);
    const ok = await deleteMcpServer(req.params.id);
    if (!ok) return reply.code(404).send({ error: 'mcp server not found' });
    return { ok: true };
  });

  /** Test connection to an MCP server (reconnect and report). */
  app.post<{ Params: { id: string } }>(
    '/mcp/servers/:id/test',
    async (req, reply) => {
      const server = await getMcpServer(req.params.id);
      if (!server) return reply.code(404).send({ error: 'mcp server not found' });
      const t0 = Date.now();
      const status = await refreshConnection(req.params.id);
      return {
        ...status,
        latencyMs: Date.now() - t0,
      };
    },
  );

  /** List all available tools across all connected MCP servers. */
  app.get('/mcp/tools', async () => {
    const tools = getAvailableTools();
    return { items: tools };
  });
}
