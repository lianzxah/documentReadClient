import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import {
  BUILTIN_SKILLS,
  isBuiltinSkillId,
  type Skill,
} from '../services/skillRegistry.js';
import {
  createUserSkill,
  deleteUserSkill,
  getUserSkill,
  listUserSkills,
  updateUserSkill,
} from '../services/skillStore.js';
import {
  extractMarkdownFromZip,
  looksLikeZip,
} from '../services/skillImporter.js';
import {
  analyzeSkillDraft,
  SkillDraftError,
} from '../services/skillAnalyzer.js';

const SkillBody = z.object({
  name: z.string().min(1).max(80),
  description: z.string().max(400).optional(),
  systemPrompt: z.string().min(1).max(20_000),
  temperature: z.number().min(0).max(2).optional(),
  topK: z.number().int().min(1).max(30).optional(),
  maxTokens: z.number().int().min(50).max(8000).optional(),
});

export { SkillBody };

const SkillPatch = SkillBody.partial();

interface SkillSummary {
  id: string;
  name: string;
  description: string;
  builtin: boolean;
  temperature?: number;
  topK?: number;
  maxTokens?: number;
}

function summariseBuiltin(s: Skill): SkillSummary {
  return {
    id: s.id,
    name: s.name,
    description: s.description,
    builtin: true,
    temperature: s.temperature,
    topK: s.topK,
    maxTokens: s.maxTokens,
  };
}

export async function skillsRoutes(app: FastifyInstance) {
  /** List all skills (built-ins first, then user-defined by recency). */
  app.get('/skills', async () => {
    const userRows = await listUserSkills();
    const items: SkillSummary[] = [
      ...BUILTIN_SKILLS.map(summariseBuiltin),
      ...userRows.map((u) => ({
        id: u._id,
        name: u.name,
        description: u.description,
        builtin: false,
        temperature: u.temperature,
        topK: u.topK,
        maxTokens: u.maxTokens,
      })),
    ];
    return { items };
  });

  /**
   * Fetch a skill detail. Built-in `systemPrompt` is intentionally omitted to
   * keep the curated prompts opaque; user skills return everything so the
   * editor can round-trip them.
   */
  app.get<{ Params: { id: string } }>('/skills/:id', async (req, reply) => {
    const { id } = req.params;
    if (isBuiltinSkillId(id)) {
      const b = BUILTIN_SKILLS.find((s) => s.id === id)!;
      return {
        id: b.id,
        name: b.name,
        description: b.description,
        builtin: true,
        temperature: b.temperature,
        topK: b.topK,
        maxTokens: b.maxTokens,
      };
    }
    const u = await getUserSkill(id);
    if (!u) return reply.code(404).send({ error: 'skill not found' });
    return {
      id: u._id,
      name: u.name,
      description: u.description,
      builtin: false,
      systemPrompt: u.systemPrompt,
      temperature: u.temperature,
      topK: u.topK,
      maxTokens: u.maxTokens,
      createdAt: u.createdAt,
      updatedAt: u.updatedAt,
    };
  });

  app.post('/skills', async (req, reply) => {
    const parsed = SkillBody.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.flatten() });
    }
    try {
      const created = await createUserSkill(parsed.data);
      return {
        id: created._id,
        name: created.name,
        description: created.description,
        builtin: false,
        systemPrompt: created.systemPrompt,
        temperature: created.temperature,
        topK: created.topK,
        maxTokens: created.maxTokens,
        createdAt: created.createdAt,
        updatedAt: created.updatedAt,
      };
    } catch (e: any) {
      return reply.code(400).send({ error: e?.message ?? 'create failed' });
    }
  });

  app.put<{ Params: { id: string } }>('/skills/:id', async (req, reply) => {
    const { id } = req.params;
    if (isBuiltinSkillId(id)) {
      return reply.code(403).send({ error: 'built-in skills are read-only' });
    }
    const parsed = SkillPatch.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.flatten() });
    }
    const updated = await updateUserSkill(id, parsed.data);
    if (!updated) return reply.code(404).send({ error: 'skill not found' });
    return {
      id: updated._id,
      name: updated.name,
      description: updated.description,
      builtin: false,
      systemPrompt: updated.systemPrompt,
      temperature: updated.temperature,
      topK: updated.topK,
      maxTokens: updated.maxTokens,
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
    };
  });

  app.delete<{ Params: { id: string } }>('/skills/:id', async (req, reply) => {
    const { id } = req.params;
    if (isBuiltinSkillId(id)) {
      return reply.code(403).send({ error: 'built-in skills are read-only' });
    }
    const ok = await deleteUserSkill(id);
    if (!ok) return reply.code(404).send({ error: 'skill not found' });
    return { ok: true };
  });

  /**
   * Import a skill package (.zip): unpack the markdown bodies, ask the LLM to
   * propose a Skill schema, and return the draft for the frontend editor to
   * pre-fill. This endpoint NEVER persists — finalisation happens through the
   * existing POST /skills once the user reviews and clicks Create.
   */
  app.post('/skills/import', async (req, reply) => {
    if (!req.isMultipart()) {
      return reply
        .code(400)
        .send({ error: 'expected multipart/form-data with a "file" field' });
    }
    let upload;
    try {
      // Re-enforce the 5 MB skill-package cap here. Lesson 8 raised the
      // global multipart fileSize ceiling to MAX_LOCAL_PDF_MB; without this
      // per-call limit the ZIP route would inherit it.
      upload = await req.file({ limits: { fileSize: 5 * 1024 * 1024 } });
    } catch (e: any) {
      return reply.code(400).send({
        error: e?.message ?? 'failed to read upload',
      });
    }
    if (!upload) {
      return reply.code(400).send({ error: 'no file uploaded' });
    }

    let buf: Buffer;
    try {
      buf = await upload.toBuffer();
    } catch (e: any) {
      // @fastify/multipart throws a tagged error when fileSize is exceeded.
      if (e?.code === 'FST_REQ_FILE_TOO_LARGE') {
        return reply.code(413).send({ error: 'file too large (max 5 MB)' });
      }
      return reply.code(400).send({
        error: e?.message ?? 'failed to read upload',
      });
    }

    if (!looksLikeZip(buf)) {
      return reply
        .code(400)
        .send({ error: 'uploaded file is not a valid ZIP archive' });
    }

    let pkg;
    try {
      pkg = extractMarkdownFromZip(buf);
    } catch (e: any) {
      return reply.code(400).send({ error: e?.message ?? 'extraction failed' });
    }

    let draft;
    try {
      draft = await analyzeSkillDraft(pkg);
    } catch (e: any) {
      if (e instanceof SkillDraftError) {
        return reply.code(422).send({
          error: e.message,
          raw: e.raw,
          details: e.details,
        });
      }
      req.log.error({ err: e }, 'skill import failed');
      return reply
        .code(500)
        .send({ error: e?.message ?? 'skill analysis failed' });
    }

    return {
      draft,
      sourceName: upload.filename ?? null,
    };
  });
}
