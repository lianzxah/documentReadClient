import fs from 'node:fs/promises';
import path from 'node:path';
import { config } from '../config.js';
import { getBrowser } from './screenshot.js';

const PPTX_THUMBNAILS_DIR = path.join(config.DATA_DIR, 'pptx-thumbnails');

const SLIDE_WIDTH = 1000;
const SLIDE_HEIGHT = 562.5;
const THUMB_WIDTH = 384;
const THUMB_HEIGHT = 216;

interface SlideElement {
  id: string;
  type: 'text' | 'image' | 'shape' | 'table';
  left?: number;
  top?: number;
  width?: number;
  height?: number;
  rotate?: number;
  opacity?: number;
  // Text
  content?: string;
  color?: string;
  fontSize?: number;
  fontWeight?: string;
  align?: string;
  // Image
  src?: string;
  // Shape
  svgPath?: string;
  viewBox?: [number, number];
  fillColor?: string;
  outlined?: boolean;
  outlineColor?: string;
  outlineWidth?: number;
  shapeType?: string;
  // Table
  data?: Array<Array<{ text?: string }>>;
  theme?: { color?: string };
}

interface SlideData {
  id: string;
  elements: SlideElement[];
  background?: { type?: string; color?: string };
}

/**
 * Ensure the pptx thumbnails directory exists.
 */
async function ensureThumbnailDir(): Promise<string> {
  await fs.mkdir(PPTX_THUMBNAILS_DIR, { recursive: true });
  return PPTX_THUMBNAILS_DIR;
}

/**
 * Escape HTML special characters
 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Build HTML for a text element
 */
function renderTextElement(el: SlideElement): string {
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
  ">${escapeHtml(el.content || '')}</div>`;
}

/**
 * Build HTML for an image element
 */
function renderImageElement(el: SlideElement): string {
  return `<img src="${el.src || ''}" style="
    position: absolute;
    left: ${el.left || 0}px; top: ${el.top || 0}px;
    width: ${el.width || 100}px; height: ${el.height || 100}px;
    object-fit: contain;
    transform: rotate(${el.rotate || 0}deg);
    opacity: ${el.opacity !== undefined ? el.opacity : 1};
  " crossorigin="anonymous" />`;
}

/**
 * Build HTML for a shape element
 */
function renderShapeElement(el: SlideElement): string {
  if (el.svgPath && el.viewBox) {
    const fill = el.outlined ? 'none' : (el.fillColor || '#4b83f0');
    const stroke = el.outlineColor || 'none';
    const strokeWidth = el.outlineWidth || 0;
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
    </div>`;
  }
  return `<div style="
    position: absolute;
    left: ${el.left || 0}px; top: ${el.top || 0}px;
    width: ${el.width || 100}px; height: ${el.height || 100}px;
    background-color: ${el.fillColor || 'transparent'};
    border-radius: ${el.shapeType === 'circle' ? '50%' : '0'};
    transform: rotate(${el.rotate || 0}deg);
    opacity: ${el.opacity !== undefined ? el.opacity : 1};
  "></div>`;
}

/**
 * Build HTML for a table element
 */
function renderTableElement(el: SlideElement): string {
  const rows = el.data?.length || 2;
  const cols = el.data?.[0]?.length || 2;
  const themeColor = el.theme?.color || '#4b83f0';

  let cells = '';
  for (let i = 0; i < rows * cols; i++) {
    const isHeader = i < cols;
    cells += `<div style="
      border: 1px solid #e5e7eb;
      background-color: ${isHeader ? themeColor : '#ffffff'};
      display: flex; align-items: center; justify-content: center;
      font-size: 12px; padding: 2px;
    "></div>`;
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
  </div>`;
}

/**
 * Build the complete HTML page for a slide
 */
function buildSlideHTML(slide: SlideData): string {
  const bgColor = slide.background?.color || '#ffffff';
  const elements = (slide.elements || [])
    .map((el) => {
      switch (el.type) {
        case 'text': return renderTextElement(el);
        case 'image': return renderImageElement(el);
        case 'shape': return renderShapeElement(el);
        case 'table': return renderTableElement(el);
        default: return '';
      }
    })
    .join('');

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { width: ${SLIDE_WIDTH}px; height: ${SLIDE_HEIGHT}px; overflow: hidden; }
    #slide {
      position: relative;
      width: ${SLIDE_WIDTH}px;
      height: ${SLIDE_HEIGHT}px;
      background-color: ${bgColor};
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif;
    }
  </style>
</head>
<body>
  <div id="slide">${elements}</div>
</body>
</html>`;
}

/**
 * Render a slide to a PNG thumbnail buffer using Puppeteer.
 */
export async function renderSlideThumbnail(slide: SlideData): Promise<Buffer> {
  const html = buildSlideHTML(slide);
  const browser = await getBrowser();
  const page = await browser.newPage();

  try {
    await page.setViewport({
      width: SLIDE_WIDTH,
      height: Math.ceil(SLIDE_HEIGHT),
      deviceScaleFactor: THUMB_WIDTH / SLIDE_WIDTH,
    });

    await page.setContent(html, { waitUntil: 'load', timeout: 10000 });

    // Wait for images to load (string-based evaluate avoids TS DOM type issues)
    await page.evaluate(`
      (async () => {
        const images = document.querySelectorAll('img');
        await Promise.allSettled(
          Array.from(images).map(img =>
            new Promise(resolve => {
              if (img.complete) return resolve();
              img.onload = () => resolve();
              img.onerror = () => resolve();
              setTimeout(() => resolve(), 3000);
            })
          )
        );
      })()
    `);

    const slideEl = await page.$('#slide');
    if (!slideEl) throw new Error('Slide element not found');

    const screenshot = await slideEl.screenshot({
      type: 'png',
      omitBackground: false,
    });

    return Buffer.from(screenshot);
  } finally {
    await page.close();
  }
}

/**
 * Generate and cache a thumbnail for a slide.
 * Returns the file path of the cached PNG.
 */
export async function generateAndCacheThumbnail(
  slideId: string,
  slide: SlideData,
): Promise<string> {
  const dir = await ensureThumbnailDir();
  const filePath = path.join(dir, `${slideId}.png`);

  const buffer = await renderSlideThumbnail(slide);
  await fs.writeFile(filePath, buffer);

  return filePath;
}

/**
 * Get cached thumbnail path if it exists.
 */
export async function getCachedThumbnail(slideId: string): Promise<string | null> {
  const filePath = path.join(PPTX_THUMBNAILS_DIR, `${slideId}.png`);
  try {
    await fs.access(filePath);
    return filePath;
  } catch {
    return null;
  }
}
