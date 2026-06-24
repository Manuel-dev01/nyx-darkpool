import type { Metadata } from "next";
import Link from "next/link";
import type { CSSProperties } from "react";

export const metadata: Metadata = {
  title: "Nyx Darkpool — Design Deliverables",
};

const mono = "'IBM Plex Mono', monospace";
const serif = "'Spectral', serif";

const card: CSSProperties = {
  textDecoration: "none",
  background: "#0A0C0F",
  padding: "44px 38px",
  display: "flex",
  flexDirection: "column",
  gap: 14,
  minHeight: 200,
};
const kicker: CSSProperties = {
  fontFamily: mono,
  fontSize: 11,
  letterSpacing: "0.16em",
  color: "#565C64",
  textTransform: "uppercase",
};
const title: CSSProperties = { fontFamily: serif, fontSize: 30, color: "#ECEEF0" };
const body: CSSProperties = { fontSize: 14, lineHeight: 1.6, color: "#8A9099" };
const open: CSSProperties = {
  marginTop: "auto",
  fontFamily: mono,
  fontSize: 12,
  color: "#3BD7E0",
  letterSpacing: "0.06em",
};

const items = [
  {
    href: "/brand-board",
    kicker: "01 · Foundations",
    title: "Brand Board",
    body: "Essence, the eclipse mark, color, typography, and motifs — the visual system.",
  },
  {
    href: "/",
    kicker: "02 · Marketing",
    title: "Landing",
    body: "The Nocturne hero — with the Schematic settlement-path node graph in place of the row-list “Four steps. Nothing revealed.”",
  },
  {
    href: "/app",
    kicker: "03 · Product",
    title: "App Flow",
    body: "Six screens, end to end: access → desk → compose & seal → pool → prove & verify → settled.",
  },
  {
    href: "/directions",
    kicker: "04 · Exploration",
    title: "Directions",
    body: "Three landing architectures compared: Blotter, Nocturne, and Schematic.",
  },
];

export default function Page() {
  return (
    <div
      style={{
        background: "#07080A",
        color: "#ECEEF0",
        fontFamily: "'Archivo', sans-serif",
        WebkitFontSmoothing: "antialiased",
        minHeight: "100vh",
        overflowX: "hidden",
      }}
    >
      <div style={{ maxWidth: 1080, margin: "0 auto", padding: "120px 40px 70px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 13, marginBottom: 54 }}>
          <svg width="26" height="26" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="40" fill="none" stroke="#23272E" strokeWidth="6" />
            <circle
              cx="50"
              cy="50"
              r="40"
              fill="none"
              stroke="#3BD7E0"
              strokeWidth="6"
              strokeLinecap="round"
              strokeDasharray="168 252"
              transform="rotate(-62 50 50)"
            />
          </svg>
          <span style={{ fontFamily: serif, fontSize: 22, letterSpacing: "0.01em" }}>Nyx</span>
        </div>
        <div
          style={{
            fontFamily: mono,
            fontSize: 12,
            letterSpacing: "0.22em",
            color: "#3BD7E0",
            textTransform: "uppercase",
            marginBottom: 30,
          }}
        >
          Brand &amp; Product · Design Deliverables
        </div>
        <h1
          style={{
            fontFamily: serif,
            fontWeight: 400,
            fontSize: "clamp(40px,6vw,72px)",
            lineHeight: 1.0,
            letterSpacing: "-0.01em",
            margin: 0,
            color: "#ECEEF0",
          }}
        >
          Trade in the dark.
          <br />
          <span style={{ fontStyle: "italic", color: "#9aa0a8" }}>Settle in the light.</span>
        </h1>
        <p style={{ fontSize: 17, lineHeight: 1.65, color: "#8A9099", maxWidth: 560, margin: "30px 0 0" }}>
          The four Nyx surfaces, implemented from the Claude Design canvases in{" "}
          <span style={{ fontFamily: mono, fontSize: 14, color: "#3BD7E0" }}>web/design-src/</span>.
        </p>
      </div>

      <div
        style={{
          maxWidth: 1080,
          margin: "0 auto 120px",
          padding: "0 40px",
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 1,
          background: "#16191D",
          border: "1px solid #16191D",
        }}
      >
        {items.map((it) => (
          <Link key={it.title} href={it.href} style={card}>
            <div style={kicker}>{it.kicker}</div>
            <div style={title}>{it.title}</div>
            <div style={body}>{it.body}</div>
            <div style={open}>Open →</div>
          </Link>
        ))}
      </div>

      <div style={{ borderTop: "1px solid #16191D" }}>
        <div
          style={{
            maxWidth: 1080,
            margin: "0 auto",
            padding: 40,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 16,
          }}
        >
          <span style={{ fontFamily: serif, fontSize: 15, color: "#8A9099" }}>Nyx Darkpool</span>
          <span
            style={{
              fontFamily: mono,
              fontSize: 10,
              letterSpacing: "0.16em",
              color: "#3D434B",
              textTransform: "uppercase",
            }}
          >
            Source of truth · web/design-src/*.dc.html
          </span>
        </div>
      </div>
    </div>
  );
}
