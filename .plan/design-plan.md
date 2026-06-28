# Document Reader - Design & Execution Plan

## 1. Requirements Summary

| Area | Requirement |
|------|-------------|
| Ingest | Open a PDF by URL from a tab bar; stream/fetch into the current view. |
| Render | In-browser PDF rendering with text layer for selection. |
| Translate | Selection-based translation, bi-directional ZH <-> EN, auto-detect. |
| Chat | LLM Q&A grounded on the currently opened document (RAG). |
| Layout | VSCode-like: ActivityBar / SideBar / EditorArea (tabs) / Panel / StatusBar. |
| Models | DeepSeek (chat + translate), Qwen `text-embedding-v3` (embeddings). |

## 2. Tech Stack

- Frontend (JS, not TS): Vite + React 18, ahooks, zustand, shadcn/ui, React Bits, `react-pdf` (pdfjs-dist), `react-resizable-panels`, `lucide-react`, `tailwindcss`.
- Backend (TS): Fastify 4, `@fastify/cors`, `@fastify/multipart`, LangGraph (`@langchain/langgraph`), `@langchain/core`, `@langchain/community`, `@lancedb/lancedb`, `pdf-parse` (server-side extraction), `zod`.
- Providers: DeepSeek via OpenAI-compatible SDK (`baseURL: https://api.deepseek.com`), Qwen embeddings via DashScope OpenAI-compatible endpoint.
- Tooling: pnpm workspace, eslint, prettier, tsx for dev, dotenv.

## 3. Repo Layout (pnpm monorepo)

```
document-reader/
  package.json                # workspace root
  pnpm-workspace.yaml
  .env.example
  apps/
    web/                      # React + Vite (JS)
      src/
        app/                  # routes, providers
        components/
          layout/             # ActivityBar, SideBar, EditorArea, Panel, StatusBar
          reader/             # PdfViewer, TabBar, SelectionPopover
          chat/               # ChatPanel, MessageList, Composer
          translate/          # TranslatePopover
          ui/                 # shadcn generated
        hooks/                # useSelection, useSSE, usePdfDoc
        store/                # zustand slices: tabs, chat, translate, settings
        lib/                  # api client, pdf utils
        styles/
      index.html
      vite.config.js
    server/                   # Fastify + LangGraph (TS)
      src/
        index.ts              # bootstrap
        config.ts             # env + zod schema
        routes/
          documents.ts        # POST /documents/ingest, GET /documents/:id
          translate.ts        # POST /translate (SSE)
          chat.ts             # POST /chat (SSE)
        services/
          pdfLoader.ts        # fetch URL + extract text + chunk
          embeddings.ts       # Qwen embeddings client
          vectorStore.ts      # LanceDB wrapper (table per doc)
          llm.ts              # DeepSeek client factory
        graphs/
          ragGraph.ts         # LangGraph: retrieve -> generate
          translateGraph.ts   # detect -> translate
        types.ts
      tsconfig.json
```

## 4. Frontend Design

### 4.1 Layout (VSCode-inspired)
- Grid: `ActivityBar (48px) | SideBar (resizable) | EditorArea | (Panel bottom) | StatusBar`.
- `react-resizable-panels` for horizontal/vertical splits.
- ActivityBar items: Explorer (open docs), Chat, Translate, Settings.

### 4.2 State (zustand slices)
- `tabsStore`: `{ tabs: [{id,url,title,documentId,page}], activeId, openTab(url), closeTab(id), setActive(id) }`.
- `chatStore`: per-doc `messages[]`, `streaming`, `abort()`.
- `translateStore`: `lastSelection`, `direction: 'auto'|'zh2en'|'en2zh'`, `result`, `loading`.
- `settingsStore`: endpoints, model names, theme.
- Persist tabs + settings with `zustand/middleware` (localStorage).

### 4.3 PDF Viewer
- `react-pdf` with `<Document><Page renderTextLayer/></Document>`.
- Expose text-layer selection to `useSelection` hook -> floating `SelectionPopover` with Translate / Ask buttons.

### 4.4 Translation UX
- On text selection, show popover anchored to selection rect.
- Buttons: Translate (auto-direction), Swap direction, Copy.
- Streams result via SSE from `/translate`.

### 4.5 Chat Panel
- Bottom panel or right side; scoped to active tab's `documentId`.
- Streaming tokens via SSE; renders markdown + citation chips `[p.12]` that scroll the PDF to that page.

### 4.6 API Client
- Thin `lib/api.js` using `fetch` with manual SSE parsing (ReadableStream).

## 5. Backend Design

### 5.1 HTTP Surface
- `POST /documents/ingest` body `{ url }` -> `{ documentId, pages, title }`. Idempotent on URL hash.
- `GET  /documents/:id/pdf` serves the cached PDF bytes (CORS-safe for viewer).
- `POST /translate` (SSE) body `{ text, direction: 'auto'|'zh2en'|'en2zh' }`.
- `POST /chat` (SSE) body `{ documentId, messages, topK? }`.
- `GET  /healthz`.

