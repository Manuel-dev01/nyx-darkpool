# Nyx Darkpool — Build Status

> **Atomic State Tracker.** This file is the single source of truth for build progress.
> On any context reset, **read this file first.** Update it to `IN PROGRESS` before
> starting a phase and to `DONE` (with the commit short-hash) after a phase compiles,
> passes validation, and is committed.

_Last updated: 2026-06-21 (Phase 3 complete + hardening/E2E retrofit)_

## Phase Ledger

| Phase | Description                                   | Status      | Commit  |
|-------|-----------------------------------------------|-------------|---------|
| 1     | Workspace & State Initialization              | DONE        | 2721f31 |
| 2     | Database Schema & Engine Boilerplate (Go/PG)  | DONE        | 26ca3ed |
| 3     | ZK Circuit Construction (Circom + snarkjs)    | DONE        | 70bdafd |
| 4     | Soroban Verifier Contract (Rust)              | PENDING     | —       |
| 5     | Off-Chain Engine Logic (Go matcher + proofs)  | PENDING     | —       |
| 6     | Orchestration & Dockerization                 | PENDING     | —       |

> Housekeeping commit `059ccac` (after Phase 2) replaced the empty-directory
> `.gitkeep` placeholders with descriptive `README.md` files in `circuits/`,
> `contracts/`, `docs/`, and `scripts/`.

## Repository State

- **Branch:** `main` · **Remote:** `origin` (github.com/Manuel-dev01/nyx-darkpool)
- **Local `HEAD` == `origin/main` == `059ccac`** — fully in sync (verified 2026-06-21).
- **Commit policy:** commit locally only; the user performs all pushes. Commits carry
  **no `Co-Authored-By` trailer** (the author is the user).
- **History note:** the first two commits were rewritten once to remove a
  `Co-Authored-By: Claude` trailer (hashes changed: `df5463a`→`2721f31`,
  `5fa4734`→`4b5329d`) and the clean history was force-pushed. Remote and local now
  agree, so normal `git pull` / `git push` work without conflict. The old hashes survive
  only in some commit-message back-references and are harmless.

## Operating Directives (in force at all times)

- **Zero-Assumption / No Hallucinations** — Missing deps/tools/configs are installed,
  configured, and documented. No mock data for cryptographic functions.
- **Self-Verification (TDD)** — After writing code, run the matching compiler/linter/test
  (`go test -race ./...`, `circom --r1cs`, `cargo test`, snarkjs proof checks). Clear all
  warnings before proceeding.
- **Atomic Commits** — Each completed, tested phase ends in a Conventional-Commits commit.
- **Atomic State Tracking** — This file is updated at every state change.
- **Error Handling** — No silent failures. On failure: output the trace, root-cause it,
  fix, re-test.

## Toolchain Inventory (discovered 2026-06-20)

| Tool        | Status      | Needed for | Notes                                            |
|-------------|-------------|------------|--------------------------------------------------|
| Go 1.25.5   | ✅ present   | Phases 2,5 |                                                  |
| Node 24.12  | ✅ present   | Phase 3    | npm used for circomlib / snarkjs                 |
| Docker 29.5 | ✅ present   | Phases 2,6 | Postgres container + compose                     |
| circom      | ✅ v2.2.3   | Phase 3    | Prebuilt binary via `scripts/install_circom.sh` → `scripts/bin/` (no Rust) |
| snarkjs     | ✅ installed | Phase 3   | `circuits/node_modules` (pinned in package.json), run via `npx`   |
| circomlib / circomlibjs | ✅ pinned | Phase 3 | 2.0.5 / 0.1.7 — matched Poseidon constants in-circuit ↔ off-chain |
| stellar CLI | ❌ missing   | Phase 4    | + Rust `wasm32-unknown-unknown` target           |
| golang-migrate (CLI) | ✅ installed | Phase 2 | `go install ...migrate/v4/cmd/migrate@latest` (postgres tag) |
| gcc / MinGW (for `-race`) | ✅ 16.1.0 | Phase 3+ | WinLibs UCRT at `C:\mingw64` (space-free path required by ld). Enables `go test -race` (cgo). |
| postgres (Docker img) | ✅ present | Phases 2,6 | `postgres:latest` cached; compose pins `postgres:16` |
| Docker daemon | ⚠️ manual  | Phases 2,6 | Docker Desktop must be running; engine not auto-started on boot |

## Phase 1 Checklist

- [x] `git init` on branch `main`
- [x] Directory topology: `/circuits` `/contracts` `/engine` `/docs` `/scripts`
- [x] `.gitignore` (Go / Node / Rust / env)
- [x] `STATUS.md` (this file)
- [x] `README.md`
- [x] Initial atomic commit `2721f31` → Phase 1 `DONE`

## Phase 2 Checklist

