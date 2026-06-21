import { nanoid } from 'nanoid';
import { getDb } from '../db/index.js';
import type { UserSkill } from '../db/schemas.js';

/**
 * NeDB-backed CRUD for user-defined skills. Built-in skills live in
 * skillRegistry.ts and are not persisted; this store handles only the
 * editable extras the user creates from the Settings dialog.
 */

export interface UserSkillInput {
  name: string;
  description?: string;
  systemPrompt: string;
  temperature?: number;
  topK?: number;
  maxTokens?: number;
}

interface SanitizedSkill {
  name: string;
  description: string;
  systemPrompt: string;
  temperature?: number;
  topK?: number;
  maxTokens?: number;
}

function sanitize(input: UserSkillInput): SanitizedSkill {
  return {
    name: input.name.trim(),
    description: (input.description ?? '').trim(),
    systemPrompt: input.systemPrompt.trim(),
    temperature:
      typeof input.temperature === 'number' && Number.isFinite(input.temperature)
        ? Math.max(0, Math.min(2, input.temperature))
        : undefined,
    topK:
      typeof input.topK === 'number' && Number.isInteger(input.topK)
        ? Math.max(1, Math.min(30, input.topK))
        : undefined,
    maxTokens:
      typeof input.maxTokens === 'number' && Number.isInteger(input.maxTokens)
        ? Math.max(50, Math.min(8000, input.maxTokens))
        : undefined,
  };
}

export async function listUserSkills(): Promise<UserSkill[]> {
  const { userSkills } = getDb();
  const rows = await userSkills.findAsync<UserSkill>({}).sort({ updatedAt: -1 });
  return rows as UserSkill[];
}

export async function getUserSkill(id: string): Promise<UserSkill | null> {
  const { userSkills } = getDb();
  const row = await userSkills.findOneAsync<UserSkill>({ _id: id });
  return (row as UserSkill) ?? null;
}

export async function createUserSkill(input: UserSkillInput): Promise<UserSkill> {
  const { userSkills } = getDb();
  const clean = sanitize(input);
  if (!clean.name) throw new Error('Skill name is required');
  if (!clean.systemPrompt) throw new Error('Skill systemPrompt is required');
  const now = Date.now();
  const row: UserSkill = {
    _id: `usr-${nanoid(10)}`,
    name: clean.name,
    description: clean.description,
    systemPrompt: clean.systemPrompt,
    temperature: clean.temperature,
    topK: clean.topK,
    maxTokens: clean.maxTokens,
    createdAt: now,
    updatedAt: now,
  };
  await userSkills.insertAsync(row);
  return row;
}

export async function updateUserSkill(
  id: string,
  patch: Partial<UserSkillInput>,
): Promise<UserSkill | null> {
  const existing = await getUserSkill(id);
  if (!existing) return null;
  const merged = sanitize({
    name: patch.name ?? existing.name,
    description: patch.description ?? existing.description,
    systemPrompt: patch.systemPrompt ?? existing.systemPrompt,
    temperature:
      patch.temperature !== undefined ? patch.temperature : existing.temperature,
    topK: patch.topK !== undefined ? patch.topK : existing.topK,
    maxTokens:
      patch.maxTokens !== undefined ? patch.maxTokens : existing.maxTokens,
  });
  const next: UserSkill = {
    ...existing,
    name: merged.name,
    description: merged.description,
    systemPrompt: merged.systemPrompt,
    temperature: merged.temperature,
    topK: merged.topK,
    maxTokens: merged.maxTokens,
    updatedAt: Date.now(),
  };
  const { userSkills } = getDb();
  await userSkills.updateAsync({ _id: id }, next, {});
  return next;
}

export async function deleteUserSkill(id: string): Promise<boolean> {
  const { userSkills } = getDb();
  const removed = await userSkills.removeAsync({ _id: id }, {});
  return removed > 0;
}
