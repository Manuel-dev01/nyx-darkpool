# Nyx Darkpool

**A ZK-shielded Request-for-Quote (RFQ) and order-book system for institutional
Real-World-Asset (RWA) trading on the Stellar network.**

Nyx lets institutions submit and match orders **without revealing price or volume to the
public mempool**. Orders are committed as Poseidon hashes; a zero-knowledge proof attests
that a maker and taker order legitimately intersect at a valid price and volume; and a
Soroban contract verifies that proof on-chain (using Stellar Protocol 26's native BN254
host functions) before settling the asset swap atomically.

> Status: **All six phases DONE** — workspace, Postgres engine, ZK circuit, on-chain Soroban
> verifier, the **off-chain matcher** (concurrent pairing → Groth16 proof → on-chain
> `verify_and_settle`), **at-rest AES-256-GCM encryption** of the order blob, the **`web/` frontend
> wired to the engine** (real in-browser Poseidon commitment → live order/proof/settlement screens),
> and a **public Stellar testnet** deployment of the verifier (settlement tx browsable on
> stellar.expert). **Phase 6 (orchestration)** ships a one-command `docker compose` stack +
> `Makefile`. See [`STATUS.md`](./STATUS.md) for the live build ledger, contract id, and explorer links.

---

## Why Nyx

Public AMMs and transparent order books leak institutional intent: large RWA orders are
front-run and sandwiched, and resting quotes reveal positioning. Nyx separates **off-chain
state management** from **on-chain settlement** so that matching happens privately and only
a succinct, verifiable proof of a fair match ever touches the chain.

- **No information leakage** — only commitments (hashes) and proofs are public.
- **No latency arbitrage** — a sequencing matcher batches executions off-chain.
- **Trustless settlement** — the chain re-verifies the match; the operator cannot forge fills.

---

## Architecture

```
            ┌──────────────────────────── OFF-CHAIN ────────────────────────────┐
            │                                                                    │
  Encrypted │   ┌──────────────┐      ┌─────────────────┐     ┌──────────────┐   │
  orders ───┼──▶│  /engine     │─────▶│  /circuits      │────▶│  Groth16     │   │
  (commit-  │   │  Go + Postgres│ raw  │  Circom 2.0     │proof│  proof_blob  │   │
   ments)   │   │  matcher      │match │  + snarkjs      │     │              │   │
            │   └──────────────┘      └─────────────────┘     └──────┬───────┘   │
            └────────────────────────────────────────────────────────┼──────────┘
                                                                      │ submit
            ┌──────────────────────────── ON-CHAIN ──────────────────▼──────────┐
            │   ┌────────────────────────────────────────────────────────────┐  │
            │   │  /contracts — Soroban (Rust, no_std)                        │  │
            │   │  verify_and_settle(proof_a, proof_b, proof_c, public_inputs)│  │
            │   │  → Protocol 26 BN254 host fns (pairing, MSM, scalar field)  │  │
            │   │  → if valid: execute token swap                             │  │
            │   └────────────────────────────────────────────────────────────┘  │
            └────────────────────────────────────────────────────────────────────┘
```

### Components

| Path          | Stack                       | Role                                                                 |
|---------------|-----------------------------|----------------------------------------------------------------------|
| `circuits/`   | Circom 2.0, circomlib, snarkjs | Groth16 circuit proving two orders intersect at a valid price/volume; Poseidon commitments; nullifiers to prevent order double-spend. |
| `contracts/`  | Soroban / Rust (`#![no_std]`) | Pure on-chain Groth16 **verifier + settlement** using Protocol 26 BN254 host functions. Strict `require_auth`; graceful verification-failure handling. |
| `engine/`     | Go 1.22+, PostgreSQL, `pgx` | Concurrent off-chain matcher. Ingests encrypted orders, matches under `Serializable` isolation, orchestrates proof generation, persists `proof_blob`. |
| `scripts/`    | Bash                        | Circuit compilation, trusted setup, build/dev helpers.               |
| `web/`        | Next.js (App Router), TypeScript | Brand + product frontend: interactive marketing landing, the `/app` product UI (access → desk → compose → pool → proofs → settled), and embedded brand showcases. **Wired to the engine** via a `/api/engine` proxy; Compose computes a real Poseidon commitment (circomlibjs) and the screens poll live order/match state. |
| `docs/`       | Markdown                    | Architecture notes and protocol specs.                               |

