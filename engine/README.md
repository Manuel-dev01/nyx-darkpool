# Nyx Engine

Off-chain matching engine for the Nyx darkpool — a concurrent Go service backed by
PostgreSQL that manages the encrypted order book, pairs compatible orders, generates their
Groth16 proofs, and settles them on-chain (Phase 5).

## Package layout

```
engine/
├── cmd/server/          # process entrypoint: config load, DB pool, API + matcher, graceful shutdown
├── internal/
│   ├── config/          # env-driven, validated configuration (12-factor, fail-fast)
│   ├── db/              # pgxpool wrapper + SERIALIZABLE transaction helper
│   ├── order/           # order domain type + encrypted_blob payload (price/volume/salt) codec
│   ├── store/           # data-access layer: open-orders scan, atomic CreateMatch, proof/onchain writes
│   ├── secret/          # at-rest AES-256-GCM encryption for encrypted_blob (ephemeral key by default)
│   ├── prove/           # snarkjs proof generator (witness → groth16 prove) via os/exec, per-call temp dir
│   ├── api/             # HTTP surface: /healthz, POST /orders, GET /orders, GET /matches/{id}
│   ├── matcher/         # Phase 5: concurrent worker pool — match → prove → on-chain settle
│   ├── onchain/         # Phase 4: env-gated Soroban bridge (invoke verify_and_settle)
│   └── e2e/             # integration-gated off-chain + on-chain E2E pipeline
└── db/migrations/       # golang-migrate SQL migrations (up/down pairs)
```

## The matcher pipeline (Phase 5)

```
poll loop (ticker)                     worker pool ×N (CPU-bound proving)
  matchOnce: pair crossing ask/bid  →  prove.Generate (snarkjs)  →  store.SetProof
    under SERIALIZABLE (40001-safe)     → (if NYX_SOROBAN_CONTRACT_ID set)
  dispatch unproven matches ───────►       onchain.VerifyAndSettle → store.SetOnchain
```

- **Concurrency safety lives in the DB, not locks:** `CreateMatch` flips both orders
  `open→matched` inside a `SERIALIZABLE` tx; the `matches` UNIQUE(maker)/UNIQUE(taker) constraints
  are the backstop. Racing workers (or processes) can't double-match — the loser gets
  `ErrAlreadyMatched`/`ErrSerialization` and skips. Proven by the racing-matchers `-race` test.
- **Crash-safe proving:** matches are dispatched by scanning `proof_blob IS NULL`, so a proof
  interrupted by shutdown is simply retried next tick — nothing is lost to an in-memory queue.
- **Trust model:** the engine is the off-chain prover, so the order's raw `price/volume/salt` live
  in `orders.encrypted_blob` — now **AES-256-GCM encrypted at rest** (`internal/secret`), so a DB
  dump leaks nothing. The engine handles raw values only in memory to match and prove; the public
  chain/mempool only ever sees the commitment + proof. A lying client whose commitment ≠
  `Poseidon(price,volume,salt)` simply produces an unprovable order (witness calc fails).
- **Proving optional:** if the circuit isn't compiled (`circuits/build/` artifacts absent), the
  engine still runs and matches orders; proofs are skipped (matches stay unproven) until built.

## Data model (migrations `000001_init_schema`, `000002_order_commitment`)

