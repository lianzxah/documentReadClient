import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { pipeline } from 'node:stream/promises';
import { Transform } from 'node:stream';
import { nanoid } from 'nanoid';
import pdfParse from 'pdf-parse';
import { config } from '../config.js';
import type { Chunk, DocumentMeta, IndexingState } from '../types.js';

const IPV4_PRIVATE = [
  /^10\./,
  /^127\./,
  /^192\.168\./,
  /^169\.254\./,
  /^172\.(1[6-9]|2\d|3[0-1])\./,
  /^0\./,
];

function assertSafeUrl(raw: string): URL {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    throw new Error('Invalid URL');
  }
  if (!['http:', 'https:'].includes(u.protocol)) {
    throw new Error('Only http(s) URLs are allowed');
  }
  const host = u.hostname;
  if (host === 'localhost') throw new Error('Localhost is not allowed');
  if (IPV4_PRIVATE.some((re) => re.test(host))) {
    throw new Error('Private IP address is not allowed');
  }
  return u;
}

async function fetchPdfBytes(url: string): Promise<Buffer> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal, redirect: 'follow' });
    if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
    const ct = res.headers.get('content-type') ?? '';
    if (ct && !/pdf|octet-stream/i.test(ct)) {
      throw new Error(`Unexpected content-type: ${ct}`);
    }
    const buf = Buffer.from(await res.arrayBuffer());
    const mb = buf.length / (1024 * 1024);
    if (mb > config.MAX_PDF_MB) {
      throw new Error(`PDF too large: ${mb.toFixed(1)}MB > ${config.MAX_PDF_MB}MB`);
    }
    return buf;
  } finally {
    clearTimeout(timer);
  }
}

interface MetadataFile {
  [id: string]: DocumentMeta;
}

async function ensureDirs() {
  await fs.mkdir(config.DATA_DIR, { recursive: true });
  await fs.mkdir(config.CACHE_DIR, { recursive: true });
  await fs.mkdir(path.join(config.CACHE_DIR, '.tmp'), { recursive: true });
}

async function readMetadata(): Promise<MetadataFile> {
  try {
    const txt = await fs.readFile(config.METADATA_FILE, 'utf8');
    return JSON.parse(txt) as MetadataFile;
  } catch {
    return {};
  }
}

async function writeMetadata(m: MetadataFile) {
  await fs.writeFile(config.METADATA_FILE, JSON.stringify(m, null, 2));
}

/**
 * Lesson 8: serialise mutations to documents.json so the lazy-indexing job
 * and concurrent uploads cannot clobber each other. The lock is process-local
 * and very lightweight — fine for a single Fastify instance.
 */
let metadataMutex: Promise<void> = Promise.resolve();
async function withMetadataLock<T>(fn: () => Promise<T>): Promise<T> {
  const prev = metadataMutex;
  let release!: () => void;
  metadataMutex = new Promise<void>((r) => (release = r));
  try {
    await prev;
    return await fn();
  } finally {
    release();
  }
}

export async function findDocumentByUrl(url: string): Promise<DocumentMeta | null> {
  const sha = crypto.createHash('sha256').update(url).digest('hex');
  const meta = await readMetadata();
  return (
    Object.values(meta).find((m) => m.sha256 === sha) ?? null
  );
}

export async function getDocument(id: string): Promise<DocumentMeta | null> {
  const meta = await readMetadata();
  return meta[id] ?? null;
}

export async function listDocuments(): Promise<DocumentMeta[]> {
  const meta = await readMetadata();
  return Object.values(meta).sort((a, b) => b.createdAt - a.createdAt);
}

/**
 * Remove a document's metadata entry and (best-effort) its cached PDF file.
 * The LanceDB table and any NeDB-managed satellite rows are cleaned up by
 * higher-level callers in the documents route.
 */
