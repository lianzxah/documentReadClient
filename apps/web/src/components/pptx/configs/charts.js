/**
 * Chart configurations and preset data for PPT chart insertion.
 * Supports: Bar, Line, Pie, Doughnut, Area, Scatter, Radar, Funnel, Waterfall, Combo
 */

// Color palettes
export const CHART_COLORS = [
  '#5470c6',
  '#91cc75',
  '#fac858',
  '#ee6666',
  '#73c0de',
  '#3ba272',
  '#fc8452',
  '#9a60b4',
  '#ea7ccc',
  '#48b8d0',
]

export const CHART_CATEGORIES = [
  {
    name: '基础图表',
    charts: ['bar', 'line', 'pie', 'doughnut'],
  },
  {
    name: '高级图表',
    charts: ['area', 'scatter', 'radar', 'funnel'],
  },
  {
    name: '商务图表',
    charts: ['waterfall', 'combo', 'stackedBar', 'gauge'],
  },
]

export const CHART_META = {
  bar: { name: '柱状图', icon: 'bar', description: '对比不同类别数据' },
  line: { name: '折线图', icon: 'line', description: '展示数据趋势' },
  pie: { name: '饼图', icon: 'pie', description: '展示数据占比' },
  doughnut: {
    name: '环形图',
    icon: 'doughnut',
    description: '带中心空间的占比',
  },
  area: { name: '面积图', icon: 'area', description: '强调累计量' },
  scatter: { name: '散点图', icon: 'scatter', description: '展示数据分布' },
  radar: { name: '雷达图', icon: 'radar', description: '多维度对比' },
  funnel: { name: '漏斗图', icon: 'funnel', description: '流程转化率' },
  waterfall: { name: '瀑布图', icon: 'waterfall', description: '增减分析' },
  combo: { name: '组合图', icon: 'combo', description: '柱线混合对比' },
  stackedBar: { name: '堆叠柱图', icon: 'stackedBar', description: '组成分析' },
  gauge: { name: '仪表盘', icon: 'gauge', description: '进度/目标达成' },
}

/**
 * Generate default ECharts options for each chart type.
 * Returns { option, data } where data is the editable dataset.
 */
