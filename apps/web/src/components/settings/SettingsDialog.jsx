import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Bot,
  Boxes,
  CheckCircle2,
  Eye,
  EyeOff,
  Loader2,
  Plug,
  Save,
  Settings as SettingsIcon,
  Sparkles,
  X,
  XCircle,
  Zap,
} from 'lucide-react';
import { useUIStore } from '../../store/uiStore.js';
import { useSettingsStore } from '../../store/settingsStore.js';
import { cn } from '../../lib/cn.js';
import { SkillsManager } from './SkillsManager.jsx';
import { McpManager } from './McpManager.jsx';

/**
 * Settings dialog for the chat LLM and the text-embedding provider.
 *
 * Layout (per upgrade-lesson3.md):
 *   left rail   : category picker (LLM / Embedding)
 *   center pane : API base URL + masked API key + model fields
 *   right pane  : preset cards that pre-fill base URL + suggested models
 *
 * API key handling: the saved key is shown as `***last4` and read-only by
 * default. Click the eye button to start editing — the field clears so a
 * blank value sent on Save means "leave the existing key untouched".
 */

const CATEGORY_META = {
  chat: {
    labelKey: 'settings.tabs.chat.label',
    descriptionKey: 'settings.tabs.chat.description',
    Icon: Bot,
  },
  embedding: {
    labelKey: 'settings.tabs.embedding.label',
    descriptionKey: 'settings.tabs.embedding.description',
    Icon: Boxes,
  },
  skills: {
    labelKey: 'settings.tabs.skills.label',
    descriptionKey: 'settings.tabs.skills.description',
    Icon: Sparkles,
  },
  mcp: {
    labelKey: 'settings.tabs.mcp.label',
    descriptionKey: 'settings.tabs.mcp.description',
    Icon: Plug,
  },
};

function emptyDraft() {
  return { baseURL: '', model: '', apiKey: '', editingKey: false };
}

function draftFromSnapshot(snap) {
  return {
    baseURL: snap?.baseURL ?? '',
    model: snap?.model ?? '',
    apiKey: '',
    editingKey: false,
  };
}

