# syntax=docker/dockerfile:1
# ============================================================================
# Nyx engine image — multi-stage.
#   - build:   compile a static Go binary (no cgo).
#   - runtime: node:24 base so the matcher can drive snarkjs for proving;
#              ships the circuits' npm deps + the verifying key + scripts.
#
# BUILD CONTEXT = repo root (the image needs ../circuits and ../scripts), so
# build it via docker-compose (context: .) or:
#   docker build -f engine/Dockerfile -t nyx-engine .
#
# The large circuit artifacts (circuits/build/*.wasm/*.zkey) are NOT copied —
# they are bind-mounted read-only at runtime (see docker-compose.yml). If absent,
# the engine still runs and matches; proofs are simply skipped.
# ============================================================================

FROM golang:1.25 AS build
WORKDIR /src
# Cache deps first.
COPY engine/go.mod engine/go.sum ./
RUN go mod download
COPY engine/ ./
# Static binary — pgx is pure Go, so cgo is unnecessary.
RUN CGO_ENABLED=0 GOOS=linux go build -trimpath -o /out/nyx-engine ./cmd/server

FROM node:24-slim AS runtime
WORKDIR /app
# circuits' proving deps (snarkjs + circomlib), installed for Linux.
COPY circuits/package.json circuits/package-lock.json /circuits/
RUN cd /circuits && npm ci --omit=dev && npm cache clean --force
# Committed verifying key + the proof->bytes script the prover/bridge call.
COPY circuits/verification_key.json /circuits/verification_key.json
COPY scripts/ /scripts/
# The compiled binary.
COPY --from=build /out/nyx-engine /usr/local/bin/nyx-engine

ENV NYX_CIRCUITS_ROOT=/circuits \
    NYX_SCRIPTS_ROOT=/scripts \
    NYX_NODE_BIN=node \
    NYX_HTTP_ADDR=:8080
EXPOSE 8080
ENTRYPOINT ["nyx-engine"]
