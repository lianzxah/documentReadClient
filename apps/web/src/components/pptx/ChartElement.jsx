import React, { useRef, useEffect, useMemo } from 'react';
import ReactEChartsCore from 'echarts-for-react/lib/core';
import * as echarts from 'echarts/core';
import { BarChart, LineChart, PieChart, ScatterChart, RadarChart, FunnelChart, GaugeChart } from 'echarts/charts';
import { GridComponent, TooltipComponent, LegendComponent, TitleComponent, RadarComponent } from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import { rebuildChartOption } from './configs/charts';

// Register ECharts components
echarts.use([
  BarChart, LineChart, PieChart, ScatterChart, RadarChart, FunnelChart, GaugeChart,
  GridComponent, TooltipComponent, LegendComponent, TitleComponent, RadarComponent,
  CanvasRenderer,
]);

/**
 * ChartElement - Renders a chart inside the slide canvas using ECharts.
 * Supports all chart types defined in configs/charts.js.
 * Double-click to enter edit mode (handled by parent).
 */
export function ChartElement({ element, isSelected, onDoubleClick }) {
  const chartRef = useRef(null);

  const option = useMemo(() => {
    if (element.chartOption) return element.chartOption;
    if (element.chartData) {
      return rebuildChartOption(element.chartType, element.chartData);
    }
    return {};
  }, [element.chartType, element.chartData, element.chartOption]);

  // Resize chart when element dimensions change
  useEffect(() => {
    if (chartRef.current) {
      const instance = chartRef.current.getEchartsInstance();
      if (instance) {
        setTimeout(() => instance.resize(), 0);
      }
    }
  }, [element.width, element.height]);

  return (
    <div
      className="w-full h-full relative"
      onDoubleClick={onDoubleClick}
      style={{ cursor: isSelected ? 'move' : 'pointer' }}
    >
      <ReactEChartsCore
        ref={chartRef}
        echarts={echarts}
        option={option}
        style={{ width: '100%', height: '100%' }}
        opts={{ renderer: 'canvas' }}
        notMerge={true}
        lazyUpdate={true}
      />
      {/* Interaction overlay to prevent ECharts from capturing mouse events during drag */}
      {!isSelected && (
        <div className="absolute inset-0 z-10" />
      )}
    </div>
  );
}

/**
 * Get ECharts instance from a chart element (for export to image).
 */
export function getChartInstance(ref) {
  return ref?.current?.getEchartsInstance?.();
}
