import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSessionsStore } from '../../store/sessionsStore.js';
import { useChatStore } from '../../store/chatStore.js';
import { useSkillsStore } from '../../store/skillsStore.js';
import { Plus, Trash2, MessageSquare, Pencil, Check, X } from 'lucide-react';
import { cn } from '../../lib/cn.js';
import i18n from '../../i18n/index.js';

function relativeTime(ts) {
  if (!ts) return '';
  const t = i18n.t.bind(i18n);
  const diff = Date.now() - ts;
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return t('common.relative.secondsAgo', { count: sec });
  const min = Math.floor(sec / 60);
  if (min < 60) return t('common.relative.minutesAgo', { count: min });
  const hr = Math.floor(min / 60);
  if (hr < 24) return t('common.relative.hoursAgo', { count: hr });
  const day = Math.floor(hr / 24);
  if (day < 7) return t('common.relative.daysAgo', { count: day });
  return new Date(ts).toLocaleDateString();
}

/**
 * Trae-style sidebar listing every chat session for the current document.
 * Clicking a session selects it; the parent ChatPanel rebinds to the new
 * sessionId and triggers `chatStore.hydrate`.
 */
export function SessionList({ documentId }) {
  const { t } = useTranslation();
  const list = useSessionsStore((s) => s.byDoc[documentId] ?? []);
  const currentId = useSessionsStore((s) => s.currentByDoc[documentId] ?? null);
  const create = useSessionsStore((s) => s.create);
  const select = useSessionsStore((s) => s.select);
  const remove = useSessionsStore((s) => s.remove);
  const rename = useSessionsStore((s) => s.rename);
  const forget = useChatStore((s) => s.forget);
  const skillItems = useSkillsStore((s) => s.items);

  const skillNameOf = (sid) => {
    if (!sid) return null;
    return skillItems.find((s) => s.id === sid)?.name ?? null;
  };

  const [editingId, setEditingId] = useState(null);
  const [draftTitle, setDraftTitle] = useState('');

  if (!documentId) return null;

  const startEdit = (session) => {
    setEditingId(session._id);
    setDraftTitle(session.title);
  };

  const commitEdit = async () => {
    const title = draftTitle.trim();
    if (title && editingId) {
      await rename(documentId, editingId, title);
    }
    setEditingId(null);
    setDraftTitle('');
  };

  const handleDelete = async (sessionId) => {
    if (!window.confirm(t('chat.sessions.deleteConfirm'))) return;
    const ok = await remove(documentId, sessionId);
    if (ok) forget(sessionId);
  };

  return (
    <div className="flex flex-col border-b border-vs-border bg-vs-sidebar">
      <div className="h-7 px-2 flex items-center text-[11px] uppercase tracking-wide text-vs-muted">
        <span>{t('chat.sessions.count', { count: list.length })}</span>
        <div className="flex-1" />
        <button
          title={t('chat.sessions.newSession')}
          onClick={() => create(documentId)}
          className="p-0.5 hover:bg-[#3c3c3c] rounded"
        >
          <Plus size={12} />
        </button>
      </div>
      <div className="max-h-40 overflow-y-auto">
        {list.length === 0 && (
          <div className="px-2 py-1.5 text-[11px] text-vs-muted">
            {t('chat.sessions.empty')}
          </div>
        )}
        {list.map((s) => {
          const editing = editingId === s._id;
          return (
            <div
              key={s._id}
              className={cn(
                'group flex items-center gap-1 px-2 py-1 cursor-pointer text-xs hover:bg-[#2a2d2e]',
                currentId === s._id && 'bg-vs-selection',
              )}
              onClick={() => !editing && select(documentId, s._id)}
            >
              <MessageSquare size={11} className="shrink-0 text-vs-muted" />
              {editing ? (
                <>
                  <input
                    autoFocus
                    value={draftTitle}
                    onChange={(e) => setDraftTitle(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        commitEdit();
                      } else if (e.key === 'Escape') {
                        setEditingId(null);
                      }
                    }}
                    onClick={(e) => e.stopPropagation()}
                    className="flex-1 bg-[#3c3c3c] border border-vs-accent rounded px-1 py-0.5 text-xs"
                  />
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      commitEdit();
                    }}
                    className="text-vs-muted hover:text-white"
                  >
                    <Check size={11} />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditingId(null);
                    }}
                    className="text-vs-muted hover:text-white"
                  >
                    <X size={11} />
                  </button>
                </>
              ) : (() => {
                  const skillName = skillNameOf(s.skillId);
                  return (
                    <>
                      <span className="flex-1 truncate" title={s.title}>
                        {s.title}
                      </span>
                      {skillName && (
                        <span
                          className="text-[9px] px-1 rounded bg-vs-accent/30 text-vs-muted shrink-0"
                          title={t('chat.sessions.skillBadge', { name: skillName })}
                        >
                          {skillName}
                        </span>
                      )}
                      <span className="text-[10px] text-vs-muted shrink-0">
                        {relativeTime(s.updatedAt)}
                      </span>
                      <button
                        title={t('chat.sessions.rename')}
                        onClick={(e) => {
                          e.stopPropagation();
                          startEdit(s);
                        }}
                        className="opacity-0 group-hover:opacity-100 text-vs-muted hover:text-white"
                      >
                        <Pencil size={11} />
                      </button>
                      <button
                        title={t('chat.sessions.delete')}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(s._id);
                        }}
                        className="opacity-0 group-hover:opacity-100 text-vs-muted hover:text-red-400"
                      >
                        <Trash2 size={11} />
                      </button>
                    </>
                  );
                })()}
            </div>
          );
        })}
      </div>
    </div>
  );
}
