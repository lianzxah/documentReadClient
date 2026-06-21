/**
 * SVG形状库 - 移植自 PPTist
 * 包含预设形状路径和可编辑路径公式
 */

// 路径公式键名常量
export const ShapePathFormulasKeys = {
  ROUND_RECT: 'roundRect',
  ROUND_RECT_DIAGONAL: 'roundRectDiagonal',
  ROUND_RECT_SINGLE: 'roundRectSingle',
  ROUND_RECT_SAMESIDE: 'roundRectSameSide',
  CUT_RECT_DIAGONAL: 'cutRectDiagonal',
  CUT_RECT_SINGLE: 'cutRectSingle',
  CUT_RECT_SAMESIDE: 'cutRectSameSide',
  CUT_ROUND_RECT: 'cutRoundRect',
  MESSAGE: 'message',
  ROUND_MESSAGE: 'roundMessage',
  L: 'L',
  RING_RECT: 'ringRect',
  PLUS: 'plus',
  TRIANGLE: 'triangle',
  PARALLELOGRAM_LEFT: 'parallelogramLeft',
  PARALLELOGRAM_RIGHT: 'parallelogramRight',
  TRAPEZOID: 'trapezoid',
  BULLET: 'bullet',
  INDICATOR: 'indicator',
  DONUT: 'donut',
  DIAGSTRIPE: 'diagStripe',
}

