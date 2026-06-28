# web — Nyx brand & product (Next.js)

The Nyx marketing site and product frontend as a **Next.js (App Router, TypeScript)** app.
The **landing** and **`/app`** are real, interactive TSX (working links, buttons, navigation,
form controls). The **brand-board** and **directions** routes remain embedded design showcases
(brand/exploration artifacts), rendered verbatim from the approved canvases.

## Run it

```bash
cd web
npm install
npm run dev      # http://localhost:3000
# or
npm run build && npm start
```

The marketing landing needs nothing else. The **`/app` product screens read live data from the Go
engine** through a proxy — start the engine (`../engine`, default `:8080`) and set `ENGINE_ORIGIN`
if it runs elsewhere (`cp .env.example .env.local`). Without the engine, `/app` renders its
loading/empty states.

**Whole stack in one command:** from the repo root, `docker compose up -d` (or `make up`) builds
this app as a Next **standalone** image and runs it alongside the engine + Postgres. `ENGINE_ORIGIN`
is read **at runtime** by the proxy route handler (`app/api/engine/[...path]/route.ts`), so the same
image is portable across environments with only an env var, no rebuild — `docker compose` sets it to
`http://engine:8080`, Vercel sets it to the engine's public URL (see [`Dockerfile`](./Dockerfile) and
[`../docker-compose.yml`](../docker-compose.yml)). **Deployed live** on Vercel →
[`../docs/deploy.md`](../docs/deploy.md).

## Routes

| Route | Surface | Kind |
|-------|---------|------|
| `/` | **Landing** — Nocturne hero, schematic settlement-path section, working nav/CTAs | interactive TSX |
| `/app/access` | **Desk access** — generate/import a real Stellar keypair; gates `/app/*` | interactive TSX |
| `/app` | **Desk** — stats, open orders, activity | interactive TSX |
| `/app/compose` | **Compose & seal** — live order form (side/TIF toggles, inputs, seal preview) | interactive TSX |
| `/app/pool` | **In the pool** — shielded lattice + your order | interactive TSX |
| `/app/proofs` | **Match · prove · verify** — pipeline + proof/on-chain panels | interactive TSX |
| `/app/settled` | **Settlement** — atomic receipt + explorer link | interactive TSX |
| `/app/positions` | **Positions** — on-brand placeholder (view pending) | interactive TSX |
| `/brand-board` | Brand Board | embedded showcase |
| `/directions` | Blotter / Nocturne / Schematic | embedded showcase |
| `/deliverables` | Hub linking the surfaces | TSX |

## The landing (`/`)

Real TSX rebuilt from `design-src/Nyx Landing.dc.html`, preserving the look — **including the
deliberate swap** of the "Four steps. Nothing revealed." section for the **Schematic** node graph
(Direction C from `design-src/Nyx Directions.dc.html`): commit → prove → verify → settle as nodes
on an animated connector, with the `0 bytes / None / Atomic` spec strip. It's a Server Component
(only `<Link>` + anchors + external `<a>`, no JS). Link behavior:

| Element | Goes to |
|---------|---------|
| Nav **Protocol** / **Proofs** | smooth-scroll to `#how` / `#trust` |
| Nav **Docs**, hero **Read the spec**, schematic **READ THE SPEC** | the repo (new tab) |
| Nav **Enter the pool**, hero/CTA **Request desk access** | `/app/access` |
| CTA **Talk to us** | `mailto:` — **placeholder address, set it in `app/page.tsx` (`CONTACT`)** |

Smooth scrolling is enabled by `html { scroll-behavior: smooth }` in `app/globals.css`; sections
carry `scrollMarginTop` to clear the sticky nav.

## The product app (`/app/*`)

The App design canvas was a *presentation board* (light background, floating cards, captions). It
is **productized** here into a full-screen dark app: a persistent shell (`app/app/(shell)/layout.tsx`)
with a sidebar (`SideNav`, active-route highlight via `usePathname`) and a scrolling content area.
The sign-in screen sits outside the shell (route group `(shell)`), so `/app/access` renders
full-screen.

Each data screen is a small `'use client'` island: `SideNav` (active state), `ComposeForm`,
`DeskBody`, `PoolBody`, `ProofsBody`, `SettledBody`. They are **wired to the Go engine** (see below)
and poll live state; the shell/layout stays a Server Component.

