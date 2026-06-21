import { create } from 'zustand';
import { getSettings, saveSettings, testSettings } from '../lib/api.js';

/**
 * Settings store: holds the masked provider config + preset catalog fetched
 * from the backend. The backend is the source of truth (file > env > default),
 * so we do NOT use zustand/persist here. Raw API keys never live in the
 * browser — only `hasKey` + `keyPreview` come back from GET /settings.
 *
 * `draft` is the per-category form state that the SettingsDialog mutates.
 * It is seeded from the saved snapshot every time the dialog opens.
 */
const emptyProvider = { baseURL: '', model: '', hasKey: false, keyPreview: '' };

export const useSettingsStore = create((set, get) => ({
  loaded: false,
  loading: false,
  saving: false,
  error: null,
  // Saved (server-side) snapshot, keys masked.
  chat: emptyProvider,
  embedding: emptyProvider,
  presets: { chat: [], embedding: [] },

  async fetchSettings() {
    if (get().loading) return;
    set({ loading: true, error: null });
    try {
      const { settings, presets } = await getSettings();
      set({
        loaded: true,
        loading: false,
        chat: settings.chat,
        embedding: settings.embedding,
        presets,
      });
    } catch (e) {
      set({ loading: false, error: e?.message ?? 'failed to load settings' });
    }
  },

  /**
   * Send a patch to the backend. `patch` is `{ chat?: {...}, embedding?: {...} }`.
   * Caller decides apiKey semantics (undefined/empty=keep, null=clear, string=replace).
   */
  async saveSettings(patch) {
    set({ saving: true, error: null });
    try {
      const { settings } = await saveSettings(patch);
      set({
        saving: false,
        chat: settings.chat,
        embedding: settings.embedding,
      });
      return { ok: true };
    } catch (e) {
      set({ saving: false, error: e?.message ?? 'failed to save settings' });
      return { ok: false, error: e?.message };
    }
  },

  async testProvider(kind, draft) {
    return testSettings(kind, draft);
  },
}));
