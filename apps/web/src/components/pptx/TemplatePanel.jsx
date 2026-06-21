import React, { useState } from 'react';
import { X, FileDown, Plus } from 'lucide-react';
import { usePptxStore } from '../../store/pptxStore';
import { TEMPLATE_LIST } from './configs/templates';
import { nanoid } from 'nanoid';

// Mini slide renderer for template preview
function MiniSlide({ slide, width = 160 }) {
  const height = width * 0.5625;
  const scale = width / 1000;

  return (
    <div
      className="relative overflow-hidden rounded border border-vs-border"
      style={{ width, height, backgroundColor: slide.background?.color || '#ffffff' }}
    >
      <div
        className="absolute origin-top-left pointer-events-none"
        style={{ transform: `scale(${scale})`, width: 1000, height: 562.5 }}
      >
        {slide.elements.map((el) => {
          if (el.type === 'text') {
            return (
              <div
                key={el.id}
                className="absolute overflow-hidden"
                style={{
                  left: el.left,
                  top: el.top,
                  width: el.width,
                  height: el.height,
                  color: el.color,
                  fontSize: el.fontSize,
                  fontWeight: el.fontWeight,
                  textAlign: el.align,
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  opacity: el.opacity,
                }}
              >
                {el.content}
              </div>
            );
          }
          if (el.type === 'shape' && el.svgPath && el.viewBox) {
            return (
              <div
                key={el.id}
                className="absolute"
                style={{
                  left: el.left,
                  top: el.top,
                  width: el.width,
                  height: el.height,
                  opacity: el.opacity,
                }}
              >
                <svg viewBox={`0 0 ${el.viewBox[0]} ${el.viewBox[1]}`} className="w-full h-full" preserveAspectRatio="none">
                  <path d={el.svgPath} fill={el.fillColor || '#4b83f0'} />
                </svg>
              </div>
            );
          }
          if (el.type === 'table') {
            return (
              <div
                key={el.id}
                className="absolute bg-gray-100 border border-gray-300 flex items-center justify-center"
                style={{ left: el.left, top: el.top, width: el.width, height: el.height }}
              >
                <span className="text-gray-500" style={{ fontSize: 14 }}>Table</span>
              </div>
            );
          }
          return null;
        })}
      </div>
    </div>
  );
}

export function TemplatePanel({ open, onClose }) {
  const replaceAllSlides = usePptxStore((s) => s.replaceAllSlides);
  const insertSlides = usePptxStore((s) => s.insertSlides);
  const currentSlideIndex = usePptxStore((s) => s.currentSlideIndex);
  const [selectedTemplate, setSelectedTemplate] = useState(null);

  if (!open) return null;

  const handleApplyTemplate = (template, mode) => {
    // Deep clone and assign new IDs
    const clonedSlides = template.slides.map((slide) => ({
      ...JSON.parse(JSON.stringify(slide)),
      id: `slide-${nanoid(8)}`,
      elements: slide.elements.map((el) => ({
        ...JSON.parse(JSON.stringify(el)),
        id: `${el.type}-${nanoid(8)}`,
      })),
    }));

    if (mode === 'replace') {
      replaceAllSlides(clonedSlides);
    } else {
      insertSlides(clonedSlides, currentSlideIndex);
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="bg-vs-sidebar border border-vs-border rounded-xl shadow-2xl w-[720px] max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-vs-border">
          <h2 className="text-vs-foreground font-semibold text-lg">Templates</h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-vs-hover text-vs-muted">
            <X size={20} />
          </button>
        </div>

        {/* Template Grid */}
        <div className="flex-1 overflow-y-auto p-5">
          {selectedTemplate ? (
            /* Template Detail View */
            <div>
              <button
                onClick={() => setSelectedTemplate(null)}
                className="text-sm text-blue-400 hover:text-blue-300 mb-3 flex items-center gap-1"
              >
                ← Back to templates
              </button>
              <div className="mb-4">
                <h3 className="text-vs-foreground font-semibold text-base">{selectedTemplate.name}</h3>
                <p className="text-vs-muted text-xs mt-1">{selectedTemplate.description}</p>
              </div>
              <div className="grid grid-cols-2 gap-3 mb-4">
                {selectedTemplate.slides.map((slide, idx) => (
                  <div key={slide.id} className="space-y-1">
                    <MiniSlide slide={slide} width={300} />
                    <span className="text-[10px] text-vs-muted">Slide {idx + 1}</span>
                  </div>
                ))}
              </div>
              <div className="flex gap-2 pt-3 border-t border-vs-border">
                <button
                  onClick={() => handleApplyTemplate(selectedTemplate, 'replace')}
                  className="flex items-center gap-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm transition-colors"
                >
                  <FileDown size={14} /> Apply (Replace All)
                </button>
                <button
                  onClick={() => handleApplyTemplate(selectedTemplate, 'insert')}
                  className="flex items-center gap-1 px-4 py-2 bg-vs-hover hover:bg-vs-border text-vs-foreground rounded text-sm border border-vs-border transition-colors"
                >
                  <Plus size={14} /> Insert After Current
                </button>
              </div>
            </div>
          ) : (
            /* Template Grid View */
            <div className="grid grid-cols-2 gap-4">
              {TEMPLATE_LIST.map((tpl) => (
                <div
                  key={tpl.id}
                  onClick={() => setSelectedTemplate(tpl)}
                  className="cursor-pointer group border border-vs-border rounded-lg p-3 hover:border-blue-500 transition-colors"
                >
                  <MiniSlide slide={tpl.slides[0]} width={300} />
                  <div className="mt-2">
                    <h4 className="text-vs-foreground text-sm font-medium group-hover:text-blue-400 transition-colors">
                      {tpl.name}
                    </h4>
                    <p className="text-vs-muted text-xs mt-0.5">{tpl.description}</p>
                    <span className="text-[10px] text-vs-muted">{tpl.slides.length} slides</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
