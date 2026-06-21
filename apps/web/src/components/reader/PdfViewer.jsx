import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Document, Page } from 'react-pdf';
import 'react-pdf/dist/esm/Page/TextLayer.css';
import 'react-pdf/dist/esm/Page/AnnotationLayer.css';
import '../../lib/pdfWorker.js';
import { Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { pdfUrl } from '../../lib/api.js';
import { useTabsStore } from '../../store/tabsStore.js';
import { useTranslateStore } from '../../store/translateStore.js';

// Lesson 8: large-PDF rendering strategy.
//
// 1. We never mount all <Page> components at once. For a 500-page book that
//    would explode both DOM size and pdfjs memory.
// 2. Instead we render an equally-sized placeholder div for every page so
//    the scroll height is correct. An IntersectionObserver tracks which
//    placeholders enter a generous viewport (rootMargin pre-roll), and the
//    `<Page>` is mounted only for those.
// 3. We cap the visible window to ±RENDER_WINDOW pages around the current
//    page tracked by scroll position. This bounds memory at ~10 mounted
//    pages × ~5 MB ≈ 50 MB for any document size.
// 4. Document `disableAutoFetch` lets pdfjs fetch only the byte ranges it
//    needs for visible pages, avoiding a 200 MB up-front download.
const RENDER_WINDOW = 5; // pages above + below the current page
const PRE_ROLL_PX = 600; // IntersectionObserver rootMargin

// Stable Document options. react-pdf re-creates the underlying loading task
// whenever this object reference changes, so it MUST be defined outside the
// component (or memoised) to avoid an infinite reload loop.
const DOCUMENT_OPTIONS = {
  disableAutoFetch: true,
  disableStream: false,
  cMapPacked: true,
};

export const PdfViewer = forwardRef(function PdfViewer({ tab }, ref) {
  const { t } = useTranslation();
  const [numPages, setNumPages] = useState(tab.pages || 0);
  const [width, setWidth] = useState(800);
  const [aspect, setAspect] = useState(1.4142); // A4 portrait fallback (h/w)
  const [visiblePages, setVisiblePages] = useState(() => new Set());

  const containerRef = useRef(null);
  const pageRefs = useRef({});
  const observerRef = useRef(null);
  const currentPageRef = useRef(1);
  const pdfRef = useRef(null);

  const setCurrentPage = useTabsStore((s) => s.setCurrentPage);
  const setOutline = useTabsStore((s) => s.setOutline);
  const openTranslate = useTranslateStore((s) => s.openAt);

  // Track container width for responsive page rendering.
  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver(() => {
      if (containerRef.current) {
        const cw = containerRef.current.clientWidth;
        setWidth(Math.min(cw - 24, 1100));
      }
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  /**
   * IntersectionObserver: marks placeholder pages as visible whenever they
   * enter the viewport (with PRE_ROLL_PX pre-roll above and below). The
   * sliding-window cap is enforced separately when the current page changes.
   */
  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new IntersectionObserver(
      (entries) => {
        setVisiblePages((prev) => {
          const next = new Set(prev);
          for (const entry of entries) {
            const p = Number(entry.target.getAttribute('data-page'));
            if (!p) continue;
            if (entry.isIntersecting) next.add(p);
            else next.delete(p);
          }
          return next;
        });
      },
      {
        root: containerRef.current,
        rootMargin: `${PRE_ROLL_PX}px 0px`,
        threshold: 0,
      },
    );
    observerRef.current = observer;
    // Re-observe everything currently in pageRefs.
    for (const node of Object.values(pageRefs.current)) {
      if (node) observer.observe(node);
    }
    return () => {
      observer.disconnect();
      observerRef.current = null;
    };
  }, [numPages]);

  // Track current page via scroll position + enforce ±RENDER_WINDOW cap.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onScroll = () => {
      const scrollCenter = el.scrollTop + el.clientHeight / 2;
      let closest = 1;
      let best = Infinity;
      for (const [pageStr, node] of Object.entries(pageRefs.current)) {
        if (!node) continue;
        const offset = node.offsetTop;
        const dist = Math.abs(offset - scrollCenter);
        if (dist < best) {
          best = dist;
          closest = Number(pageStr);
        }
      }
      if (currentPageRef.current !== closest) {
        currentPageRef.current = closest;
        setCurrentPage(tab.id, closest);
        // Tighten the visible set to the sliding window. Pages outside the
        // window stay as cheap placeholders even if the IntersectionObserver
        // briefly kept them.
        setVisiblePages((prev) => {
          const min = Math.max(1, closest - RENDER_WINDOW);
          const max = Math.min(numPages || closest, closest + RENDER_WINDOW);
          let changed = false;
          const next = new Set();
          for (const p of prev) {
            if (p >= min && p <= max) next.add(p);
            else changed = true;
          }
          // Always include the current page so the viewport is filled even
          // before the observer fires for the first time.
          if (!next.has(closest)) {
            next.add(closest);
            changed = true;
          }
          return changed ? next : prev;
        });
      }
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, [tab.id, setCurrentPage, numPages]);

  useImperativeHandle(ref, () => ({
    scrollToPage(page) {
      const node = pageRefs.current[page];
      if (node && containerRef.current) {
        containerRef.current.scrollTo({
          top: node.offsetTop - 12,
          behavior: 'smooth',
        });
      }
    },
    async goToDestination(dest) {
      if (!pdfRef.current) return;
      try {
        const pdf = pdfRef.current;
        let explicitDest = dest;
        if (typeof dest === 'string') {
          explicitDest = await pdf.getDestination(dest);
        }
        if (Array.isArray(explicitDest)) {
          const pageIndex = await pdf.getPageIndex(explicitDest[0]);
          const pageNumber = pageIndex + 1;
          const node = pageRefs.current[pageNumber];
          if (node && containerRef.current) {
            containerRef.current.scrollTo({
              top: node.offsetTop - 12,
              behavior: 'smooth',
            });
          }
        }
      } catch (err) {
        console.error('Failed to go to destination', err);
      }
    }
  }));

  // Show selection popover anchored to the selection rect.
  const onMouseUp = () => {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed) return;
    const text = sel.toString().trim();
    if (!text || text.length < 2) return;
    const range = sel.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    openTranslate(
      { x: rect.left + rect.width / 2, y: rect.bottom + 8 },
      text,
    );
  };

  /**
   * onLoadSuccess: capture page count and probe page 1's aspect ratio so we
   * can compute placeholder heights without mounting every page.
   */
  const onDocumentLoad = async (pdf) => {
    pdfRef.current = pdf;
    setNumPages(pdf.numPages);
    try {
      const page = await pdf.getPage(1);
      const viewport = page.getViewport({ scale: 1 });
      if (viewport.width > 0) {
        setAspect(viewport.height / viewport.width);
      }
      page.cleanup?.();
    } catch {
      // keep A4 fallback
    }

    // Try fetching the outline
    try {
      const outline = await pdf.getOutline();
      if (outline) {
        setOutline(tab.id, outline);
      }
    } catch (err) {
      console.warn('Failed to load PDF outline', err);
    }

    // Seed the visible set with the first window so the user sees content
    // immediately, even before the observer reports anything.
    setVisiblePages(() => {
      const seed = new Set();
      const upTo = Math.min(pdf.numPages, RENDER_WINDOW + 1);
      for (let p = 1; p <= upTo; p++) seed.add(p);
      return seed;
    });
  };

  const pageWidth = tab.isTwoPage ? (width - 16) / 2 : width;
  const placeholderHeight = useMemo(
    () => Math.max(120, Math.round(pageWidth * aspect)),
    [pageWidth, aspect],
  );

  const spreads = useMemo(() => {
    const result = [];
    if (!tab.isTwoPage) {
      for (let i = 1; i <= numPages; i++) result.push([i]);
      return result;
    }
    if (numPages > 0) result.push([1]);
    for (let i = 2; i <= numPages; i += 2) {
      if (i + 1 <= numPages) {
        result.push([i, i + 1]);
      } else {
        result.push([i]);
      }
    }
    return result;
  }, [numPages, tab.isTwoPage]);

  const attachPageRef = (page) => (el) => {
    const previous = pageRefs.current[page];
    pageRefs.current[page] = el;
    const observer = observerRef.current;
    if (observer) {
      if (previous && previous !== el) observer.unobserve(previous);
      if (el) observer.observe(el);
    }
  };

  return (
    <div
      ref={containerRef}
      onMouseUp={onMouseUp}
      className="h-full overflow-auto bg-[#2b2b2b] py-6 relative"
    >
      <Document
        file={pdfUrl(tab.documentId)}
        onLoadSuccess={onDocumentLoad}
        options={DOCUMENT_OPTIONS}
        className="flex flex-col items-center gap-4 px-4"
        loading={
          <div className="flex items-center justify-center h-40 text-vs-muted gap-2">
            <Loader2 className="animate-spin" size={16} /> {t('reader.viewer.loading')}
          </div>
        }
        error={
          <div className="text-red-400 text-sm p-4">
            {t('reader.viewer.loadError')}
          </div>
        }
      >
        {spreads.map((spread) => {
          const p = spread[0];
          const visible = visiblePages.has(p);
          return (
            <div
              key={p}
              ref={attachPageRef(p)}
              data-page={p}
              className="flex gap-4 w-full justify-center"
              style={{
                minHeight: visible ? undefined : placeholderHeight,
              }}
            >
              {spread.map((pageNum) => (
                <div
                  key={pageNum}
                  className="shadow-lg bg-white shrink-0"
                  style={{
                    width: pageWidth,
                    minHeight: visible ? undefined : placeholderHeight,
                  }}
                >
                  {visible ? (
                    <Page
                      pageNumber={pageNum}
                      width={pageWidth}
                      renderTextLayer
                      renderAnnotationLayer={false}
                      loading={null}
                    />
                  ) : null}
                </div>
              ))}
            </div>
          );
        })}
      </Document>
    </div>
  );
});