export function SettingsDialog() {
  const { t } = useTranslation();
  const open = useUIStore((s) => s.settingsDialogOpen);
  const setOpen = useUIStore((s) => s.setSettingsDialogOpen);

  const loaded = useSettingsStore((s) => s.loaded);
  const loading = useSettingsStore((s) => s.loading);
  const saving = useSettingsStore((s) => s.saving);
  const chat = useSettingsStore((s) => s.chat);
  const embedding = useSettingsStore((s) => s.embedding);
  const presets = useSettingsStore((s) => s.presets);
  const fetchSettings = useSettingsStore((s) => s.fetchSettings);
  const saveSettings = useSettingsStore((s) => s.saveSettings);
  const testProvider = useSettingsStore((s) => s.testProvider);

  const [category, setCategory] = useState('chat');
  const [drafts, setDrafts] = useState({ chat: emptyDraft(), embedding: emptyDraft() });
  const [feedback, setFeedback] = useState(null); // { tone: 'ok'|'err', text }
  const [testing, setTesting] = useState(false);

  // Re-seed drafts every time the dialog opens.
  useEffect(() => {
    if (!open) return;
    if (!loaded) fetchSettings();
  }, [open, loaded, fetchSettings]);

  useEffect(() => {
    if (!open) return;
    setDrafts({
      chat: draftFromSnapshot(chat),
      embedding: draftFromSnapshot(embedding),
    });
    setFeedback(null);
  }, [open, chat, embedding]);

  const snapshot = category === 'chat' ? chat : category === 'embedding' ? embedding : null;
  const draft = drafts[category] ?? null;
  const categoryPresets = presets?.[category] ?? [];

  const activePresetId = useMemo(() => {
    if (!draft) return null;
    const preset = categoryPresets.find((p) => p.baseURL === draft.baseURL);
    return preset?.id ?? null;
  }, [categoryPresets, draft]);

  if (!open) return null;

  const updateDraft = (patch) => {
    setDrafts((d) => ({ ...d, [category]: { ...d[category], ...patch } }));
    setFeedback(null);
  };

  const applyPreset = (preset) => {
    updateDraft({
      baseURL: preset.baseURL,
      // Pick the first model only if the current one isn't in the preset list.
      model: preset.models.includes(draft.model) ? draft.model : preset.models[0] ?? '',
    });
  };

  /**
   * Build the JSON patch sent to PUT /settings.
   * apiKey rules: empty string -> stripped (kept), otherwise replace.
   */
  const buildPatch = (kind, d) => {
    const patch = {};
    if (d.baseURL && d.baseURL !== (kind === 'chat' ? chat.baseURL : embedding.baseURL)) {
      patch.baseURL = d.baseURL;
    }
    if (d.model && d.model !== (kind === 'chat' ? chat.model : embedding.model)) {
      patch.model = d.model;
    }
    if (d.editingKey && d.apiKey.trim()) {
      patch.apiKey = d.apiKey.trim();
    }
    return patch;
  };

  const handleSave = async () => {
    const patch = {};
    const cp = buildPatch('chat', drafts.chat);
    const ep = buildPatch('embedding', drafts.embedding);
    if (Object.keys(cp).length) patch.chat = cp;
    if (Object.keys(ep).length) patch.embedding = ep;
    if (!Object.keys(patch).length) {
      setFeedback({ tone: 'ok', text: t('settings.feedback.noChanges') });
      return;
    }
    const res = await saveSettings(patch);
    if (res.ok) {
      setFeedback({ tone: 'ok', text: t('settings.feedback.saved') });
    } else {
      setFeedback({ tone: 'err', text: res.error ?? t('settings.feedback.saveFailed') });
    }
  };

  const handleTest = async () => {
    setTesting(true);
    setFeedback(null);
    try {
      const draftPayload = {
        baseURL: draft.baseURL,
        model: draft.model,
      };
      if (draft.editingKey && draft.apiKey.trim()) {
        draftPayload.apiKey = draft.apiKey.trim();
      }
      const res = await testProvider(category, draftPayload);
      if (res.ok) {
        setFeedback({ tone: 'ok', text: t('settings.feedback.connectionOk', { ms: res.latencyMs }) });
      } else {
        setFeedback({ tone: 'err', text: res.error ?? t('settings.feedback.connectionFailed') });
      }
    } catch (e) {
      setFeedback({ tone: 'err', text: e?.message ?? t('settings.feedback.connectionFailed') });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 bg-black/50">
      <div className="w-[860px] max-w-[95vw] bg-[#252526] border border-vs-border rounded shadow-xl flex flex-col">
        <div className="px-4 py-3 border-b border-vs-border flex items-center gap-2">
          <SettingsIcon size={14} />
          <span className="text-sm">{t('settings.title')}</span>
          <div className="flex-1" />
          <button
            onClick={() => setOpen(false)}
            className="text-vs-muted hover:text-white"
            title={t('common.close')}
          >
            <X size={16} />
          </button>
        </div>

        <div className="flex min-h-[420px]">
          {/* Left rail: category picker */}
          <div className="w-44 border-r border-vs-border py-3">
            {Object.entries(CATEGORY_META).map(([id, meta]) => {
              const Icon = meta.Icon;
              const active = category === id;
              return (
                <button
                  key={id}
                  onClick={() => setCategory(id)}
                  className={cn(
                    'w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-[#2a2d2e]',
                    active && 'bg-[#37373d] text-white',
                  )}
                >
                  <Icon size={14} />
                  <span>{t(meta.labelKey)}</span>
                </button>
              );
            })}
          </div>

          {/* Center: form */}
          {category === 'skills' ? (
            <div className="flex-1 min-w-0">
              <SkillsManager />
            </div>
          ) : category === 'mcp' ? (
            <div className="flex-1 min-w-0">
              <McpManager />
            </div>
          ) : (
            <>
              <div className="flex-1 px-5 py-4 space-y-4 min-w-0">
            <div className="text-xs text-vs-muted">
              {t(CATEGORY_META[category].descriptionKey)}
            </div>

            <Field label={t('settings.fields.baseURL')}>
              <input
                type="text"
                value={draft.baseURL}
                onChange={(e) => updateDraft({ baseURL: e.target.value })}
                placeholder="https://api.example.com/v1"
                className="w-full bg-[#3c3c3c] border border-vs-border rounded px-3 py-2 text-sm focus:outline-none focus:border-vs-accent"
              />
            </Field>

            <Field label={t('settings.fields.apiKey')}>
              <ApiKeyInput
                draft={draft}
                snapshot={snapshot}
                onChange={(patch) => updateDraft(patch)}
              />
            </Field>

            <Field label={t('settings.fields.model')}>
              <input
                type="text"
                value={draft.model}
                onChange={(e) => updateDraft({ model: e.target.value })}
                placeholder="model-id"
                list={`presets-models-${category}`}
                className="w-full bg-[#3c3c3c] border border-vs-border rounded px-3 py-2 text-sm focus:outline-none focus:border-vs-accent"
              />
              <datalist id={`presets-models-${category}`}>
                {categoryPresets.flatMap((p) => p.models).map((m) => (
                  <option key={m} value={m} />
                ))}
              </datalist>
            </Field>

            {feedback && (
              <div
                className={cn(
                  'text-xs flex items-center gap-1',
                  feedback.tone === 'ok' ? 'text-green-400' : 'text-red-400',
                )}
              >
                {feedback.tone === 'ok' ? (
                  <CheckCircle2 size={12} />
                ) : (
                  <XCircle size={12} />
                )}
                <span>{feedback.text}</span>
              </div>
            )}
          </div>

          {/* Right: presets */}
          <div className="w-64 border-l border-vs-border py-3 overflow-y-auto max-h-[460px]">
            <div className="px-3 pb-2 text-xs uppercase tracking-wider text-vs-muted">
              {t('settings.presets.header')}
            </div>
            {loading && !categoryPresets.length && (
              <div className="px-3 text-xs text-vs-muted flex items-center gap-2">
                <Loader2 size={12} className="animate-spin" /> {t('common.loading')}
              </div>
            )}
            {categoryPresets.map((p) => {
              const active = p.id === activePresetId;
              return (
                <button
                  key={p.id}
                  onClick={() => applyPreset(p)}
                  className={cn(
                    'w-full text-left px-3 py-2 hover:bg-[#2a2d2e]',
                    active && 'bg-[#37373d]',
                  )}
                >
                  <div className="text-sm flex items-center gap-2">
                    <span>{p.label}</span>
                    {active && <CheckCircle2 size={12} className="text-vs-status" />}
                  </div>
                  <div className="text-[11px] text-vs-muted truncate">{p.baseURL}</div>
                  <div className="text-[11px] text-vs-muted truncate">
                    {p.models.slice(0, 2).join(', ')}
                    {p.models.length > 2 ? '...' : ''}
                  </div>
                </button>
              );
            })}
          </div>
            </>
          )}
        </div>

        <div className="px-4 py-3 border-t border-vs-border flex items-center gap-2">
          {category !== 'skills' && category !== 'mcp' && (
            <button
              onClick={handleTest}
              disabled={testing || !draft?.baseURL || !draft?.model}
              className="px-3 py-1.5 text-sm rounded border border-vs-border hover:bg-[#3c3c3c] disabled:opacity-50 inline-flex items-center gap-2"
            >
              {testing ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Zap size={14} />
              )}
              {t('settings.actions.test')}
            </button>
          )}
          <div className="flex-1" />
          <button
            onClick={() => setOpen(false)}
            className="px-3 py-1.5 text-sm rounded hover:bg-[#3c3c3c]"
            disabled={saving}
          >
            {category === 'skills' || category === 'mcp' ? t('common.close') : t('common.cancel')}
          </button>
          {category !== 'skills' && category !== 'mcp' && (
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-3 py-1.5 text-sm rounded bg-vs-accent hover:bg-vs-accent-hover disabled:opacity-50 inline-flex items-center gap-2"
            >
              {saving ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Save size={14} />
              )}
              {saving ? t('common.savingDots') : t('common.save')}
            </button>
          )}
        </div>
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

function ApiKeyInput({ draft, snapshot, onChange }) {
  const { t } = useTranslation();
  if (!draft.editingKey) {
    return (
      <div className="flex items-center gap-2">
        <input
          type="text"
          readOnly
          value={snapshot.hasKey ? snapshot.keyPreview : t('settings.apiKey.notSet')}
          className="flex-1 bg-[#2d2d2d] border border-vs-border rounded px-3 py-2 text-sm text-vs-muted"
        />
        <button
          type="button"
          onClick={() => onChange({ editingKey: true, apiKey: '' })}
          className="px-2 py-2 rounded border border-vs-border hover:bg-[#3c3c3c] text-xs inline-flex items-center gap-1"
          title={t('settings.apiKey.editTooltip')}
        >
          <Eye size={12} /> {t('settings.apiKey.edit')}
        </button>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-2">
      <input
        type="password"
        autoFocus
        value={draft.apiKey}
        onChange={(e) => onChange({ apiKey: e.target.value })}
        placeholder={snapshot.hasKey ? t('settings.apiKey.placeholderKeep') : t('settings.apiKey.placeholderNew')}
        className="flex-1 bg-[#3c3c3c] border border-vs-border rounded px-3 py-2 text-sm focus:outline-none focus:border-vs-accent"
      />
      <button
        type="button"
        onClick={() => onChange({ editingKey: false, apiKey: '' })}
        className="px-2 py-2 rounded border border-vs-border hover:bg-[#3c3c3c] text-xs inline-flex items-center gap-1"
        title={t('settings.apiKey.cancelEdit')}
      >
        <EyeOff size={12} /> {t('common.cancel')}
      </button>
    </div>
  );
}
