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

Interactivity is kept to small `'use client'` islands — `SideNav` (active state) and `ComposeForm`
(BID/ASK + GTC/IOC/1H toggles, controlled price/size inputs, live seal preview). Screens are
otherwise Server Components. Navigational buttons use `<Link>` (e.g. **+ New** → compose,
**Seal & broadcast** → pool, **Authenticate** → desk); genuinely-stateful actions are real
`<button>`s that are **no-ops for now** (e.g. **Download receipt**) — the matching/proof/settlement
**logic is intentionally not wired yet**. Demo flow:

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
│   ├── _content/{brand-board,directions}.html   # the embedded showcase bodies
│   ├── brand-board/page.tsx · directions/page.tsx · deliverables/page.tsx
│   └── app/
│       ├── _components/{SideNav,Topbar,ComposeForm}.tsx
│       ├── access/page.tsx     # /app/access (full-screen, outside the shell)
│       └── (shell)/            # product shell route group
│           ├── layout.tsx      # sidebar + content frame
│           ├── page.tsx        # /app (Desk)
│           └── {compose,pool,proofs,settled,positions}/page.tsx
├── design-src/                 # the 4 Claude Design canvases — SOURCE OF TRUTH, do not edit
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
- The product UI is presentational; **order matching, proof generation, and settlement logic are
  not wired** — the buttons and flow are real, the backend hooks come next.
- `design-src/` is authoritative; the embedded showcases under `app/_content/` are derived.
