import { create } from 'zustand'
import {
  clearSessionMessages as apiClearMessages,
  getSession as apiGetSession,
} from '../lib/api.js'

/**
 * Chat transcripts are keyed by sessionId. The transcript is loaded from the
 * server (`hydrate`) the first time a session is opened in this browser tab,
 * and kept in memory afterwards. The persisted history lives in NeDB.
 *
 * Each per-session entry has shape:
 *   { messages: ChatMessage[], streaming: boolean, citations: Citation[],
 *     hydrated: boolean, hydrating: boolean }
 */
const empty = () => ({
  messages: [],
  streaming: false,
  citations: [],
  hydrated: false,
  hydrating: false,
})

export const useChatStore = create((set, get) => ({
  bySession: {},
  abortController: null,

  getState: (sessionId) =>
    sessionId ? (get().bySession[sessionId] ?? empty()) : empty(),

  /**
   * Load the transcript for `sessionId` from the server. Idempotent: skips
   * the fetch if a hydration already succeeded or is in flight.
   */
  hydrate: async (sessionId) => {
    if (!sessionId) return
    const cur = get().bySession[sessionId]
    if (cur?.hydrated || cur?.hydrating) return
    set({
      bySession: {
        ...get().bySession,
        [sessionId]: { ...empty(), ...cur, hydrating: true },
      },
    })
    try {
      const { messages } = await apiGetSession(sessionId)
      const allCitations = []
      const ui = messages.map((m) => {
        if (m.role === 'assistant' && Array.isArray(m.citations)) {
          for (const c of m.citations) allCitations.push(c)
        }
        return { role: m.role, content: m.content }
      })
      set({
        bySession: {
          ...get().bySession,
          [sessionId]: {
            messages: ui,
            streaming: false,
            citations: allCitations,
            hydrated: true,
            hydrating: false,
          },
        },
      })
    } catch {
      // Session may have been deleted concurrently; mark hydrated empty so
      // we don't keep retrying.
      set({
        bySession: {
          ...get().bySession,
          [sessionId]: { ...empty(), hydrated: true },
        },
      })
    }
  },

  appendUserMessage: (sessionId, content) => {
    const cur = get().bySession[sessionId] ?? empty()
    set({
      bySession: {
        ...get().bySession,
        [sessionId]: {
          ...cur,
          messages: [...cur.messages, { role: 'user', content }],
        },
      },
    })
  },

  startAssistant: (sessionId) => {
    const cur = get().bySession[sessionId] ?? empty()
    set({
      bySession: {
        ...get().bySession,
        [sessionId]: {
          ...cur,
          messages: [...cur.messages, { role: 'assistant', content: '' }],
          streaming: true,
        },
      },
    })
  },

  /**
   * Attach a skill annotation to the in-flight assistant message so the UI
   * can render an "answered with: <name>" badge above it. Called on the
   * `skill` SSE event emitted by the server up-front.
   */
  setAssistantSkill: (sessionId, skill) => {
    const cur = get().bySession[sessionId]
    if (!cur) return
    const msgs = cur.messages.slice()
    const last = msgs[msgs.length - 1]
    if (!last || last.role !== 'assistant') return
    msgs[msgs.length - 1] = { ...last, skill }
    set({
      bySession: {
        ...get().bySession,
        [sessionId]: { ...cur, messages: msgs },
      },
    })
  },

  appendAssistantDelta: (sessionId, delta) => {
    const cur = get().bySession[sessionId]
    if (!cur) return
    const msgs = cur.messages.slice()
    const last = msgs[msgs.length - 1]
    if (!last || last.role !== 'assistant') return
    msgs[msgs.length - 1] = { ...last, content: last.content + delta }
    set({
      bySession: {
        ...get().bySession,
        [sessionId]: { ...cur, messages: msgs },
      },
    })
  },

  /**
   * Add a tool call in 'running' state to the current assistant message.
   * Called on the `tool_start` SSE event.
   */
  addToolCall: (sessionId, { toolName, serverId, args }) => {
    const cur = get().bySession[sessionId]
    if (!cur) return
    const msgs = cur.messages.slice()
    const last = msgs[msgs.length - 1]
    if (!last || last.role !== 'assistant') return
    const toolCalls = [
      ...(last.toolCalls ?? []),
      { toolName, serverId, args, status: 'running' },
    ]
    msgs[msgs.length - 1] = { ...last, toolCalls }
    set({
      bySession: {
        ...get().bySession,
        [sessionId]: { ...cur, messages: msgs },
      },
    })
  },

  /**
   * Update a tool call with its result, switching to 'done' state.
   * Matches by toolName (last running occurrence).
   */
  updateToolCall: (sessionId, { toolName, result, latencyMs }) => {
    const cur = get().bySession[sessionId]
    if (!cur) return
    const msgs = cur.messages.slice()
    const last = msgs[msgs.length - 1]
    if (!last || last.role !== 'assistant') return
    const toolCalls = (last.toolCalls ?? []).slice()
    // Find the last running tool call matching this name
    for (let i = toolCalls.length - 1; i >= 0; i--) {
      if (
        toolCalls[i].toolName === toolName &&
        toolCalls[i].status === 'running'
      ) {
        toolCalls[i] = { ...toolCalls[i], status: 'done', result, latencyMs }
        break
      }
    }
    msgs[msgs.length - 1] = { ...last, toolCalls }
    set({
      bySession: {
        ...get().bySession,
        [sessionId]: { ...cur, messages: msgs },
      },
    })
  },

  addCitation: (sessionId, citation) => {
    const cur = get().bySession[sessionId]
    if (!cur) return
    set({
      bySession: {
        ...get().bySession,
        [sessionId]: { ...cur, citations: [...cur.citations, citation] },
      },
    })
  },

  endAssistant: (sessionId) => {
    const cur = get().bySession[sessionId]
    if (!cur) return
    set({
      bySession: {
        ...get().bySession,
        [sessionId]: { ...cur, streaming: false },
      },
    })
  },

  setAbortController: (c) => set({ abortController: c }),
  abort: () => {
    const c = get().abortController
    if (c) c.abort()
    set({ abortController: null })
  },

  /** Clear messages locally AND on the server. */
  clear: async (sessionId) => {
    if (!sessionId) return
    try {
      await apiClearMessages(sessionId)
    } catch {
      // Ignore network errors — local clear still proceeds for UX.
    }
    set({
      bySession: {
        ...get().bySession,
        [sessionId]: { ...empty(), hydrated: true },
      },
    })
  },

  /** Drop a session's transcript from memory (used on session delete). */
  forget: (sessionId) => {
    const next = { ...get().bySession }
    delete next[sessionId]
    set({ bySession: next })
  },
}))
