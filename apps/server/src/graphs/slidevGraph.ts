import { StateGraph, Annotation, END, START } from '@langchain/langgraph';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { createDeepSeekChat } from '../services/llm.js';
import { embedQuery } from '../services/embeddings.js';
import { searchChunks } from '../services/vectorStore.js';
import type { RetrievedChunk } from '../types.js';

const State = Annotation.Root({
  documentId: Annotation<string>(),
  topK: Annotation<number>({ reducer: (_o, n) => n, default: () => 20 }),
  contexts: Annotation<RetrievedChunk[]>({
    reducer: (_o, n) => n,
    default: () => [],
  }),
});

const graph = new StateGraph(State)
  .addNode('retrieve', async (s) => {
    // Use a broad query to get comprehensive document coverage
    const vec = await embedQuery('summarize the main content, key points, and conclusions');
    const contexts = await searchChunks(s.documentId, vec, s.topK ?? 20);
    return { contexts };
  })
  .addEdge(START, 'retrieve')
  .addEdge('retrieve', END);

export const slidevGraph = graph.compile();

function buildContextBlock(contexts: RetrievedChunk[]): string {
  return contexts
    .map((c, i) => `[[${i + 1}]] (p.${c.page})\n${c.text}`)
    .join('\n\n---\n\n');
}

export async function* runSlidevGenerate(params: {
  documentId: string;
  language?: 'zh' | 'en';
  slideCount?: number;
}) {
  const language = params.language ?? 'zh';
  const slideCount = params.slideCount ?? 10;

  const state = await slidevGraph.invoke({
    documentId: params.documentId,
    topK: 20,
  });

  if (state.contexts.length === 0) {
    yield { type: 'error' as const, message: 'No document content found. Please ingest the document first.' };
    return;
  }

  const langInstruction = language === 'zh'
    ? '请用中文输出所有幻灯片内容。'
    : 'Output all slide content in English.';

  const systemText =
    `You are a professional presentation designer. Based on the provided document content, generate a Slidev-format Markdown presentation.\n\n` +
    `REQUIREMENTS:\n` +
    `- Output valid Slidev Markdown format\n` +
    `- Use "---" (three hyphens on a separate line) as the slide separator\n` +
    `- First slide must have a YAML frontmatter block with theme and title\n` +
    `- Generate approximately ${slideCount} slides\n` +
    `- ${langInstruction}\n` +
    `- Structure: Title page → Overview/Outline → Key content slides → Summary/Conclusion\n` +
    `- Each slide should be concise and presentation-friendly\n` +
    `- Use bullet points, headings, and short paragraphs\n` +
    `- Do NOT add any explanation outside the Slidev Markdown\n` +
    `- Do NOT wrap the output in code blocks\n\n` +
    `VISUAL ENHANCEMENT REQUIREMENTS:\n` +
    `- Use Mermaid diagrams (with \`\`\`mermaid code blocks) to visualize:\n` +
    `  - Processes and workflows (flowchart TD/LR)\n` +
    `  - System architectures (graph TD)\n` +
    `  - Timelines and sequences (sequenceDiagram)\n` +
    `  - Data relationships (erDiagram or classDiagram)\n` +
    `  - Proportions and comparisons (pie chart)\n` +
    `- Use Markdown tables to display structured data, comparisons, and key metrics\n` +
    `- Use blockquotes (>) for highlighting key insights or conclusions\n` +
    `- Aim for at least 2-3 slides with Mermaid diagrams\n` +
    `- Aim for at least 1-2 slides with data tables\n` +
    `- Keep Mermaid diagrams simple and readable (no styling/classDef)\n` +
    `- Use emojis sparingly as visual indicators where appropriate (e.g., ✅ ❌ 📊 🔑)\n\n` +
    `DOCUMENT CONTENT:\n${buildContextBlock(state.contexts)}`;

  const user = new HumanMessage(
    language === 'zh'
      ? '请根据以上文档内容，生成一份专业的演示文稿（Slidev Markdown 格式）。要求包含 Mermaid 图表来可视化关键流程和数据关系，使用表格展示重要数据和对比信息。'
      : 'Based on the document content above, generate a professional presentation in Slidev Markdown format. Include Mermaid diagrams to visualize key processes and data relationships, and use tables to present important data and comparisons.',
  );

  const llm = await createDeepSeekChat({ temperature: 0.4, streaming: true });
  const stream = await llm.stream([new SystemMessage(systemText), user]);

  let fullMarkdown = '';
  for await (const chunk of stream) {
    const delta = typeof chunk.content === 'string' ? chunk.content : '';
    if (delta) {
      fullMarkdown += delta;
      yield { type: 'token' as const, delta };
    }
  }

  yield { type: 'done' as const, markdown: fullMarkdown };
}
