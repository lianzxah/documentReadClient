import React, { useState } from 'react';
import { nanoid } from 'nanoid';
import { SHAPE_LIST } from './configs/shapes';
import { usePptxStore } from '../../store/pptxStore';

export function ShapePool({ onClose }) {
  const [activeCategory, setActiveCategory] = useState(0);
  const currentSlideIndex = usePptxStore((s) => s.currentSlideIndex);
  const addElement = usePptxStore((s) => s.addElement);

  const handleSelectShape = (shape) => {
    addElement(currentSlideIndex, {
      id: `shape-${nanoid(8)}`,
      type: 'shape',
      shapeType: 'svg',
      left: 350,
      top: 150,
      width: 200,
      height: 200,
      fillColor: '#4b83f0',
      outlineColor: '#333333',
      outlineWidth: 0,
      outlineStyle: 'solid',
      opacity: 1,
      rotate: 0,
      viewBox: shape.viewBox,
      svgPath: shape.path,
      pathFormula: shape.pathFormula || null,
      pptxShapeType: shape.pptxShapeType || null,
      outlined: shape.outlined || false,
      withborder: shape.withborder || false,
    });
    if (onClose) onClose();
  };

  return (
    <div className="absolute top-full left-0 mt-1 z-50 bg-vs-sidebar border border-vs-border rounded-lg shadow-xl p-3 w-[360px] max-h-[420px] overflow-hidden flex flex-col">
      {/* Category tabs */}
      <div className="flex gap-1 mb-2 border-b border-vs-border pb-2 flex-shrink-0">
        {SHAPE_LIST.map((category, idx) => (
          <button
            key={category.type}
            onClick={() => setActiveCategory(idx)}
            className={`px-2 py-1 text-xs rounded transition-colors ${
              activeCategory === idx
                ? 'bg-blue-600 text-white'
                : 'text-vs-muted hover:bg-vs-hover hover:text-vs-foreground'
            }`}
          >
            {category.type}
          </button>
        ))}
      </div>

      {/* Shape grid */}
      <div className="overflow-y-auto flex-1">
        <div className="grid grid-cols-8 gap-1">
          {SHAPE_LIST[activeCategory]?.children.map((shape, idx) => (
            <button
              key={idx}
              onClick={() => handleSelectShape(shape)}
              className="w-9 h-9 flex items-center justify-center border border-vs-border rounded hover:border-blue-400 hover:bg-vs-hover transition-colors group"
              title={shape.pptxShapeType || `Shape ${idx + 1}`}
            >
              <svg
                viewBox={`0 0 ${shape.viewBox[0]} ${shape.viewBox[1]}`}
                className="w-6 h-6"
              >
                <path
                  d={shape.path}
                  fill={shape.outlined ? 'none' : '#6b7280'}
                  stroke={shape.outlined || shape.withborder ? '#6b7280' : 'none'}
                  strokeWidth={shape.outlined || shape.withborder ? Math.max(shape.viewBox[0], shape.viewBox[1]) * 0.04 : 0}
                  className="group-hover:fill-blue-500 group-hover:stroke-blue-500"
                  fillRule="evenodd"
                />
              </svg>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
