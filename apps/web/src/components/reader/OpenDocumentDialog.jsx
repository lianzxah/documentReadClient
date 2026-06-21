import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useUIStore } from '../../store/uiStore.js';
import { useTabsStore } from '../../store/tabsStore.js';
import { useDocumentsStore } from '../../store/documentsStore.js';
import {
  ingestDocument,
  uploadLocalDocument,
  browseFilesystem,
  importLocalFile,
} from '../../lib/api.js';
import {
  Loader2,
  Link as LinkIcon,
  Upload,
  X,
  Folder,
  FileText,
  ChevronRight,
  ArrowUp,
  HardDrive,
} from 'lucide-react';
import { cn } from '../../lib/cn.js';

const SAMPLES = ['https://arxiv.org/pdf/2604.07823.pdf', 'https://arxiv.org/pdf/2504.14920.pdf'];

const MAX_MB = 200;
const MAX_BYTES = MAX_MB * 1024 * 1024;

function humanSize(bytes) {
  if (!bytes && bytes !== 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

// ─────────────────────────────── BrowseTab ──────────────────────────────────
// VSCode-like file browser: navigates the server filesystem via
// GET /api/filesystem/browse, with lazy-expanding tree nodes.

function BrowseTab({ onSuccess, onClose }) {
  const { t } = useTranslation();
  const [currentPath, setCurrentPath] = useState(null); // null = show roots
  const [parentPath, setParentPath] = useState(null);
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selected, setSelected] = useState(null); // { name, path }
  const [importing, setImporting] = useState(false);
  const [addressBar, setAddressBar] = useState('');
  const [editingAddress, setEditingAddress] = useState(false);
  const addressRef = useRef(null);

  const navigate = useCallback(async (dirPath) => {
    setLoading(true);
    setError(null);
    setSelected(null);
    try {
      const data = await browseFilesystem(dirPath || undefined);
      setCurrentPath(data.path ?? null);
      setParentPath(data.parent ?? null);
      setEntries(data.entries ?? []);
      setAddressBar(data.path || '/');
    } catch (e) {
      setError(e.message || 'Failed to browse');
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load: show roots
  useEffect(() => {
    void navigate(null);
  }, [navigate]);

  const handleOpen = async () => {
    if (!selected || importing) return;
    setImporting(true);
    setError(null);
    try {
      const doc = await importLocalFile(selected.path);
      onSuccess(doc);
      onClose();
    } catch (e) {
      setError(e.message || 'Import failed');
    } finally {
      setImporting(false);
    }
  };

  const handleAddressSubmit = (e) => {
    e.preventDefault();
    const trimmed = addressBar.trim();
    if (trimmed) {
      void navigate(trimmed);
    }
    setEditingAddress(false);
  };

  const breadcrumbs = currentPath
    ? currentPath.split('/').filter(Boolean)
    : [];

  return (
    <div className="flex flex-col" style={{ height: 380 }}>
      {/* Address bar */}
      <div className="px-3 py-2 border-b border-vs-border flex items-center gap-2 bg-[#1e1e1e]">
        <HardDrive size={13} className="text-vs-muted shrink-0" />
        {editingAddress ? (
          <form onSubmit={handleAddressSubmit} className="flex-1 flex">
            <input
              ref={addressRef}
              autoFocus
              className="flex-1 bg-[#3c3c3c] border border-vs-accent rounded px-2 py-0.5 text-xs focus:outline-none"
              value={addressBar}
              onChange={(e) => setAddressBar(e.target.value)}
              onBlur={() => setEditingAddress(false)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') setEditingAddress(false);
              }}
            />
          </form>
        ) : (
          <div
            className="flex-1 flex items-center gap-0.5 text-xs text-vs-muted overflow-hidden cursor-pointer hover:text-white"
            onClick={() => setEditingAddress(true)}
            title={t('reader.openDoc.browse.clickToEdit')}
          >
            {currentPath === null ? (
              <span className="text-vs-muted italic">
                {t('reader.openDoc.browse.roots')}
              </span>
            ) : (
              <>
                <button
                  onClick={(e) => { e.stopPropagation(); void navigate(null); }}
                  className="hover:text-vs-accent px-0.5"
                >
                  /
                </button>
                {breadcrumbs.map((seg, i) => {
                  const segPath = '/' + breadcrumbs.slice(0, i + 1).join('/');
                  return (
                    <span key={segPath} className="flex items-center">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          void navigate(segPath);
                        }}
                        className="hover:text-vs-accent hover:underline px-0.5 truncate max-w-[120px]"
                        title={segPath}
                      >
                        {seg}
                      </button>
                      {i < breadcrumbs.length - 1 && (
                        <ChevronRight size={10} className="text-vs-muted" />
                      )}
                    </span>
                  );
                })}
              </>
            )}
          </div>
        )}
        {parentPath && !editingAddress && (
          <button
            onClick={() => void navigate(parentPath)}
            className="text-vs-muted hover:text-white p-0.5"
            title={t('reader.openDoc.browse.goUp')}
          >
            <ArrowUp size={13} />
          </button>
        )}
      </div>

      {/* File tree */}
      <div className="flex-1 overflow-y-auto py-1 min-h-0">
        {loading && (
          <div className="flex items-center justify-center h-full text-vs-muted text-xs gap-2">
            <Loader2 size={14} className="animate-spin" />
            {t('common.loading')}
          </div>
        )}
        {!loading && error && (
          <div className="px-3 py-4 text-red-400 text-xs">{error}</div>
        )}
        {!loading && !error && entries.length === 0 && (
          <div className="px-3 py-4 text-xs text-vs-muted">
            {t('reader.openDoc.browse.empty')}
          </div>
        )}
        {!loading &&
          !error &&
          entries.map((entry) => {
            const fullPath = currentPath
              ? `${currentPath === '/' ? '' : currentPath}/${entry.name}`
              : entry.name; // root entries already have full path
            const isDir = entry.type === 'dir';
            const isSelected = selected?.path === fullPath;

            return (
              <div
                key={entry.name}
                className={cn(
                  'group flex items-center gap-1.5 px-3 py-[5px] cursor-pointer text-[13px] select-none',
                  isSelected
                    ? 'bg-vs-selection text-white'
                    : 'hover:bg-[#2a2d2e] text-vs-fg',
                )}
                onClick={() => {
                  if (isDir) {
                    void navigate(fullPath);
                  } else {
                    setSelected({ name: entry.name, path: fullPath });
                  }
                }}
                onDoubleClick={() => {
                  if (isDir) {
                    void navigate(fullPath);
                  } else {
                    setSelected({ name: entry.name, path: fullPath });
                    // Double-click on file triggers import immediately.
                    handleOpen();
                  }
                }}
                title={fullPath}
              >
                {isDir ? (
                  <>
                    <ChevronRight size={12} className="text-vs-muted shrink-0" />
                    <Folder size={14} className="text-amber-400/80 shrink-0" />
                  </>
                ) : (
                  <>
                    <span className="w-3 shrink-0" />
                    <FileText size={14} className="text-red-400/70 shrink-0" />
                  </>
                )}
                <span className="truncate flex-1">{entry.name}</span>
                {!isDir && entry.size != null && (
                  <span className="text-[10px] text-vs-muted shrink-0">
                    {humanSize(entry.size)}
                  </span>
                )}
              </div>
            );
          })}
      </div>

      {/* Footer: selected file + actions */}
      <div className="px-3 py-2 border-t border-vs-border flex items-center gap-2 bg-[#1e1e1e]">
        {selected ? (
          <div className="flex-1 text-xs text-vs-fg truncate" title={selected.path}>
            <FileText size={12} className="inline mr-1 text-red-400/70" />
            {selected.name}
          </div>
        ) : (
          <div className="flex-1 text-xs text-vs-muted">
            {t('reader.openDoc.browse.selectHint')}
          </div>
        )}
        <button
          onClick={handleOpen}
          disabled={!selected || importing}
          className="px-3 py-1.5 text-sm rounded bg-vs-accent hover:bg-vs-accent-hover disabled:opacity-50 inline-flex items-center gap-2 shrink-0"
        >
          {importing && <Loader2 size={14} className="animate-spin" />}
          {t('reader.openDoc.browse.open')}
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────── LocalTab ───────────────────────────────────

function LocalTab({ onSuccess, onClose }) {
  const { t } = useTranslation();
  const inputRef = useRef(null);
  const [file, setFile] = useState(null);
  const [progress, setProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const [dragActive, setDragActive] = useState(false);

  const reset = () => {
    setFile(null);
    setProgress(0);
    setError(null);
  };

  const onPick = (f) => {
    if (!f) return;
    if (f.size > MAX_BYTES) {
      setFile(null);
      setError(
        t('reader.openDoc.local.tooLarge', {
          size: humanSize(f.size),
          max: `${MAX_MB} MB`,
        }),
      );
      return;
    }
    setError(null);
    setFile(f);
    setProgress(0);
  };

  const upload = async () => {
    if (!file || uploading) return;
    setUploading(true);
    setError(null);
    setProgress(0);
    try {
      const doc = await uploadLocalDocument(file, {
        onProgress: ({ percent }) => setProgress(percent),
      });
      onSuccess(doc);
      onClose();
    } catch (e) {
      setError(e.message || t('common.errorWithMessage', { message: 'unknown' }));
    } finally {
      setUploading(false);
    }
  };

  const onDrop = (e) => {
    e.preventDefault();
    setDragActive(false);
    if (uploading) return;
    const f = e.dataTransfer.files?.[0];
    if (f) onPick(f);
  };

  return (
    <div className="p-4 space-y-3">
      <div
        onClick={() => !uploading && inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          if (!uploading) setDragActive(true);
        }}
        onDragLeave={() => setDragActive(false)}
        onDrop={onDrop}
        className={cn(
          'border-2 border-dashed rounded p-6 text-center text-xs transition-colors',
          uploading
            ? 'border-vs-border opacity-60 cursor-not-allowed'
            : 'cursor-pointer hover:bg-[#2a2a2a]',
          dragActive ? 'border-vs-accent bg-[#2a2a2a]' : 'border-vs-border',
        )}
      >
        <Upload size={20} className="mx-auto mb-2 text-vs-muted" />
        {file ? (
          <div className="space-y-1">
            <div className="text-vs-fg truncate" title={file.name}>
              {file.name}
            </div>
            <div className="text-vs-muted">{humanSize(file.size)}</div>
          </div>
        ) : (
          <div className="text-vs-muted">
            {t('reader.openDoc.local.dropHint')}
          </div>
        )}
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf,.pdf"
          className="hidden"
          onChange={(e) => onPick(e.target.files?.[0] ?? null)}
        />
      </div>

      <div className="text-[11px] text-vs-muted">
        {t('reader.openDoc.local.hint', { max: `${MAX_MB} MB` })}
      </div>

      {uploading && (
        <div>
          <div className="h-1.5 rounded bg-[#3c3c3c] overflow-hidden">
            <div
              className="h-full bg-vs-accent transition-[width]"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="mt-1 text-[11px] text-vs-muted">
            {t('reader.openDoc.local.uploading', { percent: progress })}
          </div>
        </div>
      )}

      {error && <div className="text-red-400 text-xs">{error}</div>}

      <div className="flex justify-end gap-2 pt-1">
        {file && !uploading && (
          <button
            onClick={reset}
            className="px-3 py-1.5 text-sm rounded hover:bg-[#3c3c3c] text-vs-muted"
          >
            {t('reader.openDoc.local.chooseAnother')}
          </button>
        )}
        <button
          onClick={upload}
          disabled={!file || uploading}
          className="px-3 py-1.5 text-sm rounded bg-vs-accent hover:bg-vs-accent-hover disabled:opacity-50 inline-flex items-center gap-2"
        >
          {uploading && <Loader2 size={14} className="animate-spin" />}
          {t('reader.openDoc.local.open')}
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────── UrlTab ─────────────────────────────────────

function UrlTab({ onSuccess, onClose }) {
  const { t } = useTranslation();
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const submit = async () => {
    const trimmed = url.trim();
    if (!trimmed) return;
    setError(null);
    setLoading(true);
    try {
      const doc = await ingestDocument(trimmed);
      onSuccess(doc);
      onClose();
    } catch (e) {
      setError(e.message || t('common.errorWithMessage', { message: 'unknown' }));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 space-y-3">
      <input
        autoFocus
        type="text"
        placeholder={t('reader.openUrl.placeholder')}
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') submit();
          if (e.key === 'Escape') onClose();
        }}
        disabled={loading}
        className="w-full bg-[#3c3c3c] border border-vs-border rounded px-3 py-2 text-sm focus:outline-none focus:border-vs-accent"
      />
      {error && <div className="text-red-400 text-xs">{error}</div>}
      {SAMPLES.length > 0 && (
        <div className="text-xs text-vs-muted">
          {t('reader.openUrl.samplesLabel')}
          <div className="mt-1 space-y-1">
            {SAMPLES.map((s) => (
              <button
                key={s}
                onClick={() => setUrl(s)}
                className="block text-left text-vs-accent-hover hover:underline"
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      )}
      <div className="flex justify-end gap-2 pt-1">
        <button
          onClick={submit}
          disabled={loading || !url.trim()}
          className="px-3 py-1.5 text-sm rounded bg-vs-accent hover:bg-vs-accent-hover disabled:opacity-50 inline-flex items-center gap-2"
        >
          {loading && <Loader2 size={14} className="animate-spin" />}
          {loading ? t('common.ingestingDots') : t('reader.openUrl.open')}
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────── OpenDocumentDialog ─────────────────────────────

/**
 * Lesson 8 (revised): three-tab dialog.
 * Tab 1: "Browse" — VSCode-like server filesystem browser (default).
 * Tab 2: "Upload" — drag-and-drop file upload.
 * Tab 3: "URL" — ingest from a remote URL.
 */
export function OpenDocumentDialog() {
  const { t } = useTranslation();
  const open = useUIStore((s) => s.urlDialogOpen);
  const setOpen = useUIStore((s) => s.setUrlDialogOpen);
  const openTab = useTabsStore((s) => s.openTab);
  const refreshDocuments = useDocumentsStore((s) => s.refresh);
  const [tab, setTab] = useState('url');

  if (!open) return null;

  const onSuccess = (doc) => {
    openTab(doc);
    void refreshDocuments();
  };
  const close = () => setOpen(false);

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-20 bg-black/50"
      onClick={close}
    >
      <div
        className="w-[620px] bg-[#252526] border border-vs-border rounded shadow-xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-4 py-3 border-b border-vs-border flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm">
            <LinkIcon size={14} />
            <span>{t('reader.openDoc.title')}</span>
          </div>
          <button
            onClick={close}
            className="text-vs-muted hover:text-white"
            title={t('common.close')}
          >
            <X size={14} />
          </button>
        </div>

        <div className="px-4 pt-2 border-b border-vs-border flex items-center gap-1 text-sm">
         <button
            onClick={() => setTab('url')}
            className={cn(
              'px-3 py-1.5 -mb-px border-b-2',
              tab === 'url'
                ? 'border-vs-accent text-white'
                : 'border-transparent text-vs-muted hover:text-white',
            )}
          >
            {t('reader.openDoc.tabs.url')}
          </button>
          <button
            onClick={() => setTab('browse')}
            className={cn(
              'px-3 py-1.5 -mb-px border-b-2',
              tab === 'browse'
                ? 'border-vs-accent text-white'
                : 'border-transparent text-vs-muted hover:text-white',
            )}
          >
            {t('reader.openDoc.tabs.browse')}
          </button>
          <button
            onClick={() => setTab('local')}
            className={cn(
              'px-3 py-1.5 -mb-px border-b-2',
              tab === 'local'
                ? 'border-vs-accent text-white'
                : 'border-transparent text-vs-muted hover:text-white',
            )}
          >
            {t('reader.openDoc.tabs.local')}
          </button>
        </div>

        {tab === 'browse' && <BrowseTab onSuccess={onSuccess} onClose={close} />}
        {tab === 'local' && <LocalTab onSuccess={onSuccess} onClose={close} />}
        {tab === 'url' && <UrlTab onSuccess={onSuccess} onClose={close} />}
      </div>
    </div>
  );
}
