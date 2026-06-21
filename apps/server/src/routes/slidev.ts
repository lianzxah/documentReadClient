import type { FastifyInstance } from 'fastify';
import fs from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import { openSSE } from '../lib/sse.js';
import { buildSlidevPresentation } from '../services/slidevBuilder.js';
import { hasDocumentIndex } from '../services/vectorStore.js';
import { getDocument } from '../services/pdfLoader.js';
import {
  countSlides,
  getMaterial,
  touchOnEdit,
  upsertOnGenerate,
} from '../services/slidevMaterialStore.js';
import { config } from '../config.js';

async function ensureSlidevDir() {
  await fs.mkdir(config.SLIDEV_DIR, { recursive: true });
}

function slidevPath(documentId: string) {
  return path.join(config.SLIDEV_DIR, `${documentId}.md`);
}

const GenerateBody = z.object({
  documentId: z.string().min(1),
  language: z.enum(['zh', 'en']).default('zh'),
  slideCount: z.number().int().min(3).max(30).optional(),
});

const UpdateBody = z.object({
  // Allow up to ~12MB of markdown so the ByteMDEditor screenshot feature, which
  // inlines base64 image data URLs, can be auto-saved without tripping the
  // schema. The Fastify body limit (`apps/server/src/index.ts`) is set above
  // this so the request reaches us with the validation error rather than a
  // generic 413.
  markdown: z.string().min(0).max(12_000_000),
});

export async function slidevRoutes(app: FastifyInstance) {
  /**
   * POST /slidev/generate - Stream-generate a Slidev presentation.
   * Orchestrates: RAG retrieval → Puppeteer screenshot capture → LLM generation.
   */
  app.post('/slidev/generate', async (req, reply) => {
    const parsed = GenerateBody.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.flatten() });
    }

    const { documentId, language, slideCount } = parsed.data;

    const indexed = await hasDocumentIndex(documentId);
    if (!indexed) {
      return reply
        .code(404)
        .send({ error: 'Document not indexed; ingest it first.' });
    }

    const sse = openSSE(reply);
    try {
      // Prefer the sanitized markdown emitted on `done` (fence-stripped,
      // trimmed). Fall back to the raw token stream only if the builder
      // terminates without a `done` event (e.g. early error).
      let streamedMarkdown = '';
      let finalMarkdown = '';
      for await (const evt of buildSlidevPresentation({ documentId, language, slideCount })) {
        if (evt.type === 'token') {
          streamedMarkdown += evt.delta;
        } else if (evt.type === 'done') {
          finalMarkdown = evt.markdown;
        }
        sse.send(evt);
      }

      // Cache the generated markdown file
      const toPersist = finalMarkdown || streamedMarkdown;
      if (toPersist) {
        await ensureSlidevDir();
        const filePath = slidevPath(documentId);
        await fs.writeFile(filePath, toPersist, 'utf8');

        // Index the material so the UI can list "last generated / slide count".
        const doc = await getDocument(documentId);
        await upsertOnGenerate({
          documentId,
          title: doc?.title,
          language,
          slideCount: countSlides(toPersist),
          generationParams: { language, slideCount },
          filePath: path.relative(config.SLIDEV_DIR, filePath),
        });
      }
    } catch (e: any) {
      req.log.error(e);
      sse.error(e?.message ?? 'slidev generation failed', e?.code ? { code: e.code } : undefined);
    } finally {
      sse.close();
    }
  });

  /**
   * GET /slidev/:documentId/assets/:filename - Serve screenshot images.
   * These are referenced from the generated Slidev markdown.
   */
  app.get<{ Params: { documentId: string; filename: string } }>(
    '/slidev/:documentId/assets/:filename',
    async (req, reply) => {
      const { documentId, filename } = req.params;

      // Sanitize filename to prevent path traversal
      const sanitized = path.basename(filename);
      const filePath = path.join(config.SCREENSHOTS_DIR, documentId, sanitized);

      try {
        await fs.access(filePath);
      } catch {
        return reply.code(404).send({ error: 'Asset not found.' });
      }

      const ext = path.extname(sanitized).toLowerCase();
      const contentType = ext === '.png' ? 'image/png' : ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' : 'application/octet-stream';

      reply.header('Content-Type', contentType);
      reply.header('Cache-Control', 'public, max-age=86400');

      const content = await fs.readFile(filePath);
      return reply.send(content);
    },
  );

  /**
   * GET /slidev/:documentId/download - Download the generated Slidev markdown.
   */
  app.get<{ Params: { documentId: string } }>(
    '/slidev/:documentId/download',
    async (req, reply) => {
      const { documentId } = req.params;
      const filePath = slidevPath(documentId);

      try {
        await fs.access(filePath);
      } catch {
        return reply.code(404).send({ error: 'No generated slides found for this document.' });
      }

      const doc = await getDocument(documentId);
      const title = doc?.title ?? documentId;
      const filename = `${title.replace(/[^a-zA-Z0-9\u4e00-\u9fff_-]/g, '_')}-slides.md`;

      reply.header('Content-Type', 'text/markdown; charset=utf-8');
      reply.header('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`);

      const content = await fs.readFile(filePath, 'utf8');
      return reply.send(content);
    },
  );

  /**
   * GET /slidev/:documentId - Check if slides exist and return them.
   * Also returns the NeDB material metadata row when available so the UI can
   * surface "last generated / slide count / generation params".
   */
  app.get<{ Params: { documentId: string } }>(
    '/slidev/:documentId',
    async (req, reply) => {
      const { documentId } = req.params;
      const filePath = slidevPath(documentId);

      try {
        await fs.access(filePath);
        const content = await fs.readFile(filePath, 'utf8');

        // Also check for available screenshots
        const screenshotDir = path.join(config.SCREENSHOTS_DIR, documentId);
        let screenshots: string[] = [];
        try {
          const files = await fs.readdir(screenshotDir);
          screenshots = files
            .filter((f) => /\.(png|jpg|jpeg)$/i.test(f))
            .map((f) => `/slidev/${documentId}/assets/${f}`);
        } catch {
          // No screenshots dir - that's fine
        }

        const material = await getMaterial(documentId);
        return { exists: true, markdown: content, screenshots, material };
      } catch {
        return { exists: false };
      }
    },
  );

  /**
   * PUT /slidev/:documentId - Persist user-edited Slidev markdown.
   * Used by the in-app ByteMD editor's debounced auto-save.
   */
  app.put<{ Params: { documentId: string } }>(
    '/slidev/:documentId',
    async (req, reply) => {
      const parsed = UpdateBody.safeParse(req.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: parsed.error.flatten() });
      }
      const { documentId } = req.params;

      const indexed = await hasDocumentIndex(documentId);
      if (!indexed) {
        return reply.code(404).send({ error: 'Document not indexed.' });
      }

      try {
        await ensureSlidevDir();
        await fs.writeFile(slidevPath(documentId), parsed.data.markdown, 'utf8');
        // Refresh the material's slide-count / updatedAt so the UI's metadata
        // pane stays in sync with edits made through the in-app editor.
        await touchOnEdit(documentId, countSlides(parsed.data.markdown));
        return { ok: true, savedAt: Date.now() };
      } catch (e: any) {
        req.log.error(e);
        return reply.code(500).send({ error: e?.message ?? 'Failed to save slides.' });
      }
    },
  );
}
