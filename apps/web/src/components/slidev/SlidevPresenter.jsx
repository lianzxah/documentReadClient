import { useEffect, useCallback, useState } from 'react';
import { useKeyPress } from 'ahooks';
import { X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { SlideMarkdown } from './SlideMarkdown.jsx';
import { parseSlides } from './parseSlides.js';

/**
 * Fullscreen presentation mode. Renders slides one at a time with keyboard navigation.
 * Supports Mermaid diagrams, GFM tables, images, and rich formatting.
 */
export function SlidevPresenter({ markdown, onClose }) {
  const { t } = useTranslation();
  const [currentSlide, setCurrentSlide] = useState(0);

  // Parse slides (strip outer code fence wrapper, frontmatter, and YAML-only chunks)
  const slides = parseSlides(markdown);
  const total = slides.length;

  const prev = useCallback(() => setCurrentSlide((c) => Math.max(0, c - 1)), []);
  const next = useCallback(() => setCurrentSlide((c) => Math.min(total - 1, c + 1)), [total]);

  // Keyboard navigation
  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown' || e.key === ' ') {
        e.preventDefault();
        next();
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault();
        prev();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onClose?.();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [next, prev, onClose]);

  // Request fullscreen on mount
  useEffect(() => {
    document.documentElement.requestFullscreen?.().catch(() => {});
    return () => {
      if (document.fullscreenElement) {
        document.exitFullscreen?.().catch(() => {});
      }
    };
  }, []);

  if (total === 0) return null;

  return (
    <div className="fixed inset-0 z-[9999] bg-[#0d1117] flex flex-col items-center justify-center">
      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 text-gray-400 hover:text-white p-2 rounded-lg hover:bg-white/10 z-10"
        title={t('slidev.presenter.exit')}
      >
        <X size={24} />
      </button>

      {/* Slide content */}
      <div className="flex-1 flex items-center justify-center w-full max-w-5xl px-8 overflow-auto">
        <div className="w-full">
          <SlideMarkdown
            className="prose prose-invert prose-lg max-w-none text-center [&>h1]:text-4xl [&>h2]:text-3xl [&>h3]:text-2xl [&>ul]:text-left [&>ol]:text-left [&>p]:text-xl [&_table]:text-left [&_table]:text-base"
          >
            {slides[currentSlide]}
          </SlideMarkdown>
        </div>
      </div>

      {/* Footer navigation */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-4">
        <span className="text-sm text-gray-500">
          {t('slidev.presenter.counter', { current: currentSlide + 1, total })}
        </span>
        <div className="w-32 h-1 bg-gray-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-blue-500 transition-all duration-200"
            style={{ width: `${((currentSlide + 1) / total) * 100}%` }}
          />
        </div>
      </div>

      {/* Invisible click areas for navigation */}
      <div
        className="absolute left-0 top-0 bottom-0 w-1/3 cursor-pointer"
        onClick={prev}
      />
      <div
        className="absolute right-0 top-0 bottom-0 w-1/3 cursor-pointer"
        onClick={next}
      />
    </div>
  );
}