### 5.2 Ingestion Pipeline (`services/pdfLoader.ts`)
1. Fetch URL -> buffer (size cap, content-type guard, SSRF guard).
2. Extract text per page with `pdf-parse` (keep `{page, text}`).
3. Chunk with recursive splitter (`chunkSize=800`, `overlap=120`), tag with `{documentId, page}`.
4. Embed in batches (size 10) via Qwen `text-embedding-v3`.
5. Upsert into LanceDB table `doc_<id>` with columns `id, vector, text, page, documentId`.
6. Persist metadata in `.data/documents.json` (id, url, title, pageCount, createdAt).

### 5.3 LangGraph - RAG (`graphs/ragGraph.ts`)
Nodes: `retrieve (LanceDB topK=6) -> generate (DeepSeek, streamed) -> cite`.
State: `{ question, history, contexts, answer, citations }`. Emits token events to SSE.

### 5.4 LangGraph - Translate (`graphs/translateGraph.ts`)
Nodes: `detectLanguage -> chooseDirection -> translate (DeepSeek, low temp)`.
Prompt fixes glossary for academic prose; streams final text.

### 5.5 Storage Layout
```
.data/
  lancedb/                 # LanceDB files
  documents.json           # id -> metadata
  cache/                   # fetched PDFs by sha256(url)
```

### 5.6 Config (`.env`)
```
PORT=8787
DEEPSEEK_API_KEY=...
DEEPSEEK_MODEL=deepseek-chat
DASHSCOPE_API_KEY=...
QWEN_EMBED_MODEL=text-embedding-v3
LANCEDB_PATH=./.data/lancedb
MAX_PDF_MB=50
```

## 6. Key Data Contracts

```jsonc
// Chat SSE events
{ "type": "token", "delta": "..." }
{ "type": "citation", "page": 12, "score": 0.82 }
{ "type": "done" }

// Translate SSE
{ "type": "meta", "detected": "en", "direction": "en2zh" }
{ "type": "token", "delta": "..." }
{ "type": "done" }
```

## 7. Security / Limits
- URL allowlist scheme `http(s)`, deny private IP ranges (SSRF guard).
- PDF size cap (`MAX_PDF_MB`), timeout 30s on fetch.
- Sanitize markdown in chat output on the client.

## 8. Execution Plan (Tasks)

### Task 1 - Repo scaffold
- Init pnpm workspace, root `package.json`, `pnpm-workspace.yaml`, `.env.example`, `.gitignore`.
- `apps/web` Vite React template; add Tailwind, ahooks, zustand, react-pdf, react-resizable-panels, lucide-react.
- `apps/server` with Fastify, tsx dev script, tsconfig.

### Task 2 - Backend minimal boot
- `src/index.ts` wires CORS and routes. `config.ts` with zod-validated env. `GET /healthz`.

### Task 3 - Document ingestion
- Implement `pdfLoader.ts`, `embeddings.ts`, `vectorStore.ts`.
- Wire `POST /documents/ingest` and `GET /documents/:id/pdf` with on-disk cache.

### Task 4 - LangGraph graphs
- `translateGraph.ts`: detect + translate node, streaming.
- `ragGraph.ts`: retrieve -> generate with DeepSeek streaming.
- Wire `POST /translate` and `POST /chat` as SSE endpoints.

### Task 5 - Frontend shell
- Build VSCode layout with `react-resizable-panels`.
- shadcn components: `Button`, `Input`, `Tabs`, `Tooltip`, `ScrollArea`, `Dialog`.
- Implement `tabsStore` and URL-input dialog in SideBar.

### Task 6 - PDF viewer + tabs
- Integrate `react-pdf`; per-tab viewer with remembered page.
- Open-by-URL flow: `/documents/ingest` then render via `/documents/:id/pdf`.

### Task 7 - Selection translate
- `useSelection` hook captures text + bounding rect.
- `SelectionPopover` with Translate/Swap/Copy; consume `/translate` SSE.

### Task 8 - Chat panel with RAG
- Bottom/right `ChatPanel` scoped to active `documentId`.
- Streamed rendering; citation chips jump-to-page via viewer ref.

### Task 9 - Polish
- Persist tabs/settings; error toasts; loading skeletons; shortcuts.
- README with quickstart (`pnpm i`, set `.env`, `pnpm dev`).

### Task 10 - Smoke test
- E2E happy path: ingest PDF -> view -> select+translate -> ask question -> streamed answer with citation.

## 9. Open Items to Confirm Later
- Auth/multi-user: out of scope for v1.
- Re-ranker: add `bge-reranker` only if retrieval quality is insufficient.
- OCR for scanned PDFs: deferred; `pdf-parse` text-only for v1.
