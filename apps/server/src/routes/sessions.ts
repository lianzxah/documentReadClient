import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import {
  clearMessages,
  createSession,
  deleteSession,
  getSession,
  listMessages,
  listSessions,
  renameSession,
  setSessionAuxiliarySkills,
  setSessionSkill,
} from '../services/chatSessionStore.js';
import { getDocument } from '../services/pdfLoader.js';

const CreateBody = z.object({
  documentId: z.string().min(1),
  title: z.string().max(200).optional(),
  skillId: z.string().min(1).max(120).optional(),
});

const PatchBody = z
  .object({
    title: z.string().min(1).max(200).optional(),
    skillId: z.string().min(1).max(120).optional(),
    auxiliarySkillIds: z.array(z.string().min(1).max(120)).max(10).optional(),
  })
  .refine(
    (b) =>
      b.title !== undefined ||
      b.skillId !== undefined ||
      b.auxiliarySkillIds !== undefined,
    {
      message: 'Provide title, skillId, or auxiliarySkillIds',
    },
  );

const ListQuery = z.object({
  documentId: z.string().min(1),
});

export async function sessionsRoutes(app: FastifyInstance) {
  /** Create a new chat session bound to a document. */
  app.post('/sessions', async (req, reply) => {
    const parsed = CreateBody.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.flatten() });
    }
    const { documentId, title, skillId } = parsed.data;

    const doc = await getDocument(documentId);
    if (!doc) {
      return reply.code(404).send({ error: 'document not found' });
    }
    const session = await createSession(documentId, { title, skillId });
    return session;
  });

  /** List all sessions for a document, newest first. */
  app.get('/sessions', async (req, reply) => {
    const parsed = ListQuery.safeParse(req.query);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.flatten() });
    }
    const items = await listSessions(parsed.data.documentId);
    return { items };
  });

  /** Fetch a session along with its full message transcript. */
  app.get<{ Params: { id: string } }>('/sessions/:id', async (req, reply) => {
    const session = await getSession(req.params.id);
    if (!session) return reply.code(404).send({ error: 'session not found' });
    const messages = await listMessages(req.params.id);
    return { session, messages };
  });

  /** Patch a session: rename and/or rebind its skill. */
  app.patch<{ Params: { id: string } }>(
    '/sessions/:id',
    async (req, reply) => {
      const parsed = PatchBody.safeParse(req.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: parsed.error.flatten() });
      }
      let session = await getSession(req.params.id);
      if (!session) return reply.code(404).send({ error: 'session not found' });
      if (parsed.data.title !== undefined) {
        session = await renameSession(req.params.id, parsed.data.title);
      }
      if (parsed.data.skillId !== undefined) {
        session = await setSessionSkill(req.params.id, parsed.data.skillId);
      }
      if (parsed.data.auxiliarySkillIds !== undefined) {
        session = await setSessionAuxiliarySkills(
          req.params.id,
          parsed.data.auxiliarySkillIds,
        );
      }
      if (!session) return reply.code(404).send({ error: 'session not found' });
      return session;
    },
  );

  /** Delete a session and cascade its messages. */
  app.delete<{ Params: { id: string } }>(
    '/sessions/:id',
    async (req) => {
      await deleteSession(req.params.id);
      return { ok: true };
    },
  );

  /** Clear messages for a session without deleting it. */
  app.delete<{ Params: { id: string } }>(
    '/sessions/:id/messages',
    async (req, reply) => {
      const session = await getSession(req.params.id);
      if (!session) return reply.code(404).send({ error: 'session not found' });
      await clearMessages(req.params.id);
      return { ok: true };
    },
  );
}
