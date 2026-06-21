import { create } from 'zustand'
import {
  listMcpServers as apiListMcpServers,
  createMcpServer as apiCreateMcpServer,
  updateMcpServer as apiUpdateMcpServer,
  deleteMcpServer as apiDeleteMcpServer,
  testMcpServer as apiTestMcpServer,
  listMcpTools as apiListMcpTools,
} from '../lib/api.js'

/**
 * MCP store: manages MCP server configurations and their tools.
 * Each server item includes connection status from the backend.
 */
export const useMcpStore = create((set, get) => ({
  items: [],
  tools: [],
  loading: false,
  loaded: false,
  error: null,

  fetch: async () => {
    if (get().loaded || get().loading) return get().items
    set({ loading: true, error: null })
    try {
      const { items } = await apiListMcpServers()
      set({ items, loading: false, loaded: true })
      return items
    } catch (e) {
      set({ loading: false, error: e?.message ?? 'failed to load MCP servers' })
      return []
    }
  },

  refresh: async () => {
    set({ loading: true, error: null })
    try {
      const { items } = await apiListMcpServers()
      set({ items, loading: false, loaded: true })
      return items
    } catch (e) {
      set({ loading: false, error: e?.message ?? 'failed to load MCP servers' })
      return get().items
    }
  },

  create: async (body) => {
    const created = await apiCreateMcpServer(body)
    set((s) => ({ items: [created, ...s.items] }))
    return created
  },

  update: async (id, patch) => {
    const updated = await apiUpdateMcpServer(id, patch)
    set((s) => ({
      items: s.items.map((it) => (it._id === id ? updated : it)),
    }))
    return updated
  },

  remove: async (id) => {
    await apiDeleteMcpServer(id)
    set((s) => ({ items: s.items.filter((it) => it._id !== id) }))
  },

  test: async (id) => {
    const result = await apiTestMcpServer(id)
    // Update the item with the fresh connection status
    set((s) => ({
      items: s.items.map((it) =>
        it._id === id
          ? {
              ...it,
              connected: result.connected,
              toolCount: result.toolCount,
              connectionError: result.error,
            }
          : it,
      ),
    }))
    return result
  },

  fetchTools: async () => {
    try {
      const { items } = await apiListMcpTools()
      set({ tools: items })
      return items
    } catch {
      return []
    }
  },
}))
