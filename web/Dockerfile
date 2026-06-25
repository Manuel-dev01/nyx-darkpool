# syntax=docker/dockerfile:1
# ============================================================================
# Nyx web image — multi-stage Next.js standalone.
#   - build:   npm ci + next build (output: "standalone").
#   - runtime: copy the self-contained server + static assets only.
#
# BUILD CONTEXT = ./web. The app reads ENGINE_ORIGIN at server start to proxy
# /api/engine/* to the engine (see next.config.mjs); compose sets it to
# http://engine:8080.
# ============================================================================

FROM node:24-slim AS build
WORKDIR /app
# Next bakes rewrites() destinations at BUILD time, so ENGINE_ORIGIN must be set
# here (not just at runtime). Defaults to the compose service name; override with
# --build-arg ENGINE_ORIGIN=... for a different engine host.
ARG ENGINE_ORIGIN=http://engine:8080
ENV ENGINE_ORIGIN=${ENGINE_ORIGIN}
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
