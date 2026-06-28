# Nyx Darkpool — Build Status

> **Atomic State Tracker.** This file is the single source of truth for build progress.
> On any context reset, **read this file first.** Update it to `IN PROGRESS` before
> starting a phase and to `DONE` (with the commit short-hash) after a phase compiles,
> passes validation, and is committed.

_Last updated: 2026-06-26 (Phase 6 DONE; live demo + multi-pair DONE; **CLOUD DEPLOY LIVE — web on Vercel + engine/PG on Render, on-chain settlement verified through the public URL**)_

> **🌐 LIVE deployment (2026-06-26):** web **<https://nyx-darkpool.vercel.app>** (Vercel, GitHub-linked
> → auto-deploys) → engine **<https://nyx-engine.onrender.com>** (Render `srv-d8v8f0po3t8c73f7c86g`,
> from [`render.yaml`](render.yaml): free Postgres + the self-contained Docker engine, on-chain on).
> **Verified end-to-end through the public Vercel URL:** a signed order posted to
> `https://nyx-darkpool.vercel.app/api/engine/orders` → matched → `has_proof:true` → **settled on
> Stellar testnet** → tx `c103e539c3b3c3d13747d0feb16cd66f87eb5e6501db42da3344ca623777f94f`
> (Horizon `successful:true`, ledger 3293883). The Render engine auto-funded its own testnet submitter
> (`GC5BZPPP…KZZ5`) at boot — zero secrets. **Test it:** walk every screen with
> [`docs/test-checklist.md`](docs/test-checklist.md) (QA sweep); present it with
> [`docs/demo-script.md`](docs/demo-script.md). _Note: both hosts auto-deploy on push to `main`
> (Render `autoDeploy`, Vercel git-connected); if a future git-triggered Vercel build fails, confirm
> Root Directory = `web` in the Vercel project settings._

## Phase Ledger

| Phase | Description                                   | Status      | Commit  |
|-------|-----------------------------------------------|-------------|---------|
| 1     | Workspace & State Initialization              | DONE        | 2721f31 |
| 2     | Database Schema & Engine Boilerplate (Go/PG)  | DONE        | 26ca3ed |
| 3     | ZK Circuit Construction (Circom + snarkjs)    | DONE        | 70bdafd |
| 4     | Soroban Verifier Contract (Rust)              | DONE        | cf9b035 |
| 5     | Off-Chain Engine Logic (Go matcher + proofs)  | DONE        | 3931aa2 |
| 5.1   | At-rest encryption + frontend wiring + testnet | DONE        | 5190040 |
| 5.2   | Desk auth (signed orders) + demo-mode + receipt | DONE        | a5e2678 |
| 6     | Orchestration & Dockerization                 | DONE        | c80dfe3 |

> **Phase 5.1** closes the honest notes from Phase 5: (A) AES-256-GCM **at-rest encryption** of the
> order blob (ephemeral key by default — no secret on disk); (B) wiring the `web/` frontend to the
> engine API (real Poseidon commitment → live order/match screens); (C) a **public testnet** deploy
> of the verifier so the contract + settlement tx are browsable on stellar.expert (the Phase-5
> on-chain run was on a local ephemeral network). Plus a CLAUDE.md/READMEs as-built sync.

### Phase 5.1 — verification evidence (2026-06-25)
**Commits:** `f658ae4` (open) · `05b5aa1` (encryption) · `0e9c137` + `b71da63` + `5190040` (FE wiring)
· `dd73326` (testnet preflight) · docs (this).

- **At-rest encryption (`internal/secret`, AES-256-GCM):** offline `go test ./...` + `-race` green;
  integration test `TestEncryptedBlobIsCiphertext` asserts the raw `encrypted_blob` is **ciphertext**
  (not valid JSON) yet the matcher still decrypts and matches. Live smoke: `SELECT encrypted_blob`
  showed the `NYX1` magic prefix + binary body. Default key is **ephemeral** (no secret on disk);
  `NYX_BLOB_KEY` persists across restarts. **PASS.**
