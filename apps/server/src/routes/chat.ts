import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { runChat } from '../graphs/ragGraph.js';
import { hasDocumentIndex } from '../services/vectorStore.js';
import { openSSE } from '../lib/sse.js';
import {
  appendMessage,
  getSession,
  listMessages,
} from '../services/chatSessionStore.js';
import type { ChatCitation } from '../db/schemas.js';
import type { ChatMessage } from '../types.js';

const Body = z.object({
  sessionId: z.string().min(1),
  message: z.string().min(1),
  topK: z.number().int().min(1).max(20).optional(),
  /** Per-message override of the session's default skill. */
  skillId: z.string().min(1).optional(),
  /** Per-message override of auxiliary skills. */
  auxiliarySkillIds: z.array(z.string().min(1)).max(10).optional(),
});

export async function chatRoutes(app: FastifyInstance) {
  app.post('/chat', async (req, reply) => {
    const parsed = Body.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.flatten() });
    }
    const { sessionId, message, topK, skillId, auxiliarySkillIds } = parsed.data;

    const session = await getSession(sessionId);
    if (!session) {
      return reply.code(404).send({ error: 'session not found' });
    }
    const indexed = await hasDocumentIndex(session.documentId);
    if (!indexed) {
      return reply
        .code(404)
        .send({ error: 'document not indexed; ingest it first' });
    }

    // Persist the new user message before generating so a refresh / disconnect
    // never loses the question. Citations + assistant text are persisted only
    // when the LLM stream completes (`done`). On error nothing partial leaks.
    await appendMessage({
      sessionId,
      documentId: session.documentId,
      role: 'user',
      content: message,
    });

    const history = await listMessages(sessionId);
    const messagesForGraph: ChatMessage[] = history.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    // Resolution order: per-message override > session default > built-in default.
    const effectiveSkillId = skillId ?? session.skillId ?? undefined;
    const effectiveAuxiliaryIds =
      auxiliarySkillIds ?? session.auxiliarySkillIds ?? undefined;

    const sse = openSSE(reply);
    let assistantText = '';
    const citations: ChatCitation[] = [];
    let finished = false;
    try {
      for await (const evt of runChat({
        documentId: session.documentId,
        messages: messagesForGraph,
        topK,
        skillId: effectiveSkillId,
        auxiliarySkillIds: effectiveAuxiliaryIds,
      })) {
        if (evt.type === 'token') {
          assistantText += evt.delta;
        } else if (evt.type === 'citation') {
          citations.push({
            page: evt.page,
            score: evt.score,
            snippet: evt.snippet,
          });
        } else if (evt.type === 'done') {
          finished = true;
        }
        sse.send(evt);
      }

      if (finished && assistantText) {
        await appendMessage({
          sessionId,
          documentId: session.documentId,
          role: 'assistant',
          content: assistantText,
          citations: citations.length ? citations : undefined,
        });
      }
    } catch (e: any) {
      req.log.error(e);
      sse.error(e?.message ?? 'chat failed', e?.code ? { code: e.code } : undefined);
    } finally {
      sse.close();
    }
  });
}
