import { nanoid } from 'nanoid';
import { getDb } from '../db/index.js';
import type {
  ChatCitation,
  ChatMessageRow,
  ChatRole,
  ChatSession,
} from '../db/schemas.js';
import { DEFAULT_SKILL_ID } from './skillRegistry.js';

const DEFAULT_TITLE = 'New session';
const TITLE_FROM_USER_LIMIT = 60;

function snippetFromContent(content: string): string {
  const trimmed = content.trim().replace(/\s+/g, ' ');
  if (!trimmed) return DEFAULT_TITLE;
  return trimmed.length > TITLE_FROM_USER_LIMIT
    ? `${trimmed.slice(0, TITLE_FROM_USER_LIMIT - 1)}…`
    : trimmed;
}

export async function listSessions(documentId: string): Promise<ChatSession[]> {
  const { sessions } = getDb();
  const rows = await sessions
    .findAsync<ChatSession>({ documentId })
    .sort({ updatedAt: -1 });
  return rows as ChatSession[];
}

export async function getSession(
  sessionId: string,
): Promise<ChatSession | null> {
  const { sessions } = getDb();
  const row = await sessions.findOneAsync<ChatSession>({ _id: sessionId });
  return (row as ChatSession) ?? null;
}

export async function createSession(
  documentId: string,
  opts: { title?: string; skillId?: string } = {},
): Promise<ChatSession> {
  const { sessions } = getDb();
  const now = Date.now();
  const session: ChatSession = {
    _id: nanoid(12),
    documentId,
    title: opts.title?.trim() || DEFAULT_TITLE,
    createdAt: now,
    updatedAt: now,
    messageCount: 0,
    skillId: opts.skillId?.trim() || DEFAULT_SKILL_ID,
  };
  await sessions.insertAsync(session);
  return session;
}

export async function renameSession(
  sessionId: string,
  title: string,
): Promise<ChatSession | null> {
  const { sessions } = getDb();
  const trimmed = title.trim();
  if (!trimmed) return getSession(sessionId);
  await sessions.updateAsync(
    { _id: sessionId },
    { $set: { title: trimmed, updatedAt: Date.now() } },
    {},
  );
  return getSession(sessionId);
}

/**
 * Update the per-session skill binding. Pass an empty string to fall back to
 * the built-in default at next chat turn.
 */
export async function setSessionSkill(
  sessionId: string,
  skillId: string,
): Promise<ChatSession | null> {
  const { sessions } = getDb();
  const trimmed = skillId.trim() || DEFAULT_SKILL_ID;
  await sessions.updateAsync(
    { _id: sessionId },
    { $set: { skillId: trimmed, updatedAt: Date.now() } },
    {},
  );
  return getSession(sessionId);
}

/**
 * Update the auxiliary (supplementary) skill IDs for a session. These are
 * custom user skills whose systemPrompts are appended as supplementary
 * instructions alongside the primary skill.
 */
export async function setSessionAuxiliarySkills(
  sessionId: string,
  auxiliarySkillIds: string[],
): Promise<ChatSession | null> {
  const { sessions } = getDb();
  // Deduplicate and filter empty strings
  const ids = [...new Set(auxiliarySkillIds.map((id) => id.trim()).filter(Boolean))];
  await sessions.updateAsync(
    { _id: sessionId },
    { $set: { auxiliarySkillIds: ids, updatedAt: Date.now() } },
    {},
  );
  return getSession(sessionId);
}

export async function deleteSession(sessionId: string): Promise<void> {
  const { sessions, messages } = getDb();
  await sessions.removeAsync({ _id: sessionId }, {});
  await messages.removeAsync({ sessionId }, { multi: true });
}

export async function clearMessages(sessionId: string): Promise<void> {
  const { messages, sessions } = getDb();
  await messages.removeAsync({ sessionId }, { multi: true });
  await sessions.updateAsync(
    { _id: sessionId },
    { $set: { messageCount: 0, updatedAt: Date.now() } },
    {},
  );
}

export async function listMessages(
  sessionId: string,
): Promise<ChatMessageRow[]> {
  const { messages } = getDb();
  const rows = await messages
    .findAsync<ChatMessageRow>({ sessionId })
    .sort({ seq: 1 });
  return rows as ChatMessageRow[];
}

export async function appendMessage(args: {
  sessionId: string;
  documentId: string;
  role: ChatRole;
  content: string;
  citations?: ChatCitation[];
}): Promise<ChatMessageRow> {
  const { messages, sessions } = getDb();
  const session = await getSession(args.sessionId);
  if (!session) throw new Error(`Session ${args.sessionId} not found`);

  const seq = session.messageCount; // 0-based ordering
  const row: ChatMessageRow = {
    _id: nanoid(14),
    sessionId: args.sessionId,
    documentId: args.documentId,
    role: args.role,
    content: args.content,
    citations: args.citations,
    seq,
    createdAt: Date.now(),
  };
  await messages.insertAsync(row);

  const titlePatch: Partial<ChatSession> = {};
  if (
    args.role === 'user' &&
    session.title === DEFAULT_TITLE &&
    args.content.trim()
  ) {
    titlePatch.title = snippetFromContent(args.content);
  }

  await sessions.updateAsync(
    { _id: args.sessionId },
    {
      $set: {
        ...titlePatch,
        updatedAt: Date.now(),
      },
      $inc: { messageCount: 1 },
    },
    {},
  );

  return row;
}
