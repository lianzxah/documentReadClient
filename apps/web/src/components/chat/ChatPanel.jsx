import { useRef, useState, useEffect, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useChatStore } from '../../store/chatStore.js';
import { useSessionsStore } from '../../store/sessionsStore.js';
import { useTabsStore } from '../../store/tabsStore.js';
import { useUIStore } from '../../store/uiStore.js';
import { streamSSE } from '../../lib/api.js';
import {
  Send,
  Trash2,
  StopCircle,
  Loader2,
  PanelBottom,
  PanelLeft,
  Sparkles,
} from 'lucide-react';
import { SessionList } from './SessionList.jsx';
import { ModelOverrideMenu } from './ModelOverrideMenu.jsx';
import { SkillSelector } from './SkillSelector.jsx';
import { ChatMarkdown } from './ChatMarkdown.jsx';
import { ChoiceList, parseChoiceContent } from './ChoiceList.jsx';
import { ToolCallList } from './ToolCallBadge.jsx';

export function ChatPanel({ viewerRef }) {
  const { t } = useTranslation();
  const active = useTabsStore((s) => s.tabs.find((tab) => tab.id === s.activeId));
  const documentId = active?.documentId;

  const chatPosition = useUIStore((s) => s.chatPosition);
  const toggleChatPosition = useUIStore((s) => s.toggleChatPosition);

  // Sessions
  const sessionId = useSessionsStore((s) =>
    documentId ? s.currentByDoc[documentId] ?? null : null,
  );
  const sessionRow = useSessionsStore((s) =>
    documentId
      ? (s.byDoc[documentId] ?? []).find((it) => it._id === sessionId) ?? null
      : null,
  );
  const ensureCurrent = useSessionsStore((s) => s.ensureCurrent);
  const touchAfterMessage = useSessionsStore((s) => s.touchAfterMessage);
  const setSessionSkills = useSessionsStore((s) => s.setSkills);

  // Per-session transcript
  const state = useChatStore((s) =>
    sessionId
      ? s.bySession[sessionId] ?? {
          messages: [],
          streaming: false,
          citations: [],
          hydrated: false,
        }
      : { messages: [], streaming: false, citations: [], hydrated: false },
  );
  const {
    hydrate,
    appendUserMessage,
    startAssistant,
    appendAssistantDelta,
    addCitation,
    endAssistant,
    setAbortController,
    abort,
    clear,
    setAssistantSkill,
    addToolCall,
    updateToolCall,
  } = useChatStore();

  const [input, setInput] = useState('');
  const listRef = useRef(null);
  const userScrolledRef = useRef(false);

  // Ensure a session exists whenever the active document changes.
  useEffect(() => {
    if (documentId) {
      void ensureCurrent(documentId);
    }
  }, [documentId, ensureCurrent]);

  // Hydrate transcript when the active session changes.
  useEffect(() => {
    if (sessionId) {
      void hydrate(sessionId);
    }
  }, [sessionId, hydrate]);

  // Auto-scroll only when user is already near the bottom (hasn't scrolled up).
  useEffect(() => {
    if (listRef.current && !userScrolledRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [state.messages]);

  const PositionToggle = (
    <button
      title={
        chatPosition === 'sidebar'
          ? t('chat.header.moveToBottom')
          : t('chat.header.dockToSide')
      }
      onClick={toggleChatPosition}
      className="p-1 hover:bg-[#3c3c3c] rounded"
    >
      {chatPosition === 'sidebar' ? <PanelBottom size={13} /> : <PanelLeft size={13} />}
    </button>
  );

  if (!documentId) {
    return (
      <div className="h-full flex flex-col bg-vs-panel">
        <div className="h-8 px-3 border-b border-vs-border flex items-center text-xs">
          <span className="uppercase tracking-wide text-vs-muted">{t('chat.header.title')}</span>
          <div className="flex-1" />
          {PositionToggle}
        </div>
        <div className="flex-1 flex items-center justify-center text-vs-muted text-sm px-3 text-center">
          {t('chat.empty.openPdfFirst')}
        </div>
      </div>
    );
  }

  /**
   * Submit `q` as a fresh user turn. Shared by the textarea Send button and
   * the in-message ChoiceList submit, so a clicked-choice answer follows the
   * same SSE streaming path as a typed message.
   */
  const submit = async (q) => {
    const text = (q || '').trim();
    if (!text || state.streaming || !sessionId) return;
    appendUserMessage(sessionId, text);
    startAssistant(sessionId);
    touchAfterMessage(documentId, sessionId, 1);

    const controller = new AbortController();
    setAbortController(controller);

    try {
      await streamSSE(
        '/chat',
        {
          sessionId,
          message: text,
          ...(sessionRow?.auxiliarySkillIds?.length
            ? { auxiliarySkillIds: sessionRow.auxiliarySkillIds }
            : {}),
        },
        (evt) => {
          if (evt.type === 'token') appendAssistantDelta(sessionId, evt.delta);
          else if (evt.type === 'citation') addCitation(sessionId, evt);
          else if (evt.type === 'skill')
            setAssistantSkill(sessionId, {
              id: evt.id,
              name: evt.name,
              builtin: evt.builtin,
            });
          else if (evt.type === 'tool_start')
            addToolCall(sessionId, { toolName: evt.toolName, serverId: evt.serverId, args: evt.args });
          else if (evt.type === 'tool_result')
            updateToolCall(sessionId, { toolName: evt.toolName, result: evt.result, latencyMs: evt.latencyMs });
          else if (evt.type === 'error')
            appendAssistantDelta(sessionId, `\n${t('chat.messages.errorPrefix', { message: evt.message })}`);
          else if (evt.type === 'done')
            touchAfterMessage(documentId, sessionId, 1);
        },
        controller.signal,
      );
    } catch (e) {
      if (e.name !== 'AbortError') {
        appendAssistantDelta(sessionId, `\n${t('chat.messages.errorPrefix', { message: e.message })}`);
      }
    } finally {
      endAssistant(sessionId);
    }
  };

  const send = async () => {
    const q = input.trim();
    if (!q || state.streaming || !sessionId) return;
    setInput('');
    await submit(q);
  };

  const jumpToPage = (page) => {
    viewerRef?.current?.scrollToPage?.(page);
  };

  // Render [p.N] citation chips inline by replacing with clickable spans.
  const renderAssistant = (text, { interactive, messageKey } = {}) => {
    // Multiple-choice prompts ("A) ... B) ...") are surfaced as selectable
    // cards on the latest assistant message only — older messages stay as
    // plain markdown so historical answers don't visually compete with new
    // ones.
    if (interactive) {
      const parsed = parseChoiceContent(text);
      if (parsed) {
        return (
          <ChoiceList
            key={`choice-${messageKey}`}
            segments={parsed.segments}
            disabled={state.streaming}
            onSubmit={(answer) => void submit(answer)}
          />
        );
      }
    }
    const parts = text.split(/(\[p\.\d+\])/g);
    return (
      <div className="prose prose-invert prose-sm max-w-none">
        {parts.map((part, i) => {
          const m = part.match(/^\[p\.(\d+)\]$/);
          if (m) {
            const page = Number(m[1]);
            return (
              <button
                key={i}
                onClick={() => jumpToPage(page)}
                className="inline-flex items-center mx-0.5 px-1.5 rounded bg-vs-accent/50 hover:bg-vs-accent text-white text-xs"
                title={t('chat.messages.jumpToPage', { page })}
              >
                p.{page}
              </button>
            );
          }
          return <ChatMarkdown key={i}>{part}</ChatMarkdown>;
        })}
      </div>
    );
  };

  // Index of the last assistant message — used to scope interactive widgets
  // (choice cards) to the most recent reply.
  const lastAssistantIdx = useMemo(() => {
    for (let i = state.messages.length - 1; i >= 0; i--) {
      if (state.messages[i].role === 'assistant') return i;
    }
    return -1;
  }, [state.messages]);

  return (
    <div className="h-full flex flex-col bg-vs-panel">
      <div className="h-8 px-3 border-b border-vs-border flex items-center gap-2 text-xs">
        <span className="uppercase tracking-wide text-vs-muted">{t('chat.header.title')}</span>
        <span className="text-vs-muted truncate">{active.title}</span>
        <div className="flex-1" />
        {PositionToggle}
        <button
          title={t('chat.header.clearSession')}
          onClick={() => sessionId && clear(sessionId)}
          className="p-1 hover:bg-[#3c3c3c] rounded"
        >
          <Trash2 size={13} />
        </button>
      </div>

      <SessionList documentId={documentId} />

      <div
        ref={listRef}
        className="flex-1 overflow-y-auto overflow-x-hidden px-3 py-2 space-y-3"
        onScroll={(e) => {
          const el = e.currentTarget;
          // Mark as "user scrolled away" when more than 80px from bottom.
          userScrolledRef.current = el.scrollHeight - el.scrollTop - el.clientHeight > 80;
        }}
      >
        {!sessionId && (
          <div className="text-vs-muted text-xs">{t('chat.header.preparingSession')}</div>
        )}
        {sessionId && state.messages.length === 0 && (
          <div className="text-vs-muted text-xs">
            {t('chat.empty.ready')}
          </div>
        )}
        {state.messages.map((m, i) => (
          <div key={i} className="text-sm">
            <div className={m.role === 'user' ? 'text-white' : 'text-vs-fg'}>
              <span className="text-xs text-vs-muted mr-2 uppercase">
                {m.role}
              </span>
              {m.role === 'assistant' && m.skill?.name && (
                <span
                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] bg-vs-accent/20 text-vs-muted mr-2"
                  title={t('chat.messages.answeredWithSkill', { name: m.skill.name })}
                >
                  <Sparkles size={9} /> {m.skill.name}
                </span>
              )}
              {m.role === 'assistant' ? (
                <>
                  {m.toolCalls && m.toolCalls.length > 0 && (
                    <ToolCallList toolCalls={m.toolCalls} />
                  )}
                  {renderAssistant(m.content || (state.streaming && !m.toolCalls?.some(tc => tc.status === 'running') ? '...' : ''), {
                    interactive: i === lastAssistantIdx && !state.streaming,
                    messageKey: i,
                  })}
                </>
              ) : (
                <span className="whitespace-pre-wrap">{m.content}</span>
              )}
            </div>
          </div>
        ))}
        {state.streaming && (
          <div className="text-vs-muted text-xs inline-flex items-center gap-2">
            <Loader2 size={12} className="animate-spin" /> {t('chat.composer.thinking')}
          </div>
        )}
        {state.citations.length > 0 && (
          <div className="pt-2 border-t border-vs-border">
            <div className="text-xs text-vs-muted mb-1">{t('chat.messages.sources')}</div>
            <div className="flex flex-wrap gap-1">
              {state.citations.map((c, i) => (
                <button
                  key={i}
                  onClick={() => jumpToPage(c.page)}
                  title={c.snippet}
                  className="text-xs px-2 py-0.5 rounded bg-[#3c3c3c] hover:bg-vs-accent"
                >
                  p.{c.page}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="border-t border-vs-border p-2 space-y-2">
        <div className="flex items-center justify-end gap-2">
          <SkillSelector
            value={{
              primaryId: sessionRow?.skillId ?? null,
              auxiliaryIds: sessionRow?.auxiliarySkillIds ?? [],
            }}
            onSelect={({ primaryId, auxiliaryIds }) => {
              if (!sessionId || !documentId) return;
              setSessionSkills(documentId, sessionId, { primaryId, auxiliaryIds });
            }}
            variant="session"
            disabled={!sessionId}
          />
          <ModelOverrideMenu documentId={documentId} />
        </div>
        <div className="flex gap-2">
          <textarea
            rows={2}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            placeholder={t('chat.composer.placeholder')}
            className="flex-1 resize-none bg-[#3c3c3c] border border-vs-border rounded px-2 py-1 text-sm focus:outline-none focus:border-vs-accent"
          />
          {state.streaming ? (
            <button
              onClick={abort}
              className="px-3 py-1.5 text-sm rounded bg-red-600/60 hover:bg-red-600 inline-flex items-center gap-1"
            >
              <StopCircle size={14} /> {t('chat.composer.stop')}
            </button>
          ) : (
            <button
              onClick={send}
              disabled={!input.trim() || !sessionId}
              className="px-3 py-1.5 text-sm rounded bg-vs-accent hover:bg-vs-accent-hover disabled:opacity-50 inline-flex items-center gap-1"
            >
              <Send size={14} /> {t('chat.composer.send')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
