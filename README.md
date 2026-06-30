# Nyx Darkpool

**A ZK-shielded Request-for-Quote (RFQ) and order-book system for institutional
Real-World-Asset (RWA) trading on the Stellar network.**

Nyx lets institutions submit and match orders **without revealing price or volume to the
public mempool**. Orders are committed as Poseidon hashes; a zero-knowledge proof attests
that a maker and taker order legitimately intersect at a valid price and volume; and a
Soroban contract verifies that proof on-chain (using Stellar Protocol 26's native BN254
host functions) before settling the asset swap atomically.

> ### ▶ Live demo: **<https://nyx-darkpool.vercel.app>**
> No install. Generate a desk, compose an order, and watch it **match → prove → settle on Stellar
> testnet** with a browsable stellar.expert transaction. Web on **Vercel**, engine + Postgres on
> **Render** (`https://nyx-engine.onrender.com`). The in-app flow is `access → desk → compose → pool
> → proofs → settled`.

> **Status — live in the cloud, on-chain settlement working.** The whole pipeline runs end-to-end
> through the public URL: a signed order is matched off-chain, a Groth16 proof is generated, and a
> Soroban contract re-verifies it and settles on **public Stellar testnet** (protocol ≥ 26). It's
> browsable:
> - **Verifier contract:** [`CBAFC6W5…GJRV`](https://stellar.expert/explorer/testnet/contract/CBAFC6W5IWQC5AB6LFMFI4KB4DZT23BU2O2AJ2H3B2727DO37DOJGJRV)
> - **Example settlement tx:** [`0706f517…a9dc9`](https://stellar.expert/explorer/testnet/tx/0706f517bac065f62151dfb6699e6b0da8da7ee85544f930aad277500e0a9dc9) (SUCCESS, ledger 3284327)

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
| `engine/`     | Go, PostgreSQL, `pgx`       | Concurrent off-chain matcher. Ingests encrypted orders, matches under `Serializable` isolation, orchestrates proof generation, persists `proof_blob`, and submits `verify_and_settle`. |
| `scripts/`    | Bash                        | Circuit compilation, trusted setup, deploy, and build/dev helpers.   |
| `web/`        | Next.js (App Router), TypeScript | Marketing landing + the `/app` product UI (access → desk → compose → pool → proofs → settled). **Wired to the engine** via a runtime `/api/engine` proxy; Compose computes a real Poseidon commitment (circomlibjs) and the screens poll live order/match state. |
| `docs/`       | Markdown                    | [Deployment runbook](docs/deploy.md) and [key-custody](docs/key-custody.md) notes. |

### Cryptography

- **Proof system:** Groth16 over the **BN254** curve.
- **Hashing:** Poseidon (Stellar Protocol 26 friendly), via `circomlib` / `circomlibjs`.
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

## What's real vs. what's a demo seam

Nyx is honest about its boundaries. The cryptographic and on-chain core is real and live; two
operational conveniences are clearly-marked seams with a known production path.

| Layer | Status |
|-------|--------|
| Poseidon commitment, Groth16 proof + witness | **Real** — `circomlibjs` in-browser + snarkjs in-engine, the same constants as the circuit |
| On-chain verification + settlement | **Real** — Soroban `verify_and_settle` on public Stellar testnet (BN254 host fns) |
| Order signatures (ed25519 over the commitment) | **Real** — engine-verified |
| At-rest blob encryption (AES-256-GCM) | **Real** |
| Demo-Mode auto-counterparty | **Demo convenience** — auto-fills a crossing order so a solo desk can settle; toggle OFF for a true two-desk cross |
| Desk secret in `localStorage` | **Documented seam** — production signs via the [Freighter](https://www.freighter.app/) wallet (secret never in the page); same signature scheme. See [docs/key-custody.md](docs/key-custody.md) |
| RWA/USDC asset-leg transfer | Settlement is **proven & recorded on-chain**; wiring a Stellar Asset Contract token movement behind `settle_transfer` is the documented next step |

---

## Repository layout

```
nyx-darkpool/
├── circuits/      # Circom circuits + snarkjs trusted setup
├── contracts/     # Soroban verifier contract (Rust)
├── engine/        # Go matching engine + Postgres migrations
├── scripts/       # compile_circuit.sh, deploy + demo helpers
├── web/           # Next.js marketing landing + /app product UI
├── docs/          # deployment + key-custody docs
├── render.yaml    # Render Blueprint (engine + Postgres)
├── docker-compose.yml · Makefile
└── README.md
```

---

## Prerequisites

| Tool        | Version    | Used by                | Install                                                    |
|-------------|------------|------------------------|------------------------------------------------------------|
| Go          | ≥ 1.22     | `engine/`              | https://go.dev/dl/                                         |
| PostgreSQL  | 16         | `engine/`              | Docker (`postgres:16`) or native                          |
| Docker      | ≥ 24       | local PG + compose     | https://docs.docker.com/get-docker/                       |
| Node.js     | ≥ 18       | `circuits/`, `web/`    | https://nodejs.org/                                       |
| circom      | 2.x        | `circuits/`            | https://docs.circom.io/getting-started/installation/      |
| snarkjs     | latest     | `circuits/`            | `npm install -g snarkjs` (or local in `circuits/`)        |
| Stellar CLI | 27.x       | `contracts/`           | https://developers.stellar.org/docs/tools/cli             |
| Rust        | stable     | `contracts/`           | + target `wasm32v1-none` (used by `stellar contract build`) |

> Live on-chain runs need a Soroban network at **protocol ≥ 26** (the BN254 `g1_msm` host function).
> Nothing local is required to *see* it work — just open the [live demo](https://nyx-darkpool.vercel.app).

---

## Quickstart

### One command — the full stack

```bash
bash scripts/compile_circuit.sh     # once: build the ZK artifacts
docker compose up -d                # or: make up   → postgres + migrate + engine + web
# open http://localhost:3000   (engine API on http://localhost:8080)
node scripts/seed_demo_orders.js    # or: make seed → post a crossing pair; watch it match + prove
docker compose down                 # or: make down   (down -v also wipes the DB volume)
```

`docker compose up` builds the engine (Go + Node/snarkjs, so it **proves in-container**) and the web
app (Next standalone), runs the migrations, and wires web → engine → Postgres. On-chain settlement is
**off by default under compose** — `NYX_SOROBAN_CONTRACT_ID` is unset, so `onchain_status` stays
`pending` (the proof is still real and stored). The engine image bundles the `stellar` CLI, so setting
that var (+ `NYX_SOROBAN_NETWORK=testnet`) makes even compose settle on testnet. The `Makefile` wraps
these plus `make circuits` / `make contracts` / `make test-all`.

### Local on-chain demo — REAL testnet settlement (`make demo`)

To run locally where the pipeline **completes on-chain** (proof → `verify_and_settle` on public
Stellar testnet → a browsable settlement tx), run the engine **on the host** (where the `stellar`
CLI + a funded testnet identity live) instead of in the container:

```bash
make demo        # terminal 1 → Postgres via compose + host engine, on-chain ON
make demo-web    # terminal 2 → cd web && npm run dev → http://localhost:3000
```

`scripts/demo_testnet.sh` brings up Postgres, reuses the deployed testnet verifier (redeploys +
friendbot-funds automatically if testnet has reset — `NYX_REDEPLOY=1` forces it), exports the
on-chain env, and runs the engine with `onchain:true`. Every match then genuinely settles on testnet
and the Proofs screen animates all four stages to DONE with a stellar.expert link.

### Cloud deploy — Vercel (web) + Render (engine/PG), no host dependency

This is **already live** ([nyx-darkpool.vercel.app](https://nyx-darkpool.vercel.app) →
[nyx-engine.onrender.com](https://nyx-engine.onrender.com)). The **web** runs on Vercel (GitHub-linked)
and the **engine + Postgres** on Render (via [`render.yaml`](render.yaml)). The engine image is fully
self-contained — it bakes the circuit artifacts + the Linux `stellar` CLI + `golang-migrate`, applies
migrations on boot, and **auto-generates + friendbot-funds** a testnet submitter — so it matches,
proves, **and settles on testnet** with nothing from the host. The web's `/api/engine/*` proxy reads
`ENGINE_ORIGIN` at runtime, so the same build points anywhere with no rebuild. **Full runbook:
[docs/deploy.md](docs/deploy.md)** (Railway/Fly covered as host-agnostic alternatives).

### Per-component (host toolchain)

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

## Testing

- **Engine:** `go test ./...` (offline unit tests) and `go test -tags=integration -p 1 ./...`
  (needs Postgres). Concurrency is exercised with `-race`.
- **Off-chain pipeline:** `bash scripts/e2e_offchain.sh` (post → match → Groth16 proof stored).
- **On-chain pipeline:** `bash scripts/e2e_onchain.sh` (engine → deployed contract →
  `verify_and_settle` → confirmed settlement tx).
- **Web:** `cd web && npm run build` (typecheck + production build).

---

## License

TBD.
