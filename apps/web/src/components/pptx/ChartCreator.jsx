import React, { useState } from 'react';
import { usePptxStore } from '../../store/pptxStore';
import { CHART_CATEGORIES, CHART_META, getChartPreset } from './configs/charts';
import { nanoid } from 'nanoid';

// Mini SVG chart icons for the picker
const ChartIcon = ({ type }) => {
  const iconMap = {
    bar: (
      <svg viewBox="0 0 32 32" className="w-full h-full">
        <rect x="3" y="16" width="5" height="12" fill="#5470c6" rx="1" />
        <rect x="10" y="10" width="5" height="18" fill="#91cc75" rx="1" />
        <rect x="17" y="6" width="5" height="22" fill="#fac858" rx="1" />
        <rect x="24" y="12" width="5" height="16" fill="#ee6666" rx="1" />
      </svg>
    ),
    line: (
      <svg viewBox="0 0 32 32" className="w-full h-full">
        <polyline points="2,24 8,18 14,20 20,12 26,8 30,14" fill="none" stroke="#5470c6" strokeWidth="2" strokeLinecap="round" />
        <circle cx="8" cy="18" r="2" fill="#5470c6" />
        <circle cx="14" cy="20" r="2" fill="#5470c6" />
        <circle cx="20" cy="12" r="2" fill="#5470c6" />
        <circle cx="26" cy="8" r="2" fill="#5470c6" />
      </svg>
    ),
    pie: (
      <svg viewBox="0 0 32 32" className="w-full h-full">
        <path d="M16 4 A12 12 0 0 1 27 20 L16 16 Z" fill="#5470c6" />
        <path d="M27 20 A12 12 0 0 1 8 25 L16 16 Z" fill="#91cc75" />
        <path d="M8 25 A12 12 0 0 1 5 12 L16 16 Z" fill="#fac858" />
        <path d="M5 12 A12 12 0 0 1 16 4 L16 16 Z" fill="#ee6666" />
      </svg>
    ),
    doughnut: (
      <svg viewBox="0 0 32 32" className="w-full h-full">
        <path d="M16 4 A12 12 0 0 1 27 20 L22 18 A7 7 0 0 0 16 9 Z" fill="#5470c6" />
        <path d="M27 20 A12 12 0 0 1 8 25 L11 21 A7 7 0 0 0 22 18 Z" fill="#91cc75" />
        <path d="M8 25 A12 12 0 0 1 16 4 L16 9 A7 7 0 0 0 11 21 Z" fill="#fac858" />
      </svg>
    ),
    area: (
      <svg viewBox="0 0 32 32" className="w-full h-full">
        <path d="M2 28 L2 20 Q8 14 14 18 Q20 10 26 8 L30 12 L30 28 Z" fill="#5470c6" opacity="0.3" />
        <polyline points="2,20 8,16 14,18 20,12 26,8 30,12" fill="none" stroke="#5470c6" strokeWidth="2" />
      </svg>
    ),
    scatter: (
      <svg viewBox="0 0 32 32" className="w-full h-full">
        <circle cx="6" cy="22" r="2.5" fill="#5470c6" />
        <circle cx="10" cy="14" r="2.5" fill="#5470c6" />
        <circle cx="16" cy="18" r="2.5" fill="#91cc75" />
        <circle cx="20" cy="10" r="2.5" fill="#91cc75" />
        <circle cx="24" cy="16" r="2.5" fill="#5470c6" />
        <circle cx="28" cy="8" r="2.5" fill="#91cc75" />
      </svg>
    ),
    radar: (
      <svg viewBox="0 0 32 32" className="w-full h-full">
        <polygon points="16,4 28,12 24,26 8,26 4,12" fill="none" stroke="#ddd" strokeWidth="1" />
        <polygon points="16,8 24,14 22,23 10,23 8,14" fill="#5470c6" opacity="0.3" stroke="#5470c6" strokeWidth="1.5" />
      </svg>
    ),
    funnel: (
      <svg viewBox="0 0 32 32" className="w-full h-full">
        <path d="M2 4 L30 4 L30 8 L2 8 Z" fill="#5470c6" />
        <path d="M5 10 L27 10 L27 14 L5 14 Z" fill="#91cc75" />
        <path d="M8 16 L24 16 L24 20 L8 20 Z" fill="#fac858" />
        <path d="M11 22 L21 22 L21 26 L11 26 Z" fill="#ee6666" />
        <path d="M13 28 L19 28 L19 30 L13 30 Z" fill="#73c0de" />
      </svg>
    ),
    waterfall: (
      <svg viewBox="0 0 32 32" className="w-full h-full">
        <rect x="3" y="6" width="5" height="16" fill="#91cc75" rx="1" />
        <rect x="10" y="10" width="5" height="8" fill="#ee6666" rx="1" />
        <rect x="17" y="12" width="5" height="10" fill="#91cc75" rx="1" />
        <rect x="24" y="16" width="5" height="6" fill="#ee6666" rx="1" />
      </svg>
    ),
    combo: (
      <svg viewBox="0 0 32 32" className="w-full h-full">
        <rect x="4" y="16" width="4" height="12" fill="#5470c6" rx="1" />
        <rect x="14" y="12" width="4" height="16" fill="#5470c6" rx="1" />
        <rect x="24" y="8" width="4" height="20" fill="#5470c6" rx="1" />
        <polyline points="6,14 16,10 26,6" fill="none" stroke="#ee6666" strokeWidth="2" strokeLinecap="round" />
        <circle cx="6" cy="14" r="2" fill="#ee6666" />
        <circle cx="16" cy="10" r="2" fill="#ee6666" />
        <circle cx="26" cy="6" r="2" fill="#ee6666" />
      </svg>
    ),
    stackedBar: (
      <svg viewBox="0 0 32 32" className="w-full h-full">
        <rect x="3" y="18" width="5" height="10" fill="#5470c6" rx="1" />
        <rect x="3" y="12" width="5" height="6" fill="#91cc75" rx="1" />
        <rect x="10" y="14" width="5" height="14" fill="#5470c6" rx="1" />
        <rect x="10" y="6" width="5" height="8" fill="#91cc75" rx="1" />
        <rect x="17" y="16" width="5" height="12" fill="#5470c6" rx="1" />
        <rect x="17" y="10" width="5" height="6" fill="#91cc75" rx="1" />
        <rect x="24" y="12" width="5" height="16" fill="#5470c6" rx="1" />
        <rect x="24" y="4" width="5" height="8" fill="#91cc75" rx="1" />
      </svg>
    ),
    gauge: (
      <svg viewBox="0 0 32 32" className="w-full h-full">
        <path d="M4 24 A12 12 0 0 1 28 24" fill="none" stroke="#eee" strokeWidth="3" strokeLinecap="round" />
        <path d="M4 24 A12 12 0 0 1 22 8" fill="none" stroke="#5470c6" strokeWidth="3" strokeLinecap="round" />
        <line x1="16" y1="24" x2="20" y2="12" stroke="#333" strokeWidth="1.5" strokeLinecap="round" />
        <circle cx="16" cy="24" r="2" fill="#333" />
      </svg>
    ),
  };
  return iconMap[type] || iconMap.bar;
};