- **Frontend ⇄ engine (full observable flow):** `next build` green (all 14 routes static islands).
  Live smoke: engine on `:8080` + `next start` on `:3000` → composing/seeding a crossing pair → the
  browser's relative `/api/engine/*` proxied to the engine returned the live matched orders; the
  **browser-computed Poseidon commitment exactly equals `gen_input.js`** (verified:
  `7440473553369986675637128923308304686069855711795512973251536680399749149066`), so a
  frontend-sealed order is genuinely provable (`GET /matches/{id}` → `has_proof: true`). **PASS.**
- **Public testnet deploy (protocol 27):** `NYX_SOROBAN_NETWORK=testnet bash scripts/deploy_contract.sh`
  → contract **`CBAFC6W5IWQC5AB6LFMFI4KB4DZT23BU2O2AJ2H3B2727DO37DOJGJRV`**, deployer/submitter
  **`GAW2WLHI5YHCE7FMB4TB7MLE2RIKQGOTPMC2NV66KKFTX6LGYMNT3YRK`** (friendbot-funded — no real value).
  The matcher's auto-settle drove a real `verify_and_settle` → tx
  **`b78e514e0f2b4078218ab12627a5d260f9895943ef64b60e5040b55df1d4a10e`** (RPC `getTransaction` =
  **SUCCESS**, ledger 3273424). **PASS.**
  - Contract: <https://stellar.expert/explorer/testnet/contract/CBAFC6W5IWQC5AB6LFMFI4KB4DZT23BU2O2AJ2H3B2727DO37DOJGJRV>
  - Settlement tx: <https://stellar.expert/explorer/testnet/tx/b78e514e0f2b4078218ab12627a5d260f9895943ef64b60e5040b55df1d4a10e>

### Phase 5.2 — verification evidence (2026-06-25)
**Commits:** `627352b` (engine sig verify) · `a5e2678` (desk auth) · `1866d86` (demo-mode) ·
`1d21196` (receipt) · docs (this). Closes the three Phase-5.1 loose ends.

- **Order signature verification (`internal/stellarkey` + API intake):** a minimal Stellar StrKey
  codec + `ed25519.Verify`. Offline `go test ./...` green (codec round-trip vs a real testnet
  G-address; signed-accept / tampered-401 / missing-401 / wrong-signer-401 API cases; unsigned still
  allowed when not enforced). Standalone `stellarkey.test.exe` tripped a Defender heuristic, so the
  tests run **inside `api.test.exe`** (which Defender accepts). **PASS.**
- **Cross-language auth (JS ⇄ Go), live:** engine with `NYX_REQUIRE_ORDER_SIG=true`; a
  `@stellar/stellar-base` signature (same lib the browser uses) over the commitment →
  `POST /orders` **201**; unsigned → **401** ("order signature required"); tampered → **401**
  ("invalid order signature"). **PASS.**
- **Desk auth + demo-mode, live:** `next build` green (all routes; `/app/access`+`/app/compose`+
  `/app/pool` bundle stellar-base). Simulated the demo-mode watcher against the enforcing engine: a
  signed user **BID** + an auto-posted signed crossing **ASK** (same price/volume, opposite side,
  fresh salt) → matcher paired both → `has_proof: true`. `/app/*` routes + the `/api/engine` proxy
  all 200 under `next start`. **PASS.**
- **Trust model:** desk identity is a real Stellar keypair; the engine verifies each order's
  ed25519 signature. The secret seed is held in `localStorage` for this client-only demo — a
  **documented seam** (production signs via the **Freighter** wallet, where the secret never leaves
  the extension). Full write-up: [`docs/key-custody.md`](docs/key-custody.md).

### Phase 6 — verification evidence (2026-06-26)
**Commit:** `c80dfe3` (`feat: complete end-to-end Nyx darkpool architecture`). One-command full stack
via `docker-compose.yml` + `Makefile`. **All six numbered phases are now complete.**

