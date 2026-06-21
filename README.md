<p align="center">
  <img src="./logo.svg" width="160" alt="Document Reader & AI Slide Studio Logo" />
</p>

<h1 align="center">Document Reader & AI Slide Studio</h1>

<p align="center">
  A powerful, VSCode-style web workspace for intelligent document analysis, real-time translation, and automated presentation generation.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Frontend-React%20%7C%20Vite-blue" alt="Frontend" />
  <img src="https://img.shields.io/badge/State-Zustand-orange" alt="Zustand" />
  <img src="https://img.shields.io/badge/Backend-Fastify%20%7C%20LangGraph-green" alt="Backend" />
  <img src="https://img.shields.io/badge/Database-LanceDB-red" alt="LanceDB" />
  <img src="https://img.shields.io/badge/AI-DeepSeek%20%7C%20Qwen-purple" alt="AI Models" />
</p>

---

## ✨ Features

- **📖 Intelligent PDF Reader**: Native, highly performant PDF rendering built with `react-pdf` in a clean, distraction-free IDE-like interface.
- **🌐 In-Context Translation**: Highlight text in the document for instant ZH/EN translation, maintaining the flow of your reading.
- **🤖 Grounded Q&A (RAG)**: Chat directly with your documents. Powered by **LangGraph** and **LanceDB** (Qwen embeddings, DeepSeek LLM), the AI uses deep semantic search to provide accurate, context-grounded answers.
- **✨ AI to Presentation (Slidev)**: Automatically extract key insights from your document and generate presentation outlines in Slidev Markdown format.
- **🎨 Visual PPTX Editor**: A built-in, drag-and-drop presentation editor inspired by _PPTist_. Features include:
  - Pixel-perfect visual editing with `react-rnd`.
  - Drag, drop, resize, and rotate text, images, and shapes.
  - Multi-layer management (Z-index ordering).
  - Export directly to highly compatible, offline `.pptx` files using `PptxGenJS`.

---

## 🚀 Quickstart

1. **Install Dependencies**

   ```bash
   pnpm install
   ```

2. **Environment Configuration**
   Copy the example environment file and fill in your API keys:

   ```bash
   cp .env.example .env
   # Add your DEEPSEEK_API_KEY and DASHSCOPE_API_KEY to the .env file
   ```

3. **Run the Application**
   Start both the frontend and backend simultaneously:

   ```bash
   pnpm dev
   ```

   _The Web app runs on port `5173`, and the Server runs on `8787`._

4. **Usage**
   - Open [http://localhost:5173](http://localhost:5173) in your browser.
   - Click **"Open PDF"** in the sidebar, paste a PDF URL (e.g., an arXiv `.pdf` link).
   - Select text to translate, or open the **Chat** panel to ask questions.
   - Click the **Slidev icon** to generate a presentation, then hit **Visual Edit** to fine-tune it in the built-in PPTX editor before downloading!

---

## 🛠 Tech Stack

### Frontend

- **Framework**: React 18 + Vite
- **UI & Layout**: TailwindCSS, shadcn/ui, `react-resizable-panels`
- **State Management**: Zustand
- **Interactions**: ahooks, `react-rnd`
- **Document & Slides**: `react-pdf`, ByteMD, `PptxGenJS`

### Backend

- **Framework**: Fastify
- **AI Agent Orchestration**: LangGraph
- **Vector Database**: LanceDB
- **LLM Integrations**: DeepSeek LLM (Text), Qwen (Embeddings)

---

## 📜 Scripts

- `pnpm dev` - Start both web and server in parallel.
- `pnpm dev:web` - Start only the frontend web application.
- `pnpm dev:server` - Start only the backend server.
- `pnpm build` - Build both frontend and backend for production.
- `pnpm start` - Run the built server.

---

## ⌨️ Shortcuts

- `Ctrl+T` / `Cmd+T` — Open URL dialog
- `Ctrl+W` / `Cmd+W` — Close current tab
- `Ctrl+J` / `Cmd+J` — Toggle bottom panel
- `Ctrl+S` / `Cmd+S` — Save presentation / markdown

---

## 📐 Architecture & Design

See our detailed design document for more information on the project's layout and system architecture:
👉 [.plan/design-plan.md](./.plan/design-plan.md)
