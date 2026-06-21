import React from 'react';
import { Plus, Trash2, Copy, GripVertical } from 'lucide-react';
import { usePptxStore } from '../../store/pptxStore';

// Thumbnail SVG shape renderer
function ThumbShape({ el }) {
  if (el.svgPath && el.viewBox) {
    return (
      <div className="absolute" style={{ left: el.left, top: el.top, width: el.width, height: el.height, opacity: el.opacity }}>
        <svg viewBox={`0 0 ${el.viewBox[0]} ${el.viewBox[1]}`} className="w-full h-full" preserveAspectRatio="none">
          <path d={el.svgPath} fill={el.outlined ? 'none' : (el.fillColor || '#4b83f0')} stroke={el.outlineColor || 'none'} strokeWidth={el.outlineWidth || 0} />
        </svg>
      </div>
    );
  }
  // Fallback CSS shapes
  return (
    <div
      className="absolute"
      style={{
        left: el.left, top: el.top, width: el.width, height: el.height,
        backgroundColor: el.fillColor,
        borderRadius: el.shapeType === 'circle' ? '50%' : '0',
        transform: `rotate(${el.rotate || 0}deg)`,
      }}
    />
  );
}

// Thumbnail table renderer  
function ThumbTable({ el }) {
  const rows = el.data?.length || 2;
  const cols = el.data?.[0]?.length || 2;
  return (
    <div
      className="absolute border border-gray-300"
      style={{ left: el.left, top: el.top, width: el.width, height: el.height }}
    >
      <div className="w-full h-full grid" style={{ gridTemplateRows: `repeat(${rows}, 1fr)`, gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
        {Array.from({ length: rows * cols }).map((_, i) => (
          <div key={i} className="border border-gray-200" style={{ backgroundColor: i < cols ? (el.theme?.color || '#4b83f0') : 'white' }} />
        ))}
      </div>
    </div>
  );
}

export function SlideList() {
  const slides = usePptxStore((s) => s.slides);
  const currentSlideIndex = usePptxStore((s) => s.currentSlideIndex);
  const setCurrentSlideIndex = usePptxStore((s) => s.setCurrentSlideIndex);
  const addSlide = usePptxStore((s) => s.addSlide);
  const deleteSlide = usePptxStore((s) => s.deleteSlide);
  const duplicateSlide = usePptxStore((s) => s.duplicateSlide);

  return (
    <div className="w-48 bg-vs-sidebar border-r border-vs-border flex flex-col">
      <div className="p-2 border-b border-vs-border flex justify-between items-center">
        <span className="text-xs font-semibold text-vs-muted">Slides</span>
        <button
          onClick={addSlide}
          className="p-1 hover:bg-vs-hover rounded text-vs-foreground flex items-center justify-center"
          title="New Slide"
        >
          <Plus size={16} />
        </button>
      </div>
      <div className="overflow-y-auto p-2 flex flex-col gap-2 flex-1">
        {slides.map((slide, index) => (
          <div
            key={slide.id}
            className={`relative p-1 cursor-pointer border-2 rounded group ${currentSlideIndex === index ? 'border-blue-500 bg-vs-hover' : 'border-transparent hover:border-vs-border'}`}
            onClick={() => setCurrentSlideIndex(index)}
          >
            <div className="flex justify-between items-center mb-1 ml-1">
              <span className="text-xs text-vs-muted">{index + 1}</span>
              <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100">
                <button
                  onClick={(e) => { e.stopPropagation(); duplicateSlide(index); }}
                  className="text-vs-muted hover:text-vs-foreground p-0.5 rounded hover:bg-vs-border"
                  title="Duplicate Slide"
                >
                  <Copy size={11} />
                </button>
                {slides.length > 1 && (
                  <button
                    onClick={(e) => { e.stopPropagation(); deleteSlide(index); }}
                    className="text-red-400 hover:text-red-300 p-0.5 rounded hover:bg-vs-border"
                    title="Delete Slide"
                  >
                    <Trash2 size={11} />
                  </button>
                )}
              </div>
            </div>
            <div className="aspect-video bg-vs-bg border border-vs-border rounded shadow-sm overflow-hidden flex items-center justify-center relative">
              <div
                className="absolute w-full h-full pointer-events-none origin-top-left"
                style={{
                  backgroundColor: slide.background?.color || '#ffffff',
                  transform: 'scale(0.15)',
                  width: '1000px',
                  height: '562.5px'
                }}
              >
                {slide.elements.map((el) => {
                  if (el.type === 'text') {
                    return (
                      <div
                        key={el.id}
                        className="absolute overflow-hidden"
                        style={{
                          left: el.left || 0, top: el.top || 0,
                          width: el.width || 100, height: el.height || 100,
                          color: el.color, fontSize: el.fontSize,
                          fontWeight: el.fontWeight, textAlign: el.align,
                          whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                          transform: `rotate(${el.rotate || 0}deg)`,
                          opacity: el.opacity,
                        }}
                      >
                        {el.content}
                      </div>
                    );
                  }
                  if (el.type === 'image') {
                    return (
                      <img
                        key={el.id}
                        src={el.src}
                        alt=""
                        className="absolute"
                        style={{
                          left: el.left || 0, top: el.top || 0,
                          width: el.width || 100, height: el.height || 100,
                          objectFit: 'contain',
                          transform: `rotate(${el.rotate || 0}deg)`,
                        }}
                      />
                    );
                  }
                  if (el.type === 'shape') {
                    return <ThumbShape key={el.id} el={el} />;
                  }
                  if (el.type === 'table') {
                    return <ThumbTable key={el.id} el={el} />;
                  }
                  return null;
                })}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
