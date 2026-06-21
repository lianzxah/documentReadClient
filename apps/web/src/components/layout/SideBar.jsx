import { Suspense, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useUIStore } from '../../store/uiStore.js';
import { useTabsStore } from '../../store/tabsStore.js';
import { useDocumentsStore } from '../../store/documentsStore.js';
import { useSessionsStore } from '../../store/sessionsStore.js';
import { FileText, Plus, X, Trash2, RefreshCw, Presentation, Cpu, Loader2, Sparkles, ChevronRight, ChevronDown, Bookmark } from 'lucide-react';
import { cn } from '../../lib/cn.js';
import { lazyNamed } from '../../lib/lazy.js';

// SlidevPanel pulls in markdown / mermaid renderers; ChatPanel pulls in
// the markdown chat renderer + RAG state. Both are loaded only when the
// user clicks their activity-bar entry.
const SlidevPanel = lazyNamed(() => import('../slidev/SlidevPanel.jsx'), 'SlidevPanel');
const ChatPanel = lazyNamed(() => import('../chat/ChatPanel.jsx'), 'ChatPanel');

function ExplorerView() {
  const { t } = useTranslation();
  const tabs = useTabsStore((s) => s.tabs);
  const activeId = useTabsStore((s) => s.activeId);
  const setActive = useTabsStore((s) => s.setActive);
  const closeTab = useTabsStore((s) => s.closeTab);
  const openTab = useTabsStore((s) => s.openTab);
  const setUrlDialogOpen = useUIStore((s) => s.setUrlDialogOpen);

  const items = useDocumentsStore((s) => s.items);
  const loading = useDocumentsStore((s) => s.loading);
  const refresh = useDocumentsStore((s) => s.refresh);
  const removeDoc = useDocumentsStore((s) => s.remove);
  const indexingMap = useDocumentsStore((s) => s.indexingMap);
  const triggerIndexing = useDocumentsStore((s) => s.triggerIndexing);
  const clearSessions = useSessionsStore((s) => s.clearDoc);

  // Initial fetch on mount + whenever the panel reopens.
  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Build a quick lookup of which documentIds are already open as tabs so we
  // can split the list into "Open" vs "Recent" sections.
  const openIds = new Set(tabs.map((tab) => tab.documentId));
  const closedItems = items.filter((d) => !openIds.has(d.documentId));

  const handleReopen = (doc) => {
    openTab({
      documentId: doc.documentId,
      url: doc.url,
      title: doc.title,
      pages: doc.pages,
    });
  };

  const handleDelete = async (doc) => {
    const ok = window.confirm(
      t('layout.sideBar.deleteConfirm', { title: doc.title }),
    );
    if (!ok) return;
    // Close the open tab first so the editor area unmounts before we drop the
    // PDF. Otherwise the viewer keeps fetching the (now-404) /pdf endpoint.
    const openTabRow = tabs.find((tab) => tab.documentId === doc.documentId);
    if (openTabRow) closeTab(openTabRow.id);
    const success = await removeDoc(doc.documentId);
    if (success) clearSessions(doc.documentId);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="h-9 px-3 flex items-center justify-between text-xs uppercase tracking-wide text-vs-muted border-b border-vs-border">
        <span>{t('layout.activityBar.documents')}</span>
        <div className="flex items-center gap-1">
          <button
            title={t('common.refresh')}
            onClick={() => refresh()}
            className={cn(
              'text-vs-muted hover:text-white',
              loading && 'animate-spin',
            )}
          >
            <RefreshCw size={12} />
          </button>
          <button
            title={t('layout.sideBar.openByUrlTooltip')}
            onClick={() => setUrlDialogOpen(true)}
            className="text-vs-muted hover:text-white"
          >
            <Plus size={14} />
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto py-1">
        {tabs.length === 0 && closedItems.length === 0 && (
          <div className="px-3 py-4 text-xs text-vs-muted">
            {t('layout.sideBar.noDocsLine1')}{' '}
            <span className="inline-flex align-middle"><Plus size={12} /></span>{' '}
            {t('layout.sideBar.noDocsLine2')}
          </div>
        )}

        {tabs.length > 0 && (
          <div>
            <div className="px-3 pt-1 pb-0.5 text-[10px] uppercase tracking-wide text-vs-muted">
              {t('layout.sideBar.open')}
            </div>
            {tabs.map((tab) => (
              <div
                key={tab.id}
                className={cn(
                  'group flex items-center gap-2 px-3 py-1 cursor-pointer text-sm hover:bg-[#2a2d2e]',
                  activeId === tab.id && 'bg-vs-selection',
                )}
                onClick={() => setActive(tab.id)}
                title={tab.url}
              >
                <FileText size={14} className="shrink-0 text-vs-muted" />
                <span className="truncate flex-1">{tab.title}</span>
                <button
                  className="opacity-0 group-hover:opacity-100 text-vs-muted hover:text-white"
                  onClick={(e) => {
                    e.stopPropagation();
                    closeTab(tab.id);
                  }}
                  title={t('common.close')}
                >
                  <X size={12} />
                </button>
              </div>
            ))}
          </div>
        )}

        {closedItems.length > 0 && (
          <div className="mt-2">
            <div className="px-3 pt-1 pb-0.5 text-[10px] uppercase tracking-wide text-vs-muted">
              {t('layout.sideBar.recent')}
            </div>
            {closedItems.map((d) => {
              const job = indexingMap[d.documentId];
              const isLocal = d.source === 'local';
              const showIndexPill = isLocal && d.indexed === false;
              const isIndexing = job?.status === 'running';
              const indexFailed = job?.status === 'error';
              return (
                <div
                  key={d.documentId}
                  className="group flex items-center gap-2 px-3 py-1 cursor-pointer text-sm hover:bg-[#2a2d2e]"
                  onClick={() => handleReopen(d)}
                  title={d.url || d.originalFilename || d.title}
                >
                  <FileText size={14} className="shrink-0 text-vs-muted" />
                  <span className="truncate flex-1">{d.title}</span>
                  <span
                    className={cn(
                      'text-[9px] uppercase px-1.5 py-px rounded border',
                      isLocal
                        ? 'border-vs-accent/40 text-vs-accent'
                        : 'border-vs-border text-vs-muted',
                    )}
                    title={isLocal ? d.originalFilename : d.url}
                  >
                    {isLocal
                      ? t('layout.sideBar.sourceLocal')
                      : t('layout.sideBar.sourceUrl')}
                  </span>
                  {showIndexPill && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (!isIndexing) void triggerIndexing(d.documentId);
                      }}
                      disabled={isIndexing}
                      className={cn(
                        'text-[9px] uppercase px-1.5 py-px rounded inline-flex items-center gap-1 border',
                        indexFailed
                          ? 'border-red-500/50 text-red-400 hover:bg-red-500/10'
                          : isIndexing
                          ? 'border-vs-accent/40 text-vs-muted cursor-wait'
                          : 'border-amber-500/50 text-amber-400 hover:bg-amber-500/10',
                      )}
                      title={
                        indexFailed
                          ? job?.error || t('reader.openDoc.index.failed')
                          : isIndexing
                          ? t('reader.openDoc.index.running', {
                              percent: job?.progress ?? 0,
                            })
                          : t('reader.openDoc.index.start')
                      }
                    >
                      {isIndexing ? (
                        <Loader2 size={9} className="animate-spin" />
                      ) : (
                        <Sparkles size={9} />
                      )}
                      {indexFailed
                        ? t('reader.openDoc.index.failed')
                        : isIndexing
                        ? `${job?.progress ?? 0}%`
                        : t('reader.openDoc.index.notIndexed')}
                    </button>
                  )}
                  {d.hasSlidev && (
                    <Presentation
                      size={11}
                      className="text-vs-muted"
                      title={t('slidev.panel.slideCount', { count: d.slidev?.slideCount ?? 0 })}
                    />
                  )}
                  {d.override && (
                    <Cpu
                      size={11}
                      className="text-vs-accent"
                      title={t('chatModel.headerTitle')}
                    />
                  )}
                  <button
                    className="opacity-0 group-hover:opacity-100 text-vs-muted hover:text-red-400"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(d);
                    }}
                    title={t('layout.sideBar.deleteDoc')}
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function PlaceholderView({ title, body }) {
  return (
    <div className="flex flex-col h-full">
      <div className="h-9 px-3 flex items-center text-xs uppercase tracking-wide text-vs-muted border-b border-vs-border">
        {title}
      </div>
      <div className="p-3 text-xs text-vs-muted">{body}</div>
    </div>
  );
}

function OutlineItem({ item, depth = 0, viewerRef }) {
  const [expanded, setExpanded] = useState(false);
  const hasChildren = item.items && item.items.length > 0;

  const handleClick = (e) => {
    e.stopPropagation();
    if (item.dest && viewerRef.current?.goToDestination) {
      viewerRef.current.goToDestination(item.dest);
    }
  };

  const toggleExpand = (e) => {
    e.stopPropagation();
    setExpanded(!expanded);
  };

  return (
    <div>
      <div 
        className="flex items-center gap-1 px-3 py-1 hover:bg-[#2a2d2e] cursor-pointer text-sm text-vs-muted hover:text-white group"
        style={{ paddingLeft: `${depth * 12 + 12}px` }}
        onClick={handleClick}
      >
        {hasChildren ? (
          <button onClick={toggleExpand} className="p-0.5 hover:bg-vs-selection rounded text-vs-muted">
            {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </button>
        ) : (
          <span className="w-[18px]" />
        )}
        <Bookmark size={14} className="shrink-0 text-vs-muted/70 group-hover:text-vs-muted" />
        <span className="truncate flex-1" style={{
          fontWeight: item.bold ? 'bold' : 'normal',
          fontStyle: item.italic ? 'italic' : 'normal',
        }} title={item.title}>{item.title}</span>
      </div>
      {expanded && hasChildren && (
        <div>
          {item.items.map((child, i) => (
            <OutlineItem key={i} item={child} depth={depth + 1} viewerRef={viewerRef} />
          ))}
        </div>
      )}
    </div>
  );
}

function OutlineView({ viewerRef }) {
  const { t } = useTranslation();
  const activeTab = useTabsStore((s) => s.getActive());

  if (!activeTab) {
    return <PlaceholderView title={t('layout.activityBar.outline')} body={t('layout.sideBar.outlineNoDoc')} />;
  }

  if (!activeTab.outline || activeTab.outline.length === 0) {
    return <PlaceholderView title={t('layout.activityBar.outline')} body={t('layout.sideBar.outlineEmpty')} />;
  }

  return (
    <div className="flex flex-col h-full">
      <div className="h-9 px-3 flex items-center justify-between text-xs uppercase tracking-wide text-vs-muted border-b border-vs-border shrink-0">
        <span>{t('layout.activityBar.outline')}</span>
      </div>
      <div className="flex-1 overflow-y-auto py-1">
        {activeTab.outline.map((item, i) => (
          <OutlineItem key={i} item={item} viewerRef={viewerRef} />
        ))}
      </div>
    </div>
  );
}

export function SideBar({ viewerRef }) {
  const { t } = useTranslation();
  const activity = useUIStore((s) => s.activity);
  const chatPosition = useUIStore((s) => s.chatPosition);
  return (
    <div className="h-full bg-vs-sidebar border-r border-vs-border overflow-hidden flex flex-col">
      {activity === 'explorer' && <ExplorerView />}
      {activity === 'outline' && <OutlineView viewerRef={viewerRef} />}
      {activity === 'chat' && (
        chatPosition === 'sidebar' ? (
          <Suspense fallback={null}>
            <ChatPanel viewerRef={viewerRef} />
          </Suspense>
        ) : (
          <PlaceholderView
            title={t('layout.sideBar.chatTitle')}
            body={t('layout.sideBar.chatPlaceholder')}
          />
        )
      )}
      {activity === 'translate' && (
        <PlaceholderView
          title={t('layout.sideBar.translateTitle')}
          body={t('layout.sideBar.translatePlaceholder')}
        />
      )}
      {activity === 'slidev' && (
        <Suspense fallback={null}>
          <SlidevPanel />
        </Suspense>
      )}
    </div>
  );
}