/**
 * ChartCreator - Chart type selection panel for the Toolbar dropdown.
 * Displays categorized chart types with preview icons.
 */
export function ChartCreator({ onInsert }) {
  const currentSlideIndex = usePptxStore((s) => s.currentSlideIndex);
  const addElement = usePptxStore((s) => s.addElement);
  const [hoveredChart, setHoveredChart] = useState(null);

  const handleInsertChart = (chartType) => {
    const preset = getChartPreset(chartType);
    addElement(currentSlideIndex, {
      id: `chart-${nanoid(8)}`,
      type: 'chart',
      chartType,
      chartData: preset.data,
      chartOption: preset.option,
      left: 150,
      top: 80,
      width: 700,
      height: 400,
      opacity: 1,
    });
    onInsert?.();
  };

  return (
    <div className="p-4 w-[360px]">
      <div className="text-xs text-vs-muted mb-3 font-semibold uppercase tracking-wider">
        Insert Chart
      </div>

      {CHART_CATEGORIES.map((category) => (
        <div key={category.name} className="mb-3">
          <div className="text-[10px] text-vs-muted mb-1.5 font-medium">
            {category.name}
          </div>
          <div className="grid grid-cols-4 gap-2">
            {category.charts.map((chartType) => {
              const meta = CHART_META[chartType];
              const isHovered = hoveredChart === chartType;
              return (
                <button
                  key={chartType}
                  onClick={() => handleInsertChart(chartType)}
                  onMouseEnter={() => setHoveredChart(chartType)}
                  onMouseLeave={() => setHoveredChart(null)}
                  className={`
                    flex flex-col items-center p-2 rounded-lg transition-all duration-150
                    ${isHovered
                      ? 'bg-blue-500/10 ring-1 ring-blue-500/40 scale-105'
                      : 'hover:bg-vs-hover'
                    }
                  `}
                  title={meta.description}
                >
                  <div className="w-9 h-9 mb-1">
                    <ChartIcon type={chartType} />
                  </div>
                  <span className="text-[10px] text-vs-foreground truncate w-full text-center">
                    {meta.name}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      ))}

      {/* Hover description */}
      {hoveredChart && (
        <div className="mt-2 pt-2 border-t border-vs-border">
          <div className="text-xs text-vs-foreground font-medium">
            {CHART_META[hoveredChart].name}
          </div>
          <div className="text-[10px] text-vs-muted">
            {CHART_META[hoveredChart].description}
          </div>
        </div>
      )}
    </div>
  );
}
