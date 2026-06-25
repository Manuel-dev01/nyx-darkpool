# ============================================================================
# Nyx Darkpool — developer workflow (Phase 6).
#
# Thin wrappers over docker compose / bash / go / cargo. Each target maps 1:1 to
# a command you can also run directly, so a host WITHOUT `make` (e.g. plain
# Windows) loses no capability — just run the underlying command shown.
#
#   make up        # build + start the full stack (postgres, migrate, engine, web)
#   make down      # stop it           |  make down-v  # stop + wipe the DB volume
#   make logs      # follow logs       |  make ps      # service status
#   make circuits  # compile the ZK circuit + trusted setup (host: circom+snarkjs)
#   make contracts # cargo test + stellar contract build (host: rust+stellar CLI)
#   make test-all  # engine offline tests (always green, no toolchain needed)
#   make seed      # post a crossing demo pair to the running engine
# ============================================================================

COMPOSE ?= docker compose

.PHONY: up down down-v logs ps build migrate seed \
        circuits contracts test-all test-integration e2e-offchain e2e-onchain help

help:
	@echo "Targets: up down down-v logs ps build migrate seed circuits contracts test-all test-integration e2e-offchain e2e-onchain"

# --- Stack lifecycle --------------------------------------------------------
up:
	$(COMPOSE) up -d --build

build:
	$(COMPOSE) build

down:
	$(COMPOSE) down

down-v:
	$(COMPOSE) down -v

logs:
	$(COMPOSE) logs -f

ps:
	$(COMPOSE) ps

migrate:
	$(COMPOSE) run --rm migrate

# Post a crossing ASK/BID pair (real Poseidon commitments) to the running engine.
seed:
	node scripts/seed_demo_orders.js

# --- Build / verify per component (need the host toolchain) -----------------
circuits:
	bash scripts/compile_circuit.sh

contracts:
	cd contracts/nyx-verifier && cargo test && stellar contract build

# Always-green offline core (no DB / circuits / network needed).
test-all:
	cd engine && go vet ./... && go test ./...
	@echo ""
	@echo "Offline engine tests passed. Toolchain-dependent suites:"
	@echo "  make test-integration   # needs a reachable Postgres (NYX_TEST_DB_URL)"
	@echo "  make contracts          # needs rust + stellar CLI"
	@echo "  make circuits           # needs circom + snarkjs"

# Integration + E2E tests (need Postgres). Point NYX_TEST_DB_URL at the compose
# DB (localhost:5432) or your own.
test-integration:
	cd engine && go test -tags=integration -p 1 ./...

e2e-offchain:
	bash scripts/e2e_offchain.sh

e2e-onchain:
	bash scripts/e2e_onchain.sh
