export type DocumentSource = 'url' | 'local';

export interface IndexingState {
  status: 'idle' | 'running' | 'error';
  progress?: number;
  error?: string;
  startedAt?: number;
  finishedAt?: number;
}

export interface DocumentMeta {
  id: string;
  url: string;
  title: string;
  pageCount: number;
  createdAt: number;
  cachePath: string;
  sha256: string;
  // Lesson 8: distinguishes URL-ingested docs from locally-uploaded ones.
  // Legacy entries (pre-lesson-8) are missing these — readers default to
  // `source: 'url'`, `indexed: true`, `fileSize: stat(cachePath).size`.
  source?: DocumentSource;
  originalFilename?: string;
  fileSize?: number;
  indexed?: boolean;
  indexing?: IndexingState;
}

export interface Chunk {
  id: string;
  documentId: string;
  page: number;
  text: string;
}

export interface EmbeddedChunk extends Chunk {
  vector: number[];
}

export interface RetrievedChunk extends Chunk {
  score: number;
}

export type TranslateDirection = 'auto' | 'zh2en' | 'en2zh';

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}
