# syntax=docker/dockerfile:1
# ============================================================================
# Nyx engine image — multi-stage, SELF-CONTAINED for cloud deploy.
#   - build:   compile the static Go binary + the golang-migrate CLI.
#   - runtime: node:24 base (snarkjs proving) + the Linux `stellar` CLI (on-chain
#              settle) + the committed circuit artifacts baked in. The image needs
#              NOTHING from the host — no bind-mounts, no host CLI, no host
#              identity. It matches, PROVES, and (when NYX_SOROBAN_CONTRACT_ID is
#              set) SETTLES on Stellar testnet on its own. Runs the same on a bare
#              `docker run`, on Railway, Render, or Fly.
#
# BUILD CONTEXT = repo root (the image needs circuits/ + scripts/):
#   docker build -f engine/Dockerfile -t nyx-engine .
# ============================================================================

FROM golang:1.25 AS build
WORKDIR /src
# Cache deps first.
COPY engine/go.mod engine/go.sum ./
RUN go mod download
COPY engine/ ./
# Static binary — pgx is pure Go, so cgo is unnecessary.
RUN CGO_ENABLED=0 GOOS=linux go build -trimpath -o /out/nyx-engine ./cmd/server

# Full node:24 (buildpack-deps/bookworm) base — already ships curl + ca-certificates
# + libssl/glibc, so NO apt is needed (avoids flaky Debian mirrors on cloud builds)
# and the stellar CLI's runtime TLS just works.
FROM node:24 AS runtime
WORKDIR /app

# Versions: stellar CLI matches the host that produced the committed artifacts;
# golang-migrate provides the DB migration CLI the entrypoint runs.
ARG STELLAR_CLI_VERSION=27.0.0
ARG MIGRATE_VERSION=4.18.1

# The Linux `stellar` CLI (on-chain verify_and_settle) + the `migrate` CLI (entrypoint
# applies migrations — replaces the compose one-shot migrator). Prebuilt binaries via
# retryable curl (curl + CA certs are already present in this base image).
RUN curl -fsSL --retry 5 --retry-delay 3 --retry-connrefused -o /tmp/stellar.tar.gz \
      "https://github.com/stellar/stellar-cli/releases/download/v${STELLAR_CLI_VERSION}/stellar-cli-${STELLAR_CLI_VERSION}-x86_64-unknown-linux-gnu.tar.gz" \
 && tar -xzf /tmp/stellar.tar.gz -C /usr/local/bin stellar \
 && curl -fsSL --retry 5 --retry-delay 3 --retry-connrefused -o /tmp/migrate.tar.gz \
      "https://github.com/golang-migrate/migrate/releases/download/v${MIGRATE_VERSION}/migrate.linux-amd64.tar.gz" \
 && tar -xzf /tmp/migrate.tar.gz -C /usr/local/bin migrate \
 && rm /tmp/stellar.tar.gz /tmp/migrate.tar.gz \
 && stellar --version && migrate -version

# circuits' proving deps (snarkjs + circomlib), installed for Linux.
COPY circuits/package.json circuits/package-lock.json /circuits/
RUN cd /circuits && npm ci --omit=dev && npm cache clean --force

# Committed verifying key + the two runtime proving artifacts (BAKED IN, not
# bind-mounted): the wasm witness generator and the final Groth16 zkey.
COPY circuits/verification_key.json /circuits/verification_key.json
COPY circuits/build/darkpool_match_js/darkpool_match.wasm /circuits/build/darkpool_match_js/darkpool_match.wasm
COPY circuits/build/darkpool_match_final.zkey /circuits/build/darkpool_match_final.zkey

# proof->bytes script, DB migrations, the binaries, and the entrypoint.
COPY scripts/ /scripts/
COPY engine/db/migrations /migrations
COPY --from=build /out/nyx-engine /usr/local/bin/nyx-engine
COPY engine/docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

ENV NYX_CIRCUITS_ROOT=/circuits \
    NYX_SCRIPTS_ROOT=/scripts \
    NYX_NODE_BIN=node \
    NYX_STELLAR_BIN=stellar \
    NYX_HTTP_ADDR=:8080
EXPOSE 8080
ENTRYPOINT ["docker-entrypoint.sh"]
