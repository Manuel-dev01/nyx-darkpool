# Nyx Darkpool

**A ZK-shielded Request-for-Quote (RFQ) and order-book system for institutional
Real-World-Asset (RWA) trading on the Stellar network.**

Nyx lets institutions submit and match orders **without revealing price or volume to the
public mempool**. Orders are committed as Poseidon hashes; a zero-knowledge proof attests
that a maker and taker order legitimately intersect at a valid price and volume; and a
Soroban contract verifies that proof on-chain (using Stellar Protocol 26's native BN254
host functions) before settling the asset swap atomically.

> Status: **Phase 1 — Workspace & State Initialization.** See [`STATUS.md`](./STATUS.md)
> for the live build ledger.

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
| `docs/`       | Markdown                    | Architecture notes and protocol specs.                               |

### Cryptography

- **Proof system:** Groth16 over the **BN254** curve.
- **Hashing:** Poseidon (Stellar P25/26 friendly), via `circomlib`.
- **On-chain verification:** Stellar **Protocol 26** BN254 host functions — pairing check,
  multi-scalar multiplication, and scalar-field arithmetic — invoked from Soroban.
- **Safety:** every intermediate circuit signal is strictly constrained (no
  under-constrained signals); nullifiers prevent replay/double-spend of orders.

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
| Stellar CLI | latest     | `contracts/`           | https://developers.stellar.org/docs/tools/cli             |
| Rust        | stable     | `contracts/`           | + target `wasm32-unknown-unknown`                         |

> Current environment: Go 1.25.5, Node 24.12, Docker 29.5 present. `circom`, `snarkjs`,
> and the `stellar` CLI are **not yet installed** and will be provisioned at Phases 3–4.

---

## Quickstart

> The Makefile and `docker-compose.yml` referenced below are introduced in **Phase 6**.
> Until then, each component is built from its own directory (see per-phase steps in
> [`CLAUDE.md`](./CLAUDE.md)).

```bash
make up          # start PostgreSQL + the Go engine
make down        # tear down the stack
make circuits    # compile circuits + run trusted setup
make contracts   # build & test the Soroban verifier
make test-all    # run the full test suite across components
```

---

## Build Protocol

Nyx is built in six sequential, independently-committed phases. No phase begins until the
previous one compiles, passes its tests, and is committed. The authoritative protocol lives
in [`CLAUDE.md`](./CLAUDE.md); live progress is tracked in [`STATUS.md`](./STATUS.md).

1. **Workspace & State Initialization** — repo, topology, docs _(current)_
2. **Database Schema & Engine Boilerplate** — Postgres migrations + Go scaffold
3. **ZK Circuit Construction** — `darkpool_match.circom` + trusted setup
4. **Soroban Verifier Contract** — on-chain Groth16 verification + settlement
5. **Off-Chain Engine Logic** — concurrent matcher + proof routing
6. **Orchestration & Dockerization** — compose + Makefile

---

## License

TBD.
