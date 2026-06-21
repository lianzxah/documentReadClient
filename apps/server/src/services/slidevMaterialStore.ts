import { nanoid } from 'nanoid';
import { getDb } from '../db/index.js';
import type { SlidevMaterial } from '../db/schemas.js';

/**
 * Slidev material metadata. The markdown content itself stays on disk under
 * {SLIDEV_DIR}/{documentId}.md (path stored in `filePath` for traceability);
 * NeDB only tracks the descriptive index so the UI can show "last generated /
 * slide count / language / generation params" without opening the file.
 */

/**
 * Count the slides in a Slidev markdown document. Slidev separates slides
 * with a `---` line; the first occurrence at offset 0 is the front-matter
 * fence and is therefore not a separator.
 */
export function countSlides(markdown: string): number {
  if (!markdown.trim()) return 0;
  const fenceRe = /^---\s*$/gm;
  let count = 0;
  let m: RegExpExecArray | null;
  while ((m = fenceRe.exec(markdown)) !== null) {
    if (m.index === 0) continue; // opening front-matter fence
    count += 1;
  }
  // `---` separators delimit slides between two blocks of markdown, so the
  // total is separators + 1 when there is any non-empty content. If there is
  // no separator at all, the doc still represents a single slide.
  return count + 1;
}

export async function getMaterial(
  documentId: string,
): Promise<SlidevMaterial | null> {
  const { slidevMaterials } = getDb();
  const row = await slidevMaterials.findOneAsync<SlidevMaterial>({
    documentId,
  });
  return (row as SlidevMaterial) ?? null;
}

export async function upsertOnGenerate(args: {
  documentId: string;
  title?: string;
  language: 'zh' | 'en';
  slideCount: number;
  generationParams?: { language: 'zh' | 'en'; slideCount?: number };
  filePath: string;
}): Promise<SlidevMaterial> {
  const { slidevMaterials } = getDb();
  const existing = await getMaterial(args.documentId);
  const now = Date.now();
  const next: SlidevMaterial = {
    _id: existing?._id ?? nanoid(12),
    documentId: args.documentId,
    title: args.title ?? existing?.title ?? args.documentId,
    language: args.language,
    slideCount: args.slideCount,
    filePath: args.filePath,
    lastGenerationParams: args.generationParams,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };
  await slidevMaterials.updateAsync({ documentId: args.documentId }, next, {
    upsert: true,
  });
  return next;
}

export async function touchOnEdit(
  documentId: string,
  slideCount: number,
): Promise<SlidevMaterial | null> {
  const { slidevMaterials } = getDb();
  const existing = await getMaterial(documentId);
  if (!existing) return null;
  await slidevMaterials.updateAsync(
    { documentId },
    { $set: { slideCount, updatedAt: Date.now() } },
    {},
  );
  return getMaterial(documentId);
}

export async function deleteMaterial(documentId: string): Promise<void> {
  const { slidevMaterials } = getDb();
  await slidevMaterials.removeAsync({ documentId }, {});
}
