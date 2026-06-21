/**
 * Thin API client for the backend.
 * POST /api/... endpoints that stream SSE are consumed with `streamSSE`.
 */

// In Electron, the preload script injects the absolute backend URL (or empty
// string when served from the same origin). In browser mode, fall back to '/api'.
const API_BASE =
  typeof window.__ELECTRON_API_BASE__ === 'string'
    ? window.__ELECTRON_API_BASE__
    : '/api'

export async function ingestDocument(url) {
  const res = await fetch(`${API_BASE}/documents/ingest`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error?.message || err.error || `HTTP ${res.status}`)
  }
  return res.json()
}

export function pdfUrl(documentId) {
  return `${API_BASE}/documents/${documentId}/pdf`
}

/**
 * Streaming download URL for the cached PDF. The backend appends
 * Content-Disposition: attachment and Content-Length, so browsers save
 * the response directly (with progress) instead of rendering inline.
 */
export function pdfDownloadUrl(documentId) {
  return `${API_BASE}/documents/${documentId}/pdf?download=1`
}

export function slidevDownloadUrl(documentId) {
  return `${API_BASE}/slidev/${documentId}/download`
}

export async function getSlidevStatus(documentId) {
  const res = await fetch(`${API_BASE}/slidev/${documentId}`)
  if (!res.ok) return { exists: false }
  return res.json()
}

/**
 * Persist user-edited Slidev markdown. Used by the in-app editor's debounced
 * auto-save and the explicit Save button (Ctrl+S).
 */
export async function saveSlidevMarkdown(documentId, markdown) {
  const res = await fetch(`${API_BASE}/slidev/${documentId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ markdown }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error?.message || err.error || `HTTP ${res.status}`)
  }
  return res.json()
}

/**
 * List every ingested document (lesson-4 satellite info included).
 * Used by the Explorer side bar to surface previously closed documents.
 */
export async function listDocuments() {
  const res = await fetch(`${API_BASE}/documents`)
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error?.message || err.error || `HTTP ${res.status}`)
  }
  return res.json()
}

export async function deleteDocument(documentId) {
  const res = await fetch(`${API_BASE}/documents/${documentId}`, {
    method: 'DELETE',
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error?.message || err.error || `HTTP ${res.status}`)
  }
  return res.json()
}

/**
 * Lesson 8: stream-upload a local PDF file. Uses XHR because fetch lacks
 * upload progress events. Resolves with the same shape that
 * `GET /documents` items use (documentId/title/pages/source/indexed/...).
 */
export function uploadLocalDocument(file, { onProgress, signal } = {}) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    const fd = new FormData()
    fd.append('file', file, file.name)

    xhr.open('POST', `${API_BASE}/documents/upload`)
    xhr.responseType = 'json'

    xhr.upload.onprogress = (evt) => {
      if (!onProgress) return
      if (evt.lengthComputable) {
        onProgress({
          loaded: evt.loaded,
          total: evt.total,
          percent: Math.min(100, Math.round((evt.loaded / evt.total) * 100)),
        })
      } else {
        onProgress({ loaded: evt.loaded, total: 0, percent: 0 })
      }
    }

    xhr.onload = () => {
      const payload = xhr.response ?? {}
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(payload)
      } else {
        const message =
          payload?.error?.message || payload?.error || `HTTP ${xhr.status}`
        const err = new Error(message)
        err.status = xhr.status
        reject(err)
      }
    }
    xhr.onerror = () => reject(new Error('Network error during upload'))
    xhr.onabort = () => reject(new Error('Upload aborted'))

    if (signal) {
      if (signal.aborted) {
        xhr.abort()
        return
      }
      signal.addEventListener('abort', () => xhr.abort(), { once: true })
    }

    xhr.send(fd)
  })
}

/**
 * Kick off lazy RAG indexing for an already-uploaded local PDF.
 * Returns immediately with `{ ok: true }` (HTTP 202); poll
 * `getDocumentIndexStatus` to track progress.
 */
export async function startDocumentIndexing(documentId) {
  const res = await fetch(
    `${API_BASE}/documents/${encodeURIComponent(documentId)}/index`,
    { method: 'POST' },
  )
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error?.message || err.error || `HTTP ${res.status}`)
  }
  return res.json()
}

export async function getDocumentIndexStatus(documentId) {
  const res = await fetch(
    `${API_BASE}/documents/${encodeURIComponent(documentId)}/index/status`,
  )
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error?.message || err.error || `HTTP ${res.status}`)
  }
  return res.json()
}

/**
 * Lesson 8 (revision): browse the server filesystem for a third import
 * method. Without `path`, returns curated root suggestions ($HOME, /,
 * /workspace, /tmp). With `path`, lists folders + `.pdf` files in that
 * directory.
 */
export async function browseFilesystem(dirPath) {
  const url = new URL(`${API_BASE}/filesystem/browse`, window.location.origin)
  if (dirPath) url.searchParams.set('path', dirPath)
  const res = await fetch(url.pathname + url.search)
  const payload = await res.json().catch(() => ({}))
  if (!res.ok) {
    const message =
      payload?.error?.message || payload?.error || `HTTP ${res.status}`
    const err = new Error(message)
    err.status = res.status
    throw err
  }
  return payload
}

/**
 * Import a PDF that already lives on the server filesystem. Streams a
 * server-side copy into cache/<sha>.pdf and registers a `source: 'local'`
 * document.
 */
export async function importLocalFile(absolutePath) {
  const res = await fetch(`${API_BASE}/documents/import-local`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path: absolutePath }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error?.message || err.error || `HTTP ${res.status}`)
  }
  return res.json()
}

/* ------------------------- Chat sessions ------------------------- */

export async function listSessions(documentId) {
  const res = await fetch(
    `${API_BASE}/sessions?documentId=${encodeURIComponent(documentId)}`,
  )
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error?.message || err.error || `HTTP ${res.status}`)
  }
  return res.json()
}

export async function createSession(documentId, title) {
  const res = await fetch(`${API_BASE}/sessions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ documentId, ...(title ? { title } : {}) }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error?.message || err.error || `HTTP ${res.status}`)
  }
  return res.json()
}

