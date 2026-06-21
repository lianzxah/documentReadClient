import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useUIStore } from '../../store/uiStore.js';
import { useTabsStore } from '../../store/tabsStore.js';
import { useDocumentsStore } from '../../store/documentsStore.js';
import { ingestDocument } from '../../lib/api.js';
import { Loader2, Link as LinkIcon } from 'lucide-react';

const SAMPLES = [];

export function OpenUrlDialog() {
  const { t } = useTranslation();
  const open = useUIStore((s) => s.urlDialogOpen);
  const setOpen = useUIStore((s) => s.setUrlDialogOpen);
  const openTab = useTabsStore((s) => s.openTab);
  const refreshDocuments = useDocumentsStore((s) => s.refresh);
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  if (!open) return null;

  const submit = async () => {
    const trimmed = url.trim();
    if (!trimmed) return;
    setError(null);
    setLoading(true);
    try {
      const doc = await ingestDocument(trimmed);
      openTab(doc);
      // Newly-ingested doc → refresh the side bar so it shows under "Recent"
      // even if the user later closes the tab.
      void refreshDocuments();
      setOpen(false);
      setUrl('');
    } catch (e) {
      setError(e.message || t('common.errorWithMessage', { message: 'unknown' }));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-28 bg-black/50">
      <div className="w-[560px] bg-[#252526] border border-vs-border rounded shadow-xl">
        <div className="px-4 py-3 border-b border-vs-border flex items-center gap-2">
          <LinkIcon size={14} />
          <span className="text-sm">{t('reader.openUrl.title')}</span>
        </div>
        <div className="p-4 space-y-3">
          <input
            autoFocus
            type="text"
            placeholder={t('reader.openUrl.placeholder')}
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') submit();
              if (e.key === 'Escape') setOpen(false);
            }}
            disabled={loading}
            className="w-full bg-[#3c3c3c] border border-vs-border rounded px-3 py-2 text-sm focus:outline-none focus:border-vs-accent"
          />
          {error && <div className="text-red-400 text-xs">{error}</div>}
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
        </div>
        <div className="px-4 py-3 border-t border-vs-border flex justify-end gap-2">
          <button
            onClick={() => setOpen(false)}
            className="px-3 py-1.5 text-sm rounded hover:bg-[#3c3c3c]"
            disabled={loading}
          >
            {t('common.cancel')}
          </button>
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
    </div>
  );
}