- **Stack:** `docker compose up -d` → 4 services. `postgres:16` healthy → one-shot **`migrate`**
  (`migrate/migrate`) applied `1/u init_schema` + `2/u order_commitment` and exited 0 → **`engine`**
  (image built from `engine/Dockerfile`, node:24 base) and **`web`** (Next `output:"standalone"`).
- **Engine in-container:** logs `database connected (host=postgres)` + `matcher started
  proving:true onchain:false`; `GET :8080/healthz` → `{"status":"ok","db":"up"}`. Seeding a crossing
  pair → both orders `matched` and `GET /matches/{id}` → **`has_proof: true`** — i.e. the Groth16
  proof was generated **inside the engine container** via Node + snarkjs off the bind-mounted
  `circuits/build` artifacts. `onchain_status: pending` (env-gated; on-chain stays the host/testnet
  opt-in). **PASS.**
- **Web in-container:** all routes 200; the Next standalone server proxies `/api/engine/*` to the
  engine. `ENGINE_ORIGIN` is baked at **build** time (Next bakes `rewrites()`), so the web image is
  built with `--build-arg ENGINE_ORIGIN=http://engine:8080`; the proxy then returns live engine data
  (verified: `routes-manifest.json` → `http://engine:8080/:path*`). **PASS.**

> ⏩ _Phase-6-era detail superseded by the **Cloud deploy** work below (2026-06-26): `circuits/build`
> is now **baked** into the engine image (not bind-mounted), and the web proxy is a **runtime** route
> handler reading `ENGINE_ORIGIN` per request (no `--build-arg`, no baked `rewrites()`)._
- **Makefile:** `up/down/down-v/logs/ps/migrate/seed/circuits/contracts/test-all/...`. **`make` is
  not installed on the Windows dev host**, so each target was validated via its 1:1 `docker compose`/
  `bash`/`go` equivalent (the targets are thin wrappers). `cd engine && go test ./...` stays green;
  `cd web && npm run build` green with `output:"standalone"`.

> Housekeeping commit `059ccac` (after Phase 2) replaced the empty-directory
> `.gitkeep` placeholders with descriptive `README.md` files in `circuits/`,
> `contracts/`, `docs/`, and `scripts/`.

### Live testnet demo + multi-pair selector — verification evidence (2026-06-26)
Post-Phase-6 polish so the live UI completes the *full* pipeline (incl. on-chain) and the pair
control actually works. Two user-facing issues were diagnosed and addressed:

1. **Proofs pipeline "stuck on Verifying on-chain", never reaching Atomic settlement.** Root cause:
   under `docker compose` `NYX_SOROBAN_CONTRACT_ID` is unset (and, at the time, the image also lacked
   the `stellar` CLI — later added in the Cloud deploy section), so on-chain settlement is off *by
   design* — `onchain_status` stays `pending` and the UI (which only advances stages 3–4 on
   `confirmed`) spins forever. The proof itself is real and stored (`has_proof:true`). **Fix:** a
   host-engine demo path with on-chain **on** —
   [`scripts/demo_testnet.sh`](scripts/demo_testnet.sh) + `make demo` (compose UX left untouched, per
   decision "Real testnet only").
2. **Pair dropdown frozen on US-TBILL-26/USDC.** It was a static `<div>` (no `<select>`). **Fix:** a
   real controlled `<select>` of 4 RWA pairs in `web/app/app/_components/ComposeForm.tsx`, threaded
   through `asset_pair` into Pool/Proofs/Settled and the demo-mode counterparty.

**Commits:** `8c0c8a5` (multi-pair selector) · `ac547a0` (demo runbook + Makefile) · docs (this) ·
plus a DB-port robustness fix (`docker-compose.demo.yml`, below).

