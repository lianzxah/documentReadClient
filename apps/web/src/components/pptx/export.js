import pptxgen from 'pptxgenjs'
import { CHART_COLORS } from './configs/charts'

// Map our shape types to pptxgenjs shape types
function getPptxShapeType(pptx, el) {
  if (el.shapeType === 'circle') return pptx.ShapeType.ellipse
  if (el.shapeType === 'line') return pptx.ShapeType.line
  // For SVG shapes, try to map common ones
  if (el.pathFormula) {
    const formulaMap = {
      roundRect: 'roundRect',
      triangle: 'triangle',
      diamond: 'diamond',
      pentagon: 'pentagon',
      hexagon: 'hexagon',
      star5: 'star5',
      rightArrow: 'rightArrow',
      leftArrow: 'leftArrow',
      upArrow: 'upArrow',
      downArrow: 'downArrow',
    }
    const mapped = formulaMap[el.pathFormula]
    if (mapped && pptx.ShapeType[mapped]) return pptx.ShapeType[mapped]
  }
  return pptx.ShapeType.rect
}

export function exportToPptx(slides, filename = 'Presentation.pptx') {
  const pptx = new pptxgen()

  pptx.layout = 'LAYOUT_16x9'

  slides.forEach((slideData) => {
    const slide = pptx.addSlide()
    const bgColor = slideData.background?.color || '#ffffff'
    slide.background = { color: bgColor.replace('#', '') }

    slideData.elements.forEach((el) => {
      // Convert pixels back to inches for PPTX (1 inch = 100px)
      const x = (el.left || 0) / 100
      const y = (el.top || 0) / 100
      const w = (el.width || 100) / 100
      const h = (el.height || 100) / 100
      const rotate = el.rotate || 0

      if (el.type === 'text') {
        slide.addText(el.content, {
          x,
          y,
          w,
          h,
          color: el.color ? el.color.replace('#', '') : '000000',
          fontSize: el.fontSize || 18,
          bold: el.fontWeight === 'bold',
          align: el.align || 'left',
          valign: 'top',
          rotate,
        })
      } else if (el.type === 'image') {
        const imgOpts = { x, y, w, h, rotate }
        // Handle base64 data URLs
        if (el.src && el.src.startsWith('data:')) {
          imgOpts.data = el.src
        } else {
          imgOpts.path = el.src
        }
        slide.addImage(imgOpts)
      } else if (el.type === 'shape') {
        const shapeType = getPptxShapeType(pptx, el)
        const shapeOpts = {
          x,
          y,
          w,
          h,
          rotate,
        }
        // Fill
        if (!el.outlined) {
          shapeOpts.fill = {
            color: el.fillColor ? el.fillColor.replace('#', '') : '4b83f0',
          }
        }
        // Outline/border
        if (el.outlineWidth > 0 || el.outlined) {
          shapeOpts.line = {
            color: el.outlineColor
              ? el.outlineColor.replace('#', '')
              : '333333',
            width: el.outlineWidth || 1,
            dashType:
              el.outlineStyle === 'dashed'
                ? 'dash'
                : el.outlineStyle === 'dotted'
                  ? 'dot'
                  : 'solid',
          }
        }
        slide.addShape(shapeType, shapeOpts)
      } else if (el.type === 'table') {
        // Export table
        const tableData = (el.data || []).map((row, rowIdx) =>
          row.map((cell) => ({
            text: cell.text || '',
            options: {
              bold: cell.style?.bold || rowIdx === 0,
              fontSize: cell.style?.fontSize || 12,
              color: rowIdx === 0 ? 'FFFFFF' : '333333',
              fill: {
                color:
                  rowIdx === 0
                    ? (el.theme?.color || '#4b83f0').replace('#', '')
                    : 'FFFFFF',
              },
              border: { type: 'solid', pt: 0.5, color: 'CCCCCC' },
              valign: 'middle',
            },
          })),
        )
        if (tableData.length > 0) {
          slide.addTable(tableData, {
            x,
            y,
            w,
            h,
            border: { type: 'solid', pt: 0.5, color: 'CCCCCC' },
            colW: el.colWidths ? el.colWidths.map((cw) => cw * w) : undefined,
          })
        }
      } else if (el.type === 'chart') {
        // Export chart using pptxgenjs native chart support
        exportChartElement(pptx, slide, el, x, y, w, h)
      }
    })
  })

  pptx.writeFile({ fileName: filename })
}