export async function getSession(sessionId) {
  const res = await fetch(`${API_BASE}/sessions/${sessionId}`)
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error?.message || err.error || `HTTP ${res.status}`)
  }
  return res.json()
}

export async function renameSession(sessionId, title) {
  const res = await fetch(`${API_BASE}/sessions/${sessionId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error?.message || err.error || `HTTP ${res.status}`)
  }
  return res.json()
}

/**
 * Generalised session patch. Accepts `{ title?, skillId? }`. Server validates
 * that at least one field is present.
 */
export async function updateSession(sessionId, patch) {
  const res = await fetch(`${API_BASE}/sessions/${sessionId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error?.message || err.error || `HTTP ${res.status}`)
  }
  return res.json()
}

export async function deleteSession(sessionId) {
  const res = await fetch(`${API_BASE}/sessions/${sessionId}`, {
    method: 'DELETE',
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error?.message || err.error || `HTTP ${res.status}`)
  }
  return res.json()
}

export async function clearSessionMessages(sessionId) {
  const res = await fetch(`${API_BASE}/sessions/${sessionId}/messages`, {
    method: 'DELETE',
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error?.message || err.error || `HTTP ${res.status}`)
  }
  return res.json()
}

/* ------------------------- Per-doc model overrides ------------------------- */

export async function getDocumentOverrides(documentId) {
  const res = await fetch(`${API_BASE}/documents/${documentId}/overrides`)
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error?.message || err.error || `HTTP ${res.status}`)
  }
  return res.json()
}

export async function setDocumentOverrides(documentId, patch) {
  const res = await fetch(`${API_BASE}/documents/${documentId}/overrides`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error?.message || err.error || `HTTP ${res.status}`)
  }
  return res.json()
}

/**
 * Settings: GET returns `{ settings, presets }` where settings is the
 * masked-key shape `{ chat: { baseURL, model, hasKey, keyPreview }, embedding: ... }`.
 * Raw API keys never leave the server.
 */
export async function getSettings() {
  const res = await fetch(`${API_BASE}/settings`)
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error?.message || err.error || `HTTP ${res.status}`)
  }
  return res.json()
}

/**
 * Persist a settings patch. `apiKey` semantics:
 *   - omitted / undefined / ''  -> keep existing key
 *   - null                      -> clear the key
 *   - non-empty string          -> replace
 */
export async function saveSettings(patch) {
  const res = await fetch(`${API_BASE}/settings`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error?.message || err.error || `HTTP ${res.status}`)
  }
  return res.json()
}

