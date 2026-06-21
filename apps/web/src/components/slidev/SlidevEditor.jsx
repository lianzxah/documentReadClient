import { useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { PanelGroup, Panel, PanelResizeHandle } from 'react-resizable-panels';
import { useKeyPress } from 'ahooks';
import {
  PanelRightOpen,
  PanelRightClose,
  Save,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Pencil,
} from 'lucide-react';
import { PdfViewer } from '../reader/PdfViewer.jsx';
import { ByteMDEditor } from './ByteMDEditor.jsx';
import { useSlidevStore } from '../../store/slidevStore.js';
import { useUIStore } from '../../store/uiStore.js';
import i18n from '../../i18n/index.js';

function formatRelative(ts) {
  if (!ts) return '';
  const t = i18n.t.bind(i18n);
  const diff = Math.max(0, Date.now() - ts);
  if (diff < 5_000) return t('slidev.editor.justNow');
  if (diff < 60_000) return t('common.relative.secondsAgo', { count: Math.floor(diff / 1000) });
  if (diff < 3_600_000) return t('common.relative.minutesAgo', { count: Math.floor(diff / 60_000) });
  return new Date(ts).toLocaleTimeString();
}

function SaveStatus({ dirty, saving, saveError, lastSavedAt, onRetry }) {
  const { t } = useTranslation();
  if (saving) {
    return (
      <span className="flex items-center gap-1 text-xs text-vs-muted">
        <Loader2 size={12} className="animate-spin" /> {t('slidev.editor.saving')}
      </span>
    );
  }
  if (saveError) {
    return (
      <span className="flex items-center gap-1 text-xs text-red-400">
        <AlertCircle size={12} />
        {t('slidev.editor.saveFailed', { error: saveError })}
        <button
          onClick={onRetry}
          className="ml-1 underline hover:text-red-300"
        >
          {t('common.retry')}
        </button>
      </span>
    );
  }
  if (dirty) {
    return (
      <span className="flex items-center gap-1 text-xs text-amber-400">
        <span className="w-1.5 h-1.5 rounded-full bg-amber-400" /> {t('slidev.editor.editing')}
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1 text-xs text-vs-muted">
      <CheckCircle2 size={12} className="text-emerald-400" />
      {t('slidev.editor.savedAt', { relative: formatRelative(lastSavedAt) })}
    </span>
  );
}

/**
 * 2-panel Slidev edit layout (the live Slidev preview already lives in the
 * outer SlidevPanel sidebar, so we don't duplicate it here):
 *   left  -> ByteMD markdown editor (debounced auto-save to backend)
 *   right -> PdfViewer reusing the same active tab; collapsible. Sized
 *            generously so the source PDF stays comfortably readable while
 *            authoring slides.
 */
export function SlidevEditor({ tab, viewerRef }) {
  const { t } = useTranslation();
  const markdown = useSlidevStore((s) => s.markdown);
  const dirty = useSlidevStore((s) => s.dirty);
  const saving = useSlidevStore((s) => s.saving);
  const saveError = useSlidevStore((s) => s.saveError);
  const lastSavedAt = useSlidevStore((s) => s.lastSavedAt);
  const setMarkdown = useSlidevStore((s) => s.setMarkdown);
  const save = useSlidevStore((s) => s.save);
  const cancelAutoSave = useSlidevStore((s) => s.cancelAutoSave);

  const pdfPaneVisible = useUIStore((s) => s.slidevPdfPaneVisible);
  const togglePdfPane = useUIStore((s) => s.toggleSlidevPdfPane);
  const setSlidevEditMode = useUIStore((s) => s.setSlidevEditMode);

  const dirtyRef = useRef(dirty);
  useEffect(() => {
    dirtyRef.current = dirty;
  }, [dirty]);

  // Manual save: Ctrl/Cmd+S forces an immediate flush.
  useKeyPress(['ctrl.s', 'meta.s'], (e) => {
    e.preventDefault();
    void save();
  });

  // On unmount, flush pending edits. If the tab is gone we still try a best-
  // effort sendBeacon as a last resort to avoid silent data loss.
  useEffect(() => {
    return () => {
      if (!dirtyRef.current) {
        cancelAutoSave();
        return;
      }
      try {
        const { documentId, markdown: md } = useSlidevStore.getState();
        if (documentId) {
          const blob = new Blob([JSON.stringify({ markdown: md })], {
            type: 'application/json',
          });
          // sendBeacon doesn't support PUT, so we use POST to the same path
          // and a server tolerant fallback isn't available; fall back to a
          // synchronous fetch keepalive request.
          fetch(`/api/slidev/${documentId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: blob,
            keepalive: true,
          }).catch(() => {});
        }
      } catch {
        // best-effort only
      }
      cancelAutoSave();
    };
  }, [cancelAutoSave]);

  const headerStatus = useMemo(
    () => ({ dirty, saving, saveError, lastSavedAt }),
    [dirty, saving, saveError, lastSavedAt],
  );

  return (
    <div className="h-full flex flex-col bg-vs-bg">
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-vs-border bg-vs-sidebar text-xs">
        <div className="flex items-center gap-2 min-w-0">
          <Pencil size={12} className="text-vs-muted shrink-0" />
          <span className="truncate text-vs-foreground">
            {t('slidev.editor.editingTab', { title: tab?.title || t('slidev.editor.untitled') })}
          </span>
          <SaveStatus {...headerStatus} onRetry={() => void save()} />
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => void save()}
            disabled={!dirty || saving}
            className="flex items-center gap-1 px-2 py-1 text-xs rounded bg-vs-hover hover:bg-vs-border disabled:opacity-40 text-vs-foreground"
            title={t('slidev.editor.saveTooltip')}
          >
            <Save size={12} />
            {t('slidev.editor.save')}
          </button>
          <button
            onClick={togglePdfPane}
            className="flex items-center gap-1 px-2 py-1 text-xs rounded bg-vs-hover hover:bg-vs-border text-vs-foreground"
            title={pdfPaneVisible ? t('slidev.editor.hidePdfTooltip') : t('slidev.editor.showPdfTooltip')}
          >
            {pdfPaneVisible ? <PanelRightClose size={12} /> : <PanelRightOpen size={12} />}
            {pdfPaneVisible ? t('slidev.editor.hidePdf') : t('slidev.editor.showPdf')}
          </button>
          <button
            onClick={() => {
              if (dirty) void save();
              setSlidevEditMode(false);
            }}
            className="flex items-center gap-1 px-2 py-1 text-xs rounded bg-vs-hover hover:bg-vs-border text-vs-foreground"
            title={t('slidev.editor.exitEditTooltip')}
          >
            {t('slidev.editor.exitEdit')}
          </button>
        </div>
      </div>

      <div className="flex-1 min-h-0">
        <PanelGroup direction="horizontal" autoSaveId="slidev-editor-layout-v2">
          <Panel defaultSize={pdfPaneVisible ? 50 : 100} minSize={25}>
            <div className="h-full overflow-auto">
              <ByteMDEditor value={markdown} onChange={setMarkdown} />
            </div>
          </Panel>
          {pdfPaneVisible && tab && (
            <>
              <PanelResizeHandle className="w-[3px] bg-vs-border hover:bg-vs-status transition-colors" />
              <Panel defaultSize={50} minSize={25}>
                {/*
                 * `data-bytemd-screenshot-target` is the contract used by
                 * ByteMDEditor's HTTP fallback: when `getDisplayMedia` is
                 * unavailable (insecure context / older browsers) the editor
                 * looks up this element and composites the PDF.js canvases
                 * inside it into a screenshot. Keep the attribute on the
                 * outer wrapper so the screenshot includes the full pane.
                 */}
                <div
                  className="h-full border-l border-vs-border overflow-hidden"
                  data-bytemd-screenshot-target="pdf-pane"
                >
                  <PdfViewer ref={viewerRef} tab={tab} key={tab.id} />
                </div>
              </Panel>
            </>
          )}
        </PanelGroup>
      </div>
    </div>
  );
}
