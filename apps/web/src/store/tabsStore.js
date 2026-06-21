import { create } from 'zustand'
import { persist } from 'zustand/middleware'

/**
 * Tabs store: each tab represents an opened PDF document.
 * Persisted to localStorage so tabs survive reloads.
 */
export const useTabsStore = create(
  persist(
    (set, get) => ({
      tabs: [],
      activeId: null,

      openTab: (doc) => {
        // Dedupe by documentId
        const existing = get().tabs.find((t) => t.documentId === doc.documentId)
        if (existing) {
          set({ activeId: existing.id })
          return existing.id
        }
        const id = `tab_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
        const tab = {
          id,
          documentId: doc.documentId,
          url: doc.url,
          title: doc.title,
          pages: doc.pages,
          currentPage: 1,
          isTwoPage: false,
          outline: null,
        }
        set({ tabs: [...get().tabs, tab], activeId: id })
        return id
      },

      closeTab: (id) => {
        const tabs = get().tabs.filter((t) => t.id !== id)
        let activeId = get().activeId
        if (activeId === id) {
          activeId = tabs.length ? tabs[tabs.length - 1].id : null
        }
        set({ tabs, activeId })
      },

      setActive: (id) => set({ activeId: id }),

      setCurrentPage: (id, page) =>
        set({
          tabs: get().tabs.map((t) =>
            t.id === id ? { ...t, currentPage: page } : t,
          ),
        }),

      toggleTwoPage: (id) =>
        set({
          tabs: get().tabs.map((t) =>
            t.id === id ? { ...t, isTwoPage: !t.isTwoPage } : t,
          ),
        }),

      setOutline: (id, outline) =>
        set({
          tabs: get().tabs.map((t) => (t.id === id ? { ...t, outline } : t)),
        }),

      getActive: () => {
        const { tabs, activeId } = get()
        return tabs.find((t) => t.id === activeId) ?? null
      },
    }),
    {
      name: 'doc-reader:tabs',
      partialize: (s) => ({ tabs: s.tabs, activeId: s.activeId }),
    },
  ),
)
