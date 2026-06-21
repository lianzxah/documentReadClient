import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Editor } from '@bytemd/react';
import gfm from '@bytemd/plugin-gfm';
import mermaid from '@bytemd/plugin-mermaid';
import highlight from '@bytemd/plugin-highlight';
import frontmatter from '@bytemd/plugin-frontmatter';
import math from '@bytemd/plugin-math';
import breaks from '@bytemd/plugin-breaks';
import gemoji from '@bytemd/plugin-gemoji';
import mediumZoom from '@bytemd/plugin-medium-zoom';
import { useTranslation } from 'react-i18next';
import i18n from '../../i18n/index.js';
import 'bytemd/dist/index.css';
import 'katex/dist/katex.css';

// ---------------------------------------------------------------------------
// Screenshot plugin
// ---------------------------------------------------------------------------
// Adds a "camera" button to ByteMD's toolbar that captures the screen via the
// browser's native `getDisplayMedia` API, lets the user crop the result, and
// inserts the cropped image into the markdown source as a data-URL image. We
// use `getDisplayMedia` to avoid dragging in another DOM-to-canvas dependency,
// and inline data URLs so the captured note is self-contained.
//
// We encode as JPEG (quality 0.9) instead of PNG for two reasons:
//   1. PNG screenshots of full PDF pages routinely run 1–4 MB; once base64-
//      encoded that easily blew past the 2 MB body limit on
//      `PUT /api/slidev/:id`, so the auto-save silently dropped the image
//      and it disappeared on reload.
//   2. JPEG at 0.9 visually matches PNG for photographic / rendered-text PDF
//      content while shrinking the payload ~5-10x.
// See `analysis/slidev-base64-screenshot-invisible.md` for the full analysis.
const SCREENSHOT_MIME = 'image/jpeg';
const SCREENSHOT_QUALITY = 0.9;

// Inline SVG for ByteMD's toolbar (matches the icon style used by built-in
// actions, which expect a raw SVG string rather than a React node).
const CAMERA_ICON = `
<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"
  fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"
  stroke-linejoin="round">
  <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/>
  <circle cx="12" cy="13" r="4"/>
</svg>`.trim();

function makeScreenshotPlugin(onTrigger) {
  return {
    actions: [
      {
        title: i18n.t('slidev.bytemd.captureToolbar'),
        icon: CAMERA_ICON,
        handler: {
          type: 'action',
          click: (ctx) => {
            // Defer to React-managed UI: we hand the CodeMirror context back to
            // the parent so it can insert the resulting markdown after cropping.
            onTrigger(ctx);
          },
        },
      },
    ],
  };
}

/**
 * Feature-detect the screen-capture API. `navigator.mediaDevices` is gated
 * to secure contexts (HTTPS / localhost), so this returns false on plain HTTP
 * pages even in modern browsers. We use it to decide whether to take the
 * native screen-picker path or the DOM-region fallback below.
 */
function isDisplayMediaAvailable() {
  return !!(
    typeof navigator !== 'undefined' &&
    navigator.mediaDevices &&
    typeof navigator.mediaDevices.getDisplayMedia === 'function'
  );
}

/**
 * HTTP-safe fallback. When `getDisplayMedia` is unavailable, the user drags a
 * selection rectangle directly on the live PDF pane (see DirectRegionSelector
 * below) and we composite only the portion of each `<canvas>` / `<img>`
 * descendant that falls inside that rectangle. No intermediate "full pane
 * snapshot then crop in a modal" step — the user crops on the live document.
 *
 * `selVp` is the selection rect in **viewport** coordinates (matches what
 * `getBoundingClientRect()` returns), so we can use simple rect intersection
 * math against each child element's bounding rect.
 *
 * Limitations: arbitrary DOM (text nodes, CSS-painted backgrounds, SVGs,
 * iframes) is NOT rendered — we only draw `<canvas>` and `<img>` children.
 * For the PDF pane that's exactly what we want, since each page is a canvas.
 */