/**
 * Probe a draft (or saved) provider config against the actual provider.
 * Returns `{ ok, latencyMs }` on success, `{ ok: false, error }` otherwise.
 */
export async function testSettings(kind, draft) {
  const res = await fetch(`${API_BASE}/settings/test`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ kind, draft }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error?.message || err.error || `HTTP ${res.status}`)
  }
  return res.json()
}

/**
 * Parses SSE `data: {...}\n\n` frames from a POST response. Calls `onEvent`
 * for each JSON payload. Returns when the stream closes or is aborted.
 */
export async function streamSSE(path, body, onEvent, signal) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  })
  if (!res.ok || !res.body) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error?.message || err.error || `HTTP ${res.status}`)
  }
  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    let idx
    while ((idx = buffer.indexOf('\n\n')) !== -1) {
      const frame = buffer.slice(0, idx)
      buffer = buffer.slice(idx + 2)
      for (const line of frame.split('\n')) {
        const m = line.match(/^data:\s?(.*)$/)
        if (!m) continue
        const raw = m[1]
        if (!raw) continue
        try {
          onEvent(JSON.parse(raw))
        } catch {
          // Ignore non-JSON keep-alive comments.
        }
      }
    }
  }
}

/* ------------------------- Skills ------------------------- */

export async function listSkills() {
  const res = await fetch(`${API_BASE}/skills`)
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error?.message || err.error || `HTTP ${res.status}`)
  }
  return res.json()
}

export async function getSkill(id) {
  const res = await fetch(`${API_BASE}/skills/${encodeURIComponent(id)}`)
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error?.message || err.error || `HTTP ${res.status}`)
  }
  return res.json()
}

export async function createSkill(body) {
  const res = await fetch(`${API_BASE}/skills`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error?.message || err.error || `HTTP ${res.status}`)
  }
  return res.json()
}

export async function updateSkill(id, patch) {
  const res = await fetch(`${API_BASE}/skills/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error?.message || err.error || `HTTP ${res.status}`)
  }
  return res.json()
}

export async function deleteSkill(id) {
  const res = await fetch(`${API_BASE}/skills/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error?.message || err.error || `HTTP ${res.status}`)
  }
  return res.json()
}

/**
 * Upload a .zip skill package; the backend unpacks the markdown bodies and
 * asks the LLM to propose a Skill schema. Returns `{ draft, sourceName }`.
 * The draft is NOT persisted server-side — the caller still has to POST it
 * through `createSkill()` after the user reviews/edits in the editor.
 */
export async function importSkillPackage(file) {
  const fd = new FormData()
  fd.append('file', file, file.name)
  // Do NOT set Content-Type manually — the browser must add the multipart
  // boundary parameter. Setting it explicitly breaks multipart parsing.
  const res = await fetch(`${API_BASE}/skills/import`, {
    method: 'POST',
    body: fd,
  })
  const payload = await res.json().catch(() => ({}))
  if (!res.ok) {
    const message =
      payload.error?.message || payload.error || `HTTP ${res.status}`
    const err = new Error(message)
    err.status = res.status
    err.raw = payload.raw
    err.details = payload.details
    throw err
  }
  return payload
}

/* ------------------------- MCP Servers ------------------------- */

export async function listMcpServers() {
  const res = await fetch(`${API_BASE}/mcp/servers`)
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error?.message || err.error || `HTTP ${res.status}`)
  }
  return res.json()
}

export async function createMcpServer(body) {
  const res = await fetch(`${API_BASE}/mcp/servers`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error?.message || err.error || `HTTP ${res.status}`)
  }
  return res.json()
}

export async function updateMcpServer(id, patch) {
  const res = await fetch(`${API_BASE}/mcp/servers/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error?.message || err.error || `HTTP ${res.status}`)
  }
  return res.json()
}

export async function deleteMcpServer(id) {
  const res = await fetch(`${API_BASE}/mcp/servers/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error?.message || err.error || `HTTP ${res.status}`)
  }
  return res.json()
}

export async function testMcpServer(id) {
  const res = await fetch(
    `${API_BASE}/mcp/servers/${encodeURIComponent(id)}/test`,
    {
      method: 'POST',
    },
  )
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error?.message || err.error || `HTTP ${res.status}`)
  }
  return res.json()
}

export async function listMcpTools() {
  const res = await fetch(`${API_BASE}/mcp/tools`)
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error?.message || err.error || `HTTP ${res.status}`)
  }
  return res.json()
}
