import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import rehypeHighlight from 'rehype-highlight';
import rehypeRaw from 'rehype-raw';

// Static arrays — defined once at module level so ReactMarkdown's shallow
// comparison never triggers a needless re-render.
const REMARK_PLUGINS = [remarkGfm, remarkMath];
const REHYPE_PLUGINS = [rehypeKatex, rehypeHighlight, rehypeRaw];

// Custom component overrides — also stable references.
const MD_COMPONENTS = {
  // ── Tables ──────────────────────────────────────────────
  table({ children: c }) {
    return (
      <div className="my-2 overflow-x-auto rounded border border-vs-border">
        <table className="w-full text-sm border-collapse">{c}</table>
      </div>
    );
  },
  thead({ children: c }) {
    return <thead className="bg-white/5">{c}</thead>;
  },
  th({ children: c }) {
    return (
      <th className="px-3 py-1.5 text-left border-b border-vs-border font-semibold text-vs-fg">
        {c}
      </th>
    );
  },
  td({ children: c }) {
    return (
      <td className="px-3 py-1.5 border-b border-vs-border/50">{c}</td>
    );
  },

  // ── Code blocks ─────────────────────────────────────────
  pre({ children: c }) {
    return (
      <pre className="my-2 rounded-md bg-[#1a1a2e] border border-vs-border overflow-x-auto p-3 text-sm leading-relaxed">
        {c}
      </pre>
    );
  },
  code({ node, inline, className: codeClass, children: c, ...props }) {
    if (inline) {
      return (
        <code
          className="px-1 py-0.5 rounded bg-[#2a2a3a] text-[#e06c75] text-[0.9em]"
          {...props}
        >
          {c}
        </code>
      );
    }
    // Block code — rehype-highlight already adds `hljs` classes
    return (
      <code className={codeClass} {...props}>
        {c}
      </code>
    );
  },

  // ── Blockquotes ─────────────────────────────────────────
  blockquote({ children: c }) {
    return (
      <blockquote className="my-2 pl-3 border-l-3 border-blue-400/60 bg-blue-900/10 py-1 pr-3 rounded-r text-vs-fg/80">
        {c}
      </blockquote>
    );
  },
};

/**
 * Enhanced Markdown renderer for the chat panel. Supports:
 *   - GFM tables (via remark-gfm)
 *   - Fenced-code syntax highlighting (via rehype-highlight + highlight.js)
 *   - Inline & block math: $...$ / $$...$$ (via remark-math + rehype-katex)
 *   - Raw HTML pass-through (via rehype-raw)
 *
 * All chat assistant messages should flow through this component so that
 * tables, formulas, and code snippets are rendered nicely.
 */
export function ChatMarkdown({ children, className = '' }) {
  return (
    <ReactMarkdown
      className={className}
      remarkPlugins={REMARK_PLUGINS}
      rehypePlugins={REHYPE_PLUGINS}
      components={MD_COMPONENTS}
    >
      {children}
    </ReactMarkdown>
  );
}
