# syntax=docker/dockerfile:1.6
# ============================================================================
# apps/server — Fastify + LangGraph backend with Puppeteer-driven Slidev
# screenshot capture.
#
# Build context MUST be the monorepo root:
#
#   docker build -f apps/server/Dockerfile -t aimicroapp-server .
#
# Runtime notes:
#   - Uses Debian slim (node:20-bookworm-slim). Native deps such as
#     `@lancedb/lancedb` ship prebuilt binaries for glibc, so Alpine / musl
#     is NOT compatible.
#   - Puppeteer downloads its bundled Chrome during `pnpm install` into
#     apps/server/.puppeteer-cache (see apps/server/.puppeteerrc.cjs). We
#     copy that cache into the runtime image so `puppeteer.launch()` works
#     without the user shelling into the container.
#   - Persistent state (LanceDB, NeDB, screenshots, slidev cache) lives in
#     /app/apps/server/.data and should be mounted as a volume in compose.
# ============================================================================

ARG NODE_VERSION=20

# ---------- Stage 1: install workspace deps ---------------------------------
FROM node:${NODE_VERSION}-bookworm-slim AS deps
WORKDIR /repo

# Build toolchain + Chrome runtime libs. We need the runtime libs already
# during `pnpm install` because puppeteer's post-install validates the
# downloaded browser and Debian slim ships almost nothing by default.
RUN apt-get update && apt-get install -y --no-install-recommends \
      ca-certificates curl wget gnupg \
      python3 build-essential pkg-config \
      fonts-liberation libasound2 libatk-bridge2.0-0 libatk1.0-0 \
      libc6 libcairo2 libcups2 libdbus-1-3 libexpat1 libfontconfig1 \
      libgbm1 libglib2.0-0 libgtk-3-0 libnspr4 libnss3 libpango-1.0-0 \
      libpangocairo-1.0-0 libx11-6 libx11-xcb1 libxcb1 libxcomposite1 \
      libxcursor1 libxdamage1 libxext6 libxfixes3 libxi6 libxrandr2 \
      libxrender1 libxss1 libxtst6 lsb-release xdg-utils \
  && rm -rf /var/lib/apt/lists/*

RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/server/package.json apps/server/package.json
COPY apps/server/.puppeteerrc.cjs apps/server/.puppeteerrc.cjs
# web's manifest is needed because pnpm validates the workspace graph.
COPY apps/web/package.json apps/web/package.json

# Install only the @app/server subset (plus its workspace transitives).
# Puppeteer's post-install will populate apps/server/.puppeteer-cache.
RUN pnpm install --frozen-lockfile --filter @app/server...

# ---------- Stage 2: compile TypeScript ------------------------------------
FROM deps AS build
WORKDIR /repo

COPY apps/server ./apps/server

RUN pnpm --filter @app/server build

# ---------- Stage 3: production runtime ------------------------------------
FROM node:${NODE_VERSION}-bookworm-slim AS runner
WORKDIR /app

ENV NODE_ENV=production \
    PORT=8787 \
    HOST=0.0.0.0 \
    DATA_DIR=/app/apps/server/.data \
    LANCEDB_PATH=/app/apps/server/.data/lancedb

# Chrome runtime libs only (no compilers needed at runtime).
RUN apt-get update && apt-get install -y --no-install-recommends \
      ca-certificates dumb-init wget \
      fonts-liberation libasound2 libatk-bridge2.0-0 libatk1.0-0 \
      libc6 libcairo2 libcups2 libdbus-1-3 libexpat1 libfontconfig1 \
      libgbm1 libglib2.0-0 libgtk-3-0 libnspr4 libnss3 libpango-1.0-0 \
      libpangocairo-1.0-0 libx11-6 libx11-xcb1 libxcb1 libxcomposite1 \
      libxcursor1 libxdamage1 libxext6 libxfixes3 libxi6 libxrandr2 \
      libxrender1 libxss1 libxtst6 lsb-release xdg-utils \
  && rm -rf /var/lib/apt/lists/*

# Bring over the workspace layout and the puppeteer Chrome cache so the
# server can run `puppeteer.launch()` out of the box.
COPY --from=build /repo/package.json                         ./package.json
COPY --from=build /repo/pnpm-workspace.yaml                  ./pnpm-workspace.yaml
COPY --from=build /repo/node_modules                         ./node_modules
COPY --from=build /repo/apps/server/package.json             ./apps/server/package.json
COPY --from=build /repo/apps/server/.puppeteerrc.cjs         ./apps/server/.puppeteerrc.cjs
COPY --from=build /repo/apps/server/dist                     ./apps/server/dist
COPY --from=build /repo/apps/server/node_modules             ./apps/server/node_modules
COPY --from=build /repo/apps/server/.puppeteer-cache         ./apps/server/.puppeteer-cache

# Persistent data dir. Mount this as a volume in production.
RUN mkdir -p /app/apps/server/.data \
  && chown -R node:node /app

USER node
WORKDIR /app/apps/server

EXPOSE 8787

HEALTHCHECK --interval=30s --timeout=5s --retries=3 --start-period=20s \
  CMD wget -q --spider http://127.0.0.1:8787/healthz || exit 1

# dumb-init reaps zombie chrome subprocesses spawned by puppeteer.
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/index.js"]
