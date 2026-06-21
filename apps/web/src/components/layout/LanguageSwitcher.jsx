import { useEffect, useRef, useState } from 'react';
import { Check, Languages } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useUIStore } from '../../store/uiStore.js';
import { cn } from '../../lib/cn.js';

/**
 * Top-right TabBar control that lets the user switch the UI between English
 * and Simplified Chinese. The active language is stored in `useUIStore`
 * (persisted) and synced into i18next from `App.jsx`.
 *
 * Pattern follows the click-outside dropdown used by `SkillSelector` and
 * `ModelOverrideMenu`, so the visual language stays consistent.
 */
const OPTIONS = [
  { id: 'en', short: 'EN', longKey: 'languages.en' },
  { id: 'zh', short: '中', longKey: 'languages.zh' },
];

export function LanguageSwitcher() {
  const { t } = useTranslation();
  const language = useUIStore((s) => s.language);
  const setLanguage = useUIStore((s) => s.setLanguage);
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open]);

  const active = OPTIONS.find((o) => o.id === language) ?? OPTIONS[0];
  const choose = (id) => {
    setLanguage(id);
    setOpen(false);
  };

  return (
    <div ref={ref} className="relative h-full flex items-stretch">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        title={t('languages.switcher')}
        className={cn(
          'h-full px-3 flex items-center gap-1 text-xs',
          'text-vs-muted hover:text-white hover:bg-[#2a2d2e] cursor-pointer',
        )}
      >
        <Languages size={13} />
        <span>{active.short}</span>
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-0.5 z-30 min-w-[140px] bg-[#252526] border border-vs-border shadow-lg text-xs rounded">
          {OPTIONS.map((o) => {
            const isActive = o.id === language;
            return (
              <button
                key={o.id}
                type="button"
                onClick={() => choose(o.id)}
                className={cn(
                  'w-full text-left px-2 py-1.5 hover:bg-[#2a2d2e] flex items-center gap-2',
                  isActive && 'text-white',
                )}
              >
                {isActive ? <Check size={11} /> : <span className="w-[11px]" />}
                <span className="flex-1">{t(o.longKey)}</span>
                <span className="text-vs-muted">{o.short}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
