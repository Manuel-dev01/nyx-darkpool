# Nyx Darkpool — Build Status

> **Atomic State Tracker.** This file is the single source of truth for build progress.
> On any context reset, **read this file first.** Update it to `IN PROGRESS` before
> starting a phase and to `DONE` (with the commit short-hash) after a phase compiles,
> passes validation, and is committed.

_Last updated: 2026-06-20_

## Phase Ledger

| Phase | Description                                   | Status      | Commit  |
|-------|-----------------------------------------------|-------------|---------|
| 1     | Workspace & State Initialization              | IN PROGRESS | —       |
| 2     | Database Schema & Engine Boilerplate (Go/PG)  | PENDING     | —       |
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

## Phase 1 Checklist

- [x] `git init` on branch `main`
- [x] Directory topology: `/circuits` `/contracts` `/engine` `/docs` `/scripts`
- [x] `.gitignore` (Go / Node / Rust / env)
- [x] `STATUS.md` (this file)
- [ ] `README.md`
- [ ] Initial atomic commit → record hash above, flip Phase 1 to `DONE`
