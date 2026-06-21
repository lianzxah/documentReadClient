import React, { useState } from 'react';
import { nanoid } from 'nanoid';
import { usePptxStore } from '../../store/pptxStore';

export function TableGenerator({ onClose }) {
  const [hoverRow, setHoverRow] = useState(0);
  const [hoverCol, setHoverCol] = useState(0);
  const [customMode, setCustomMode] = useState(false);
  const [customRows, setCustomRows] = useState(3);
  const [customCols, setCustomCols] = useState(3);

  const currentSlideIndex = usePptxStore((s) => s.currentSlideIndex);
  const addElement = usePptxStore((s) => s.addElement);

  const createTable = (rows, cols) => {
    const colWidths = Array.from({ length: cols }, () => 1 / cols);
    const data = Array.from({ length: rows }, (_, rowIdx) =>
      Array.from({ length: cols }, (_, colIdx) => ({
        id: nanoid(8),
        colspan: 1,
        rowspan: 1,
        text: rowIdx === 0 ? `列 ${colIdx + 1}` : '',
        style: rowIdx === 0
          ? { bold: true, backcolor: '#4b83f0', color: '#ffffff', fontsize: '14px', align: 'center' }
          : { fontsize: '13px' },
      }))
    );

    const tableWidth = Math.min(cols * 120, 800);
    const tableHeight = rows * 36;

    addElement(currentSlideIndex, {
      id: `table-${nanoid(8)}`,
      type: 'table',
      left: (1000 - tableWidth) / 2,
      top: (562.5 - tableHeight) / 2,
      width: tableWidth,
      height: tableHeight,
      rotate: 0,
      opacity: 1,
      data,
      colWidths,
      cellMinHeight: 36,
      outline: { style: 'solid', width: 1, color: '#d1d5db' },
      theme: {
        color: '#4b83f0',
        rowHeader: true,
        rowFooter: false,
        colHeader: false,
        colFooter: false,
      },
    });
    if (onClose) onClose();
  };

  return (
    <div className="absolute top-full left-0 mt-1 z-50 bg-vs-sidebar border border-vs-border rounded-lg shadow-xl p-3 w-[260px]">
      {!customMode ? (
        <>
          <div className="text-xs text-vs-muted mb-2">
            {hoverRow > 0 ? `${hoverRow} × ${hoverCol} 表格` : '选择表格大小'}
          </div>
          <div className="grid grid-cols-8 gap-0.5 mb-2">
            {Array.from({ length: 8 }).map((_, row) =>
              Array.from({ length: 8 }).map((_, col) => (
                <div
                  key={`${row}-${col}`}
                  className={`w-5 h-5 border rounded-sm cursor-pointer transition-colors ${
                    row < hoverRow && col < hoverCol
                      ? 'bg-blue-500 border-blue-400'
                      : 'bg-vs-bg border-vs-border hover:border-blue-300'
                  }`}
                  onMouseEnter={() => { setHoverRow(row + 1); setHoverCol(col + 1); }}
                  onMouseLeave={() => { setHoverRow(0); setHoverCol(0); }}
                  onClick={() => createTable(row + 1, col + 1)}
                />
              ))
            )}
          </div>
          <button
            onClick={() => setCustomMode(true)}
            className="w-full text-xs text-vs-muted hover:text-vs-foreground py-1 border-t border-vs-border mt-1 pt-2"
          >
            自定义大小...
          </button>
        </>
      ) : (
        <div className="space-y-2">
          <div className="text-xs text-vs-muted">自定义表格大小</div>
          <div className="flex items-center gap-2">
            <div className="flex-1">
              <label className="text-[10px] text-vs-muted">行</label>
              <input
                type="number"
                min="1"
                max="20"
                value={customRows}
                onChange={(e) => setCustomRows(Math.max(1, Math.min(20, Number(e.target.value))))}
                className="w-full bg-vs-bg border border-vs-border rounded p-1 text-sm"
              />
            </div>
            <div className="flex-1">
              <label className="text-[10px] text-vs-muted">列</label>
              <input
                type="number"
                min="1"
                max="20"
                value={customCols}
                onChange={(e) => setCustomCols(Math.max(1, Math.min(20, Number(e.target.value))))}
                className="w-full bg-vs-bg border border-vs-border rounded p-1 text-sm"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setCustomMode(false)}
              className="flex-1 text-xs px-2 py-1.5 rounded bg-vs-hover hover:bg-vs-border"
            >
              返回
            </button>
            <button
              onClick={() => createTable(customRows, customCols)}
              className="flex-1 text-xs px-2 py-1.5 rounded bg-blue-600 hover:bg-blue-700 text-white"
            >
              插入
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
