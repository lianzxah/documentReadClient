import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import {
  createSession as apiCreateSession,
  deleteSession as apiDeleteSession,
  listSessions as apiListSessions,
  renameSession as apiRenameSession,
  updateSession as apiUpdateSession,
} from '../lib/api.js'

/** In-flight promise caches – prevents duplicate concurrent requests. */
const _loadPromises = new Map()
const _ensurePromises = new Map()

/**
 * Sessions store: per-document chat session metadata. The transcript itself
 * lives in `chatStore` (keyed by sessionId). Server is the source of truth;
 * we cache the listing per documentId and remember which session was active
 * so reopening a document restores the user's last active conversation.
 */
export const useSessionsStore = create(
  persist(
    (set, get) => ({
      /** { [documentId]: Session[] } */
      byDoc: {},
      /** { [documentId]: sessionId } */
      currentByDoc: {},
      /** documentIds currently being loaded (avoids dupe fetches) */
      loading: {},
      error: null,

      getList: (documentId) => get().byDoc[documentId] ?? [],
      getCurrentId: (documentId) => get().currentByDoc[documentId] ?? null,

      /**
       * Fetch the session list for a document. If a fetch is already in-flight
       * for the same document we await the existing promise instead of returning
       * stale (possibly empty) cached data.
       */
      load: async (documentId) => {
        if (!documentId) return []

        // Deduplicate: if an identical load is already in-flight, share it.
        if (_loadPromises.has(documentId)) {
          return _loadPromises.get(documentId)
        }

        const promise = (async () => {
          set((s) => ({
            loading: { ...s.loading, [documentId]: true },
            error: null,
          }))
          try {
            const { items } = await apiListSessions(documentId)
            set((s) => ({
              byDoc: { ...s.byDoc, [documentId]: items },
              loading: { ...s.loading, [documentId]: false },
            }))
            // Ensure currentByDoc points at a still-valid session.
            const cur = get().currentByDoc[documentId]
            const stillExists = cur && items.some((it) => it._id === cur)
            if (!stillExists) {
              const next = items[0]?._id ?? null
              set((s) => ({
                currentByDoc: { ...s.currentByDoc, [documentId]: next },
              }))
            }
            return items
          } catch (e) {
            set((s) => ({
              loading: { ...s.loading, [documentId]: false },
              error: e.message ?? 'failed to load sessions',
            }))
            return []
          } finally {
            _loadPromises.delete(documentId)
          }
        })()

        _loadPromises.set(documentId, promise)
        return promise
      },

      /**
       * Ensure at least one session exists for the document and return its id.
       * Used by ChatPanel when the user switches to a doc that has never had
       * a conversation before. Concurrent calls for the same document share
       * a single promise so we never create duplicate sessions.
       */
      ensureCurrent: async (documentId) => {
        if (!documentId) return null

        // Deduplicate: if ensureCurrent is already running for this doc, reuse.
        if (_ensurePromises.has(documentId)) {
          return _ensurePromises.get(documentId)
        }

        const promise = (async () => {
          try {
            const list = await get().load(documentId)
            const cur = get().currentByDoc[documentId]
            if (cur && list.some((s) => s._id === cur)) return cur
            if (list.length > 0) {
              set((s) => ({
                currentByDoc: { ...s.currentByDoc, [documentId]: list[0]._id },
              }))
              return list[0]._id
            }
            const created = await get().create(documentId)
            return created?._id ?? null
          } finally {
            _ensurePromises.delete(documentId)
          }
        })()

        _ensurePromises.set(documentId, promise)
        return promise
      },

      create: async (documentId, title) => {
        if (!documentId) return null
        try {
          const session = await apiCreateSession(documentId, title)
          set((s) => ({
            byDoc: {
              ...s.byDoc,
              [documentId]: [session, ...(s.byDoc[documentId] ?? [])],
            },
            currentByDoc: { ...s.currentByDoc, [documentId]: session._id },
          }))
          return session
        } catch (e) {
          set({ error: e.message ?? 'failed to create session' })
          return null
        }
      },

      select: (documentId, sessionId) => {
        if (!documentId || !sessionId) return
        set((s) => ({
          currentByDoc: { ...s.currentByDoc, [documentId]: sessionId },
        }))
      },

      rename: async (documentId, sessionId, title) => {
        try {
          const updated = await apiRenameSession(sessionId, title)
          set((s) => ({
            byDoc: {
              ...s.byDoc,
              [documentId]: (s.byDoc[documentId] ?? []).map((it) =>
                it._id === sessionId ? updated : it,
              ),
            },
          }))
          return updated
        } catch (e) {
          set({ error: e.message ?? 'failed to rename session' })
          return null
        }
      },

      /**
       * Bind a skill to a session. The session row's `skillId` is updated
       * server-side and mirrored in the local list so the chat header can
       * render the new selection without a refetch.
       */
      setSkill: async (documentId, sessionId, skillId) => {
        try {
          const updated = await apiUpdateSession(sessionId, { skillId })
          set((s) => ({
            byDoc: {
              ...s.byDoc,
              [documentId]: (s.byDoc[documentId] ?? []).map((it) =>
                it._id === sessionId ? updated : it,
              ),
            },
          }))
          return updated
        } catch (e) {
          set({ error: e.message ?? 'failed to update skill' })
          return null
        }
      },

      /**
       * Bind primary + auxiliary skills to a session. Sends both fields to the
       * backend in a single PATCH so the session reflects the full skill combo.
       */
      setSkills: async (documentId, sessionId, { primaryId, auxiliaryIds }) => {
        try {
          const patch = {}
          if (primaryId !== undefined) patch.skillId = primaryId
          if (auxiliaryIds !== undefined) patch.auxiliarySkillIds = auxiliaryIds
          const updated = await apiUpdateSession(sessionId, patch)
          set((s) => ({
            byDoc: {
              ...s.byDoc,
              [documentId]: (s.byDoc[documentId] ?? []).map((it) =>
                it._id === sessionId ? updated : it,
              ),
            },
          }))
          return updated
        } catch (e) {
          set({ error: e.message ?? 'failed to update skills' })
          return null
        }
      },

      remove: async (documentId, sessionId) => {
        try {
          await apiDeleteSession(sessionId)
          set((s) => {
            const list = (s.byDoc[documentId] ?? []).filter(
              (it) => it._id !== sessionId,
            )
            const cur =
              s.currentByDoc[documentId] === sessionId
                ? (list[0]?._id ?? null)
                : s.currentByDoc[documentId]
            return {
              byDoc: { ...s.byDoc, [documentId]: list },
              currentByDoc: { ...s.currentByDoc, [documentId]: cur },
            }
          })
          return true
        } catch (e) {
          set({ error: e.message ?? 'failed to delete session' })
          return false
        }
      },

      /**
       * Locally bump a session's updatedAt + messageCount (and re-sort) when
       * a new message lands. Avoids a full server refetch after every send.
       */
      touchAfterMessage: (documentId, sessionId, deltaCount = 1) => {
        set((s) => {
          const list = s.byDoc[documentId] ?? []
          const idx = list.findIndex((it) => it._id === sessionId)
          if (idx < 0) return s
          const updated = {
            ...list[idx],
            messageCount: (list[idx].messageCount ?? 0) + deltaCount,
            updatedAt: Date.now(),
          }
          const next = [updated, ...list.filter((_, i) => i !== idx)]
          return { byDoc: { ...s.byDoc, [documentId]: next } }
        })
      },

      /** Drop sessions cached for a document we just deleted. */
      clearDoc: (documentId) => {
        set((s) => {
          const byDoc = { ...s.byDoc }
          delete byDoc[documentId]
          const currentByDoc = { ...s.currentByDoc }
          delete currentByDoc[documentId]
          return { byDoc, currentByDoc }
        })
      },
    }),
    {
      name: 'doc-reader:sessions',
      partialize: (s) => ({ currentByDoc: s.currentByDoc }),
    },
  ),
)
