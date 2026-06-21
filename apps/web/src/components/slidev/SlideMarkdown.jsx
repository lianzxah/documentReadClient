import ReactMarkdown, { defaultUrlTransform } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import { MermaidDiagram } from './MermaidDiagram.jsx';

/**
 * `react-markdown` v9 ships a `defaultUrlTransform` that only allows
 * http(s)/ircs/mailto/xmpp protocols and rewrites everything else to an empty
 * string. That silently strips `data:image/...` URLs produced by the
 * ByteMDEditor screenshot feature, so inline screenshots render as
 * `<img src="">` (i.e. completely invisible). Whitelist `data:image/` while
 * still deferring to the default for every other protocol.
 *
 * See `analysis/slidev-base64-screenshot-invisible.md` for the full root-cause
 * analysis.
 */
function urlTransform(url) {
  if (typeof url === 'string' && url.startsWith('data:image/')) return url;
  return defaultUrlTransform(url);
}

/**
 * Enhanced Markdown renderer for slides. Supports:
 * - GFM tables
 * - Mermaid diagrams (```mermaid code blocks)
 * - Images with proper styling (including base64 `data:image/...` URLs)
 * - HTML in markdown
 */
export function SlideMarkdown({ children, className = '' }) {
  return (
    <ReactMarkdown
      className={className}
      remarkPlugins={[remarkGfm]}
      rehypePlugins={[rehypeRaw]}
      urlTransform={urlTransform}
      components={{
        // Render mermaid code blocks as diagrams
        code({ node, inline, className: codeClass, children: codeChildren, ...props }) {
          const match = /language-mermaid/.test(codeClass || '');
          if (!inline && match) {
            const chart = String(codeChildren).replace(/\n$/, '');
            return <MermaidDiagram chart={chart} />;
          }
          // Regular code block
          return (
            <code className={codeClass} {...props}>
              {codeChildren}
            </code>
          );
        },
        // Styled tables
        table({ children: tableChildren }) {
          return (
            <div className="my-3 overflow-x-auto">
              <table className="w-full text-sm border-collapse border border-white/20 rounded">
                {tableChildren}
              </table>
            </div>
          );
        },
        th({ children: thChildren }) {
          return (
            <th className="px-3 py-2 text-left bg-white/10 border border-white/20 font-semibold">
              {thChildren}
            </th>
          );
        },
        td({ children: tdChildren }) {
          return (
            <td className="px-3 py-2 border border-white/20">
              {tdChildren}
            </td>
          );
        },
        // Images with proper sizing - resolve API paths
        img({ src, alt, ...props }) {
          // Images served from our backend API
          const resolvedSrc = src && src.startsWith('/slidev/')
            ? `/api${src}`
            : src;
          return (
            <img
              src={resolvedSrc}
              alt={alt || ''}
              className="max-w-full h-auto rounded-lg mx-auto my-3 shadow-lg"
              {...props}
            />
          );
        },
        // Blockquotes styled as callouts
        blockquote({ children: bqChildren }) {
          return (
            <blockquote className="my-3 pl-4 border-l-4 border-blue-400/60 bg-blue-900/20 py-2 pr-3 rounded-r">
              {bqChildren}
            </blockquote>
          );
        },
      }}
    >
      {children}
    </ReactMarkdown>
  );
}
