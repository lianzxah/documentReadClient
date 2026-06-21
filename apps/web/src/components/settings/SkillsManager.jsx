import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Loader2,
  Plus,
  Save,
  Sparkles,
  Trash2,
  Upload,
  XCircle,
  CheckCircle2,
} from 'lucide-react';
import { useSkillsStore } from '../../store/skillsStore.js';
import { cn } from '../../lib/cn.js';

const EMPTY_DRAFT = {
  name: '',
  description: '',
  systemPrompt: '',
  temperature: '',
  topK: '',
  maxTokens: '',
};

/**
 * Skills manager: list of every skill on the left, editor on the right.
 * Built-in skills are read-only (description + knobs are visible, prompt is
 * intentionally hidden because the curated prompt body is server-private).
 */
export function SkillsManager() {
  const { t } = useTranslation();
  const items = useSkillsStore((s) => s.items);
  const loaded = useSkillsStore((s) => s.loaded);
  const loading = useSkillsStore((s) => s.loading);
  const fetchSkills = useSkillsStore((s) => s.fetch);
  const refresh = useSkillsStore((s) => s.refresh);
  const getDetail = useSkillsStore((s) => s.getDetail);
  const create = useSkillsStore((s) => s.create);
  const update = useSkillsStore((s) => s.update);
  const remove = useSkillsStore((s) => s.remove);
  const importDraft = useSkillsStore((s) => s.importDraft);

  const [selectedId, setSelectedId] = useState(null);
  const [mode, setMode] = useState('view'); // 'view' | 'edit' | 'create'
  const [draft, setDraft] = useState(EMPTY_DRAFT);
  const [detail, setDetail] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const [busy, setBusy] = useState(false);
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (!loaded) fetchSkills();
  }, [loaded, fetchSkills]);

  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const d = await getDetail(selectedId);
        if (!cancelled) {
          setDetail(d);
          setMode('view');
        }
      } catch {
        if (!cancelled) setDetail(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedId, getDetail]);

  const selected = useMemo(
    () => items.find((s) => s.id === selectedId) ?? null,
    [items, selectedId],
  );

  const builtins = items.filter((s) => s.builtin);
  const userSkills = items.filter((s) => !s.builtin);

  const startCreate = () => {
    setSelectedId(null);
    setDetail(null);
    setDraft(EMPTY_DRAFT);
    setMode('create');
    setFeedback(null);
  };

  const startEdit = () => {
    if (!detail || selected?.builtin) return;
    setDraft({
      name: detail.name ?? '',
      description: detail.description ?? '',
      systemPrompt: detail.systemPrompt ?? '',
      temperature:
        detail.temperature !== undefined ? String(detail.temperature) : '',
      topK: detail.topK !== undefined ? String(detail.topK) : '',
      maxTokens:
        detail.maxTokens !== undefined ? String(detail.maxTokens) : '',
    });
    setMode('edit');
    setFeedback(null);
  };

  const cancelEdit = () => {
    setMode(selectedId ? 'view' : 'view');
    setDraft(EMPTY_DRAFT);
    setFeedback(null);
  };

  const buildPayload = () => {
    const payload = {
      name: draft.name.trim(),
      description: draft.description.trim() || undefined,
      systemPrompt: draft.systemPrompt.trim(),
    };
    if (draft.temperature.trim()) {
      const v = Number(draft.temperature);
      if (Number.isFinite(v)) payload.temperature = v;
    }
    if (draft.topK.trim()) {
      const v = parseInt(draft.topK, 10);
      if (Number.isInteger(v)) payload.topK = v;
    }
    if (draft.maxTokens.trim()) {
      const v = parseInt(draft.maxTokens, 10);
      if (Number.isInteger(v)) payload.maxTokens = v;
    }
    return payload;
  };

  const handleSave = async () => {
    if (!draft.name.trim() || !draft.systemPrompt.trim()) {
      setFeedback({ tone: 'err', text: t('skills.feedback.validation') });
      return;
    }
    setBusy(true);
    setFeedback(null);
    try {
      if (mode === 'create') {
        const created = await create(buildPayload());
        setSelectedId(created.id);
        setDetail(created);
        setMode('view');
        setFeedback({ tone: 'ok', text: t('skills.feedback.created') });
      } else if (mode === 'edit' && selectedId) {
        const updated = await update(selectedId, buildPayload());
        setDetail(updated);
        setMode('view');
        setFeedback({ tone: 'ok', text: t('skills.feedback.updated') });
      }
    } catch (e) {
      setFeedback({ tone: 'err', text: e?.message ?? t('skills.feedback.saveFailed') });
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedId || selected?.builtin) return;
    if (!window.confirm(t('skills.deleteConfirm', { name: selected?.name }))) return;
    setBusy(true);
    try {
      await remove(selectedId);
      setSelectedId(null);
      setDetail(null);
      setMode('view');
      setFeedback({ tone: 'ok', text: t('skills.feedback.deleted') });
    } catch (e) {
      setFeedback({ tone: 'err', text: e?.message ?? t('skills.feedback.deleteFailed') });
    } finally {
      setBusy(false);
    }
  };

  const triggerImport = () => {
    if (importing || busy) return;
    fileInputRef.current?.click();
  };

  const handleImportFile = async (event) => {
    const input = event.target;
    const file = input.files?.[0];
    // Reset the input value immediately so picking the same file twice still
    // fires `onChange` next time.
    input.value = '';
    if (!file) return;
    if (!/\.zip$/i.test(file.name)) {
      setFeedback({ tone: 'err', text: t('skills.import.invalidFile') });
      return;
    }
    setImporting(true);
    setFeedback(null);
    try {
      const { draft: incoming, sourceName } = await importDraft(file);
      // Hand the draft to the existing Editor (create mode). The user reviews
      // and clicks "Create" to persist via the regular POST /skills.
      setSelectedId(null);
      setDetail(null);
      setDraft({
        name: incoming?.name ?? '',
        description: incoming?.description ?? '',
        systemPrompt: incoming?.systemPrompt ?? '',
        temperature:
          incoming?.temperature !== undefined ? String(incoming.temperature) : '',
        topK: incoming?.topK !== undefined ? String(incoming.topK) : '',
        maxTokens:
          incoming?.maxTokens !== undefined ? String(incoming.maxTokens) : '',
      });
      setMode('create');
      setFeedback({
        tone: 'ok',
        text: t('skills.import.success', {
          name: sourceName ?? file.name,
        }),
      });
    } catch (e) {
      // 422 from the analyzer carries `raw` (the LLM's actual reply) — surface
      // it so the user sees what went wrong instead of a generic failure.
      const detail = e?.raw ? `${e.message}\n${e.raw}` : e?.message;
      setFeedback({
        tone: 'err',
        text: detail ?? t('skills.import.failed'),
      });
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="flex h-full min-h-[420px]">
      {/* Left: list */}
      <div className="w-56 border-r border-vs-border flex flex-col">
        <div className="px-3 py-2 flex items-center gap-2 border-b border-vs-border">
          <span className="text-xs uppercase tracking-wider text-vs-muted flex-1">
            {t('settings.tabs.skills.label')}
          </span>
          <button
            onClick={() => refresh()}
            title={t('common.refresh')}
            className="text-vs-muted hover:text-white text-[10px]"
          >
            {t('common.refresh').toLowerCase()}
          </button>
          <button
            onClick={triggerImport}
            title={t('skills.import.button')}
            disabled={importing || busy}
            className="text-vs-muted hover:text-white disabled:opacity-50 inline-flex items-center"
          >
            {importing ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Upload size={14} />
            )}
          </button>
          <button
            onClick={startCreate}
            title={t('skills.newCustom')}
            className="text-vs-muted hover:text-white"
          >
            <Plus size={14} />
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".zip,application/zip,application/x-zip-compressed"
            className="hidden"
            onChange={handleImportFile}
          />
        </div>
        <div className="flex-1 overflow-y-auto">
          {loading && !items.length && (
            <div className="px-3 py-2 text-xs text-vs-muted flex items-center gap-2">
              <Loader2 size={12} className="animate-spin" /> {t('common.loading')}
            </div>
          )}
          <div className="px-3 pt-2 pb-1 text-[10px] uppercase tracking-wider text-vs-muted">
            {t('skills.headerBuiltin')}
          </div>
          {builtins.map((s) => (
            <SkillRow
              key={s.id}
              skill={s}
              active={selectedId === s.id}
              onClick={() => setSelectedId(s.id)}
            />
          ))}
          <div className="px-3 pt-3 pb-1 text-[10px] uppercase tracking-wider text-vs-muted border-t border-vs-border mt-1">
            {t('skills.headerCustom')}
          </div>
          {userSkills.length === 0 && (
            <div className="px-3 py-1 text-[11px] text-vs-muted">
              {t('skills.emptyCustom')}
            </div>
          )}
          {userSkills.map((s) => (
            <SkillRow
              key={s.id}
              skill={s}
              active={selectedId === s.id}
              onClick={() => setSelectedId(s.id)}
            />
          ))}
        </div>
      </div>

      {/* Right: detail / editor */}
      <div className="flex-1 px-5 py-4 overflow-y-auto min-w-0 space-y-3">
        {mode === 'view' && !detail && !selectedId && (
          <div className="text-xs text-vs-muted">
            {t('skills.selectHint')}
          </div>
        )}
        {mode === 'view' && detail && (
          <DetailView
            detail={detail}
            isBuiltin={!!selected?.builtin}
            onEdit={startEdit}
            onDelete={handleDelete}
            busy={busy}
          />
        )}
        {(mode === 'edit' || mode === 'create') && (
          <Editor
            draft={draft}
            setDraft={setDraft}
            onSave={handleSave}
            onCancel={cancelEdit}
            busy={busy}
            isCreate={mode === 'create'}
          />
        )}
        {feedback && (
          <div
            className={cn(
              'text-xs flex items-start gap-1',
              feedback.tone === 'ok' ? 'text-green-400' : 'text-red-400',
            )}
          >
            {feedback.tone === 'ok' ? (
              <CheckCircle2 size={12} className="mt-0.5 shrink-0" />
            ) : (
              <XCircle size={12} className="mt-0.5 shrink-0" />
            )}
            <span className="whitespace-pre-wrap break-words">{feedback.text}</span>
          </div>
        )}
      </div>
    </div>
  );
}

