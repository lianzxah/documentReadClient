/**
 * Skill registry. A "skill" is a named system-prompt template (plus optional
 * temperature / topK / maxTokens overrides) that shapes how the chat assistant
 * answers questions about the active document. Built-in skills live here in
 * code; user-defined skills are persisted in NeDB via skillStore.ts and merged
 * at lookup time by `getEffectiveSkill`.
 *
 * The composed system prompt sent to the LLM is:
 *   BASE_RAG_INSTRUCTIONS + skill.systemPrompt + CONTEXT
 * see ragGraph.ts for the exact composition.
 */

import { getUserSkill } from './skillStore.js';

export interface Skill {
  id: string;
  name: string;
  description: string;
  builtin: boolean;
  systemPrompt: string;
  temperature?: number;
  topK?: number;
  maxTokens?: number;
}

export const DEFAULT_SKILL_ID = 'detailed-tutor';

/**
 * Base instructions every skill inherits. Keeps formatting and citation
 * discipline consistent regardless of which skill is selected.
 */
export const BASE_RAG_INSTRUCTIONS =
  `You are a research assistant answering questions about a PDF the user is reading. ` +
  `Strictly ground every claim in the provided CONTEXT. If the context is insufficient, ` +
  `say so explicitly instead of guessing. Cite the page using the inline form [p.<num>] ` +
  `taken from the context headers. Use markdown freely (headings, lists, tables, fenced ` +
  `code blocks). Prefer concrete examples and step-by-step reasoning. Never fabricate page ` +
  `numbers or facts that are not present in the context.`;

export const BUILTIN_SKILLS: Skill[] = [
  {
    id: 'detailed-tutor',
    name: 'Detailed Tutor',
    description:
      'Default. Produces structured, instructional answers with examples and follow-ups.',
    builtin: true,
    temperature: 0.4,
    topK: 8,
    maxTokens: 1500,
    systemPrompt: [
      'ROLE: You are a meticulous tutor walking the reader through the material.',
      '',
      'OUTPUT FORMAT (always use these markdown sections, in this order):',
      '## Overview',
      '1-2 sentence direct answer to the question.',
      '',
      '## Detailed Explanation',
      'Multi-paragraph walk-through. Define jargon on first use. Use sub-headings if the answer has multiple aspects. Embed concrete examples drawn from the context (quote short phrases verbatim when helpful). Add fenced code blocks for code/formulas.',
      '',
      '## Key Points',
      '- 3 to 6 bullet takeaways the reader should remember.',
      '',
      '## Sources',
      'Inline [p.N] citations are mandatory throughout. End with a "Sources: [p.N], [p.M], ..." line listing every page you actually used.',
      '',
      '## Follow-ups',
      '2-3 short questions the reader could ask next, phrased from the user perspective.',
      '',
      'LENGTH: Aim for 400-700 words unless the question is trivial. Never answer in a single short paragraph.',
    ].join('\n'),
  },
  {
    id: 'summarizer',
    name: 'Summarizer',
    description:
      'Produces a TL;DR plus a structured outline of the relevant pages.',
    builtin: true,
    temperature: 0.3,
    topK: 12,
    maxTokens: 1800,
    systemPrompt: [
      'ROLE: You are summarising a portion of the document.',
      '',
      'OUTPUT FORMAT:',
      '## TL;DR',
      '2-3 sentence high-density summary.',
      '',
      '## Outline',
      'Bulleted hierarchy of the main ideas. Each leaf bullet ends with a [p.N] citation.',
      '',
      '## Page Highlights',
      'For each page that contributed, a short paragraph "p.N — <one-line theme>: <2-3 sentence highlight>".',
      '',
      'Stay strictly within what the context supports.',
    ].join('\n'),
  },
  {
    id: 'quiz-generator',
    name: 'Quiz Generator',
    description: 'Generates 5 study questions with answers grounded in the document.',
    builtin: true,
    temperature: 0.5,
    topK: 10,
    maxTokens: 2000,
    systemPrompt: [
      'ROLE: You are a quiz author preparing the reader for an exam on this material.',
      '',
      'OUTPUT FORMAT: Produce exactly 5 question/answer pairs, numbered 1-5. For each:',
      '**Q1.** <question>',
      '**A1.** <2-4 sentence answer with at least one [p.N] citation>',
      '',
      'Mix difficulty: 2 recall, 2 conceptual, 1 application. Avoid yes/no questions. Do not include any other commentary.',
    ].join('\n'),
  },
  {
    id: 'translator',
    name: 'Translator',
    description: 'Bilingual answer. Auto-detects the user language and mirrors to the other.',
    builtin: true,
    temperature: 0.2,
    topK: 6,
    maxTokens: 1200,
    systemPrompt: [
      'ROLE: You are a bilingual assistant.',
      '',
      'OUTPUT FORMAT:',
      '## Answer (user language)',
      'Answer in whatever language the user asked in.',
      '',
      '## Translation',
      'Mirror the same answer in the OTHER of {English, Simplified Chinese}. Preserve [p.N] citations verbatim in both blocks.',
    ].join('\n'),
  },
  {
    id: 'note-taker',
    name: 'Note Taker',
    description: 'Outputs structured study notes (definitions, formulas, mnemonics).',
    builtin: true,
    temperature: 0.3,
    topK: 10,
    maxTokens: 1600,
    systemPrompt: [
      'ROLE: You are producing study notes from the document.',
      '',
      'OUTPUT FORMAT:',
      '## Definitions',
      '- **Term** — short definition [p.N]',
      '',
      '## Formulas / Key Equations',
      'Fenced code blocks for each. Include a one-line meaning. Skip this section if the document has none.',
      '',
      '## Step-by-step Procedures',
      'Numbered lists where the document describes a procedure.',
      '',
      '## Mnemonics & Memory Hooks',
      'Optional. Short, evocative phrases that capture the relationships. Skip if nothing fits.',
      '',
      'Every fact must carry a [p.N] citation.',
    ].join('\n'),
  },
];