export async function deleteDocument(id: string): Promise<boolean> {
  const all = await readMetadata();
  const meta = all[id];
  if (!meta) return false;
  delete all[id];
  await writeMetadata(all);
  if (meta.cachePath) {
    try {
      await fs.unlink(meta.cachePath);
    } catch {
      // Cache file may already be missing; ignore.
    }
  }
  return true;
}

/** Recursive splitter approximating LangChain's behaviour - keeps paragraphs when possible. */
function splitText(text: string, size = 800, overlap = 120): string[] {
  const clean = text.replace(/\u0000/g, '').replace(/[ \t]+/g, ' ').trim();
  if (!clean) return [];
  const separators = ['\n\n', '\n', '. ', '! ', '? ', '; ', ' '];
  const chunks: string[] = [];

  const recurse = (segment: string, depth: number) => {
    if (segment.length <= size) {
      if (segment.trim()) chunks.push(segment.trim());
      return;
    }
    const sep = separators[Math.min(depth, separators.length - 1)];
    const parts = segment.split(sep);
    let buf = '';
    for (const p of parts) {
      const piece = buf ? buf + sep + p : p;
      if (piece.length > size) {
        if (buf) chunks.push(buf.trim());
        if (p.length > size) recurse(p, depth + 1);
        else buf = p;
      } else {
        buf = piece;
      }
    }
    if (buf.trim()) chunks.push(buf.trim());
  };

  recurse(clean, 0);

  // Apply sliding overlap
  if (overlap <= 0 || chunks.length < 2) return chunks;
  const withOverlap: string[] = [];
  for (let i = 0; i < chunks.length; i++) {
    const prevTail =
      i > 0 ? chunks[i - 1].slice(-overlap) : '';
    withOverlap.push((prevTail ? prevTail + ' ' : '') + chunks[i]);
  }
  return withOverlap;
}

export interface LoadResult {
  meta: DocumentMeta;
  chunks: Chunk[];
  reused: boolean;
}

export async function loadPdfFromUrl(url: string): Promise<LoadResult> {
  assertSafeUrl(url);
  await ensureDirs();

  const existing = await findDocumentByUrl(url);
  if (existing) {
    return { meta: existing, chunks: [], reused: true };
  }

  const bytes = await fetchPdfBytes(url);
  const sha = crypto.createHash('sha256').update(url).digest('hex');
  const cachePath = path.join(config.CACHE_DIR, `${sha}.pdf`);
  await fs.writeFile(cachePath, bytes);

  // Per-page extraction: call pdf-parse with a pagerender to capture text per page.
  const perPage: string[] = [];
  const parseOpts = {
    pagerender: async (pageData: any) => {
      const textContent = await pageData.getTextContent();
      const text = textContent.items.map((it: any) => it.str).join(' ');
      perPage.push(text);
      return text;
    },
  } as any;

  const parsed = await pdfParse(bytes, parseOpts);
  const pageCount = parsed.numpages || perPage.length;
  const title =
    (parsed.info && (parsed.info.Title as string)) ||
    new URL(url).pathname.split('/').pop() ||
    `Document ${sha.slice(0, 8)}`;

  const id = nanoid(10);

  const chunks: Chunk[] = [];
  perPage.forEach((pageText, idx) => {
    const page = idx + 1;
    const parts = splitText(pageText);
    parts.forEach((t, j) => {
      chunks.push({
        id: `${id}:${page}:${j}`,
        documentId: id,
        page,
        text: t,
      });
    });
  });

  const meta: DocumentMeta = {
    id,
    url,
    title,
    pageCount,
    createdAt: Date.now(),
    cachePath,
    sha256: sha,
  };

  const all = await readMetadata();
  all[id] = meta;
  await writeMetadata(all);

  return { meta, chunks, reused: false };
}

// ---------------------------------------------------------------------------
// Lesson 8 — local PDF upload + lazy RAG indexing helpers.
// ---------------------------------------------------------------------------

/**
 * Look up a document by its content SHA256. Used by the upload route to make
 * re-uploading the same file idempotent across both URL and local sources.
 */
