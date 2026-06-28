import type { Metadata } from "next";
import type { CSSProperties } from "react";
import Link from "next/link";
import { Eclipse } from "./_components/Eclipse";

export const metadata: Metadata = {
  title: "Nyx Darkpool — Trade in the dark",
};

/*
  The Nyx marketing landing — real, interactive TSX (was embedded markup).
  Design preserved from design-src/Nyx Landing.dc.html, including the deliberate
  swap of the "Four steps. Nothing revealed." section for the SCHEMATIC
  settlement-path node graph (Direction C from Nyx Directions). All nav items
  and CTAs are real links: anchor-scroll within the page, /app/access to enter
  the product, and the repo / a mailto for spec & contact.
*/

const REPO = "https://github.com/Manuel-dev01/nyx-darkpool";
// "Talk to us" points at the repo's issues so it's never a dead mailbox. Swap for
// a real `mailto:` once there's a monitored desk contact.
const CONTACT = `${REPO}/issues`;

const serif = "'Spectral', serif";
const body = "'Archivo', sans-serif";
const mono = "'IBM Plex Mono', monospace";

const navLink: CSSProperties = {
  fontFamily: mono,
  fontSize: 11,
  letterSpacing: "0.14em",
  color: "#8A9099",
  textTransform: "uppercase",
  textDecoration: "none",
};
const sectionAnchor: CSSProperties = { scrollMarginTop: 84 };

// Filled "Lumen" CTA button
const ctaFilled: CSSProperties = {
  fontFamily: serif,
  fontSize: 20,
  color: "#07080A",
  background: "#3BD7E0",
  padding: "14px 26px",
  textDecoration: "none",
  display: "inline-block",
};
// Quiet mono CTA
const ctaQuiet: CSSProperties = {
  fontFamily: mono,
  fontSize: 12,
  letterSpacing: "0.14em",
  color: "#8A9099",
  textTransform: "uppercase",
  textDecoration: "none",
};