const BUILTIN_BY_ID = new Map(BUILTIN_SKILLS.map((s) => [s.id, s]));

export function isBuiltinSkillId(id: string): boolean {
  return BUILTIN_BY_ID.has(id);
}

export function listBuiltinSkills(): Skill[] {
  return BUILTIN_SKILLS;
}

/**
 * Resolve a skill id to a fully populated Skill. Resolution order:
 *   user skill in NeDB > built-in skill > built-in default.
 * Always returns a Skill so callers don't need to null-check.
 */
export async function getEffectiveSkill(id?: string | null): Promise<Skill> {
  if (id) {
    const builtin = BUILTIN_BY_ID.get(id);
    if (builtin) return builtin;
    const user = await getUserSkill(id);
    if (user) {
      return {
        id: user._id,
        name: user.name,
        description: user.description,
        builtin: false,
        systemPrompt: user.systemPrompt,
        temperature: user.temperature,
        topK: user.topK,
        maxTokens: user.maxTokens,
      };
    }
  }
  return BUILTIN_BY_ID.get(DEFAULT_SKILL_ID)!;
}

/**
 * Composed skill set: a primary skill that drives output format + parameters,
 * plus zero or more auxiliary skills whose systemPrompts are appended as
 * supplementary instructions.
 */
export interface ComposedSkillSet {
  primary: Skill;
  auxiliaries: Skill[];
}

/**
 * Resolve a primary + auxiliary skill combination. The primary determines
 * temperature/topK/maxTokens/output format. Auxiliaries only contribute their
 * systemPrompt as supplementary instructions.
 *
 * Built-in skills cannot be used as auxiliaries (they are opinionated about
 * output format and would conflict). Only user-defined skills may be auxiliary.
 */
export async function getComposedSkills(
  primaryId?: string | null,
  auxiliaryIds?: string[],
): Promise<ComposedSkillSet> {
  const primary = await getEffectiveSkill(primaryId);
  const auxiliaries: Skill[] = [];

  if (auxiliaryIds && auxiliaryIds.length > 0) {
    for (const id of auxiliaryIds) {
      // Skip built-in skills — they cannot be auxiliaries
      if (BUILTIN_BY_ID.has(id)) continue;
      const user = await getUserSkill(id);
      if (user) {
        auxiliaries.push({
          id: user._id,
          name: user.name,
          description: user.description,
          builtin: false,
          systemPrompt: user.systemPrompt,
          temperature: user.temperature,
          topK: user.topK,
          maxTokens: user.maxTokens,
        });
      }
    }
  }

  return { primary, auxiliaries };
}
