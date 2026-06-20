# Nyx Darkpool: Comprehensive System Architecture & Agent Operations Manual

## 1. AGENT DIRECTIVES & RULES OF ENGAGEMENT
You are operating as a Staff-level Blockchain Architect and Principal Backend Engineer. You have terminal access and must act autonomously within the bounds of this manual. 

### 1.1 Core Operating Principles
*   **Zero-Assumption / No Hallucinations:** If a dependency, tool, or config is missing, install it, configure it, and document it. Do not use mock data for cryptographic functions.
*   **Atomic State Tracking:** You must create and maintain a `STATUS.md` file in the root directory. Before starting any step, update `STATUS.md` to "IN PROGRESS". After completion, update it to "DONE" with the commit hash. If you lose context, read `STATUS.md` first.
*   **Self-Verification (TDD):** After writing code, you MUST run the corresponding linter, compiler, or test command. (e.g., `go test -race ./...`, `cargo test`, `circom --r1cs`). Fix all warnings before proceeding.
*   **Atomic Commits:** After completing a step and passing tests, stage and commit the work using Conventional Commits (e.g., `feat(engine): implement concurrent order matcher`).
*   **Error Handling:** No silent failures. If a command fails, output the trace, analyze the root cause, apply the fix, and re-test.

---

## 2. SYSTEM TOPOLOGY & MICROSTRUCTURE
Nyx is a ZK-shielded Request-for-Quote (RFQ) and order book system for institutional RWA trading on the Stellar network.

### 2.1 The Cryptography (`/circuits` - Circom 2.0)
*   **Logic:** Proves that two encrypted orders (Maker and Taker) intersect at a valid price and volume without revealing the exact values to the public mempool.
*   **Primitives:** Use `circomlib` for Poseidon hashing (Stellar P25/26 native friendly) and Comparators.
*   **Proof System:** Groth16 over the BN254 curve.
*   **Output:** Generates `verification_key.json` and a WASM witness generator.

### 2.2 The Matching Engine (`/engine` - Golang 1.22+ & PostgreSQL)
*   **Role:** Off-chain sequence-matcher. Ingests encrypted orders, manages a highly concurrent state, and prevents latency arbitrage.
*   **Concurrency:** Use worker pools with Go channels to batch executions.
*   **Database Integration:** Use `pgx` (pure Go Postgres driver). Transaction isolation must be set to `Serializable` for matching logic to prevent race conditions.
*   **Proof Routing:** The Go engine acts as the orchestrator, calling `snarkjs` (via `os/exec` or CGO bindings) to generate the actual Groth16 proof once a match is found.

### 2.3 The Settlement Layer (`/contracts` - Soroban / Rust)
*   **Role:** Pure on-chain verifier and asset settlement layer.
*   **Logic:** Uses Stellar's Protocol 26 BN254 host functions (`verify_groth16` equivalents) to validate the proof submitted by the Go engine. If valid, it executes the token swap securely.
*   **Environment:** `#![no_std]` Rust.

---

## 3. STRICT QUALITY & HARDENING CONSTRAINTS
*   **Golang:** Implement strict `context.Context` propagation. Use structured logging (`slog` or `zerolog`). Implement graceful shutdown catching `SIGTERM`.
*   **Postgres:** Normalized schemas. Use UUIDv4 for IDs. Indexes on `status`, `asset_pair`, and `created_at`.
*   **Circom:** Prevent under-constrained signal vulnerabilities. Every intermediate signal must be strictly constrained. Use nullifiers to prevent double-spending of orders.
*   **Soroban:** Implement strict `require_auth` checks. Minimize state storage. Handle proof verification failures gracefully.

---

## 4. SEQUENTIAL EXECUTION PROTOCOL
Execute the following steps sequentially. **Do not move to Step N+1 until Step N compiles, passes validation, and is committed.** Update `STATUS.md` at every state change.

### Phase 1: Workspace & State Initialization
1. Initialize a new Git repository.
2. Create directories: `/circuits`, `/contracts`, `/engine`, `/docs`, `/scripts`.
3. Create `STATUS.md` tracking the phases below.
4. Create a comprehensive `README.md`.
5. Run: `git add . && git commit -m "chore: initialize workspace and manuals"`

### Phase 2: Database Schema & Engine Boilerplate
1. `cd engine && go mod init github.com/nyx-darkpool/engine`
2. Scaffold: `/cmd/server`, `/internal/db`, `/internal/matcher`, `/internal/api`.
3. Install `golang-migrate/migrate`. Create `db/migrations/000001_init_schema.up.sql`.
    *   Table `orders`: id (uuid), pubkey (varchar), encrypted_blob (bytea), price_hash (varchar), volume_hash (varchar), status (enum: open, matched, settled), created_at.
    *   Table `matches`: id, maker_order_id, taker_order_id, proof_blob (bytea), onchain_status.
4. Write `internal/db/db.go` using `pgxpool` with a ping test.
5. Verify (run a local postgres docker container and apply migrations), stage, and commit.

### Phase 3: ZK Circuit Construction (Circom)
1. `cd circuits && npm init -y && npm install circomlib snarkjs`
2. Write `darkpool_match.circom`.
    *   Inputs: `private maker_price`, `private taker_price`, `private maker_volume`, `private taker_volume`, `private maker_salt`, `private taker_salt`.
    *   Public Inputs: `maker_hash`, `taker_hash`.
    *   Logic: Verify `maker_price <= taker_price`. Verify `maker_volume == taker_volume` (or handle partial fills if complex). Verify Poseidon hashes match public inputs.
3. Write `scripts/compile_circuit.sh`:
    *   Run `circom darkpool_match.circom --r1cs --wasm --sym`
    *   Run snarkjs Powers of Tau (Phase 1 & Phase 2 setup).
    *   Export `verification_key.json` and generate a sample `proof.json`.
4. Execute script, fix constraint errors, stage, and commit.

### Phase 4: Soroban Verifier Contract
1. `cd contracts && stellar contract init nyx-verifier`
2. Update `Cargo.toml` for `#![no_std]` and Soroban SDK.
3. Implement `src/lib.rs`.
    *   Define the interface: `fn verify_and_settle(env: Env, proof_a: BytesN<64>, proof_b: BytesN<128>, proof_c: BytesN<64>, public_inputs: Vec<BytesN<32>>) -> Result<(), Error>`
    *   Integrate Stellar's BN254 host functions to verify the Groth16 proof.
4. Write Rust tests mocking a valid and invalid proof payload.
5. Run `cargo test`. Fix errors, stage, and commit.

### Phase 5: Off-Chain Engine Logic (Golang)
1. In `/engine/internal/matcher`, build the matching worker pool.
2. Logic: Query Postgres for `status = 'open'`. Group by asset pairs. In a transactional block, match compatible orders.
3. Once matched, write Go code that shells out to `snarkjs` (or uses a wrapper) to execute the WASM witness generation and create the Groth16 proof using the matched orders' raw data.
4. Save the resulting `proof_blob` to the `matches` table.
5. Write tests using `go test -race ./...`. Stage, and commit.

### Phase 6: Orchestration & Dockerization
1. Create a `docker-compose.yml` in the root that spins up:
    *   PostgreSQL 16.
    *   The Golang Engine.
2. Create a `Makefile` with commands: `make up`, `make down`, `make test-all`, `make circuits`, `make contracts`.
3. Test all Makefile commands.
4. Final commit: `feat: complete end-to-end Nyx darkpool architecture`.

Acknowledge this manual by creating the `STATUS.md` file, summarizing your strict operating directives, and automatically beginning Phase 1.