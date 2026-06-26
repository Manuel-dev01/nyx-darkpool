# syntax=docker/dockerfile:1
# ============================================================================
# Nyx web image — multi-stage Next.js standalone.
#   - build:   npm ci + next build (output: "standalone").
#   - runtime: copy the self-contained server + static assets only.
#
# BUILD CONTEXT = ./web. ENGINE_ORIGIN is read at RUNTIME by the proxy route
# handler (app/api/engine/[...path]/route.ts) — NOT baked at build time — so this
# image is portable: set ENGINE_ORIGIN as an env var on the platform (compose →
# http://engine:8080, Railway → the engine's domain). No build-arg needed.
# ============================================================================

FROM node:24-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:24-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0
# Next standalone bundle: a minimal server + only the deps it traced.
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
EXPOSE 3000
CMD ["node", "server.js"]
