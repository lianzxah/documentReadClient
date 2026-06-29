import { useEffect, useCallback } from 'react';
import { usePptxStore } from '../../../store/pptxStore';

/**
 * useHotkeys - Global keyboard shortcut handler for the PPTX editor.
 * Listens to document-level keydown events and dispatches actions
 * based on key combinations. Respects the `disableHotkeys` flag
 * (set when inline text editor is focused).
 *
 * Shortcuts:
 * - Delete/Backspace: Delete selected element
 * - Arrow keys: Move element (1px, or 10px with Shift)
 * - Ctrl+C: Copy element
 * - Ctrl+X: Cut element
 * - Ctrl+V: Paste element
 * - Ctrl+D: Duplicate element
 * - Ctrl+Z: Undo
 * - Ctrl+Y / Ctrl+Shift+Z: Redo
 * - Escape: Exit edit mode / deselect
 * - Tab: Cycle through elements
 */
export function useHotkeys() {
  const keydownHandler = useCallback((e) => {
    const state = usePptxStore.getState();
    const {
      disableHotkeys,
      activeElementId,
      editingElementId,
      currentSlideIndex,
      slides,
    } = state;

    // If hotkeys are disabled (inline editor focused), only handle Escape
    if (disableHotkeys) {
      if (e.key === 'Escape') {
        e.preventDefault();
        state.setEditingElementId(null);
        state.setDisableHotkeys(false);
      }
      return;
    }

    const { ctrlKey, shiftKey, metaKey, altKey } = e;
    const ctrlOrMeta = ctrlKey || metaKey;
    const key = e.key;

    // --- Escape: exit editing or deselect ---
    if (key === 'Escape') {
      e.preventDefault();
      if (editingElementId) {
        state.setEditingElementId(null);
        state.pushHistory();
      } else {
        state.setActiveElementId(null);
      }
      return;
    }

    // --- Ctrl+Z: Undo ---
    if (ctrlOrMeta && !shiftKey && key === 'z') {
      e.preventDefault();
      state.undo();
      return;
    }

    // --- Ctrl+Y or Ctrl+Shift+Z: Redo ---
    if (ctrlOrMeta && (key === 'y' || (shiftKey && key === 'Z'))) {
      e.preventDefault();
      state.redo();
      return;
    }

    // --- Ctrl+C: Copy ---
    if (ctrlOrMeta && key === 'c' && activeElementId && !editingElementId) {
      // Don't prevent default if no element selected (allow normal copy)
      e.preventDefault();
      state.copyElement();
      return;
    }

    // --- Ctrl+X: Cut ---
    if (ctrlOrMeta && key === 'x' && activeElementId && !editingElementId) {
      e.preventDefault();
      state.cutElement();
      return;
    }

    // --- Ctrl+V: Paste ---
    if (ctrlOrMeta && key === 'v' && state.clipboard && !editingElementId) {
      e.preventDefault();
      state.pasteElement();
      state.pushHistory();
      return;
    }

    // --- Ctrl+D: Duplicate ---
    if (ctrlOrMeta && key === 'd' && activeElementId && !editingElementId) {
      e.preventDefault();
      state.duplicateElement();
      state.pushHistory();
      return;
    }

    // --- Delete / Backspace: Delete element ---
    if ((key === 'Delete' || key === 'Backspace') && activeElementId && !editingElementId) {
      e.preventDefault();
      state.removeElement(currentSlideIndex, activeElementId);
      return;
    }

    // --- Arrow keys: Move element ---
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(key) && activeElementId && !editingElementId) {
      e.preventDefault();
      const step = shiftKey ? 10 : 1;
      const slide = slides[currentSlideIndex];
      if (!slide) return;
      const el = slide.elements.find((el) => el.id === activeElementId);
      if (!el) return;

      let newProps = {};
      switch (key) {
        case 'ArrowUp': newProps = { top: (el.top || 0) - step }; break;
        case 'ArrowDown': newProps = { top: (el.top || 0) + step }; break;
        case 'ArrowLeft': newProps = { left: (el.left || 0) - step }; break;
        case 'ArrowRight': newProps = { left: (el.left || 0) + step }; break;
      }
      state.updateElement(currentSlideIndex, activeElementId, newProps);
      // Don't push history on every keystroke - debounced via keyup or blur
      return;
    }

    // --- Tab: Cycle through elements ---
    if (key === 'Tab' && !editingElementId) {
      e.preventDefault();
      const slide = slides[currentSlideIndex];
      if (!slide || slide.elements.length === 0) return;

      if (!activeElementId) {
        state.setActiveElementId(slide.elements[0].id);
      } else {
        const currentIdx = slide.elements.findIndex((el) => el.id === activeElementId);
        const nextIdx = (currentIdx + 1) % slide.elements.length;
        state.setActiveElementId(slide.elements[nextIdx].id);
      }
      return;
    }
  }, []);

  // Push history on arrow key release (batch moves into one undo step)
  const keyupHandler = useCallback((e) => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
      const state = usePptxStore.getState();
      if (state.activeElementId && !state.editingElementId && !state.disableHotkeys) {
        state.pushHistory();
      }
    }
  }, []);

  useEffect(() => {
    document.addEventListener('keydown', keydownHandler);
    document.addEventListener('keyup', keyupHandler);
    return () => {
      document.removeEventListener('keydown', keydownHandler);
      document.removeEventListener('keyup', keyupHandler);
    };
  }, [keydownHandler, keyupHandler]);
}
