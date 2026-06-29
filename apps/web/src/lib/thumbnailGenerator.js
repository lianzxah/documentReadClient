/**
 * Slide thumbnail generator using html-to-image.
 * Creates offscreen DOM containers, renders slide elements, captures as PNG data URL.
 */
import { toPng } from 'html-to-image'

const SLIDE_WIDTH = 1000
const SLIDE_HEIGHT = 562.5
const THUMB_WIDTH = 192
const THUMB_HEIGHT = 108

// Reusable offscreen container (persists in DOM, hidden)
let offscreenContainer = null

// Serialization queue to prevent race conditions with the shared container
let generationQueue = Promise.resolve()

function getOffscreenContainer() {
  if (offscreenContainer && document.body.contains(offscreenContainer)) {
    return offscreenContainer
  }
  offscreenContainer = document.createElement('div')
  offscreenContainer.id = '__slide-thumbnail-offscreen'
  Object.assign(offscreenContainer.style, {
    position: 'fixed',
    left: '-9999px',
    top: '-9999px',
    width: `${SLIDE_WIDTH}px`,
    height: `${SLIDE_HEIGHT}px`,
    overflow: 'hidden',
    zIndex: '-1',
    pointerEvents: 'none',
    opacity: '0',
  })
  document.body.appendChild(offscreenContainer)
  return offscreenContainer
}

/**
 * Render a text element to HTML string
 */
function renderTextElement(el) {
  return `<div style="
    position: absolute;
    left: ${el.left || 0}px; top: ${el.top || 0}px;
    width: ${el.width || 100}px; height: ${el.height || 100}px;
    color: ${el.color || '#000'};
    font-size: ${el.fontSize || 16}px;
    font-weight: ${el.fontWeight || 'normal'};
    text-align: ${el.align || 'left'};
    white-space: pre-wrap; word-break: break-word;
    transform: rotate(${el.rotate || 0}deg);
    opacity: ${el.opacity !== undefined ? el.opacity : 1};
    overflow: hidden;
  ">${escapeHtml(el.content || '')}</div>`
}

/**
 * Render an image element to HTML string
 */
function renderImageElement(el) {
  return `<img src="${el.src || ''}" style="
    position: absolute;
    left: ${el.left || 0}px; top: ${el.top || 0}px;
    width: ${el.width || 100}px; height: ${el.height || 100}px;
    object-fit: contain;
    transform: rotate(${el.rotate || 0}deg);
    opacity: ${el.opacity !== undefined ? el.opacity : 1};
  " crossorigin="anonymous" />`
}

/**
 * Render a shape element to HTML string
 */
function renderShapeElement(el) {
  if (el.svgPath && el.viewBox) {
    const fill = el.outlined ? 'none' : el.fillColor || '#4b83f0'
    const stroke = el.outlineColor || 'none'
    const strokeWidth = el.outlineWidth || 0
    return `<div style="
      position: absolute;
      left: ${el.left || 0}px; top: ${el.top || 0}px;
      width: ${el.width || 100}px; height: ${el.height || 100}px;
      opacity: ${el.opacity !== undefined ? el.opacity : 1};
    ">
      <svg viewBox="0 0 ${el.viewBox[0]} ${el.viewBox[1]}" 
           style="width:100%;height:100%" preserveAspectRatio="none">
        <path d="${el.svgPath}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" />
      </svg>
    </div>`
  }
  // Fallback CSS shape
  return `<div style="
    position: absolute;
    left: ${el.left || 0}px; top: ${el.top || 0}px;
    width: ${el.width || 100}px; height: ${el.height || 100}px;
    background-color: ${el.fillColor || 'transparent'};
    border-radius: ${el.shapeType === 'circle' ? '50%' : '0'};
    transform: rotate(${el.rotate || 0}deg);
    opacity: ${el.opacity !== undefined ? el.opacity : 1};
  "></div>`
}

/**
 * Render a table element to HTML string
 */
