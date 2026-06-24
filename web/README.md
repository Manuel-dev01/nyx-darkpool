# web — Nyx brand & product (Next.js)

The Nyx visual identity and product surfaces as a **Next.js (App Router, TypeScript)**
application. Each Claude Design canvas is implemented as a route; the markup is rendered
**verbatim** from the approved design so the pages stay pixel-identical to the source.

## Run it

```bash
cd web
npm install
npm run dev      # http://localhost:3000
# or
npm run build && npm start
```

All routes are statically prerendered (`next build` → `○ (Static)`), so the app can also be
deployed to any static/edge host (e.g. Vercel) with no server runtime.

## Routes

| Route | Surface | Source canvas |
|-------|---------|---------------|
| `/` | **Landing** (homepage) — Nocturne hero, **with the schematic swap** | `design-src/Nyx Landing.dc.html` (+ Directions C) |
| `/brand-board` | Brand Board — essence, eclipse mark, color, type, motifs | `design-src/Nyx Brand Board.dc.html` |
| `/app` | App Flow — 6 screens, access → … → settled | `design-src/Nyx App.dc.html` |
| `/directions` | Directions — Blotter / Nocturne / Schematic compared | `design-src/Nyx Directions.dc.html` |
| `/deliverables` | Hub linking the four surfaces (hand-written TSX) | — |

## Layout

```
web/
├── app/
│   ├── layout.tsx        # root layout; loads Google Fonts (literal family names) + globals.css
│   ├── globals.css       # brand tokens (:root vars), reset, ::selection, shared @keyframes
│   ├── page.tsx          # /            → renders the landing canvas (with the swap)
│   ├── brand-board/page.tsx
│   ├── app/page.tsx
│   ├── directions/page.tsx
│   ├── deliverables/page.tsx   # the hub, written as real TSX with next/link
│   ├── _lib/design.tsx   # <Design file=…/> — reads a partial and renders it verbatim
│   └── _content/         # the approved canvas bodies (the implemented markup)
│       ├── landing.html  #   ← contains the schematic-swapped "Four steps" section
│       ├── brand-board.html
│       ├── app.html
│       └── directions.html
├── design-src/           # the 4 Claude Design canvases — SOURCE OF TRUTH, do not edit
├── next.config.mjs · tsconfig.json · package.json
└── README.md
```

## How the designs are rendered (embed, not rewrite)

The four canvases are self-contained, fully **inline-styled** Claude Design artifacts. Rather
than hand-rewrite ~2,500 lines of inline styles into React style objects (which would risk
visual drift), each route renders the approved body markup **verbatim** through
[`app/_lib/design.tsx`](./app/_lib/design.tsx):

```tsx
export function Design({ file }: { file: string }) {
  const html = readFileSync(join(process.cwd(), "app/_content", file), "utf8");
  return <div dangerouslySetInnerHTML={{ __html: html }} />;
}
```

The partials in `app/_content/*.html` are the `<body>` of each implemented page (inline styles
and inline SVGs intact); they're read at **build time** during static generation and baked into
the prerendered HTML. `app/_content/` is the implemented (derived) markup; **`design-src/` is the
authoritative design.** These pages are static design surfaces — fine to decompose into granular
React components later if the product needs it.

## The landing "Four steps" swap (deliberate divergence)

`/` reproduces the **Nyx Landing** canvas **except for one section**, by explicit request: the
settlement-path section (`data-screen-label="How it works"`) is rendered with **Direction C ·
Schematic** from `design-src/Nyx Directions.dc.html` — the commit → prove → verify → settle
**node graph** (78px circular nodes on an animated dashed connector, node 04 highlighted, a
`Disclosure 0 bytes / Trust assumed None / Settlement Atomic` spec strip, blueprint grid
background, `FIG. 01 / NYX SETTLEMENT PATH` caption) — **in place of** the landing canvas's
original row-list of the same content. The Schematic is absolutely positioned in a fixed 980px
frame in its source canvas; here it is re-flowed into a normal in-flow landing section so it
scrolls with the page. Everything else on the landing is unchanged.

## Fonts & tokens

- **Fonts** load via a Google Fonts `<link>` in [`app/layout.tsx`](./app/layout.tsx) — *not*
  `next/font` — on purpose: the inline styles reference the literal family names `'Spectral'`,
  `'Archivo'`, `'IBM Plex Mono'`, which `next/font` would hash/rename. An internet connection is
  needed for them to render as designed (otherwise the generic serif/sans/mono fallbacks apply).
- **Tokens** live in [`app/globals.css`](./app/globals.css) as `:root` custom properties and are
  the canonical reference for the palette, type stacks, and motion; they also drive the shared
  page chrome (body background, selection). The page bodies keep their inline styles for fidelity,
  so editing a token will not restyle a section's internals — `globals.css` is the source of truth
  for *values*, the `design-src/` canvases for *layout*.

### Brand tokens (from Nyx Brand Board)

| Role | Token | Value |
|------|-------|-------|
| Background | Void | `#07080A` |
| Surface | Obsidian / Slate | `#0D0F12` / `#15181D` |
| Lines | Graphite / borders | `#23272E` · `#16191D` · `#13171C` |
| Text | Moon / Smoke / faint | `#ECEEF0` · `#8A9099` · `#3D434B` |
| Accent · Lumen | Lumen / Deep / Veil | `#3BD7E0` · `#0E7E86` · `#0A2E31` |
| Functional | Bid / Ask | `#43C08A` · `#E05A6E` |
| Type | display / body / data | Spectral · Archivo · IBM Plex Mono |

## Regenerating from the design

If a canvas in `design-src/` changes, re-derive the matching `app/_content/*.html` body (apply
the same conversion: drop the `support.js` script, unwrap `<x-dc>`/`<helmet>`, keep the body
markup; for the landing, re-apply the schematic swap). `design-src/` is authoritative; everything
under `app/_content/` is derived.