export function getChartPreset(chartType) {
  switch (chartType) {
    case 'bar':
      return {
        data: {
          categories: ['Q1', 'Q2', 'Q3', 'Q4'],
          series: [
            { name: '2024', values: [120, 200, 150, 180] },
            { name: '2025', values: [150, 230, 180, 220] },
          ],
        },
        option: buildBarOption({
          categories: ['Q1', 'Q2', 'Q3', 'Q4'],
          series: [
            { name: '2024', values: [120, 200, 150, 180] },
            { name: '2025', values: [150, 230, 180, 220] },
          ],
        }),
      }

    case 'line':
      return {
        data: {
          categories: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
          series: [
            { name: 'Revenue', values: [820, 932, 901, 1034, 1290, 1330] },
            { name: 'Cost', values: [620, 732, 701, 834, 890, 930] },
          ],
        },
        option: buildLineOption({
          categories: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
          series: [
            { name: 'Revenue', values: [820, 932, 901, 1034, 1290, 1330] },
            { name: 'Cost', values: [620, 732, 701, 834, 890, 930] },
          ],
        }),
      }

    case 'pie':
      return {
        data: {
          items: [
            { name: 'Product A', value: 335 },
            { name: 'Product B', value: 234 },
            { name: 'Product C', value: 154 },
            { name: 'Product D', value: 135 },
            { name: 'Product E', value: 108 },
          ],
        },
        option: buildPieOption(
          {
            items: [
              { name: 'Product A', value: 335 },
              { name: 'Product B', value: 234 },
              { name: 'Product C', value: 154 },
              { name: 'Product D', value: 135 },
              { name: 'Product E', value: 108 },
            ],
          },
          false,
        ),
      }

    case 'doughnut':
      return {
        data: {
          items: [
            { name: 'Marketing', value: 40 },
            { name: 'R&D', value: 30 },
            { name: 'Operations', value: 20 },
            { name: 'Support', value: 10 },
          ],
        },
        option: buildPieOption(
          {
            items: [
              { name: 'Marketing', value: 40 },
              { name: 'R&D', value: 30 },
              { name: 'Operations', value: 20 },
              { name: 'Support', value: 10 },
            ],
          },
          true,
        ),
      }

    case 'area':
      return {
        data: {
          categories: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
          series: [
            { name: 'Traffic', values: [820, 932, 901, 934, 1290, 1330, 1320] },
          ],
        },
        option: buildAreaOption({
          categories: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
          series: [
            { name: 'Traffic', values: [820, 932, 901, 934, 1290, 1330, 1320] },
          ],
        }),
      }

    case 'scatter':
      return {
        data: {
          series: [
            {
              name: 'Group A',
              values: [
                [10, 8.04],
                [8, 6.95],
                [13, 7.58],
                [9, 8.81],
                [11, 8.33],
                [14, 9.96],
                [6, 7.24],
              ],
            },
            {
              name: 'Group B',
              values: [
                [4, 4.26],
                [7, 4.82],
                [12, 10.84],
                [5, 5.68],
                [3, 4.34],
                [8, 6.42],
                [10, 7.77],
              ],
            },
          ],
        },
        option: buildScatterOption({
          series: [
            {
              name: 'Group A',
              values: [
                [10, 8.04],
                [8, 6.95],
                [13, 7.58],
                [9, 8.81],
                [11, 8.33],
                [14, 9.96],
                [6, 7.24],
              ],
            },
            {
              name: 'Group B',
              values: [
                [4, 4.26],
                [7, 4.82],
                [12, 10.84],
                [5, 5.68],
                [3, 4.34],
                [8, 6.42],
                [10, 7.77],
              ],
            },
          ],
        }),
      }

    case 'radar':
      return {
        data: {
          indicators: [
            { name: 'Sales', max: 100 },
            { name: 'Admin', max: 100 },
            { name: 'Tech', max: 100 },
            { name: 'Support', max: 100 },
            { name: 'Marketing', max: 100 },
          ],
          series: [
            { name: 'Budget', values: [80, 90, 70, 60, 75] },
            { name: 'Actual', values: [60, 70, 85, 80, 65] },
          ],
        },
        option: buildRadarOption({
          indicators: [
            { name: 'Sales', max: 100 },
            { name: 'Admin', max: 100 },
            { name: 'Tech', max: 100 },
            { name: 'Support', max: 100 },
            { name: 'Marketing', max: 100 },
          ],
          series: [
            { name: 'Budget', values: [80, 90, 70, 60, 75] },
            { name: 'Actual', values: [60, 70, 85, 80, 65] },
          ],
        }),
      }

    case 'funnel':
      return {
        data: {
          items: [
            { name: 'Visits', value: 100 },
            { name: 'Leads', value: 80 },
            { name: 'Qualified', value: 60 },
            { name: 'Proposals', value: 40 },
            { name: 'Closed', value: 20 },
          ],
        },
        option: buildFunnelOption({
          items: [
            { name: 'Visits', value: 100 },
            { name: 'Leads', value: 80 },
            { name: 'Qualified', value: 60 },
            { name: 'Proposals', value: 40 },
            { name: 'Closed', value: 20 },
          ],
        }),
      }

    case 'waterfall':
      return {
        data: {
          categories: [
            'Total Revenue',
            'COGS',
            'Gross Profit',
            'OpEx',
            'Net Income',
          ],
          values: [1000, -400, 600, -350, 250],
        },
        option: buildWaterfallOption({
          categories: [
            'Total Revenue',
            'COGS',
            'Gross Profit',
            'OpEx',
            'Net Income',
          ],
          values: [1000, -400, 600, -350, 250],
        }),
      }

    case 'combo':
      return {
        data: {
          categories: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
          barSeries: [
            { name: 'Sales', values: [200, 300, 250, 400, 350, 500] },
          ],
          lineSeries: [{ name: 'Growth %', values: [10, 15, 12, 20, 18, 25] }],
        },
        option: buildComboOption({
          categories: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
          barSeries: [
            { name: 'Sales', values: [200, 300, 250, 400, 350, 500] },
          ],
          lineSeries: [{ name: 'Growth %', values: [10, 15, 12, 20, 18, 25] }],
        }),
      }

    case 'stackedBar':
      return {
        data: {
          categories: ['Q1', 'Q2', 'Q3', 'Q4'],
          series: [
            { name: 'Product', values: [120, 132, 101, 134] },
            { name: 'Service', values: [220, 182, 191, 234] },
            { name: 'Other', values: [60, 72, 80, 94] },
          ],
        },
        option: buildStackedBarOption({
          categories: ['Q1', 'Q2', 'Q3', 'Q4'],
          series: [
            { name: 'Product', values: [120, 132, 101, 134] },
            { name: 'Service', values: [220, 182, 191, 234] },
            { name: 'Other', values: [60, 72, 80, 94] },
          ],
        }),
      }

    case 'gauge':
      return {
        data: { value: 72, name: 'Completion' },
        option: buildGaugeOption({ value: 72, name: 'Completion' }),
      }

    default:
      return getChartPreset('bar')
  }
}

