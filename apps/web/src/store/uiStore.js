import { create } from 'zustand'
import { persist } from 'zustand/middleware'

/**
 * UI-layout state: which activity view is selected, visibility of sidebar/panel,
 * and Slidev edit-mode flags (transient + per-user pdf-pane preference).
 */
export const useUIStore = create(
  persist(
    (set) => ({
      activity: 'explorer', // 'explorer' | 'chat' | 'translate' | 'settings'
      sideBarVisible: true,
      panelVisible: true,
      urlDialogOpen: false,
      settingsDialogOpen: false,
      chatPosition: 'sidebar', // 'sidebar' | 'bottom'
      // UI language for the React tree. Synced into i18next from App.jsx.
      // Persisted so the next session honours the user's choice.
      language: 'en', // 'en' | 'zh'
      // Slidev editor state. `slidevEditMode` is session-scoped (not persisted),
      // `slidevPdfPaneVisible` mirrors the user's last toggle of the right pane.
      slidevEditMode: false,
      pptxEditMode: false,
      slidevPdfPaneVisible: true,

      setActivity: (activity) => set({ activity }),
      toggleSideBar: () => set((s) => ({ sideBarVisible: !s.sideBarVisible })),
      setSideBarVisible: (visible) => set({ sideBarVisible: visible }),
      togglePanel: () => set((s) => ({ panelVisible: !s.panelVisible })),
      setUrlDialogOpen: (open) => set({ urlDialogOpen: open }),
      setSettingsDialogOpen: (open) => set({ settingsDialogOpen: open }),
      setChatPosition: (pos) => set({ chatPosition: pos }),
      toggleChatPosition: () =>
        set((s) => ({
          chatPosition: s.chatPosition === 'sidebar' ? 'bottom' : 'sidebar',
        })),
      setLanguage: (lang) => set({ language: lang === 'zh' ? 'zh' : 'en' }),
      setSlidevEditMode: (on) =>
        set({ slidevEditMode: !!on, pptxEditMode: false }),
      setPptxEditMode: (on) =>
        set({ pptxEditMode: !!on, slidevEditMode: false }),
      toggleSlidevPdfPane: () =>
        set((s) => ({ slidevPdfPaneVisible: !s.slidevPdfPaneVisible })),
    }),
    {
      name: 'doc-reader:ui',
      partialize: (s) => ({
        activity: s.activity,
        sideBarVisible: s.sideBarVisible,
        panelVisible: s.panelVisible,
        chatPosition: s.chatPosition,
        language: s.language,
        slidevPdfPaneVisible: s.slidevPdfPaneVisible,
      }),
    },
  ),
)
