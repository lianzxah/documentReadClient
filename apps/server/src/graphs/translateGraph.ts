import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { ChatOpenAI } from '@langchain/openai';
import { getProviderConfig, MissingApiKeyError } from '../services/settingsStore.js';
import type { TranslateDirection } from '../types.js';

// ---------------------------------------------------------------------------
// Language detection – pure synchronous, no framework overhead.
// ---------------------------------------------------------------------------

function detectLang(text: string): 'zh' | 'en' {
  const cjk = text.match(/[\u4e00-\u9fff]/g)?.length ?? 0;
  const total = text.replace(/\s+/g, '').length || 1;
  return cjk / total > 0.2 ? 'zh' : 'en';
}

function resolveDirection(
  direction: TranslateDirection,
  detected: 'zh' | 'en',
): 'zh2en' | 'en2zh' {
  if (direction === 'zh2en' || direction === 'en2zh') return direction;
  return detected === 'zh' ? 'zh2en' : 'en2zh';
}

// ---------------------------------------------------------------------------
// Cached LLM instance – avoids recreating the HTTP client for every request.
// Invalidated when provider config changes (baseURL/apiKey/model).
// ---------------------------------------------------------------------------

let cachedLLM: ChatOpenAI | null = null;
let cachedFingerprint = '';

async function getTranslateLLM(): Promise<ChatOpenAI> {
  const cfg = await getProviderConfig('chat');
  if (!cfg.apiKey) throw new MissingApiKeyError('chat');

  const fingerprint = `${cfg.baseURL}|${cfg.apiKey}|${cfg.model}`;
  if (cachedLLM && cachedFingerprint === fingerprint) return cachedLLM;

  cachedLLM = new ChatOpenAI({
    apiKey: cfg.apiKey,
    model: cfg.model,
    temperature: 0.2,
    streaming: true,
    configuration: { baseURL: cfg.baseURL },
  });
  cachedFingerprint = fingerprint;
  return cachedLLM;
}

// ---------------------------------------------------------------------------
// Public API – async generator yielding SSE-compatible events.
// ---------------------------------------------------------------------------

export async function* runTranslate(params: {
  text: string;
  direction: TranslateDirection;
}) {
  // 1) Instant detection + direction resolve (no graph, no async overhead).
  const detected = detectLang(params.text);
  const resolvedDirection = resolveDirection(params.direction, detected);

  yield { type: 'meta' as const, detected, direction: resolvedDirection };

  // 2) Stream translation from LLM with cached client.
  const target = resolvedDirection === 'zh2en' ? 'English' : 'Chinese';
  const system = new SystemMessage(
    `You are a professional academic translator. Translate the user's text into ${target}. ` +
      `Preserve technical terminology, keep LaTeX and code verbatim, and do not add commentary. ` +
      `Output only the translated text.`,
  );
  const user = new HumanMessage(params.text);

  const llm = await getTranslateLLM();
  const stream = await llm.stream([system, user]);
  for await (const chunk of stream) {
    const delta = typeof chunk.content === 'string' ? chunk.content : '';
    if (delta) yield { type: 'token' as const, delta };
  }
  yield { type: 'done' as const };
}
