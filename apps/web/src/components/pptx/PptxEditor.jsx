import React, { useEffect, useState } from 'react';
import { LogOut } from 'lucide-react';
import { usePptxStore } from '../../store/pptxStore';
import { useSlidevStore } from '../../store/slidevStore';
import { useUIStore } from '../../store/uiStore';
import { parseMarkdownToPptxJson } from './parser';
import { Toolbar } from './Toolbar';
import { SlideList } from './SlideList';
import { Canvas } from './Canvas';
import { Panel } from './Panel';
import { TemplatePanel } from './TemplatePanel';
import { PptxKbarProvider } from './PptxKbarProvider';
import { useHotkeys } from './hooks/useHotkeys';

function PptxEditorInner() {
  const setSlides = usePptxStore((s) => s.setSlides);
  const currentSlideIndex = usePptxStore((s) => s.currentSlideIndex);
  const setCurrentSlideIndex = usePptxStore((s) => s.setCurrentSlideIndex);
  const pushHistory = usePptxStore((s) => s.pushHistory);
  const markdown = useSlidevStore((s) => s.markdown);
  const setPptxEditMode = useUIStore((s) => s.setPptxEditMode);
  
  const [initialized, setInitialized] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);

  // Attach global keyboard shortcuts
  useHotkeys();

  useEffect(() => {
    if (markdown && !initialized) {
      const parsedData = parseMarkdownToPptxJson(markdown);
      setSlides(parsedData.slides);
      setCurrentSlideIndex(0);
      // Initialize history with the initial state
      setTimeout(() => pushHistory(), 0);
      setInitialized(true);
    }
  }, [markdown, setSlides, setCurrentSlideIndex, initialized, pushHistory]);

  return (
    <div className="flex flex-col h-full w-full bg-vs-bg text-vs-foreground font-sans">
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-vs-border bg-vs-sidebar text-xs">
        <div className="flex items-center gap-2">
          <span className="font-semibold">Visual PPTX Editor</span>
          <span className="text-vs-muted text-[10px]">Ctrl+K for commands</span>
        </div>
        <div>
          <button
            onClick={() => setPptxEditMode(false)}
            className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded transition-colors bg-vs-hover hover:bg-red-500/10 hover:text-red-400 text-vs-foreground"
          >
            <LogOut size={14} />
            Exit Visual Edit
          </button>
        </div>
      </div>
      <Toolbar onOpenTemplates={() => setShowTemplates(true)} />
      <div className="flex flex-1 overflow-hidden">
        <SlideList />
        <div className="flex-1 relative flex flex-col bg-vs-sidebar/50">
          <Canvas slideIndex={currentSlideIndex} />
        </div>
        <Panel />
      </div>
      <TemplatePanel open={showTemplates} onClose={() => setShowTemplates(false)} />
    </div>
  );
}

export function PptxEditor() {
  return (
    <PptxKbarProvider>
      <PptxEditorInner />
    </PptxKbarProvider>
  );
}