- **Offline regression:** `cd engine && go vet ./... && go test ./...` green (no engine code changed);
  `cd web && npm run build` green — all 14 routes prerender with the new `<select>`. **PASS.**
- **Compose off-chain (proving in-container):** `docker compose up -d` + `seed_demo_orders.js` →
  match `b626e64a` → `GET /matches` `has_proof:true`, `onchain_status:pending` (no `settlement_tx`) —
  the proof is real; the chain leg is gated off. This is exactly the "stuck" the user saw. **PASS.**
- **Host engine + REAL testnet (`make demo`):** engine logs `matcher started proving:true
  onchain:true`. Posted a **browser-scale** crossing pair (price `9984` = 99.84×100, volume
  `5,000,000` — the exact compose-form domain) → match `2825ddb7` → `has_proof:true` →
  `submitted` → **`confirmed`** in ~9 s → `settlement_tx`
  **`0706f517bac065f62151dfb6699e6b0da8da7ee85544f930aad277500e0a9dc9`**. Horizon confirms
  **`successful:true`, ledger 3284327**, source `GAW2WLHI…3YRK` (the `nyx-engine` identity).
  This proves browser-scale values prove + settle fine (the 64-bit circuit easily holds them — the
  "match located" symptom was the on-chain gating / async timing, **not** a proving/range bug).
  **PASS.** — <https://stellar.expert/explorer/testnet/tx/0706f517bac065f62151dfb6699e6b0da8da7ee85544f930aad277500e0a9dc9>
- **Multi-desk same-pair cross + multi-pair isolation:** two distinct desk pubkeys posting a crossing
  BID/ASK on `EU-BUND-30/USDC` → one **shared** match `f0cc7aaa`, settled on-chain
  (`settlement_tx 6c1372b0…449dcb`, `confirmed`); meanwhile a BID on `US-TBILL-27/USDC` + an ASK on
  `GOLD-RWA/USDC` stayed **open** (different pairs never cross). **PASS.**
- **DB-port robustness (`docker-compose.demo.yml`):** the host engine reaches the compose Postgres
  over a published port; on this Windows host a **native Postgres already occupies `0.0.0.0:5432`**,
  so `localhost:5432` resolved to an IPv6 path with mismatched creds (SASL auth failed). The override
  publishes the compose DB on a dedicated **`127.0.0.1:5544`** and `demo_testnet.sh` points the host
  engine there — unambiguous regardless of a native 5432. In-network services still use
  `postgres:5432`.

**The live demo path** is documented in [`docs/demo-script.md`](docs/demo-script.md) (4-act runbook:
solo settle, two-desk/two-tab manual cross, "how do I know it's real"). `docker compose up` remains
the fast off-chain stack; `make demo` is the real-on-chain demo.

### Cloud deploy — Vercel web + Render engine/PG (self-contained on-chain) — 2026-06-26
Makes the stack deployable to the cloud with **on-chain settlement working and zero host dependency**
(a judge opens a URL — no `make demo` on our laptop). Decisions: on-chain key = **auto-generate +
friendbot-fund** (zero secrets); web→engine = **runtime proxy** (env-configurable, no rebuild); split
= **web→Vercel (GitHub-linked), engine+Postgres→Render** (Railway was the original plan; its free plan
blocked provisioning — see the LIVE callout at the top + the "Deploy hosting" note below).

**Commits:** `a3e4bbc` (engine self-containment) · `9e7981a` (runtime proxy) · `aa5bfdf` (verified
image + `render.yaml`) · `a7d2bf1` (deploy docs).

