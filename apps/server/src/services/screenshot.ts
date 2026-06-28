import puppeteer, { type Browser } from 'puppeteer';
import fs from 'node:fs/promises';
import path from 'node:path';
import url from 'node:url';
import { config } from '../config.js';

let _browser: Browser | null = null;
let _renderDir: string | null = null;

export async function getBrowser(): Promise<Browser> {
  if (!_browser || !_browser.connected) {
    try {
      _browser = await puppeteer.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
          // Required so the file:// render scaffold can spawn the pdfjs worker
          // and fetch sibling assets without CORS errors.
          '--allow-file-access-from-files',
        ],
      });
    } catch (e: any) {
      const msg = e?.message ?? String(e);
      // Re-raise with an actionable hint when Chrome is missing. Puppeteer's
      // bundled Chrome must be downloaded once via `npx puppeteer browsers
      // install chrome` (or executed during a normal `pnpm install` with
      // network access) before screenshot capture can work.
      if (/Could not find Chrome/i.test(msg) || /Failed to launch the browser/i.test(msg)) {
        throw new Error(
          'Puppeteer cannot launch Chrome. Run `pnpm --filter @app/server exec ' +
            'puppeteer browsers install chrome` (or `npx puppeteer browsers install ' +
            'chrome` from apps/server) to download the bundled Chrome. Original error: ' +
            msg,
        );
      }
      throw e;
    }
  }
  return _browser;
}

/**
 * Locate the pdfjs-dist legacy build directory.
 * pdfjs-dist may be hoisted at the workspace root or installed inside any
 * package that depends on it (currently apps/web). We look in the most
 * likely places before falling back to a node resolution attempt.
 */
async function findPdfjsBuildDir(): Promise<string> {
  const cwd = process.cwd();
  const candidates = [
    path.join(cwd, 'node_modules/pdfjs-dist/legacy/build'),
    path.join(cwd, 'apps/server/node_modules/pdfjs-dist/legacy/build'),
    path.join(cwd, 'apps/web/node_modules/pdfjs-dist/legacy/build'),
    path.resolve(cwd, '..', 'node_modules/pdfjs-dist/legacy/build'),
    path.resolve(cwd, '..', '..', 'node_modules/pdfjs-dist/legacy/build'),
    path.resolve(cwd, '..', '..', 'apps/web/node_modules/pdfjs-dist/legacy/build'),
  ];

  for (const dir of candidates) {
    try {
      await fs.access(path.join(dir, 'pdf.min.js'));
      await fs.access(path.join(dir, 'pdf.worker.min.js'));
      return dir;
    } catch {
      // try next
    }
  }

  throw new Error(
    'pdfjs-dist build files not found. Install pdfjs-dist in the workspace ' +
      '(legacy/build/pdf.min.js + pdf.worker.min.js are required).',
  );
}

/**
 * Ensure the one-time render scaffold (HTML + pdfjs assets) is materialised
 * inside the data directory so Puppeteer can load it via a stable file:// URL.
 */
async function ensureRenderDir(): Promise<string> {
  if (_renderDir) return _renderDir;

  const dir = path.join(config.CACHE_DIR, 'pdf-render');
  await fs.mkdir(dir, { recursive: true });

  const buildDir = await findPdfjsBuildDir();
  await fs.copyFile(
    path.join(buildDir, 'pdf.min.js'),
    path.join(dir, 'pdf.min.js'),
  );
  await fs.copyFile(
    path.join(buildDir, 'pdf.worker.min.js'),
    path.join(dir, 'pdf.worker.min.js'),
  );

  // Static renderer page. pdfjs-dist is loaded as a regular script; the
  // worker is referenced via a sibling file:// path which Chromium will
  // accept thanks to the --allow-file-access-from-files launch flag.
  const html = `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>pdf-render</title>
<style>html,body{margin:0;padding:0;background:#fff}canvas{display:block}</style>
<script src="pdf.min.js"></script>
</head>
<body>
<canvas id="c"></canvas>
<script>
(function () {
  var lib = window['pdfjs-dist/build/pdf'] || window.pdfjsLib;
  if (!lib) {
    window.__pdfRenderError = 'pdfjs library failed to load';
    return;
  }
  lib.GlobalWorkerOptions.workerSrc = './pdf.worker.min.js';

  window.__renderPdfPage = async function (base64, pageNumber, scale) {
    var bin = atob(base64);
    var u8 = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);

    var doc = await lib.getDocument({ data: u8 }).promise;
    var page = await doc.getPage(pageNumber);
    var viewport = page.getViewport({ scale: scale });

    var canvas = document.getElementById('c');
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    var ctx = canvas.getContext('2d');

    await page.render({ canvasContext: ctx, viewport: viewport }).promise;
    await doc.destroy();
    return { width: canvas.width, height: canvas.height };
  };
})();
</script>
</body>
</html>
`;
  await fs.writeFile(path.join(dir, 'render.html'), html, 'utf8');

  _renderDir = dir;
  return dir;
}

