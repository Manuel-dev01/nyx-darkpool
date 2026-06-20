# Nyx Engine

Off-chain matching engine for the Nyx darkpool — a concurrent Go service backed by
PostgreSQL that manages the encrypted order book, pairs compatible orders, and (from
Phase 5) routes ZK proof generation for on-chain settlement.

## Package layout

```
engine/
├── cmd/server/          # process entrypoint: config load, DB pool, API + matcher, graceful shutdown
├── internal/
│   ├── config/          # env-driven, validated configuration (12-factor, fail-fast)
│   ├── db/              # pgxpool wrapper + SERIALIZABLE transaction helper
│   ├── api/             # HTTP surface (Phase 2: /healthz with live DB ping)
│   └── matcher/         # order-pairing worker loop (Phase 2: lifecycle stub)
└── db/migrations/       # golang-migrate SQL migrations (up/down pairs)
```

## Data model (migration `000001_init_schema`)

- **`orders`** — the encrypted order book. Stores only the client `encrypted_blob` plus
  Poseidon commitments (`price_hash`, `volume_hash`) — never plaintext price/volume. A
  unique `nullifier` prevents an order from being matched twice. A partial index
  `idx_orders_open_book (asset_pair, side, created_at) WHERE status='open'` serves the
  matcher's hot path (FIFO / price-time priority per pair).
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

## Transaction discipline

The matcher pairs orders inside `db.WithSerializableTx`, which runs the unit of work at
PostgreSQL `SERIALIZABLE` isolation. This prevents two concurrent workers from claiming the
same resting order. Serialization failures (SQLSTATE `40001`) are surfaced to the caller for
retry — they are expected under contention, not bugs.
