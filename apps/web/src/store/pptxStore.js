import { create } from 'zustand'
import { nanoid } from 'nanoid'

export const usePptxStore = create((set, get) => ({
  slides: [],
  currentSlideIndex: 0,
  activeElementId: null,
  templates: [],
  // 表格编辑状态
  selectedTableCells: [],
  editingTableCellId: null,

  setSlides: (slides) => set({ slides }),
  setCurrentSlideIndex: (index) =>
    set({ currentSlideIndex: index, activeElementId: null }),
  setActiveElementId: (id) => set({ activeElementId: id }),
  setTemplates: (templates) => set({ templates }),
  setSelectedTableCells: (cells) => set({ selectedTableCells: cells }),
  setEditingTableCellId: (id) => set({ editingTableCellId: id }),

  addSlide: () =>
    set((state) => {
      const newSlide = {
        id: `slide-${nanoid(8)}`,
        elements: [],
        background: { type: 'solid', color: '#ffffff' },
      }
      const newSlides = [...state.slides]
      newSlides.splice(state.currentSlideIndex + 1, 0, newSlide)
      return {
        slides: newSlides,
        currentSlideIndex: state.currentSlideIndex + 1,
        activeElementId: null,
      }
    }),

  duplicateSlide: (index) =>
    set((state) => {
      const sourceSlide = state.slides[index]
      if (!sourceSlide) return state
      const newSlide = JSON.parse(JSON.stringify(sourceSlide))
      newSlide.id = `slide-${nanoid(8)}`
      newSlide.elements = newSlide.elements.map((el) => ({
        ...el,
        id: `${el.type}-${nanoid(8)}`,
      }))
      const newSlides = [...state.slides]
      newSlides.splice(index + 1, 0, newSlide)
      return {
        slides: newSlides,
        currentSlideIndex: index + 1,
        activeElementId: null,
      }
    }),

  deleteSlide: (index) =>
    set((state) => {
      if (state.slides.length <= 1) return state
      const newSlides = state.slides.filter((_, i) => i !== index)
      const newIndex = Math.min(state.currentSlideIndex, newSlides.length - 1)
      return {
        slides: newSlides,
        currentSlideIndex: newIndex,
        activeElementId: null,
      }
    }),

  reorderSlides: (fromIndex, toIndex) =>
    set((state) => {
      const newSlides = [...state.slides]
      const [moved] = newSlides.splice(fromIndex, 1)
      newSlides.splice(toIndex, 0, moved)
      return { slides: newSlides, currentSlideIndex: toIndex }
    }),

  insertSlides: (slides, afterIndex) =>
    set((state) => {
      const newSlides = [...state.slides]
      const insertAt =
        afterIndex !== undefined ? afterIndex + 1 : state.currentSlideIndex + 1
      newSlides.splice(insertAt, 0, ...slides)
      return { slides: newSlides, currentSlideIndex: insertAt }
    }),

  replaceAllSlides: (slides) =>
    set({ slides, currentSlideIndex: 0, activeElementId: null }),

  updateSlideBackground: (slideIndex, background) =>
    set((state) => {
      const newSlides = [...state.slides]
      newSlides[slideIndex] = {
        ...newSlides[slideIndex],
        background:
          typeof background === 'string'
            ? { type: 'solid', color: background }
            : background,
      }
      return { slides: newSlides }
    }),

  updateElement: (slideIndex, elementId, newProps) =>
    set((state) => {
      const newSlides = [...state.slides]
      const slide = newSlides[slideIndex]
      const elIndex = slide.elements.findIndex((e) => e.id === elementId)
      if (elIndex !== -1) {
        slide.elements[elIndex] = { ...slide.elements[elIndex], ...newProps }
      }
      return { slides: newSlides }
    }),

  addElement: (slideIndex, element) =>
    set((state) => {
      const newSlides = [...state.slides]
      newSlides[slideIndex].elements.push(element)
      return { slides: newSlides, activeElementId: element.id }
    }),

  removeElement: (slideIndex, elementId) =>
    set((state) => {
      const newSlides = [...state.slides]
      newSlides[slideIndex].elements = newSlides[slideIndex].elements.filter(
        (e) => e.id !== elementId,
      )
      return { slides: newSlides, activeElementId: null }
    }),

  bringToFront: (slideIndex, elementId) =>
    set((state) => {
      const newSlides = [...state.slides]
      const elements = newSlides[slideIndex].elements
      const index = elements.findIndex((e) => e.id === elementId)
      if (index > -1 && index < elements.length - 1) {
        const el = elements.splice(index, 1)[0]
        elements.push(el)
      }
      return { slides: newSlides }
    }),

  sendToBack: (slideIndex, elementId) =>
    set((state) => {
      const newSlides = [...state.slides]
      const elements = newSlides[slideIndex].elements
      const index = elements.findIndex((e) => e.id === elementId)
      if (index > 0) {
        const el = elements.splice(index, 1)[0]
        elements.unshift(el)
      }
      return { slides: newSlides }
    }),

  // 表格单元格更新
  updateTableCell: (slideIndex, elementId, rowIndex, colIndex, cellProps) =>
    set((state) => {
      const newSlides = JSON.parse(JSON.stringify(state.slides))
      const slide = newSlides[slideIndex]
      const el = slide.elements.find((e) => e.id === elementId)
      if (
        el &&
        el.type === 'table' &&
        el.data[rowIndex] &&
        el.data[rowIndex][colIndex]
      ) {
        el.data[rowIndex][colIndex] = {
          ...el.data[rowIndex][colIndex],
          ...cellProps,
        }
      }
      return { slides: newSlides }
    }),

  // 表格行列操作
  insertTableRow: (slideIndex, elementId, afterRowIndex) =>
    set((state) => {
      const newSlides = JSON.parse(JSON.stringify(state.slides))
      const el = newSlides[slideIndex].elements.find((e) => e.id === elementId)
      if (el && el.type === 'table') {
        const colCount = el.data[0].length
        const newRow = Array.from({ length: colCount }, () => ({
          id: nanoid(8),
          colspan: 1,
          rowspan: 1,
          text: '',
          style: {},
        }))
        el.data.splice(afterRowIndex + 1, 0, newRow)
      }
      return { slides: newSlides }
    }),

  insertTableCol: (slideIndex, elementId, afterColIndex) =>
    set((state) => {
      const newSlides = JSON.parse(JSON.stringify(state.slides))
      const el = newSlides[slideIndex].elements.find((e) => e.id === elementId)
      if (el && el.type === 'table') {
        const colCount = el.colWidths.length + 1
        el.data.forEach((row) => {
          row.splice(afterColIndex + 1, 0, {
            id: nanoid(8),
            colspan: 1,
            rowspan: 1,
            text: '',
            style: {},
          })
        })
        el.colWidths = Array.from({ length: colCount }, () => 1 / colCount)
      }
      return { slides: newSlides }
    }),

  deleteTableRow: (slideIndex, elementId, rowIndex) =>
    set((state) => {
      const newSlides = JSON.parse(JSON.stringify(state.slides))
      const el = newSlides[slideIndex].elements.find((e) => e.id === elementId)
      if (el && el.type === 'table' && el.data.length > 1) {
        el.data.splice(rowIndex, 1)
      }
      return { slides: newSlides }
    }),

  deleteTableCol: (slideIndex, elementId, colIndex) =>
    set((state) => {
      const newSlides = JSON.parse(JSON.stringify(state.slides))
      const el = newSlides[slideIndex].elements.find((e) => e.id === elementId)
      if (el && el.type === 'table' && el.data[0].length > 1) {
        el.data.forEach((row) => row.splice(colIndex, 1))
        const colCount = el.colWidths.length - 1
        el.colWidths = Array.from({ length: colCount }, () => 1 / colCount)
      }
      return { slides: newSlides }
    }),
}))
