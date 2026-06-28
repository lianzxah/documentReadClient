import React, { useRef, useState, useCallback } from 'react';
import { Plus, Trash2, Copy, GripVertical } from 'lucide-react';
import { usePptxStore } from '../../store/pptxStore';
import { SlideThumbnail } from './SlideThumbnail';

export function SlideList() {
  const slides = usePptxStore((s) => s.slides);
  const currentSlideIndex = usePptxStore((s) => s.currentSlideIndex);
  const setCurrentSlideIndex = usePptxStore((s) => s.setCurrentSlideIndex);
  const addSlide = usePptxStore((s) => s.addSlide);
  const deleteSlide = usePptxStore((s) => s.deleteSlide);
  const duplicateSlide = usePptxStore((s) => s.duplicateSlide);
  const reorderSlides = usePptxStore((s) => s.reorderSlides);

  // Drag-and-drop state
  const [dragIndex, setDragIndex] = useState(null);
  const [dragOverIndex, setDragOverIndex] = useState(null);
  const dragNodeRef = useRef(null);

  const handleDragStart = useCallback((e, index) => {
    setDragIndex(index);
    dragNodeRef.current = e.currentTarget;
    e.dataTransfer.effectAllowed = 'move';
    // Set ghost image opacity
    e.currentTarget.style.opacity = '0.5';
  }, []);

  const handleDragEnd = useCallback((e) => {
    e.currentTarget.style.opacity = '1';
    if (dragIndex !== null && dragOverIndex !== null && dragIndex !== dragOverIndex) {
      reorderSlides(dragIndex, dragOverIndex);
    }
    setDragIndex(null);
    setDragOverIndex(null);
    dragNodeRef.current = null;
  }, [dragIndex, dragOverIndex, reorderSlides]);

  const handleDragOver = useCallback((e, index) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragIndex !== index) {
      setDragOverIndex(index);
    }
  }, [dragIndex]);

  const handleDragLeave = useCallback(() => {
    setDragOverIndex(null);
  }, []);

  return (
    <div className="w-52 bg-vs-sidebar border-r border-vs-border flex flex-col">
      {/* Header */}
      <div className="p-2 border-b border-vs-border flex justify-between items-center">
        <span className="text-xs font-semibold text-vs-muted uppercase tracking-wide">Slides</span>
        <button
          onClick={addSlide}
          className="p-1 hover:bg-vs-hover rounded text-vs-foreground flex items-center justify-center transition-colors"
          title="New Slide"
        >
          <Plus size={16} />
        </button>
      </div>

      {/* Slide List */}
      <div className="overflow-y-auto p-2 flex flex-col gap-1.5 flex-1 scrollbar-thin">
        {slides.map((slide, index) => (
          <div
            key={slide.id}
            draggable
            onDragStart={(e) => handleDragStart(e, index)}
            onDragEnd={handleDragEnd}
            onDragOver={(e) => handleDragOver(e, index)}
            onDragLeave={handleDragLeave}
            className={`
              relative p-1 cursor-pointer rounded-md group transition-all duration-150
              ${currentSlideIndex === index
                ? 'ring-2 ring-blue-500 bg-vs-hover shadow-sm'
                : 'border border-transparent hover:border-vs-border hover:bg-vs-hover/50'
              }
              ${dragOverIndex === index && dragIndex !== index
                ? 'border-t-2 border-t-blue-400'
                : ''
              }
            `}
            onClick={() => setCurrentSlideIndex(index)}
          >
            {/* Slide number and action buttons row */}
            <div className="flex justify-between items-center mb-1 px-0.5">
              <div className="flex items-center gap-1">
                {/* Drag handle */}
                <GripVertical
                  size={10}
                  className="text-vs-muted opacity-0 group-hover:opacity-60 cursor-grab active:cursor-grabbing transition-opacity"
                />
                <span className="text-[10px] font-medium text-vs-muted tabular-nums">
                  {index + 1}
                </span>
              </div>

              {/* Action buttons */}
              <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={(e) => { e.stopPropagation(); duplicateSlide(index); }}
                  className="text-vs-muted hover:text-vs-foreground p-0.5 rounded hover:bg-vs-border transition-colors"
                  title="Duplicate Slide"
                >
                  <Copy size={11} />
                </button>
                {slides.length > 1 && (
                  <button
                    onClick={(e) => { e.stopPropagation(); deleteSlide(index); }}
                    className="text-red-400 hover:text-red-300 p-0.5 rounded hover:bg-red-500/10 transition-colors"
                    title="Delete Slide"
                  >
                    <Trash2 size={11} />
                  </button>
                )}
              </div>
            </div>

            {/* Thumbnail */}
            <SlideThumbnail slide={slide} slideIndex={index} />
          </div>
        ))}
      </div>
    </div>
  );
}
