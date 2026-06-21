import path from 'node:path';
import AdmZip from 'adm-zip';

/**
 * ZIP unpacking + sanitisation for skill packages. No LLM calls here — that
 * lives in `skillAnalyzer.ts`. The shape mirrors the `.qoder/skills/<name>/`
 * layout: a SKILL.md (with optional YAML frontmatter) plus optional companion
 * docs (CONTEXT.md, ADRs, etc.).
 */

export interface MarkdownEntry {
  /** POSIX-style path relative to the archive root. */
  path: string;
  content: string;
}

export interface ExtractedPackage {
  /** Every accepted markdown file (capped). */
  entries: MarkdownEntry[];
  /** The chosen SKILL.md (case-insensitive match) or the largest .md. */
  skillMd?: MarkdownEntry;
}

/** ZIP magic bytes: PK\x03\x04. Reject anything that isn't a real archive. */
export function looksLikeZip(buf: Buffer): boolean {
  return (
    buf.length >= 4 &&
    buf[0] === 0x50 &&
    buf[1] === 0x4b &&
    buf[2] === 0x03 &&
    buf[3] === 0x04
  );
}

const MAX_ENTRIES = 100;
const MAX_ENTRY_BYTES = 1 * 1024 * 1024; // 1 MB per file

/**
 * Block path-traversal: any entry whose normalised POSIX path escapes the
 * staging root or starts with `/` is rejected. We never write to disk so
 * zip-slip's filesystem impact is zero, but we still want to refuse hostile
 * archives before passing their contents to the LLM.
 */
function safeRelativePath(rawName: string): string | null {
  if (!rawName || rawName.endsWith('/')) return null; // directories
  // Some zip producers use backslashes on Windows; normalise.
  const unified = rawName.replace(/\\/g, '/');
  if (path.posix.isAbsolute(unified)) return null;
  const normalised = path.posix.normalize(unified);
  if (normalised.startsWith('../') || normalised === '..') return null;
  if (normalised.split('/').includes('..')) return null;
  return normalised;
}

export function extractMarkdownFromZip(buf: Buffer): ExtractedPackage {
  if (!looksLikeZip(buf)) {
    throw new Error('Uploaded file is not a valid ZIP archive');
  }

  let zip: AdmZip;
  try {
    zip = new AdmZip(buf);
  } catch (e: any) {
    throw new Error(`Failed to parse ZIP archive: ${e?.message ?? 'unknown'}`);
  }

  const rawEntries = zip.getEntries();
  if (rawEntries.length > MAX_ENTRIES) {
    throw new Error(
      `Archive has too many entries (${rawEntries.length} > ${MAX_ENTRIES})`,
    );
  }

  const entries: MarkdownEntry[] = [];
  for (const e of rawEntries) {
    if (e.isDirectory) continue;
    const rel = safeRelativePath(e.entryName);
    if (!rel) continue;
    if (!rel.toLowerCase().endsWith('.md')) continue;
    // header.size is uncompressed; guard before we decompress.
    if (e.header.size > MAX_ENTRY_BYTES) continue;
    let content: string;
    try {
      content = e.getData().toString('utf8');
    } catch {
      continue;
    }
    if (!content.trim()) continue;
    entries.push({ path: rel, content });
  }

  if (entries.length === 0) {
    throw new Error('No markdown content found in archive');
  }

  // Pick SKILL.md (case-insensitive, any depth). Otherwise fall back to the
  // largest .md since that's most likely the prose body of the skill.
  const skillMd =
    entries.find((e) => /(^|\/)SKILL\.md$/i.test(e.path)) ??
    [...entries].sort((a, b) => b.content.length - a.content.length)[0];

  return { entries, skillMd };
}