### Wired to the engine (Phase 5.1)

- **Proxy, not CORS.** Client code only ever fetches relative `/api/engine/*`; a **route handler**
  (`app/api/engine/[...path]/route.ts`) reads **`ENGINE_ORIGIN`** (default `http://localhost:8080`)
  **per request** and forwards server-side. Works identically in `next dev`, `next start`, **and as a
  Vercel serverless function**; the engine needs no CORS and stays private. Set `ENGINE_ORIGIN` (env,
  or `.env.local` from `.env.example`) to point at any engine — no rebuild. The typed client is
  `app/_lib/engine.ts`.
- **Compose seals for real.** `app/_lib/seal.ts` computes the **actual Poseidon commitment**
  (`circomlibjs`, the same lib + constants as `circuits/scripts/gen_input.js`) over
  `[price, volume, salt]`, so a frontend-sealed order is genuinely provable. **Price is scaled ×100**
  (2 decimals → integer cents) and size separators are stripped, to match the engine's base-10
  integer domain; a fresh random salt is generated per order. "Seal & broadcast" `POST`s `/orders`,
  stores the returned id in `localStorage`, and routes to `/app/pool?order=<id>`.
- **Pair selector (real).** Compose has a working `<select>` of RWA pairs
  (`US-TBILL-26/27`, `EU-BUND-30`, `GOLD-RWA`, all vs `USDC`). The chosen pair is sent as
  `asset_pair` and threaded through the active-order meta into Pool/Proofs/Settled and the demo-mode
  counterparty. The engine matches **per pair**, so a manual two-desk cross requires both desks to
  pick the **same** pair (different pairs never cross).
- **Live screens poll.** Desk renders `GET /orders` (counts + table + activity); Pool shows the open
  commitments as the lattice + your active order; Proofs/Settled follow the active order's `match_id`
  → `GET /matches/{id}` to drive the pipeline and show the on-chain status + a **stellar.expert
  testnet** link for the settlement tx. Price/size are never returned by the API (they stay sealed).

### Desk auth (Phase 5.2)

`/app/access` generates or imports a real **Stellar keypair** (`@stellar/stellar-base`,
`app/_lib/desk.ts`). `AuthGate` (`app/app/_components/AuthGate.tsx`) gates `/app/*` — no desk ⇒
redirect to `/app/access`. The desk's **G-address is the order `pubkey`**, shown in the sidebar
(`DeskFooter`), and **every order's commitment is signed** (base64 ed25519); the **engine verifies
the signature** (`internal/stellarkey`; enforced with `NYX_REQUIRE_ORDER_SIG=true`).

