import pLimit from 'p-limit';
import { loadPdfFromUrl, parseAndChunkFile } from './pdfLoader.js';
import { embedTexts } from './embeddings.js';
import { upsertChunks } from './vectorStore.js';
import type { Chunk, DocumentMeta, EmbeddedChunk } from '../types.js';

/**
 * Embed an array of chunks in batches and upsert them into LanceDB.
 * Shared between the URL ingest path and the lesson-8 lazy local index path.
 */
async function embedAndUpsert(
  documentId: string,
  chunks: Chunk[],
): Promise<void> {
  if (chunks.length === 0) return;
  const BATCH = 10;
  const limit = pLimit(3);
  const batches: Chunk[][] = [];
  for (let i = 0; i < chunks.length; i += BATCH) {
    batches.push(chunks.slice(i, i + BATCH));
  }
  const embedded: EmbeddedChunk[] = [];
  await Promise.all(
    batches.map((batch) =>
      limit(async () => {
        const vectors = await embedTexts(batch.map((c) => c.text));
        batch.forEach((c, idx) => {
          embedded.push({ ...c, vector: vectors[idx] });
        });
      }),
    ),
  );
  await upsertChunks(documentId, embedded);
}

/**
 * End-to-end: fetch URL -> parse -> chunk -> embed (batched) -> upsert into LanceDB.
 * Idempotent via pdfLoader cache + metadata file.
 */
export async function ingestFromUrl(url: string): Promise<DocumentMeta> {
  const { meta, chunks, reused } = await loadPdfFromUrl(url);
  if (reused || chunks.length === 0) return meta;
  await embedAndUpsert(meta.id, chunks);
  return meta;
}

/**
 * Lesson 8: lazy RAG indexing for an already-uploaded local PDF. The caller
 * passes a DocumentMeta that lives in documents.json; we re-parse the cached
 * file with pdfjs-dist (no network), embed, and upsert. The optional
 * `onProgress` callback fires per-page so the route handler can persist
 * progress into `meta.indexing.progress` for the polling client.
 */
export async function ingestExistingFile(
  meta: DocumentMeta,
  onProgress?: (page: number, total: number) => void,
): Promise<void> {
  const chunks = await parseAndChunkFile(meta.id, meta.cachePath, onProgress);
  await embedAndUpsert(meta.id, chunks);
}
