import React from 'react';
import {
  KBarProvider,
  KBarPortal,
  KBarPositioner,
  KBarAnimator,
  KBarSearch,
  KBarResults,
  useMatches,
} from 'kbar';
import { usePptxStore } from '../../store/pptxStore';
import { nanoid } from 'nanoid';

/**
 * Build the kbar actions list from current PPTX editor state.
 * Actions are organized by category: Element, Slide, Insert, Edit.
 */
function buildActions() {
  return [
    // --- Edit ---
    {
      id: 'undo',
      name: 'Undo',
      shortcut: ['$mod+z'],
      section: 'Edit',
      perform: () => usePptxStore.getState().undo(),
    },
    {
      id: 'redo',
      name: 'Redo',
      shortcut: ['$mod+y'],
      section: 'Edit',
      perform: () => usePptxStore.getState().redo(),
    },
    {
      id: 'copy',
      name: 'Copy Element',
      shortcut: ['$mod+c'],
      section: 'Edit',
      perform: () => usePptxStore.getState().copyElement(),
    },
    {
      id: 'cut',
      name: 'Cut Element',
      shortcut: ['$mod+x'],
      section: 'Edit',
      perform: () => usePptxStore.getState().cutElement(),
    },
    {
      id: 'paste',
      name: 'Paste Element',
      shortcut: ['$mod+v'],
      section: 'Edit',
      perform: () => {
        const s = usePptxStore.getState();
        s.pasteElement();
        s.pushHistory();
      },
    },
    {
      id: 'duplicate',
      name: 'Duplicate Element',
      shortcut: ['$mod+d'],
      section: 'Edit',
      perform: () => {
        const s = usePptxStore.getState();
        s.duplicateElement();
        s.pushHistory();
      },
    },

    // --- Element ---
    {
      id: 'delete-element',
      name: 'Delete Element',
      shortcut: ['Backspace'],
      section: 'Element',
      perform: () => {
        const s = usePptxStore.getState();
        if (s.activeElementId) {
          s.removeElement(s.currentSlideIndex, s.activeElementId);
        }
      },
    },
    {
      id: 'bring-front',
      name: 'Bring to Front',
      section: 'Element',
      perform: () => {
        const s = usePptxStore.getState();
        if (s.activeElementId) {
          s.bringToFront(s.currentSlideIndex, s.activeElementId);
          s.pushHistory();
        }
      },
    },
    {
      id: 'send-back',
      name: 'Send to Back',
      section: 'Element',
      perform: () => {
        const s = usePptxStore.getState();
        if (s.activeElementId) {
          s.sendToBack(s.currentSlideIndex, s.activeElementId);
          s.pushHistory();
        }
      },
    },

    // --- Slide ---
    {
      id: 'new-slide',
      name: 'New Slide',
      section: 'Slide',
      perform: () => usePptxStore.getState().addSlide(),
    },
    {
      id: 'duplicate-slide',
      name: 'Duplicate Slide',
      section: 'Slide',
      perform: () => {
        const s = usePptxStore.getState();
        s.duplicateSlide(s.currentSlideIndex);
      },
    },
    {
      id: 'delete-slide',
      name: 'Delete Slide',
      section: 'Slide',
      perform: () => {
        const s = usePptxStore.getState();
        s.deleteSlide(s.currentSlideIndex);
      },
    },

    // --- Insert ---
    {
      id: 'insert-text',
      name: 'Insert Text Box',
      shortcut: ['t'],
      section: 'Insert',
      perform: () => {
        const s = usePptxStore.getState();
        s.addElement(s.currentSlideIndex, {
          id: `text-${nanoid(8)}`,
          type: 'text',
          content: 'New Text',
          left: 400,
          top: 200,
          width: 400,
          height: 100,
          color: '#000000',
          fontSize: 24,
          fontWeight: 'normal',
          align: 'left',
          opacity: 1,
        });
      },
    },
    {
      id: 'insert-rectangle',
      name: 'Insert Rectangle',
      shortcut: ['r'],
      section: 'Insert',
      perform: () => {
        const s = usePptxStore.getState();
        s.addElement(s.currentSlideIndex, {
          id: `shape-${nanoid(8)}`,
          type: 'shape',
          shapeType: 'svg',
          left: 350,
          top: 150,
          width: 200,
          height: 200,
          fillColor: '#4b83f0',
          outlineColor: '#333333',
          outlineWidth: 0,
          outlineStyle: 'solid',
          opacity: 1,
          rotate: 0,
          viewBox: [200, 200],
          svgPath: 'M 0 0 L 200 0 L 200 200 L 0 200 Z',
        });
      },
    },
  ];
}

/**
 * Renders kbar search results with custom styling.
 */
function RenderResults() {
  const { results } = useMatches();

  return (
    <KBarResults
      items={results}
      onRender={({ item, active }) =>
        typeof item === 'string' ? (
          <div className="px-3 py-2 text-[10px] uppercase tracking-wider text-vs-muted font-semibold">
            {item}
          </div>
        ) : (
          <div
            className={`px-3 py-2 flex items-center justify-between cursor-pointer rounded mx-1 ${
              active ? 'bg-blue-600/20 text-vs-foreground' : 'text-vs-foreground/80'
            }`}
          >
            <span className="text-sm">{item.name}</span>
            {item.shortcut?.length > 0 && (
              <span className="text-[10px] text-vs-muted bg-vs-bg px-1.5 py-0.5 rounded border border-vs-border">
                {item.shortcut.join(' ')}
              </span>
            )}
          </div>
        )
      }
    />
  );
}

/**
 * PptxKbarProvider - Wraps children with kbar command palette.
 * Triggered by Ctrl+K within the PPTX editor.
 */
export function PptxKbarProvider({ children }) {
  const actions = buildActions();

  return (
    <KBarProvider actions={actions}>
      <KBarPortal>
        <KBarPositioner className="z-[9999] bg-black/40 backdrop-blur-sm">
          <KBarAnimator className="w-[500px] max-w-[90vw] bg-vs-sidebar border border-vs-border rounded-xl shadow-2xl overflow-hidden">
            <KBarSearch
              className="w-full px-4 py-3 bg-transparent border-b border-vs-border text-vs-foreground text-sm outline-none placeholder:text-vs-muted"
              placeholder="Type a command..."
            />
            <div className="max-h-[400px] py-2">
              <RenderResults />
            </div>
          </KBarAnimator>
        </KBarPositioner>
      </KBarPortal>
      {children}
    </KBarProvider>
  );
}