function captureSelectionFromTarget(targetEl, selVp) {
  if (!targetEl) {
    throw new Error(i18n.t('slidev.bytemd.fallbackTargetMissing'));
  }
  if (!selVp || selVp.w < 2 || selVp.h < 2) {
    throw new Error(i18n.t('slidev.bytemd.selectionTooSmall'));
  }
  const dpr = window.devicePixelRatio || 1;
  const out = document.createElement('canvas');
  out.width = Math.max(1, Math.round(selVp.w * dpr));
  out.height = Math.max(1, Math.round(selVp.h * dpr));
  const ctx = out.getContext('2d');
  ctx.scale(dpr, dpr);

  // Paint the target's background so transparent pixels don't end up black.
  let bg = '';
  try {
    bg = getComputedStyle(targetEl).backgroundColor || '';
  } catch {
    /* empty */
  }
  ctx.fillStyle = bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent'
    ? bg
    : '#1e1e1e';
  ctx.fillRect(0, 0, selVp.w, selVp.h);

  // For each drawable, compute the rectangular intersection with the
  // selection (all in viewport space), then translate that into the source
  // element's intrinsic pixel space for `drawImage`'s 9-arg form.
  const drawables = targetEl.querySelectorAll('canvas, img');
  drawables.forEach((el) => {
    const r = el.getBoundingClientRect();
    if (r.width <= 0 || r.height <= 0) return;
    const ix = Math.max(r.left, selVp.x);
    const iy = Math.max(r.top, selVp.y);
    const ix2 = Math.min(r.right, selVp.x + selVp.w);
    const iy2 = Math.min(r.bottom, selVp.y + selVp.h);
    const iw = ix2 - ix;
    const ih = iy2 - iy;
    if (iw <= 0 || ih <= 0) return;

    // Map displayed pixels back to the element's intrinsic resolution so the
    // crop stays sharp even if the PDF page is being shown at a CSS-scaled
    // size (e.g. fit-to-width).
    const naturalW = el.naturalWidth || el.width || r.width;
    const naturalH = el.naturalHeight || el.height || r.height;
    const scaleX = naturalW / r.width;
    const scaleY = naturalH / r.height;
    const sx = (ix - r.left) * scaleX;
    const sy = (iy - r.top) * scaleY;
    const sw = iw * scaleX;
    const sh = ih * scaleY;

    const dx = ix - selVp.x;
    const dy = iy - selVp.y;
    try {
      ctx.drawImage(el, sx, sy, sw, sh, dx, dy, iw, ih);
    } catch {
      // Cross-origin / not-yet-loaded images taint the canvas — skip them.
    }
  });

  return out.toDataURL(SCREENSHOT_MIME, SCREENSHOT_QUALITY);
}

/**
 * Live-region selector overlay. Sits over the supplied target element and
 * lets the user drag a rectangle directly on the PDF pane. On mouseup with a
 * non-trivial rectangle it calls `onConfirm(viewportRect)`; Esc cancels.
 *
 * The overlay tracks the target's bounding rect so it stays aligned during
 * scrolls and resizes (the user might still scroll the document via
 * mousewheel before pressing the button, and panel resizes are supported by
 * the surrounding layout).
 */
