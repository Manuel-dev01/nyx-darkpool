# web — Nyx brand & product design

The Nyx visual identity and product surfaces, implemented as **zero-dependency static
HTML/CSS** from the Claude Design canvases. Open any page directly in a browser (no build,
no server) — start with [`index.html`](./index.html), a hub linking the four deliverables.

## Layout

```
web/
├── design-src/        # the 4 Claude Design canvases — SOURCE OF TRUTH, do not edit
│   ├── Nyx Brand Board.dc.html
│   ├── Nyx App.dc.html
│   ├── Nyx Landing.dc.html
│   └── Nyx Directions.dc.html
├── styles/
│   ├── tokens.css     # canonical brand tokens (palette, type, motion) as CSS variables
│   └── base.css       # reset, ::selection, and the shared @keyframes (consumes tokens.css)
├── index.html         # hub linking the deliverables
├── brand-board.html   # ← Nyx Brand Board   (essence, eclipse mark, color, type, motifs, in-use)
├── landing.html       # ← Nyx Landing       (WITH the schematic swap — see below)
├── app.html           # ← Nyx App           (6-screen flow: access → … → settled)
└── directions.html    # ← Nyx Directions    (Blotter / Nocturne / Schematic compared)
```

## Deliberate divergence — the landing "Four steps" swap

[`landing.html`](./landing.html) faithfully reproduces the **Nyx Landing** canvas **except for
one section**, by explicit request:

> Replace the landing's "Four steps. Nothing revealed." section with the **schematic**
> "four steps nothing revealed" direction from **Nyx Directions**.

So the settlement-path section (`data-screen-label="How it works"`) is rendered using
**Direction C · Schematic** from
[`design-src/Nyx Directions.dc.html`](./design-src/Nyx%20Directions.dc.html) — the
commit → prove → verify → settle **node graph** (78px circular nodes on an animated dashed
connector line, node 04 highlighted, a `Disclosure 0 bytes / Trust assumed None / Settlement
Atomic` spec strip, and the grid blueprint background) — **in place of** the landing canvas's
original row-list treatment of the same content. Everything else on the landing (nav, hero,
manifesto, asset classes, Built on Stellar, proof stats, access CTA, footer) is unchanged.

The Schematic is absolutely positioned inside a fixed 980px frame in its source canvas; here it
is re-flowed into a normal in-flow landing section so it scrolls naturally with the rest of the
page.

## How these were produced

Each `.dc.html` canvas is a self-contained, fully **inline-styled** Claude Design artifact wrapped
in `<x-dc>` / `<helmet>` custom elements with a `support.js` runtime hook. The conversion to a
standalone page is mechanical and identical for all four:

1. drop `<script src="./support.js">` (the design-tool runtime — not needed standalone);
2. unwrap `<x-dc>` / `<helmet>`, hoisting the Google Fonts `<link>` into a real `<head>`;
3. link `styles/tokens.css` + `styles/base.css` (`base.css` carries the shared `*{box-sizing}`,
   `html,body` reset, `::selection`, and the five `@keyframes`, deduped from the inline `<style>`);
4. keep the body markup (including `data-screen-label`) verbatim for pixel fidelity.

`app.html` and `directions.html` are presentation boards (light `#e7e5df`, "scroll right to
compare/follow") — faithful reproductions of their canvases, which are themselves showcases rather
than single running screens.

## A note on tokenization (honest scope)

`styles/tokens.css` is the **canonical reference** for the brand palette, type stacks, and motion,
and it drives the shared page chrome (body background, text color, selection) via `base.css`. The
page **bodies retain their original inline styles** to stay pixel-faithful to the design source —
they are intentionally **not** rewritten to consume the tokens, so editing a token will not restyle
a section's internals. Treat `tokens.css` as the source of truth for *values*; the canvases in
`design-src/` are the source of truth for *layout*.

## Brand tokens (from Nyx Brand Board)

| Role | Token | Value |
|------|-------|-------|
| Background | Void | `#07080A` |
| Surface | Obsidian / Slate | `#0D0F12` / `#15181D` |
| Lines | Graphite / borders | `#23272E` · `#16191D` · `#13171C` |
| Text | Moon / Smoke / faint | `#ECEEF0` · `#8A9099` · `#3D434B` |
| Accent · Lumen | Lumen / Deep / Veil | `#3BD7E0` · `#0E7E86` · `#0A2E31` |
| Functional | Bid / Ask | `#43C08A` · `#E05A6E` |
| Type | display / body / data | Spectral · Archivo · IBM Plex Mono |

Fonts load from Google Fonts; an internet connection is needed for them to render as designed
(otherwise the browser falls back to the generic serif / sans / monospace families).

## Regenerating from the design

If a canvas in `design-src/` changes, re-apply the 4-step conversion above to the corresponding
page. The `design-src/` files are the authoritative design; the implemented pages are derived.
