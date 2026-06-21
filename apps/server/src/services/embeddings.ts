import { getProviderConfig, MissingApiKeyError } from './settingsStore.js';

/**
 * OpenAI-compatible text embeddings. Provider, base URL, key and model name
 * are read from the settings store (file > env > built-in default), so users
 * can switch between Qwen DashScope, OpenAI, SiliconFlow, etc. via the
 * Settings dialog without restarting the server.
 *
 * Throws MissingApiKeyError when no key is configured so route handlers can
 * surface a friendly `code: 'NO_API_KEY'` error to the frontend.
 */
export async function embedTexts(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];
  const cfg = await getProviderConfig('embedding');
  if (!cfg.apiKey) throw new MissingApiKeyError('embedding');

  const res = await fetch(`${cfg.baseURL}/embeddings`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${cfg.apiKey}`,
    },
    body: JSON.stringify({
      model: cfg.model,
      input: texts,
      encoding_format: 'float',
    }),
  });

  if (!res.ok) {
    const msg = await res.text().catch(() => '');
    throw new Error(`Embedding failed: ${res.status} ${msg}`);
  }

  const json = (await res.json()) as {
    data: { embedding: number[]; index: number }[];
  };
  // Keep input order
  return json.data
    .slice()
    .sort((a, b) => a.index - b.index)
    .map((d) => d.embedding);
}

export async function embedQuery(text: string): Promise<number[]> {
  const [v] = await embedTexts([text]);
  return v;
}