export async function findDocumentBySha(
  sha: string,
): Promise<DocumentMeta | null> {
  const meta = await readMetadata();
  return Object.values(meta).find((m) => m.sha256 === sha) ?? null;
}

export interface SavedUpload {
  sha: string;
  cachePath: string;
  fileSize: number;
  reusedExisting: boolean;
}

/**
 * Stream a multipart file part to a temp file under CACHE_DIR/.tmp while
 * computing the SHA256 incrementally, then atomically rename into place at
 * cache/<sha>.pdf. Never buffers the whole file in memory — critical for the
 * 200 MB ceiling.
 *
 * If a cache file with the same SHA already exists, the temp file is
 * discarded and we report `reusedExisting: true` so the caller can dedupe.
 */
export async function saveUploadStreamToCache(
  source: NodeJS.ReadableStream,
): Promise<SavedUpload> {
  await ensureDirs();
  const tmpName = `${nanoid(16)}.pdf`;
  const tmpPath = path.join(config.CACHE_DIR, '.tmp', tmpName);
  const hash = crypto.createHash('sha256');
  let fileSize = 0;

  const tap = new Transform({
    transform(chunk, _enc, cb) {
      hash.update(chunk as Buffer);
      fileSize += (chunk as Buffer).length;
      cb(null, chunk);
    },
  });

  const writeStream = fsSync.createWriteStream(tmpPath);
  try {
    await pipeline(source, tap, writeStream);
  } catch (err) {
    // Best-effort cleanup of the partial temp file.
    try {
      await fs.unlink(tmpPath);
    } catch {
      // already gone
    }
    throw err;
  }

  const sha = hash.digest('hex');
  const cachePath = path.join(config.CACHE_DIR, `${sha}.pdf`);

  // Dedupe: if a file with this content already exists in the cache, drop
  // the temp upload. The caller decides whether to reuse the metadata row.
  try {
    await fs.access(cachePath);
    await fs.unlink(tmpPath).catch(() => {});
    return { sha, cachePath, fileSize, reusedExisting: true };
  } catch {
    // not in cache yet — promote the temp file
  }

  await fs.rename(tmpPath, cachePath);
  return { sha, cachePath, fileSize, reusedExisting: false };
}

// pdfjs-dist is a CJS module on Node; cache the singleton on first use.
let pdfjsModule: any | null = null;
async function getPdfjs(): Promise<any> {
  if (pdfjsModule) return pdfjsModule;
  // The 'legacy/build/pdf.js' entry is the Node-friendly bundle that pdf-parse
  // also relies on. Worker is disabled — pdfjs runs on the main thread when
  // GlobalWorkerOptions.workerSrc is empty.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mod: any = await import('pdfjs-dist/legacy/build/pdf.js' as any);
  pdfjsModule = mod.default ?? mod;
  if (pdfjsModule.GlobalWorkerOptions) {
    pdfjsModule.GlobalWorkerOptions.workerSrc = '';
  }
  return pdfjsModule;
}

export interface PdfFileMetadata {
  pageCount: number;
  title: string | null;
}

/**
 * Cheap metadata probe — reads the file once via pdfjs-dist and returns the
 * page count plus title from the document info dictionary. Used by the
 * /documents/upload route to populate DocumentMeta without doing the full
 * text extraction (which is reserved for the lazy indexing job).
 */
export async function loadPdfMetadataFromFile(
  cachePath: string,
): Promise<PdfFileMetadata> {
  const data = new Uint8Array(await fs.readFile(cachePath));
  const pdfjs = await getPdfjs();
  const loadingTask = pdfjs.getDocument({
    data,
    disableFontFace: true,
    useSystemFonts: false,
  });
  try {
    const pdf = await loadingTask.promise;
    let title: string | null = null;
    try {
      const info: any = await pdf.getMetadata();
      title = (info?.info?.Title as string) || null;
    } catch {
      // metadata block missing — fall back to caller-provided filename
    }
    const pageCount = pdf.numPages;
    await pdf.cleanup();
    await pdf.destroy();
    return { pageCount, title };
  } finally {
    try {
      await loadingTask.destroy?.();
    } catch {
      // already destroyed
    }
  }
}

