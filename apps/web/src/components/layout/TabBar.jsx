import { useTranslation } from 'react-i18next';
import { useTabsStore } from '../../store/tabsStore.js';
import { X, FileText, Download, BookOpen } from 'lucide-react';
import { pdfDownloadUrl } from '../../lib/api.js';
import { cn } from '../../lib/cn.js';
import { LanguageSwitcher } from './LanguageSwitcher.jsx';

export function TabBar() {
  const { t } = useTranslation();
  const tabs = useTabsStore((s) => s.tabs);
  const activeId = useTabsStore((s) => s.activeId);
  const setActive = useTabsStore((s) => s.setActive);
  const closeTab = useTabsStore((s) => s.closeTab);
  const activeTab = tabs.find((t) => t.id === activeId);
  const activeDocumentId = activeTab?.documentId;
  const toggleTwoPage = useTabsStore((s) => s.toggleTwoPage);

  // Stream-download the PDF of the currently active document. The backend
  // endpoint sets Content-Disposition, Content-Length and Accept-Ranges,
  // so the browser saves the file with a progress indicator and without
  // buffering the response in JS memory. Navigation is triggered via a
  // transient anchor click so the current page is not unloaded.
  const handleDownloadPdf = () => {
    if (!activeDocumentId) return;
    const a = document.createElement('a');
    a.href = pdfDownloadUrl(activeDocumentId);
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="h-9 flex items-stretch bg-vs-activity border-b border-vs-border">
      {/* Tabs - horizontally scrollable */}
      <div className="flex items-end flex-1 min-w-0 overflow-x-auto">
        {tabs.map((tab) => (
          <div
            key={tab.id}
            onClick={() => setActive(tab.id)}
            className={cn(
              'group h-9 flex items-center gap-2 px-3 text-sm cursor-pointer border-r border-vs-border shrink-0',
              activeId === tab.id
                ? 'bg-vs-bg text-white'
                : 'bg-vs-activity text-vs-muted hover:text-white',
            )}
            title={tab.url}
          >
            <FileText size={13} />
            <span className="max-w-[220px] truncate">{tab.title}</span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                closeTab(tab.id);
              }}
              className="opacity-0 group-hover:opacity-100 hover:bg-[#3d3d3d] rounded p-[2px]"
            >
              <X size={12} />
            </button>
          </div>
        ))}
      </div>

      {/* Global actions - pinned to the top-right */}
      <div className="flex items-stretch shrink-0 border-l border-vs-border">
        {activeTab && (
          <button
            onClick={() => toggleTwoPage(activeTab.id)}
            title={activeTab.isTwoPage ? t('layout.tabBar.singlePageView', '单页视图') : t('layout.tabBar.twoPageView', '双页视图')}
            className={cn(
              'h-full px-3 flex items-center gap-1 text-xs text-vs-muted hover:text-white hover:bg-[#2a2d2e] cursor-pointer',
              activeTab.isTwoPage && 'text-blue-400'
            )}
          >
            <BookOpen size={13} />
            <span>{activeTab.isTwoPage ? t('layout.tabBar.singlePageView', '单页视图') : t('layout.tabBar.twoPageView', '双页视图')}</span>
          </button>
        )}
        <LanguageSwitcher />
        <div className="border-l border-vs-border" />
        <button
          onClick={handleDownloadPdf}
          disabled={!activeDocumentId}
          title={
            activeDocumentId
              ? t('layout.tabBar.downloadEnabled')
              : t('layout.tabBar.downloadDisabled')
          }
          className={cn(
            'h-full px-3 flex items-center gap-1 text-xs',
            activeDocumentId
              ? 'text-vs-muted hover:text-white hover:bg-[#2a2d2e] cursor-pointer'
              : 'text-vs-muted opacity-40 cursor-not-allowed',
          )}
        >
          <Download size={13} />
          <span>{t('layout.tabBar.downloadPdf')}</span>
        </button>
      </div>
    </div>
  );
}
