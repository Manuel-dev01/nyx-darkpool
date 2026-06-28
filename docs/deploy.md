# Deploying Nyx Darkpool to the cloud (Vercel + Render)

This deploys the **whole stack to the cloud with on-chain settlement working** — no laptop, no
`make demo`, nothing local. A judge just opens the Vercel URL and the full pipeline (match → prove →
**verify_and_settle on Stellar testnet**) runs end-to-end.

> **Live deployment (2026-06-26):** web **<https://nyx-darkpool.vercel.app>** (Vercel, GitHub-linked) →
> engine **<https://nyx-engine.onrender.com>** (Render Blueprint, service `srv-d8v8f0po3t8c73f7c86g`) +
> a Render-managed Postgres. Verified end-to-end through the public URL — a signed order settled on
> Stellar testnet (see [`../STATUS.md`](../STATUS.md) for the tx). The engine host is **Render**;
> Railway was the original plan but its free plan blocked new-project provisioning (kept below as an
> alternative — the image is host-agnostic).

## Topology

```
  Browser ──> Vercel (Next.js web, public)
                 │  /api/engine/*  (server-side route handler, reads ENGINE_ORIGIN at runtime)
                 ▼
              Render engine (Go matcher + snarkjs + stellar CLI, PUBLIC URL)
                 ├──> Render Postgres (managed)
                 └──> Stellar testnet  (verify_and_settle on the deployed nyx-verifier)
```

- **Web → Vercel** (GitHub-linked, CI/CD on push). Vercel is built for Next.js.
- **Engine + Postgres → Render.** Render runs the long-lived Go matcher + Postgres + the `stellar`
  CLI (which Vercel's serverless model can't).
- **No CORS:** the browser only ever calls same-origin `/api/engine/*` on Vercel; the route handler
  ([`web/app/api/engine/[...path]/route.ts`](../web/app/api/engine/[...path]/route.ts)) forwards
  server-side to the engine. The only coupling is one env var, `ENGINE_ORIGIN`.

> The engine image is **fully self-contained** — it bakes the circuit artifacts (wasm + zkey), the
> Linux `stellar` CLI, and `golang-migrate`, and its entrypoint applies migrations and
> **auto-generates + friendbot-funds** a testnet submitter on startup. It needs nothing from the host.

---

## 1. Engine + Postgres — Render (the live host)

The engine image is host-agnostic (self-contained Docker). The **live deployment runs on Render**
via a Blueprint; **Railway** is documented afterwards as an alternative (its free plan blocked our
provisioning). Both build `engine/Dockerfile` on their own fast network and run it. Then do the
Vercel web step (§2).

### Option A — Render (Blueprint) ⭐ — the live host

Render is Git-driven and reads [`../render.yaml`](../render.yaml) (a Blueprint that provisions a free
Postgres + the engine Docker service, fully wired).

1. **Push this repo to GitHub.**
2. Render Dashboard → **New → Blueprint** → connect the repo → **Apply**. Render reads `render.yaml`,
   creates `nyx-postgres` (free) and builds + runs `nyx-engine` from `engine/Dockerfile`.
   - `NYX_DATABASE_URL` is auto-wired from the DB; `NYX_SOROBAN_CONTRACT_ID` / `NYX_SOROBAN_NETWORK` /
     `NYX_REQUIRE_ORDER_SIG` are set in the blueprint. The engine binds Render's `$PORT`
     (handled by `docker-entrypoint.sh`) and exposes `/healthz`.
3. Watch the deploy logs: `applying DB migrations… migrations OK` →
   `generating + friendbot-funding stellar identity 'nyx-engine'` → `on-chain submitter: G…` →
   `matcher started proving:true onchain:true`. The service URL is your **engine origin**
   (`https://nyx-engine-xxxx.onrender.com`).

> Free-tier caveats: a free web service **sleeps after ~15 min idle** (cold start ~1 min — fine for an
> interactive demo; the matcher resumes on the next request) and free Postgres has a limited lifetime.
> If `NYX_DATABASE_URL` needs SSL, append `?sslmode=require` to the wired value. For a 24/7 matcher,
> use a paid instance.

### Option B — Railway (alternative; not the live host)

> Railway's **free plan blocked new-project provisioning** during our deploy ("resource provision
> limit exceeded"), so the live engine runs on **Render** (Option A). These steps are kept for
> reference — on a paid plan they work, since the engine image is host-agnostic.

**Prereq:** push this repo to GitHub (Railway and Vercel both deploy from GitHub).

### 1a. Postgres
- New Railway project → **Add → Database → PostgreSQL**. Railway provisions it and exposes a
  `DATABASE_URL`.

