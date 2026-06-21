import { Suspense, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useTabsStore } from '../../store/tabsStore.js';
import { useUIStore } from '../../store/uiStore.js';
import { TabBar } from './TabBar.jsx';
import { FileText, Loader2, Plus } from 'lucide-react';
import { lazyNamed } from '../../lib/lazy.js';

// PDF rendering pulls in pdfjs-dist (~1MB+). Defer until a tab is open.
const PdfViewer = lazyNamed(
  () => import('../reader/PdfViewer.jsx'),
  'PdfViewer',
);
// Slidev edit mode pulls in ByteMD + plugins; only load when toggled.
const SlidevEditor = lazyNamed(
  () => import('../slidev/SlidevEditor.jsx'),
  'SlidevEditor',
);
const PptxEditor = lazyNamed(
  () => import('../pptx/PptxEditor.jsx'),
  'PptxEditor',
);

function EditorFallback() {
  return (
    <div className="h-full flex items-center justify-center text-vs-muted gap-2 text-sm">
      <Loader2 size={14} className="animate-spin" />
    </div>
  );
}

export function EditorArea({ viewerRef }) {
  const { t } = useTranslation();
  const activeTab = useTabsStore((s) => s.tabs.find((tab) => tab.id === s.activeId));
  const setUrlDialogOpen = useUIStore((s) => s.setUrlDialogOpen);
  const slidevEditMode = useUIStore((s) => s.slidevEditMode);
  const pptxEditMode = useUIStore((s) => s.pptxEditMode);
  const setSlidevEditMode = useUIStore((s) => s.setSlidevEditMode);
  const setPptxEditMode = useUIStore((s) => s.setPptxEditMode);

  // Auto-exit edit mode when no document is open (e.g. user closed the tab).
  useEffect(() => {
    if (!activeTab) {
      if (slidevEditMode) setSlidevEditMode(false);
      if (pptxEditMode) setPptxEditMode(false);
    }
  }, [activeTab, slidevEditMode, pptxEditMode, setSlidevEditMode, setPptxEditMode]);

  return (
    <div className="h-full flex flex-col bg-vs-bg">
      <TabBar />
      <div className="flex-1 min-h-0">
        {activeTab ? (
          <Suspense fallback={<EditorFallback />}>
            {pptxEditMode ? (
              <PptxEditor />
            ) : slidevEditMode ? (
              <SlidevEditor tab={activeTab} viewerRef={viewerRef} />
            ) : (
              <PdfViewer ref={viewerRef} tab={activeTab} key={activeTab.id} />
            )}
          </Suspense>
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-vs-muted gap-3">
            <FileText size={48} className="opacity-50" />
            <div className="text-sm">{t('layout.statusBar.noDocOpen')}</div>
            <button
              onClick={() => setUrlDialogOpen(true)}
              className="inline-flex items-center gap-1 text-sm px-3 py-1.5 rounded bg-vs-accent hover:bg-vs-accent-hover text-white"
            >
              <Plus size={14} /> {t('layout.editorArea.openByUrl')}
            </button>
            <div className="text-xs opacity-60">{t('layout.editorArea.orPressShortcut')}</div>
          </div>
        )}
      </div>
    </div>
  );
}
