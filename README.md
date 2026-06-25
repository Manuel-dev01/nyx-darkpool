# Nyx Darkpool

**A ZK-shielded Request-for-Quote (RFQ) and order-book system for institutional
Real-World-Asset (RWA) trading on the Stellar network.**

Nyx lets institutions submit and match orders **without revealing price or volume to the
public mempool**. Orders are committed as Poseidon hashes; a zero-knowledge proof attests
that a maker and taker order legitimately intersect at a valid price and volume; and a
Soroban contract verifies that proof on-chain (using Stellar Protocol 26's native BN254
host functions) before settling the asset swap atomically.

> Status: **Phases 1–5 DONE** — workspace, Postgres engine, ZK circuit, on-chain Soroban
> verifier, and the **off-chain matcher** (concurrent pairing → Groth16 proof → on-chain
> `verify_and_settle`, verified live end-to-end). The **`web/` frontend** (Next.js landing +
> product app + brand showcases) is done as a parallel track. **Phase 6 (orchestration &
> Dockerization) is next.** See [`STATUS.md`](./STATUS.md) for the live build ledger.

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
| `web/`        | Next.js (App Router), TypeScript | Brand + product frontend: interactive marketing landing, the `/app` product UI (access → desk → compose → pool → proofs → settled), and embedded brand showcases. Backend wiring lands in Phase 5. |
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

The top-level `Makefile` / `docker-compose.yml` arrive in **Phase 6**. Until then, each
component runs from its own directory (full toolchain notes in [`STATUS.md`](./STATUS.md)):

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
6. **Orchestration & Dockerization** — compose + Makefile _(next)_

**Frontend (parallel track, not one of the six phases):** the `web/` Next.js app — interactive
landing + product frontend + brand showcases — is **done** (build-verified); its backend wiring
arrives with Phase 5. See [`web/README.md`](./web/README.md) and the *Frontend Track* in
[`STATUS.md`](./STATUS.md).

---

## License

TBD.
