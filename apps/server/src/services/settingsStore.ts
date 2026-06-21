import fs from 'node:fs/promises';
import path from 'node:path';
import { config } from '../config.js';

/**
 * Settings store: server-side persistence for runtime-configurable model
 * providers. The on-disk file is the source of truth; environment variables
 * (DEEPSEEK_*, DASHSCOPE_*, QWEN_EMBED_MODEL) act as fallback defaults that
 * apply when the corresponding settings field is empty.
 */

export type ProviderKind = 'chat' | 'embedding';

export interface ProviderConfig {
  baseURL: string;
  apiKey: string;
  model: string;
}

export interface SettingsShape {
  chat: ProviderConfig;
  embedding: ProviderConfig;
}

export interface PublicProviderConfig {
  baseURL: string;
  model: string;
  hasKey: boolean;
  keyPreview: string;
}

export interface PublicSettingsShape {
  chat: PublicProviderConfig;
  embedding: PublicProviderConfig;
}

export class MissingApiKeyError extends Error {
  code = 'NO_API_KEY' as const;
  constructor(public readonly kind: ProviderKind) {
    super(
      `${kind === 'chat' ? 'Chat LLM' : 'Embedding'} API key is not configured. ` +
        `Open Settings (gear icon) and enter an API key.`,
    );
    this.name = 'MissingApiKeyError';
  }
}

/** Built-in defaults — kept in sync with the original .env.example values. */
const DEFAULTS: SettingsShape = {
  chat: {
    baseURL: 'https://api.deepseek.com',
    apiKey: '',
    model: 'deepseek-chat',
  },
  embedding: {
    baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    apiKey: '',
    model: 'text-embedding-v3',
  },
};

/** Env fallbacks applied on top of DEFAULTS. */
function envFallbacks(): SettingsShape {
  return {
    chat: {
      baseURL: process.env.DEEPSEEK_BASE_URL || DEFAULTS.chat.baseURL,
      apiKey: process.env.DEEPSEEK_API_KEY || '',
      model: process.env.DEEPSEEK_MODEL || DEFAULTS.chat.model,
    },
    embedding: {
      baseURL: process.env.DASHSCOPE_BASE_URL || DEFAULTS.embedding.baseURL,
      apiKey: process.env.DASHSCOPE_API_KEY || '',
      model: process.env.QWEN_EMBED_MODEL || DEFAULTS.embedding.model,
    },
  };
}

const SETTINGS_FILE = path.join(config.DATA_DIR, 'settings.json');

let cache: SettingsShape | null = null;

async function readFile(): Promise<Partial<SettingsShape> | null> {
  try {
    const raw = await fs.readFile(SETTINGS_FILE, 'utf8');
    return JSON.parse(raw);
  } catch (e: any) {
    if (e?.code === 'ENOENT') return null;
    throw e;
  }
}

async function writeFile(data: SettingsShape): Promise<void> {
  await fs.mkdir(path.dirname(SETTINGS_FILE), { recursive: true });
  await fs.writeFile(SETTINGS_FILE, JSON.stringify(data, null, 2), 'utf8');
}

function pickField(
  override: string | undefined,
  fallback: string,
): string {
  // Empty string is treated as "not set" so the env/default bubbles up.
  if (override === undefined || override === null || override === '') {
    return fallback;
  }
  return override;
}

function mergeOne(
  override: Partial<ProviderConfig> | undefined,
  fallback: ProviderConfig,
): ProviderConfig {
  return {
    baseURL: pickField(override?.baseURL, fallback.baseURL),
    apiKey: pickField(override?.apiKey, fallback.apiKey),
    model: pickField(override?.model, fallback.model),
  };
}

async function load(): Promise<SettingsShape> {
  if (cache) return cache;
  const env = envFallbacks();
  const file = (await readFile()) ?? {};
  cache = {
    chat: mergeOne(file.chat, env.chat),
    embedding: mergeOne(file.embedding, env.embedding),
  };
  return cache;
}

/** Resolved config (file > env > default). Used by the LLM/embedding services. */
export async function getSettings(): Promise<SettingsShape> {
  return load();
}

/** Convenience: resolved config for one provider kind. */
export async function getProviderConfig(
  kind: ProviderKind,
): Promise<ProviderConfig> {
  const s = await load();
  return s[kind];
}

function maskKey(key: string): string {
  if (!key) return '';
  if (key.length <= 8) return '*'.repeat(key.length);
  return `${key.slice(0, 3)}***${key.slice(-4)}`;
}

function toPublic(p: ProviderConfig): PublicProviderConfig {
  return {
    baseURL: p.baseURL,
    model: p.model,
    hasKey: !!p.apiKey,
    keyPreview: maskKey(p.apiKey),
  };
}

/** Settings shape returned to the browser — keys are masked. */
export async function getPublicSettings(): Promise<PublicSettingsShape> {
  const s = await load();
  return {
    chat: toPublic(s.chat),
    embedding: toPublic(s.embedding),
  };
}

export interface UpdatePatch {
  chat?: {
    baseURL?: string;
    /** undefined = keep existing, '' or null = clear, string = replace */
    apiKey?: string | null;
    model?: string;
  };
  embedding?: {
    baseURL?: string;
    apiKey?: string | null;
    model?: string;
  };
}

function applyPatchSection(
  current: ProviderConfig,
  patch: UpdatePatch['chat'],
): ProviderConfig {
  if (!patch) return current;
  const next: ProviderConfig = { ...current };
  if (patch.baseURL !== undefined) next.baseURL = patch.baseURL;
  if (patch.model !== undefined) next.model = patch.model;
  if (patch.apiKey !== undefined) {
    next.apiKey = patch.apiKey === null ? '' : patch.apiKey;
  }
  return next;
}

/** Merge patch into current settings, persist to disk, refresh cache. */
export async function updateSettings(
  patch: UpdatePatch,
): Promise<PublicSettingsShape> {
  const current = await load();
  const merged: SettingsShape = {
    chat: applyPatchSection(current.chat, patch.chat),
    embedding: applyPatchSection(current.embedding, patch.embedding),
  };
  await writeFile(merged);
  cache = merged;
  return getPublicSettings();
}

/** Test hook — used by /settings/test to evaluate a draft config without persisting. */
export function resolveDraft(
  kind: ProviderKind,
  draft: Partial<ProviderConfig>,
  current: ProviderConfig,
): ProviderConfig {
  return {
    baseURL: pickField(draft.baseURL, current.baseURL),
    apiKey:
      draft.apiKey === undefined
        ? current.apiKey
        : draft.apiKey === ''
          ? ''
          : draft.apiKey,
    model: pickField(draft.model, current.model),
  };
}