> SECURITY SEAM: for this client-only demo the secret seed is kept in `localStorage` so the browser
> can sign. A real deployment would sign via the [Freighter](https://www.freighter.app/) wallet
> extension, where the secret never leaves the wallet — same signature scheme + engine verification,
> only the signing seam in `desk.ts` changes. Full write-up:
> [`../docs/key-custody.md`](../docs/key-custody.md). Generated desks are throwaway. **`localStorage`
> keys:** `nyx.desk`, `nyx.activeOrder` (JSON `{id,side,pair,priceInt,volumeInt}`), `nyx.demoMode`.

### Demo flow & counterparty

A full settle needs a **crossing counter-order** (ask.price ≤ bid.price, equal volume). Three ways:

- **Demo-Mode (default ON)** — a sidebar toggle ("Auto-fill counterparty · demo"). After Seal &
  broadcast, the Pool screen waits ~2.5s and, if your order is still open and no real opposing order
  has appeared, auto-posts **one** crossing signed counter (same pair/price/volume, opposite side).
  So a solo order settles end-to-end. **Race fallback:** if a real counter (e.g. a 2nd tab) lands
  first, the auto-fill cancels itself.
- **Manual multi-tab** — toggle Demo-Mode **OFF** in two tabs (two desks): Tab A composes a BID,
  Tab B a crossing ASK (same pair/size) → the matcher pairs the two real orders.
- **Terminal seeder** — `node ../scripts/seed_demo_orders.js` posts a crossing pair (unsigned; run
  the engine without `NYX_REQUIRE_ORDER_SIG`).

```
/  →  Enter the pool  →  /app/access  →  Generate/Import key  →  /app (Desk)
   →  + New  →  /app/compose  →  Seal & broadcast  →  /app/pool  →  /app/proofs  →  /app/settled
```

The Settled screen's **Download receipt** button saves a JSON settlement receipt
(`nyx-receipt-<match>.json`) with the match, on-chain status, tx, and explorer link.

> **Completing the on-chain leg.** The Proofs pipeline's last two stages ("Verifying on-chain" →
> "Atomic settlement") only go DONE when the engine reports `onchain_status: confirmed`, which needs
> on-chain settlement **enabled** (`NYX_SOROBAN_CONTRACT_ID` set). That's the case on the **live
> deployment** (<https://nyx-darkpool.vercel.app>) and with `make demo`; plain `docker compose` leaves
> it unset, so those two stages spin `pending` by design. For a live end-to-end demo with a real,
> browsable settlement tx, open the live site or follow [`../docs/demo-script.md`](../docs/demo-script.md).

## Layout

```
web/
├── app/
│   ├── layout.tsx              # root layout; Google Fonts (literal family names) + globals.css
│   ├── globals.css             # brand tokens (:root vars), reset, ::selection, keyframes, smooth scroll
│   ├── page.tsx                # /  → interactive landing (with the schematic swap)
│   ├── _components/Eclipse.tsx # the eclipse mark, reused across landing + app
│   ├── _lib/design.tsx         # <Design/> — verbatim render for the embedded showcases
│   ├── _lib/engine.ts          # typed client for the engine API (/api/engine/*)
│   ├── _lib/seal.ts            # in-browser Poseidon commitment (circomlibjs) + value scaling
│   ├── _lib/desk.ts            # Stellar keypair desk identity + order signing (stellar-base)
│   ├── _lib/ui.ts              # formatters + active-order meta + demo-mode helpers
│   ├── _content/{brand-board,directions}.html   # the embedded showcase bodies
│   ├── brand-board/page.tsx · directions/page.tsx · deliverables/page.tsx
│   └── app/
│       ├── _components/{SideNav,Topbar,ComposeForm,DeskBody,PoolBody,ProofsBody,SettledBody}.tsx
│       ├── _components/{AccessForm,AuthGate,DeskFooter}.tsx   # auth: sign-in, route gate, identity+demo toggle
│       ├── access/page.tsx     # /app/access (full-screen, outside the shell)
│       └── (shell)/            # product shell route group
│           ├── layout.tsx      # sidebar + content frame
│           ├── page.tsx        # /app (Desk)
│           └── {compose,pool,proofs,settled,positions}/page.tsx
├── design-src/                 # the 4 Claude Design canvases — SOURCE OF TRUTH, do not edit
├── types/circomlibjs.d.ts      # ambient types for circomlibjs (ships none)
├── .env.example                # ENGINE_ORIGIN for the /api/engine proxy
├── next.config.mjs · tsconfig.json · package.json
└── README.md
```

## Fonts & tokens

- **Fonts** load via a Google Fonts `<link>` in `app/layout.tsx` (not `next/font`) so the literal
  family names `'Spectral'`, `'Archivo'`, `'IBM Plex Mono'` used in styles resolve. Needs an
  internet connection to render as designed.
- **Tokens** live in `app/globals.css` (`:root` custom properties) — the canonical reference for
  the palette, type, and motion, and they drive the shared body/selection chrome.

### Brand tokens (from Nyx Brand Board)

| Role | Value |
|------|-------|
| Void / Moon (bg / text) | `#07080A` / `#ECEEF0` |
| Surfaces / lines | `#0D0F12` · `#15181D` · `#23272E` / `#13171C` · `#16191D` |
| Accent · Lumen | `#3BD7E0` (deep `#0E7E86`, veil `#0A2E31`) |
| Functional | Bid `#43C08A` · Ask `#E05A6E` |
| Type | Spectral · Archivo · IBM Plex Mono |

## Notes & placeholders

- `CONTACT` mailto in `app/page.tsx` and the **Positions** screen are placeholders.
- The `/app` screens are **wired to the engine** (real keypair auth → signed orders → matching →
  proof → on-chain settlement), with a working **Download receipt** and a default-on **Demo-Mode**
  counterparty — see *Desk auth* and *Demo flow & counterparty* above. Remaining seam: the desk
  secret lives in `localStorage` (real deploys sign via a wallet extension).
- `design-src/` is authoritative; the embedded showcases under `app/_content/` are derived.
