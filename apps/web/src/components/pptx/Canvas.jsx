import React, { useRef, useEffect, useState } from 'react';
import { Rnd } from 'react-rnd';
import { usePptxStore } from '../../store/pptxStore';
import { TableElement } from './TableElement';
import { SHAPE_PATH_FORMULAS } from './configs/shapes';

// Render SVG shape element
function ShapeRenderer({ el }) {
  const { svgPath, viewBox, fillColor, outlineColor, outlineWidth, outlineStyle, outlined, withborder, pathFormula } = el;

  // If it's an SVG path-based shape
  if (svgPath && viewBox) {
    let path = svgPath;
    // If pathFormula exists, compute dynamic path based on element dimensions
    if (pathFormula && SHAPE_PATH_FORMULAS[pathFormula]) {
      const formula = SHAPE_PATH_FORMULAS[pathFormula];
      const values = formula.defaultValue || [0.125];
      path = formula.formula(viewBox[0], viewBox[1], values);
    }

    const strokeWidth = outlineWidth || (withborder ? 2 : 0);
    const dashArray = outlineStyle === 'dashed' ? '8,4' : outlineStyle === 'dotted' ? '2,2' : undefined;

    return (
      <svg
        viewBox={`0 0 ${viewBox[0]} ${viewBox[1]}`}
        className="w-full h-full"
        preserveAspectRatio="none"
      >
        <path
          d={path}
          fill={outlined ? 'none' : (fillColor || '#4b83f0')}
          stroke={(outlined || withborder || strokeWidth > 0) ? (outlineColor || '#333') : 'none'}
          strokeWidth={strokeWidth || (outlined ? Math.max(viewBox[0], viewBox[1]) * 0.03 : 0)}
          strokeDasharray={dashArray}
          fillRule="evenodd"
        />
      </svg>
    );
  }

  // Fallback: CSS-based simple shapes (backward compatibility)
  if (el.shapeType === 'line') {
    return (
      <div
        style={{
          width: '100%',
          height: el.outlineWidth ? `${el.outlineWidth}px` : '2px',
          backgroundColor: el.fillColor || '#000',
          position: 'absolute',
          top: '50%',
          transform: 'translateY(-50%)',
        }}
      />
    );
  }

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        backgroundColor: el.fillColor,
        borderRadius: el.shapeType === 'circle' ? '50%' : '0',
        border: el.outlineWidth ? `${el.outlineWidth}px solid ${el.outlineColor || '#000'}` : 'none',
      }}
    />
  );
}