- **Engine image is self-contained (`engine/Dockerfile`).** Bakes the two runtime circuit artifacts
  (`darkpool_match.wasm` 1.8 MB + `darkpool_match_final.zkey` 698 KB — force-tracked via
  `.gitignore`/`.dockerignore` negations; verified `git add -n circuits/build/` stages **only** those
  two, ptau/r1cs/sym stay ignored), installs the **Linux `stellar` CLI v27** + **golang-migrate** on a
  full `node:24` base (no apt — avoids flaky Debian mirrors), and runs
  `engine/docker-entrypoint.sh` → migrations on boot + (when `NYX_SOROBAN_CONTRACT_ID` set)
  **auto-generate + friendbot-fund** a testnet submitter (or import `NYX_SOROBAN_SECRET`). No engine
  Go changes; no host bind-mount; no host CLI.
- **Runtime web→engine proxy — VERIFIED.** `web/app/api/engine/[...path]/route.ts` (a `nodejs`
  `force-dynamic` route handler) reads `ENGINE_ORIGIN` per request; the build-time `rewrites()` is
  removed. `next build` shows it as `ƒ /api/engine/[...path]` (dynamic function). Live: built web
  (`next start`) with **runtime** `ENGINE_ORIGIN=http://localhost:8080` against a host engine →
  `/api/engine/healthz` → `{"status":"ok"}`; `/api/engine/orders?limit=2` → live orders (GET + query
  passthrough); `POST /api/engine/orders` (bad body) → engine's **400** passed through (POST + body +
  status). This is the exact code path Vercel runs. `web/Dockerfile` dropped the build-ARG;
  `docker-compose.yml` sets `ENGINE_ORIGIN` at runtime and no longer bind-mounts `circuits/build`.
- **Offline regression:** `go vet ./... && go test ./...` green (no engine code changed);
  `cd web && npm run build` green (14 routes + the new dynamic proxy).
- **Runbook:** [`docs/deploy.md`](docs/deploy.md) (Vercel web + Render engine/PG, env tables,
  friendbot/auto-fund, testnet-reset → redeploy-CID; Railway/Fly as host-agnostic alternatives) + root
  `render.yaml` Blueprint.

- **Self-contained image — BUILT + on-chain settle VERIFIED from a bare container.**
  `docker build -f engine/Dockerfile -t nyx-engine-cloud .` succeeds; `docker run` it with **no
  `circuits/build` mount and no host stellar CLI** (only `NYX_DATABASE_URL` + `NYX_SOROBAN_CONTRACT_ID`
  + `NYX_SOROBAN_NETWORK=testnet`) → entrypoint logs `applying DB migrations… OK` →
  `generating + friendbot-funding stellar identity 'nyx-engine'` → `on-chain submitter:
  GAGVGFDW…OYXQ` (a **fresh auto-funded** address) → `matcher started proving:true onchain:true`.
  Posted a browser-scale crossing pair → `has_proof:true` (proving off the **baked** artifacts) →
  `submitted` → **`confirmed`** → `settlement_tx`
  **`2a9999a23fa6126e48326cc08f0ed12b5a55d4143edbc3f03050e0cf1034c439`**, Horizon
  **`successful:true`, ledger 3293331**, source = the container's auto-funded submitter. This is the
  Railway/Render-equivalent proof: the image needs **nothing** from the host. **PASS.** —
  <https://stellar.expert/explorer/testnet/tx/2a9999a23fa6126e48326cc08f0ed12b5a55d4143edbc3f03050e0cf1034c439>

> **Build-robustness notes (for cloud builds):** the stellar CLI dynamically links `libdbus-1.so.3`
> (its keyring backend), absent from `node:24` — fetched from the Debian **snapshot** archive in the
> build stage and `COPY`-ed in (no apt → works on networks/CDNs that 403 the Debian pool, e.g. this
> dev host). Binary downloads use `curl --retry-all-errors -C -`; `npm ci` uses `--fetch-retries`.
> The engine honours a platform-injected `$PORT` (Render/Heroku/Fly) via `docker-entrypoint.sh`.

> **Deploy hosting:** Railway was attempted first but its **free plan blocked new-project
> provisioning** ("resource provision limit exceeded"), so the engine host is **Render** (Blueprint
> [`render.yaml`](render.yaml) — free Postgres + the engine Docker service, on-chain wired). Web →
> Vercel. See [`docs/deploy.md`](docs/deploy.md).

