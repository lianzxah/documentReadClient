import React, { useState, useRef, useEffect } from 'react';
import { Type, Image as ImageIcon, Shapes, Download, Table2, Minus, ChevronDown, LayoutTemplate } from 'lucide-react';
import { usePptxStore } from '../../store/pptxStore';
import { exportToPptx } from './export';
import { ShapePool } from './ShapePool';
import { TableGenerator } from './TableGenerator';
import { LINE_LIST } from './configs/lines';
import { nanoid } from 'nanoid';

// Dropdown wrapper with click-outside handling
function DropdownButton({ icon: Icon, label, children }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    if (open) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="p-2 hover:bg-vs-hover rounded text-vs-foreground flex items-center gap-1 text-sm"
      >
        <Icon size={16} /> {label} <ChevronDown size={12} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-1 z-50 bg-vs-sidebar border border-vs-border rounded-lg shadow-xl">
          {typeof children === 'function' ? children(() => setOpen(false)) : children}
        </div>
      )}
    </div>
  );
}

export function Toolbar({ onOpenTemplates }) {
  const slides = usePptxStore((s) => s.slides);
  const currentSlideIndex = usePptxStore((s) => s.currentSlideIndex);
  const addElement = usePptxStore((s) => s.addElement);

  const handleAddText = () => {
    addElement(currentSlideIndex, {
      id: `text-${nanoid(8)}`,
      type: 'text',
      content: 'New Text',
      left: 400,
      top: 200,
      width: 400,
      height: 100,
      color: '#000000',
      fontSize: 24,
      fontWeight: 'normal',
      align: 'left',
      opacity: 1,
    });
  };

  const handleAddImage = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = (e) => {
      const file = e.target.files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (ev) => {
          addElement(currentSlideIndex, {
            id: `img-${nanoid(8)}`,
            type: 'image',
            src: ev.target.result,
            left: 200,
            top: 100,
            width: 400,
            height: 300,
            opacity: 1,
          });
        };
        reader.readAsDataURL(file);
      }
    };
    input.click();
  };

  const handleAddLine = (lineItem) => {
    addElement(currentSlideIndex, {
      id: `shape-${nanoid(8)}`,
      type: 'shape',
      shapeType: 'line',
      lineType: lineItem.type,
      svgPath: lineItem.path,
      viewBox: lineItem.viewBox,
      left: 300,
      top: 260,
      width: 400,
      height: 4,
      fillColor: 'none',
      outlineColor: '#333333',
      outlineWidth: 2,
      outlined: true,
      opacity: 1,
    });
  };

  const handleExport = () => {
    exportToPptx(slides);
  };

  return (
    <div className="flex items-center justify-between px-4 py-2 bg-vs-sidebar border-b border-vs-border">
      <div className="flex items-center space-x-1">
        {/* Text */}
        <button
          onClick={handleAddText}
          className="p-2 hover:bg-vs-hover rounded text-vs-foreground flex items-center gap-1 text-sm"
          title="Add Text"
        >
          <Type size={16} /> Text
        </button>

        {/* Image */}
        <button
          onClick={handleAddImage}
          className="p-2 hover:bg-vs-hover rounded text-vs-foreground flex items-center gap-1 text-sm"
          title="Add Image"
        >
          <ImageIcon size={16} /> Image
        </button>

        {/* Shapes dropdown */}
        <DropdownButton icon={Shapes} label="Shapes">
          {(close) => <ShapePool onInsert={close} />}
        </DropdownButton>

        {/* Table dropdown */}
        <DropdownButton icon={Table2} label="Table">
          {(close) => <TableGenerator onInsert={close} />}
        </DropdownButton>

        {/* Lines dropdown */}
        <DropdownButton icon={Minus} label="Lines">
          {(close) => (
            <div className="p-3 w-48">
              <div className="text-xs text-vs-muted mb-2 font-semibold">Lines</div>
              <div className="flex flex-col gap-1">
                {LINE_LIST.map((line) => (
                  <button
                    key={line.type}
                    onClick={() => { handleAddLine(line); close(); }}
                    className="flex items-center gap-2 p-2 rounded hover:bg-vs-hover text-vs-foreground text-sm w-full text-left"
                  >
                    <svg viewBox={`0 0 ${line.viewBox[0]} ${line.viewBox[1]}`} className="w-8 h-4 flex-shrink-0">
                      <path d={line.path} fill="none" stroke="currentColor" strokeWidth="2" />
                    </svg>
                    <span className="capitalize">{line.type}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </DropdownButton>

        {/* Templates */}
        <button
          onClick={onOpenTemplates}
          className="p-2 hover:bg-vs-hover rounded text-vs-foreground flex items-center gap-1 text-sm"
          title="Templates"
        >
          <LayoutTemplate size={16} /> Templates
        </button>
      </div>
      <div className="flex items-center space-x-2">
        <button
          onClick={handleExport}
          className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded flex items-center gap-1 text-sm transition-colors"
        >
          <Download size={16} /> Export PPTX
        </button>
      </div>
    </div>
  );
}