export function Canvas({ slideIndex }) {
  const slides = usePptxStore((s) => s.slides);
  const activeElementId = usePptxStore((s) => s.activeElementId);
  const setActiveElementId = usePptxStore((s) => s.setActiveElementId);
  const updateElement = usePptxStore((s) => s.updateElement);

  const slide = slides[slideIndex];
  const containerRef = useRef(null);
  const [scale, setScale] = useState(1);

  const BASE_WIDTH = 1000;
  const BASE_HEIGHT = 562.5;
  const GRID_SIZE = 50;

  useEffect(() => {
    const handleResize = () => {
      if (containerRef.current) {
        const { width, height } = containerRef.current.getBoundingClientRect();
        const scaleX = width / BASE_WIDTH;
        const scaleY = height / BASE_HEIGHT;
        setScale(Math.min(scaleX, scaleY) * 0.9);
      }
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  if (!slide) return null;

  const bgColor = slide.background?.color || '#ffffff';

  return (
    <div
      ref={containerRef}
      className="w-full h-full flex items-center justify-center bg-vs-bg overflow-hidden relative"
      onMouseDown={() => setActiveElementId(null)}
    >
      {/* Horizontal Ruler */}
      <div className="absolute top-0 left-0 right-0 h-5 bg-vs-sidebar border-b border-vs-border z-20 flex overflow-hidden opacity-80 pointer-events-none">
        {Array.from({ length: 20 }).map((_, i) => (
          <div key={`hr-${i}`} className="flex-none h-full border-r border-vs-border relative text-[10px] text-vs-muted" style={{ width: 100 * scale }}>
            <span className="absolute bottom-0 right-1">{i + 1}</span>
          </div>
        ))}
      </div>
      
      {/* Vertical Ruler */}
      <div className="absolute top-0 left-0 bottom-0 w-5 bg-vs-sidebar border-r border-vs-border z-20 flex flex-col overflow-hidden opacity-80 pointer-events-none">
        {Array.from({ length: 12 }).map((_, i) => (
          <div key={`vr-${i}`} className="flex-none w-full border-b border-vs-border relative text-[10px] text-vs-muted" style={{ height: 100 * scale }}>
            <span className="absolute bottom-1 right-0" style={{ writingMode: 'vertical-rl' }}>{i + 1}</span>
          </div>
        ))}
      </div>

      <div
        className="relative shadow-lg ring-1 ring-vs-border mt-5 ml-5"
        style={{
          width: BASE_WIDTH,
          height: BASE_HEIGHT,
          transform: `scale(${scale})`,
          transformOrigin: 'center center',
          backgroundColor: bgColor,
        }}
      >
        {/* Grid Lines Overlay */}
        <div 
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage: `
              linear-gradient(to right, rgba(0, 0, 0, 0.05) 1px, transparent 1px),
              linear-gradient(to bottom, rgba(0, 0, 0, 0.05) 1px, transparent 1px)
            `,
            backgroundSize: `${GRID_SIZE}px ${GRID_SIZE}px`,
            zIndex: 0
          }}
        />

        {slide.elements.map((el) => {
          const isSelected = activeElementId === el.id;
          return (
            <Rnd
              key={el.id}
              size={{ width: el.width || 100, height: el.height || 100 }}
              position={{ x: el.left || 0, y: el.top || 0 }}
              onDragStop={(e, d) => {
                updateElement(slideIndex, el.id, { left: d.x, top: d.y });
              }}
              onResizeStop={(e, direction, ref, delta, position) => {
                updateElement(slideIndex, el.id, {
                  width: parseInt(ref.style.width, 10),
                  height: parseInt(ref.style.height, 10),
                  ...position,
                });
              }}
              scale={scale}
              className={`absolute cursor-pointer ${isSelected ? 'ring-1 ring-blue-500 z-10' : 'hover:ring-1 hover:ring-blue-300'}`}
              style={{
                transform: `rotate(${el.rotate || 0}deg)`,
                opacity: el.opacity !== undefined ? el.opacity : 1,
              }}
              resizeHandleStyles={{
                topLeft: { width: '10px', height: '10px', background: '#fff', border: '1px solid #3b82f6', borderRadius: '50%', top: '-5px', left: '-5px' },
                topRight: { width: '10px', height: '10px', background: '#fff', border: '1px solid #3b82f6', borderRadius: '50%', top: '-5px', right: '-5px' },
                bottomLeft: { width: '10px', height: '10px', background: '#fff', border: '1px solid #3b82f6', borderRadius: '50%', bottom: '-5px', left: '-5px' },
                bottomRight: { width: '10px', height: '10px', background: '#fff', border: '1px solid #3b82f6', borderRadius: '50%', bottom: '-5px', right: '-5px' },
                top: { height: '10px', top: '-5px' },
                bottom: { height: '10px', bottom: '-5px' },
                left: { width: '10px', left: '-5px' },
                right: { width: '10px', right: '-5px' },
              }}
              enableResizing={isSelected ? undefined : false}
              disableDragging={!isSelected}
              onMouseDown={(e) => {
                e.stopPropagation();
                setActiveElementId(el.id);
              }}
              bounds="parent"
            >
              {el.type === 'text' && (
                <div
                  style={{
                    color: el.color,
                    fontSize: el.fontSize,
                    fontWeight: el.fontWeight,
                    textAlign: el.align,
                    width: '100%',
                    height: '100%',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                  }}
                >
                  {el.content}
                </div>
              )}
              {el.type === 'image' && (
                <img
                  src={el.src}
                  alt=""
                  style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                  draggable={false}
                />
              )}
              {el.type === 'shape' && <ShapeRenderer el={el} />}
              {el.type === 'table' && (
                <TableElement element={el} slideIndex={slideIndex} isSelected={isSelected} />
              )}
            </Rnd>
          );
        })}
      </div>
    </div>
  );
}