// 可编辑路径公式 - 支持参数化调整
export const SHAPE_PATH_FORMULAS = {
  [ShapePathFormulasKeys.ROUND_RECT]: {
    editable: true,
    defaultValue: [0.125],
    range: [[0, 0.5]],
    formula: (width, height, values) => {
      const radius = Math.min(width, height) * values[0]
      return `M ${radius} 0 L ${width - radius} 0 Q ${width} 0 ${width} ${radius} L ${width} ${height - radius} Q ${width} ${height} ${width - radius} ${height} L ${radius} ${height} Q 0 ${height} 0 ${height - radius} L 0 ${radius} Q 0 0 ${radius} 0 Z`
    },
  },
  [ShapePathFormulasKeys.CUT_RECT_DIAGONAL]: {
    editable: true,
    defaultValue: [0.2],
    range: [[0, 0.95]],
    formula: (width, height, values) => {
      const radius = Math.min(width, height) * values[0]
      return `M 0 ${height - radius} L 0 0 L ${width - radius} 0 L ${width} ${radius} L ${width} ${height} L ${radius} ${height} Z`
    },
  },
  [ShapePathFormulasKeys.CUT_RECT_SINGLE]: {
    editable: true,
    defaultValue: [0.2],
    range: [[0, 1]],
    formula: (width, height, values) => {
      const radius = Math.min(width, height) * values[0]
      return `M 0 ${height} L 0 0 L ${width - radius} 0 L ${width} ${radius} L ${width} ${height} Z`
    },
  },
  [ShapePathFormulasKeys.CUT_RECT_SAMESIDE]: {
    editable: true,
    defaultValue: [0.2],
    range: [[0, 0.5]],
    formula: (width, height, values) => {
      const radius = Math.min(width, height) * values[0]
      return `M 0 ${radius} L ${radius} 0 L ${width - radius} 0 L ${width} ${radius} L ${width} ${height} L 0 ${height} Z`
    },
  },
  [ShapePathFormulasKeys.ROUND_RECT_DIAGONAL]: {
    editable: true,
    defaultValue: [0.125],
    range: [[0, 1]],
    formula: (width, height, values) => {
      const radius = Math.min(width, height) * values[0]
      return `M ${radius} 0 L ${width} 0 L ${width} ${height - radius} Q ${width} ${height} ${width - radius} ${height} L 0 ${height} L 0 ${radius} Q 0 0 ${radius} 0 Z`
    },
  },
  [ShapePathFormulasKeys.ROUND_RECT_SINGLE]: {
    editable: true,
    defaultValue: [0.125],
    range: [[0, 1]],
    formula: (width, height, values) => {
      const radius = Math.min(width, height) * values[0]
      return `M 0 0 L ${width - radius} 0 Q ${width} 0 ${width} ${radius} L ${width} ${height} L 0 ${height} L 0 0 Z`
    },
  },
  [ShapePathFormulasKeys.ROUND_RECT_SAMESIDE]: {
    editable: true,
    defaultValue: [0.125],
    range: [[0, 0.5]],
    formula: (width, height, values) => {
      const radius = Math.min(width, height) * values[0]
      return `M 0 ${radius} Q 0 0 ${radius} 0 L ${width - radius} 0 Q ${width} 0 ${width} ${radius} L ${width} ${height} L 0 ${height} Z`
    },
  },
  [ShapePathFormulasKeys.CUT_ROUND_RECT]: {
    editable: true,
    defaultValue: [0.125],
    range: [[0, 0.5]],
    formula: (width, height, values) => {
      const radius = Math.min(width, height) * values[0]
      return `M ${radius} 0 L ${width - radius} 0 L ${width} ${radius} L ${width} ${height} L 0 ${height} L 0 ${radius} Q 0 0 ${radius} 0 Z`
    },
  },
  [ShapePathFormulasKeys.MESSAGE]: {
    editable: true,
    range: [
      [0, 0.8],
      [0.1, 0.3],
    ],
    defaultValue: [0.3, 0.2],
    formula: (width, height, values) => {
      const point = width * values[0]
      const arrowWidth = width * 0.2
      const arrowheight = height * values[1]
      return `M 0 0 L ${width} 0 L ${width} ${height - arrowheight} L ${point + arrowWidth} ${height - arrowheight} L ${point} ${height} L ${point} ${height - arrowheight} L 0 ${height - arrowheight} Z`
    },
  },
  [ShapePathFormulasKeys.ROUND_MESSAGE]: {
    formula: (width, height) => {
      const radius = Math.min(width, height) * 0.125
      const arrowWidth = Math.min(width, height) * 0.2
      const arrowheight = Math.min(width, height) * 0.2
      return `M 0 ${radius} Q 0 0 ${radius} 0 L ${width - radius} 0 Q ${width} 0 ${width} ${radius} L ${width} ${height - radius - arrowheight} Q ${width} ${height - arrowheight} ${width - radius} ${height - arrowheight} L ${width / 2} ${height - arrowheight} L ${width / 2 - arrowWidth} ${height} L ${width / 2 - arrowWidth} ${height - arrowheight} L ${radius} ${height - arrowheight} Q 0 ${height - arrowheight} 0 ${height - radius - arrowheight} L 0 ${radius} Z`
    },
  },
  [ShapePathFormulasKeys.L]: {
    editable: true,
    defaultValue: [0.25],
    range: [[0.05, 1]],
    formula: (width, height, values) => {
      const lineWidth = Math.min(width, height) * values[0]
      return `M 0 0 L 0 ${height} L ${width} ${height} L ${width} ${height - lineWidth} L ${lineWidth} ${height - lineWidth} L ${lineWidth} 0 Z`
    },
  },
  [ShapePathFormulasKeys.RING_RECT]: {
    editable: true,
    defaultValue: [0.25],
    range: [[0.05, 0.5]],
    formula: (width, height, values) => {
      const lineWidth = Math.min(width, height) * values[0]
      return `M 0 0 ${width} 0 ${width} ${height} L 0 ${height} L 0 0 Z M ${lineWidth} ${lineWidth} L ${lineWidth} ${height - lineWidth} L ${width - lineWidth} ${height - lineWidth} L ${width - lineWidth} ${lineWidth} Z`
    },
  },
  [ShapePathFormulasKeys.DONUT]: {
    editable: true,
    defaultValue: [0.25],
    range: [[0.05, 0.5]],
    formula: (width, height, values) => {
      const lineWidth = Math.min(width, height) * values[0]
      const cx = width / 2
      const cy = height / 2
      const rxOuter = width / 2
      const ryOuter = height / 2
      const rxInner = rxOuter - lineWidth
      const ryInner = ryOuter - lineWidth
      return `M ${cx - rxOuter} ${cy} A ${rxOuter} ${ryOuter} 0 1 1 ${cx - rxOuter} ${cy + 1} Z M ${cx + rxInner} ${cy} A ${rxInner} ${ryInner} 0 1 0 ${cx + rxInner} ${cy + 1} Z`
    },
  },
  [ShapePathFormulasKeys.DIAGSTRIPE]: {
    editable: true,
    defaultValue: [0.5],
    range: [[0, 0.95]],
    formula: (width, height, values) => {
      const point = Math.min(width, height) * values[0]
      if (width >= height) {
        const point2 = (width / height) * point
        return `M ${width} 0 L ${point2} 0 L 0 ${point} L 0 ${height} Z`
      }
      const point2 = (height / width) * point
      return `M ${width} 0 L ${point} 0 L 0 ${point2} L 0 ${height} Z`
    },
  },
  [ShapePathFormulasKeys.PLUS]: {
    editable: true,
    defaultValue: [0.6],
    range: [[0.05, 1]],
    formula: (width, height, values) => {
      const lineWidth = Math.min(width, height) * values[0]
      return `M ${width / 2 - lineWidth / 2} 0 L ${width / 2 - lineWidth / 2} ${height / 2 - lineWidth / 2} L 0 ${height / 2 - lineWidth / 2} L 0 ${height / 2 + lineWidth / 2} L ${width / 2 - lineWidth / 2} ${height / 2 + lineWidth / 2} L ${width / 2 - lineWidth / 2} ${height} L ${width / 2 + lineWidth / 2} ${height} L ${width / 2 + lineWidth / 2} ${height / 2 + lineWidth / 2} L ${width} ${height / 2 + lineWidth / 2} L ${width} ${height / 2 - lineWidth / 2} L ${width / 2 + lineWidth / 2} ${height / 2 - lineWidth / 2} L ${width / 2 + lineWidth / 2} 0 Z`
    },
  },
  [ShapePathFormulasKeys.TRIANGLE]: {
    editable: true,
    defaultValue: [0.5],
    range: [[0, 1]],
    formula: (width, height, values) => {
      const vertex = width * values[0]
      return `M ${vertex} 0 L 0 ${height} L ${width} ${height} Z`
    },
  },
  [ShapePathFormulasKeys.PARALLELOGRAM_LEFT]: {
    editable: true,
    defaultValue: [0.25],
    range: [[0, 0.95]],
    formula: (width, height, values) => {
      const point = width * values[0]
      return `M ${point} 0 L ${width} 0 L ${width - point} ${height} L 0 ${height} Z`
    },
  },
  [ShapePathFormulasKeys.PARALLELOGRAM_RIGHT]: {
    editable: true,
    defaultValue: [0.25],
    range: [[0, 0.95]],
    formula: (width, height, values) => {
      const point = width * values[0]
      return `M 0 0 L ${width - point} 0 L ${width} ${height} L ${point} ${height} Z`
    },
  },
  [ShapePathFormulasKeys.TRAPEZOID]: {
    editable: true,
    defaultValue: [0.25],
    range: [[0, 0.5]],
    formula: (width, height, values) => {
      const point = width * values[0]
      return `M ${point} 0 L ${width - point} 0 L ${width} ${height} L 0 ${height} Z`
    },
  },
  [ShapePathFormulasKeys.BULLET]: {
    editable: true,
    defaultValue: [0.2],
    range: [[0, 1]],
    formula: (width, height, values) => {
      const point = height * values[0]
      return `M ${width / 2} 0 L 0 ${point} L 0 ${height} L ${width} ${height} L ${width} ${point} Z`
    },
  },
  [ShapePathFormulasKeys.INDICATOR]: {
    editable: true,
    defaultValue: [0.2],
    range: [[0, 0.95]],
    formula: (width, height, values) => {
      const point = width * values[0]
      return `M ${width} ${height / 2} L ${width - point} 0 L 0 0 L ${point} ${height / 2} L 0 ${height} L ${width - point} ${height} Z`
    },
  },
}

