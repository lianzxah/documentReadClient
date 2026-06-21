import { connect, type Connection, type Table } from '@lancedb/lancedb';
import { config } from '../config.js';
import type { EmbeddedChunk, RetrievedChunk } from '../types.js';

let _conn: Connection | null = null;

async function conn(): Promise<Connection> {
  if (!_conn) _conn = await connect(config.LANCEDB_PATH);
  return _conn;
}

function tableName(documentId: string) {
  return `doc_${documentId.replace(/[^a-zA-Z0-9_]/g, '_')}`;
}

/**
 * Create (or recreate) the document's vector table and insert chunks.
 * LanceDB infers schema from the first row, including the vector dimension.
 */
export async function upsertChunks(documentId: string, chunks: EmbeddedChunk[]) {
  if (chunks.length === 0) return;
  const db = await conn();
  const name = tableName(documentId);
  const rows = chunks.map((c) => ({
    id: c.id,
    documentId: c.documentId,
    page: c.page,
    text: c.text,
    vector: c.vector,
  }));
  const existing = await db.tableNames();
  let table: Table;
  if (existing.includes(name)) {
    table = await db.openTable(name);
    await table.add(rows);
  } else {
    table = await db.createTable(name, rows);
  }
}

export async function searchChunks(
  documentId: string,
  queryVector: number[],
  topK = 6,
): Promise<RetrievedChunk[]> {
  const db = await conn();
  const name = tableName(documentId);
  const names = await db.tableNames();
  if (!names.includes(name)) return [];
  const table = await db.openTable(name);
  const res = await table.vectorSearch(queryVector).limit(topK).toArray();
  return res.map((r: any) => ({
    id: r.id,
    documentId: r.documentId,
    page: Number(r.page),
    text: r.text,
    // LanceDB returns `_distance` (lower is better). Convert to a rough score.
    score: typeof r._distance === 'number' ? 1 / (1 + r._distance) : 0,
  }));
}

export async function hasDocumentIndex(documentId: string): Promise<boolean> {
  const db = await conn();
  const names = await db.tableNames();
  return names.includes(tableName(documentId));
}

/**
 * Drop a document's vector table. Used by `DELETE /documents/:id` to fully
 * decommission a document. No-op when the table doesn't exist.
 */
export async function dropDocumentIndex(documentId: string): Promise<void> {
  const db = await conn();
  const name = tableName(documentId);
  const names = await db.tableNames();
  if (!names.includes(name)) return;
  await db.dropTable(name);
}
