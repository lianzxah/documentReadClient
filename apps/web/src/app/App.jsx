import { Suspense, useCallback, useEffect, useRef } from 'react';
import { PanelGroup, Panel, PanelResizeHandle } from 'react-resizable-panels';
import { useKeyPress } from 'ahooks';
import i18n from '../i18n/index.js';
import { ActivityBar } from '../components/layout/ActivityBar.jsx';
import { SideBar } from '../components/layout/SideBar.jsx';
import { EditorArea } from '../components/layout/EditorArea.jsx';
import { StatusBar } from '../components/layout/StatusBar.jsx';
import { useUIStore } from '../store/uiStore.js';
import { useTabsStore } from '../store/tabsStore.js';
import { lazyNamed } from '../lib/lazy.js';

// Heavy panels / dialogs are loaded on demand to keep the entry bundle
// small. Each becomes its own JS chunk under /assets thanks to Vite's
// dynamic-import code splitting.
const ChatPanel = lazyNamed(() => import('../components/chat/ChatPanel.jsx'), 'ChatPanel');
const OpenDocumentDialog = lazyNamed(() => import('../components/reader/OpenDocumentDialog.jsx'), 'OpenDocumentDialog');
const TranslatePopover = lazyNamed(() => import('../components/translate/TranslatePopover.jsx'), 'TranslatePopover');
const SettingsDialog = lazyNamed(() => import('../components/settings/SettingsDialog.jsx'), 'SettingsDialog');

export default function App() {
  const sideBarVisible = useUIStore((s) => s.sideBarVisible);
  const setSideBarVisible = useUIStore((s) => s.setSideBarVisible);
  const panelVisible = useUIStore((s) => s.panelVisible);
  const togglePanel = useUIStore((s) => s.togglePanel);
  const setUrlDialogOpen = useUIStore((s) => s.setUrlDialogOpen);
  const chatPosition = useUIStore((s) => s.chatPosition);
  const language = useUIStore((s) => s.language);
  const activeId = useTabsStore((s) => s.activeId);
  const closeTab = useTabsStore((s) => s.closeTab);

  const viewerRef = useRef(null);
  const sidebarPanelRef = useRef(null);

  // Sync the imperative panel collapse/expand state with the Zustand store.
  // This handles ActivityBar toggles → panel animation.
  useEffect(() => {
    const panel = sidebarPanelRef.current;
    if (!panel) return;
    if (sideBarVisible && panel.isCollapsed()) {
      panel.expand();
    } else if (!sideBarVisible && !panel.isCollapsed()) {
      panel.collapse();
    }
  }, [sideBarVisible]);

  // Callbacks for react-resizable-panels collapse/expand events.
  // These fire when the user drags below minSize threshold → auto-collapse.
  const handleSidebarCollapse = useCallback(() => {
    setSideBarVisible(false);
  }, [setSideBarVisible]);
  const handleSidebarExpand = useCallback(() => {
    setSideBarVisible(true);
  }, [setSideBarVisible]);

  // Keep i18next in sync with the persisted language preference. Runs once on
  // mount with the rehydrated value, then again whenever the user picks a new
  // language from the TabBar switcher.
  useEffect(() => {
    if (i18n.language !== language) i18n.changeLanguage(language);
  }, [language]);

  // Global shortcuts
  useKeyPress(['ctrl.t', 'meta.t'], (e) => {
    e.preventDefault();
    setUrlDialogOpen(true);
  });
  useKeyPress(['ctrl.j', 'meta.j'], (e) => {
    e.preventDefault();
    togglePanel();
  });
  useKeyPress(['ctrl.w', 'meta.w'], (e) => {
    if (activeId) {
      e.preventDefault();
      closeTab(activeId);
    }
  });

  const showBottomChat = chatPosition === 'bottom' && panelVisible;

  return (
    <div className="h-full w-full flex flex-col">
      <div className="flex-1 flex min-h-0">
        <ActivityBar />
        <div className="flex-1 min-w-0">
          <PanelGroup direction="horizontal" autoSaveId="doc-reader:main-h">
            <Panel
              ref={sidebarPanelRef}
              defaultSize={sideBarVisible ? 18 : 0}
              minSize={12}
              maxSize={40}
              collapsible={true}
              collapsedSize={0}
              onCollapse={handleSidebarCollapse}
              onExpand={handleSidebarExpand}
            >
              <SideBar viewerRef={viewerRef} />
            </Panel>
            <PanelResizeHandle className="w-[3px] bg-vs-border hover:bg-vs-status transition-colors" />
            <Panel minSize={30}>
              <PanelGroup direction="vertical">
                <Panel defaultSize={showBottomChat ? 65 : 100} minSize={30}>
                  <EditorArea viewerRef={viewerRef} />
                </Panel>
                {showBottomChat && (
                  <>
                    <PanelResizeHandle className="h-[3px] bg-vs-border hover:bg-vs-status transition-colors" />
                    <Panel defaultSize={35} minSize={15}>
                      <Suspense fallback={null}>
                        <ChatPanel viewerRef={viewerRef} />
                      </Suspense>
                    </Panel>
                  </>
                )}
              </PanelGroup>
            </Panel>
          </PanelGroup>
        </div>
      </div>
      <StatusBar />
      <Suspense fallback={null}>
        <OpenDocumentDialog />
        <TranslatePopover />
        <SettingsDialog />
      </Suspense>
    </div>
  );
}