- **`orders`** — the encrypted order book. Stores only the client `encrypted_blob` plus
  Poseidon commitments (`price_hash`, `volume_hash`, and `order_commitment` =
  `Poseidon(price,volume,salt)` — the proof's public input, added in `000002`) — never
  plaintext price/volume. A unique `nullifier` prevents an order from being matched twice. A
  partial index `idx_orders_open_book (asset_pair, side, created_at) WHERE status='open'`
  serves the matcher's hot path (FIFO / price-time priority per pair).
- **`matches`** — settlement records pairing a maker and taker order, holding the
  serialized Groth16 `proof_blob` and `onchain_status`. Unique maker/taker constraints
  enforce the full-fill model; a `CHECK` forbids self-matching.
- Both tables auto-maintain `updated_at` via the `set_updated_at()` trigger.

Enums: `order_status (open|matched|settled|cancelled)`, `order_side (bid|ask)`,
`onchain_status (pending|submitted|confirmed|failed)`.

## Configuration (environment variables)

| Variable                 | Default                                                  | Purpose                          |
|--------------------------|----------------------------------------------------------|----------------------------------|
| `NYX_DATABASE_URL`       | `postgres://nyx:nyx@localhost:5432/nyx?sslmode=disable`  | pgx connection string            |
| `NYX_HTTP_ADDR`          | `:8080`                                                  | API listen address               |
| `NYX_DB_MAX_CONNS`       | `10`                                                     | pgx pool size                    |
| `NYX_DB_CONNECT_TIMEOUT` | `10s`                                                    | startup DB connect deadline      |
| `NYX_LOG_LEVEL`          | `info`                                                   | slog level: debug/info/warn/error|
| `NYX_MATCHER_WORKERS`    | CPU count (capped at 8)                                  | concurrent proof-generation workers |
| `NYX_MATCHER_POLL_INTERVAL` | `1s`                                                  | match + dispatch cycle interval  |
| `NYX_CIRCUITS_ROOT`      | `../circuits`                                             | wasm/zkey/vkey + node_modules for proving |
| `NYX_SCRIPTS_ROOT`       | `../scripts`                                              | `proof_to_bytes.js` (proof → BN254 bytes) |
| `NYX_NODE_BIN`           | `node`                                                   | Node.js binary driving snarkjs   |
| `NYX_BLOB_KEY`           | _(unset → ephemeral key)_                                | hex AES-256 key (32 bytes) for at-rest `encrypted_blob` encryption |

**At-rest encryption.** `orders.encrypted_blob` is sealed with AES-256-GCM (`internal/secret`).
When `NYX_BLOB_KEY` is unset the engine generates an **ephemeral key at startup** — encryption is on
and *no secret is written to disk*, but orders cannot be decrypted after a restart (a startup
`WARN` says so). Set `NYX_BLOB_KEY` to a 64-hex-char (32-byte) key to persist across restarts.
Decryption falls back to plaintext for legacy rows written before encryption existed.

The on-chain settlement leg additionally reads `NYX_SOROBAN_CONTRACT_ID` (+ `_NETWORK`,
`_SOURCE`, `NYX_STELLAR_BIN`) — see *On-chain settlement bridge* below; unset ⇒ the matcher
stops after storing `proof_blob`.

## Order API (Phase 5)

| Method & path        | Purpose                                                                 |
|----------------------|-------------------------------------------------------------------------|
| `POST /orders`       | Submit a sealed order: `{pubkey, asset_pair, side, price, volume, salt, commitment, nullifier}` → `201 {id}`. `409` on nullifier reuse, `400` on bad input. |
| `GET /orders`        | List recent orders (no private values); `?limit=` (default 100). Each row carries `match_id` once the order is paired (for frontend order→match polling). |
| `GET /matches/{id}`  | Read a match: maker/taker ids, `has_proof`, `onchain_status`, `settlement_tx`. |

`price/volume/salt` are base-10 integer strings; the client computes its own `commitment`
(Poseidon) and `nullifier` ("sealed locally"). The matcher picks up `open` orders automatically.

## Local development

```bash
# 1. Start PostgreSQL (any 16/17/18 image works; compose pins 16 in Phase 6)
docker run -d --name nyx-pg -e POSTGRES_USER=nyx -e POSTGRES_PASSWORD=nyx \
  -e POSTGRES_DB=nyx -p 5432:5432 postgres:16

# 2. Install the migration CLI (once)
go install -tags 'postgres' github.com/golang-migrate/migrate/v4/cmd/migrate@latest

# 3. Apply migrations
migrate -path db/migrations \
  -database "postgres://nyx:nyx@localhost:5432/nyx?sslmode=disable" up

# 4. Build & run the engine
go build ./...
go run ./cmd/server          # serves /healthz on :8080
```

## Testing

```bash
# Unit tests (no database needed)
go test ./...

# Integration + E2E tests (need a reachable Postgres)
export NYX_TEST_DB_URL="postgres://nyx:nyx@localhost:5432/nyx?sslmode=disable"
go test -tags=integration -p 1 ./...
```

DB-dependent tests are gated by both the `integration` build tag **and** `NYX_TEST_DB_URL`,
so the default `go test ./...` runs fully offline.

### Running tests with the race detector

The manual requires `go test -race`. On Windows the race detector needs cgo + a C compiler.
Install a MinGW toolchain to a **space-free path** (`ld` cannot link from a path containing
spaces) — e.g. `C:\mingw64` (WinLibs UCRT) — then:

```bash
export PATH="/c/mingw64/bin:$PATH"
export CGO_ENABLED=1
go test -race ./...                                   # unit
NYX_TEST_DB_URL="postgres://nyx:nyx@localhost:5432/nyx?sslmode=disable" \
  go test -race -tags=integration -p 1 ./...          # + integration/e2e
```

## On-chain settlement bridge (`internal/onchain`, Phase 4)

After a match is verified off-chain, the engine can re-verify it on-chain by invoking the
deployed Soroban `nyx-verifier` contract's `verify_and_settle` (via the `stellar` CLI). The
bridge is **disabled unless `NYX_SOROBAN_CONTRACT_ID` is set**, so offline `go test ./...`
needs no network or contract.

| Variable                  | Default                 | Purpose                                   |
|---------------------------|-------------------------|-------------------------------------------|
| `NYX_SOROBAN_CONTRACT_ID` | _(unset → disabled)_    | deployed contract id (CID); enables the bridge |
| `NYX_SOROBAN_NETWORK`     | `local`                 | `--network` passed to the CLI             |
| `NYX_SOROBAN_SOURCE`      | `nyx-engine`            | signing identity (also the `submitter`)   |
| `NYX_STELLAR_BIN`         | `stellar`               | path to the `stellar` binary              |

On success the engine records `matches.onchain_status = 'confirmed'` and the
`settlement_tx`. The on-chain run requires a Soroban network at **protocol ≥ 26**. See
[`../scripts/e2e_onchain.sh`](../scripts/e2e_onchain.sh) for the full flow.

## Transaction discipline

The matcher pairs orders inside `db.WithSerializableTx`, which runs the unit of work at
PostgreSQL `SERIALIZABLE` isolation. This prevents two concurrent workers from claiming the
same resting order. Serialization failures (SQLSTATE `40001`) are surfaced to the caller for
retry — they are expected under contention, not bugs.