## Frontend Track (parallel to the manual's 6 phases)

The Nyx brand + product UI was built as a **parallel initiative** (not one of CLAUDE.md's six
numbered phases) and lives in `web/` — a **Next.js (App Router, TypeScript)** app. Status: **DONE
(build-verified; backend logic pending)**.

| Step | Description                                                              | Commit  |
|------|--------------------------------------------------------------------------|---------|
| F1   | Brand board + landing/app/directions from Claude Design (static HTML)    | a1a363b |
| F2   | Convert the design deliverables into a Next.js app                       | cdc9a75 |
| F3   | Make the landing interactive + build the `/app` product frontend         | 16b4899 |

- **Surfaces:** `/` marketing landing (with the schematic "Four steps" settlement-path graph),
  `/app/*` the interactive product frontend (access → desk → compose & seal → pool → proofs →
  settled), and embedded design showcases `/brand-board` + `/directions`; `/deliverables` hub.
- **Source of truth:** the four Claude Design canvases in `web/design-src/*.dc.html` (untouched);
  the landing + app are real TSX, the showcases are rendered verbatim.
- **Verified:** `next build` green — all routes prerender; `npm start` smoke test → every route 200.
- **Wired to the engine (Phase 5.1):** the `/app` screens now call the engine via a Next rewrite
  proxy (`/api/engine/*` → `ENGINE_ORIGIN`). Compose seals a **real Poseidon commitment** (circomlibjs)
  and `POST`s `/orders`; Desk/Pool/Proofs/Settled poll `GET /orders` + `GET /matches/{id}` for live
  match/proof/settlement state. `web/README.md` documents the routes, the wiring, and the demo flow.
- **Desk auth + demo-mode (Phase 5.2):** `/app/access` generates/imports a real **Stellar keypair**;
  `AuthGate` gates `/app/*`; the G-address is the order `pubkey` and every order is **signed**
  (engine-verified). A default-ON **Demo-Mode** auto-posts a crossing signed counter-order (race
  fallback for real multi-tab crossing); the Settled screen downloads a JSON receipt.

## Repository State

- **Branch:** `main` · **Remote:** `origin` (github.com/Manuel-dev01/nyx-darkpool)
- **Local is ahead of `origin/main`** by the Phase 3 + Phase 4 commits — the user pushes when
  ready (last verified-synced point was `059ccac` on 2026-06-21).
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
| Rust (rustc/cargo) | ✅ 1.96.0 | Phase 4 | GNU host, offline-installed at `C:\rust-gnu`, linked into rustup as `nyx-gnu` (see note) |
| wasm targets | ✅ installed | Phase 4 | `wasm32v1-none` (used by `stellar contract build`) + `wasm32-unknown-unknown`, merged into `C:\rust-gnu` |
| stellar CLI | ✅ v27.0.0  | Phase 4    | prebuilt binary at `scripts/bin/stellar.exe`     |
| soroban-sdk | ✅ 26.1.0    | Phase 4    | `bn254` module (G1/G2/Fr, pairing_check, g1_msm) — not feature-gated |
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

## On-chain E2E seam
The off-chain E2E verifies the proof with snarkjs; the `PHASE-4 HOOK` in
`engine/internal/e2e/e2e_integration_test.go` is now wired to the deployed Soroban contract
(gated by `NYX_SOROBAN_CONTRACT_ID`). The `matches` schema (`proof_blob`, `onchain_status`,
`settlement_tx`) modeled on-chain settlement from Phase 2, so no migration was needed.

## Phase 4 Checklist (commits 8744e6a → 74b1a86)

