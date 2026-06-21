import { create } from 'zustand';
import {
  streamSSE,
  getSlidevStatus,
  slidevDownloadUrl,
  saveSlidevMarkdown,
} from '../lib/api.js';

const AUTOSAVE_DEBOUNCE_MS = 800;

// Module-scoped debounce timer; the editor mounts/unmounts but we want a
// single in-flight save per documentId.
let saveTimer = null;

function scheduleAutoSave(get) {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    saveTimer = null;
    const { dirty, generating } = get();
    if (!dirty || generating) return;
    void get().save();
  }, AUTOSAVE_DEBOUNCE_MS);
}

function cancelAutoSave() {
  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }
}

/**
 * Store for Slidev PPT generation + editing state, scoped per document.
 * Auto-save debounce is module-scoped to coalesce keystrokes.
 */
export const useSlidevStore = create((set, get) => ({
  markdown: '',
  generating: false,
  error: null,
  documentId: null,
  status: '', // Current status message during generation
  screenshots: [], // Array of { page, url } for captured screenshots
  /**
   * Material metadata mirrored from the server (slideCount, language,
   * generationParams, updatedAt). Surfaced in the SlidevPanel header so
   * the user can see when the deck was last regenerated.
   */
  material: null,

  // Edit-mode bookkeeping
  dirty: false,
  saving: false,
  lastSavedAt: null,
  saveError: null,

  generate: async (documentId, options = {}) => {
    cancelAutoSave();
    set({
      markdown: '',
      generating: true,
      error: null,
      documentId,
      status: '',
      screenshots: [],
      dirty: false,
      saveError: null,
      material: null,
    });

    const body = {
      documentId,
      language: options.language || 'zh',
      ...(options.slideCount && { slideCount: options.slideCount }),
    };

    try {
      await streamSSE('/slidev/generate', body, (evt) => {
        if (evt.type === 'token') {
          set((s) => ({ markdown: s.markdown + evt.delta }));
        } else if (evt.type === 'status') {
          set({ status: evt.message });
        } else if (evt.type === 'screenshots') {
          set({ screenshots: evt.images });
        } else if (evt.type === 'done') {
          set({
            generating: false,
            markdown: evt.markdown || get().markdown,
            status: '',
            dirty: false,
            lastSavedAt: Date.now(),
          });
        } else if (evt.type === 'error') {
          set({ generating: false, error: evt.message, status: '' });
        }
      });
      // Stream ended
      set((s) => ({ generating: false, status: '' }));
    } catch (e) {
      set({ generating: false, error: e.message || 'Generation failed', status: '' });
    }
  },

  loadExisting: async (documentId) => {
    try {
      const result = await getSlidevStatus(documentId);
      if (result.exists) {
        set({
          markdown: result.markdown,
          documentId,
          error: null,
          screenshots: result.screenshots || [],
          dirty: false,
          saveError: null,
          lastSavedAt: Date.now(),
          material: result.material ?? null,
        });
      } else {
        set({ material: null });
      }
    } catch {
      // Ignore - no cached slides
    }
  },

  /**
   * Update markdown from the editor. Marks state dirty and schedules a
   * debounced auto-save. The left preview will re-render immediately.
   */
  setMarkdown: (md) => {
    if (md === get().markdown) return;
    set({ markdown: md, dirty: true, saveError: null });
    scheduleAutoSave(get);
  },

  /**
   * Flush any pending auto-save and POST immediately. Safe to call when
   * `dirty` is false (no-op).
   */
  save: async () => {
    cancelAutoSave();
    const { documentId, markdown, dirty, saving } = get();
    if (!documentId || saving || !dirty) return;
    set({ saving: true, saveError: null });
    try {
      const res = await saveSlidevMarkdown(documentId, markdown);
      // If the user kept typing while we were in flight, keep `dirty=true`
      // so the next debounce cycle persists the new content.
      const stillDirty = get().markdown !== markdown;
      set({
        saving: false,
        dirty: stillDirty,
        lastSavedAt: res?.savedAt ?? Date.now(),
      });
      if (stillDirty) scheduleAutoSave(get);
    } catch (e) {
      set({ saving: false, saveError: e.message || 'Save failed' });
    }
  },

  cancelAutoSave: () => cancelAutoSave(),

  downloadUrl: () => {
    const { documentId } = get();
    if (!documentId) return null;
    return slidevDownloadUrl(documentId);
  },

  reset: () => {
    cancelAutoSave();
    set({
      markdown: '',
      generating: false,
      error: null,
      documentId: null,
      status: '',
      screenshots: [],
      dirty: false,
      saving: false,
      lastSavedAt: null,
      saveError: null,
      material: null,
    });
  },
}));
