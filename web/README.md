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

## Routes

| Route | Surface | Kind |
|-------|---------|------|
| `/` | **Landing** — Nocturne hero, schematic settlement-path section, working nav/CTAs | interactive TSX |
| `/app/access` | **Desk access** — signed-key sign-in (the landing's "Enter the pool" target) | interactive TSX |
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

- **Proxy, not CORS.** Client code only ever fetches relative `/api/engine/*`; `next.config.mjs`
  rewrites that to **`ENGINE_ORIGIN`** (default `http://localhost:8080`). Works in `next dev` and
  `next start`; the engine needs no CORS and stays private to the Next server. Copy `.env.example`
  → `.env.local` to point at a different engine. The typed client is `app/_lib/engine.ts`.
- **Compose seals for real.** `app/_lib/seal.ts` computes the **actual Poseidon commitment**
  (`circomlibjs`, the same lib + constants as `circuits/scripts/gen_input.js`) over
  `[price, volume, salt]`, so a frontend-sealed order is genuinely provable. **Price is scaled ×100**
  (2 decimals → integer cents) and size separators are stripped, to match the engine's base-10
  integer domain; a fresh random salt is generated per order. "Seal & broadcast" `POST`s `/orders`,
  stores the returned id in `localStorage`, and routes to `/app/pool?order=<id>`.
- **Live screens poll.** Desk renders `GET /orders` (counts + table + activity); Pool shows the open
  commitments as the lattice + your active order; Proofs/Settled follow the active order's `match_id`
  → `GET /matches/{id}` to drive the pipeline and show the on-chain status + a **stellar.expert
  testnet** link for the settlement tx. Price/size are never returned by the API (they stay sealed).

### Demo flow

A full settle needs a **crossing counter-order** (ask.price ≤ bid.price, equal volume). Either
compose an **ASK then a BID** that cross via the UI, or run the one-command seeder:

```bash
# 1. engine + Postgres running (see ../engine/README.md); 2. then:
node ../scripts/seed_demo_orders.js          # posts a crossing pair → matcher pairs/proves/settles
```

```
/  →  Enter the pool  →  /app/access  →  Authenticate  →  /app (Desk)
   →  + New  →  /app/compose  →  Seal & broadcast  →  /app/pool  →  /app/proofs  →  /app/settled
```

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
│   ├── _lib/ui.ts              # small shared formatters + active-order helper
│   ├── _content/{brand-board,directions}.html   # the embedded showcase bodies
│   ├── brand-board/page.tsx · directions/page.tsx · deliverables/page.tsx
│   └── app/
│       ├── _components/{SideNav,Topbar,ComposeForm,DeskBody,PoolBody,ProofsBody,SettledBody}.tsx
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
- The `/app` screens are **wired to the engine** (orders → matching → proof → on-chain settlement).
  The **access** sign-in is still cosmetic (no real auth), **Download receipt** is a no-op, and
  price/size are scaled/sealed client-side — see *Wired to the engine* above.
- `design-src/` is authoritative; the embedded showcases under `app/_content/` are derived.