function DirectRegionSelector({ targetEl, onConfirm, onCancel }) {
  const { t } = useTranslation();
  const [pos, setPos] = useState(() => {
    const r = targetEl.getBoundingClientRect();
    return { left: r.left, top: r.top, width: r.width, height: r.height };
  });
  const [drag, setDrag] = useState(null); // viewport coords of mousedown
  const [rect, setRect] = useState(null); // viewport-coord selection rect

  // Track the target's position so the overlay stays glued to it.
  useEffect(() => {
    const update = () => {
      const r = targetEl.getBoundingClientRect();
      setPos({ left: r.left, top: r.top, width: r.width, height: r.height });
    };
    update();
    window.addEventListener('scroll', update, true);
    window.addEventListener('resize', update);
    let ro;
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(update);
      ro.observe(targetEl);
    }
    return () => {
      window.removeEventListener('scroll', update, true);
      window.removeEventListener('resize', update);
      if (ro) ro.disconnect();
    };
  }, [targetEl]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel]);

  const handleMouseDown = (e) => {
    e.preventDefault();
    setDrag({ x: e.clientX, y: e.clientY });
    setRect({ x: e.clientX, y: e.clientY, w: 0, h: 0 });
  };

  const handleMouseMove = (e) => {
    if (!drag) return;
    // Clamp the moving corner inside the target so the selection can't leak
    // past the PDF pane (which would just produce blank pixels anyway).
    const cx = Math.max(pos.left, Math.min(pos.left + pos.width, e.clientX));
    const cy = Math.max(pos.top, Math.min(pos.top + pos.height, e.clientY));
    setRect({
      x: Math.min(drag.x, cx),
      y: Math.min(drag.y, cy),
      w: Math.abs(cx - drag.x),
      h: Math.abs(cy - drag.y),
    });
  };

  const handleMouseUp = () => {
    if (!drag) return;
    setDrag(null);
    if (rect && rect.w > 4 && rect.h > 4) {
      onConfirm(rect);
    }
    // Tiny / accidental drags are ignored; the overlay stays open so the user
    // can try again. They can press Esc or click the Cancel pill to dismiss.
  };

  return (
    <div
      className="fixed z-[1000] cursor-crosshair select-none"
      style={{ left: pos.left, top: pos.top, width: pos.width, height: pos.height }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      role="dialog"
      aria-modal="true"
    >
      {/* Subtle dim layer so the user knows the pane is in capture mode. */}
      <div className="absolute inset-0 bg-black/20 ring-2 ring-blue-400/70 pointer-events-none" />
      {rect && (
        <div
          className="absolute border-2 border-blue-400 bg-blue-400/10 pointer-events-none"
          style={{
            left: rect.x - pos.left,
            top: rect.y - pos.top,
            width: rect.w,
            height: rect.h,
          }}
        />
      )}
      <div className="absolute top-2 left-2 right-2 flex items-center justify-between gap-2 pointer-events-none">
        <span className="text-xs text-white bg-black/70 px-2 py-1 rounded">
          {t('slidev.bytemd.selectInPdf')}
        </span>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onCancel();
          }}
          className="pointer-events-auto text-xs text-white bg-black/70 hover:bg-black/90 px-2 py-1 rounded"
        >
          {t('common.cancel')}
        </button>
      </div>
    </div>
  );
}

/**
 * Capture a single frame from a user-selected screen/window/tab.
 * Returns a PNG data URL. Throws if the browser denies the permission or the
 * API isn't available (older browsers, insecure context, etc.).
 *
 * Note: `navigator.mediaDevices` is `undefined` in insecure contexts (HTTP),
 * so callers should detect that ahead of time via `isDisplayMediaAvailable()`
 * and route to the DOM-region fallback rather than calling this function.
 */
async function captureScreenFrame() {
  if (!isDisplayMediaAvailable()) {
    // The caller is expected to skip this path when the API is missing, but
    // we throw a tagged error so anyone who calls us directly can still react.
    const err = new Error('getDisplayMedia is not available in this context.');
    err.name = 'NotSupportedError';
    throw err;
  }
  const stream = await navigator.mediaDevices.getDisplayMedia({
    video: { cursor: 'never' },
    audio: false,
  });
  try {
    const video = document.createElement('video');
    video.srcObject = stream;
    video.muted = true;
    await video.play();
    // `play()` resolves once the first frame is decoded, but on some browsers
    // dimensions are still 0 for a tick. Wait for `loadedmetadata` to be safe.
    if (!video.videoWidth || !video.videoHeight) {
      await new Promise((resolve) => {
        const done = () => resolve();
        video.addEventListener('loadedmetadata', done, { once: true });
        // Safety timeout so we never hang forever.
        setTimeout(done, 500);
      });
    }
    const w = video.videoWidth || 1280;
    const h = video.videoHeight || 720;
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, w, h);
    return canvas.toDataURL(SCREENSHOT_MIME, SCREENSHOT_QUALITY);
  } finally {
    // Always release tracks so the browser stops the "sharing" indicator.
    stream.getTracks().forEach((t) => t.stop());
  }
}

/**
 * Modal that shows the captured frame and lets the user drag a crop rectangle.
 * On confirm it returns a PNG data URL of the cropped region; on cancel/close
 * it returns null. The selection rectangle is rendered as a regular DOM
 * overlay so we don't need to repaint a canvas during the drag.
 */