function SkillRow({ skill, active, onClick }) {
  const { t } = useTranslation();
  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full text-left px-3 py-1.5 text-sm hover:bg-[#2a2d2e] flex items-start gap-2',
        active && 'bg-[#37373d]',
      )}
    >
      <Sparkles size={11} className="mt-0.5 shrink-0 text-vs-muted" />
      <span className="flex-1 min-w-0">
        <span className="block truncate">{skill.name}</span>
        <span className="block text-[10px] text-vs-muted truncate">
          {skill.description || (skill.builtin ? t('skills.headerBuiltin') : t('chat.skill.customFallback'))}
        </span>
      </span>
    </button>
  );
}

function DetailView({ detail, isBuiltin, onEdit, onDelete, busy }) {
  const { t } = useTranslation();
  return (
    <div className="space-y-3">
      <div>
        <div className="text-sm">{detail.name}</div>
        <div className="text-xs text-vs-muted">{detail.description || t('skills.noDescription')}</div>
      </div>
      <div className="grid grid-cols-3 gap-3 text-xs">
        <Stat label={t('skills.fields.temperatureShort')} value={detail.temperature ?? '—'} />
        <Stat label={t('skills.fields.topKShort')} value={detail.topK ?? '—'} />
        <Stat label={t('skills.fields.maxTokensShort')} value={detail.maxTokens ?? '—'} />
      </div>
      {!isBuiltin && (
        <div>
          <div className="text-xs text-vs-muted mb-1">{t('skills.fields.systemPrompt')}</div>
          <pre className="text-[11px] whitespace-pre-wrap bg-[#1e1e1e] border border-vs-border rounded p-2 max-h-72 overflow-y-auto">
            {detail.systemPrompt}
          </pre>
        </div>
      )}
      {isBuiltin && (
        <div className="text-[11px] text-vs-muted italic">
          {t('skills.builtinReadOnly')}
        </div>
      )}
      <div className="flex gap-2 pt-2 border-t border-vs-border">
        {!isBuiltin && (
          <>
            <button
              onClick={onEdit}
              disabled={busy}
              className="px-3 py-1.5 text-sm rounded border border-vs-border hover:bg-[#3c3c3c] disabled:opacity-50"
            >
              {t('common.edit')}
            </button>
            <button
              onClick={onDelete}
              disabled={busy}
              className="px-3 py-1.5 text-sm rounded border border-red-700/40 text-red-300 hover:bg-red-900/30 disabled:opacity-50 inline-flex items-center gap-1"
            >
              <Trash2 size={12} /> {t('common.delete')}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function Editor({ draft, setDraft, onSave, onCancel, busy, isCreate }) {
  const { t } = useTranslation();
  const update = (patch) => setDraft((d) => ({ ...d, ...patch }));
  return (
    <div className="space-y-3">
      <div className="text-sm">
        {isCreate ? t('skills.creating') : t('skills.editing')}
      </div>
      <Field label={t('skills.fields.name')}>
        <input
          type="text"
          value={draft.name}
          onChange={(e) => update({ name: e.target.value })}
          maxLength={80}
          placeholder={t('skills.fields.namePlaceholder')}
          className="w-full bg-[#3c3c3c] border border-vs-border rounded px-3 py-1.5 text-sm focus:outline-none focus:border-vs-accent"
        />
      </Field>
      <Field label={t('skills.fields.description')}>
        <input
          type="text"
          value={draft.description}
          onChange={(e) => update({ description: e.target.value })}
          maxLength={400}
          placeholder={t('skills.fields.descriptionPlaceholder')}
          className="w-full bg-[#3c3c3c] border border-vs-border rounded px-3 py-1.5 text-sm focus:outline-none focus:border-vs-accent"
        />
      </Field>
      <Field label={t('skills.fields.systemPrompt')}>
        <textarea
          value={draft.systemPrompt}
          onChange={(e) => update({ systemPrompt: e.target.value })}
          rows={10}
          placeholder={t('skills.fields.systemPromptPlaceholder')}
          className="w-full bg-[#3c3c3c] border border-vs-border rounded px-3 py-2 text-[12px] font-mono focus:outline-none focus:border-vs-accent"
        />
        <div className="text-[10px] text-vs-muted mt-1">
          {t('skills.fields.systemPromptHint')}
        </div>
      </Field>
      <div className="grid grid-cols-3 gap-3">
        <Field label={t('skills.fields.temperature')}>
          <input
            type="text"
            inputMode="decimal"
            value={draft.temperature}
            onChange={(e) => update({ temperature: e.target.value })}
            placeholder="0.4"
            className="w-full bg-[#3c3c3c] border border-vs-border rounded px-3 py-1.5 text-sm focus:outline-none focus:border-vs-accent"
          />
        </Field>
        <Field label={t('skills.fields.topK')}>
          <input
            type="text"
            inputMode="numeric"
            value={draft.topK}
            onChange={(e) => update({ topK: e.target.value })}
            placeholder="8"
            className="w-full bg-[#3c3c3c] border border-vs-border rounded px-3 py-1.5 text-sm focus:outline-none focus:border-vs-accent"
          />
        </Field>
        <Field label={t('skills.fields.maxTokens')}>
          <input
            type="text"
            inputMode="numeric"
            value={draft.maxTokens}
            onChange={(e) => update({ maxTokens: e.target.value })}
            placeholder="1500"
            className="w-full bg-[#3c3c3c] border border-vs-border rounded px-3 py-1.5 text-sm focus:outline-none focus:border-vs-accent"
          />
        </Field>
      </div>
      <div className="flex gap-2 pt-2 border-t border-vs-border">
        <button
          onClick={onSave}
          disabled={busy}
          className="px-3 py-1.5 text-sm rounded bg-vs-accent hover:bg-vs-accent-hover disabled:opacity-50 inline-flex items-center gap-2"
        >
          {busy ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
          {isCreate ? t('common.create') : t('common.save')}
        </button>
        <button
          onClick={onCancel}
          disabled={busy}
          className="px-3 py-1.5 text-sm rounded hover:bg-[#3c3c3c]"
        >
          {t('common.cancel')}
        </button>
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label className="block">
      <div className="text-xs text-vs-muted mb-1">{label}</div>
      {children}
    </label>
  );
}

function Stat({ label, value }) {
  return (
    <div className="bg-[#1e1e1e] border border-vs-border rounded px-2 py-1.5">
      <div className="text-[10px] uppercase tracking-wider text-vs-muted">
        {label}
      </div>
      <div className="text-sm">{String(value)}</div>
    </div>
  );
}
