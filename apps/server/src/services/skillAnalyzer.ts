import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { z } from 'zod';
import { createChatLLM } from './llm.js';
import type { ExtractedPackage } from './skillImporter.js';

/**
 * AI-driven analysis: read the unpacked markdown package and propose a Skill
 * schema (name/description/systemPrompt/temperature/topK/maxTokens). Returns a
 * draft only — the caller (`POST /skills/import`) hands it to the frontend
 * editor so the user can review and finalise via the existing `POST /skills`.
 *
 * Strategy: systemPrompt is assembled programmatically (SKILL.md body + appended
 * companion docs) to avoid LLM output-token limits when packages are large. The
 * LLM is only asked for small metadata fields (name, description, temperature,
 * topK, maxTokens) whose combined JSON output is well under 500 tokens.
 */

export const SkillDraftSchema = z.object({
  name: z.string().min(1).max(80),
  description: z.string().max(400).optional(),
  systemPrompt: z.string().min(1).max(20_000),
  temperature: z.number().min(0).max(2).optional(),
  topK: z.number().int().min(1).max(30).optional(),
  maxTokens: z.number().int().min(50).max(8000).optional(),
});

export type SkillDraft = z.infer<typeof SkillDraftSchema>;

export class SkillDraftError extends Error {
  raw?: string;
  details?: unknown;
  constructor(message: string, opts: { raw?: string; details?: unknown } = {}) {
    super(message);
    this.name = 'SkillDraftError';
    this.raw = opts.raw;
    this.details = opts.details;
  }
}

/**
 * Metadata-only: the LLM returns a small JSON with name/description/temperature/
 * topK/maxTokens. The systemPrompt is assembled from the raw markdown by
 * `buildSystemPrompt()` so we never ask the model to echo large strings back.
 */
const METADATA_ANALYZER_PROMPT = [
  'You read a Markdown "skill package" (a SKILL.md plus optional companion docs) and return a small JSON object with metadata for a Chat Skill.',
  '',
  'Fields to produce:',
  '- name (string, <= 80 chars): a short human-readable name. Prefer the YAML frontmatter `name:` if present.',
  '- description (string, <= 400 chars): one-sentence blurb. Prefer the YAML frontmatter `description:` if present.',
  '- temperature (number 0..2, optional): pick based on task style. Default 0.4 for tutoring/explanation, 0.2 for translation/strict-format, 0.5 for creative tasks.',
  '- topK (integer 1..30, optional): retrieval breadth. Default 8.',
  '- maxTokens (integer 50..8000, optional): response budget. Default 1500.',
  '',
  'Do NOT include a "systemPrompt" field — it is assembled separately.',
  '',
  'Output rules:',
  '- Respond with a SINGLE JSON object and nothing else. No prose, no code fences, no markdown.',
  '- The JSON must be parseable by JSON.parse on the first attempt.',
  '- If a field is uncertain, omit it (it will fall back to defaults) — do not invent.',
].join('\n');

/** Zod schema for the small metadata-only LLM response. */
const MetadataSchema = z.object({
  name: z.string().min(1).max(80).optional(),
  description: z.string().max(400).optional(),
  temperature: z.number().min(0).max(2).optional(),
  topK: z.number().int().min(1).max(30).optional(),
  maxTokens: z.number().int().min(50).max(8000).optional(),
});

/**
 * Strip YAML frontmatter delimiters (`---\n...\n---`) from a markdown string
 * and return the body text plus any parsed key→value pairs.
 */
function parseFrontmatter(content: string): {
  body: string;
  meta: Record<string, string>;
} {
  const meta: Record<string, string> = {};
  const fmMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!fmMatch) return { body: content, meta };
  for (const line of fmMatch[1].split('\n')) {
    const kv = line.match(/^([\w-]+)\s*:\s*(.*)/);
    if (kv) meta[kv[1].trim()] = kv[2].trim();
  }
  return { body: content.slice(fmMatch[0].length), meta };
}

/**
 * Build the systemPrompt from the package without LLM involvement:
 * 1. Use the SKILL.md body (frontmatter stripped) as the base.
 * 2. Append each companion doc under a clear separator.
 * Total is capped at MAX_SYSTEM_PROMPT_CHARS to stay within the schema limit.
 */
const MAX_SYSTEM_PROMPT_CHARS = 19_500;

function buildSystemPrompt(pkg: ExtractedPackage): string {
  const parts: string[] = [];
  let remaining = MAX_SYSTEM_PROMPT_CHARS;

  if (pkg.skillMd) {
    const { body } = parseFrontmatter(pkg.skillMd.content);
    const trimmed = body.trimStart().slice(0, remaining);
    parts.push(trimmed);
    remaining -= trimmed.length;
  }

  for (const e of pkg.entries) {
    if (remaining <= 200) break;
    if (pkg.skillMd && e.path === pkg.skillMd.path) continue;
    const separator = `\n\n---\n## ${e.path}\n\n`;
    if (separator.length >= remaining) break;
    const body = e.content.slice(0, remaining - separator.length);
    parts.push(separator + body);
    remaining -= separator.length + body.length;
  }

  return parts.join('').trim();
}