function ScreenshotCropper({ src, error, onCancel, onConfirm }) {
  const { t } = useTranslation();
  const imgRef = useRef(null);
  const containerRef = useRef(null);
  const [rect, setRect] = useState(null); // { x, y, w, h } in CSS px, relative to the image
  const [drag, setDrag] = useState(null); // { startX, startY }
  const [imgSize, setImgSize] = useState({ natW: 0, natH: 0 });

  const handleMouseDown = (e) => {
    if (!imgRef.current) return;
    const bounds = imgRef.current.getBoundingClientRect();
    const x = e.clientX - bounds.left;
    const y = e.clientY - bounds.top;
    setDrag({ startX: x, startY: y });
    setRect({ x, y, w: 0, h: 0 });
  };

  const handleMouseMove = (e) => {
    if (!drag || !imgRef.current) return;
    const bounds = imgRef.current.getBoundingClientRect();
    const cx = Math.max(0, Math.min(bounds.width, e.clientX - bounds.left));
    const cy = Math.max(0, Math.min(bounds.height, e.clientY - bounds.top));
    setRect({
      x: Math.min(drag.startX, cx),
      y: Math.min(drag.startY, cy),
      w: Math.abs(cx - drag.startX),
      h: Math.abs(cy - drag.startY),
    });
  };

  const handleMouseUp = () => setDrag(null);

  // Esc cancels, Enter confirms (when a usable rect exists).
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onCancel();
      if (e.key === 'Enter' && rect && rect.w > 4 && rect.h > 4) confirmCrop();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // confirmCrop closes over rect/imgSize/src; re-bind whenever those change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rect, imgSize, src]);

  const confirmCrop = () => {
    if (!imgRef.current) return;
    const displayed = imgRef.current.getBoundingClientRect();
    const { natW, natH } = imgSize;
    if (!natW || !natH) {
      // Couldn't determine natural size; insert the full screenshot as fallback.
      onConfirm(src);
      return;
    }
    // Map the displayed-pixel selection back to natural pixels for max quality.
    const ratioX = natW / displayed.width;
    const ratioY = natH / displayed.height;
    let sx, sy, sw, sh;
    if (rect && rect.w > 2 && rect.h > 2) {
      sx = Math.round(rect.x * ratioX);
      sy = Math.round(rect.y * ratioY);
      sw = Math.round(rect.w * ratioX);
      sh = Math.round(rect.h * ratioY);
    } else {
      // No selection drawn: use the entire frame.
      sx = 0;
      sy = 0;
      sw = natW;
      sh = natH;
    }
    const out = document.createElement('canvas');
    out.width = sw;
    out.height = sh;
    out.getContext('2d').drawImage(imgRef.current, sx, sy, sw, sh, 0, 0, sw, sh);
    onConfirm(out.toDataURL(SCREENSHOT_MIME, SCREENSHOT_QUALITY));
  };

  return (
    <div
      className="fixed inset-0 z-[1000] flex flex-col bg-black/80 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      <div className="flex items-center justify-between px-4 py-2 bg-vs-sidebar border-b border-vs-border text-sm text-vs-foreground">
        <div className="flex flex-col gap-0.5">
          <span className="font-medium">{t('slidev.bytemd.cropTitle')}</span>
          <span className="text-xs text-vs-muted">
            {t('slidev.bytemd.cropHint')}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onCancel}
            className="px-3 py-1 rounded bg-vs-hover hover:bg-vs-border text-vs-foreground text-xs"
          >
            {t('common.cancel')}
          </button>
          <button
            onClick={confirmCrop}
            disabled={!src}
            className="px-3 py-1 rounded bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-xs"
          >
            {t('slidev.bytemd.insert')}
          </button>
        </div>
      </div>

      <div
        ref={containerRef}
        className="flex-1 min-h-0 overflow-auto flex items-start justify-center p-4 select-none"
      >
        {error && (
          <div className="m-auto max-w-md rounded border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-300">
            <div className="font-medium mb-1">{t('slidev.bytemd.captureFailed')}</div>
            <div className="text-red-200/80 text-xs whitespace-pre-wrap">
              {error}
            </div>
          </div>
        )}
        {!error && src && (
          <div
            className="relative inline-block"
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
          >
            <img
              ref={imgRef}
              src={src}
              alt="screenshot preview"
              draggable={false}
              onLoad={(e) =>
                setImgSize({
                  natW: e.currentTarget.naturalWidth,
                  natH: e.currentTarget.naturalHeight,
                })
              }
              className="max-w-full max-h-[80vh] block cursor-crosshair shadow-lg"
            />
            {rect && (
              <div
                className="absolute border-2 border-blue-400 bg-blue-400/10 pointer-events-none"
                style={{
                  left: rect.x,
                  top: rect.y,
                  width: rect.w,
                  height: rect.h,
                }}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Editor component
// ---------------------------------------------------------------------------
//
// We render a richer Slidev-aware preview ourselves on the left pane, so we
// configure ByteMD as editor-only and rely on its CodeMirror toolbar for the
// authoring experience. The plugins below mirror ByteMD's "common feature"
// set so the toolbar exposes math, emoji, line-breaks, image-zoom, frontmatter,
// GFM tables/task-lists, syntax highlighting and inline mermaid diagrams. The
// custom screenshot plugin appends a camera button at the end of that list.

/**
 * Thin wrapper around `@bytemd/react`'s `Editor` that:
 * - hides ByteMD's built-in preview pane (handled in CSS, see styles/index.css)
 * - calls `onChange(value)` on every keystroke so the parent can debounce + persist
 * - refreshes CodeMirror when the parent resizes, otherwise the inner
 *   `.CodeMirror-scroll` keeps the stale dimensions captured at mount and
 *   the scrollbar stops responding once content exceeds that snapshot.
 * - exposes a screenshot-and-insert toolbar action backed by `getDisplayMedia`.
 */
export function ByteMDEditor({
  value,
  onChange,
  placeholder,
  // CSS selector resolved against `document` whenever the screen-capture API
  // is unavailable (e.g. HTTP). Defaults to the contract used by SlidevEditor:
  // a wrapper around the PDF pane carrying `data-bytemd-screenshot-target`.
  fallbackTargetSelector = '[data-bytemd-screenshot-target]',
}) {
  const { t } = useTranslation();
  const wrapperRef = useRef(null);

  // Holds the CodeMirror context handed to us by ByteMD when the toolbar
  // button is clicked, so the cropper modal can insert the resulting markdown
  // at the original cursor position once cropping completes.
  const editorCtxRef = useRef(null);
  const [shotState, setShotState] = useState({
    open: false,
    src: null,
    error: null,
    loading: false,
  });
  // HTTP / insecure-context fallback uses a live region selector layered
  // directly on the PDF pane instead of the snapshot+crop modal. We keep its
  // state separate because it doesn't go through the cropper UI at all.
  const [liveSelector, setLiveSelector] = useState({
    active: false,
    target: null,
    error: null,
  });

  const handleScreenshotClick = useCallback(async (ctx) => {
    editorCtxRef.current = ctx;

    // HTTP / insecure-context fallback: `navigator.mediaDevices` is
    // `undefined` outside secure contexts, so getDisplayMedia is unreachable.
    // Switch to the live, in-place region selector on the PDF pane — no
    // intermediate snapshot, the user crops directly on the live document.
    if (!isDisplayMediaAvailable()) {
      const target = document.querySelector(fallbackTargetSelector);
      if (!target) {
        setShotState({
          open: true,
          src: null,
          error: t('slidev.bytemd.pdfPaneNotVisible'),
          loading: false,
        });
        return;
      }
      setLiveSelector({ active: true, target, error: null });
      return;
    }

    setShotState({ open: true, src: null, error: null, loading: true });
    try {
      const dataUrl = await captureScreenFrame();
      setShotState({ open: true, src: dataUrl, error: null, loading: false });
    } catch (err) {
      // User cancellation (NotAllowedError / AbortError) just dismisses the
      // modal; everything else surfaces an error so the user knows why.
      const aborted =
        err && (err.name === 'NotAllowedError' || err.name === 'AbortError');
      if (aborted) {
        setShotState({ open: false, src: null, error: null, loading: false });
      } else {
        setShotState({
          open: true,
          src: null,
          error: err?.message || String(err),
          loading: false,
        });
      }
    }
  }, [fallbackTargetSelector, t]);

  const insertImageMarkdown = useCallback((dataUrl) => {
    const ctx = editorCtxRef.current;
    const md = `\n![screenshot](${dataUrl})\n`;
    if (ctx?.editor?.replaceSelection) {
      ctx.editor.replaceSelection(md);
      ctx.editor.focus();
    } else if (ctx?.appendBlock) {
      ctx.appendBlock(md);
    } else {
      // Fallback: append to the end of the source via onChange.
      onChange?.((value || '') + md);
    }
  }, [onChange, value]);

  const closeCropper = useCallback(() => {
    setShotState({ open: false, src: null, error: null, loading: false });
    editorCtxRef.current = null;
  }, []);

  const handleConfirmCrop = useCallback((dataUrl) => {
    insertImageMarkdown(dataUrl);
    closeCropper();
  }, [insertImageMarkdown, closeCropper]);

  const closeLiveSelector = useCallback(() => {
    setLiveSelector({ active: false, target: null, error: null });
    editorCtxRef.current = null;
  }, []);

  const handleLiveSelection = useCallback((rectVp) => {
    // The selector hands us a viewport-coord rect; the target element it was
    // bound to is still in our state. Composite, insert, then close.
    const target = liveSelector.target;
    if (!target) {
      closeLiveSelector();
      return;
    }
    try {
      const dataUrl = captureSelectionFromTarget(target, rectVp);
      insertImageMarkdown(dataUrl);
      closeLiveSelector();
    } catch (err) {
      // Surface the error in the snapshot modal so the user has somewhere to
      // read it; the live overlay itself is purely a selection UI.
      setLiveSelector({ active: false, target: null, error: null });
      setShotState({
        open: true,
        src: null,
        error: err?.message || String(err),
        loading: false,
      });
    }
  }, [liveSelector.target, insertImageMarkdown, closeLiveSelector]);

  // Plugin list is memoised because the screenshot plugin captures a
  // React-managed callback. ByteMD treats `plugins` as a plain array, so a new
  // reference each render would cause unnecessary re-initialisation.
  const plugins = useMemo(
    () => [
      gfm(),
      breaks(),
      frontmatter(),
      gemoji(),
      highlight(),
      math(),
      mermaid(),
      mediumZoom(),
      makeScreenshotPlugin(handleScreenshotClick),
    ],
    [handleScreenshotClick],
  );

  // CodeMirror v5 (which ByteMD bundles) measures its container at init and
  // does not auto-resize. Inside a `react-resizable-panels` Panel the size
  // changes after mount, so we must call `.CodeMirror.refresh()` whenever
  // the wrapper changes size. ByteMD also creates the CodeMirror DOM
  // asynchronously inside its Svelte `onMount`, so the very first refresh
  // must wait until `.CodeMirror` actually appears.
  useEffect(() => {
    const root = wrapperRef.current;
    if (!root || typeof ResizeObserver === 'undefined') return;
    const refresh = () => {
      const cmEl = root.querySelector('.CodeMirror');
      // CodeMirror attaches its instance to the DOM element as `CodeMirror`.
      const cm = cmEl && cmEl.CodeMirror;
      if (cm) cm.refresh();
    };
    const ro = new ResizeObserver(refresh);
    ro.observe(root);

    // Watch for the CodeMirror DOM appearing (ByteMD mounts it asynchronously)
    // and refresh once more after it does, so the initial scroll metrics align
    // with the real container size.
    let mo;
    if (typeof MutationObserver !== 'undefined') {
      mo = new MutationObserver(() => {
        if (root.querySelector('.CodeMirror')) {
          refresh();
          mo.disconnect();
          mo = null;
        }
      });
      mo.observe(root, { childList: true, subtree: true });
    }

    // Belt-and-braces: also retry a couple of frames after mount in case
    // neither observer fires (e.g. very small container, no resize event).
    const id1 = requestAnimationFrame(refresh);
    const id2 = setTimeout(refresh, 200);

    return () => {
      cancelAnimationFrame(id1);
      clearTimeout(id2);
      ro.disconnect();
      if (mo) mo.disconnect();
    };
  }, []);

  return (
    <div ref={wrapperRef} className="slidev-bytemd h-full">
      <Editor
        value={value}
        plugins={plugins}
        onChange={(v) => onChange?.(v)}
        mode="split"
        placeholder={placeholder}
        editorConfig={{ lineWrapping: true }}
      />
      {liveSelector.active && liveSelector.target && (
        <DirectRegionSelector
          targetEl={liveSelector.target}
          onConfirm={handleLiveSelection}
          onCancel={closeLiveSelector}
        />
      )}
      {shotState.open && (
        <>
          {shotState.loading && !shotState.src && !shotState.error && (
            <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/60 text-vs-foreground text-sm">
              {t('slidev.bytemd.waitingPermission')}
            </div>
          )}
          {(shotState.src || shotState.error) && (
            <ScreenshotCropper
              src={shotState.src}
              error={shotState.error}
              onCancel={closeCropper}
              onConfirm={handleConfirmCrop}
            />
          )}
        </>
      )}
    </div>
  );
}
