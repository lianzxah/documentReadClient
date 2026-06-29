import React from 'react';
import { usePptxStore } from '../../store/pptxStore';
import { Trash2, ArrowUpToLine, ArrowDownToLine, Copy, Plus, Minus, Type } from 'lucide-react';

export function Panel() {
  const slides = usePptxStore((s) => s.slides);
  const currentSlideIndex = usePptxStore((s) => s.currentSlideIndex);
  const activeElementId = usePptxStore((s) => s.activeElementId);
  const editingElementId = usePptxStore((s) => s.editingElementId);
  const updateElement = usePptxStore((s) => s.updateElement);
  const removeElement = usePptxStore((s) => s.removeElement);
  const bringToFront = usePptxStore((s) => s.bringToFront);
  const sendToBack = usePptxStore((s) => s.sendToBack);
  const updateSlideBackground = usePptxStore((s) => s.updateSlideBackground);
  const duplicateSlide = usePptxStore((s) => s.duplicateSlide);
  const insertTableRow = usePptxStore((s) => s.insertTableRow);
  const insertTableCol = usePptxStore((s) => s.insertTableCol);
  const deleteTableRow = usePptxStore((s) => s.deleteTableRow);
  const deleteTableCol = usePptxStore((s) => s.deleteTableCol);

  const slide = slides[currentSlideIndex];
  if (!slide) return <div className="w-64 bg-vs-sidebar border-l border-vs-border p-4 text-vs-muted text-sm">No slide selected</div>;

  const activeElement = slide.elements.find((e) => e.id === activeElementId);

  if (!activeElement) {
    return (
      <div className="w-64 bg-vs-sidebar border-l border-vs-border p-4 text-sm text-vs-muted overflow-y-auto">
        <h3 className="text-vs-foreground font-semibold mb-4">Slide Properties</h3>
        <div className="space-y-3">
          <div>
            <label className="block text-xs mb-1">Background Color</label>
            <input 
              type="color" 
              value={slide.background?.color || '#ffffff'} 
              onChange={(e) => updateSlideBackground(currentSlideIndex, e.target.value)}
              className="w-full h-8 rounded cursor-pointer" 
            />
          </div>
          <div className="pt-2 border-t border-vs-border">
            <button
              onClick={() => duplicateSlide(currentSlideIndex)}
              className="flex items-center gap-1 text-xs px-2 py-1.5 rounded hover:bg-vs-hover text-vs-foreground w-full"
            >
              <Copy size={14} /> Duplicate Slide
            </button>
          </div>
        </div>
      </div>
    );
  }

  const handleChange = (key, value) => {
    updateElement(currentSlideIndex, activeElementId, { [key]: value });
  };

  return (
    <div className="w-64 bg-vs-sidebar border-l border-vs-border p-4 text-sm text-vs-foreground flex flex-col gap-4 overflow-y-auto">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Element Properties</h3>
        <div className="flex items-center gap-1">
          <button
            onClick={() => bringToFront(currentSlideIndex, activeElementId)}
            className="text-vs-foreground p-1 rounded hover:bg-vs-hover"
            title="Bring to Front"
          >
            <ArrowUpToLine size={16} />
          </button>
          <button
            onClick={() => sendToBack(currentSlideIndex, activeElementId)}
            className="text-vs-foreground p-1 rounded hover:bg-vs-hover"
            title="Send to Back"
          >
            <ArrowDownToLine size={16} />
          </button>
          <button
            onClick={() => removeElement(currentSlideIndex, activeElementId)}
            className="text-red-400 hover:text-red-300 p-1 rounded hover:bg-vs-hover ml-1"
            title="Delete Element"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      {activeElement.type === 'text' && (
        <>
          <div>
            <label className="block text-xs mb-1 text-vs-muted">Content</label>
            {editingElementId === activeElement.id ? (
              <div className="flex items-center gap-1.5 p-2 bg-blue-500/10 border border-blue-500/30 rounded text-xs text-blue-300">
                <Type size={12} />
                Editing inline on canvas...
              </div>
            ) : (
              <textarea
                value={activeElement.content}
                onChange={(e) => handleChange('content', e.target.value)}
                className="w-full bg-vs-bg border border-vs-border rounded p-2 text-sm focus:outline-none focus:border-blue-500 min-h-[100px]"
                placeholder="Double-click on canvas to edit inline"
              />
            )}
          </div>
          <div>
            <label className="block text-xs mb-1 text-vs-muted">Color</label>
            <input
              type="color"
              value={activeElement.color}
              onChange={(e) => handleChange('color', e.target.value)}
              className="w-full h-8 rounded cursor-pointer"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs mb-1 text-vs-muted">Font Size</label>
              <input
                type="number"
                value={activeElement.fontSize}
                onChange={(e) => handleChange('fontSize', Number(e.target.value))}
                className="w-full bg-vs-bg border border-vs-border rounded p-1.5 focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs mb-1 text-vs-muted">Weight</label>
              <select
                value={activeElement.fontWeight}
                onChange={(e) => handleChange('fontWeight', e.target.value)}
                className="w-full bg-vs-bg border border-vs-border rounded p-1.5 focus:outline-none focus:border-blue-500"
              >
                <option value="normal">Normal</option>
                <option value="bold">Bold</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs mb-1 text-vs-muted">Align</label>
            <select
              value={activeElement.align}
              onChange={(e) => handleChange('align', e.target.value)}
              className="w-full bg-vs-bg border border-vs-border rounded p-1.5 focus:outline-none focus:border-blue-500"
            >
              <option value="left">Left</option>
              <option value="center">Center</option>
              <option value="right">Right</option>
            </select>
          </div>
        </>
      )}

      {activeElement.type === 'image' && (
        <div>
          <label className="block text-xs mb-1 text-vs-muted">Image URL</label>
          <input
            type="text"
            value={activeElement.src}
            onChange={(e) => handleChange('src', e.target.value)}
            className="w-full bg-vs-bg border border-vs-border rounded p-2 text-sm focus:outline-none focus:border-blue-500"
          />
        </div>
      )}

      {activeElement.type === 'shape' && (
        <>
          {/* SVG shape indicator */}
          {activeElement.svgPath && (
            <div className="flex items-center gap-2 p-2 bg-vs-bg rounded border border-vs-border">
              <svg viewBox={`0 0 ${activeElement.viewBox?.[0] || 200} ${activeElement.viewBox?.[1] || 200}`} className="w-8 h-8 flex-shrink-0">
                <path d={activeElement.svgPath} fill={activeElement.fillColor || '#4b83f0'} stroke={activeElement.outlineColor || 'none'} strokeWidth="2" />
              </svg>
              <span className="text-xs text-vs-muted">SVG Shape</span>
            </div>
          )}
          <div>
            <label className="block text-xs mb-1 text-vs-muted">Fill Color</label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={activeElement.fillColor || '#4b83f0'}
                onChange={(e) => handleChange('fillColor', e.target.value)}
                className="w-full h-8 rounded cursor-pointer"
              />
              <button
                onClick={() => handleChange('outlined', !activeElement.outlined)}
                className={`text-[10px] px-2 py-1 rounded border whitespace-nowrap ${activeElement.outlined ? 'bg-blue-600 text-white border-blue-600' : 'border-vs-border text-vs-muted hover:bg-vs-hover'}`}
                title="Outline only (no fill)"
              >
                No Fill
              </button>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs mb-1 text-vs-muted">Outline Width</label>
              <input
                type="number"
                min="0"
                max="20"
                value={activeElement.outlineWidth || 0}
                onChange={(e) => handleChange('outlineWidth', Number(e.target.value))}
                className="w-full bg-vs-bg border border-vs-border rounded p-1.5 focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs mb-1 text-vs-muted">Outline Color</label>
              <input
                type="color"
                value={activeElement.outlineColor || '#000000'}
                onChange={(e) => handleChange('outlineColor', e.target.value)}
                className="w-full h-8 rounded cursor-pointer"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs mb-1 text-vs-muted">Outline Style</label>
            <select
              value={activeElement.outlineStyle || 'solid'}
              onChange={(e) => handleChange('outlineStyle', e.target.value)}
              className="w-full bg-vs-bg border border-vs-border rounded p-1.5 focus:outline-none focus:border-blue-500"
            >
              <option value="solid">Solid</option>
              <option value="dashed">Dashed</option>
              <option value="dotted">Dotted</option>
            </select>
          </div>
        </>
      )}

      {/* Table properties */}
      {activeElement.type === 'table' && (
        <>
          <div className="text-xs text-vs-muted bg-vs-bg rounded p-2 border border-vs-border">
            Table: {activeElement.data?.length || 0} rows × {activeElement.data?.[0]?.length || 0} cols
          </div>
          <div className="space-y-1">
            <label className="block text-xs text-vs-muted font-semibold">Table Operations</label>
            <div className="grid grid-cols-2 gap-1">
              <button
                onClick={() => insertTableRow(currentSlideIndex, activeElementId, (activeElement.data?.length || 1) - 1)}
                className="flex items-center gap-1 text-xs px-2 py-1.5 rounded hover:bg-vs-hover text-vs-foreground border border-vs-border"
              >
                <Plus size={12} /> Row
              </button>
              <button
                onClick={() => insertTableCol(currentSlideIndex, activeElementId, (activeElement.data?.[0]?.length || 1) - 1)}
                className="flex items-center gap-1 text-xs px-2 py-1.5 rounded hover:bg-vs-hover text-vs-foreground border border-vs-border"
              >
                <Plus size={12} /> Col
              </button>
              <button
                onClick={() => deleteTableRow(currentSlideIndex, activeElementId, (activeElement.data?.length || 1) - 1)}
                className="flex items-center gap-1 text-xs px-2 py-1.5 rounded hover:bg-vs-hover text-red-400 border border-vs-border"
                disabled={activeElement.data?.length <= 1}
              >
                <Minus size={12} /> Row
              </button>
              <button
                onClick={() => deleteTableCol(currentSlideIndex, activeElementId, (activeElement.data?.[0]?.length || 1) - 1)}
                className="flex items-center gap-1 text-xs px-2 py-1.5 rounded hover:bg-vs-hover text-red-400 border border-vs-border"
                disabled={activeElement.data?.[0]?.length <= 1}
              >
                <Minus size={12} /> Col
              </button>
            </div>
          </div>
          <div>
            <label className="block text-xs mb-1 text-vs-muted">Theme Color</label>
            <input
              type="color"
              value={activeElement.theme?.color || '#4b83f0'}
              onChange={(e) => handleChange('theme', { ...activeElement.theme, color: e.target.value })}
              className="w-full h-8 rounded cursor-pointer"
            />
          </div>
        </>
      )}

      <div className="pt-4 border-t border-vs-border mt-2">
        <h4 className="text-xs font-semibold mb-2 text-vs-muted">Common Styles</h4>
        <div>
          <label className="block text-[10px] mb-1 text-vs-muted">Opacity</label>
          <input
            type="range"
            min="0"
            max="1"
            step="0.1"
            value={activeElement.opacity !== undefined ? activeElement.opacity : 1}
            onChange={(e) => handleChange('opacity', Number(e.target.value))}
            className="w-full"
          />
        </div>
      </div>

      <div className="pt-4 border-t border-vs-border mt-2">
        <h4 className="text-xs font-semibold mb-2 text-vs-muted">Position & Size</h4>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-[10px] mb-1 text-vs-muted">Left (px)</label>
            <input
              type="number"
              value={Math.round(activeElement.left || 0)}
              onChange={(e) => handleChange('left', Number(e.target.value))}
              className="w-full bg-vs-bg border border-vs-border rounded p-1 focus:outline-none focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-[10px] mb-1 text-vs-muted">Top (px)</label>
            <input
              type="number"
              value={Math.round(activeElement.top || 0)}
              onChange={(e) => handleChange('top', Number(e.target.value))}
              className="w-full bg-vs-bg border border-vs-border rounded p-1 focus:outline-none focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-[10px] mb-1 text-vs-muted">Width (px)</label>
            <input
              type="number"
              value={Math.round(activeElement.width || 0)}
              onChange={(e) => handleChange('width', Number(e.target.value))}
              className="w-full bg-vs-bg border border-vs-border rounded p-1 focus:outline-none focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-[10px] mb-1 text-vs-muted">Height (px)</label>
            <input
              type="number"
              value={Math.round(activeElement.height || 0)}
              onChange={(e) => handleChange('height', Number(e.target.value))}
              className="w-full bg-vs-bg border border-vs-border rounded p-1 focus:outline-none focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-[10px] mb-1 text-vs-muted">Rotate (deg)</label>
            <input
              type="number"
              value={Math.round(activeElement.rotate || 0)}
              onChange={(e) => handleChange('rotate', Number(e.target.value))}
              className="w-full bg-vs-bg border border-vs-border rounded p-1 focus:outline-none focus:border-blue-500"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
