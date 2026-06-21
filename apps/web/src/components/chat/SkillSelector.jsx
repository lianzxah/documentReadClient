import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { Sparkles, ChevronDown, Check, ToggleLeft, ToggleRight } from 'lucide-react';
import { useSkillsStore } from '../../store/skillsStore.js';
import { cn } from '../../lib/cn.js';

const DEFAULT_SKILL_ID = 'detailed-tutor';

/**
 * Skill picker supporting primary + auxiliary selection.
 *
 * Built-in skills: radio behavior (only one active as primary).
 * Custom skills: switch toggle behavior (multiple can be active as auxiliaries).
 *
 * Two variants:
 *   variant="session": shown in the chat header. Persists to the active session.
 *   variant="override": shown above the composer for one-shot override.
 *
 * Props:
 *   value: { primaryId?: string, auxiliaryIds?: string[] }
 *   onSelect: ({ primaryId, auxiliaryIds }) => void
 */
export function SkillSelector({
  value,
  onSelect,
  variant = 'session',
  fallbackId = DEFAULT_SKILL_ID,
  disabled = false,
}) {
  const { t } = useTranslation();
  const items = useSkillsStore((s) => s.items);
  const loaded = useSkillsStore((s) => s.loaded);
  const fetchSkills = useSkillsStore((s) => s.fetch);

  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState(null);
  const ref = useRef(null);
  const menuRef = useRef(null);
  const buttonRef = useRef(null);

  useEffect(() => {
    if (!loaded) fetchSkills();
  }, [loaded, fetchSkills]);

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

  useLayoutEffect(() => {
    if (!open) {
      setCoords(null);
      return;
    }
    const updatePosition = () => {
      const btn = buttonRef.current;
      if (!btn) return;
      const rect = btn.getBoundingClientRect();
      const MENU_ESTIMATE = 380;
      const MENU_WIDTH = 280;
      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;
      const placeAbove = spaceBelow < MENU_ESTIMATE && spaceAbove > spaceBelow;

      let left = undefined;
      let right = undefined;
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

  // Normalise value shape
  const primaryId = value?.primaryId ?? value?.skillId ?? fallbackId;
  const auxiliaryIds = value?.auxiliaryIds ?? [];

  const activePrimary = items.find((s) => s.id === primaryId);
  const auxCount = auxiliaryIds.length;
  const label = activePrimary?.name ?? (variant === 'override' ? t('chat.skill.useSession') : t('chat.skill.label'));

  const { builtins, userSkills } = useMemo(() => {
    const b = [];
    const u = [];
    for (const s of items) {
      (s.builtin ? b : u).push(s);
    }
    return { builtins: b, userSkills: u };
  }, [items]);

  const choosePrimary = (id) => {
    onSelect?.({ primaryId: id, auxiliaryIds });
  };

  const toggleAuxiliary = (id) => {
    const next = auxiliaryIds.includes(id)
      ? auxiliaryIds.filter((x) => x !== id)
      : [...auxiliaryIds, id];
    onSelect?.({ primaryId, auxiliaryIds: next });
  };

  const hasAux = auxCount > 0;

  return (
    <div ref={ref} className="relative">
      <button
        ref={buttonRef}
        onClick={() => !disabled && setOpen((v) => !v)}
        title={activePrimary?.description || t('chat.skill.label')}
        disabled={disabled}
        className={cn(
          'inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs disabled:opacity-50',
          variant === 'override'
            ? primaryId !== fallbackId || hasAux
              ? 'bg-amber-500/30 hover:bg-amber-500/50 text-white'
              : 'hover:bg-[#3c3c3c] text-vs-muted'
            : hasAux
              ? 'bg-purple-500/30 hover:bg-purple-500/50 text-white'
              : 'bg-vs-accent/30 hover:bg-vs-accent/50 text-white',
        )}
      >
        <Sparkles size={11} />
        <span className="max-w-[140px] truncate">{label}</span>
        {auxCount > 0 && (
          <span className="px-1 py-px rounded-full bg-purple-500/60 text-[9px] font-medium">
            +{auxCount}
          </span>
        )}
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
          className="z-50 w-72 rounded border border-vs-border bg-[#252526] shadow-lg text-xs flex flex-col overflow-hidden"
        >
          <div className="px-2 py-1 text-[10px] uppercase tracking-wide text-vs-muted border-b border-vs-border">
            {variant === 'override' ? t('chat.skill.overrideHeading') : t('chat.skill.sessionHeading')}
          </div>
          {variant === 'override' && (
            <button
              onClick={() => {
                onSelect?.({ primaryId: null, auxiliaryIds: [] });
                setOpen(false);
              }}
              className={cn(
                'w-full text-left px-2 py-1.5 hover:bg-[#2a2d2e] flex items-center gap-1',
                !primaryId && !hasAux && 'text-white',
              )}
            >
              {!primaryId && !hasAux ? <Check size={11} /> : <span className="w-[11px]" />}
              <span className="flex-1">{t('chat.skill.useSession')}</span>
            </button>
          )}
          <div className="flex-1 overflow-y-auto">
            {/* Built-in Skills: radio (primary selection) */}
            {builtins.length > 0 && (
              <div className="px-2 py-1 text-[10px] uppercase tracking-wide text-vs-muted">
                {t('chat.skill.builtinSection')}
              </div>
            )}
            {builtins.map((s) => (
              <button
                key={s.id}
                onClick={() => choosePrimary(s.id)}
                className={cn(
                  'w-full text-left px-2 py-1.5 hover:bg-[#2a2d2e] flex items-start gap-1',
                  primaryId === s.id && 'text-white',
                )}
                title={s.description}
              >
                {primaryId === s.id ? (
                  <Check size={11} className="mt-0.5 shrink-0" />
                ) : (
                  <span className="w-[11px] shrink-0" />
                )}
                <span className="flex-1 min-w-0">
                  <span className="block truncate">{s.name}</span>
                  <span className="block text-[10px] text-vs-muted truncate">
                    {s.description}
                  </span>
                </span>
              </button>
            ))}
            {/* Custom Skills: switch toggle (auxiliary multi-select) */}
            {userSkills.length > 0 && (
              <div className="px-2 py-1 text-[10px] uppercase tracking-wide text-vs-muted border-t border-vs-border mt-1">
                {t('chat.skill.customSection')}
                <span className="ml-1 normal-case">({t('chat.skill.auxiliaryHint')})</span>
              </div>
            )}
            {userSkills.map((s) => {
              const isAux = auxiliaryIds.includes(s.id);
              const isPrimary = primaryId === s.id;
              return (
                <div
                  key={s.id}
                  className={cn(
                    'w-full px-2 py-1.5 hover:bg-[#2a2d2e] flex items-center gap-2',
                    (isAux || isPrimary) && 'text-white',
                  )}
                  title={s.description}
                >
                  {/* Click name to set as primary */}
                  <button
                    onClick={() => choosePrimary(s.id)}
                    className="flex-1 min-w-0 text-left flex items-start gap-1"
                  >
                    {isPrimary ? (
                      <Check size={11} className="mt-0.5 shrink-0 text-vs-accent" />
                    ) : (
                      <span className="w-[11px] shrink-0" />
                    )}
                    <span className="flex-1 min-w-0">
                      <span className="block truncate">{s.name}</span>
                      <span className="block text-[10px] text-vs-muted truncate">
                        {s.description || t('chat.skill.customFallback')}
                      </span>
                    </span>
                  </button>
                  {/* Toggle switch for auxiliary */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleAuxiliary(s.id);
                    }}
                    className={cn(
                      'shrink-0 transition-colors',
                      isAux ? 'text-purple-400' : 'text-vs-muted hover:text-vs-fg',
                    )}
                    title={isAux ? t('chat.skill.disableAux') : t('chat.skill.enableAux')}
                  >
                    {isAux ? <ToggleRight size={18} /> : <ToggleLeft size={18} />}
                  </button>
                </div>
              );
            })}
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}