async function ensureScreenshotDir(documentId: string): Promise<string> {
  const dir = path.join(config.SCREENSHOTS_DIR, documentId);
  await fs.mkdir(dir, { recursive: true });
  return dir;
}

/**
 * Capture a single PDF page as a PNG screenshot.
 *
 * Uses pdfjs-dist (loaded inside a headless Chromium page) to rasterise the
 * page onto a canvas, then takes a tight screenshot of that canvas. This
 * replaces the previous approach of navigating Chromium directly to the
 * `file://*.pdf#page=N` URL, which silently failed because headless
 * Chromium has no built-in PDF viewer.
 */
export async function capturePageScreenshot(
  documentId: string,
  pdfCachePath: string,
  pageNumber: number,
  options?: { scale?: number },
): Promise<string> {
  const dir = await ensureScreenshotDir(documentId);
  const filename = `page-${pageNumber}.png`;
  const outputPath = path.join(dir, filename);

  // Reuse already-rendered screenshots.
  try {
    await fs.access(outputPath);
    return outputPath;
  } catch {
    // need to render
  }

  const renderDir = await ensureRenderDir();
  const renderUrl = url.pathToFileURL(path.join(renderDir, 'render.html')).href;
  const scale = options?.scale ?? 1.5;

  const pdfBytes = await fs.readFile(pdfCachePath);
  const pdfBase64 = pdfBytes.toString('base64');

  const browser = await getBrowser();
  const page = await browser.newPage();

  try {
    await page.setViewport({ width: 1280, height: 960, deviceScaleFactor: 1 });
    await page.goto(renderUrl, { waitUntil: 'load', timeout: 30000 });

    await page.waitForFunction(
      "typeof window.__renderPdfPage === 'function'",
      { timeout: 10000 },
    );

    await page.evaluate(
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore - injected at scaffold load time
      async (b64: string, pn: number, sc: number) => window.__renderPdfPage(b64, pn, sc),
      pdfBase64,
      pageNumber,
      scale,
    );

    const canvas = await page.$('#c');
    if (!canvas) throw new Error('canvas element missing after pdfjs render');

    await canvas.screenshot({
      path: outputPath,
      type: 'png',
      omitBackground: false,
    });
  } finally {
    await page.close();
  }

  return outputPath;
}

/**
 * Capture screenshots for multiple key pages from the PDF.
 * Selects pages based on RAG-retrieved chunks (most relevant pages).
 *
 * Throws on the first capture error after the initial page so that callers
 * can surface a meaningful failure event. The first page is also attempted
 * inside the standard try/catch loop, but any failure there propagates as
 * well; this avoids the previous "every page silently fails" trap.
 */
export async function captureKeyPages(
  documentId: string,
  pdfCachePath: string,
  pages: number[],
  maxCaptures = 5,
): Promise<Array<{ page: number; filePath: string; filename: string }>> {
  const uniquePages = [...new Set(pages)].slice(0, maxCaptures);
  const results: Array<{ page: number; filePath: string; filename: string }> = [];
  const failures: Array<{ page: number; reason: string }> = [];

  for (const pageNum of uniquePages) {
    try {
      const filePath = await capturePageScreenshot(documentId, pdfCachePath, pageNum);
      const filename = `page-${pageNum}.png`;
      results.push({ page: pageNum, filePath, filename });
    } catch (e: any) {
      const reason = e?.message ?? String(e);
      failures.push({ page: pageNum, reason });
      console.warn(`Failed to capture page ${pageNum} for doc ${documentId}: ${reason}`);
    }
  }

  // If we asked for pages but produced nothing, the caller almost certainly
  // wants to know - bubble up a typed error rather than returning [].
  if (uniquePages.length > 0 && results.length === 0) {
    const detail = failures.map((f) => `p${f.page}: ${f.reason}`).join('; ');
    throw new ScreenshotCaptureError(
      `All ${uniquePages.length} page captures failed (${detail || 'no error detail'}).`,
      failures,
    );
  }

  return results;
}

export class ScreenshotCaptureError extends Error {
  failures: Array<{ page: number; reason: string }>;
  constructor(message: string, failures: Array<{ page: number; reason: string }>) {
    super(message);
    this.name = 'ScreenshotCaptureError';
    this.failures = failures;
  }
}

/**
 * Get the URL path for serving a screenshot image via the API.
 */
export function screenshotApiPath(documentId: string, filename: string): string {
  return `/slidev/${documentId}/assets/${filename}`;
}

/**
 * Cleanup browser on process exit.
 */
export async function closeBrowser() {
  if (_browser) {
    await _browser.close();
    _browser = null;
  }
}

process.on('exit', () => {
  _browser?.close().catch(() => {});
});
