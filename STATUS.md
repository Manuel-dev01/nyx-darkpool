# Nyx Darkpool — Build Status

> **Atomic State Tracker.** This file is the single source of truth for build progress.
> On any context reset, **read this file first.** Update it to `IN PROGRESS` before
> starting a phase and to `DONE` (with the commit short-hash) after a phase compiles,
> passes validation, and is committed.

_Last updated: 2026-06-20 (Phase 2 complete)_

## Phase Ledger

| Phase | Description                                   | Status      | Commit  |
|-------|-----------------------------------------------|-------------|---------|
| 1     | Workspace & State Initialization              | DONE        | 2721f31 |
| 2     | Database Schema & Engine Boilerplate (Go/PG)  | DONE        | 26ca3ed |
| 3     | ZK Circuit Construction (Circom + snarkjs)    | PENDING     | —       |
| 4     | Soroban Verifier Contract (Rust)              | PENDING     | —       |
| 5     | Off-Chain Engine Logic (Go matcher + proofs)  | PENDING     | —       |
| 6     | Orchestration & Dockerization                 | PENDING     | —       |

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
| circom      | ❌ missing   | Phase 3    | Install Rust circom binary before circuit build  |
| snarkjs     | ❌ missing   | Phase 3    | `npm install` inside `/circuits`                 |
| stellar CLI | ❌ missing   | Phase 4    | + Rust `wasm32-unknown-unknown` target           |
| golang-migrate (CLI) | ✅ installed | Phase 2 | `go install ...migrate/v4/cmd/migrate@latest` (postgres tag) |
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
