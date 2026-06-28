import React, { useEffect, useRef, useState, useCallback } from 'react';
import { usePptxStore } from '../../store/pptxStore';
import { generateThumbnailWithFallback } from '../../lib/thumbnailGenerator';

/**
 * SlideThumbnail - Renders a high-fidelity image thumbnail of a slide.
 * Uses html-to-image via offscreen DOM rendering with debounced updates.
 * Falls back to a simple DOM-scaled preview while generating.
 */
export function SlideThumbnail({ slide, slideIndex }) {
  const thumbnail = usePptxStore((s) => s.thumbnails[slide.id]);
  const dirtyThumbnails = usePptxStore((s) => s.dirtyThumbnails);
  const setThumbnail = usePptxStore((s) => s.setThumbnail);
  const [isGenerating, setIsGenerating] = useState(false);
  const debounceRef = useRef(null);
  const mountedRef = useRef(true);

  // Track whether slide is dirty (needs thumbnail refresh)
  const isDirty = dirtyThumbnails.has(slide.id);

  const regenerate = useCallback(async () => {
    if (!mountedRef.current) return;
    setIsGenerating(true);
    try {
      const dataUrl = await generateThumbnailWithFallback(slide);
      if (dataUrl && mountedRef.current) {
        setThumbnail(slide.id, dataUrl);
      }
    } catch (err) {
      console.warn('[SlideThumbnail] Generation failed:', err);
    } finally {
      if (mountedRef.current) {
        setIsGenerating(false);
      }
    }
  }, [slide, setThumbnail]);

  // Generate thumbnail on mount and when slide becomes dirty
  useEffect(() => {
    mountedRef.current = true;

    // If no thumbnail exists yet, generate immediately
    if (!thumbnail) {
      regenerate();
      return () => { mountedRef.current = false; };
    }

    // If dirty, debounce the regeneration
    if (isDirty) {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        regenerate();
      }, 500);
    }

    return () => {
      mountedRef.current = false;
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [isDirty, thumbnail, regenerate]);

  // Render the thumbnail image or a fallback preview
  return (
    <div className="aspect-video bg-vs-bg border border-vs-border rounded shadow-sm overflow-hidden relative">
      {thumbnail ? (
        <>
          <img
            src={thumbnail}
            alt={`Slide ${slideIndex + 1}`}
            className="w-full h-full object-contain"
            draggable={false}
          />
          {/* Generating indicator overlay */}
          {isGenerating && (
            <div className="absolute inset-0 bg-black/10 flex items-center justify-center">
              <div className="w-3 h-3 border border-blue-400 border-t-transparent rounded-full animate-spin" />
            </div>
          )}
        </>
      ) : (
        /* Fallback: DOM-scaled mini preview while first thumbnail generates */
        <div className="w-full h-full flex items-center justify-center relative">
          <div
            className="absolute pointer-events-none origin-top-left"
            style={{
              backgroundColor: slide.background?.color || '#ffffff',
              transform: 'scale(0.15)',
              transformOrigin: 'top left',
              width: '1000px',
              height: '562.5px',
              left: '50%',
              top: '50%',
              marginLeft: '-75px',
              marginTop: '-42px',
            }}
          >
            {slide.elements.map((el) => {
              if (el.type === 'text') {
                return (
                  <div
                    key={el.id}
                    className="absolute overflow-hidden"
                    style={{
                      left: el.left || 0, top: el.top || 0,
                      width: el.width || 100, height: el.height || 100,
                      color: el.color, fontSize: el.fontSize,
                      fontWeight: el.fontWeight, textAlign: el.align,
                      whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                      transform: `rotate(${el.rotate || 0}deg)`,
                      opacity: el.opacity,
                    }}
                  >
                    {el.content}
                  </div>
                );
              }
              if (el.type === 'shape' && el.svgPath && el.viewBox) {
                return (
                  <div key={el.id} className="absolute" style={{ left: el.left, top: el.top, width: el.width, height: el.height, opacity: el.opacity }}>
                    <svg viewBox={`0 0 ${el.viewBox[0]} ${el.viewBox[1]}`} className="w-full h-full" preserveAspectRatio="none">
                      <path d={el.svgPath} fill={el.outlined ? 'none' : (el.fillColor || '#4b83f0')} stroke={el.outlineColor || 'none'} strokeWidth={el.outlineWidth || 0} />
                    </svg>
                  </div>
                );
              }
              if (el.type === 'image') {
                return (
                  <img
                    key={el.id}
                    src={el.src}
                    alt=""
                    className="absolute"
                    style={{
                      left: el.left || 0, top: el.top || 0,
                      width: el.width || 100, height: el.height || 100,
                      objectFit: 'contain',
                    }}
                  />
                );
              }
              return null;
            })}
          </div>
          {/* Loading spinner */}
          {isGenerating && (
            <div className="absolute inset-0 bg-black/5 flex items-center justify-center z-10">
              <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
