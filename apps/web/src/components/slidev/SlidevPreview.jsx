import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '../../lib/cn.js';
import { SlideMarkdown } from './SlideMarkdown.jsx';
import { parseSlides } from './parseSlides.js';

/**
 * Splits Slidev markdown into individual slides and renders them in a paginated preview.
 * Supports Mermaid diagrams, GFM tables, images, and rich formatting.
 *
 * In edit mode the markdown is mutated on every keystroke; we memoize the
 * parse and clamp the active slide index so deletions never leave us pointing
 * past the end of the array.
 */
export function SlidevPreview({ markdown }) {
  const { t } = useTranslation();
  const [currentSlide, setCurrentSlide] = useState(0);

  const slides = useMemo(() => parseSlides(markdown), [markdown]);
  const total = slides.length;

  // Clamp index when slide count shrinks (e.g. user deletes a slide).
  useEffect(() => {
    if (total === 0) return;
    if (currentSlide > total - 1) setCurrentSlide(total - 1);
  }, [total, currentSlide]);

  if (!markdown) return null;
  if (total === 0) return null;

  const safeIndex = Math.min(currentSlide, total - 1);
  const prev = () => setCurrentSlide((c) => Math.max(0, c - 1));
  const next = () => setCurrentSlide((c) => Math.min(total - 1, c + 1));

  return (
    <div className="flex flex-col h-full">
      {/* Slide content */}
      <div className="flex-1 overflow-auto p-4 bg-vs-editor">
        <div className="max-w-2xl mx-auto bg-[#1e1e2e] rounded-lg p-6 min-h-[300px] shadow-lg border border-vs-border">
          <SlideMarkdown className="prose prose-invert prose-sm max-w-none">
            {slides[safeIndex]}
          </SlideMarkdown>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-center gap-3 py-2 px-4 bg-vs-sidebar border-t border-vs-border">
        <button
          onClick={prev}
          disabled={safeIndex === 0}
          title={t('slidev.preview.prev')}
          aria-label={t('slidev.preview.prev')}
          className={cn(
            'p-1 rounded hover:bg-vs-hover',
            safeIndex === 0 && 'opacity-30 cursor-not-allowed',
          )}
        >
          <ChevronLeft size={16} />
        </button>
        <span className="text-xs text-vs-muted">
          {t('slidev.preview.counter', { current: safeIndex + 1, total })}
        </span>
        <button
          onClick={next}
          disabled={safeIndex === total - 1}
          title={t('slidev.preview.next')}
          aria-label={t('slidev.preview.next')}
          className={cn(
            'p-1 rounded hover:bg-vs-hover',
            safeIndex === total - 1 && 'opacity-30 cursor-not-allowed',
          )}
        >
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}