### Cryptography

- **Proof system:** Groth16 over the **BN254** curve.
- **Hashing:** Poseidon (Stellar P25/26 friendly), via `circomlib`.
- **On-chain verification:** Stellar **Protocol 26** BN254 host functions — pairing check,
  multi-scalar multiplication, and scalar-field arithmetic — invoked from Soroban.
- **Safety:** every intermediate circuit signal is strictly constrained (no
  under-constrained signals; comparator operands are range-checked to defeat field
  wraparound). Double-match/replay is prevented by the DB (`orders.nullifier UNIQUE`,
  `matches` UNIQUE maker/taker) and on-chain (the verifier records settled commitments and
  rejects replays). An in-circuit nullifier is a documented future extension.
- **Privacy at rest:** the order's raw `price/volume/salt` (which the trusted off-chain prover
  needs) are stored **AES-256-GCM-encrypted** in `orders.encrypted_blob`. The engine encrypts by
  default with an **ephemeral key** (no secret written to disk); set `NYX_BLOB_KEY` to persist.
- **Order authentication:** each desk is a real **Stellar keypair**; every order's commitment is
  **ed25519-signed** and the engine verifies it against the order `pubkey` (`internal/stellarkey`).
  Verified when present; mandatory with `NYX_REQUIRE_ORDER_SIG=true`.

---

## Repository Layout

```
nyx-darkpool/
├── circuits/      # Circom circuits + snarkjs trusted setup
├── contracts/     # Soroban verifier contract (Rust)
├── engine/        # Go matching engine + Postgres migrations
├── scripts/       # compile_circuit.sh and build helpers
├── docs/          # architecture & protocol docs
├── STATUS.md      # atomic build-state ledger (read first on reset)
├── CLAUDE.md      # full system architecture & operations manual
└── README.md
```

---

## Prerequisites

| Tool        | Version    | Used by                | Install                                                    |
|-------------|------------|------------------------|------------------------------------------------------------|
| Go          | ≥ 1.22     | `engine/`              | https://go.dev/dl/                                         |
| PostgreSQL  | 16         | `engine/`              | Docker (`postgres:16`) or native                          |
| Docker      | ≥ 24       | local PG + compose     | https://docs.docker.com/get-docker/                       |
| Node.js     | ≥ 18       | `circuits/` (snarkjs)  | https://nodejs.org/                                       |
| circom      | 2.x        | `circuits/`            | https://docs.circom.io/getting-started/installation/      |
| snarkjs     | latest     | `circuits/`            | `npm install -g snarkjs` (or local in `circuits/`)        |
| Stellar CLI | 27.x       | `contracts/`           | https://developers.stellar.org/docs/tools/cli             |
| Rust        | stable     | `contracts/`           | + target `wasm32v1-none` (used by `stellar contract build`) |

> Current environment (all provisioned): Go 1.25.5, Node 24.12, Docker 29.5, circom 2.2.3,
> snarkjs (in `circuits/`), Rust 1.96.0 + `wasm32v1-none`, `stellar` CLI 27.0.0. See
> [`STATUS.md`](./STATUS.md) → *Toolchain Inventory* for exact locations and the offline
> Rust-install note. The Soroban network for live runs must be **protocol ≥ 26**.

---

## Quickstart

### One command — the full stack (Phase 6)

