import { ChatOpenAI } from '@langchain/openai';
import {
  getProviderConfig,
  MissingApiKeyError,
} from './settingsStore.js';
import { getChatModelOverride } from './documentOverrideStore.js';

/**
 * Build a chat LLM bound to the user's currently-configured provider.
 * Any OpenAI-compatible endpoint works (DeepSeek, OpenAI, Qwen, Moonshot,
 * SiliconFlow, ...). Resolution order: per-document override > settings.json
 * > env > built-in default. Pass `ctx.documentId` to apply lesson-4 per-doc
 * model overrides without affecting the global setting.
 *
 * Throws MissingApiKeyError when no key is configured so route handlers can
 * surface a friendly `code: 'NO_API_KEY'` error to the frontend.
 */
export async function createChatLLM(
  opts: {
    temperature?: number;
    streaming?: boolean;
    maxTokens?: number;
  } = {},
  ctx: { documentId?: string } = {},
) {
  const cfg = await getProviderConfig('chat');
  if (!cfg.apiKey) throw new MissingApiKeyError('chat');

  let model = cfg.model;
  if (ctx.documentId) {
    const override = await getChatModelOverride(ctx.documentId);
    if (override) model = override;
  }

  return new ChatOpenAI({
    apiKey: cfg.apiKey,
    model,
    temperature: opts.temperature ?? 0.3,
    streaming: opts.streaming ?? true,
    // Some OpenAI-compatible providers cap the streaming response shorter than
    // expected. Letting the caller set a generous maxTokens (skill-driven)
    // keeps "detailed tutor"-style answers from being silently truncated.
    ...(typeof opts.maxTokens === 'number' ? { maxTokens: opts.maxTokens } : {}),
    configuration: {
      baseURL: cfg.baseURL,
    },
  });
}

/**
 * Backwards-compatible alias. Existing call sites in graphs/* and slidevBuilder
 * import `createDeepSeekChat`; the function is no longer DeepSeek-specific
 * but the name is preserved to keep the refactor surgical.
 */
export const createDeepSeekChat = createChatLLM;
