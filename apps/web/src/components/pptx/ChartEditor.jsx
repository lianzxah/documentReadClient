import React, { useState, useEffect, useCallback } from 'react';
import { X, Plus, Trash2, RotateCcw } from 'lucide-react';
import { usePptxStore } from '../../store/pptxStore';
import { CHART_META, getChartPreset, rebuildChartOption } from './configs/charts';

/**
 * ChartEditor - Inline data editor for chart elements.
 * Opens as an overlay when user double-clicks a chart.
 * Supports editing data tables for all chart types.
 */
export function ChartEditor({ element, slideIndex, onClose }) {
  const updateElement = usePptxStore((s) => s.updateElement);
  const [localData, setLocalData] = useState(element.chartData);
  const chartType = element.chartType;
  const meta = CHART_META[chartType] || { name: 'Chart' };

  // Sync local data changes to the element with live preview
  const applyChanges = useCallback(() => {
    const newOption = rebuildChartOption(chartType, localData);
    updateElement(slideIndex, element.id, {
      chartData: localData,
      chartOption: newOption,
    });
  }, [localData, chartType, slideIndex, element.id, updateElement]);

  useEffect(() => {
    applyChanges();
  }, [localData, applyChanges]);

  const handleReset = () => {
    const preset = getChartPreset(chartType);
    setLocalData(preset.data);
  };

  // Determine editor layout based on chart type
  const isCategory = ['bar', 'line', 'area', 'combo', 'stackedBar'].includes(chartType);
  const isPie = ['pie', 'doughnut', 'funnel'].includes(chartType);
  const isGauge = chartType === 'gauge';
  const isRadar = chartType === 'radar';
  const isScatter = chartType === 'scatter';
  const isWaterfall = chartType === 'waterfall';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="bg-vs-sidebar border border-vs-border rounded-xl shadow-2xl w-[640px] max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-vs-border">
          <div className="flex items-center gap-2">
            <h3 className="text-vs-foreground font-semibold text-sm">
              Edit {meta.name} Data
            </h3>
            <button
              onClick={handleReset}
              className="text-vs-muted hover:text-vs-foreground p-1 rounded hover:bg-vs-hover text-xs flex items-center gap-1"
              title="Reset to defaults"
            >
              <RotateCcw size={12} /> Reset
            </button>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-vs-hover text-vs-muted">
            <X size={18} />
          </button>
        </div>

        {/* Editor Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {isCategory && <CategoryEditor data={localData} onChange={setLocalData} chartType={chartType} />}
          {isPie && <PieEditor data={localData} onChange={setLocalData} />}
          {isGauge && <GaugeEditor data={localData} onChange={setLocalData} />}
          {isRadar && <RadarEditor data={localData} onChange={setLocalData} />}
          {isScatter && <ScatterEditor data={localData} onChange={setLocalData} />}
          {isWaterfall && <WaterfallEditor data={localData} onChange={setLocalData} />}
        </div>
      </div>
    </div>
  );
}

// === Category-based editor (bar, line, area, combo, stackedBar) ===
function CategoryEditor({ data, onChange, chartType }) {
  const isCombo = chartType === 'combo';
  const categories = data.categories || [];
  const series = isCombo ? (data.barSeries || []) : (data.series || []);
  const lineSeries = isCombo ? (data.lineSeries || []) : [];

  const updateCategory = (idx, value) => {
    const newCats = [...categories];
    newCats[idx] = value;
    onChange({ ...data, categories: newCats });
  };

  const addCategory = () => {
    const newCats = [...categories, `Cat ${categories.length + 1}`];
    const updateSeries = (s) => s.map((sr) => ({ ...sr, values: [...sr.values, 0] }));
    if (isCombo) {
      onChange({ ...data, categories: newCats, barSeries: updateSeries(data.barSeries || []), lineSeries: updateSeries(data.lineSeries || []) });
    } else {
      onChange({ ...data, categories: newCats, series: updateSeries(series) });
    }
  };

  const removeCategory = (idx) => {
    if (categories.length <= 2) return;
    const newCats = categories.filter((_, i) => i !== idx);
    const updateSeries = (s) => s.map((sr) => ({ ...sr, values: sr.values.filter((_, i) => i !== idx) }));
    if (isCombo) {
      onChange({ ...data, categories: newCats, barSeries: updateSeries(data.barSeries || []), lineSeries: updateSeries(data.lineSeries || []) });
    } else {
      onChange({ ...data, categories: newCats, series: updateSeries(series) });
    }
  };

  const updateSeriesValue = (seriesIdx, catIdx, value, isLine = false) => {
    const key = isLine ? 'lineSeries' : (isCombo ? 'barSeries' : 'series');
    const arr = [...(data[key] || [])];
    arr[seriesIdx] = { ...arr[seriesIdx], values: arr[seriesIdx].values.map((v, i) => i === catIdx ? Number(value) || 0 : v) };
    onChange({ ...data, [key]: arr });
  };

  const updateSeriesName = (seriesIdx, name, isLine = false) => {
    const key = isLine ? 'lineSeries' : (isCombo ? 'barSeries' : 'series');
    const arr = [...(data[key] || [])];
    arr[seriesIdx] = { ...arr[seriesIdx], name };
    onChange({ ...data, [key]: arr });
  };

  const addSeries = (isLine = false) => {
    const key = isLine ? 'lineSeries' : (isCombo ? 'barSeries' : 'series');
    const arr = [...(data[key] || [])];
    arr.push({ name: `Series ${arr.length + 1}`, values: categories.map(() => 0) });
    onChange({ ...data, [key]: arr });
  };

  return (
    <div className="space-y-3">
      {/* Data table */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr>
              <th className="p-1.5 text-left text-vs-muted font-medium border border-vs-border bg-vs-bg w-24">Category</th>
              {series.map((s, i) => (
                <th key={i} className="p-1.5 border border-vs-border bg-vs-bg">
                  <input
                    value={s.name}
                    onChange={(e) => updateSeriesName(i, e.target.value)}
                    className="w-full bg-transparent text-vs-foreground text-center outline-none border-b border-transparent focus:border-blue-400"
                  />
                </th>
              ))}
              {lineSeries.map((s, i) => (
                <th key={`l${i}`} className="p-1.5 border border-vs-border bg-blue-500/5">
                  <input
                    value={s.name}
                    onChange={(e) => updateSeriesName(i, e.target.value, true)}
                    className="w-full bg-transparent text-vs-foreground text-center outline-none border-b border-transparent focus:border-blue-400"
                  />
                  <span className="text-[9px] text-blue-400">(line)</span>
                </th>
              ))}
              <th className="p-1 border border-vs-border bg-vs-bg w-8">
                <button onClick={() => addSeries(false)} className="text-vs-muted hover:text-green-400" title="Add series">
                  <Plus size={12} />
                </button>
              </th>
            </tr>
          </thead>
          <tbody>
            {categories.map((cat, catIdx) => (
              <tr key={catIdx}>
                <td className="p-1 border border-vs-border">
                  <input
                    value={cat}
                    onChange={(e) => updateCategory(catIdx, e.target.value)}
                    className="w-full bg-transparent text-vs-foreground outline-none text-xs px-1 border-b border-transparent focus:border-blue-400"
                  />
                </td>
                {series.map((s, sIdx) => (
                  <td key={sIdx} className="p-1 border border-vs-border">
                    <input
                      type="number"
                      value={s.values[catIdx]}
                      onChange={(e) => updateSeriesValue(sIdx, catIdx, e.target.value)}
                      className="w-full bg-transparent text-vs-foreground text-center outline-none text-xs px-1 border-b border-transparent focus:border-blue-400"
                    />
                  </td>
                ))}
                {lineSeries.map((s, sIdx) => (
                  <td key={`l${sIdx}`} className="p-1 border border-vs-border bg-blue-500/5">
                    <input
                      type="number"
                      value={s.values[catIdx]}
                      onChange={(e) => updateSeriesValue(sIdx, catIdx, e.target.value, true)}
                      className="w-full bg-transparent text-vs-foreground text-center outline-none text-xs px-1 border-b border-transparent focus:border-blue-400"
                    />
                  </td>
                ))}
                <td className="p-1 border border-vs-border text-center">
                  <button
                    onClick={() => removeCategory(catIdx)}
                    className="text-vs-muted hover:text-red-400"
                    disabled={categories.length <= 2}
                  >
                    <Trash2 size={11} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button onClick={addCategory} className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1">
        <Plus size={12} /> Add Category
      </button>
    </div>
  );
}

// === Pie/Doughnut/Funnel editor ===
function PieEditor({ data, onChange }) {
  const items = data.items || [];

  const updateItem = (idx, key, value) => {
    const newItems = items.map((item, i) =>
      i === idx ? { ...item, [key]: key === 'value' ? Number(value) || 0 : value } : item
    );
    onChange({ ...data, items: newItems });
  };

  const addItem = () => {
    onChange({ ...data, items: [...items, { name: `Item ${items.length + 1}`, value: 10 }] });
  };

  const removeItem = (idx) => {
    if (items.length <= 2) return;
    onChange({ ...data, items: items.filter((_, i) => i !== idx) });
  };

  return (
    <div className="space-y-2">
      {items.map((item, idx) => (
        <div key={idx} className="flex items-center gap-2">
          <input
            value={item.name}
            onChange={(e) => updateItem(idx, 'name', e.target.value)}
            className="flex-1 bg-vs-bg border border-vs-border rounded px-2 py-1 text-xs text-vs-foreground outline-none focus:border-blue-400"
            placeholder="Name"
          />
          <input
            type="number"
            value={item.value}
            onChange={(e) => updateItem(idx, 'value', e.target.value)}
            className="w-20 bg-vs-bg border border-vs-border rounded px-2 py-1 text-xs text-vs-foreground outline-none focus:border-blue-400 text-center"
          />
          <button onClick={() => removeItem(idx)} className="text-vs-muted hover:text-red-400 p-1" disabled={items.length <= 2}>
            <Trash2 size={12} />
          </button>
        </div>
      ))}
      <button onClick={addItem} className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1">
        <Plus size={12} /> Add Item
      </button>
    </div>
  );
}

// === Gauge editor ===
function GaugeEditor({ data, onChange }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <label className="text-xs text-vs-muted w-16">Value</label>
        <input
          type="number"
          min="0"
          max="100"
          value={data.value}
          onChange={(e) => onChange({ ...data, value: Number(e.target.value) || 0 })}
          className="flex-1 bg-vs-bg border border-vs-border rounded px-2 py-1.5 text-xs text-vs-foreground outline-none focus:border-blue-400"
        />
      </div>
      <div className="flex items-center gap-3">
        <label className="text-xs text-vs-muted w-16">Label</label>
        <input
          value={data.name}
          onChange={(e) => onChange({ ...data, name: e.target.value })}
          className="flex-1 bg-vs-bg border border-vs-border rounded px-2 py-1.5 text-xs text-vs-foreground outline-none focus:border-blue-400"
        />
      </div>
      <input
        type="range"
        min="0"
        max="100"
        value={data.value}
        onChange={(e) => onChange({ ...data, value: Number(e.target.value) })}
        className="w-full"
      />
    </div>
  );
}

// === Radar editor ===
function RadarEditor({ data, onChange }) {
  const indicators = data.indicators || [];
  const series = data.series || [];

  const updateIndicator = (idx, key, value) => {
    const newInd = indicators.map((ind, i) =>
      i === idx ? { ...ind, [key]: key === 'max' ? Number(value) || 100 : value } : ind
    );
    onChange({ ...data, indicators: newInd });
  };

  const updateSeriesValue = (sIdx, vIdx, value) => {
    const newSeries = series.map((s, i) =>
      i === sIdx ? { ...s, values: s.values.map((v, j) => j === vIdx ? Number(value) || 0 : v) } : s
    );
    onChange({ ...data, series: newSeries });
  };

  return (
    <div className="space-y-3">
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr>
            <th className="p-1.5 text-left text-vs-muted border border-vs-border bg-vs-bg">Dimension</th>
            <th className="p-1.5 text-center text-vs-muted border border-vs-border bg-vs-bg w-16">Max</th>
            {series.map((s, i) => (
              <th key={i} className="p-1.5 text-center text-vs-foreground border border-vs-border bg-vs-bg">{s.name}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {indicators.map((ind, idx) => (
            <tr key={idx}>
              <td className="p-1 border border-vs-border">
                <input
                  value={ind.name}
                  onChange={(e) => updateIndicator(idx, 'name', e.target.value)}
                  className="w-full bg-transparent text-vs-foreground outline-none px-1"
                />
              </td>
              <td className="p-1 border border-vs-border">
                <input
                  type="number"
                  value={ind.max}
                  onChange={(e) => updateIndicator(idx, 'max', e.target.value)}
                  className="w-full bg-transparent text-vs-foreground text-center outline-none px-1"
                />
              </td>
              {series.map((s, sIdx) => (
                <td key={sIdx} className="p-1 border border-vs-border">
                  <input
                    type="number"
                    value={s.values[idx]}
                    onChange={(e) => updateSeriesValue(sIdx, idx, e.target.value)}
                    className="w-full bg-transparent text-vs-foreground text-center outline-none px-1"
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// === Scatter editor ===
function ScatterEditor({ data, onChange }) {
  const series = data.series || [];

  const updatePoint = (sIdx, pIdx, axis, value) => {
    const newSeries = series.map((s, i) => {
      if (i !== sIdx) return s;
      const newValues = s.values.map((pt, j) => {
        if (j !== pIdx) return pt;
        return axis === 0 ? [Number(value) || 0, pt[1]] : [pt[0], Number(value) || 0];
      });
      return { ...s, values: newValues };
    });
    onChange({ ...data, series: newSeries });
  };

  const addPoint = (sIdx) => {
    const newSeries = series.map((s, i) =>
      i === sIdx ? { ...s, values: [...s.values, [0, 0]] } : s
    );
    onChange({ ...data, series: newSeries });
  };

  return (
    <div className="space-y-3">
      {series.map((s, sIdx) => (
        <div key={sIdx}>
          <div className="text-xs text-vs-foreground font-medium mb-1">{s.name}</div>
          <div className="grid grid-cols-2 gap-1 text-xs">
            <span className="text-vs-muted text-center">X</span>
            <span className="text-vs-muted text-center">Y</span>
            {s.values.map((pt, pIdx) => (
              <React.Fragment key={pIdx}>
                <input
                  type="number"
                  value={pt[0]}
                  onChange={(e) => updatePoint(sIdx, pIdx, 0, e.target.value)}
                  className="bg-vs-bg border border-vs-border rounded px-1.5 py-0.5 text-vs-foreground text-center outline-none focus:border-blue-400"
                />
                <input
                  type="number"
                  value={pt[1]}
                  onChange={(e) => updatePoint(sIdx, pIdx, 1, e.target.value)}
                  className="bg-vs-bg border border-vs-border rounded px-1.5 py-0.5 text-vs-foreground text-center outline-none focus:border-blue-400"
                />
              </React.Fragment>
            ))}
          </div>
          <button onClick={() => addPoint(sIdx)} className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1 mt-1">
            <Plus size={11} /> Add Point
          </button>
        </div>
      ))}
    </div>
  );
}

// === Waterfall editor ===
function WaterfallEditor({ data, onChange }) {
  const categories = data.categories || [];
  const values = data.values || [];

  const updateCategory = (idx, value) => {
    const newCats = [...categories];
    newCats[idx] = value;
    onChange({ ...data, categories: newCats });
  };

  const updateValue = (idx, value) => {
    const newVals = [...values];
    newVals[idx] = Number(value) || 0;
    onChange({ ...data, values: newVals });
  };

  const addRow = () => {
    onChange({ ...data, categories: [...categories, `Step ${categories.length + 1}`], values: [...values, 0] });
  };

  const removeRow = (idx) => {
    if (categories.length <= 2) return;
    onChange({ ...data, categories: categories.filter((_, i) => i !== idx), values: values.filter((_, i) => i !== idx) });
  };

  return (
    <div className="space-y-2">
      {categories.map((cat, idx) => (
        <div key={idx} className="flex items-center gap-2">
          <input
            value={cat}
            onChange={(e) => updateCategory(idx, e.target.value)}
            className="flex-1 bg-vs-bg border border-vs-border rounded px-2 py-1 text-xs text-vs-foreground outline-none focus:border-blue-400"
          />
          <input
            type="number"
            value={values[idx]}
            onChange={(e) => updateValue(idx, e.target.value)}
            className="w-24 bg-vs-bg border border-vs-border rounded px-2 py-1 text-xs text-vs-foreground text-center outline-none focus:border-blue-400"
          />
          <button onClick={() => removeRow(idx)} className="text-vs-muted hover:text-red-400 p-1" disabled={categories.length <= 2}>
            <Trash2 size={12} />
          </button>
        </div>
      ))}
      <button onClick={addRow} className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1">
        <Plus size={12} /> Add Step
      </button>
    </div>
  );
}