```bash
bash scripts/compile_circuit.sh     # once: build the ZK artifacts (mounted into the engine)
docker compose up -d                # or: make up   → postgres + migrate + engine + web
# open http://localhost:3000   (engine API on http://localhost:8080)
node scripts/seed_demo_orders.js    # or: make seed → post a crossing pair; watch it match + prove
docker compose down                 # or: make down   (down -v also wipes the DB volume)
```

`docker compose up` builds the engine (Go + Node/snarkjs, so it **proves in-container**) and the web
app (Next standalone), runs the migrations, and wires web → engine → Postgres. On-chain settlement
stays an **opt-in host/testnet step** (see Contracts below); the engine container has no `stellar`
CLI, so `onchain_status` is `pending` under `compose` by design. The `Makefile` wraps these plus
`make circuits` / `make contracts` / `make test-all`.

### Per-component (host toolchain)

Each component also runs from its own directory (full toolchain notes in [`STATUS.md`](./STATUS.md)):

```bash
# Circuits — compile + trusted setup + sample proof + verify
bash scripts/install_circom.sh      # one-time: prebuilt circom into scripts/bin/
( cd circuits && npm install )
bash scripts/compile_circuit.sh

# Engine — unit tests (offline) and integration/E2E (needs Postgres)
( cd engine && go test ./... )
docker run -d --name nyx-pg -e POSTGRES_USER=nyx -e POSTGRES_PASSWORD=nyx \
  -e POSTGRES_DB=nyx -p 5433:5432 postgres:16
export NYX_TEST_DB_URL="postgres://nyx:nyx@localhost:5433/nyx?sslmode=disable"
( cd engine && go test -tags=integration -p 1 ./... )
bash scripts/e2e_offchain.sh        # off-chain proof pipeline

# Contracts — build, test, deploy, and full on-chain E2E
export PATH="$HOME/.cargo/bin:/c/mingw64/bin:$PATH"
( cd contracts/nyx-verifier && cargo test && stellar contract build )
stellar container start local --protocol-version 26   # network MUST be protocol >= 26
bash scripts/e2e_onchain.sh         # engine -> deployed contract, verify_and_settle on-chain
```

---

## Build Protocol

Nyx is built in six sequential, independently-committed phases. No phase begins until the
previous one compiles, passes its tests, and is committed. The authoritative protocol lives
in [`CLAUDE.md`](./CLAUDE.md); live progress is tracked in [`STATUS.md`](./STATUS.md).

1. **Workspace & State Initialization** — repo, topology, docs ✅
2. **Database Schema & Engine Boilerplate** — Postgres migrations + Go scaffold ✅
3. **ZK Circuit Construction** — `darkpool_match.circom` + trusted setup ✅ _(+ Go test/E2E hardening)_
4. **Soroban Verifier Contract** — on-chain Groth16 verification + settlement ✅ _(verified live on-chain)_
5. **Off-Chain Engine Logic** — concurrent matcher + proof routing → on-chain settlement ✅ _(verified end-to-end)_
   - **5.1** At-rest blob encryption + frontend↔engine wiring + **public testnet deploy** ✅ _(settlement tx live on stellar.expert)_
   - **5.2** Desk auth — **Stellar keypair + engine-verified signed orders** + demo-mode counterparty + downloadable receipt ✅
6. **Orchestration & Dockerization** — one-command `docker compose` stack (postgres + migrate +
   engine + web) + `Makefile` ✅ _(verified: engine proves in-container; web proxies to it)_

**Frontend (parallel track, not one of the six phases):** the `web/` Next.js app — interactive
landing + product frontend + brand showcases — is **done** and, as of Phase 5.1, **wired to the
engine** (real in-browser Poseidon commitment → `POST /orders`; Desk/Pool/Proofs/Settled poll live
match state via a `/api/engine` proxy). See [`web/README.md`](./web/README.md) and the *Frontend
Track* in [`STATUS.md`](./STATUS.md).

---

## License

TBD.
