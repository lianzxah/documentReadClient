import React, { useEffect, useCallback } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import TextAlign from '@tiptap/extension-text-align';
import Placeholder from '@tiptap/extension-placeholder';
import { usePptxStore } from '../../store/pptxStore';

/**
 * InlineTextEditor - Tiptap-based rich text editor for inline editing
 * on the PPTX canvas. Supports basic formatting and text alignment.
 *
 * Used for both text elements and shape text content.
 */
export function InlineTextEditor({
  content,
  onUpdate,
  onBlur,
  autoFocus = true,
  style = {},
  className = '',
}) {
  const setDisableHotkeys = usePptxStore((s) => s.setDisableHotkeys);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        // Keep history for local undo within the editor
        history: { depth: 50 },
      }),
      TextAlign.configure({
        types: ['heading', 'paragraph'],
        alignments: ['left', 'center', 'right'],
      }),
      Placeholder.configure({
        placeholder: 'Type here...',
      }),
    ],
    content: content || '',
    editable: true,
    autofocus: autoFocus ? 'end' : false,
    onUpdate: ({ editor: ed }) => {
      if (onUpdate) {
        // Return HTML content (or plain text if needed)
        onUpdate(ed.getText());
      }
    },
    onFocus: () => {
      setDisableHotkeys(true);
    },
    onBlur: ({ event }) => {
      setDisableHotkeys(false);
      if (onBlur) onBlur(event);
    },
  });

  // Sync external content changes (e.g. from panel)
  useEffect(() => {
    if (!editor) return;
    // Only update if content differs to avoid cursor jump
    const currentText = editor.getText();
    if (content !== currentText && !editor.isFocused) {
      editor.commands.setContent(content || '');
    }
  }, [content, editor]);

  // Prevent mouse events from bubbling to Rnd (prevents drag during editing)
  const stopPropagation = useCallback((e) => {
    e.stopPropagation();
  }, []);

  if (!editor) return null;

  return (
    <div
      className={`inline-text-editor w-full h-full ${className}`}
      onMouseDown={stopPropagation}
      onPointerDown={stopPropagation}
      onClick={stopPropagation}
      onDoubleClick={stopPropagation}
      style={{
        ...style,
        cursor: 'text',
        outline: 'none',
        minHeight: '1em',
      }}
    >
      <EditorContent
        editor={editor}
        className="w-full h-full"
        style={{
          fontSize: style.fontSize,
          color: style.color,
          fontWeight: style.fontWeight,
          textAlign: style.textAlign,
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
          outline: 'none',
        }}
      />
    </div>
  );
}
