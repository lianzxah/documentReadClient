import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useTranslateStore } from '../../store/translateStore.js';
import { streamSSE } from '../../lib/api.js';
import { ArrowLeftRight, Copy, Loader2, X, Languages } from 'lucide-react';

export function TranslatePopover() {
  const { t } = useTranslation();
  const {
    open,
    anchor,
    text,
    direction,
    result,
    detected,
    loading,
    setDirection,
    setLoading,
    setMeta,
    appendDelta,
    close,
  } = useTranslateStore();

  const labels = {
    auto: t('translate.auto'),
    zh2en: t('translate.zh2en'),
    en2zh: t('translate.en2zh'),
  };

  const ref = useRef(null);
  const abortRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e) => {
      if (ref.current && !ref.current.contains(e.target)) close();
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open, close]);

  useEffect(() => {
    if (!open || !text) return;
    // Auto-kick translation when the popover opens or direction changes.
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    // Reset result via appendDelta - start from '' by toggling via setDirection
    useTranslateStore.setState({ result: '' });

    streamSSE(
      '/translate',
      { text, direction },
      (evt) => {
        if (evt.type === 'meta') setMeta(evt.detected, evt.direction);
        else if (evt.type === 'token') appendDelta(evt.delta);
      },
      controller.signal,
    )
      .catch((e) => {
        if (e.name !== 'AbortError') {
          useTranslateStore.setState({ result: t('common.errorWithMessage', { message: e.message }) });
        }
      })
      .finally(() => setLoading(false));

    return () => controller.abort();
  }, [open, text, direction, setLoading, setMeta, appendDelta, t]);

  if (!open || !anchor) return null;

  const style = {
    left: Math.min(Math.max(anchor.x - 200, 8), window.innerWidth - 416),
    top: Math.min(anchor.y, window.innerHeight - 260),
  };

  const swapDirection = () => {
    if (direction === 'zh2en') setDirection('en2zh');
    else if (direction === 'en2zh') setDirection('zh2en');
    else setDirection(detected === 'zh' ? 'en2zh' : 'zh2en');
  };

  return (
    <div
      ref={ref}
      style={style}
      className="fixed z-40 w-[400px] max-h-[260px] bg-[#252526] border border-vs-border rounded shadow-2xl flex flex-col"
    >
      <div className="h-8 px-2 flex items-center gap-2 border-b border-vs-border text-xs">
        <Languages size={13} />
        <span className="text-vs-muted">{labels[direction]}</span>
        {detected && (
          <span className="text-vs-muted">{t('translate.detected', { lang: detected })}</span>
        )}
        <div className="flex-1" />
        <button
          title={t('translate.swap')}
          onClick={swapDirection}
          className="p-1 hover:bg-[#3c3c3c] rounded"
        >
          <ArrowLeftRight size={12} />
        </button>
        <button
          title={t('translate.copy')}
          onClick={() => navigator.clipboard?.writeText(result)}
          className="p-1 hover:bg-[#3c3c3c] rounded"
          disabled={!result}
        >
          <Copy size={12} />
        </button>
        <button
          title={t('translate.close')}
          onClick={close}
          className="p-1 hover:bg-[#3c3c3c] rounded"
        >
          <X size={12} />
        </button>
      </div>
      <div className="px-3 py-2 text-xs text-vs-muted max-h-16 overflow-y-auto border-b border-vs-border">
        {text}
      </div>
      <div className="p-3 text-sm flex-1 overflow-y-auto whitespace-pre-wrap">
        {loading && !result && (
          <span className="inline-flex items-center gap-2 text-vs-muted">
            <Loader2 size={13} className="animate-spin" /> {t('translate.translating')}
          </span>
        )}
        {result}
      </div>
    </div>
  );
}
