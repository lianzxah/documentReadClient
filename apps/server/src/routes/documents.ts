import type { FastifyInstance } from 'fastify';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import { ingestExistingFile, ingestFromUrl } from '../services/ingest.js';
import {
  deleteDocument,
  findDocumentBySha,
  getDocument,
  listDocuments,
  loadPdfMetadataFromFile,
  patchDocumentMeta,
  registerLocalUpload,
  saveUploadStreamToCache,
  setIndexingState,
} from '../services/pdfLoader.js';
import { dropDocumentIndex } from '../services/vectorStore.js';
import { getDb } from '../db/index.js';
import {
  deleteMaterial,
  getMaterial,
} from '../services/slidevMaterialStore.js';
import { getPublicOverrides } from '../services/documentOverrideStore.js';
import { config } from '../config.js';
import type { DocumentMeta } from '../types.js';

const IngestBody = z.object({ url: z.string().url() });

/**
 * Build a safe UTF-8 attachment filename derived from a document title.
 * Keeps CJK characters, alphanumerics, and a few punctuation marks.
 */
function buildPdfFilename(title: string): string {
  const safe = title.replace(/[^a-zA-Z0-9\u4e00-\u9fff_.-]/g, '_');
  return safe.toLowerCase().endsWith('.pdf') ? safe : `${safe}.pdf`;
}

/**
 * Lesson 8: serialise a DocumentMeta for the public API. Fills in safe
 * defaults for legacy entries that pre-date `source/indexed/fileSize`.
 */
async function serialiseMeta(m: DocumentMeta) {
  const source = m.source ?? 'url';
  const indexed = m.indexed ?? source === 'url';
  let fileSize = m.fileSize;
  if (fileSize === undefined) {
    try {
      const stat = await fsp.stat(m.cachePath);
      fileSize = stat.size;
    } catch {
      fileSize = undefined;
    }
  }
  return {
    documentId: m.id,
    title: m.title,
    pages: m.pageCount,
    url: m.url,
    createdAt: m.createdAt,
    source,
    indexed,
    fileSize,
    originalFilename: m.originalFilename,
    indexing: m.indexing,
  };
}

/**
 * Lesson 8: kick off the lazy RAG indexing job in the background. Used by
 * the manual POST /documents/:id/index endpoint AND auto-triggered for
 * uploads below AUTO_INDEX_THRESHOLD_MB. Returns immediately; progress is
 * written into meta.indexing so the frontend can poll /index/status.
 */
function kickOffIndexing(
  app: FastifyInstance,
  meta: DocumentMeta,
): void {
  const id = meta.id;
  void (async () => {
    try {
      await setIndexingState(id, {
        status: 'running',
        progress: 0,
        startedAt: Date.now(),
      });
      let lastPersist = 0;
      await ingestExistingFile(meta, (page, total) => {
        const pct = Math.min(100, Math.floor((page / total) * 100));
        if (pct - lastPersist >= 2 || page === total) {
          lastPersist = pct;
          void setIndexingState(id, {
            status: 'running',
            progress: pct,
            startedAt: meta.indexing?.startedAt ?? Date.now(),
          });
        }
      });
      await patchDocumentMeta(id, {
        indexed: true,
        indexing: {
          status: 'idle',
          progress: 100,
          finishedAt: Date.now(),
        },
      });
    } catch (err: any) {
      app.log.error({ err }, 'background index failed');
      await setIndexingState(id, {
        status: 'error',
        error: err?.message ?? 'indexing failed',
        finishedAt: Date.now(),
      });
    }
  })();
}

/**
 * Lesson 8: small uploads are indexed automatically so they're immediately
 * chat-ready without a manual click. Threshold is configurable via
 * AUTO_INDEX_THRESHOLD_MB (default 1 MB).
 */
function shouldAutoIndex(fileSize: number): boolean {
  return fileSize < config.AUTO_INDEX_THRESHOLD_MB * 1024 * 1024;
}

