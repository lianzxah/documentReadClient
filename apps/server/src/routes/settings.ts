import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { ChatOpenAI } from '@langchain/openai';
import { HumanMessage } from '@langchain/core/messages';
import {
  getPublicSettings,
  getSettings,
  resolveDraft,
  updateSettings,
  type ProviderKind,
} from '../services/settingsStore.js';
import {
  CHAT_PRESETS,
  EMBEDDING_PRESETS,
} from '../services/providerPresets.js';

/**
 * Patch shape: undefined fields are left unchanged. apiKey is special —
 * `null` clears it, an empty string is treated identically to undefined
 * (kept) so the frontend can safely round-trip the masked GET response.
 */
const ProviderPatch = z.object({
  baseURL: z.string().url().optional(),
  apiKey: z.string().nullable().optional(),
  model: z.string().min(1).optional(),
});

const UpdateBody = z.object({
  chat: ProviderPatch.optional(),
  embedding: ProviderPatch.optional(),
});

const TestBody = z.object({
  kind: z.enum(['chat', 'embedding']),
  draft: ProviderPatch.optional(),
});

export async function settingsRoutes(app: FastifyInstance) {
  app.get('/settings', async () => {
    const settings = await getPublicSettings();
    return {
      settings,
      presets: { chat: CHAT_PRESETS, embedding: EMBEDDING_PRESETS },
    };
  });

  app.put('/settings', async (req, reply) => {
    const parsed = UpdateBody.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.flatten() });
    }
    // Strip empty-string apiKey so it counts as "leave unchanged".
    const patch = parsed.data;
    if (patch.chat?.apiKey === '') delete patch.chat.apiKey;
    if (patch.embedding?.apiKey === '') delete patch.embedding.apiKey;
    const settings = await updateSettings(patch);
    return { settings };
  });

  /**
   * Probe a draft (or the saved) provider config without persisting. Returns
   * `{ ok, latencyMs }` on success or `{ ok: false, error }` so the dialog
   * can show a green/red badge before the user commits.
   */
  app.post('/settings/test', async (req, reply) => {
    const parsed = TestBody.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.flatten() });
    }
    const kind = parsed.data.kind as ProviderKind;
    const current = (await getSettings())[kind];
    const draft = parsed.data.draft ?? {};
    const merged = resolveDraft(
      kind,
      {
        baseURL: draft.baseURL,
        apiKey: draft.apiKey === null ? '' : draft.apiKey,
        model: draft.model,
      },
      current,
    );
    if (!merged.apiKey) {
      return { ok: false, error: 'API key is empty' };
    }
    const t0 = Date.now();
    try {
      if (kind === 'chat') {
        const llm = new ChatOpenAI({
          apiKey: merged.apiKey,
          model: merged.model,
          temperature: 0,
          streaming: false,
          maxTokens: 4,
          configuration: { baseURL: merged.baseURL },
        });
        await llm.invoke([new HumanMessage('ping')]);
      } else {
        const res = await fetch(`${merged.baseURL}/embeddings`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${merged.apiKey}`,
          },
          body: JSON.stringify({
            model: merged.model,
            input: ['ping'],
            encoding_format: 'float',
          }),
        });
        if (!res.ok) {
          const msg = await res.text().catch(() => '');
          return { ok: false, error: `${res.status} ${msg.slice(0, 200)}` };
        }
      }
      return { ok: true, latencyMs: Date.now() - t0 };
    } catch (e: any) {
      return { ok: false, error: e?.message ?? 'unknown error' };
    }
  });
}
