import { useEffect, useRef, useState } from 'react';
import { useDebounce } from 'ahooks';
import mermaid from 'mermaid';

mermaid.initialize({
  startOnLoad: false,
  theme: 'dark',
  themeVariables: {
    darkMode: true,
    background: '#1e1e2e',
    primaryColor: '#89b4fa',
    primaryTextColor: '#cdd6f4',
    primaryBorderColor: '#585b70',
    lineColor: '#a6adc8',
    secondaryColor: '#45475a',
    tertiaryColor: '#313244',
  },
  fontFamily: 'ui-sans-serif, system-ui, sans-serif',
  fontSize: 14,
});

let mermaidId = 0;

/**
 * Renders a Mermaid diagram from a code string. The chart prop is debounced
 * (400ms) so the editor's keystroke storm doesn't trigger continuous renders -
 * each render is a synchronous SVG generation that can stall the main thread.
 */
export function MermaidDiagram({ chart }) {
  const containerRef = useRef(null);
  const [svg, setSvg] = useState('');
  const [error, setError] = useState(null);
  const idRef = useRef(`mermaid-${++mermaidId}`);
  const debouncedChart = useDebounce(chart, { wait: 400 });

  useEffect(() => {
    if (!debouncedChart || !containerRef.current) return;

    let cancelled = false;

    async function render() {
      try {
        const { svg: rendered } = await mermaid.render(
          idRef.current,
          debouncedChart.trim(),
        );
        if (!cancelled) {
          setSvg(rendered);
          setError(null);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e?.message || 'Failed to render diagram');
          setSvg('');
        }
        // Clean up any leftover mermaid error elements
        const errEl = document.getElementById('d' + idRef.current);
        if (errEl) errEl.remove();
      }
    }

    render();
    return () => { cancelled = true; };
  }, [debouncedChart]);

  if (error) {
    return (
      <div className="my-3 p-3 bg-red-900/20 border border-red-800/50 rounded text-xs text-red-300 font-mono whitespace-pre-wrap">
        {chart}
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="my-3 flex justify-center [&>svg]:max-w-full"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