// 预设形状列表 - 按类别组织
export const SHAPE_LIST = [
  {
    type: '矩形',
    children: [
      {
        viewBox: [200, 200],
        path: 'M 0 0 L 200 0 L 200 200 L 0 200 Z',
        pptxShapeType: 'rect',
      },
      {
        viewBox: [200, 200],
        path: 'M 50 0 L 150 0 Q 200 0 200 50 L 200 150 Q 200 200 150 200 L 50 200 Q 0 200 0 150 L 0 50 Q 0 0 50 0 Z',
        pathFormula: 'roundRect',
        pptxShapeType: 'roundRect',
      },
      {
        viewBox: [200, 200],
        path: 'M 0 200 L 0 0 L 150 0 L 200 50 L 200 200 Z',
        pathFormula: 'cutRectSingle',
        pptxShapeType: 'snip1Rect',
      },
      {
        viewBox: [200, 200],
        path: 'M 0 50 L 50 0 L 150 0 L 200 50 L 200 200 L 0 200 Z',
        pathFormula: 'cutRectSameSide',
        pptxShapeType: 'snip2SameRect',
      },
      {
        viewBox: [200, 200],
        path: 'M 0 150 L 0 0 L 150 0 L 200 50 L 200 200 L 50 200 Z',
        pathFormula: 'cutRectDiagonal',
        pptxShapeType: 'snip2DiagRect',
      },
      {
        viewBox: [200, 200],
        path: 'M 50 0 L 150 0 L 200 50 L 200 200 L 0 200 L 0 50 Q 0 0 50 0 Z',
        pathFormula: 'cutRoundRect',
        pptxShapeType: 'snipRoundRect',
      },
      {
        viewBox: [200, 200],
        path: 'M 0 0 L 150 0 Q 200 0 200 50 L 200 200 L 0 200 L 0 0 Z',
        pathFormula: 'roundRectSingle',
        pptxShapeType: 'round1Rect',
      },
      {
        viewBox: [200, 200],
        path: 'M 0 50 Q 0 0 50 0 L 150 0 Q 200 0 200 50 L 200 200 L 0 200 Z',
        pathFormula: 'roundRectSameSide',
        pptxShapeType: 'round2SameRect',
      },
      {
        viewBox: [200, 200],
        path: 'M 50 0 L 200 0 L 200 150 Q 200 200 150 200 L 0 200 L 0 50 Q 0 0 50 0 Z',
        pathFormula: 'roundRectDiagonal',
        pptxShapeType: 'round2DiagRect',
      },
    ],
  },
  {
    type: '常用形状',
    children: [
      {
        viewBox: [200, 200],
        path: 'M 100 0 A 50 50 0 1 1 100 200 A 50 50 0 1 1 100 0 Z',
        pptxShapeType: 'ellipse',
      },
      {
        viewBox: [200, 200],
        path: 'M 100 0 L 0 200 L 200 200 L 100 0 Z',
        pathFormula: 'triangle',
        pptxShapeType: 'triangle',
      },
      { viewBox: [200, 200], path: 'M 0 0 L 0 200 L 200 200 Z' },
      {
        viewBox: [200, 200],
        path: 'M 70 20 L 0 160 Q 0 200 40 200 L 160 200 Q 200 200 200 160 L 130 20 Q 100 -20 70 20 Z',
      },
      {
        viewBox: [200, 200],
        path: 'M 50 0 L 200 0 L 150 200 L 0 200 L 50 0 Z',
        pathFormula: 'parallelogramLeft',
      },
      {
        viewBox: [200, 200],
        path: 'M 0 0 L 150 0 L 200 200 L 50 200 L 0 0 Z',
        pathFormula: 'parallelogramRight',
      },
      {
        viewBox: [200, 200],
        path: 'M 50 0 L 150 0 L 200 200 L 0 200 L 50 0 Z',
        pathFormula: 'trapezoid',
        pptxShapeType: 'trapezoid',
      },
      {
        viewBox: [200, 200],
        path: 'M 100 0 L 0 100 L 100 200 L 200 100 L 100 0 Z',
      },
      {
        viewBox: [200, 200],
        path: 'M 100 0 L 0 50 L 0 200 L 200 200 L 200 50 L 100 0 Z',
        pathFormula: 'bullet',
      },
      {
        viewBox: [200, 200],
        path: 'M 200 100 L 150 0 L 0 0 L 50 100 L 0 200 L 150 200 L 200 100 Z',
        pathFormula: 'indicator',
      },
      {
        viewBox: [200, 200],
        path: 'M 0 0 C 80 20 120 20 200 0 C 180 80 180 120 200 200 C 80 180 120 180 0 200 C 20 120 20 80 0 0 Z',
      },
      {
        viewBox: [200, 200],
        path: 'M 10 10 C 60 0 140 0 190 10 C 200 60 200 140 190 190 C 140 200 60 200 10 190 C 0 140 0 60 10 10 Z',
      },
      { viewBox: [200, 200], path: 'M 0 200 A 50 100 0 1 1 200 200 L 0 200 Z' },
      {
        viewBox: [200, 200],
        path: 'M 40 20 A 100 100 0 1 0 200 100 L 100 100 L 40 20 Z',
      },
      {
        viewBox: [200, 200],
        path: 'M 100 0 A 100 100 102 1 0 200 100 L 100 100 L 100 0 Z',
      },
      {
        viewBox: [200, 200],
        path: 'M 160 20 A 100 100 0 1 0 200 100 L 100 100 L 160 20 Z',
      },
      { viewBox: [200, 200], path: 'M 0 0 L 200 0 Q 200 200 0 200 L 0 0 Z' },
      {
        viewBox: [200, 200],
        path: 'M100,0 L200,76.6 L161.8,200 L38.2,200 L0,76.6 Z',
      },
      {
        viewBox: [200, 200],
        path: 'M 40 0 L 160 0 L 200 100 L 160 200 L 40 200 L 0 100 Z',
      },
      {
        viewBox: [200, 200],
        path: 'M 100 0 L 0 60 L 0 140 L 100 200 L 200 140 L 200 60 L 100 0 Z',
      },
      {
        viewBox: [200, 200],
        path: 'M100,0 L170.71,29.29 L200,100 L170.71,170.71 L100,200 L29.29,170.71 L0,100 L29.29,29.29 Z',
      },
      {
        viewBox: [200, 200],
        path: 'M 60 0 L 140 0 L 200 60 L 200 140 L 140 200 L 60 200 L 0 140 L 0 60 L 60 0 Z',
      },
      {
        viewBox: [200, 200],
        path: 'M 150 0 A 50 100 0 1 1 150 200 L 0 200 L 0 0 L 150 0 Z',
      },
      {
        viewBox: [200, 200],
        path: 'M 50 0 A 25 50 0 1 0 50 200 L 150 200 A 25 50 0 1 0 150 0 L 50 0 Z',
      },
      {
        viewBox: [200, 200],
        path: 'M 150 0 A 50 100 0 1 1 150 200 L 0 200 A 50 100 0 0 0 0 0 L 150 0 Z',
      },
      {
        viewBox: [200, 200],
        path: 'M 200 0 L 200 200 L 0 200 L 0 100 L 200 0 Z',
      },
      {
        viewBox: [200, 200],
        path: 'M 0 0 L 200 100 L 200 200 L 0 200 L 0 0 Z',
      },
      {
        viewBox: [200, 200],
        path: 'M 0 0 L 200 0 L 200 150 C 110 140 110 240 0 180 Z',
      },
      {
        viewBox: [200, 200],
        path: 'M 200 0 L 100 0 L 0 100 L 0 200 L 200 0 Z',
        pathFormula: 'diagStripe',
        pptxShapeType: 'diagStripe',
      },
      {
        viewBox: [200, 200],
        path: 'M 50 0 L 150 0 L 150 50 L 200 50 L 200 150 L 150 150 L 150 200 L 50 200 L 50 150 L 0 150 L 0 50 L 50 50 L 50 0 Z',
        pathFormula: 'plus',
        pptxShapeType: 'plus',
      },
      {
        viewBox: [200, 200],
        path: 'M 0 0 L 0 200 L 200 200 L 200 140 L 60 140 L 60 0 L 0 0 Z',
        pathFormula: 'L',
        pptxShapeType: 'corner',
      },
      {
        viewBox: [200, 200],
        path: 'M0 0 L200 0 L200 200 L0 200 L0 0 Z M50 50 L50 150 L150 150 L150 50 Z',
        pathFormula: 'ringRect',
        pptxShapeType: 'frame',
      },
      {
        viewBox: [200, 200],
        path: 'M0 100 A100 100 0 1 1 0 101 Z M150 100 A50 50 0 1 0 150 101 Z',
        pathFormula: 'donut',
        pptxShapeType: 'donut',
      },
      {
        viewBox: [200, 200],
        path: 'M 70 0 L 70 70 L 0 70 L 0 130 L 70 130 L 70 200 L 130 200 L 130 130 L 200 130 L 200 70 L 130 70 L 130 0 L 70 0 Z',
        pptxShapeType: 'mathPlus',
      },
      {
        viewBox: [200, 200],
        path: 'M 0 70 L 200 70 L 200 130 L 0 130 Z',
        pptxShapeType: 'mathMinus',
      },
      {
        viewBox: [200, 200],
        path: 'M 40 0 L 0 40 L 60 100 L 0 160 L 40 200 L 100 140 L 160 200 L 200 160 L 140 100 L 200 40 L 160 0 L 100 60 L 40 0 Z',
        pptxShapeType: 'mathMultiply',
      },
      {
        viewBox: [200, 200],
        path: 'M 0 0 L 200 0 L 200 160 L 100 160 L 60 200 L 60 160 L 0 160 Z',
        pathFormula: 'message',
      },
      {
        viewBox: [200, 200],
        path: 'M 0 40 Q 0 0 40 0 L 160 0 Q 200 0 200 40 L 200 120 Q 200 160 160 160 L 100 160 L 60 200 L 60 160 L 40 160 Q 0 160 0 120 L 0 40 Z',
        pathFormula: 'roundMessage',
      },
      {
        viewBox: [200, 200],
        path: 'M 100 0 A 50 50 0 1 0 200 120 A 100 100 0 1 1 100 0 Z',
      },
      {
        viewBox: [200, 200],
        path: 'M 120 0 L 100 80 L 200 80 L 80 200 L 100 120 L 0 120 L 120 0 Z',
      },
      {
        viewBox: [200, 200],
        path: 'M 30 50 Q 40 -20 120 10 Q 180 -10 180 40 Q 210 70 190 100 C 210 140 180 170 160 170 Q 140 210 100 180 C 70 210 20 190 30 150 C -10 140 -10 80 30 50',
      },
      {
        viewBox: [200, 200],
        path: 'M 100 0 L 60 60 L 0 100 L 60 140 L 100 200 L 140 140 L 200 100 L 140 60 L 100 0 Z',
      },
      {
        viewBox: [200, 200],
        path: 'M 100 0 L 140 60 L 200 60 L 160 100 L 200 140 L 140 140 L 100 200 L 60 140 L 0 140 L 40 100 L 0 60 L 60 60 L 100 0 Z',
      },
      {
        viewBox: [1024, 1024],
        path: 'M1018.67652554 400.05983681l-382.95318779-5.89158658L512 34.78141155 388.27666225 394.16825023l-382.95318779 5.89158658L311.68602415 629.83174977l-117.83174978 365.27842665 312.25413766-223.88032637 312.25413904 223.88032637-117.83175116-365.27842665 318.14572563-229.77191296z',
      },
      {
        viewBox: [200, 200],
        path: 'M 0 100 A 50 50 0 1 1 200 100 L 100 200 L 0 100 Z',
      },
      {
        viewBox: [200, 200],
        path: 'M 100 0 L 120 80 L 200 100 L 120 120 L 100 200 L 80 120 L 0 100 L 80 80 L 100 0 Z',
      },
    ],
  },
  {
    type: '箭头',
    children: [
      {
        viewBox: [200, 200],
        path: 'M 100 0 L 0 100 L 50 100 L 50 200 L 150 200 L 150 100 L 200 100 L 100 0 Z',
      },
      {
        viewBox: [200, 200],
        path: 'M 100 200 L 200 100 L 150 100 L 150 0 L 50 0 L 50 100 L 0 100 L 100 200 Z',
      },
      {
        viewBox: [200, 200],
        path: 'M 0 100 L 100 0 L 100 50 L 200 50 L 200 150 L 100 150 L 100 200 L 0 100 Z',
      },
      {
        viewBox: [200, 200],
        path: 'M 200 100 L 100 0 L 100 50 L 0 50 L 0 150 L 100 150 L 100 200 L 200 100 Z',
      },
      {
        viewBox: [200, 200],
        path: 'M 100 0 L 0 60 L 60 60 L 60 140 L 0 140 L 100 200 L 200 140 L 140 140 L 140 60 L 200 60 L 100 0 Z',
      },
      {
        viewBox: [200, 200],
        path: 'M 0 100 L 60 0 L 60 60 L 140 60 L 140 0 L 200 100 L 140 200 L 140 140 L 60 140 L 60 200 L 0 100 Z',
      },
      {
        viewBox: [200, 200],
        path: 'M 100 0 L 60 40 L 80 40 L 80 80 L 40 80 L 40 60 L 0 100 L 40 140 L 40 120 L 80 120 L 80 160 L 60 160 L 100 200 L 140 160 L 120 160 L 120 120 L 160 120 L 160 140 L 200 100 L 160 60 L 160 80 L 120 80 L 120 40 L 140 40 L 100 0 Z',
      },
      {
        viewBox: [200, 200],
        path: 'M 0 100 L 100 0 L 100 50 L 200 50 L 150 100 L 200 150 L 100 150 L 100 200 L 0 100 Z',
      },
      {
        viewBox: [200, 200],
        path: 'M 200 100 L 100 0 L 100 50 L 0 50 L 50 100 L 0 150 L 100 150 L 100 200 L 200 100 Z',
      },
      {
        viewBox: [200, 200],
        path: 'M 0 0 L 120 0 L 200 100 L 120 200 L 0 200 L 80 100 L 0 0 Z',
      },
      {
        viewBox: [200, 200],
        path: 'M 80 0 L 200 0 L 120 100 L 200 200 L 80 200 L 0 100 L 80 0 Z',
      },
      {
        viewBox: [200, 200],
        path: 'M 0 0 L 140 0 L 200 100 L 140 200 L 0 200 L 0 100 L 0 0 Z',
      },
      {
        viewBox: [200, 200],
        path: 'M 60 0 L 200 0 L 200 100 L 200 200 L 60 200 L 0 100 L 60 0 Z',
      },
      { viewBox: [200, 200], path: 'M 0 0 L 200 100 L 0 200 L 60 100 L 0 0 Z' },
      {
        viewBox: [200, 200],
        path: 'M 200 0 L 0 100 L 200 200 L 140 100 L 200 0 Z',
      },
      {
        viewBox: [200, 200],
        path: 'M 0 0 L 80 0 L 200 100 L 80 200 L 0 200 L 120 100 L 0 0 Z',
      },
      {
        viewBox: [200, 200],
        path: 'M 200 0 L 120 0 L 0 100 L 120 200 L 200 200 L 80 100 L 200 0 Z',
      },
      {
        viewBox: [200, 200],
        path: 'M 0 200 L 180 200 L 180 40 L 200 40 L 160 0 L 120 40 L 140 40 L 140 160 L 0 160 L 0 200 Z',
      },
      {
        viewBox: [200, 200],
        path: 'M 0 200 L 0 20 L 160 20 L 160 0 L 200 40 L 160 80 L 160 60 L 40 60 L 40 200 L 0 200 Z',
      },
      {
        viewBox: [200, 200],
        path: 'M 40 180 L 180 180 L 180 40 L 200 40 L 160 0 L 120 40 L 140 40 L 140 140 L 40 140 L 40 120 L 0 160 L 40 200 L 40 180 Z',
      },
      {
        viewBox: [1024, 1024],
        path: 'M398.208 302.912V64L0 482.112l398.208 418.176V655.36c284.48 0 483.584 95.552 625.792 304.64-56.896-298.688-227.584-597.312-625.792-657.088z',
      },
      {
        viewBox: [1024, 1024],
        path: 'M625.792 302.912V64L1024 482.112l-398.208 418.176V655.36C341.312 655.36 142.208 750.912 0 960c56.896-298.688 227.584-597.312 625.792-657.088z',
      },
    ],
  },
  {
    type: '流程图',
    children: [
      {
        viewBox: [200, 200],
        path: 'M 100 0 L 0 100 L 100 200 L 200 100 L 100 0 Z',
      },
      {
        viewBox: [200, 200],
        path: 'M 50 0 L 200 0 L 150 200 L 0 200 L 50 0 Z',
        pathFormula: 'parallelogramLeft',
      },
      {
        viewBox: [200, 200],
        path: 'M 50 0 L 150 0 L 200 200 L 0 200 L 50 0 Z',
        pathFormula: 'trapezoid',
        pptxShapeType: 'trapezoid',
      },
      {
        viewBox: [200, 200],
        path: 'M 0 0 L 200 0 L 200 160 L 100 160 L 60 200 L 60 160 L 0 160 Z',
        pathFormula: 'message',
      },
      {
        viewBox: [200, 200],
        path: 'M 100 0 A 50 50 0 1 1 100 200 A 50 50 0 1 1 100 0 Z',
        pptxShapeType: 'ellipse',
      },
      {
        viewBox: [200, 200],
        path: 'M 0 0 L 200 0 L 200 200 L 0 200 Z',
        pptxShapeType: 'rect',
      },
      {
        viewBox: [200, 200],
        path: 'M 50 0 L 150 0 Q 200 0 200 50 L 200 150 Q 200 200 150 200 L 50 200 Q 0 200 0 150 L 0 50 Q 0 0 50 0 Z',
        pathFormula: 'roundRect',
        pptxShapeType: 'roundRect',
      },
      {
        viewBox: [200, 200],
        path: 'M 160 0 A 40 100 0 1 1 160 200 L 40 200 A 40 100 0 1 1 40 0 L 160 0 Z M 160 200 A 40 100 0 1 1 160 0',
        withborder: true,
        pptxShapeType: 'flowChartMagneticDrum',
      },
      {
        viewBox: [200, 200],
        path: 'M 0 40 A 50 20 0 1 1 200 40 L 200 160 A 50 20 0 1 1 0 160 L 0 40 Z M 200 40 A 50 20 0 1 1 0 40',
        withborder: true,
      },
      {
        viewBox: [200, 200],
        path: 'M 200 0 L 50 0 L 0 50 L 0 200 L 150 200 L 200 150 L 200 0 Z M 200 0 L 150 50 M 150 50 L 0 50 M 150 50 L 150 200',
        withborder: true,
      },
    ],
  },
  {
    type: '其他',
    children: [
      {
        viewBox: [1024, 1024],
        path: 'M995.336 243.4016c-15.7584-36.5736-38.3376-69.26639999-66.91440001-97.37280001-28.5768-27.98879999-61.73999999-49.8624-98.78399999-65.26799998-38.22-15.876-78.6744-23.8728-120.4224-23.87280001-57.97680001 0-114.5424 15.876-163.69919999 45.864-11.76 7.17360001-22.932 15.05279999-33.51600001 23.63760001-10.584-8.5848-21.75600001-16.46400001-33.51600001-23.63760001-49.1568-29.98799999-105.7224-45.86399999-163.69919999-45.864-41.74799999 0-82.2024 7.9968-120.4224 23.87280001-36.9264 15.28799999-70.2072 37.27919999-98.78399999 65.26799998-28.6944 28.10640001-51.156 60.79919999-66.91440001 97.37280001-16.34639999 37.9848-24.696 78.3216-24.696 119.83439999 0 39.1608 7.9968 79.96800001 23.8728 121.48080001 13.28880001 34.692 32.34000001 70.67760001 56.6832 107.016 38.57279999 57.5064 91.61040001 117.4824 157.4664 178.28160001 109.1328 100.78319999 217.2072 170.4024 221.79359999 173.22479998l27.87120001 17.8752c12.348 7.8792 28.224 7.8792 40.572 0l27.87119999-17.8752c4.58639999-2.94 112.54319999-72.44159999 221.79360001-173.22479998 65.85599999-60.79919999 118.89359999-120.7752 157.4664-178.28160001 24.3432-36.33839999 43.512-72.324 56.68319999-107.016 15.876-41.5128 23.8728-82.32 23.87280001-121.48080001 0.1176-41.5128-8.232-81.8496-24.5784-119.83439999z',
      },
      {
        viewBox: [1024, 1024],
        path: 'M985.20746667 343.50079998l-303.32586667-44.08319999L546.28693333 24.5248c-3.70346666-7.5264-9.79626667-13.6192-17.32266665-17.32266668-18.87573334-9.3184-41.81333333-1.55306667-51.25120001 17.32266668L342.1184 299.41759999l-303.32586667 44.08319999c-8.36266667 1.19466667-16.00853333 5.13706667-21.8624 11.11040001-14.69440001 15.17226667-14.45546667 39.30453334 0.71679999 54.1184l219.46026668 213.9648-51.84853333 302.1312c-1.43359999 8.24320001-0.11946667 16.8448 3.82293333 24.25173333 9.79626667 18.6368 32.9728 25.92426667 51.6096 16.00853334L512 822.44266665l271.3088 142.64320001c7.40693333 3.9424 16.00853333 5.25653333 24.25173333 3.82293333 20.78719999-3.584 34.7648-23.296 31.1808-44.0832l-51.84853333-302.1312 219.46026668-213.9648c5.97333334-5.85386666 9.91573333-13.49973334 11.11039999-21.8624 3.2256-20.90666667-11.34933333-40.26026667-32.256-43.36640001z',
      },
      {
        viewBox: [1024, 1024],
        path: 'M852.65066667 405.84533333C800.54044445 268.40177778 667.76177778 170.66666667 512.22755555 170.66666667S223.91466667 268.288 171.80444445 405.73155555C74.29688889 431.33155555 2.27555555 520.07822222 2.27555555 625.77777778c0 125.72444445 101.83111111 227.55555555 227.44177778 227.55555555h564.56533334C919.89333333 853.33333333 1021.72444445 751.50222222 1021.72444445 625.77777778c0-105.472-71.79377778-194.21866667-169.07377778-219.93244445z',
      },
      {
        viewBox: [200, 200],
        path: 'M 100 0 L 130 30 L 170 30 L 170 70 L 200 100 L 170 130 L 170 170 L 130 170 L 100 200 L 70 170 L 30 170 L 30 130 L 0 100 L 30 70 L 30 30 L 70 30 L 100 0',
      },
      {
        viewBox: [200, 200],
        path: 'M 200 0 L 200 200 L 0 200 L 0 100 L 200 0 Z',
      },
      {
        viewBox: [200, 200],
        path: 'M 0 0 L 200 100 L 200 200 L 0 200 L 0 0 Z',
      },
    ],
  },
]