/**
 * Compact input fed to the LLM — only enough for metadata extraction.
 * We keep a short excerpt (≤ 4000 chars) of each file so the model can read
 * the frontmatter and enough prose to infer name/description/parameters.
 */
const MAX_METADATA_INPUT_CHARS = 8_000;

function buildMetadataInput(pkg: ExtractedPackage): string {
  const parts: string[] = [];
  let remaining = MAX_METADATA_INPUT_CHARS;

  if (pkg.skillMd) {
    const head = `=== ${pkg.skillMd.path} (excerpt) ===\n`;
    const body = pkg.skillMd.content.slice(0, Math.max(0, Math.min(4000, remaining - head.length)));
    parts.push(head + body);
    remaining -= head.length + body.length;
  }

  for (const e of pkg.entries) {
    if (remaining <= 200) break;
    if (pkg.skillMd && e.path === pkg.skillMd.path) continue;
    const head = `\n\n=== ${e.path} (excerpt) ===\n`;
    if (head.length >= remaining) break;
    const body = e.content.slice(0, Math.min(1000, remaining - head.length));
    parts.push(head + body);
    remaining -= head.length + body.length;
  }

  return parts.join('');
}

/**
 * Strip code fences and isolate the first balanced `{...}` block. Some models
 * wrap JSON in ```json ... ``` despite instructions; this lets us recover.
 */
function extractJsonBlob(raw: string): string {
  const fence = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = (fence ? fence[1] : raw).trim();
  let depth = 0;
  let start = -1;
  for (let i = 0; i < candidate.length; i++) {
    const ch = candidate[i];
    if (ch === '{') {
      if (depth === 0) start = i;
      depth++;
    } else if (ch === '}') {
      depth--;
      if (depth === 0 && start !== -1) {
        return candidate.slice(start, i + 1);
      }
    }
  }
  return candidate;
}

/** Apply schema-level defaults documented in the analyzer prompt. */
function withDefaults(draft: SkillDraft): SkillDraft {
  return {
    ...draft,
    temperature: draft.temperature ?? 0.4,
    topK: draft.topK ?? 8,
    maxTokens: draft.maxTokens ?? 1500,
  };
}

export async function analyzeSkillDraft(pkg: ExtractedPackage): Promise<SkillDraft> {
  // ── Phase 1: build systemPrompt programmatically ─────────────────────────
  // Assembling content ourselves avoids asking the LLM to echo large strings
  // back as JSON, which is the primary cause of output-token truncation errors.
  const systemPrompt = buildSystemPrompt(pkg);
  if (!systemPrompt.trim()) {
    throw new SkillDraftError('Empty markdown input — nothing to analyse');
  }

  // ── Phase 2: extract frontmatter metadata without LLM ────────────────────
  const frontmatterMeta: Record<string, string> =
    pkg.skillMd ? parseFrontmatter(pkg.skillMd.content).meta : {};

  // ── Phase 3: ask LLM only for the small metadata fields ──────────────────
  // The metadata JSON is tiny (< 200 tokens output) so it will never truncate.
  const metadataInput = buildMetadataInput(pkg);
  let llmMeta: z.infer<typeof MetadataSchema> = {};

  if (metadataInput.trim()) {
    const llm = await createChatLLM({
      temperature: 0.2,
      streaming: false,
      maxTokens: 512, // metadata JSON is tiny; 512 is more than enough
    });

    const messages = [
      new SystemMessage(METADATA_ANALYZER_PROMPT),
      new HumanMessage(metadataInput),
    ];

    let raw = '';
    try {
      const res = await llm.invoke(messages);
      raw =
        typeof res.content === 'string'
          ? res.content
          : Array.isArray(res.content)
            ? res.content
                .map((c) => (typeof c === 'string' ? c : (c as any)?.text ?? ''))
                .join('')
            : String(res.content ?? '');
    } catch {
      // LLM metadata call failed — fall back gracefully to frontmatter + defaults.
    }

    if (raw.trim()) {
      const blob = extractJsonBlob(raw);
      try {
        const parsed = JSON.parse(blob);
        const result = MetadataSchema.safeParse(parsed);
        if (result.success) llmMeta = result.data;
      } catch {
        // Ignore parse errors — fall back to frontmatter + defaults.
      }
    }
  }

  // ── Phase 4: merge frontmatter > LLM metadata > defaults ─────────────────
  const name =
    frontmatterMeta['name'] ?? llmMeta.name ?? pkg.skillMd?.path ?? 'Unnamed Skill';
  const description =
    frontmatterMeta['description'] ?? llmMeta.description;

  const draft: SkillDraft = {
    name: name.slice(0, 80),
    ...(description ? { description: description.slice(0, 400) } : {}),
    systemPrompt,
    ...(llmMeta.temperature !== undefined ? { temperature: llmMeta.temperature } : {}),
    ...(llmMeta.topK !== undefined ? { topK: llmMeta.topK } : {}),
    ...(llmMeta.maxTokens !== undefined ? { maxTokens: llmMeta.maxTokens } : {}),
  };

  const result = SkillDraftSchema.safeParse(draft);
  if (!result.success) {
    throw new SkillDraftError('Skill draft failed schema validation', {
      details: result.error.flatten(),
    });
  }

  return withDefaults(result.data);
}
