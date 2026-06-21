import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { Cpu, ChevronDown, Check } from 'lucide-react';
import { useSettingsStore } from '../../store/settingsStore.js';
import {
  getDocumentOverrides,
  setDocumentOverrides,
} from '../../lib/api.js';
import { cn } from '../../lib/cn.js';

/**
 * Per-document chat-model override menu. Shows the effective model:
 *   override (when set) — falls through to the global settings model otherwise.
 *
 * The list is sourced from the server's chat presets (DeepSeek, Qwen, OpenAI…),
 * so adding a new preset on the backend automatically lights it up here.
 *
 * Embedding model overrides are intentionally not exposed: switching the
 * embedding model post-ingest would invalidate the LanceDB index. The backend
 * stores any embedding override but only honours it during ingest.
 */
export function ModelOverrideMenu({ documentId }) {
  const { t } = useTranslation();
  const settingsLoaded = useSettingsStore((s) => s.loaded);
  const fetchSettings = useSettingsStore((s) => s.fetchSettings);
  const presets = useSettingsStore((s) => s.presets.chat);
  const globalChatModel = useSettingsStore((s) => s.chat.model);

  const [open, setOpen] = useState(false);
  const [override, setOverride] = useState(null); // string | null
  const [loading, setLoading] = useState(false);
  const [coords, setCoords] = useState(null);
  const ref = useRef(null);
  const menuRef = useRef(null);
  const buttonRef = useRef(null);

  useEffect(() => {
    if (!settingsLoaded) fetchSettings();
  }, [settingsLoaded, fetchSettings]);

  useEffect(() => {
    if (!documentId) {
      setOverride(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const o = await getDocumentOverrides(documentId);
        if (!cancelled) setOverride(o?.chat?.model ?? null);
      } catch {
        if (!cancelled) setOverride(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [documentId]);

  // Close on outside click.
  useEffect(() => {
    if (!open) return;
    const onDown = (e) => {
      const insideTrigger = ref.current && ref.current.contains(e.target);
      const insideMenu = menuRef.current && menuRef.current.contains(e.target);
      if (!insideTrigger && !insideMenu) setOpen(false);
    };
    window.addEventListener('mousedown', onDown);
    return () => window.removeEventListener('mousedown', onDown);
  }, [open]);

  // Position portal
  useLayoutEffect(() => {
    if (!open) {
      setCoords(null);
      return;
    }
    const updatePosition = () => {
      const btn = buttonRef.current;
      if (!btn) return;
      const rect = btn.getBoundingClientRect();
      const MENU_ESTIMATE = 320;
      const MENU_WIDTH = 224; // w-56 = 224px
      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;
      const placeAbove = spaceBelow < MENU_ESTIMATE && spaceAbove > spaceBelow;

      let left = undefined;
      let right = undefined;
      // If aligning right edges would push the menu off the left screen edge:
      if (rect.right < MENU_WIDTH) {
        left = Math.max(8, rect.left);
      } else {
        right = Math.max(8, window.innerWidth - rect.right);
      }

      setCoords({
        right,
        left,
        top: placeAbove ? undefined : rect.bottom + 4,
        bottom: placeAbove ? window.innerHeight - rect.top + 4 : undefined,
        maxHeight: Math.max(160, (placeAbove ? spaceAbove : spaceBelow) - 12),
      });
    };
    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [open]);

  const flatModels = (presets ?? []).flatMap((p) =>
    (p.models ?? []).map((m) => ({ provider: p.label, model: m })),
  );

  const apply = async (model) => {
    if (!documentId) return;
    setLoading(true);
    try {
      const next = await setDocumentOverrides(documentId, {
        chat: { model: model ?? null },
      });
      setOverride(next?.chat?.model ?? null);
      setOpen(false);
    } catch {
      // ignore - the menu stays open so the user can retry
    } finally {
      setLoading(false);
    }
  };

  const effective = override || globalChatModel || t('chatModel.noModel');

  return (
    <div ref={ref} className="relative">
      <button
        ref={buttonRef}
        onClick={() => setOpen((v) => !v)}
        title={
          override
            ? t('chatModel.perDocOverride', { model: override })
            : t('chatModel.usingGlobal', { model: globalChatModel || t('chatModel.globalUnset') })
        }
        className={cn(
          'inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs',
          override
            ? 'bg-vs-accent/40 hover:bg-vs-accent/60 text-white'
            : 'hover:bg-[#3c3c3c] text-vs-muted',
        )}
      >
        <Cpu size={11} />
        <span className="max-w-[120px] truncate">{effective}</span>
        <ChevronDown size={11} />
      </button>
      {open && coords && createPortal(
        <div
          ref={menuRef}
          style={{
            position: 'fixed',
            right: coords.right,
            left: coords.left,
            top: coords.top,
            bottom: coords.bottom,
            maxHeight: coords.maxHeight,
          }}
          className="z-50 w-56 rounded border border-vs-border bg-[#252526] shadow-lg text-xs flex flex-col overflow-hidden"
        >
          <div className="px-2 py-1 text-[10px] uppercase tracking-wide text-vs-muted border-b border-vs-border shrink-0">
            {t('chatModel.headerTitle')}
          </div>
          <button
            onClick={() => apply(null)}
            disabled={loading}
            className={cn(
              'w-full text-left px-2 py-1.5 hover:bg-[#2a2d2e] flex items-center gap-1 shrink-0',
              !override && 'text-white',
            )}
          >
            {!override ? <Check size={11} /> : <span className="w-[11px]" />}
            <span className="flex-1">
              {t('chatModel.useGlobal', { model: globalChatModel || 'unset' })}
            </span>
          </button>
          <div className="flex-1 overflow-y-auto">
            {flatModels.length === 0 && (
              <div className="px-2 py-1.5 text-vs-muted">
                {t('chatModel.noPresets')}
              </div>
            )}
            {flatModels.map(({ provider, model }) => (
              <button
                key={`${provider}:${model}`}
                onClick={() => apply(model)}
                disabled={loading}
                className={cn(
                  'w-full text-left px-2 py-1.5 hover:bg-[#2a2d2e] flex items-center gap-1',
                  override === model && 'text-white',
                )}
              >
                {override === model ? (
                  <Check size={11} />
                ) : (
                  <span className="w-[11px]" />
                )}
                <span className="flex-1 truncate">{model}</span>
                <span className="text-[10px] text-vs-muted">{provider}</span>
              </button>
            ))}
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}
