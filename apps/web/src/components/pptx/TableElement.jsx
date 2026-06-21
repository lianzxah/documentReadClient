import React, { useState, useRef, useCallback } from 'react';
import { usePptxStore } from '../../store/pptxStore';

export function TableElement({ element, slideIndex, isSelected }) {
  const updateTableCell = usePptxStore((s) => s.updateTableCell);
  const [editingCell, setEditingCell] = useState(null); // { row, col }
  const [selectedCells, setSelectedCells] = useState([]);
  const cellRefs = useRef({});

  const { data, colWidths, outline, theme, cellMinHeight = 36 } = element;
  const totalWidth = element.width || 400;

  const getCellStyle = (cell, rowIdx) => {
    const style = cell.style || {};
    const isHeader = theme?.rowHeader && rowIdx === 0;
    return {
      minHeight: cellMinHeight,
      padding: '4px 8px',
      fontSize: style.fontsize || '13px',
      fontWeight: style.bold || isHeader ? 'bold' : 'normal',
      fontStyle: style.em ? 'italic' : 'normal',
      textDecoration: [
        style.underline ? 'underline' : '',
        style.strikethrough ? 'line-through' : '',
      ].filter(Boolean).join(' ') || 'none',
      color: style.color || (isHeader ? '#ffffff' : '#333333'),
      backgroundColor: style.backcolor || (isHeader ? (theme?.color || '#4b83f0') : 'transparent'),
      textAlign: style.align || 'left',
      verticalAlign: style.vAlign || 'middle',
      borderWidth: outline?.width || 1,
      borderStyle: outline?.style || 'solid',
      borderColor: outline?.color || '#d1d5db',
      overflow: 'hidden',
      wordBreak: 'break-word',
      whiteSpace: 'pre-wrap',
      cursor: 'default',
      outline: 'none',
    };
  };

  const handleCellDoubleClick = (rowIdx, colIdx) => {
    setEditingCell({ row: rowIdx, col: colIdx });
    setTimeout(() => {
      const key = `${rowIdx}-${colIdx}`;
      const cellEl = cellRefs.current[key];
      if (cellEl) {
        cellEl.focus();
        // Place cursor at end
        const range = document.createRange();
        const sel = window.getSelection();
        range.selectNodeContents(cellEl);
        range.collapse(false);
        sel.removeAllRanges();
        sel.addRange(range);
      }
    }, 0);
  };

  const handleCellBlur = (rowIdx, colIdx, e) => {
    const newText = e.target.innerText;
    updateTableCell(slideIndex, element.id, rowIdx, colIdx, { text: newText });
    setEditingCell(null);
  };

  const handleCellKeyDown = (e, rowIdx, colIdx) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const nextCol = colIdx + 1 < data[0].length ? colIdx + 1 : 0;
      const nextRow = nextCol === 0 ? Math.min(rowIdx + 1, data.length - 1) : rowIdx;
      handleCellDoubleClick(nextRow, nextCol);
    }
    if (e.key === 'Escape') {
      setEditingCell(null);
    }
  };

  const handleCellClick = (rowIdx, colIdx, e) => {
    e.stopPropagation();
    if (editingCell?.row === rowIdx && editingCell?.col === colIdx) return;
    setSelectedCells([{ row: rowIdx, col: colIdx }]);
  };

  // Determine if a cell should be hidden due to merging
  const getHiddenCells = useCallback(() => {
    const hidden = new Set();
    data.forEach((row, rowIdx) => {
      row.forEach((cell, colIdx) => {
        if (cell.colspan > 1 || cell.rowspan > 1) {
          for (let r = rowIdx; r < rowIdx + (cell.rowspan || 1); r++) {
            for (let c = colIdx; c < colIdx + (cell.colspan || 1); c++) {
              if (r !== rowIdx || c !== colIdx) {
                hidden.add(`${r}-${c}`);
              }
            }
          }
        }
      });
    });
    return hidden;
  }, [data]);

  const hiddenCells = getHiddenCells();

  return (
    <div className="w-full h-full overflow-hidden" style={{ pointerEvents: isSelected ? 'auto' : 'none' }}>
      <table
        className="border-collapse w-full h-full"
        style={{ tableLayout: 'fixed' }}
      >
        <colgroup>
          {colWidths.map((w, i) => (
            <col key={i} style={{ width: `${w * 100}%` }} />
          ))}
        </colgroup>
        <tbody>
          {data.map((row, rowIdx) => (
            <tr key={rowIdx}>
              {row.map((cell, colIdx) => {
                const key = `${rowIdx}-${colIdx}`;
                if (hiddenCells.has(key)) return null;

                const isEditing = editingCell?.row === rowIdx && editingCell?.col === colIdx;
                const isCellSelected = selectedCells.some(
                  (s) => s.row === rowIdx && s.col === colIdx
                );

                return (
                  <td
                    key={key}
                    ref={(el) => { cellRefs.current[key] = el; }}
                    colSpan={cell.colspan || 1}
                    rowSpan={cell.rowspan || 1}
                    style={{
                      ...getCellStyle(cell, rowIdx),
                      ...(isCellSelected && !isEditing ? { boxShadow: 'inset 0 0 0 2px #3b82f6' } : {}),
                    }}
                    contentEditable={isEditing}
                    suppressContentEditableWarning
                    onClick={(e) => handleCellClick(rowIdx, colIdx, e)}
                    onDoubleClick={() => handleCellDoubleClick(rowIdx, colIdx)}
                    onBlur={(e) => isEditing && handleCellBlur(rowIdx, colIdx, e)}
                    onKeyDown={(e) => isEditing && handleCellKeyDown(e, rowIdx, colIdx)}
                  >
                    {cell.text}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
