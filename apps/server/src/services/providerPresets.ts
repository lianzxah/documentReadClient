/**
 * Built-in provider presets surfaced to the Settings dialog. The frontend
 * uses these to populate the right-hand "available models" pane and to
 * pre-fill base URL / model name when the user picks a card.
 *
 * All providers exposed here speak the OpenAI-compatible REST shape so the
 * single `ChatOpenAI` / `${baseURL}/embeddings` adapter pair handles them.
 */

export interface ProviderPreset {
  id: string;
  label: string;
  baseURL: string;
  models: string[];
}

export const CHAT_PRESETS: ProviderPreset[] = [
  {
    id: 'deepseek',
    label: 'DeepSeek',
    baseURL: 'https://api.deepseek.com',
    models: ['deepseek-chat', 'deepseek-reasoner'],
  },
  {
    id: 'openai',
    label: 'OpenAI',
    baseURL: 'https://api.openai.com/v1',
    models: ['gpt-4o-mini', 'gpt-4o'],
  },
  {
    id: 'qwen',
    label: 'Qwen (DashScope)',
    baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    models: ['qwen-plus', 'qwen-max', 'qwen-vl-max'],
  },
  {
    id: 'moonshot',
    label: 'Moonshot',
    baseURL: 'https://api.moonshot.cn/v1',
    models: ['moonshot-v1-8k', 'moonshot-v1-32k'],
  },
  {
    id: 'siliconflow',
    label: 'SiliconFlow',
    baseURL: 'https://api.siliconflow.cn/v1',
    models: ['deepseek-ai/DeepSeek-V2.5'],
  },
];

export const EMBEDDING_PRESETS: ProviderPreset[] = [
  {
    id: 'qwen',
    label: 'Qwen (DashScope)',
    baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    models: ['text-embedding-v3', 'text-embedding-v2'],
  },
  {
    id: 'openai',
    label: 'OpenAI',
    baseURL: 'https://api.openai.com/v1',
    models: ['text-embedding-3-small', 'text-embedding-3-large'],
  },
  {
    id: 'siliconflow',
    label: 'SiliconFlow',
    baseURL: 'https://api.siliconflow.cn/v1',
    models: ['BAAI/bge-large-zh-v1.5'],
  },
];
