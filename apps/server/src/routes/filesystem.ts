import type { FastifyInstance } from 'fastify';
import fsp from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

/**
 * Lesson 8 (revision): server-side filesystem browser used by the third
 * "Browse" import tab in OpenDocumentDialog. Returns a single directory
 * listing per request — the client expands sub-folders lazily, so the
 * payload stays small even for huge trees.
 *
 * Scope of exposure: the entire local filesystem (root `/`). This is a
 * dev-only convenience endpoint — running the server with this route open
 * to the public network is unsafe. A symlink-following constraint and
 * EACCES tolerance keep listing predictable on Linux.
 */

type FsEntry = {
  name: string;
  type: 'file' | 'dir';
  size?: number;
  modified?: number;
};

/** Suggest a handful of useful starting points for the tree's root view. */
async function listRoots(): Promise<FsEntry[]> {
  const candidates = new Set<string>();
  candidates.add('/');
  candidates.add(os.homedir());
  // /workspace is the common container-mount point in this repo.
  candidates.add('/workspace');
  candidates.add('/tmp');

  const out: FsEntry[] = [];
  for (const p of candidates) {
    try {
      const stat = await fsp.stat(p);
      if (stat.isDirectory()) {
        out.push({
          name: p,
          type: 'dir',
          modified: stat.mtimeMs,
        });
      }
    } catch {
      // Skip missing/inaccessible candidates.
    }
  }
  return out;
}

/**
 * Normalise + sanity-check a caller-supplied path. We do NOT restrict to a
 * single root (per user choice: filesystem root /), but we still reject
 * non-absolute paths to keep behaviour predictable.
 */
function normaliseDir(raw: string | undefined): string | null {
  if (!raw) return null;
  // Tolerate `~` shorthand for the server-side home.
  let p = raw.trim();
  if (p === '~' || p.startsWith('~/')) {
    p = path.join(os.homedir(), p.slice(1));
  }
  if (!path.isAbsolute(p)) return null;
  // path.resolve collapses ./.. segments — eliminates redundant traversal.
  return path.resolve(p);
}

export async function filesystemRoutes(app: FastifyInstance) {
  /**
   * GET /api/filesystem/browse?path=/some/dir
   *
   * If `path` is omitted, returns a curated set of root suggestions
   * (filesystem root, $HOME, /workspace, /tmp) so the UI can render a
   * landing view without forcing the user to type.
   *
   * The listing only surfaces directories and files whose lowercased name
   * ends with `.pdf`. Everything else is filtered out server-side — keeps
   * the JSON payload small and the UI tightly focused on the import use
   * case. Hidden entries (leading `.`) are surfaced; the client can choose
   * whether to render them.
   */
  app.get<{ Querystring: { path?: string } }>(
    '/filesystem/browse',
    async (req, reply) => {
      const raw = req.query?.path;
      if (!raw) {
        const roots = await listRoots();
        return {
          path: null,
          parent: null,
          isRoot: true,
          entries: roots,
          roots: roots.map((r) => r.name),
        };
      }

      const dir = normaliseDir(raw);
      if (!dir) {
        return reply.code(400).send({
          error: 'path must be an absolute filesystem path',
        });
      }

      let stat;
      try {
        stat = await fsp.stat(dir);
      } catch (e: any) {
        const code = e?.code === 'ENOENT' ? 404 : 400;
        return reply
          .code(code)
          .send({ error: e?.message ?? 'cannot stat path' });
      }
      if (!stat.isDirectory()) {
        return reply.code(400).send({ error: 'path is not a directory' });
      }

      let dirents;
      try {
        dirents = await fsp.readdir(dir, { withFileTypes: true });
      } catch (e: any) {
        // EACCES is common when walking system dirs — surface it nicely so
        // the UI can show a "permission denied" badge instead of a hard
        // failure.
        return reply.code(403).send({
          error: e?.message ?? 'permission denied',
        });
      }

      const entries: FsEntry[] = [];
      for (const ent of dirents) {
        try {
          if (ent.isDirectory()) {
            entries.push({ name: ent.name, type: 'dir' });
          } else if (ent.isFile() && ent.name.toLowerCase().endsWith('.pdf')) {
            let size: number | undefined;
            let modified: number | undefined;
            try {
              const s = await fsp.stat(path.join(dir, ent.name));
              size = s.size;
              modified = s.mtimeMs;
            } catch {
              // best effort metadata
            }
            entries.push({ name: ent.name, type: 'file', size, modified });
          }
          // Skip sockets, devices, symlinks-to-nowhere, etc.
        } catch {
          // best-effort; skip unreadable dirents
        }
      }

      // Folders first, then files, each alpha-sorted (case-insensitive).
      entries.sort((a, b) => {
        if (a.type !== b.type) return a.type === 'dir' ? -1 : 1;
        return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
      });

      const parent = path.dirname(dir);
      return {
        path: dir,
        parent: parent === dir ? null : parent,
        isRoot: dir === path.parse(dir).root,
        entries,
      };
    },
  );
}