/**
 * Export a chart element using pptxgenjs's native chart capabilities.
 * Falls back to a placeholder shape if the chart type isn't directly supported.
 */
function exportChartElement(pptx, slide, el, x, y, w, h) {
  const { chartType, chartData } = el
  if (!chartData) return

  const chartColors = CHART_COLORS.map((c) => c.replace('#', ''))

  try {
    switch (chartType) {
      case 'bar':
      case 'stackedBar': {
        const series = (chartData.series || []).map((s) => ({
          name: s.name,
          labels: chartData.categories,
          values: s.values,
        }))
        slide.addChart(pptx.charts.BAR, series, {
          x,
          y,
          w,
          h,
          barDir: 'col',
          barGrouping: chartType === 'stackedBar' ? 'stacked' : 'clustered',
          chartColors,
          showLegend: true,
          legendPos: 't',
        })
        break
      }
      case 'line':
      case 'area': {
        const series = (chartData.series || []).map((s) => ({
          name: s.name,
          labels: chartData.categories,
          values: s.values,
        }))
        slide.addChart(pptx.charts.LINE, series, {
          x,
          y,
          w,
          h,
          chartColors,
          showLegend: true,
          legendPos: 't',
          lineSmooth: true,
          lineFill: chartType === 'area',
        })
        break
      }
      case 'pie':
      case 'doughnut': {
        const items = chartData.items || []
        const series = [
          {
            name: 'Data',
            labels: items.map((i) => i.name),
            values: items.map((i) => i.value),
          },
        ]
        slide.addChart(
          chartType === 'doughnut' ? pptx.charts.DOUGHNUT : pptx.charts.PIE,
          series,
          { x, y, w, h, chartColors, showLegend: true, legendPos: 'r' },
        )
        break
      }
      case 'scatter': {
        const series = (chartData.series || []).map((s) => ({
          name: s.name,
          values: s.values.map((pt) => pt[1]),
          labels: s.values.map((pt) => String(pt[0])),
        }))
        slide.addChart(pptx.charts.SCATTER, series, {
          x,
          y,
          w,
          h,
          chartColors,
          showLegend: true,
        })
        break
      }
      case 'radar': {
        const indicators = chartData.indicators || []
        const series = (chartData.series || []).map((s) => ({
          name: s.name,
          labels: indicators.map((ind) => ind.name),
          values: s.values,
        }))
        slide.addChart(pptx.charts.RADAR, series, {
          x,
          y,
          w,
          h,
          chartColors,
          showLegend: true,
        })
        break
      }
      case 'combo': {
        // Combo chart: bar + line
        const barSeries = (chartData.barSeries || []).map((s) => ({
          name: s.name,
          labels: chartData.categories,
          values: s.values,
        }))
        const lineSeries = (chartData.lineSeries || []).map((s) => ({
          name: s.name,
          labels: chartData.categories,
          values: s.values,
        }))
        // Use a multi-type chart by adding bar first, then line overlay
        if (barSeries.length > 0) {
          slide.addChart(pptx.charts.BAR, barSeries, {
            x,
            y,
            w,
            h,
            barDir: 'col',
            chartColors,
            showLegend: true,
            legendPos: 't',
          })
        }
        // Note: pptxgenjs doesn't support true combo in one call;
        // for a better result, fall through to image export
        break
      }
      default: {
        // For unsupported types (funnel, waterfall, gauge),
        // add a placeholder with the chart type label
        slide.addShape(pptx.ShapeType.rect, {
          x,
          y,
          w,
          h,
          fill: { color: 'F8F9FA' },
          line: { color: 'CCCCCC', width: 1 },
        })
        slide.addText(`[${chartType} chart]`, {
          x,
          y,
          w,
          h,
          align: 'center',
          valign: 'middle',
          fontSize: 14,
          color: '666666',
        })
      }
    }
  } catch (err) {
    console.warn('[export] Chart export failed:', err)
    // Fallback: placeholder rectangle
    slide.addShape(pptx.ShapeType.rect, {
      x,
      y,
      w,
      h,
      fill: { color: 'F8F9FA' },
      line: { color: 'CCCCCC', width: 1 },
    })
  }
}
