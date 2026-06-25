import type { Metadata } from "next";
import Link from "next/link";
import { Topbar } from "../../_components/Topbar";
import { Eclipse } from "../../../_components/Eclipse";

export const metadata: Metadata = { title: "Nyx — Positions" };

const mono = "'IBM Plex Mono', monospace";
const serif = "'Spectral', serif";

// The design canvas has no Positions screen yet; this is an on-brand placeholder
// so the nav item resolves. (Positions view pending.)
export default function Positions() {
  return (
    <>
      <Topbar title="Positions" />
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: 28 }}>
        <div style={{ textAlign: "center", maxWidth: 420 }}>
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 24, opacity: 0.7 }}>
            <Eclipse size={44} strokeWidth={4} />
          </div>
          <div style={{ fontFamily: mono, fontSize: 11, letterSpacing: "0.2em", color: "#3BD7E0", textTransform: "uppercase", marginBottom: 16 }}>Coming soon</div>
          <h2 style={{ fontFamily: serif, fontWeight: 300, fontSize: 30, color: "#ECEEF0", margin: 0 }}>Net positions &amp; exposure.</h2>
          <p style={{ fontSize: 14, lineHeight: 1.6, color: "#8A9099", margin: "18px 0 28px" }}>
            A consolidated view of settled fills, open commitments, and net exposure per asset — wiring pending.
          </p>
          <Link href="/app" style={{ fontFamily: mono, fontSize: 12, color: "#3BD7E0", letterSpacing: "0.06em", textDecoration: "none" }}>← Back to Desk</Link>
        </div>
      </div>
    </>
  );
}
