import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { getDocument } from '../services/pdfLoader.js';
import {
  getPublicOverrides,
  setOverrides,
} from '../services/documentOverrideStore.js';

const PutBody = z.object({
  chat: z
    .object({
      model: z.string().min(1).max(200).nullable().optional(),
    })
    .optional(),
  embedding: z
    .object({
      model: z.string().min(1).max(200).nullable().optional(),
    })
    .optional(),
});

export async function overridesRoutes(app: FastifyInstance) {
  /** GET /documents/:id/overrides — return the current per-doc model overrides. */
  app.get<{ Params: { id: string } }>(
    '/documents/:id/overrides',
    async (req, reply) => {
      const doc = await getDocument(req.params.id);
      if (!doc) return reply.code(404).send({ error: 'document not found' });
      return getPublicOverrides(req.params.id);
    },
  );

  /**
   * PUT /documents/:id/overrides — set/clear per-doc model overrides.
   * `model: null` clears that field; omitted keys keep their existing value.
   */
  app.put<{ Params: { id: string } }>(
    '/documents/:id/overrides',
    async (req, reply) => {
      const parsed = PutBody.safeParse(req.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: parsed.error.flatten() });
      }
      const doc = await getDocument(req.params.id);
      if (!doc) return reply.code(404).send({ error: 'document not found' });
      const next = await setOverrides(req.params.id, parsed.data);
      return next;
    },
  );
}