// === Option Builders ===

export function buildBarOption(data) {
  return {
    tooltip: { trigger: 'axis' },
    legend: { data: data.series.map((s) => s.name), top: 8 },
    grid: { left: 50, right: 20, bottom: 30, top: 40 },
    xAxis: { type: 'category', data: data.categories },
    yAxis: { type: 'value' },
    series: data.series.map((s, i) => ({
      name: s.name,
      type: 'bar',
      data: s.values,
      itemStyle: { color: CHART_COLORS[i % CHART_COLORS.length] },
    })),
  }
}

export function buildLineOption(data) {
  return {
    tooltip: { trigger: 'axis' },
    legend: { data: data.series.map((s) => s.name), top: 8 },
    grid: { left: 50, right: 20, bottom: 30, top: 40 },
    xAxis: { type: 'category', data: data.categories },
    yAxis: { type: 'value' },
    series: data.series.map((s, i) => ({
      name: s.name,
      type: 'line',
      data: s.values,
      smooth: true,
      itemStyle: { color: CHART_COLORS[i % CHART_COLORS.length] },
    })),
  }
}

export function buildPieOption(data, isDoughnut) {
  return {
    tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
    legend: { orient: 'vertical', right: 10, top: 'center' },
    series: [
      {
        type: 'pie',
        radius: isDoughnut ? ['40%', '70%'] : '65%',
        center: ['40%', '50%'],
        data: data.items.map((item, i) => ({
          ...item,
          itemStyle: { color: CHART_COLORS[i % CHART_COLORS.length] },
        })),
        label: { formatter: '{b}\n{d}%' },
        emphasis: {
          itemStyle: { shadowBlur: 10, shadowColor: 'rgba(0,0,0,0.3)' },
        },
      },
    ],
  }
}

export function buildAreaOption(data) {
  return {
    tooltip: { trigger: 'axis' },
    grid: { left: 50, right: 20, bottom: 30, top: 20 },
    xAxis: { type: 'category', data: data.categories, boundaryGap: false },
    yAxis: { type: 'value' },
    series: data.series.map((s, i) => ({
      name: s.name,
      type: 'line',
      data: s.values,
      smooth: true,
      areaStyle: { opacity: 0.3 },
      itemStyle: { color: CHART_COLORS[i % CHART_COLORS.length] },
    })),
  }
}

export function buildScatterOption(data) {
  return {
    tooltip: { trigger: 'item' },
    legend: { data: data.series.map((s) => s.name), top: 8 },
    grid: { left: 50, right: 20, bottom: 30, top: 40 },
    xAxis: { type: 'value', scale: true },
    yAxis: { type: 'value', scale: true },
    series: data.series.map((s, i) => ({
      name: s.name,
      type: 'scatter',
      data: s.values,
      symbolSize: 12,
      itemStyle: { color: CHART_COLORS[i % CHART_COLORS.length] },
    })),
  }
}

export function buildRadarOption(data) {
  return {
    tooltip: {},
    legend: { data: data.series.map((s) => s.name), top: 8 },
    radar: {
      indicator: data.indicators,
      center: ['50%', '55%'],
      radius: '60%',
    },
    series: [
      {
        type: 'radar',
        data: data.series.map((s, i) => ({
          name: s.name,
          value: s.values,
          lineStyle: { color: CHART_COLORS[i % CHART_COLORS.length] },
          itemStyle: { color: CHART_COLORS[i % CHART_COLORS.length] },
          areaStyle: {
            color: CHART_COLORS[i % CHART_COLORS.length],
            opacity: 0.15,
          },
        })),
      },
    ],
  }
}

export function buildFunnelOption(data) {
  return {
    tooltip: { trigger: 'item', formatter: '{b}: {c}%' },
    series: [
      {
        type: 'funnel',
        left: '10%',
        top: 20,
        bottom: 20,
        width: '80%',
        sort: 'descending',
        gap: 2,
        label: { show: true, position: 'inside', formatter: '{b}\n{c}%' },
        data: data.items.map((item, i) => ({
          ...item,
          itemStyle: { color: CHART_COLORS[i % CHART_COLORS.length] },
        })),
      },
    ],
  }
}

