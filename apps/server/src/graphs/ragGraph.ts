import { StateGraph, Annotation, END, START } from '@langchain/langgraph';
import {
  AIMessage,
  HumanMessage,
  SystemMessage,
  ToolMessage,
} from '@langchain/core/messages';
import type { BaseMessage } from '@langchain/core/messages';
import { createDeepSeekChat } from '../services/llm.js';
import { embedQuery } from '../services/embeddings.js';
import { searchChunks } from '../services/vectorStore.js';
import {
  BASE_RAG_INSTRUCTIONS,
  getComposedSkills,
  getEffectiveSkill,
} from '../services/skillRegistry.js';
import {
  getAvailableTools,
  toolsToOpenAIFormat,
  parseToolCallName,
  callTool,
} from '../services/mcpClient.js';
import type { ChatMessage, RetrievedChunk } from '../types.js';

const State = Annotation.Root({
  documentId: Annotation<string>(),
  question: Annotation<string>(),
  history: Annotation<ChatMessage[]>({
    reducer: (_old, next) => next,
    default: () => [],
  }),
  topK: Annotation<number>({ reducer: (_o, n) => n, default: () => 8 }),
  contexts: Annotation<RetrievedChunk[]>({
    reducer: (_o, n) => n,
    default: () => [],
  }),
});

const graph = new StateGraph(State)
  .addNode('retrieve', async (s) => {
    const vec = await embedQuery(s.question);
    const contexts = await searchChunks(s.documentId, vec, s.topK ?? 8);
    return { contexts };
  })
  .addEdge(START, 'retrieve')
  .addEdge('retrieve', END);

export const ragGraph = graph.compile();

function buildContextBlock(contexts: RetrievedChunk[]): string {
  return contexts
    .map((c, i) => `[[${i + 1}]] (p.${c.page})\n${c.text}`)
    .join('\n\n---\n\n');
}

/**
 * Sliding window over the persisted transcript. We include both user and
 * assistant turns (assistants used to be elided, which broke "explain in more
 * detail" follow-ups). Cap the window to keep the prompt bounded.
 */
const HISTORY_WINDOW = 8;

function recentHistory(messages: ChatMessage[]): ChatMessage[] {
  // Drop the trailing user message — it's re-issued separately as `question`.
  const withoutLast = messages.slice(0, -1);
  return withoutLast.slice(-HISTORY_WINDOW);
}

export async function* runChat(params: {
  documentId: string;
  messages: ChatMessage[];
  topK?: number;
  skillId?: string;
  auxiliarySkillIds?: string[];
}) {
  const lastUser = [...params.messages].reverse().find((m) => m.role === 'user');
  if (!lastUser) throw new Error('No user message');

  const { primary, auxiliaries } = await getComposedSkills(
    params.skillId,
    params.auxiliarySkillIds,
  );
  const effectiveTopK = params.topK ?? primary.topK ?? 8;

  const state = await ragGraph.invoke({
    documentId: params.documentId,
    question: lastUser.content,
    history: params.messages,
    topK: effectiveTopK,
  });

  // Tell the UI which skill produced this answer so the assistant message can
  // render an "answered with: <name>" badge.
  yield {
    type: 'skill' as const,
    id: primary.id,
    name: primary.name,
    builtin: primary.builtin,
    auxiliaries: auxiliaries.map((a) => ({ id: a.id, name: a.name })),
  };

  // Emit citation chips up-front so the UI can render jump links eagerly.
  for (const ctx of state.contexts) {
    yield {
      type: 'citation' as const,
      page: ctx.page,
      score: ctx.score,
      snippet: ctx.text.slice(0, 160),
    };
  }

  // Build system prompt: BASE + primary + auxiliaries (supplementary) + CONTEXT
  let systemText =
    `${BASE_RAG_INSTRUCTIONS}\n\n` +
    `${primary.systemPrompt}\n\n`;

  if (auxiliaries.length > 0) {
    systemText += `---\nSUPPLEMENTARY INSTRUCTIONS:\n`;
    for (const aux of auxiliaries) {
      systemText += `\n[${aux.name}]\n${aux.systemPrompt}\n`;
    }
    systemText += `\n---\n\n`;
  }

  systemText += `CONTEXT:\n${buildContextBlock(state.contexts)}`;

  const lcMessages: BaseMessage[] = [
    new SystemMessage(systemText),
  ];
  for (const m of recentHistory(params.messages)) {
    if (m.role === 'user') lcMessages.push(new HumanMessage(m.content));
    else if (m.role === 'assistant') lcMessages.push(new AIMessage(m.content));
  }
  // The current user turn (the question we already retrieved against).
  lcMessages.push(new HumanMessage(lastUser.content));

  const llm = await createDeepSeekChat(
    {
      temperature: primary.temperature ?? 0.4,
      streaming: true,
      maxTokens: primary.maxTokens ?? 1500,
    },
    { documentId: params.documentId },
  );

  // --- Agent loop with MCP tool calling ---
  const mcpTools = toolsToOpenAIFormat();
  const hasMcpTools = mcpTools.length > 0;
  const MAX_TOOL_ROUNDS = 5;

  if (hasMcpTools) {
    // Non-streaming agent loop when tools are available
    const boundLlm = llm.bindTools(mcpTools);
    let rounds = 0;

    while (rounds < MAX_TOOL_ROUNDS) {
      rounds++;
      const response = await boundLlm.invoke(lcMessages);
      lcMessages.push(response);

      // Check for tool calls
      const toolCalls = response.tool_calls ?? [];
      if (toolCalls.length === 0) {
        // No tool calls — emit text as tokens
        const text = typeof response.content === 'string' ? response.content : '';
        if (text) yield { type: 'token' as const, delta: text };
        break;
      }

      // Execute each tool call
      for (const tc of toolCalls) {
        const parsed = parseToolCallName(tc.name);
        if (!parsed) {
          lcMessages.push(
            new ToolMessage({
              tool_call_id: tc.id ?? tc.name,
              content: `Error: unknown tool ${tc.name}`,
            }),
          );
          continue;
        }

        yield {
          type: 'tool_start' as const,
          toolName: parsed.toolName,
          serverId: parsed.serverId,
          args: tc.args,
        };

        const t0 = Date.now();
        let result: string;
        try {
          const raw = await callTool(parsed.serverId, parsed.toolName, tc.args ?? {});
          result = typeof raw === 'string' ? raw : JSON.stringify(raw, null, 2);
        } catch (e: any) {
          result = `Error: ${e?.message ?? 'tool call failed'}`;
        }

        yield {
          type: 'tool_result' as const,
          toolName: parsed.toolName,
          result,
          latencyMs: Date.now() - t0,
        };

        lcMessages.push(
          new ToolMessage({
            tool_call_id: tc.id ?? tc.name,
            content: result,
          }),
        );
      }
    }
  } else {
    // No MCP tools — pure streaming response (original path)
    const stream = await llm.stream(lcMessages);
    for await (const chunk of stream) {
      const delta = typeof chunk.content === 'string' ? chunk.content : '';
      if (delta) yield { type: 'token' as const, delta };
    }
  }

  yield { type: 'done' as const };
}