- [x] `go mod init github.com/nyx-darkpool/engine` (Go 1.25.5)
- [x] Scaffold `cmd/server`, `internal/{config,db,api,matcher}`, `db/migrations`
- [x] Migration `000001_init_schema` up/down — `orders`, `matches`, 3 enums, indexes, triggers
- [x] `internal/db/db.go` — pgxpool + Ping + `WithSerializableTx` helper
- [x] `internal/config/config.go` — env-driven, validated, fail-fast
- [x] `cmd/server/main.go` — slog, context propagation, graceful SIGINT/SIGTERM shutdown
- [x] `internal/api` `/healthz` (live DB ping); `internal/matcher` lifecycle stub
- [x] `go vet ./...` + `go build ./...` clean
- [x] Verified against Dockerized Postgres: up → constraints/triggers exercised → down → up round-trip
- [x] Atomic commit → record hash in ledger, flip Phase 2 to `DONE`

### Verification evidence (Phase 2)
- `migrate up` created 2 tables + 3 enums + 5 indexes/uniques per table.
- Negative tests passed: nullifier uniqueness rejected; self-match `CHECK` rejected.
- `updated_at` trigger confirmed firing on UPDATE.
- `migrate down -all` removed all tables + custom enums; re-`up` succeeded (reversible).

## Phase 3 Checklist (commits 0460143 → 70bdafd)

- [x] **A** `0460143` `chore(circuits)` — prebuilt circom v2.2.3 installer + pinned node deps
- [x] **B** `e71110a` `feat(circuits)` — `darkpool_match.circom` + trusted-setup pipeline + artifacts
- [x] **C** `a697ee9` `feat(db)` — additive `order_commitment` column (migration 000002)
- [x] **D** `05ac51b` `test(engine)` — unit tests for config, db, health API (+ Pinger seam)
- [x] **E** `ef74c09` `test(engine)` — integration tests: serializable tx + 40001 conflict
- [x] **F** `70bdafd` `feat(scripts)` — off-chain E2E proof-pipeline harness
- [x] **G** `docs(status)` — this update

### Verification evidence (Phase 3 + hardening)
- **Circuit:** compiled to 1539 R1CS constraints (2 public + 6 private); sample Groth16
  proof **verifies (`snarkjs groth16 verify` → OK!)**; `bad-cross` input correctly **fails**
  witness calc at the `lePrice.out === 1` assertion (price-cross enforced).
- **Migration 000002:** `migrate up`/`down 1`/`down -all` all clean (column added then dropped).
- **Unit tests:** `go test ./...` green (config/db/api).
- **Integration tests** (Dockerized Postgres, `-tags=integration`): `WithSerializableTx`
  commit/rollback/panic-rollback, and the **40001 serialization-conflict** test all PASS —
  exactly one of two racing tx commits, the other gets SQLSTATE 40001.
- **Off-chain E2E** (`internal/e2e`): seed → inline match → witness → proof → store
  `proof_blob` → off-chain verify; asserts `public.json == [maker_hash, taker_hash]`, both
  orders `matched`, duplicate-maker match rejected (23505), bad cross rejected. PASS.

### Testing conventions established (hardening)
- Unit tests run offline: `cd engine && go test ./...`.
- DB-dependent tests are gated by `//go:build integration` **and** `NYX_TEST_DB_URL`, so the
  default build needs no database: `go test -tags=integration ./...` (with the env var set).
- One-shot E2E: `NYX_TEST_DB_URL=... bash scripts/e2e_offchain.sh`.

### `go test -race` — SATISFIED (2026-06-22)
The manual mandates `go test -race ./...`. On Windows the race detector requires cgo + a C
compiler. A WinLibs MinGW UCRT toolchain (gcc 16.1.0) is installed at **`C:\mingw64`** (a
space-free path is required — `ld` cannot link from a path containing spaces). Results:

- **Unit:** `PATH=/c/mingw64/bin:$PATH CGO_ENABLED=1 go test -race ./...` → all `ok`, no races.
- **Integration + E2E:** `... NYX_TEST_DB_URL=... go test -race -tags=integration -p 1 ./...`
  → all `ok`, **no data races** — incl. the 40001 concurrency test under the race detector.

See `engine/README.md` → "Running tests with the race detector" for the exact commands.

## On-chain E2E (deferred to Phase 4)
The current E2E verifies the proof **off-chain** (snarkjs). A `PHASE-4 HOOK` marker in
`engine/internal/e2e/e2e_integration_test.go` and `scripts/e2e_offchain.sh` flags the single
seam where the Soroban `verify_and_settle` call replaces/augments the off-chain verify. The
`matches` schema (`proof_blob`, `onchain_status`, `settlement_tx`) already models on-chain
settlement, so Phase 4 needs no migration to wire it.