function renderTableElement(el) {
  const rows = el.data?.length || 2
  const cols = el.data?.[0]?.length || 2
  const themeColor = el.theme?.color || '#4b83f0'

  let cells = ''
  for (let i = 0; i < rows * cols; i++) {
    const isHeader = i < cols
    cells += `<div style="
      border: 1px solid #e5e7eb;
      background-color: ${isHeader ? themeColor : '#ffffff'};
    "></div>`
  }

  return `<div style="
    position: absolute;
    left: ${el.left || 0}px; top: ${el.top || 0}px;
    width: ${el.width || 200}px; height: ${el.height || 150}px;
    border: 1px solid #d1d5db;
    opacity: ${el.opacity !== undefined ? el.opacity : 1};
  ">
    <div style="
      width: 100%; height: 100%;
      display: grid;
      grid-template-rows: repeat(${rows}, 1fr);
      grid-template-columns: repeat(${cols}, 1fr);
    ">${cells}</div>
  </div>`
}

function escapeHtml(text) {
  const div = document.createElement('div')
  div.textContent = text
  return div.innerHTML
}

/**
 * Build the full slide HTML for offscreen rendering
 */
function buildSlideHTML(slide) {
  const bgColor = slide.background?.color || '#ffffff'
  const elements = (slide.elements || [])
    .map((el) => {
      switch (el.type) {
        case 'text':
          return renderTextElement(el)
        case 'image':
          return renderImageElement(el)
        case 'shape':
          return renderShapeElement(el)
        case 'table':
          return renderTableElement(el)
        default:
          return ''
      }
    })
    .join('')

  return `<div style="
    position: relative;
    width: ${SLIDE_WIDTH}px;
    height: ${SLIDE_HEIGHT}px;
    background-color: ${bgColor};
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  ">${elements}</div>`
}

/**
 * Internal: generate a thumbnail without queue protection.
 * Must only be called within the serialized queue.
 */
async function generateThumbnailInternal(slide) {
  const container = getOffscreenContainer()
  container.innerHTML = buildSlideHTML(slide)

  // Wait a tick for images to start loading
  await new Promise((r) => setTimeout(r, 50))

  // Wait for images within the container to load
  const images = container.querySelectorAll('img')
  if (images.length > 0) {
    await Promise.allSettled(
      Array.from(images).map(
        (img) =>
          new Promise((resolve) => {
            if (img.complete) return resolve()
            img.onload = resolve
            img.onerror = resolve
            // Timeout after 2s per image
            setTimeout(resolve, 2000)
          }),
      ),
    )
  }

  try {
    const dataUrl = await toPng(container.firstElementChild, {
      width: SLIDE_WIDTH,
      height: SLIDE_HEIGHT,
      pixelRatio: THUMB_WIDTH / SLIDE_WIDTH, // Downsample for thumbnail
      cacheBust: true,
      skipAutoScale: true,
    })
    return dataUrl
  } catch (err) {
    console.warn('[thumbnailGenerator] Failed to generate thumbnail:', err)
    return null
  } finally {
    container.innerHTML = ''
  }
}

/**
 * Generate a thumbnail data URL from slide data.
 * Uses a serialization queue to prevent race conditions when multiple
 * slides generate thumbnails concurrently with the shared offscreen container.
 * @param {Object} slide - Slide data with elements and background
 * @returns {Promise<string>} PNG data URL of the thumbnail
 */
export function generateThumbnail(slide) {
  const result = generationQueue.then(() => generateThumbnailInternal(slide))
  // Update the queue; swallow errors so subsequent tasks still run
  generationQueue = result.catch(() => {})
  return result
}

/**
 * Generate thumbnail via backend API (fallback).
 * @param {Object} slide - Slide data
 * @param {string} apiBase - API base URL
 * @returns {Promise<string|null>} Thumbnail URL or null
 */
export async function generateThumbnailFromBackend(slide, apiBase = '/api') {
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 5000)

    const res = await fetch(`${apiBase}/pptx/thumbnail`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slide }),
      signal: controller.signal,
    })
    clearTimeout(timeout)

    if (!res.ok) return null
    const blob = await res.blob()
    return URL.createObjectURL(blob)
  } catch {
    return null
  }
}

/**
 * Generate thumbnail with fallback strategy:
 * 1. Try frontend html-to-image
 * 2. If fails, try backend API
 */
export async function generateThumbnailWithFallback(slide, apiBase = '/api') {
  // Try frontend first
  const frontendResult = await generateThumbnail(slide)
  if (frontendResult) return frontendResult

  // Fallback to backend
  return generateThumbnailFromBackend(slide, apiBase)
}
