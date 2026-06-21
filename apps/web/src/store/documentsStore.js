import { create } from 'zustand';
import {
  listDocuments as apiListDocuments,
  deleteDocument as apiDeleteDocument,
  startDocumentIndexing as apiStartIndexing,
  getDocumentIndexStatus as apiIndexStatus,
} from '../lib/api.js';

/**
 * Documents store: caches the server-side list of ingested documents so the
 * Explorer side bar can show closed documents alongside the open tabs.
 *
 * Server is the source of truth; the store does NOT persist (a fetch on first
 * Explorer open repopulates the cache from `GET /documents`). After every
 * ingest / delete, callers should `refresh()` so the side bar stays accurate.
 *
 * Lesson 8 additions:
 * - Local uploads are stored with `source: 'local'` and `indexed: false` until
 *   the user explicitly triggers indexing. `indexingMap` tracks per-document
 *   poll state so the side bar can render a progress pill without bloating
 *   the persisted document list.
 */
const POLL_INTERVAL_MS = 1500;

export const useDocumentsStore = create((set, get) => ({
  items: [],
  loading: false,
  error: null,
  loaded: false,
  // documentId -> { status: 'running'|'error'|'idle', progress, error }
  indexingMap: {},

  refresh: async () => {
    if (get().loading) return;
    set({ loading: true, error: null });
    try {
      const { items } = await apiListDocuments();
      set({ items, loading: false, loaded: true });
    } catch (e) {
      set({ loading: false, error: e.message ?? 'failed to load documents' });
    }
  },

  remove: async (documentId) => {
    try {
      await apiDeleteDocument(documentId);
      set({
        items: get().items.filter((d) => d.documentId !== documentId),
      });
      // Also clear any tracked indexing state for the deleted doc.
      const { indexingMap } = get();
      if (indexingMap[documentId]) {
        const next = { ...indexingMap };
        delete next[documentId];
        set({ indexingMap: next });
      }
      return true;
    } catch (e) {
      set({ error: e.message ?? 'failed to delete document' });
      return false;
    }
  },

  /**
   * Kick off lazy RAG indexing for a local document and poll status until the
   * background job either completes or errors. Safe to call multiple times —
   * if indexing is already running for this doc, the call is a no-op.
   */
  triggerIndexing: async (documentId) => {
    const current = get().indexingMap[documentId];
    if (current?.status === 'running') return;
    set({
      indexingMap: {
        ...get().indexingMap,
        [documentId]: { status: 'running', progress: 0 },
      },
    });
    try {
      await apiStartIndexing(documentId);
    } catch (e) {
      set({
        indexingMap: {
          ...get().indexingMap,
          [documentId]: {
            status: 'error',
            error: e.message ?? 'failed to start indexing',
          },
        },
      });
      return;
    }
    // Poll until backend reports a non-running status.
    const poll = async () => {
      let status;
      try {
        status = await apiIndexStatus(documentId);
      } catch (e) {
        set({
          indexingMap: {
            ...get().indexingMap,
            [documentId]: {
              status: 'error',
              error: e.message ?? 'failed to read index status',
            },
          },
        });
        return;
      }
      const next = {
        status: status.status ?? 'idle',
        progress: status.progress ?? 0,
        error: status.error,
      };
      set({
        indexingMap: { ...get().indexingMap, [documentId]: next },
      });
      if (next.status === 'running') {
        setTimeout(poll, POLL_INTERVAL_MS);
      } else {
        // Refresh the list so `indexed` flips and the pill disappears.
        void get().refresh();
      }
    };
    setTimeout(poll, POLL_INTERVAL_MS);
  },
}));
