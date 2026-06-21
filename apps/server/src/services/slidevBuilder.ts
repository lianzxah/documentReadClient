import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { createDeepSeekChat } from './llm.js';
import { embedQuery } from './embeddings.js';
import { searchChunks } from './vectorStore.js';
import { captureKeyPages, screenshotApiPath, ScreenshotCaptureError } from './screenshot.js';
import { getDocument } from './pdfLoader.js';
import type { RetrievedChunk } from '../types.js';

interface SlidevBuildOptions {
  documentId: string;
  language?: 'zh' | 'en';
  slideCount?: number;
}

interface ScreenshotInfo {
  page: number;
  filename: string;
  markdownRef: string; // The markdown image reference to use in slides
}

/**
 * Retrieves document chunks for context building.
 */
async function retrieveDocumentContext(documentId: string, topK = 20): Promise<RetrievedChunk[]> {
  const vec = await embedQuery('summarize the main content, key points, conclusions, figures, and data');
  return searchChunks(documentId, vec, topK);
}

/**
 * Determines which pages contain key figures/diagrams worth screenshotting.
 * Uses the retrieved chunks to identify pages with highest relevance scores
 * and picks pages likely to contain figures based on text hints.
 */
function selectKeyPages(contexts: RetrievedChunk[], maxPages = 5): number[] {
  // Score pages by frequency and relevance
  const pageScores = new Map<number, number>();

  for (const ctx of contexts) {
    const current = pageScores.get(ctx.page) ?? 0;
    // Boost pages containing figure/table/chart indicators
    const hasVisual = /(?:figure|fig\.|table|chart|graph|diagram|图|表|数据)/i.test(ctx.text);
    pageScores.set(ctx.page, current + ctx.score + (hasVisual ? 0.5 : 0));
  }

  // Sort by score and take top pages
  return [...pageScores.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, maxPages)
    .map(([page]) => page)
    .sort((a, b) => a - b); // Return in page order
}

function buildContextBlock(contexts: RetrievedChunk[]): string {
  return contexts
    .map((c, i) => `[[${i + 1}]] (p.${c.page})\n${c.text}`)
    .join('\n\n---\n\n');
}

/**
 * Build the system prompt that instructs LLM to generate Slidev markdown
 * incorporating image references for captured screenshots.
 */
function buildSystemPrompt(
  contexts: RetrievedChunk[],
  screenshots: ScreenshotInfo[],
  language: string,
  slideCount: number,
): string {
  const langInstruction = language === 'zh'
    ? '请用中文输出所有幻灯片内容。'
    : 'Output all slide content in English.';

  const screenshotInstructions = screenshots.length > 0
    ? `\nAVAILABLE DOCUMENT IMAGES:\n` +
      `The following images have been captured from key pages of the document. ` +
      `Include them in appropriate slides using the exact markdown image syntax provided:\n` +
      screenshots.map((s) => `- Page ${s.page}: ${s.markdownRef}`).join('\n') +
      `\n\nIMPORTANT: Use these images in relevant slides to illustrate key points. ` +
      `Place each image on its own slide or alongside brief explanatory text. ` +
      `Do NOT modify the image paths.\n`
    : '';

  return (
    `You are a professional presentation designer. Based on the provided document content, generate a Slidev-format Markdown presentation.\n\n` +
    `CRITICAL OUTPUT FORMAT:\n` +
    `- Output RAW Slidev Markdown ONLY. Do NOT wrap the response in \`\`\`slidev, \`\`\`markdown, \`\`\`md, or any other code fence.\n` +
    `- The FIRST three characters of your response MUST be the three hyphens of the YAML frontmatter: ---\n` +
    `- Do NOT add any explanation, preface, or trailing commentary outside the Slidev Markdown.\n\n` +
    `REQUIREMENTS:\n` +
    `- Output valid Slidev Markdown format\n` +
    `- Use "---" (three hyphens on a separate line) as the slide separator\n` +
    `- First slide must have a YAML frontmatter block with theme and title\n` +
    `- Generate approximately ${slideCount} slides\n` +
    `- ${langInstruction}\n` +
    `- Structure: Title page → Overview/Outline → Key content slides (with images) → Data/Analysis → Summary/Conclusion\n` +
    `- Each slide should be concise and presentation-friendly\n` +
    `- Use bullet points, headings, and short paragraphs\n\n` +
    `VISUAL ENHANCEMENT REQUIREMENTS:\n` +
    `- Use Mermaid diagrams (\`\`\`mermaid code blocks) to visualize:\n` +
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
    `- Use emojis sparingly as visual indicators where appropriate (e.g., ✅ ❌ 📊 🔑)\n` +
    screenshotInstructions +
    `\nDOCUMENT CONTENT:\n${buildContextBlock(contexts)}`
  );
}

