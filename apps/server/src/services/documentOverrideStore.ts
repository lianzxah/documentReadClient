import { nanoid } from 'nanoid';
import { getDb } from '../db/index.js';
import type { DocumentOverride } from '../db/schemas.js';

/**
 * Per-document model overrides. Overrides supplement the global `settings.json`
 * config: when present, they replace the chat (or embedding) model for any
 * call that flows through `createChatLLM(opts, { documentId })`.
 *
 * Note: the embedding model field is plumbed for symmetry but only honoured
 * during ingest. Search-time embeddings must use the same model that produced
 * the LanceDB index, otherwise the vector dimension or distribution mismatches.
 */

export interface OverridesPatch {
  chat?: { model?: string | null };
  embedding?: { model?: string | null };
}

export interface OverridesPublic {
  chat?: { model?: string };
  embedding?: { model?: string };
}

export async function getOverrides(
  documentId: string,
): Promise<DocumentOverride | null> {
  const { overrides } = getDb();
  const row = await overrides.findOneAsync<DocumentOverride>({ documentId });
  return (row as DocumentOverride) ?? null;
}

export async function getPublicOverrides(
  documentId: string,
): Promise<OverridesPublic> {
  const row = await getOverrides(documentId);
  if (!row) return {};
  const out: OverridesPublic = {};
  if (row.chat?.model) out.chat = { model: row.chat.model };
  if (row.embedding?.model) out.embedding = { model: row.embedding.model };
  return out;
}

function applyPatchSection(
  current: { model?: string } | undefined,
  patch: { model?: string | null } | undefined,
): { model?: string } | undefined {
  if (patch === undefined) return current;
  const next = { ...(current ?? {}) };
  if (patch.model === null || patch.model === '') {
    delete next.model;
  } else if (patch.model !== undefined) {
    next.model = patch.model;
  }
  return next.model ? next : undefined;
}

export async function setOverrides(
  documentId: string,
  patch: OverridesPatch,
): Promise<OverridesPublic> {
  const { overrides } = getDb();
  const existing = await getOverrides(documentId);

  const merged: DocumentOverride = {
    _id: existing?._id ?? nanoid(12),
    documentId,
    chat: applyPatchSection(existing?.chat, patch.chat),
    embedding: applyPatchSection(existing?.embedding, patch.embedding),
    updatedAt: Date.now(),
  };

  // If both sections are empty after applying the patch, drop the row entirely.
  if (!merged.chat && !merged.embedding) {
    if (existing) await overrides.removeAsync({ documentId }, {});
    return {};
  }

  await overrides.updateAsync(
    { documentId },
    merged,
    { upsert: true },
  );
  return getPublicOverrides(documentId);
}

/** Resolve the chat model override for a document (string or undefined). */
export async function getChatModelOverride(
  documentId: string,
): Promise<string | undefined> {
  const row = await getOverrides(documentId);
  return row?.chat?.model;
}

/** Resolve the embedding model override for a document (string or undefined). */
export async function getEmbeddingModelOverride(
  documentId: string,
): Promise<string | undefined> {
  const row = await getOverrides(documentId);
  return row?.embedding?.model;
}