export interface RegisterLocalUploadInput {
  cachePath: string;
  sha: string;
  fileSize: number;
  pageCount: number;
  title: string;
  originalFilename?: string;
}

/**
 * Persist a fresh DocumentMeta entry for a locally-uploaded PDF. RAG vectors
 * are NOT computed here — the entry starts as `indexed: false` and the user
 * can trigger indexing later via POST /documents/:id/index.
 */
export async function registerLocalUpload(
  input: RegisterLocalUploadInput,
): Promise<DocumentMeta> {
  const id = nanoid(10);
  const meta: DocumentMeta = {
    id,
    url: `local:${input.originalFilename ?? input.sha.slice(0, 12)}`,
    title: input.title,
    pageCount: input.pageCount,
    createdAt: Date.now(),
    cachePath: input.cachePath,
    sha256: input.sha,
    source: 'local',
    originalFilename: input.originalFilename,
    fileSize: input.fileSize,
    indexed: false,
    indexing: { status: 'idle' },
  };

  return withMetadataLock(async () => {
    const all = await readMetadata();
    all[id] = meta;
    await writeMetadata(all);
    return meta;
  });
}

/**
 * Atomically merge a partial DocumentMeta patch over an existing entry.
 * Used by the indexing job to update progress / status without racing other
 * writers.
 */
export async function patchDocumentMeta(
  id: string,
  patch: Partial<DocumentMeta>,
): Promise<DocumentMeta | null> {
  return withMetadataLock(async () => {
    const all = await readMetadata();
    const cur = all[id];
    if (!cur) return null;
    const next: DocumentMeta = { ...cur, ...patch };
    all[id] = next;
    await writeMetadata(all);
    return next;
  });
}

export async function setIndexingState(
  id: string,
  state: IndexingState,
): Promise<void> {
  await patchDocumentMeta(id, { indexing: state });
}

/**
 * Iterate every page of the cached PDF, extract text via pdfjs-dist, and
 * yield Chunk[] ready for embedding. Yields the event loop every
 * `YIELD_EVERY` pages so 500-page books do not block health checks or
 * concurrent HTTP traffic.
 */
const YIELD_EVERY = 16;

export async function parseAndChunkFile(
  documentId: string,
  cachePath: string,
  onProgress?: (page: number, total: number) => void,
): Promise<Chunk[]> {
  const data = new Uint8Array(await fs.readFile(cachePath));
  const pdfjs = await getPdfjs();
  const loadingTask = pdfjs.getDocument({
    data,
    disableFontFace: true,
    useSystemFonts: false,
  });
  const pdf = await loadingTask.promise;
  const total = pdf.numPages;
  const chunks: Chunk[] = [];

  try {
    for (let pageNum = 1; pageNum <= total; pageNum++) {
      const page = await pdf.getPage(pageNum);
      let pageText = '';
      try {
        const tc = await page.getTextContent();
        pageText = tc.items
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .map((it: any) => (typeof it.str === 'string' ? it.str : ''))
          .join(' ');
      } finally {
        page.cleanup();
      }
      const parts = splitText(pageText);
      parts.forEach((t, j) => {
        chunks.push({
          id: `${documentId}:${pageNum}:${j}`,
          documentId,
          page: pageNum,
          text: t,
        });
      });
      if (onProgress) onProgress(pageNum, total);
      if (pageNum % YIELD_EVERY === 0) {
        // Hand the event loop back so /healthz, range requests, and other HTTP
        // traffic stay responsive while a 500-page book is being parsed.
        await new Promise<void>((r) => setImmediate(r));
      }
    }
  } finally {
    try {
      await pdf.cleanup();
      await pdf.destroy();
      await loadingTask.destroy?.();
    } catch {
      // best effort
    }
  }

  return chunks;
}