/**
 * The main Slidev builder generator. Orchestrates:
 * 1. Context retrieval from vector store
 * 2. Key page identification and screenshot capture via Puppeteer
 * 3. LLM generation of Slidev markdown incorporating screenshots
 *
 * Yields SSE-compatible events for streaming to the client.
 */
export async function* buildSlidevPresentation(params: SlidevBuildOptions) {
  const { documentId, language = 'zh', slideCount = 10 } = params;

  // Step 1: Retrieve document context
  yield { type: 'status' as const, message: 'Retrieving document content...' };
  const contexts = await retrieveDocumentContext(documentId);

  if (contexts.length === 0) {
    yield { type: 'error' as const, message: 'No document content found. Please ingest the document first.' };
    return;
  }

  // Step 2: Identify key pages and capture screenshots
  yield { type: 'status' as const, message: 'Capturing key page screenshots...' };
  const doc = await getDocument(documentId);
  let screenshots: ScreenshotInfo[] = [];

  if (doc?.cachePath) {
    const keyPages = selectKeyPages(contexts, 5);
    if (keyPages.length > 0) {
      try {
        const captured = await captureKeyPages(documentId, doc.cachePath, keyPages);

        screenshots = captured.map((cap) => ({
          page: cap.page,
          filename: cap.filename,
          markdownRef: `![Page ${cap.page}](${screenshotApiPath(documentId, cap.filename)})`,
        }));

        // Notify client about captured screenshots
        if (screenshots.length > 0) {
          yield {
            type: 'screenshots' as const,
            images: screenshots.map((s) => ({
              page: s.page,
              url: screenshotApiPath(documentId, s.filename),
            })),
          };
        }
      } catch (e: any) {
        // Capture failed for every requested page. Surface a warning to the
        // client/SSE stream so the UI and logs reflect the missing imagery
        // instead of the previous silent failure mode. Generation continues
        // without screenshots.
        const detail =
          e instanceof ScreenshotCaptureError
            ? `${e.message}`
            : `Screenshot capture failed: ${e?.message ?? String(e)}`;
        yield { type: 'warning' as const, message: detail };
      }
    }
  } else {
    yield {
      type: 'warning' as const,
      message: 'PDF cache not available for this document; skipping screenshot capture.',
    };
  }

  // Step 3: Generate Slidev markdown via LLM with screenshot references
  yield { type: 'status' as const, message: 'Generating presentation...' };

  const systemText = buildSystemPrompt(contexts, screenshots, language, slideCount);
  const userMessage = new HumanMessage(
    language === 'zh'
      ? '请根据以上文档内容和提供的图片，生成一份专业的演示文稿（Slidev Markdown 格式）。要求包含文档截图、Mermaid 图表来可视化关键流程和数据关系，使用表格展示重要数据和对比信息。'
      : 'Based on the document content and provided images above, generate a professional presentation in Slidev Markdown format. Include document screenshots, Mermaid diagrams to visualize key processes and data relationships, and use tables to present important data and comparisons.',
  );

  const llm = await createDeepSeekChat(
    { temperature: 0.4, streaming: true },
    { documentId },
  );
  const stream = await llm.stream([new SystemMessage(systemText), userMessage]);

  let fullMarkdown = '';
  for await (const chunk of stream) {
    const delta = typeof chunk.content === 'string' ? chunk.content : '';
    if (delta) {
      fullMarkdown += delta;
      yield { type: 'token' as const, delta };
    }
  }

  // Defensive post-processing: some LLMs wrap their output in a ```slidev /
  // ```markdown fence despite the prompt forbidding it. When that happens, the
  // opening fence becomes a blank "slide" in the preview (see analysis doc
  // `analysis/slidev-first-slide-blank.md`). Strip the wrapper before caching
  // and emitting `done` so downstream consumers (preview, download, cache)
  // always receive well-formed Slidev markdown.
  const sanitizedMarkdown = fullMarkdown
    .trim()
    .replace(/^```(?:slidev|markdown|md)?\s*\n/, '')
    .replace(/\n```\s*$/, '')
    .trim();

  yield { type: 'done' as const, markdown: sanitizedMarkdown };
}