### 1b. Engine service
- **Add → Deploy from GitHub repo** → pick this repo.
- **Settings → Build:**
  - **Root Directory:** repo root (the engine image needs `circuits/` + `scripts/`).
  - **Dockerfile Path:** `engine/Dockerfile`.
- **Settings → Networking → Generate Domain** (the engine must be **public** so Vercel's functions can
  reach it). Note the URL, e.g. `https://nyx-engine-production.up.railway.app`.
- **Variables:**

  | Variable | Value | Notes |
  |----------|-------|-------|
  | `NYX_DATABASE_URL` | `${{Postgres.DATABASE_URL}}` | reference the PG plugin's var |
  | `NYX_SOROBAN_CONTRACT_ID` | `CBAFC6W5IWQC5AB6LFMFI4KB4DZT23BU2O2AJ2H3B2727DO37DOJGJRV` | the deployed testnet verifier (enables on-chain) |
  | `NYX_SOROBAN_NETWORK` | `testnet` | CLI built-in (RPC + passphrase auto) |
  | `NYX_REQUIRE_ORDER_SIG` | `true` | recommended — the engine is public; the frontend always signs |
  | `NYX_BLOB_KEY` | _(optional)_ 64-hex | set a Railway secret so orders survive restarts (else an ephemeral key is used) |
  | `PORT` / `NYX_HTTP_ADDR` | leave default | image listens on `:8080`; map Railway's port to 8080 if prompted |

  > The engine **auto-funds its submitter** via friendbot at startup (zero secrets). To pin a stable
  > submitter address instead, set `NYX_SOROBAN_SECRET` (a funded `S…` seed) as a Railway secret.

- Deploy. The logs should show: `applying DB migrations… migrations OK` →
  `generating + friendbot-funding stellar identity 'nyx-engine'` → `on-chain submitter: G…` →
  `matcher started proving:true onchain:true`. Hit `https://<engine>/healthz` → `{"status":"ok"}`.

---

## 2. Vercel — the web app

- **New Project → Import the GitHub repo.**
- **Root Directory: `web`** (the repo is a monorepo; this is required). Vercel auto-detects Next.js;
  keep the default build/install commands.
- **Environment Variables:**

  | Variable | Value |
  |----------|-------|
  | `ENGINE_ORIGIN` | the engine's public URL, **no** trailing slash — live: `https://nyx-engine.onrender.com` |

- **Deploy.** Vercel builds `web/` and serves it. Because `ENGINE_ORIGIN` is read **at request time**
  by the route handler, you can change it anytime in Vercel → no rebuild. Every GitHub push
  auto-deploys.

Open the Vercel URL → `/app/access` → generate a desk → compose & broadcast → watch Proofs animate
to **Settled atomically** with a real stellar.expert tx. (See [`demo-script.md`](demo-script.md).)

---

## Verifying it end-to-end

- `curl https://nyx-engine.onrender.com/healthz` → `{"db":"up","status":"ok"}`.
- On the Vercel site, `https://nyx-darkpool.vercel.app/api/engine/orders` returns the live order list
  (proxied).
- Compose an order (Demo-Mode on) → the engine logs `proof generated` → `settled on-chain tx=…`; the
  Settled screen links to the tx on stellar.expert (status SUCCESS).

## Notes & operations

- **Testnet resets** (~quarterly) wipe deployed contracts. If `verify_and_settle` starts failing,
  redeploy the verifier from a host with the toolchain
  (`NYX_SOROBAN_NETWORK=testnet bash scripts/deploy_contract.sh`) and update
  `NYX_SOROBAN_CONTRACT_ID` on the Render engine. Mainnet is out of scope (needs a real funded key).
- **Public engine hardening:** with `NYX_REQUIRE_ORDER_SIG=true`, every `POST /orders` must carry a
  valid ed25519 signature (the frontend always signs). Read endpoints only ever return commitments —
  never price/volume. There are no admin/mutating endpoints.
- **Cost/scale:** the engine is a single small container; Postgres is Render's free instance. The
  proxy route handler is a thin Vercel function (one fetch per call).

## Alternative: all-Railway (web also on Railway)

The web Docker image stays valid if you'd rather keep everything on Railway:
- Add a **web** service: Root Directory `web`, Dockerfile `web/Dockerfile`.
- Set `ENGINE_ORIGIN=http://<engine>.railway.internal:8080` (Railway **private** networking — the
  engine can then stay private, no public domain needed).
- Generate a public domain for the **web** service only.

The engine is host-agnostic — the same image runs on Render or Fly (set the same env vars).
