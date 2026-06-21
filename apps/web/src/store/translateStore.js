import { create } from 'zustand'

/**
 * Ephemeral selection + translation state. Not persisted.
 *
 * Performance: `appendDelta` batches incoming token chunks via
 * requestAnimationFrame so that rapid SSE events (~50-100 tokens/s) are
 * flushed to React at most once per animation frame (~60 fps), avoiding
 * excessive re-renders during streaming.
 */

let deltaBuffer = ''
let rafId = null

function flushBuffer() {
  rafId = null
  if (!deltaBuffer) return
  const chunk = deltaBuffer
  deltaBuffer = ''
  useTranslateStore.setState((s) => ({ result: s.result + chunk }))
}

export const useTranslateStore = create((set) => ({
  open: false,
  anchor: null, // { x, y }
  text: '',
  direction: 'auto',
  result: '',
  detected: null,
  loading: false,

  openAt: (anchor, text) =>
    set({ open: true, anchor, text, result: '', detected: null }),
  close: () => {
    // Cancel any pending RAF flush on close.
    if (rafId) {
      cancelAnimationFrame(rafId)
      rafId = null
    }
    deltaBuffer = ''
    set({ open: false, text: '', result: '', loading: false })
  },
  setDirection: (direction) => set({ direction }),
  setLoading: (loading) => {
    // When loading finishes, flush any remaining buffered tokens immediately.
    if (!loading && deltaBuffer) {
      if (rafId) {
        cancelAnimationFrame(rafId)
        rafId = null
      }
      const chunk = deltaBuffer
      deltaBuffer = ''
      set((s) => ({ loading: false, result: s.result + chunk }))
    } else {
      set({ loading })
    }
  },
  setMeta: (detected, direction) => set({ detected, direction }),
  appendDelta: (delta) => {
    deltaBuffer += delta
    if (!rafId) rafId = requestAnimationFrame(flushBuffer)
  },
}))
