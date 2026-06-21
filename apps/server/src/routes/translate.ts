import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { openSSE } from '../lib/sse.js';
import { runTranslate } from '../graphs/translateGraph.js';

const Body = z.object({
  text: z.string().min(1).max(8000),
  direction: z.enum(['auto', 'zh2en', 'en2zh']).default('auto'),
});

export async function translateRoutes(app: FastifyInstance) {
  app.post('/translate', async (req, reply) => {
    const parsed = Body.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.flatten() });
    }
    const sse = openSSE(reply);
    try {
      for await (const evt of runTranslate(parsed.data)) {
        sse.send(evt);
      }
    } catch (e: any) {
      req.log.error(e);
      sse.error(e?.message ?? 'translate failed', e?.code ? { code: e.code } : undefined);
    } finally {
      sse.close();
    }
  });
}
