import path from 'node:path';
import fs from 'node:fs/promises';
import Nedb from '@seald-io/nedb';
import { config } from '../config.js';
import type {
  ChatMessageRow,
  ChatSession,
  DocumentOverride,
  McpServerConfig,
  SlidevMaterial,
  UserSkill,
} from './schemas.js';

/**
 * NeDB datastores. Each collection persists to its own append-only datafile
 * under {DATA_DIR}/nedb/. We expose async-only handles (auto-loading on
 * construction) so callers don't have to think about loadDatabase().
 */

interface Db {
  sessions: Nedb<ChatSession>;
  messages: Nedb<ChatMessageRow>;
  slidevMaterials: Nedb<SlidevMaterial>;
  overrides: Nedb<DocumentOverride>;
  userSkills: Nedb<UserSkill>;
  mcpServers: Nedb<McpServerConfig>;
}

let _db: Db | null = null;

function makeStore<T extends { _id: string }>(filename: string): Nedb<T> {
  return new Nedb<T>({
    filename,
    autoload: true,
    timestampData: false,
  });
}

export async function initDb(): Promise<Db> {
  if (_db) return _db;
  const dir = config.NEDB_DIR;
  await fs.mkdir(dir, { recursive: true });

  const sessions = makeStore<ChatSession>(path.join(dir, 'chat_sessions.db'));
  const messages = makeStore<ChatMessageRow>(path.join(dir, 'chat_messages.db'));
  const slidevMaterials = makeStore<SlidevMaterial>(
    path.join(dir, 'slidev_materials.db'),
  );
  const overrides = makeStore<DocumentOverride>(
    path.join(dir, 'document_overrides.db'),
  );
  const userSkills = makeStore<UserSkill>(path.join(dir, 'user_skills.db'));
  const mcpServers = makeStore<McpServerConfig>(path.join(dir, 'mcp_servers.db'));

  // Wait for autoload to settle, then ensure indexes.
  await Promise.all([
    sessions.ensureIndexAsync({ fieldName: 'documentId' }),
    sessions.ensureIndexAsync({ fieldName: 'createdAt' }),
    messages.ensureIndexAsync({ fieldName: 'sessionId' }),
    messages.ensureIndexAsync({ fieldName: 'seq' }),
    slidevMaterials.ensureIndexAsync({ fieldName: 'documentId', unique: true }),
    overrides.ensureIndexAsync({ fieldName: 'documentId', unique: true }),
    userSkills.ensureIndexAsync({ fieldName: 'updatedAt' }),
    mcpServers.ensureIndexAsync({ fieldName: 'enabled' }),
  ]);

  _db = { sessions, messages, slidevMaterials, overrides, userSkills, mcpServers };
  return _db;
}

export function getDb(): Db {
  if (!_db) {
    throw new Error('Database has not been initialised. Call initDb() first.');
  }
  return _db;
}