export async function documentsRoutes(app: FastifyInstance) {
  app.post('/documents/ingest', async (req, reply) => {
    const parsed = IngestBody.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.flatten() });
    }
    try {
      const meta = await ingestFromUrl(parsed.data.url);
      return {
        documentId: meta.id,
        title: meta.title,
        pages: meta.pageCount,
        url: meta.url,
        source: meta.source ?? 'url',
        indexed: meta.indexed ?? true,
      };
    } catch (e: any) {
      req.log.error(e);
      if (e.name === 'AbortError') {
        return reply.code(504).send({ error: 'PDF download timed out' });
      }
      return reply.code(400).send({ error: e.message ?? 'ingest failed' });
    }
  });

  /**
   * Lesson 8 (revision) — POST /documents/import-local
   * Imports a PDF file that already lives on the server's filesystem. The
   * file is read from the given absolute path, streamed through the same
   * SHA256 + cache pipeline used by multipart upload, and registered as a
   * `source: 'local'` document. This enables the VSCode-like browser tab
   * in OpenDocumentDialog to pick server-side files without requiring the
   * user to re-upload them through the network.
   */
  app.post('/documents/import-local', async (req, reply) => {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const rawPath = body.path;
    if (typeof rawPath !== 'string' || !rawPath.trim()) {
      return reply
        .code(400)
        .send({ error: 'body.path must be a non-empty string' });
    }
    const absPath = path.resolve(rawPath.trim());

    // Basic sanity checks.
    let stat;
    try {
      stat = await fsp.stat(absPath);
    } catch (e: any) {
      return reply.code(404).send({ error: e?.message ?? 'file not found' });
    }
    if (!stat.isFile()) {
      return reply.code(400).send({ error: 'path is not a regular file' });
    }
    if (!absPath.toLowerCase().endsWith('.pdf')) {
      return reply.code(400).send({ error: 'only .pdf files are supported' });
    }
    const sizeMb = stat.size / (1024 * 1024);
    if (sizeMb > config.MAX_LOCAL_PDF_MB) {
      return reply.code(413).send({
        error: `file too large: ${sizeMb.toFixed(1)} MB (max ${config.MAX_LOCAL_PDF_MB} MB)`,
      });
    }

    // Stream-copy to cache with SHA256 dedup.
    const readStream = fs.createReadStream(absPath);
    let saved;
    try {
      saved = await saveUploadStreamToCache(readStream);
    } catch (e: any) {
      req.log.error({ err: e }, 'import-local stream copy failed');
      return reply.code(500).send({ error: e?.message ?? 'copy failed' });
    }

    // Dedup: reuse if already ingested.
    if (saved.reusedExisting) {
      const existing = await findDocumentBySha(saved.sha);
      if (existing) return await serialiseMeta(existing);
    }

    let probe;
    try {
      probe = await loadPdfMetadataFromFile(saved.cachePath);
    } catch (e: any) {
      req.log.error({ err: e }, 'import-local probe failed');
      try { await fsp.unlink(saved.cachePath); } catch { /* */ }
      return reply.code(400).send({ error: e?.message ?? 'invalid PDF' });
    }

    const filename = path.basename(absPath);
    const title =
      probe.title?.trim() ||
      filename.replace(/\.pdf$/i, '') ||
      `Document ${saved.sha.slice(0, 8)}`;

    const meta = await registerLocalUpload({
      cachePath: saved.cachePath,
      sha: saved.sha,
      fileSize: saved.fileSize,
      pageCount: probe.pageCount,
      title,
      originalFilename: filename,
    });

    // Auto-index small files immediately so they're chat-ready.
    if (shouldAutoIndex(saved.fileSize)) {
      kickOffIndexing(app, meta);
    }

    return await serialiseMeta(meta);
  });

  /**
   * Lesson 8 — POST /documents/upload
   * Streams a multipart PDF part to a temp file, computes SHA256 on the fly,
   * promotes the file into cache/<sha>.pdf, probes pageCount/title via
   * pdfjs-dist, and registers a `source: 'local'` DocumentMeta entry. The
   * entry starts as `indexed: false` — RAG indexing is opt-in via
   * POST /documents/:id/index so opening a 200 MB book is instant.
   */
  app.post('/documents/upload', async (req, reply) => {
    if (!req.isMultipart()) {
      return reply
        .code(400)
        .send({ error: 'expected multipart/form-data with a "file" field' });
    }

    let part;
    try {
      part = await req.file();
    } catch (e: any) {
      return reply.code(400).send({
        error: e?.message ?? 'failed to read upload',
      });
    }
    if (!part) {
      return reply.code(400).send({ error: 'no file uploaded' });
    }

    const filename = part.filename ?? 'document.pdf';
    const mimetype = part.mimetype ?? '';
    const looksLikePdf =
      /pdf|octet-stream/i.test(mimetype) ||
      filename.toLowerCase().endsWith('.pdf');
    if (!looksLikePdf) {
      // Drain the stream so multipart cleans up properly.
      part.file.resume();
      return reply.code(400).send({
        error: `unsupported file type: ${mimetype || 'unknown'} (expected PDF)`,
      });
    }

    let saved;
    try {
      saved = await saveUploadStreamToCache(part.file);
    } catch (e: any) {
      req.log.error({ err: e }, 'pdf upload stream failed');
      return reply.code(500).send({ error: e?.message ?? 'upload failed' });
    }

    // @fastify/multipart sets `truncated` on the part stream when fileSize is
    // exceeded mid-stream. We've already written that partial data to disk;
    // remove it so a half-uploaded book never ends up in the cache.
    if (part.file.truncated) {
      try {
        await fsp.unlink(saved.cachePath);
      } catch {
        // best effort
      }
      return reply.code(413).send({
        error: `file too large (max ${config.MAX_LOCAL_PDF_MB} MB)`,
      });
    }

    // Same content already in the cache: reuse the existing document record
    // when one points at this SHA. Otherwise fall through to register a new
    // metadata entry that points at the existing cache file.
    if (saved.reusedExisting) {
      const existing = await findDocumentBySha(saved.sha);
      if (existing) {
        const view = await serialiseMeta(existing);
        return view;
      }
    }

    let probe;
    try {
      probe = await loadPdfMetadataFromFile(saved.cachePath);
    } catch (e: any) {
      req.log.error({ err: e }, 'pdf metadata probe failed');
      // The cache file is unparseable; remove it so the next retry can try a
      // different file without colliding on the same SHA.
      try {
        await fsp.unlink(saved.cachePath);
      } catch {
        // best effort
      }
      return reply.code(400).send({
        error: e?.message ?? 'invalid PDF',
      });
    }

    const title =
      probe.title?.trim() ||
      filename.replace(/\.pdf$/i, '') ||
      `Document ${saved.sha.slice(0, 8)}`;

    const meta = await registerLocalUpload({
      cachePath: saved.cachePath,
      sha: saved.sha,
      fileSize: saved.fileSize,
      pageCount: probe.pageCount,
      title,
      originalFilename: filename,
    });

    // Auto-index small files immediately so they're chat-ready.
    if (shouldAutoIndex(saved.fileSize)) {
      kickOffIndexing(app, meta);
    }

    return await serialiseMeta(meta);
  });

  /**
   * Lesson 8 — POST /documents/:id/index
   * Kick off the lazy RAG indexing job for a previously-uploaded local PDF.
   * Returns 202 immediately; the actual parse + embed + upsert runs in the
   * background and writes its progress into `meta.indexing` so the frontend
   * can poll /documents/:id/index/status.
   */
  app.post<{ Params: { id: string } }>(
    '/documents/:id/index',
    async (req, reply) => {
      const id = req.params.id;
      const meta = await getDocument(id);
      if (!meta) return reply.code(404).send({ error: 'not found' });
      if (meta.indexed) {
        return reply.code(409).send({ error: 'already indexed' });
      }
      if (meta.indexing?.status === 'running') {
        return reply.code(409).send({ error: 'indexing already in progress' });
      }

      kickOffIndexing(app, meta);
      return reply.code(202).send({ ok: true });
    },
  );

  app.get<{ Params: { id: string } }>(
    '/documents/:id/index/status',
    async (req, reply) => {
      const meta = await getDocument(req.params.id);
      if (!meta) return reply.code(404).send({ error: 'not found' });
      return {
        documentId: meta.id,
        indexed: meta.indexed ?? (meta.source ?? 'url') === 'url',
        indexing: meta.indexing ?? { status: 'idle' },
      };
    },
  );

  /**
   * Streams the cached PDF. Emits Content-Length for progress UX and
   * Accept-Ranges so clients (PDF.js, resumable downloaders) can issue
   * partial Range requests. When `?download=1` is set, a
   * Content-Disposition: attachment header is added so the browser saves
   * the file instead of rendering it inline — used by the global
   * "Download PDF" button. The body is piped from a file stream; nothing
   * is buffered in memory.
   */
  app.get<{ Params: { id: string }; Querystring: { download?: string } }>(
    '/documents/:id/pdf',
    async (req, reply) => {
      const meta = await getDocument(req.params.id);
      if (!meta) return reply.code(404).send({ error: 'not found' });

      let stat;
      try {
        stat = await fsp.stat(meta.cachePath);
      } catch {
        return reply.code(404).send({ error: 'pdf file missing on disk' });
      }
      const total = stat.size;

      reply.header('Content-Type', 'application/pdf');
      reply.header('Cache-Control', 'public, max-age=3600');
      reply.header('Accept-Ranges', 'bytes');

      if (req.query?.download) {
        const filename = buildPdfFilename(meta.title || meta.id);
        reply.header(
          'Content-Disposition',
          `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
        );
      }

      // Serve partial content when the client sent a Range header. This
      // unlocks resumable downloads and progressive rendering in PDF.js.
      const rangeHeader = req.headers.range;
      if (rangeHeader) {
        const m = /^bytes=(\d*)-(\d*)$/.exec(rangeHeader);
        if (!m) {
          reply.header('Content-Range', `bytes */${total}`);
          return reply.code(416).send();
        }
        const start = m[1] ? parseInt(m[1], 10) : 0;
        const end = m[2] ? parseInt(m[2], 10) : total - 1;
        if (
          Number.isNaN(start) ||
          Number.isNaN(end) ||
          start > end ||
          end >= total
        ) {
          reply.header('Content-Range', `bytes */${total}`);
          return reply.code(416).send();
        }

        reply.code(206);
        reply.header('Content-Range', `bytes ${start}-${end}/${total}`);
        reply.header('Content-Length', String(end - start + 1));

        const partial = fs.createReadStream(meta.cachePath, { start, end });
        partial.on('error', (err) => {
          req.log.error({ err }, 'pdf partial stream error');
          reply.raw.destroy(err);
        });
        return reply.send(partial);
      }

      reply.header('Content-Length', String(total));
      const stream = fs.createReadStream(meta.cachePath);
      stream.on('error', (err) => {
        req.log.error({ err }, 'pdf stream error');
        reply.raw.destroy(err);
      });
      return reply.send(stream);
    },
  );

  app.get<{ Params: { id: string } }>('/documents/:id', async (req, reply) => {
    const meta = await getDocument(req.params.id);
    if (!meta) return reply.code(404).send({ error: 'not found' });
    return {
      documentId: meta.id,
      title: meta.title,
      pages: meta.pageCount,
      url: meta.url,
    };
  });

  /**
   * GET /documents — list every ingested document with its lesson-4 satellite
   * info (Slidev material presence, model overrides). The Explorer side bar
   * uses this so users can reopen a document that was previously closed.
   */
  app.get('/documents', async () => {
    const docs = await listDocuments();
    const items = await Promise.all(
      docs.map(async (m) => {
        const [base, material, override] = await Promise.all([
          serialiseMeta(m),
          getMaterial(m.id),
          getPublicOverrides(m.id),
        ]);
        return {
          ...base,
          hasSlidev: !!material,
          slidev: material
            ? {
                slideCount: material.slideCount,
                language: material.language,
                updatedAt: material.updatedAt,
              }
            : undefined,
          override: override.chat?.model || override.embedding?.model
            ? override
            : undefined,
        };
      }),
    );
    return { items };
  });

  /**
   * DELETE /documents/:id — drop the document end-to-end:
   *   1. LanceDB vector table
   *   2. cached PDF + documents.json entry
   *   3. Slidev markdown + screenshots dir
   *   4. NeDB rows: chat sessions, chat messages, slidev material, override
   * Sessions cascade their messages via the documentId link.
   */
  app.delete<{ Params: { id: string } }>(
    '/documents/:id',
    async (req, reply) => {
      const id = req.params.id;
      const meta = await getDocument(id);
      if (!meta) return reply.code(404).send({ error: 'not found' });

      try {
        await dropDocumentIndex(id);
      } catch (err) {
        req.log.warn({ err }, 'lancedb drop failed; continuing cleanup');
      }

      // Slidev markdown + screenshots directory.
      try {
        await fsp.unlink(path.join(config.SLIDEV_DIR, `${id}.md`));
      } catch {
        // already gone
      }
      try {
        await fsp.rm(path.join(config.SCREENSHOTS_DIR, id), {
          recursive: true,
          force: true,
        });
      } catch {
        // already gone
      }

      // NeDB cascade.
      const { sessions, messages, overrides } = getDb();
      await Promise.all([
        sessions.removeAsync({ documentId: id }, { multi: true }),
        messages.removeAsync({ documentId: id }, { multi: true }),
        overrides.removeAsync({ documentId: id }, {}),
        deleteMaterial(id),
      ]);

      await deleteDocument(id);
      return { ok: true };
    },
  );
}
