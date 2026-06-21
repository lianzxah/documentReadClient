import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown, ChevronRight, CheckCircle2, Loader2, Wrench } from 'lucide-react';
import { cn } from '../../lib/cn.js';

/**
 * Renders a tool-call card inside the assistant message stream.
 * Two states:
 *   - In-progress: spinning loader + tool name
 *   - Complete: green check + tool name + latency + expandable result
 */
export function ToolCallBadge({ toolCall }) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);

  const { toolName, status, result, latencyMs } = toolCall;
  const isRunning = status === 'running';

  return (
    <div className="not-prose my-2 border border-vs-border rounded-md overflow-hidden bg-[#1e1e1e]">
      <button
        onClick={() => !isRunning && setExpanded((v) => !v)}
        className={cn(
          'w-full text-left px-3 py-2 flex items-center gap-2 text-xs',
          !isRunning && 'hover:bg-[#2a2d2e] cursor-pointer',
          isRunning && 'cursor-default',
        )}
      >
        {isRunning ? (
          <Loader2 size={12} className="animate-spin text-vs-accent shrink-0" />
        ) : (
          <CheckCircle2 size={12} className="text-green-400 shrink-0" />
        )}
        <Wrench size={11} className="shrink-0 text-vs-muted" />
        <span className="font-mono truncate">{toolName}</span>
        {!isRunning && latencyMs != null && (
          <span className="text-vs-muted ml-auto shrink-0">{latencyMs}ms</span>
        )}
        {!isRunning && (
          expanded ? <ChevronDown size={12} className="shrink-0" /> : <ChevronRight size={12} className="shrink-0" />
        )}
      </button>
      {expanded && result && (
        <div className="border-t border-vs-border px-3 py-2 max-h-40 overflow-y-auto">
          <pre className="text-[11px] text-vs-fg whitespace-pre-wrap break-words font-mono">
            {result}
          </pre>
        </div>
      )}
    </div>
  );
}

/**
 * Renders a list of tool calls grouped for a single assistant turn.
 */
export function ToolCallList({ toolCalls }) {
  if (!toolCalls || toolCalls.length === 0) return null;
  return (
    <div className="space-y-1">
      {toolCalls.map((tc, i) => (
        <ToolCallBadge key={`${tc.toolName}-${i}`} toolCall={tc} />
      ))}
    </div>
  );
}
