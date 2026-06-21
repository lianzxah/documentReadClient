import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Presentation, Download, Play, Loader2, AlertCircle, Pencil, PencilOff, Palette } from 'lucide-react';
import { useSlidevStore } from '../../store/slidevStore.js';
import { useTabsStore } from '../../store/tabsStore.js';
import { useUIStore } from '../../store/uiStore.js';
import { SlidevPreview } from './SlidevPreview.jsx';
import { SlidevPresenter } from './SlidevPresenter.jsx';
import { cn } from '../../lib/cn.js';

/**
 * Main panel for Slidev PPT generation. Shows generate button, streaming progress,
 * preview, present and download actions.
 */
export function SlidevPanel() {
  const { t } = useTranslation();
  const [presenting, setPresenting] = useState(false);
  const [isNarrow, setIsNarrow] = useState(false);
  const containerRef = useRef(null);
  
  const activeTab = useTabsStore((s) => s.tabs.find((tab) => tab.id === s.activeId));
  const documentId = activeTab?.documentId;

  const markdown = useSlidevStore((s) => s.markdown);
  const generating = useSlidevStore((s) => s.generating);
  const error = useSlidevStore((s) => s.error);
  const status = useSlidevStore((s) => s.status);
  const dirty = useSlidevStore((s) => s.dirty);
  const generate = useSlidevStore((s) => s.generate);
  const loadExisting = useSlidevStore((s) => s.loadExisting);
  const save = useSlidevStore((s) => s.save);
  const downloadUrl = useSlidevStore((s) => s.downloadUrl);
  const reset = useSlidevStore((s) => s.reset);
  const material = useSlidevStore((s) => s.material);

  const slidevEditMode = useUIStore((s) => s.slidevEditMode);
  const pptxEditMode = useUIStore((s) => s.pptxEditMode);
  const setSlidevEditMode = useUIStore((s) => s.setSlidevEditMode);
  const setPptxEditMode = useUIStore((s) => s.setPptxEditMode);

  // Load existing slides when document changes
  useEffect(() => {
    if (documentId) {
      loadExisting(documentId);
    } else {
      reset();
    }
  }, [documentId]);

  useEffect(() => {
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setIsNarrow(entry.contentRect.width < 460);
      }
    });
    
    if (containerRef.current) {
      observer.observe(containerRef.current);
    }
    
    return () => observer.disconnect();
  }, []);

  const handleGenerate = () => {
    if (!documentId) return;
    if (slidevEditMode && dirty) {
      const ok = window.confirm(t('slidev.panel.regenerateConfirmDirty'));
      if (!ok) return;
    } else if (dirty) {
      const ok = window.confirm(t('slidev.panel.regenerateConfirm'));
      if (!ok) return;
    }
    generate(documentId);
  };

  const handleEnterEdit = () => {
    if (!markdown || generating) return;
    setSlidevEditMode(true);
  };

  const handleExitEdit = async () => {
    if (dirty) {
      try {
        await save();
      } catch {
        // ignore - user can retry from the editor header
      }
    }
    setSlidevEditMode(false);
  };

  const handleDownload = () => {
    const url = downloadUrl();
    if (url) {
      window.open(url, '_blank');
    }
  };

  if (!documentId) {
    return (
      <div ref={containerRef} className="h-full flex items-center justify-center text-vs-muted text-sm">
        <div className="text-center">
          <Presentation size={32} className="mx-auto mb-2 opacity-50" />
          <p>{t('slidev.panel.openDocFirst')}</p>
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-vs-border bg-vs-sidebar">
        <span className="text-xs font-medium text-vs-foreground flex items-center gap-1.5 whitespace-nowrap overflow-hidden text-ellipsis">
          <Presentation size={14} className="flex-shrink-0" />
          <span className="truncate">{t('slidev.panel.title')}</span>
          {material && !isNarrow && (
            <span className="text-[10px] text-vs-muted font-normal ml-1 truncate">
              · {t('slidev.panel.slideCount', { count: material.slideCount })}
              {material.language ? ` · ${material.language}` : ''}
              {material.updatedAt
                ? ` · ${new Date(material.updatedAt).toLocaleString()}`
                : ''}
            </span>
          )}
        </span>
        <div className="flex items-center gap-1 flex-shrink-0 ml-2">
          {markdown && !generating && (
            <>
              {!slidevEditMode ? (
                <>
                  <button
                    onClick={handleEnterEdit}
                    className="flex items-center gap-1 px-2 py-1 text-xs rounded bg-vs-hover hover:bg-vs-border text-vs-foreground"
                    title={t('slidev.panel.edit')}
                  >
                    <Pencil size={12} />
                    {!isNarrow && t('slidev.panel.edit')}
                  </button>
                  <button
                    onClick={() => setPptxEditMode(!pptxEditMode)}
                    className="flex items-center gap-1 px-2 py-1 text-xs rounded bg-vs-hover hover:bg-vs-border text-vs-foreground"
                    title={pptxEditMode ? "Exit Visual" : "Visual Edit"}
                  >
                    <Palette size={12} />
                    {!isNarrow && (pptxEditMode ? "Exit Visual" : "Visual Edit")}
                  </button>
                </>
              ) : (
                <button
                  onClick={handleExitEdit}
                  className="flex items-center gap-1 px-2 py-1 text-xs rounded bg-vs-hover hover:bg-vs-border text-vs-foreground"
                  title={t('slidev.editor.exitEditTooltip')}
                >
                  <PencilOff size={12} />
                  {!isNarrow && t('slidev.panel.exitEdit')}
                </button>
              )}
              <button
                onClick={() => setPresenting(true)}
                className="flex items-center gap-1 px-2 py-1 text-xs rounded bg-blue-600 hover:bg-blue-700 text-white"
                title={t('slidev.panel.present')}
              >
                <Play size={12} />
                {!isNarrow && t('slidev.panel.present')}
              </button>
              <button
                onClick={handleDownload}
                className="flex items-center gap-1 px-2 py-1 text-xs rounded bg-vs-hover hover:bg-vs-border text-vs-foreground"
                title={t('slidev.panel.download')}
              >
                <Download size={12} />
                {!isNarrow && t('slidev.panel.download')}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Content area */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {!markdown && !generating && !error && (
          <div className="h-full flex flex-col items-center justify-center gap-3 px-4">
            <Presentation size={40} className="text-vs-muted opacity-40" />
            <p className="text-xs text-vs-muted text-center">
              {t('slidev.panel.intro')}
            </p>
            <button
              onClick={handleGenerate}
              className="flex items-center gap-2 px-4 py-2 text-sm rounded-md bg-blue-600 hover:bg-blue-700 text-white transition-colors"
            >
              <Presentation size={16} />
              {t('slidev.panel.generate')}
            </button>
          </div>
        )}

        {generating && !markdown && (
          <div className="h-full flex flex-col items-center justify-center gap-3">
            <Loader2 size={24} className="animate-spin text-blue-400" />
            <p className="text-xs text-vs-muted">{status || t('slidev.panel.statusFallback')}</p>
          </div>
        )}

        {error && (
          <div className="h-full flex flex-col items-center justify-center gap-3 px-4">
            <AlertCircle size={24} className="text-red-400" />
            <p className="text-xs text-red-400 text-center">{error}</p>
            <button
              onClick={handleGenerate}
              className="flex items-center gap-2 px-3 py-1.5 text-xs rounded bg-vs-hover hover:bg-vs-border text-vs-foreground"
            >
              {t('common.retry')}
            </button>
          </div>
        )}

        {markdown && (
          <SlidevPreview markdown={markdown} />
        )}

        {/* Streaming indicator at bottom */}
        {generating && markdown && (
          <div className="absolute bottom-0 left-0 right-0 flex items-center gap-2 px-3 py-1.5 bg-vs-sidebar/90 border-t border-vs-border">
            <Loader2 size={12} className="animate-spin text-blue-400" />
            <span className="text-xs text-vs-muted">{status || t('slidev.panel.statusFallback')}</span>
          </div>
        )}
      </div>

      {/* Regenerate button when slides exist */}
      {markdown && !generating && (
        <div className="px-3 py-2 border-t border-vs-border bg-vs-sidebar">
          <button
            onClick={handleGenerate}
            className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs rounded bg-vs-hover hover:bg-vs-border text-vs-foreground transition-colors"
          >
            <Presentation size={12} />
            {t('slidev.panel.regenerate')}
          </button>
        </div>
      )}

      {/* Presenter overlay */}
      {presenting && (
        <SlidevPresenter
          markdown={markdown}
          onClose={() => setPresenting(false)}
        />
      )}
    </div>
  );
}