- [x] **A** `8744e6a` `feat(scripts)` — `proof_to_bytes.js` + BN254 `.bin` fixtures
- [x] **B** `cf9b035` `feat(contracts)` — BN254 Groth16 verifier + settlement seam
- [x] **C** `539c79b` `feat(engine)` — env-gated Soroban on-chain bridge (`internal/onchain`)
- [x] **D** `74b1a86` `feat(engine)` — wire e2e PHASE-4 hook + deploy/e2e-onchain scripts
- [x] **E** `c8865ac` `docs(status)` — Phase 4 done
- [x] **F** `4d942f6` `fix(engine)` — stellar invoke arg format + tx-hash parsing (live-validated)
- [x] **G** `3306f4f` `fix(scripts)` — pin Soroban **protocol 26** in `deploy_contract.sh` + RPC
  self-check (a fresh run otherwise boots protocol 25 and fails contract upload); re-verified
  end-to-end with a from-scratch `scripts/e2e_onchain.sh` deploy + on-chain `verify_and_settle`.
- [x] **Live deploy + on-chain e2e run COMPLETE** — deployed to a local Soroban network
  (Docker quickstart, **protocol 26**) and the real Phase-3 proof verified live on-chain.

### Verification evidence (Phase 4)
- **Contract `cargo test`: 6/6 pass**, incl. `valid_proof_verifies` — the **REAL Phase-3 proof
  verifies natively on-chain** via soroban-sdk 26.1.0 BN254 `pairing_check` (proves the byte
  encoding + verifier math). Tamper (proof + public input), replay (`AlreadySettled`),
  wrong-input-count, and missing-auth are all rejected.
- **`stellar contract build` → 6408-byte optimized wasm** (`wasm32v1-none`).
- **G2 byte-ordering footgun resolved up front** by reading the SDK source: soroban-sdk 26.1.0
  documents G1 = `be(X)||be(Y)`, G2 Fp2 = `be(c1)||be(c0)` — matching `proof_to_bytes.js`
  defaults (`G2_ORDERING=c1c0`, `FE_ENDIAN=big`), so the real proof verified first try.
- **Offline `go test ./...` stays green** — the on-chain bridge is disabled unless
  `NYX_SOROBAN_CONTRACT_ID` is set; `internal/onchain` has offline unit tests.
- **LIVE on-chain run (local Soroban network, protocol 26):**
  - Deployed `nyx-verifier`; `verify_and_settle` with the REAL proof → tx success, `Settled`
    event emitted with the correct maker/taker commitments.
  - `is_settled` → `true`; **replay → `Error(Contract, #3)` = AlreadySettled** (on-chain anti-replay).
  - Full Go bridge E2E (`scripts/e2e_onchain.sh`): engine seeds match → proof → deploy →
    invoke → `matches.onchain_status='confirmed'`, `settlement_tx=<64-hex>`. **PASS.**
  - Protocol note: the network MUST run **protocol ≥ 26** (soroban-sdk 26.1 wasm + `g1_msm`).
    Start with `stellar container start local --protocol-version 26` (default boots 25, which
    fails contract upload).

### Toolchain install note (Phase 4)
`rustup`'s downloader repeatedly stalled/hung on this network (the 101 MB `rustc` component;
also Windows rename `os error 145`). Worked around by downloading the rust component tarballs
directly with resumable `curl -C -`, doing an **offline install** into `C:\rust-gnu`, and
linking it into rustup (`rustup toolchain link nyx-gnu C:\rust-gnu`; `rustup default nyx-gnu`).
`stellar contract build` targets **`wasm32v1-none`** (not `wasm32-unknown-unknown`) — its std
was likewise merged in. To rebuild: `PATH=$HOME/.cargo/bin:/c/mingw64/bin:...` then
`cargo test` / `stellar contract build` from `contracts/nyx-verifier`.

### Signature deviation (documented)
`verify_and_settle` adds a leading `submitter: Address` vs CLAUDE.md's signature, because
`require_auth` needs a principal. Proof argument types (`BytesN<64>/<128>/<32>`,
`Vec<BytesN<32>>`) are exactly as specified. Auth gates the settlement state write; the
Groth16 pairing check is the cryptographic gate.