export default function Landing() {
  return (
    <div
      style={{
        background: "#07080A",
        color: "#ECEEF0",
        fontFamily: body,
        WebkitFontSmoothing: "antialiased",
        overflowX: "hidden",
      }}
    >
      {/* ===================== NAV ===================== */}
      <div
        style={{
          position: "sticky",
          top: 0,
          zIndex: 50,
          background: "rgba(7,8,10,0.82)",
          backdropFilter: "blur(10px)",
          borderBottom: "1px solid #13171C",
        }}
      >
        <div
          style={{
            maxWidth: 1280,
            margin: "0 auto",
            padding: "20px 48px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <Link href="/" style={{ display: "flex", alignItems: "center", gap: 12, textDecoration: "none", color: "#ECEEF0" }}>
            <Eclipse size={20} />
            <span style={{ fontFamily: serif, fontSize: 19, letterSpacing: "0.01em" }}>Nyx</span>
          </Link>
          <div style={{ display: "flex", alignItems: "center", gap: 38 }}>
            <a href="#how" style={navLink}>Protocol</a>
            <a href="#trust" style={navLink}>Proofs</a>
            <a href={REPO} target="_blank" rel="noreferrer" style={navLink}>Docs</a>
            <Link
              href="/app/access"
              style={{ fontFamily: serif, fontSize: 15, color: "#ECEEF0", borderBottom: "1px solid #3BD7E0", paddingBottom: 3, textDecoration: "none" }}
            >
              Enter the pool&nbsp;→
            </Link>
          </div>
        </div>
      </div>

      {/* ===================== HERO ===================== */}
      <section id="hero" style={{ ...sectionAnchor, position: "relative", maxWidth: 1280, margin: "0 auto", padding: "150px 48px 170px", minHeight: "88vh" }}>
        <svg
          width="820"
          height="820"
          viewBox="0 0 100 100"
          style={{ position: "absolute", right: -260, top: 90, opacity: 0.92, animation: "nyxFloat 11s ease-in-out infinite" }}
          aria-hidden="true"
        >
          <circle cx="50" cy="50" r="44" fill="none" stroke="#13171C" strokeWidth="0.7" />
          <circle cx="50" cy="50" r="44" fill="none" stroke="#3BD7E0" strokeWidth="0.7" strokeLinecap="round" strokeDasharray="150 277" transform="rotate(-72 50 50)" />
        </svg>

        <div style={{ position: "relative", maxWidth: 880 }}>
          <div style={{ fontFamily: mono, fontSize: 11, letterSpacing: "0.26em", color: "#3BD7E0", textTransform: "uppercase", marginBottom: 52 }}>
            Σ &nbsp; A dark pool for institutional RWA
          </div>
          <h1 style={{ fontFamily: serif, fontWeight: 300, fontSize: "clamp(56px,8vw,104px)", lineHeight: 1.0, letterSpacing: "-0.018em", margin: 0, color: "#ECEEF0" }}>
            The night that<br />even Zeus<br />would not <span style={{ fontStyle: "italic", color: "#3BD7E0" }}>cross.</span>
          </h1>
          <p style={{ fontFamily: serif, fontWeight: 300, fontSize: 23, lineHeight: 1.55, color: "#9aa0a8", maxWidth: 540, margin: "48px 0 0" }}>
            Nyx settles institutional size in the dark. Price and volume are sealed as commitments; a zero-knowledge proof — not your
            counterparty, not the chain — attests the match.
          </p>
          <div style={{ display: "flex", alignItems: "center", gap: 36, marginTop: 52, flexWrap: "wrap" }}>
            <Link href="/app/access" style={{ ...ctaFilled, padding: "14px 26px" }}>Request desk access</Link>
            <a href={REPO} target="_blank" rel="noreferrer" style={ctaQuiet}>Read the spec →</a>
          </div>
        </div>

        <div style={{ position: "absolute", left: 48, bottom: 56, display: "flex", alignItems: "center", gap: 14 }}>
          <span style={{ fontFamily: mono, fontSize: 10, letterSpacing: "0.24em", color: "#3D434B", textTransform: "uppercase" }}>Scroll</span>
          <div style={{ width: 42, height: 1, background: "#23272E" }} />
        </div>
      </section>

      {/* ===================== MANIFESTO ===================== */}
      <section id="why" style={{ ...sectionAnchor, borderTop: "1px solid #13171C" }}>
        <div style={{ maxWidth: 1280, margin: "0 auto", padding: "130px 48px", display: "flex", gap: 40 }}>
          <div style={{ flex: "none", width: 120, paddingTop: 14 }}>
            <span style={{ fontFamily: mono, fontSize: 11, letterSpacing: "0.18em", color: "#3D434B" }}>01 / WHY</span>
          </div>
          <div style={{ flex: 1, maxWidth: 840 }}>
            <p style={{ fontFamily: serif, fontWeight: 300, fontSize: "clamp(30px,3.6vw,46px)", lineHeight: 1.34, letterSpacing: "-0.005em", color: "#ECEEF0", margin: 0 }}>
              When a large order touches a public mempool, the market sees you coming. Price moves before you fill.{" "}
              <span style={{ color: "#3BD7E0" }}>Nyx removes the tell.</span> Orders never reveal price or volume — only a commitment,
              and a proof that the match was honest.
            </p>
            <div style={{ marginTop: 72, paddingLeft: 40, borderLeft: "1px solid #23272E", maxWidth: 560 }}>
              <p style={{ fontFamily: serif, fontStyle: "italic", fontWeight: 300, fontSize: 27, lineHeight: 1.45, color: "#9aa0a8", margin: 0 }}>
                &ldquo;Liquidity should not cost you your hand of cards.&rdquo;
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ============ HOW IT WORKS · SCHEMATIC (swapped in) ============ */}
      <section
        id="how"
        style={{
          ...sectionAnchor,
          borderTop: "1px solid #13171C",
          position: "relative",
          overflow: "hidden",
          backgroundImage:
            "repeating-linear-gradient(0deg,#0d1014 0,#0d1014 1px,transparent 1px,transparent 44px),repeating-linear-gradient(90deg,#0d1014 0,#0d1014 1px,transparent 1px,transparent 44px)",
        }}
      >
        <div style={{ position: "absolute", top: 0, right: 0, borderLeft: "1px solid #15181D", borderBottom: "1px solid #15181D", padding: "14px 20px", textAlign: "right", background: "#07080A" }}>
          <div style={{ fontFamily: mono, fontSize: 10, letterSpacing: "0.14em", color: "#3BD7E0" }}>FIG. 01</div>
          <div style={{ fontFamily: mono, fontSize: 10, letterSpacing: "0.1em", color: "#565C64", marginTop: 3 }}>NYX SETTLEMENT PATH</div>
        </div>

        <div style={{ maxWidth: 1280, margin: "0 auto", padding: "130px 48px" }}>
          <div style={{ display: "flex", gap: 40, marginBottom: 96 }}>
            <div style={{ flex: "none", width: 120, paddingTop: 8 }}>
              <span style={{ fontFamily: mono, fontSize: 11, letterSpacing: "0.18em", color: "#3D434B" }}>02 / HOW</span>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 11, marginBottom: 30 }}>
                <Eclipse size={18} />
                <span style={{ fontFamily: mono, fontSize: 12, letterSpacing: "0.16em", color: "#8A9099" }}>PROTOCOL // SHIELDED ORDER LIFECYCLE</span>
              </div>
              <h2 style={{ fontFamily: serif, fontWeight: 400, fontSize: "clamp(40px,5vw,54px)", lineHeight: 1.05, color: "#ECEEF0", margin: 0 }}>
                Four steps.<br /><span style={{ fontStyle: "italic", color: "#3BD7E0" }}>Nothing revealed.</span>
              </h2>
            </div>
          </div>

          <div style={{ position: "relative", marginBottom: 90 }}>
            <svg width="100%" height="4" viewBox="0 0 1152 4" preserveAspectRatio="none" style={{ position: "absolute", top: 38, left: 0 }} aria-hidden="true">
              <line x1="0" y1="2" x2="1152" y2="2" stroke="#23272E" strokeWidth="1" />
              <line x1="0" y1="2" x2="1152" y2="2" stroke="#3BD7E0" strokeWidth="1" strokeDasharray="10 10" style={{ animation: "nyxDash 2.5s linear infinite", opacity: 0.7 }} />
            </svg>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 0, position: "relative" }}>
              {STEPS.map((s) => (
                <div key={s.n} style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "0 18px" }}>
                  <div
                    style={{
                      width: 78,
                      height: 78,
                      borderRadius: "50%",
                      border: s.last ? "1px solid #3BD7E0" : "1px solid #23272E",
                      background: s.last ? "#0A2E31" : "#08090B",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      position: "relative",
                      zIndex: 2,
                    }}
                  >
                    <span style={{ fontFamily: mono, fontSize: 22, color: "#3BD7E0" }}>{s.n}</span>
                  </div>
                  <div style={{ fontFamily: serif, fontSize: 22, color: "#ECEEF0", marginTop: 22 }}>{s.title}</div>
                  <div style={{ fontFamily: mono, fontSize: 11, color: "#8A9099", marginTop: 8 }}>{s.sub}</div>
                  <div style={{ width: 1, height: 30, background: "#15181D", margin: "18px 0" }} />
                  <div style={{ fontSize: 13, lineHeight: 1.55, color: "#565C64", textAlign: "center", maxWidth: 200 }}>{s.desc}</div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ borderTop: "1px solid #15181D", paddingTop: 22, display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: 24 }}>
            <div style={{ display: "flex", gap: 48, flexWrap: "wrap" }}>
              {SPECS.map((sp) => (
                <div key={sp.k}>
                  <div style={{ fontFamily: mono, fontSize: 10, color: "#3D434B", letterSpacing: "0.1em", textTransform: "uppercase" }}>{sp.k}</div>
                  <div style={{ fontFamily: mono, fontSize: 16, color: sp.accent ? "#3BD7E0" : "#ECEEF0", marginTop: 6 }}>{sp.v}</div>
                </div>
              ))}
            </div>
            <a href={REPO} target="_blank" rel="noreferrer" style={{ fontFamily: mono, fontSize: 12, color: "#07080A", background: "#3BD7E0", padding: "11px 18px", letterSpacing: "0.04em", textDecoration: "none" }}>
              READ THE SPEC →
            </a>
          </div>
        </div>
      </section>

      {/* ===================== WHAT YOU TRADE ===================== */}
      <section id="what" style={{ ...sectionAnchor, borderTop: "1px solid #13171C" }}>
        <div style={{ maxWidth: 1280, margin: "0 auto", padding: "130px 48px" }}>
          <div style={{ display: "flex", gap: 40, marginBottom: 72 }}>
            <div style={{ flex: "none", width: 120 }}>
              <span style={{ fontFamily: mono, fontSize: 11, letterSpacing: "0.18em", color: "#3D434B" }}>03 / WHAT</span>
            </div>
            <h2 style={{ fontFamily: serif, fontWeight: 300, fontSize: "clamp(34px,4vw,52px)", lineHeight: 1.08, color: "#ECEEF0", margin: 0, maxWidth: 720 }}>
              Real-world assets, traded in the dark.
            </h2>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 80px", borderTop: "1px solid #13171C" }}>
            {ASSETS.map((a) => (
              <div key={a.code} style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", padding: "30px 0", borderBottom: "1px solid #13171C" }}>
                <span style={{ fontFamily: serif, fontSize: 25, color: "#ECEEF0" }}>{a.name}</span>
                <span style={{ fontFamily: mono, fontSize: 11, color: "#565C64" }}>{a.code}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===================== BUILT ON STELLAR ===================== */}
      <section id="stellar" style={{ ...sectionAnchor, borderTop: "1px solid #13171C", background: "#0A0C0F" }}>
        <div style={{ maxWidth: 1280, margin: "0 auto", padding: "130px 48px", display: "flex", gap: 64, alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 420 }}>
            <div style={{ fontFamily: mono, fontSize: 11, letterSpacing: "0.22em", color: "#3BD7E0", textTransform: "uppercase", marginBottom: 34 }}>Built on Stellar</div>
            <h2 style={{ fontFamily: serif, fontWeight: 300, fontSize: "clamp(34px,4vw,50px)", lineHeight: 1.12, color: "#ECEEF0", margin: 0, maxWidth: 560 }}>
              Proofs verified on-chain, natively.
            </h2>
            <p style={{ fontSize: 17, lineHeight: 1.65, color: "#8A9099", maxWidth: 520, margin: "30px 0 0" }}>
              Nyx settles on Stellar because Protocol 26 ships BN254 pairing as native host functions — the elliptic-curve operations a
              zero-knowledge proof needs to be checked directly in a Soroban contract. No bridge, no off-chain verifier, no trust.
            </p>
          </div>
          <div style={{ flex: "none", width: 340, display: "flex", flexDirection: "column", gap: 1, background: "#15181D", border: "1px solid #15181D" }}>
            {STELLAR_ROWS.map((r) => (
              <div key={r.k} style={{ background: "#07080A", padding: "22px 24px", display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                <span style={{ fontFamily: mono, fontSize: 11, color: "#565C64", letterSpacing: "0.1em" }}>{r.k}</span>
                <span style={{ fontFamily: mono, fontSize: 13, color: r.accent ? "#3BD7E0" : "#ECEEF0" }}>{r.v}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===================== PROOF STATS ===================== */}
      <section id="trust" style={{ ...sectionAnchor, borderTop: "1px solid #13171C" }}>
        <div style={{ maxWidth: 1280, margin: "0 auto", padding: "120px 48px", display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 1, background: "#13171C", border: "1px solid #13171C" }}>
          {STATS.map((s) => (
            <div key={s.label} style={{ background: "#07080A", padding: "54px 40px" }}>
              <div style={{ fontFamily: serif, fontWeight: 300, fontSize: 52, color: s.accent ? "#3BD7E0" : "#ECEEF0", lineHeight: 1 }}>{s.big}</div>
              <div style={{ fontFamily: mono, fontSize: 12, color: "#8A9099", marginTop: 16, letterSpacing: "0.08em" }}>{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ===================== ACCESS CTA ===================== */}
      <section id="access" style={{ ...sectionAnchor, borderTop: "1px solid #13171C", position: "relative", overflow: "hidden" }}>
        <svg width="680" height="680" viewBox="0 0 100 100" style={{ position: "absolute", left: "50%", top: "50%", transform: "translate(-50%,-50%)", opacity: 0.5 }} aria-hidden="true">
          <circle cx="50" cy="50" r="44" fill="none" stroke="#13171C" strokeWidth="0.6" />
          <circle cx="50" cy="50" r="44" fill="none" stroke="#3BD7E0" strokeWidth="0.6" strokeLinecap="round" strokeDasharray="150 277" transform="rotate(-72 50 50)" />
        </svg>
        <div style={{ position: "relative", maxWidth: 1280, margin: "0 auto", padding: "170px 48px", textAlign: "center" }}>
          <h2 style={{ fontFamily: serif, fontWeight: 300, fontSize: "clamp(46px,6vw,82px)", lineHeight: 1.02, letterSpacing: "-0.015em", color: "#ECEEF0", margin: 0 }}>
            Enter the <span style={{ fontStyle: "italic", color: "#3BD7E0" }}>pool.</span>
          </h2>
          <p style={{ fontFamily: serif, fontWeight: 300, fontSize: 21, lineHeight: 1.5, color: "#9aa0a8", maxWidth: 480, margin: "32px auto 0" }}>
            Access is permissioned. Desks onboard by invitation, with a signed key.
          </p>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 34, marginTop: 54, flexWrap: "wrap" }}>
            <Link href="/app/access" style={{ ...ctaFilled, padding: "15px 30px" }}>Request desk access</Link>
            <a href={CONTACT} style={ctaQuiet}>Talk to us →</a>
          </div>
        </div>
      </section>

      {/* ===================== FOOTER ===================== */}
      <div style={{ borderTop: "1px solid #13171C" }}>
        <div style={{ maxWidth: 1280, margin: "0 auto", padding: 48, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 18 }}>
          <Link href="/" style={{ display: "flex", alignItems: "center", gap: 12, textDecoration: "none", color: "#8A9099" }}>
            <Eclipse size={18} />
            <span style={{ fontFamily: serif, fontSize: 16, color: "#8A9099" }}>Nyx Darkpool</span>
          </Link>
          <div style={{ display: "flex", gap: 30 }}>
            <a href="#how" style={{ ...navLink, fontSize: 11, color: "#565C64", letterSpacing: "0.12em" }}>Protocol</a>
            <a href="#trust" style={{ ...navLink, fontSize: 11, color: "#565C64", letterSpacing: "0.12em" }}>Proofs</a>
            <a href={REPO} target="_blank" rel="noreferrer" style={{ ...navLink, fontSize: 11, color: "#565C64", letterSpacing: "0.12em" }}>Docs</a>
          </div>
          <span style={{ fontFamily: mono, fontSize: 10, letterSpacing: "0.14em", color: "#3D434B", textTransform: "uppercase" }}>© 2026 · Built on Stellar · Trade in the dark</span>
        </div>
      </div>
    </div>
  );
}

const STEPS = [
  { n: "01", title: "Commit", sub: "Poseidon hash", desc: "Price & size never leave the client. The order exists only as a commitment.", last: false },
  { n: "02", title: "Prove", sub: "ZK circuit", desc: "A proof attests maker ∩ taker intersect at a valid price and volume.", last: false },
  { n: "03", title: "Verify", sub: "Soroban · BN254", desc: "A contract checks the proof on-chain using native BN254 host functions.", last: false },
  { n: "04", title: "Settle", sub: "Atomic swap", desc: "RWA ⇄ USDC change hands in a single atomic settlement. Done.", last: true },
];

const SPECS = [
  { k: "Disclosure", v: "0 bytes", accent: false },
  { k: "Trust assumed", v: "None", accent: false },
  { k: "Settlement", v: "Atomic", accent: true },
];

const ASSETS = [
  { name: "U.S. Treasury bills", code: "TBILL-26" },
  { name: "Private credit", code: "CRE-DEBT-A" },
  { name: "Tokenized gold", code: "GOLD-RWA" },
  { name: "Infrastructure ABS", code: "SOLAR-ABS" },
  { name: "Real-estate debt", code: "RE-DEBT-B" },
  { name: "Carbon credits", code: "CARBON-V" },
];

const STELLAR_ROWS = [
  { k: "NETWORK", v: "Stellar · P26", accent: false },
  { k: "PAIRING", v: "BN254 host fn", accent: false },
  { k: "CONTRACT", v: "Soroban", accent: false },
  { k: "SETTLE", v: "~5s · atomic", accent: true },
];

const STATS = [
  { big: "0 bytes", label: "of price or volume disclosed", accent: true },
  { big: "No operator", label: "to trust between counterparties", accent: false },
  { big: "Atomic", label: "settlement — all of it, or none", accent: false },
];
