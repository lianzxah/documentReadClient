# syntax=docker/dockerfile:1.6
# ============================================================================
# apps/web — Vite + React static SPA, served by nginx in production.
#
# Build context MUST be the monorepo root (so we can leverage the workspace
# pnpm-lock and only install what `@app/web` needs):
#
#   docker build -f apps/web/Dockerfile -t aimicroapp-web .
#
# Build-time args:
#   - NODE_VERSION   Node major used during the build stage (default: 20)
#   - VITE_API_TARGET  Optional. Embedded only into the dev proxy config; the
#                      production runtime talks to the backend through the
#                      nginx `/api` reverse proxy (see nginx.conf).
# ============================================================================

ARG NODE_VERSION=20

# ---------- Stage 1: install workspace deps ---------------------------------
FROM node:${NODE_VERSION}-alpine AS deps
WORKDIR /repo

# Enable corepack so `pnpm` matches the version pinned in package.json.
RUN corepack enable

# Copy the pieces required for `pnpm install` to resolve the @app/web subset.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web/package.json apps/web/package.json
COPY apps/server/package.json apps/server/package.json

# Frozen install for reproducible builds.
RUN pnpm install --frozen-lockfile --filter @app/web...

# ---------- Stage 2: build the SPA -----------------------------------------
FROM node:${NODE_VERSION}-alpine AS build
WORKDIR /repo

RUN corepack enable

COPY --from=deps /repo/node_modules ./node_modules
COPY --from=deps /repo/apps/web/node_modules ./apps/web/node_modules
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web ./apps/web

# Vite reads `import.meta.env.VITE_*` at build time only.
ARG VITE_API_TARGET
ENV VITE_API_TARGET=${VITE_API_TARGET}

RUN pnpm --filter @app/web build

# ---------- Stage 3: production image (nginx) -------------------------------
FROM nginx:1.27-alpine AS runner

# Drop the default site and ship our SPA-friendly config.
RUN rm -f /etc/nginx/conf.d/default.conf
COPY apps/web/nginx.conf /etc/nginx/conf.d/app.conf

COPY --from=build /repo/apps/web/dist /usr/share/nginx/html

# Healthcheck against nginx itself.
HEALTHCHECK --interval=30s --timeout=3s --retries=3 \
  CMD wget -q --spider http://127.0.0.1/ || exit 1

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