## Phase 5 Checklist (commit 3931aa2)

- [x] **order** — `internal/order`: `Order` type + `encrypted_blob` payload codec (price/volume/salt).
- [x] **store** — `internal/store`: open-orders scan, atomic `CreateMatch` (SERIALIZABLE +
  open→matched guard), `SetProof`/`SetOnchain`, read views; sentinels `ErrAlreadyMatched` /
  `ErrSerialization` / `ErrDuplicate`.
- [x] **prove** — `internal/prove`: snarkjs `wtns calculate` → `groth16 prove` via `os/exec` in a
  per-call `os.MkdirTemp` (concurrency-safe); `ToHexProof` reuses `scripts/proof_to_bytes.js`.
- [x] **matcher** — `internal/matcher` rewrite: poll loop pairs crossing ask/bid (price cross +
  equal volume, FIFO) + dispatches `proof_blob IS NULL` matches (crash-safe) to a bounded worker
  pool; workers prove → `SetProof` → (if `NYX_SOROBAN_CONTRACT_ID`) `verify_and_settle` →
  `SetOnchain`. Graceful drain on ctx cancel.
- [x] **config / api / wiring** — `NYX_MATCHER_WORKERS`/`POLL_INTERVAL`, `NYX_CIRCUITS_ROOT`,
  `NYX_SCRIPTS_ROOT`, `NYX_NODE_BIN`; `POST /orders` + `GET /orders` + `GET /matches/{id}`;
  `onchain.ResolveAddress`; `cmd/server` constructs store + prover + bridge.
- [x] **docs(status)** — this update.

### Verification evidence (Phase 5)
- **Offline `go test ./...` + `-race`**: all packages green, no data races
  (`PATH=/c/mingw64/bin:$PATH CGO_ENABLED=1 go test -race ./...`). Unit coverage: `pairOrders`
  (cross/no-cross, equal/unequal volume, FIFO, multi-pair), payload codec, `prove.InputFor`,
  matcher config, and the `POST /orders`/read handlers.
- **Integration (Dockerized Postgres, `-tags=integration -p 1`, under `-race`)**:
  - `matchOnce` pairs a crossing ask/bid and leaves a non-crossing pair open.
  - **Racing-matchers test**: two matchers over one book → exactly N matches, **zero orders in
    more than one match** (SERIALIZABLE + UNIQUE maker/taker prevent double-spend).
  - **Proof pipeline**: real match → `prove.Generate` → `proof_blob` stored is a valid
    `protocol:"groth16"` proof (4.3s).
- **On-chain auto-settle (full pipeline, fresh contract `CC5GPL2Y…BOAXQ`, protocol 26)**: the
  matcher's `proveAndSettle` drove `verify_and_settle` on-chain →
  `matches.onchain_status='confirmed'`, `settlement_tx=d4cfcbc3…760af6c`. **PASS.**

### Trust model (documented)
The engine is the **off-chain prover/sequencer**, so it sees raw order values to match and prove —
they live in `orders.encrypted_blob` (plaintext-at-rest for this build; **at-rest encryption is a
future hardening seam**). Privacy is **vs. the public chain/mempool**, which only ever sees the
Poseidon commitment + the proof — never price/volume. A client whose sealed `commitment` ≠
`Poseidon(price,volume,salt)` simply yields an unprovable order (witness calc fails — no wrong
proof can be produced). On-chain settlement stays **env-gated** (`NYX_SOROBAN_CONTRACT_ID`), so
offline `go test ./...` needs no network/contract.

### Frontend wiring (next, optional)
The `web/` product frontend (`/app`) is built but not yet pointed at these endpoints; wiring
`POST /orders` + `GET /matches/{id}` into the Compose/Pool/Proofs/Settled screens is the natural
follow-on (Phase 6 brings the `docker-compose`/`Makefile` that runs engine + Postgres together).
