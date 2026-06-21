import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Loader2,
  Plus,
  Save,
  Trash2,
  Wifi,
  WifiOff,
  Zap,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import { useMcpStore } from '../../store/mcpStore.js';
import { cn } from '../../lib/cn.js';

const EMPTY_DRAFT = {
  name: '',
  transport: 'stdio',
  command: '',
  args: '',
  url: '',
  enabled: true,
  env: [{ key: '', value: '' }],
};

/**
 * MCP Manager: configure MCP servers in the Settings dialog.
 * Left panel: list of servers with connection status.
 * Right panel: config form for add/edit.
 */
export function McpManager() {
  const { t } = useTranslation();
  const items = useMcpStore((s) => s.items);
  const loaded = useMcpStore((s) => s.loaded);
  const loading = useMcpStore((s) => s.loading);
  const fetchServers = useMcpStore((s) => s.fetch);
  const refresh = useMcpStore((s) => s.refresh);
  const create = useMcpStore((s) => s.create);
  const update = useMcpStore((s) => s.update);
  const remove = useMcpStore((s) => s.remove);
  const test = useMcpStore((s) => s.test);

  const [selectedId, setSelectedId] = useState(null);
  const [mode, setMode] = useState('view'); // 'view' | 'edit' | 'create'
  const [draft, setDraft] = useState(EMPTY_DRAFT);
  const [feedback, setFeedback] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loaded) fetchServers();
  }, [loaded, fetchServers]);

  const selected = items.find((s) => s._id === selectedId) ?? null;

  const startCreate = () => {
    setSelectedId(null);
    setDraft(EMPTY_DRAFT);
    setMode('create');
    setFeedback(null);
  };

  const startEdit = () => {
    if (!selected) return;
    setDraft({
      name: selected.name ?? '',
      transport: selected.transport ?? 'stdio',
      command: selected.command ?? '',
      args: (selected.args ?? []).join(' '),
      url: selected.url ?? '',
      enabled: selected.enabled ?? true,
      env: selected.env
        ? Object.entries(selected.env).map(([k, v]) => ({ key: k, value: v }))
        : [{ key: '', value: '' }],
    });
    setMode('edit');
    setFeedback(null);
  };

  const cancelEdit = () => {
    setMode('view');
    setDraft(EMPTY_DRAFT);
    setFeedback(null);
  };

  const parseEnv = (envArr) => {
    if (!Array.isArray(envArr)) return undefined;
    const env = {};
    for (const { key, value } of envArr) {
      const k = (key ?? '').trim();
      if (!k) continue;
      env[k] = value ?? '';
    }
    return Object.keys(env).length > 0 ? env : undefined;
  };

  const buildPayload = () => {
    const payload = {
      name: draft.name.trim(),
      transport: draft.transport,
      enabled: draft.enabled,
    };
    if (draft.transport === 'stdio') {
      payload.command = draft.command.trim();
      payload.args = draft.args.trim() ? draft.args.trim().split(/\s+/) : [];
    } else {
      payload.url = draft.url.trim();
    }
    const env = parseEnv(draft.env);
    if (env) payload.env = env;
    return payload;
  };

  const handleSave = async () => {
    if (!draft.name.trim()) {
      setFeedback({ tone: 'err', text: t('mcp.feedback.nameRequired') });
      return;
    }
    if (draft.transport === 'stdio' && !draft.command.trim()) {
      setFeedback({ tone: 'err', text: t('mcp.feedback.commandRequired') });
      return;
    }
    if (draft.transport === 'sse' && !draft.url.trim()) {
      setFeedback({ tone: 'err', text: t('mcp.feedback.urlRequired') });
      return;
    }
    setBusy(true);
    setFeedback(null);
    try {
      if (mode === 'create') {
        const created = await create(buildPayload());
        setSelectedId(created._id);
        setMode('view');
        setFeedback({ tone: 'ok', text: t('mcp.feedback.created') });
      } else if (mode === 'edit' && selectedId) {
        await update(selectedId, buildPayload());
        setMode('view');
        setFeedback({ tone: 'ok', text: t('mcp.feedback.updated') });
      }
    } catch (e) {
      setFeedback({ tone: 'err', text: e?.message ?? t('mcp.feedback.saveFailed') });
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedId) return;
    if (!window.confirm(t('mcp.deleteConfirm', { name: selected?.name }))) return;
    setBusy(true);
    try {
      await remove(selectedId);
      setSelectedId(null);
      setMode('view');
      setFeedback({ tone: 'ok', text: t('mcp.feedback.deleted') });
    } catch (e) {
      setFeedback({ tone: 'err', text: e?.message ?? t('mcp.feedback.deleteFailed') });
    } finally {
      setBusy(false);
    }
  };

  const handleTest = async () => {
    if (!selectedId) return;
    setBusy(true);
    setFeedback(null);
    try {
      const result = await test(selectedId);
      if (result.connected) {
        setFeedback({ tone: 'ok', text: t('mcp.feedback.testOk', { tools: result.toolCount, ms: result.latencyMs }) });
      } else {
        setFeedback({ tone: 'err', text: t('mcp.feedback.testFail', { error: result.error }) });
      }
    } catch (e) {
      setFeedback({ tone: 'err', text: e?.message ?? 'test failed' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex h-full min-h-[420px]">
      {/* Left: list */}
      <div className="w-56 border-r border-vs-border flex flex-col">
        <div className="px-3 py-2 flex items-center gap-2 border-b border-vs-border">
          <span className="text-xs uppercase tracking-wider text-vs-muted flex-1">
            {t('mcp.title')}
          </span>
          <button
            onClick={() => refresh()}
            title={t('common.refresh')}
            className="text-vs-muted hover:text-white text-[10px]"
          >
            {t('common.refresh').toLowerCase()}
          </button>
          <button
            onClick={startCreate}
            title={t('mcp.addServer')}
            className="text-vs-muted hover:text-white"
          >
            <Plus size={14} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {loading && !items.length && (
            <div className="px-3 py-2 text-xs text-vs-muted flex items-center gap-2">
              <Loader2 size={12} className="animate-spin" /> {t('common.loading')}
            </div>
          )}
          {items.length === 0 && !loading && (
            <div className="px-3 py-3 text-xs text-vs-muted">
              {t('mcp.empty')}
            </div>
          )}
          {items.map((s) => (
            <button
              key={s._id}
              onClick={() => { setSelectedId(s._id); setMode('view'); setFeedback(null); }}
              className={cn(
                'w-full text-left px-3 py-1.5 text-sm hover:bg-[#2a2d2e] flex items-start gap-2',
                selectedId === s._id && 'bg-[#37373d]',
              )}
            >
              {s.connected ? (
                <Wifi size={11} className="mt-0.5 shrink-0 text-green-400" />
              ) : (
                <WifiOff size={11} className="mt-0.5 shrink-0 text-vs-muted" />
              )}
              <span className="flex-1 min-w-0">
                <span className="block truncate">{s.name}</span>
                <span className="block text-[10px] text-vs-muted truncate">
                  {s.transport} {s.connected ? `· ${s.toolCount} tools` : s.connectionError ? `· ${s.connectionError}` : '· disabled'}
                </span>
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Right: detail / editor */}
      <div className="flex-1 px-5 py-4 overflow-y-auto min-w-0 space-y-3">
        {mode === 'view' && !selected && (
          <div className="text-xs text-vs-muted">{t('mcp.selectHint')}</div>
        )}
        {mode === 'view' && selected && (
          <div className="space-y-3">
            <div>
              <div className="text-sm flex items-center gap-2">
                {selected.name}
                {selected.connected ? (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-900/40 text-green-400">
                    {t('mcp.status.connected')}
                  </span>
                ) : (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-900/30 text-red-400">
                    {t('mcp.status.disconnected')}
                  </span>
                )}
              </div>
              <div className="text-xs text-vs-muted mt-1">
                {t('mcp.transport')}: {selected.transport}
                {selected.transport === 'stdio' && ` · ${selected.command} ${(selected.args ?? []).join(' ')}`}
                {selected.transport === 'sse' && ` · ${selected.url}`}
              </div>
              {selected.toolCount > 0 && (
                <div className="text-xs text-vs-muted mt-1">
                  {t('mcp.toolCount', { count: selected.toolCount })}
                </div>
              )}
            </div>
            <div className="flex gap-2 pt-2 border-t border-vs-border">
              <button
                onClick={startEdit}
                disabled={busy}
                className="px-3 py-1.5 text-sm rounded border border-vs-border hover:bg-[#3c3c3c] disabled:opacity-50"
              >
                {t('common.edit')}
              </button>
              <button
                onClick={handleTest}
                disabled={busy}
                className="px-3 py-1.5 text-sm rounded border border-vs-border hover:bg-[#3c3c3c] disabled:opacity-50 inline-flex items-center gap-1"
              >
                {busy ? <Loader2 size={12} className="animate-spin" /> : <Zap size={12} />}
                {t('mcp.testConnection')}
              </button>
              <button
                onClick={handleDelete}
                disabled={busy}
                className="px-3 py-1.5 text-sm rounded border border-red-700/40 text-red-300 hover:bg-red-900/30 disabled:opacity-50 inline-flex items-center gap-1"
              >
                <Trash2 size={12} /> {t('common.delete')}
              </button>
            </div>
          </div>
        )}
        {(mode === 'edit' || mode === 'create') && (
          <McpEditor
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

function McpEditor({ draft, setDraft, onSave, onCancel, busy, isCreate }) {
  const { t } = useTranslation();
  const upd = (patch) => setDraft((d) => ({ ...d, ...patch }));

  return (
    <div className="space-y-3">
      <div className="text-sm">
        {isCreate ? t('mcp.creating') : t('mcp.editing')}
      </div>
      <Field label={t('mcp.fields.name')}>
        <input
          type="text"
          value={draft.name}
          onChange={(e) => upd({ name: e.target.value })}
          maxLength={100}
          placeholder="My MCP Server"
          className="w-full bg-[#3c3c3c] border border-vs-border rounded px-3 py-1.5 text-sm focus:outline-none focus:border-vs-accent"
        />
      </Field>
      <Field label={t('mcp.fields.transport')}>
        <select
          value={draft.transport}
          onChange={(e) => upd({ transport: e.target.value })}
          className="w-full bg-[#3c3c3c] border border-vs-border rounded px-3 py-1.5 text-sm focus:outline-none focus:border-vs-accent"
        >
          <option value="stdio">stdio</option>
          <option value="sse">sse</option>
        </select>
      </Field>
      {draft.transport === 'stdio' && (
        <>
          <Field label={t('mcp.fields.command')}>
            <input
              type="text"
              value={draft.command}
              onChange={(e) => upd({ command: e.target.value })}
              placeholder="npx"
              className="w-full bg-[#3c3c3c] border border-vs-border rounded px-3 py-1.5 text-sm focus:outline-none focus:border-vs-accent"
            />
          </Field>
          <Field label={t('mcp.fields.args')}>
            <input
              type="text"
              value={draft.args}
              onChange={(e) => upd({ args: e.target.value })}
              placeholder="-y @modelcontextprotocol/server-weather"
              className="w-full bg-[#3c3c3c] border border-vs-border rounded px-3 py-1.5 text-sm focus:outline-none focus:border-vs-accent"
            />
            <div className="text-[10px] text-vs-muted mt-1">{t('mcp.fields.argsHint')}</div>
          </Field>
        </>
      )}
      {draft.transport === 'sse' && (
        <Field label={t('mcp.fields.url')}>
          <input
            type="text"
            value={draft.url}
            onChange={(e) => upd({ url: e.target.value })}
            placeholder="http://localhost:3001/sse"
            className="w-full bg-[#3c3c3c] border border-vs-border rounded px-3 py-1.5 text-sm focus:outline-none focus:border-vs-accent"
          />
        </Field>
      )}
      <EnvEditor env={draft.env} onChange={(env) => upd({ env })} />
      <Field label={t('mcp.fields.enabled')}>
        <label className="inline-flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={draft.enabled}
            onChange={(e) => upd({ enabled: e.target.checked })}
            className="rounded"
          />
          <span className="text-sm">{draft.enabled ? t('mcp.enabled') : t('mcp.disabled')}</span>
        </label>
      </Field>
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

function EnvEditor({ env, onChange }) {
  const { t } = useTranslation();
  const rows = Array.isArray(env) ? env : [{ key: '', value: '' }];

  const updateRow = (idx, field, val) => {
    const next = rows.map((r, i) => (i === idx ? { ...r, [field]: val } : r));
    onChange(next);
  };
  const addRow = () => onChange([...rows, { key: '', value: '' }]);
  const removeRow = (idx) => {
    const next = rows.filter((_, i) => i !== idx);
    onChange(next.length ? next : [{ key: '', value: '' }]);
  };

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <div className="text-xs text-vs-muted">{t('mcp.fields.env')}</div>
        <button
          type="button"
          onClick={addRow}
          className="text-vs-muted hover:text-white"
          title={t('mcp.fields.envAdd')}
        >
          <Plus size={12} />
        </button>
      </div>
      {rows.map((row, idx) => (
        <div key={idx} className="flex items-center gap-1">
          <input
            type="text"
            value={row.key}
            onChange={(e) => updateRow(idx, 'key', e.target.value)}
            placeholder="Key"
            className="flex-1 min-w-0 bg-[#3c3c3c] border border-vs-border rounded px-2 py-1 text-[12px] font-mono focus:outline-none focus:border-vs-accent"
          />
          <input
            type="text"
            value={row.value}
            onChange={(e) => updateRow(idx, 'value', e.target.value)}
            placeholder="Value"
            className="flex-[2] min-w-0 bg-[#3c3c3c] border border-vs-border rounded px-2 py-1 text-[12px] font-mono focus:outline-none focus:border-vs-accent"
          />
          <button
            type="button"
            onClick={() => removeRow(idx)}
            className="shrink-0 text-vs-muted hover:text-red-400 p-0.5"
            title={t('common.delete')}
          >
            <Trash2 size={11} />
          </button>
        </div>
      ))}
      <div className="text-[10px] text-vs-muted">{t('mcp.fields.envHint')}</div>
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
