import type { Metadata } from "next";
import Link from "next/link";
import { Eclipse } from "../../_components/Eclipse";

export const metadata: Metadata = { title: "Nyx — Desk access" };

const serif = "'Spectral', serif";
const mono = "'IBM Plex Mono', monospace";
const sans = "'Archivo', sans-serif";

// Signed-key sign-in (App canvas screen 01) — the landing's "Enter the pool"
// target. No product shell; "Authenticate" enters the Desk. (Auth logic pending.)
export default function Access() {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#07080A",
        color: "#ECEEF0",
        fontFamily: sans,
        WebkitFontSmoothing: "antialiased",
        position: "relative",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
      }}
    >
      <svg width="620" height="620" viewBox="0 0 100 100" style={{ position: "absolute", left: "50%", top: "50%", transform: "translate(-50%,-50%)", opacity: 0.4 }} aria-hidden="true">
        <circle cx="50" cy="50" r="44" fill="none" stroke="#13171C" strokeWidth="0.6" />
        <circle cx="50" cy="50" r="44" fill="none" stroke="#3BD7E0" strokeWidth="0.6" strokeLinecap="round" strokeDasharray="150 277" transform="rotate(-72 50 50)" />
      </svg>

      <div style={{ position: "relative", width: 400, maxWidth: "90vw", textAlign: "center" }}>
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 26 }}>
          <Eclipse size={40} strokeWidth={5} />
        </div>
        <div style={{ fontFamily: serif, fontSize: 30, color: "#ECEEF0" }}>Nyx <span style={{ color: "#565C64" }}>Darkpool</span></div>
        <div style={{ fontFamily: mono, fontSize: 11, letterSpacing: "0.2em", color: "#3BD7E0", textTransform: "uppercase", marginTop: 10 }}>Desk access</div>

        <div style={{ marginTop: 40, border: "1px solid #15181D", background: "#0A0C0F", padding: 8, display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontFamily: mono, fontSize: 11, color: "#3D434B", paddingLeft: 8 }}>KEY</span>
          <span style={{ flex: 1, textAlign: "left", fontFamily: mono, fontSize: 13, color: "#8A9099", letterSpacing: "0.04em" }}>ssh-ed25519 ··········· 7af0</span>
        </div>
        <Link
          href="/app"
          style={{ display: "block", marginTop: 14, background: "#3BD7E0", color: "#07080A", fontFamily: sans, fontWeight: 600, fontSize: 14, padding: 14, letterSpacing: "0.02em", textDecoration: "none" }}
        >
          Authenticate with signed key
        </Link>

        <div style={{ marginTop: 30, display: "flex", alignItems: "center", justifyContent: "center", gap: 9 }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#43C08A", animation: "nyxPulse 2s ease-in-out infinite" }} />
          <span style={{ fontFamily: mono, fontSize: 10, letterSpacing: "0.14em", color: "#565C64", textTransform: "uppercase" }}>Permissioned · by invitation</span>
        </div>

        <Link href="/" style={{ display: "inline-block", marginTop: 34, fontFamily: mono, fontSize: 10, letterSpacing: "0.14em", color: "#3D434B", textTransform: "uppercase", textDecoration: "none" }}>
          ← Back to site
        </Link>
      </div>

      <div style={{ position: "absolute", left: 28, bottom: 24, fontFamily: mono, fontSize: 10, letterSpacing: "0.14em", color: "#2A2F36", textTransform: "uppercase" }}>Stellar · P26 · BN254</div>
    </div>
  );
}
