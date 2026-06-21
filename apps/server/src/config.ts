import 'dotenv/config';
import { z } from 'zod';
import path from 'node:path';

const Schema = z.object({
  PORT: z.coerce.number().default(8787),
  HOST: z.string().default('0.0.0.0'),

  // Model provider env vars are now optional. They act as fallback defaults
  // for the in-app Settings dialog (apps/server/src/services/settingsStore.ts).
  // When unset, users must configure keys via the Settings UI before any
  // chat / RAG / Slidev call will succeed.
  DEEPSEEK_API_KEY: z.string().optional(),
  DEEPSEEK_BASE_URL: z.string().default('https://api.deepseek.com'),
  DEEPSEEK_MODEL: z.string().default('deepseek-chat'),

  DASHSCOPE_API_KEY: z.string().optional(),
  DASHSCOPE_BASE_URL: z
    .string()
    .default('https://dashscope.aliyuncs.com/compatible-mode/v1'),
  QWEN_EMBED_MODEL: z.string().default('text-embedding-v3'),

  LANCEDB_PATH: z.string().default('./.data/lancedb'),
  DATA_DIR: z.string().default('./.data'),

  MAX_PDF_MB: z.coerce.number().default(50),
  // Lesson 8: local-PDF uploads use a much higher ceiling because users may
  // open ~200MB books. URL ingest keeps MAX_PDF_MB to constrain network fan-out.
  MAX_LOCAL_PDF_MB: z.coerce.number().default(210),
  // Lesson 8: files smaller than this threshold are automatically indexed
  // after upload/import, skipping the manual "Index" trigger.
  AUTO_INDEX_THRESHOLD_MB: z.coerce.number().default(1),
  FETCH_TIMEOUT_MS: z.coerce.number().default(30000),
});

const parsed = Schema.safeParse(process.env);
if (!parsed.success) {
  // eslint-disable-next-line no-console
  console.error('Invalid environment config:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

const raw = parsed.data;

export const config = {
  ...raw,
  DATA_DIR: path.resolve(process.cwd(), raw.DATA_DIR),
  LANCEDB_PATH: path.resolve(process.cwd(), raw.LANCEDB_PATH),
  CACHE_DIR: path.resolve(process.cwd(), raw.DATA_DIR, 'cache'),
  METADATA_FILE: path.resolve(process.cwd(), raw.DATA_DIR, 'documents.json'),
  SLIDEV_DIR: path.resolve(process.cwd(), raw.DATA_DIR, 'slidev'),
  SCREENSHOTS_DIR: path.resolve(process.cwd(), raw.DATA_DIR, 'screenshots'),
  NEDB_DIR: path.resolve(process.cwd(), raw.DATA_DIR, 'nedb'),
};

export type Config = typeof config;
