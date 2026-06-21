import { create } from 'zustand';
import {
  createSkill as apiCreateSkill,
  deleteSkill as apiDeleteSkill,
  getSkill as apiGetSkill,
  importSkillPackage as apiImportSkillPackage,
  listSkills as apiListSkills,
  updateSkill as apiUpdateSkill,
} from '../lib/api.js';

/**
 * Skills store. The list endpoint returns a flat catalogue of every skill
 * (built-in + user-defined). Built-ins are read-only; user skills support
 * full CRUD via SkillsManager.
 *
 * Each list item: { id, name, description, builtin, temperature?, topK?, maxTokens? }
 */
export const useSkillsStore = create((set, get) => ({
  items: [],
  loading: false,
  loaded: false,
  error: null,

  list: () => get().items,
  getById: (id) => get().items.find((s) => s.id === id) ?? null,

  fetch: async () => {
    if (get().loaded || get().loading) return get().items;
    set({ loading: true, error: null });
    try {
      const { items } = await apiListSkills();
      set({ items, loading: false, loaded: true });
      return items;
    } catch (e) {
      set({ loading: false, error: e?.message ?? 'failed to load skills' });
      return [];
    }
  },

  refresh: async () => {
    set({ loading: true, error: null });
    try {
      const { items } = await apiListSkills();
      set({ items, loading: false, loaded: true });
      return items;
    } catch (e) {
      set({ loading: false, error: e?.message ?? 'failed to load skills' });
      return get().items;
    }
  },

  /** Returns the full detail (incl. systemPrompt for user skills). */
  getDetail: async (id) => {
    return apiGetSkill(id);
  },

  create: async (body) => {
    const created = await apiCreateSkill(body);
    set((s) => ({ items: [...s.items, summary(created)] }));
    return created;
  },

  update: async (id, patch) => {
    const updated = await apiUpdateSkill(id, patch);
    set((s) => ({
      items: s.items.map((it) => (it.id === id ? summary(updated) : it)),
    }));
    return updated;
  },

  remove: async (id) => {
    await apiDeleteSkill(id);
    set((s) => ({ items: s.items.filter((it) => it.id !== id) }));
  },

  /**
   * Upload a .zip skill package and ask the backend (via LLM) to propose a
   * Skill schema. Returns `{ draft, sourceName }`. State is intentionally
   * untouched — the caller drives the SkillsManager editor and finalises
   * with `create()` after the user reviews.
   */
  importDraft: async (file) => {
    return apiImportSkillPackage(file);
  },
}));

function summary(detail) {
  return {
    id: detail.id,
    name: detail.name,
    description: detail.description,
    builtin: !!detail.builtin,
    temperature: detail.temperature,
    topK: detail.topK,
    maxTokens: detail.maxTokens,
  };
}
