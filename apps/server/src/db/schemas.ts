/**
 * NeDB collection types. Lesson 4 introduces an additive persistence layer for
 * entities the JSON-file storage doesn't cover:
 *  - chat sessions + messages (Trae-style multi-session per document)
 *  - per-document model overrides
 *  - Slidev material metadata (markdown content stays on disk)
 */

export type ChatRole = 'user' | 'assistant' | 'system';

export interface ChatSession {
  _id: string;
  documentId: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messageCount: number;
  /**
   * Skill that drives system prompt + retrieval/output knobs. Optional so
   * pre-existing rows are valid; runtime resolution falls back to
   * DEFAULT_SKILL_ID when missing.
   */
  skillId?: string;
  /**
   * Auxiliary (supplementary) skill IDs. Only custom user skills are allowed
   * here. Their systemPrompts are appended as supplementary instructions
   * after the primary skill's prompt. The primary skill still drives output
   * format and generation parameters.
   */
  auxiliarySkillIds?: string[];
}

export interface UserSkill {
  _id: string;
  name: string;
  description: string;
  systemPrompt: string;
  temperature?: number;
  topK?: number;
  maxTokens?: number;
  createdAt: number;
  updatedAt: number;
}

export interface ChatCitation {
  page: number;
  score: number;
  snippet: string;
}

export interface ChatMessageRow {
  _id: string;
  sessionId: string;
  documentId: string;
  role: ChatRole;
  content: string;
  citations?: ChatCitation[];
  seq: number;
  createdAt: number;
}

export interface SlidevMaterial {
  _id: string;
  documentId: string;
  title: string;
  language: 'zh' | 'en';
  slideCount: number;
  filePath: string; // relative to SLIDEV_DIR, e.g. `${documentId}.md`
  lastGenerationParams?: {
    language: 'zh' | 'en';
    slideCount?: number;
  };
  createdAt: number;
  updatedAt: number;
}

export interface DocumentOverride {
  _id: string;
  documentId: string;
  chat?: { model?: string };
  embedding?: { model?: string };
  updatedAt: number;
}

/**
 * MCP (Model Context Protocol) server configuration. Each entry represents a
 * remote or local MCP server that the application can connect to in order to
 * expose its tools to the chat LLM agent loop.
 */
export interface McpServerConfig {
  _id: string;
  /** Human-readable display name. */
  name: string;
  /** Transport mode: stdio spawns a child process, sse connects over HTTP. */
  transport: 'stdio' | 'sse';
  // -- stdio mode --
  command?: string;        // e.g. "npx"
  args?: string[];         // e.g. ["-y", "@mcp/weather"]
  // -- sse mode --
  url?: string;            // e.g. "http://localhost:3001/sse"
  // -- common --
  enabled: boolean;
  /** Environment variables injected into the stdio child process. */
  env?: Record<string, string>;
  createdAt: number;
  updatedAt: number;
}