export function buildWaterfallOption(data) {
  // Calculate running total for waterfall
  const { categories, values } = data
  const positive = []
  const negative = []
  const transparent = []
  let running = 0

  values.forEach((v) => {
    if (v >= 0) {
      transparent.push(running)
      positive.push(v)
      negative.push(0)
    } else {
      transparent.push(running + v)
      positive.push(0)
      negative.push(Math.abs(v))
    }
    running += v
  })

  return {
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    grid: { left: 50, right: 20, bottom: 30, top: 20 },
    xAxis: { type: 'category', data: categories },
    yAxis: { type: 'value' },
    series: [
      {
        type: 'bar',
        stack: 'total',
        data: transparent,
        itemStyle: { color: 'transparent' },
        emphasis: { itemStyle: { color: 'transparent' } },
      },
      {
        name: 'Increase',
        type: 'bar',
        stack: 'total',
        data: positive,
        itemStyle: { color: '#91cc75' },
      },
      {
        name: 'Decrease',
        type: 'bar',
        stack: 'total',
        data: negative,
        itemStyle: { color: '#ee6666' },
      },
    ],
  }
}

export function buildComboOption(data) {
  return {
    tooltip: { trigger: 'axis' },
    legend: {
      data: [
        ...data.barSeries.map((s) => s.name),
        ...data.lineSeries.map((s) => s.name),
      ],
      top: 8,
    },
    grid: { left: 50, right: 60, bottom: 30, top: 40 },
    xAxis: { type: 'category', data: data.categories },
    yAxis: [
      { type: 'value', name: 'Amount' },
      { type: 'value', name: '%', axisLabel: { formatter: '{value}%' } },
    ],
    series: [
      ...data.barSeries.map((s, i) => ({
        name: s.name,
        type: 'bar',
        data: s.values,
        itemStyle: { color: CHART_COLORS[i % CHART_COLORS.length] },
      })),
      ...data.lineSeries.map((s, i) => ({
        name: s.name,
        type: 'line',
        yAxisIndex: 1,
        data: s.values,
        smooth: true,
        itemStyle: {
          color:
            CHART_COLORS[(data.barSeries.length + i) % CHART_COLORS.length],
        },
      })),
    ],
  }
}

export function buildStackedBarOption(data) {
  return {
    tooltip: { trigger: 'axis' },
    legend: { data: data.series.map((s) => s.name), top: 8 },
    grid: { left: 50, right: 20, bottom: 30, top: 40 },
    xAxis: { type: 'category', data: data.categories },
    yAxis: { type: 'value' },
    series: data.series.map((s, i) => ({
      name: s.name,
      type: 'bar',
      stack: 'total',
      data: s.values,
      itemStyle: { color: CHART_COLORS[i % CHART_COLORS.length] },
    })),
  }
}

export function buildGaugeOption(data) {
  return {
    series: [
      {
        type: 'gauge',
        progress: { show: true, width: 18 },
        axisLine: { lineStyle: { width: 18 } },
        axisTick: { show: false },
        splitLine: { length: 10, lineStyle: { width: 2, color: '#999' } },
        axisLabel: { distance: 20, fontSize: 12 },
        detail: { valueAnimation: true, formatter: '{value}%', fontSize: 24 },
        data: [{ value: data.value, name: data.name }],
      },
    ],
  }
}

/**
 * Rebuild ECharts option from stored chart data.
 */
export function rebuildChartOption(chartType, data) {
  switch (chartType) {
    case 'bar':
      return buildBarOption(data)
    case 'line':
      return buildLineOption(data)
    case 'pie':
      return buildPieOption(data, false)
    case 'doughnut':
      return buildPieOption(data, true)
    case 'area':
      return buildAreaOption(data)
    case 'scatter':
      return buildScatterOption(data)
    case 'radar':
      return buildRadarOption(data)
    case 'funnel':
      return buildFunnelOption(data)
    case 'waterfall':
      return buildWaterfallOption(data)
    case 'combo':
      return buildComboOption(data)
    case 'stackedBar':
      return buildStackedBarOption(data)
    case 'gauge':
      return buildGaugeOption(data)
    default:
      return buildBarOption(data)
  }
}
